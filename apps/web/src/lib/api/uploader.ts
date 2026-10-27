/**
 * Universal Resilient File Uploader
 * Handles direct-to-cloud presigned uploads (GCS, R2, S3, Bunny) with automatic
 * fallback to local sovereign streaming uploads. Supports exponential backoff retries,
 * network recovery, progress events (0-100%), and abort signals.
 */

import { apiClient } from "./client";

export interface UploadTicketResponse {
  upload_url: string;
  file_key: string;
  method: string;
  headers?: Record<string, string>;
  is_cloud: boolean;
  category: string;
  expires_in_seconds: number;
  driver_name: string;
}

export interface UploadedFileResult {
  url: string;
  fileId: number;
  fileKey: string;
  filename: string;
  size: number;
  contentType: string;
  isSovereign?: boolean;
  driver?: string;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  maxRetries?: number;
}

/**
 * Generate a client-side temporary preview URL for images and videos.
 */
export function generateClientPreview(file: File): string | null {
  if (typeof window === "undefined") return null;
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return URL.createObjectURL(file);
  }
  return null;
}

/**
 * Sleep helper for backoff delays with jitter.
 */
function sleepWithJitter(attempt: number, baseDelayMs = 1500): Promise<void> {
  const exponential = Math.pow(2, attempt) * baseDelayMs;
  const jitter = Math.random() * 500;
  return new Promise((resolve) => setTimeout(resolve, exponential + jitter));
}

/**
 * Upload any file with real-time progress tracking and exponential backoff retry.
 */
export async function uploadFileWithProgress(
  file: File,
  category:
    | "avatars"
    | "attachments"
    | "datasets"
    | "invoices"
    | "courses" = "attachments",
  options: UploadOptions = {},
): Promise<UploadedFileResult> {
  const { onProgress, signal, maxRetries = 3 } = options;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    if (signal?.aborted) {
      throw new DOMException("Upload aborted by user", "AbortError");
    }

    try {
      // 1. Request upload ticket from FastAPI
      const ticket = await apiClient.post<UploadTicketResponse>(
        "/api/files/upload-ticket",
        {
          filename: file.name,
          category,
          content_type: file.type || "application/octet-stream",
          size: file.size,
        },
      );

      // 2. Direct Cloud Upload (GCS / R2 / S3 / Bunny)
      if (ticket.is_cloud) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          if (signal) {
            signal.addEventListener("abort", () => {
              xhr.abort();
              reject(new DOMException("Upload aborted by user", "AbortError"));
            });
          }

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
              const percent = Math.min(
                100,
                Math.round((e.loaded / e.total) * 100),
              );
              onProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              if (onProgress) onProgress(100);
              resolve();
            } else {
              reject(
                new Error(
                  `Direct storage upload failed with status ${xhr.status}: ${xhr.statusText}`,
                ),
              );
            }
          };

          xhr.onerror = () =>
            reject(new Error("Network error during direct storage upload"));
          xhr.onabort = () =>
            reject(new DOMException("Upload aborted", "AbortError"));

          xhr.open(ticket.method || "PUT", ticket.upload_url);

          if (ticket.headers) {
            Object.entries(ticket.headers).forEach(([k, v]) => {
              xhr.setRequestHeader(k, v);
            });
          }

          xhr.send(file);
        });

        // 3. Confirm upload with FastAPI to record metadata in database
        const confirmRes = await apiClient.post<{
          id: number;
          filename: string;
          url: string;
          size: number;
          content_type: string;
          is_sovereign?: boolean;
          driver?: string;
        }>("/api/files/confirm-upload", {
          file_key: ticket.file_key,
          filename: file.name,
          category,
          size: file.size,
          content_type: file.type || "application/octet-stream",
        });

        return {
          url: confirmRes.url,
          fileId: confirmRes.id,
          fileKey: ticket.file_key,
          filename: confirmRes.filename,
          size: confirmRes.size,
          contentType: confirmRes.content_type,
          isSovereign: confirmRes.is_sovereign,
          driver: confirmRes.driver,
        };
      }

      // 4. Local Sovereign Streaming Upload (with XHR progress)
      const formData = new FormData();
      formData.append("file", file);

      const localRes = await apiClient.uploadWithProgress<{
        id: number;
        filename: string;
        url: string;
        size: number;
        content_type: string;
        is_sovereign?: boolean;
        driver?: string;
      }>(ticket.upload_url, formData, {
        onProgress: (percent: number) => {
          if (onProgress) {
            onProgress(percent);
          }
        },
      });

      return {
        url: localRes.url,
        fileId: localRes.id,
        fileKey: ticket.file_key,
        filename: localRes.filename,
        size: localRes.size,
        contentType: localRes.content_type,
        isSovereign: localRes.is_sovereign ?? true,
        driver: localRes.driver ?? "local",
      };
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) {
        throw err;
      }

      attempt++;
      lastError = err;

      if (attempt <= maxRetries) {
        console.warn(
          `Upload attempt ${attempt} failed. Retrying with exponential backoff...`,
          err,
        );
        await sleepWithJitter(attempt);
      }
    }
  }

  throw lastError || new Error("File upload failed after retries");
}
