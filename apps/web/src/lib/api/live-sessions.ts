import { apiClient } from "./client";

// ─── Types ─────────────────────────────────────────────────────────

export interface LiveSessionOwner {
  id: number;
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

export interface LiveSession {
  id: string;
  type: "COURSE" | "MEETING";
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  language?: string | null;
  tags: string[];
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  ownerId: number;
  contractId: number | null;
  orgOnly: boolean;
  owner: LiveSessionOwner | null;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  maxParticipants: number | null;
  priceAmount: number | null;
  currency: string;
  earlyBirdPrice: number | null;
  earlyBirdDeadline: string | null;
  chatMode: string | null;
  moderationThreshold: number | null;
  organizationId: number | null;
  roomName: string | null;
  hasRecording: boolean;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  moduleId: number | null;
  lessonId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  participantCount: number;
  bookingCount: number;
}

export interface LiveSessionListResponse {
  items: LiveSession[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateSessionRequest {
  sessionType: "COURSE" | "MEETING";
  contractId?: number | null;
  orgOnly?: boolean;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
  scheduledAt: string;
  maxParticipants?: number;
  priceAmount?: number;
  currency?: string;
  moduleId?: number;
  lessonId?: number;
  earlyBirdPrice?: number;
  earlyBirdDeadline?: string;
  chatMode?: string;
  moderationThreshold?: number;
  organizationId?: number;
}

export interface UpdateSessionRequest {
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
  maxParticipants?: number;
  priceAmount?: number;
  currency?: string;
  earlyBirdPrice?: number;
  earlyBirdDeadline?: string;
  chatMode?: string;
  moderationThreshold?: number;
  organizationId?: number;
}

export interface BookSessionRequest {
  transactionId?: number;
  hostCode?: string;
}

export interface BookingResult {
  id: number;
  liveSessionId: string;
  userId: number;
  status: string;
  createdAt: string;
}

export interface LiveSessionBooking {
  id: number;
  liveSessionId: string;
  userId: number;
  transactionId: number;
  status: string;
  attended: boolean | null;
  createdAt: string;
  session: LiveSession | null;
}

export interface LiveSessionBookingListResponse {
  items: LiveSessionBooking[];
  total: number;
  skip: number;
  limit: number;
}

export interface JoinTokenResponse {
  token: string;
  roomName: string;
  serverUrl: string;
}

export interface Participant {
  id: number;
  userId: number;
  role: string;
  joinedAt: string | null;
  leftAt: string | null;
  attendancePct: number | null;
}

export interface WaitlistResult {
  id: number;
  liveSessionId: string;
  userId: number;
  position: number;
  createdAt: string;
}

export interface CoHostResult {
  id: number;
  userId: number;
  permissions: string;
}

export interface ReviewResponse {
  id: number;
  liveSessionId: string;
  userId: number;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string; avatarUrl?: string | null } | null;
}

export interface ReviewListResponse {
  items: ReviewResponse[];
  total: number;
  averageRating: number;
}

export interface ChatMessage {
  id: number;
  liveSessionId: string;
  userId: number;
  message: string;
  messageType: string;
  createdAt: string;
  user?: { id: number; name: string; avatarUrl?: string | null } | null;
}

export interface ChatMessageListResponse {
  items: ChatMessage[];
  total: number;
}

export interface AdminStats {
  total: number;
  live: number;
  scheduled: number;
  ended: number;
  cancelled: number;
  totalBookings: number;
  totalParticipants: number;
  upcoming24h: number;
}

export interface LiveEcosystemContext {
  sessionId: string;
  userId: number;
  profile: {
    fullName: string;
    username: string | null;
    headline: string | null;
    avatarUrl: string | null;
    isHost: boolean;
  };
  health: {
    available: boolean;
    score: number;
    color: string;
    status: string;
    label: string;
    trend: Array<{ score: number; week?: string }>;
  };
  skillPassport: {
    verified: boolean;
    skills: Array<{ name: string; endorsements: number; verified: boolean }>;
  };
}

// ─── API Object ────────────────────────────────────────────────────

export const liveSessionsApi = {
  listSessions(params?: {
    category?: string;
    status?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    skip?: number;
    limit?: number;
  }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(cleanParams).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<LiveSessionListResponse>(
      `/api/v1/live-sessions/sessions${query}`,
    );
  },

  getSession(sessionId: string) {
    return apiClient.get<LiveSession>(
      `/api/v1/live-sessions/sessions/${sessionId}`,
    );
  },

  createSession(data: CreateSessionRequest) {
    return apiClient.post<LiveSession>("/api/v1/live-sessions/sessions", data);
  },

  updateSession(sessionId: string, data: UpdateSessionRequest) {
    return apiClient.put<LiveSession>(
      `/api/v1/live-sessions/sessions/${sessionId}`,
      data,
    );
  },

  deleteSession(sessionId: string) {
    return apiClient.delete<void>(
      `/api/v1/live-sessions/sessions/${sessionId}`,
    );
  },

  getMySessions(params?: { status?: string; skip?: number; limit?: number }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(cleanParams).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<LiveSessionListResponse>(
      `/api/v1/live-sessions/my-sessions${query}`,
    );
  },

  startSession(sessionId: string) {
    return apiClient.post<LiveSession>(
      `/api/v1/live-sessions/sessions/${sessionId}/start`,
    );
  },

  endSession(sessionId: string) {
    return apiClient.post<LiveSession>(
      `/api/v1/live-sessions/sessions/${sessionId}/end`,
    );
  },

  bookSession(sessionId: string, data: BookSessionRequest) {
    return apiClient.post<BookingResult>(
      `/api/v1/live-sessions/sessions/${sessionId}/book`,
      data,
    );
  },

  cancelBooking(bookingId: number) {
    return apiClient.post<{
      id: number;
      status: string;
      cancelledAt: string | null;
    }>(`/api/v1/live-sessions/bookings/${bookingId}/cancel`);
  },

  transferBooking(bookingId: number, recipientEmail: string) {
    return apiClient.post<{
      id: number;
      liveSessionId: string;
      userId: number;
      status: string;
    }>(`/api/v1/live-sessions/bookings/${bookingId}/transfer`, {
      recipient_email: recipientEmail,
    });
  },

  acceptTransfer(token: string) {
    return apiClient.post<{
      id: number;
      liveSessionId: string;
      userId: number;
      status: string;
    }>("/api/v1/live-sessions/bookings/transfer/accept", { token });
  },

  getMyBookings(params?: { status?: string; skip?: number; limit?: number }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(cleanParams).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<LiveSessionBookingListResponse>(
      `/api/v1/live-sessions/bookings${query}`,
    );
  },

  getSessionBookings(
    sessionId: string,
    params?: { status?: string; skip?: number; limit?: number },
  ) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(cleanParams).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<LiveSessionBookingListResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/bookings${query}`,
    );
  },

  joinSession(sessionId: string) {
    return apiClient.post<JoinTokenResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/join`,
    );
  },

  leaveSession(sessionId: string) {
    return apiClient.post<void>(
      `/api/v1/live-sessions/sessions/${sessionId}/leave`,
    );
  },

  listParticipants(sessionId: string) {
    return apiClient.get<Participant[]>(
      `/api/v1/live-sessions/sessions/${sessionId}/participants`,
    );
  },

  getLiveContext(sessionId: string, userId: number, locale = "en") {
    return apiClient.get<LiveEcosystemContext>(
      `/api/v1/live-sessions/sessions/${sessionId}/context/${userId}?locale=${encodeURIComponent(locale)}`,
    );
  },

  getJoinToken(sessionId: string) {
    return apiClient.get<JoinTokenResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/token`,
    );
  },

  refreshToken(sessionId: string) {
    return apiClient.post<JoinTokenResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/token/refresh`,
    );
  },

  joinWaitlist(sessionId: string) {
    return apiClient.post<WaitlistResult>(
      `/api/v1/live-sessions/sessions/${sessionId}/waitlist`,
    );
  },

  leaveWaitlist(sessionId: string) {
    return apiClient.delete<void>(
      `/api/v1/live-sessions/sessions/${sessionId}/waitlist`,
    );
  },

  getMyWaitlistStatus(sessionId: string) {
    return apiClient
      .get<WaitlistResult | null>(
        `/api/v1/live-sessions/sessions/${sessionId}/waitlist`,
      )
      .catch(() => null);
  },

  addCoHost(sessionId: string, userId: number) {
    return apiClient.post<CoHostResult>(
      `/api/v1/live-sessions/sessions/${sessionId}/co-hosts?user_id=${userId}`,
    );
  },

  removeCoHost(sessionId: string, coHostUserId: number) {
    return apiClient.delete<void>(
      `/api/v1/live-sessions/sessions/${sessionId}/co-hosts/${coHostUserId}`,
    );
  },

  getReplay(sessionId: string) {
    return apiClient.get<JoinTokenResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/replay`,
    );
  },

  getReplayToken(sessionId: string) {
    return apiClient.get<{ url: string }>(
      `/api/v1/live-sessions/sessions/${sessionId}/replay-token`,
    );
  },

  getTrending() {
    return apiClient.get<{ items: LiveSession[] }>(
      "/api/v1/live-sessions/trending",
    );
  },

  getUpcoming(limit?: number) {
    const query = limit ? `?limit=${limit}` : "";
    return apiClient.get<LiveSessionListResponse>(
      `/api/v1/live-sessions/upcoming${query}`,
    );
  },

  getAdminStats() {
    return apiClient.get<AdminStats>("/api/v1/live-sessions/admin/stats");
  },

  approveSession(sessionId: string) {
    return apiClient.post<{ ok: boolean }>(
      `/api/v1/live-sessions/sessions/${sessionId}/approve`,
      {},
    );
  },

  rejectSession(sessionId: string, reason: string) {
    return apiClient.post<{ ok: boolean }>(
      `/api/v1/live-sessions/sessions/${sessionId}/reject`,
      { reason },
    );
  },

  getPendingApprovalCount() {
    return apiClient.get<{ count: number }>(
      "/api/v1/live-sessions/admin/pending-count",
    );
  },

  saveChatMessage(
    sessionId: string,
    data: { message: string; messageType?: string },
  ) {
    return apiClient.post<ChatMessage>(
      `/api/v1/live-sessions/sessions/${sessionId}/chat`,
      data,
    );
  },

  getChatMessages(
    sessionId: string,
    params?: { messageType?: string; skip?: number; limit?: number },
  ) {
    const query = params
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([_, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<ChatMessageListResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/chat${query}`,
    );
  },

  getAdminSessions(params?: {
    status?: string;
    skip?: number;
    limit?: number;
  }) {
    const query = params
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([_, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<LiveSessionListResponse>(
      `/api/v1/live-sessions/admin/sessions${query}`,
    );
  },

  // Reviews
  createReview(sessionId: string, data: { rating: number; comment?: string }) {
    return apiClient.post<ReviewResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/reviews`,
      data,
    );
  },

  getSessionReviews(
    sessionId: string,
    params?: { skip?: number; limit?: number },
  ) {
    const query = params
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(params)
              .filter(([_, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<ReviewListResponse>(
      `/api/v1/live-sessions/sessions/${sessionId}/reviews${query}`,
    );
  },

  getMyReview(sessionId: string) {
    return apiClient.get<ReviewResponse | null>(
      `/api/v1/live-sessions/sessions/${sessionId}/reviews/me`,
    );
  },

  // Host Codes
  generateHostCodes(sessionId: string) {
    return apiClient.post<{ codes: string[]; remaining: number }>(
      `/api/v1/live-sessions/sessions/${sessionId}/host-codes`,
    );
  },

  validateHostCode(sessionId: string, code: string) {
    return apiClient.post<{ valid: boolean }>(
      `/api/v1/live-sessions/sessions/${sessionId}/validate-host-code`,
      { code },
    );
  },

  startRecording(sessionId: string) {
    return apiClient.post<{ egressId: string; status: string }>(
      `/api/v1/live-sessions/sessions/${sessionId}/recording/start`,
    );
  },

  stopRecording(sessionId: string) {
    return apiClient.post<{ status: string }>(
      `/api/v1/live-sessions/sessions/${sessionId}/recording/stop`,
    );
  },
};
