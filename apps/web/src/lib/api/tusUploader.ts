/**
 * Tus v1.0.0 Resumable Video Ingestion Client
 * Tailored for emerging markets & Algerian carrier networks (Mobilis, Djezzy, Ooredoo 4G LTE).
 * Features chunked streaming, real-time speed (MB/s), ETA calculation, pause/resume,
 * and automatic retry with exponential backoff on network dropouts.
 */

export interface TusUploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percent: number;
  speedMBs: number;
  etaSeconds: number;
  chunkIndex: number;
  totalChunks: number;
  isRetrying?: boolean;
  retryAttempt?: number;
}

export interface TusUploadOptions {
  endpoint?: string;
  chunkSize?: number; // Default 5 MB (5 * 1024 * 1024)
  metadata?: Record<string, string>;
  maxRetries?: number;
  onProgress?: (progress: TusUploadProgress) => void;
  onSuccess?: (result: { uploadId: string; location: string }) => void;
  onError?: (error: Error) => void;
}

export class TusUploader {
  private file: File;
  private options: Required<TusUploadOptions>;
  private isPaused: boolean = false;
  private isAborted: boolean = false;
  private uploadUrl: string | null = null;
  private currentOffset: number = 0;
  private lastProgressTime: number = 0;
  private lastProgressBytes: number = 0;
  private smoothedSpeedMBs: number = 0;

  constructor(file: File, options: TusUploadOptions = {}) {
    this.file = file;
    this.options = {
      endpoint: options.endpoint || "/api/v1/video/tus",
      chunkSize: options.chunkSize || 5 * 1024 * 1024, // 5 MB
      metadata: options.metadata || {},
      maxRetries: options.maxRetries ?? 5,
      onProgress: options.onProgress || (() => {}),
      onSuccess: options.onSuccess || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  public async start(): Promise<void> {
    this.isPaused = false;
    this.isAborted = false;

    try {
      if (!this.uploadUrl) {
        await this.createUploadSession();
      } else {
        await this.queryOffset();
      }

      await this.uploadChunks();
    } catch (err: unknown) {
      if (this.isPaused || this.isAborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError(error);
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public async resume(): Promise<void> {
    if (!this.isPaused) return;
    this.isPaused = false;
    try {
      await this.queryOffset();
      await this.uploadChunks();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError(error);
    }
  }

  public async abort(): Promise<void> {
    this.isAborted = true;
    this.isPaused = true;
    if (this.uploadUrl) {
      try {
        await fetch(this.uploadUrl, {
          method: "DELETE",
          headers: { "Tus-Resumable": "1.0.0" },
        });
      } catch {
        // Silently handle termination errors
      }
    }
  }

  private async createUploadSession(): Promise<void> {
    const metaParts: string[] = [];
    const metaObj: Record<string, string> = {
      filename: this.file.name,
      filetype: this.file.type || "video/mp4",
      ...this.options.metadata,
    };

    for (const [key, value] of Object.entries(metaObj)) {
      const encoded = btoa(unescape(encodeURIComponent(value)));
      metaParts.push(`${key} ${encoded}`);
    }

    const response = await this.executeWithRetry(async () => {
      return await fetch(this.options.endpoint, {
        method: "POST",
        headers: {
          "Tus-Resumable": "1.0.0",
          "Upload-Length": this.file.size.toString(),
          "Upload-Metadata": metaParts.join(","),
        },
      });
    }, "Create Tus Session");

    if (response.status !== 201) {
      throw new Error(
        `Failed to create TUS upload session (status ${response.status})`,
      );
    }

    const location = response.headers.get("Location");
    if (!location) {
      throw new Error("TUS server did not return Location header");
    }

    this.uploadUrl = location.startsWith("http")
      ? location
      : `${window.location.origin}${location}`;
    this.currentOffset = 0;
  }

  private async queryOffset(): Promise<number> {
    if (!this.uploadUrl) throw new Error("No active upload URL");

    const response = await this.executeWithRetry(async () => {
      return await fetch(this.uploadUrl!, {
        method: "HEAD",
        headers: { "Tus-Resumable": "1.0.0" },
      });
    }, "Query Offset");

    if (!response.ok) {
      throw new Error(
        `Failed to query upload offset (status ${response.status})`,
      );
    }

    const offsetHeader = response.headers.get("Upload-Offset");
    this.currentOffset = offsetHeader ? parseInt(offsetHeader, 10) : 0;
    return this.currentOffset;
  }

  private async uploadChunks(): Promise<void> {
    const totalBytes = this.file.size;
    const chunkSize = this.options.chunkSize;
    const totalChunks = Math.ceil(totalBytes / chunkSize);

    this.lastProgressTime = performance.now();
    this.lastProgressBytes = this.currentOffset;

    while (this.currentOffset < totalBytes) {
      if (this.isPaused || this.isAborted) return;

      const chunkIndex = Math.floor(this.currentOffset / chunkSize);
      const nextOffset = Math.min(this.currentOffset + chunkSize, totalBytes);
      const chunkBlob = this.file.slice(this.currentOffset, nextOffset);

      const response = await this.executeWithRetry(
        async () => {
          return await fetch(this.uploadUrl!, {
            method: "PATCH",
            headers: {
              "Tus-Resumable": "1.0.0",
              "Upload-Offset": this.currentOffset.toString(),
              "Content-Type": "application/offset+octet-stream",
            },
            body: chunkBlob,
          });
        },
        `Upload Chunk ${chunkIndex + 1}/${totalChunks}`,
      );

      if (response.status === 409) {
        // Offset mismatch: resync from server disk
        await this.queryOffset();
        continue;
      }

      if (response.status !== 204) {
        throw new Error(
          `TUS PATCH chunk rejected with status ${response.status}`,
        );
      }

      const returnedOffset = response.headers.get("Upload-Offset");
      this.currentOffset = returnedOffset
        ? parseInt(returnedOffset, 10)
        : nextOffset;

      // Telemetry Speed & ETA calculation
      const now = performance.now();
      const timeDeltaSec = (now - this.lastProgressTime) / 1000;
      if (timeDeltaSec >= 0.5) {
        const bytesDelta = this.currentOffset - this.lastProgressBytes;
        const instantSpeedMBs = bytesDelta / (1024 * 1024) / timeDeltaSec;
        this.smoothedSpeedMBs =
          this.smoothedSpeedMBs === 0
            ? instantSpeedMBs
            : this.smoothedSpeedMBs * 0.7 + instantSpeedMBs * 0.3;
        this.lastProgressTime = now;
        this.lastProgressBytes = this.currentOffset;
      }

      const remainingBytes = Math.max(0, totalBytes - this.currentOffset);
      const speedBytesPerSec = Math.max(1, this.smoothedSpeedMBs * 1024 * 1024);
      const etaSeconds = Math.round(remainingBytes / speedBytesPerSec);

      this.options.onProgress({
        bytesUploaded: this.currentOffset,
        totalBytes,
        percent: Math.min(
          100,
          Math.round((this.currentOffset / totalBytes) * 100),
        ),
        speedMBs: parseFloat(this.smoothedSpeedMBs.toFixed(2)),
        etaSeconds,
        chunkIndex: chunkIndex + 1,
        totalChunks,
      });
    }

    if (this.currentOffset >= totalBytes && !this.isAborted) {
      this.options.onSuccess({
        uploadId: this.uploadUrl!.split("/").pop() || "",
        location: this.uploadUrl!,
      });
    }
  }

  private async executeWithRetry(
    fn: () => Promise<Response>,
    operationName: string,
  ): Promise<Response> {
    let attempt = 0;
    while (attempt <= this.options.maxRetries) {
      if (this.isPaused || this.isAborted) {
        throw new Error("Upload aborted or paused by user");
      }

      try {
        const res = await fn();
        return res;
      } catch (err) {
        attempt++;
        if (attempt > this.options.maxRetries) {
          throw err;
        }

        // Exponential backoff with jitter for Algerian mobile drops (Mobilis/Djezzy/Ooredoo)
        const delayMs = Math.min(
          15000,
          Math.pow(2, attempt) * 1000 + Math.random() * 800,
        );
        console.warn(
          `[TusUploader] ${operationName} failed (network drop). Retrying in ${Math.round(
            delayMs,
          )}ms (attempt ${attempt}/${this.options.maxRetries})`,
        );

        this.options.onProgress({
          bytesUploaded: this.currentOffset,
          totalBytes: this.file.size,
          percent: Math.min(
            100,
            Math.round((this.currentOffset / this.file.size) * 100),
          ),
          speedMBs: 0,
          etaSeconds: 0,
          chunkIndex:
            Math.floor(this.currentOffset / this.options.chunkSize) + 1,
          totalChunks: Math.ceil(this.file.size / this.options.chunkSize),
          isRetrying: true,
          retryAttempt: attempt,
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error(
      `${operationName} failed after ${this.options.maxRetries} retries`,
    );
  }
}
