import { apiClient } from "@/lib/api/client";

export async function getSignedVideoUrl(
  lessonId: string,
  storageProvider?: string,
  hlsPath?: string,
) {
  if (!lessonId) {
    return { error: "No lesson id provided." };
  }

  try {
    const query = new URLSearchParams({ lesson_id: lessonId });
    if (storageProvider) query.set("provider", storageProvider);

    const data = await apiClient.get<{
      signed_url: string;
      client_ip?: string;
    }>(`/api/v1/education/video/signed-url?${query.toString()}`);

    return {
      signedUrl: data.signed_url,
      clientIp: data.client_ip,
      isHls: !!hlsPath,
    };
  } catch (err: any) {
    if (err.status === 401 || err.status === 403) {
      return { error: "You do not have access to this video." };
    }
    return { error: err.message || "Failed to get video URL." };
  }
}

export async function getSignedSegmentUrl(
  lessonId: string,
  segmentName: string,
) {
  if (!lessonId || !segmentName) {
    return { error: "No lesson id or segment provided." };
  }

  try {
    const query = new URLSearchParams({
      lesson_id: lessonId,
      segment: segmentName,
    });
    const data = await apiClient.get<{ signed_url: string }>(
      `/api/v1/education/video/segment-token?${query.toString()}`,
    );

    return { signedUrl: data.signed_url };
  } catch (err: any) {
    if (err.status === 401 || err.status === 403) {
      return { error: "You do not have access to this video segment." };
    }
    return { error: err.message || "Failed to get segment token." };
  }
}
