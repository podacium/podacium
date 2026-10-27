/**
 * Education API module.
 * Handles courses, modules, paths, lessons, enrollments, quizzes, certificates.
 */

import { apiClient } from "./client";

// =============================================================================
// EDUCATION TYPES
// =============================================================================

export interface ModuleResponse {
  id: string;
  title: string;
  description?: string;
  fullDescription?: string;
  durationMinutes?: number;
  // snake_case aliases used by some pages
  duration_minutes?: number;
  duration?: string;
  estimatedEffort?: string;
  totalLessons?: number;
  level?: string;
  instructorId?: number;
  skills: string[];
  tags: string[];
  featured: boolean;
  createdAt: string;
  updatedAt?: string;
  thumbnailUrl?: string;
  price?: { original?: number; discounted?: number | null } | number | null;
  // Extra fields used by pages
  category?: string;
  gradient?: string;
  paths?: { id: string; title: string }[];
  prerequisites?: string[];
  whatYouGet?: string[];
  requirements?: string[];
  languages?: string[];
  features?: string[];
  learningObjectives?: string[];
  instructor?: {
    id: number;
    fullName: string;
    profilePictureUrl?: string;
    bio?: string;
    role?: string;
  };
  lessons: LessonResponse[];
  progress: number;
  isEnrolled: boolean;
  rating?: number;
  enrolled: number;
  isNew: boolean;
  hasAccess: boolean;
}

export interface LessonResponse {
  id: string;
  title: string;
  description?: string;
  moduleId: string;
  order: number;
  durationMinutes?: number;
  durationSeconds?: number;
  duration_minutes?: number;
  duration_seconds?: number;
  type: string;
  videoUrl?: string;
  hlsPath?: string;
  rawPath?: string;
  quizId?: number;
  thumbnailUrl?: string;
  learningObjectives: string[];
  keyTakeaways: string[];
  tags: string[];
  createdAt: string;
  isCompleted: boolean;
  isLocked: boolean;
  hasAccess: boolean;
  isPreview?: boolean;
  is_preview?: boolean;
  attachments?: any[];
  relatedResources?: any[];
  storageProvider?: string;
  transcodingStatus?: string;
  subtitlesUrl?: string;
  subtitlesLanguage?: string;
  subtitlesEnabled?: boolean;
  exercises?: number;
  resources?: number;
}

export interface VideoUploadResponse {
  success: boolean;
  lesson_id: string;
  raw_path: string;
  transcoding_status: string;
  detected_duration_seconds: number;
  detected_duration_minutes: number;
  formatted_duration: string;
  video_url?: string;
  warning?: string;
}

export interface PathResponse {
  id: string;
  title: string;
  description?: string;
  modules: ModuleResponse[];
  totalModules: number;
  // snake_case alias
  total_modules?: number;
  totalDuration: string;
  progress: number;
  isEnrolled: boolean;
  enrolled: number;
  estimatedCompletionTime: string;
  price?: { original?: number; discounted?: number } | number | null;
  updatedAt?: string;
  updated_at?: string;
  featured_modules?: any[];
  tags?: string[];
  skills?: string[];
  thumbnail_url?: string;
  modules_count?: number;
  featured?: boolean;
  level?: string;
  enrolled_count?: number;
  is_enrolled?: boolean;
}

/** Actionable learning-path recommendation returned by GET /api/education/me/recommendations */
export interface LearningPathRecommendation {
  path: PathResponse;
  modules: ModuleResponse[];
  match_score: number;
  reason: string;
  reason_type?: string;
  /** Direct URL to the path detail/enroll page, e.g. "/learn/paths/42" */
  target_url: string;
  /** Primary entity ID (path.id) */
  target_id: number;
  /** Entity type — always "path" for learning-path recommendations */
  target_type: "path" | "module";
}

export interface EnrollmentResponse {
  id: number;
  userId: number;
  moduleId?: string;
  pathId?: string;
  progress: number;
  createdAt: string;
  completedAt?: string;
  updatedAt?: string;
  updated_at?: string;
  startedAt?: string;
  started_at?: string;
  certificateId?: string | null;
  module?: ModuleResponse;
  path?: PathResponse;
}

// Convenience list-response aliases expected by some pages
export type ModuleListResponse = ModuleResponse;
export type PathListResponse = PathResponse;

export interface PaginatedReviewsResponse {
  reviews: CourseReviewResponse[];
  total: number;
  page?: number;
  pageSize?: number;
  average_rating?: number;
  averageRating?: number;
}

export interface UserLearningStats {
  totalLessonsCompleted?: number;
  totalLearningTimeMinutes?: number;
  completedModulesCount?: number;
  enrolledModulesCount?: number;
  [key: string]: any;
}

export interface CourseReviewCreate {
  rating: number;
  comment?: string;
}

export interface CourseReviewResponse {
  id: number;
  user_id: number;
  module_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  user_full_name: string;
  user_profile_picture_url?: string;
}

export interface SearchResults {
  modules: ModuleResponse[];
  paths: PathResponse[];
  totalModules: number;
  totalPaths: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Content Moderation Types ────────────────────────────────────────────────

export type ModuleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface InstructorModuleItem {
  id: string;
  title: string;
  description?: string;
  status: ModuleStatus;
  level?: string;
  lessonCount: number;
  enrollmentCount: number;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorModuleListResponse {
  items: InstructorModuleItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PendingReviewItem {
  id: string;
  title: string;
  description?: string;
  level?: string;
  instructorId?: number;
  instructorName?: string | null;
  submittedAt?: string | null;
  lessonCount: number;
  thumbnailUrl?: string | null;
}

export interface PendingReviewResponse {
  items: PendingReviewItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// =============================================================================
// EDUCATION API METHODS
// =============================================================================

export const educationApi = {
  // Public catalog
  getPublicModules(params?: {
    page?: number;
    pageSize?: number;
    limit?: number;
    level?: string;
    category?: string;
    featured?: boolean;
  }) {
    let query = "";
    if (params) {
      // Strip undefined/null/empty values so they don't get serialized as the string "undefined"
      const clean = Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) =>
            v !== undefined &&
            v !== null &&
            v !== "" &&
            (typeof v !== "string" || (v !== "undefined" && v !== "null")),
        ),
      );
      if (Object.keys(clean).length > 0) {
        query = "?" + new URLSearchParams(clean as any).toString();
      }
    }
    return apiClient.get<ModuleResponse[]>(
      `/api/education/modules/public${query}`,
    );
  },

  getPublicModule(id: string) {
    return apiClient.get<ModuleResponse>(`/api/education/modules/public/${id}`);
  },

  getPublicPaths(params?: { limit?: number; page?: number }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) =>
              v !== undefined &&
              v !== null &&
              !(
                typeof v === "string" &&
                (v === "" || v === "undefined" || v === "null")
              ),
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<PathResponse[]>(`/api/education/paths/public${query}`);
  },

  getPublicPath(id: string) {
    return apiClient.get<PathResponse>(`/api/education/paths/public/${id}`);
  },

  // Authenticated catalog
  getModule(id: string) {
    return apiClient.get<ModuleResponse>(`/api/education/modules/${id}`);
  },

  getPath(id: string) {
    return apiClient.get<PathResponse>(`/api/education/paths/${id}`);
  },

  getModuleLessons(moduleId: string) {
    return apiClient.get<LessonResponse[]>(
      `/api/education/modules/${moduleId}/lessons`,
    );
  },

  getLesson(lessonId: string) {
    return apiClient.get<LessonResponse>(`/api/education/lessons/${lessonId}`);
  },

  // Enrollment
  enrollModule(moduleId: string) {
    return apiClient.post<EnrollmentResponse>(
      `/api/education/enroll/module/${moduleId}`,
    );
  },

  enrollPath(pathId: string) {
    return apiClient.post<EnrollmentResponse>(
      `/api/education/enroll/path/${pathId}`,
    );
  },

  getMyEnrollments() {
    return apiClient.get<EnrollmentResponse[]>("/api/education/me/enrollments");
  },

  updateLesson(lessonId: string, data: any) {
    return apiClient.put<any>(`/api/education/lessons/${lessonId}`, data);
  },

  deleteLesson(lessonId: string) {
    return apiClient.delete<any>(`/api/education/lessons/${lessonId}`);
  },

  reorderLessons(
    moduleId: string,
    lessons: { lessonId: string; order: number }[],
  ) {
    return apiClient.put<any>(
      `/api/education/modules/${moduleId}/lessons/reorder`,
      { lessons },
    );
  },

  createQuiz(lessonId: string, data: any) {
    return apiClient.post<any>(`/api/education/lessons/${lessonId}/quiz`, data);
  },

  // Progress
  updateLessonProgress(
    lessonId: string,
    data: { progress: number; completed: boolean },
  ) {
    return apiClient.post<void>(
      `/api/education/lessons/${lessonId}/progress`,
      data,
    );
  },

  completeLesson(lessonId: string) {
    return apiClient.post<void>(`/api/education/lessons/${lessonId}/complete`);
  },

  // Quizzes
  getQuiz(lessonId: string) {
    return apiClient.get<any>(`/api/education/quizzes/${lessonId}`);
  },

  startQuiz(lessonId: string) {
    return apiClient.post<any>(`/api/education/quizzes/${lessonId}/start`);
  },

  submitQuiz(attemptId: number, answers: any) {
    const payload =
      answers && typeof answers === "object" && "answers" in answers
        ? answers
        : { answers };
    return apiClient.post<any>(
      `/api/education/quizzes/attempts/${attemptId}/submit`,
      payload,
    );
  },

  // Certificates
  generateModuleCertificate(moduleId: string) {
    return apiClient.post<any>(
      `/api/education/certificates/generate/module/${moduleId}`,
    );
  },

  generatePathCertificate(pathId: string) {
    return apiClient.post<any>(
      `/api/education/certificates/generate/path/${pathId}`,
    );
  },

  getMyCertificates() {
    return apiClient.get<any[]>("/api/education/certificates/my");
  },

  verifyCertificate(certId: string) {
    return apiClient.get<any>(`/api/education/certificates/verify/${certId}`);
  },

  // Reviews
  getModuleReviews(moduleId: string, page = 1, pageSize = 10) {
    return apiClient.get<PaginatedReviewsResponse>(
      `/api/education/modules/${moduleId}/reviews?page=${page}&page_size=${pageSize}`,
    );
  },

  createReview(moduleId: string, data: CourseReviewCreate) {
    return apiClient.post<CourseReviewResponse>(
      `/api/education/modules/${moduleId}/reviews`,
      data,
    );
  },

  // Search
  search(query: string, filters?: any) {
    return apiClient.post<SearchResults>("/api/education/search", {
      query,
      ...filters,
    });
  },

  quickSearch(query: string) {
    return apiClient.get<any>(
      `/api/education/search/quick?q=${encodeURIComponent(query)}`,
    );
  },

  // Stats
  getMyStats() {
    return apiClient.get<any>("/api/education/me/stats");
  },

  getStats() {
    return apiClient.get<any>("/api/education/stats");
  },

  getRecommendations() {
    return apiClient.get<LearningPathRecommendation[]>(
      "/api/education/me/recommendations",
    );
  },

  // ─── Content Moderation (Instructor) ─────────────────────────────────────

  uploadLessonVideo(moduleId: string, lessonId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<VideoUploadResponse>(
      `/api/education/modules/${moduleId}/lessons/${lessonId}/video`,
      formData,
    );
  },

  submitForReview(moduleId: string) {
    return apiClient.post<{
      success: boolean;
      module_id: string;
      status: string;
      message: string;
    }>(`/api/education/modules/${moduleId}/submit-review`);
  },

  getMyDrafts(params?: { page?: number; page_size?: number; status?: string }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              (typeof v !== "string" || (v !== "undefined" && v !== "null")),
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<InstructorModuleListResponse>(
      `/api/education/modules/my-drafts${query}`,
    );
  },

  // ─── Content Moderation (Admin) ──────────────────────────────────────────

  getPendingReview(params?: { page?: number; page_size?: number }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) =>
              v !== undefined &&
              v !== null &&
              !(
                typeof v === "string" &&
                (v === "" || v === "undefined" || v === "null")
              ),
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<PendingReviewResponse>(
      `/api/admin/modules/pending-review${query}`,
    );
  },

  approveModule(moduleId: string) {
    return apiClient.post<{
      success: boolean;
      module_id: string;
      status: string;
      published_at: string;
    }>(`/api/admin/modules/${moduleId}/approve`);
  },

  rejectModule(moduleId: string, reason: string) {
    return apiClient.post<{
      success: boolean;
      module_id: string;
      status: string;
      reason: string;
    }>(`/api/admin/modules/${moduleId}/reject`, { reason });
  },

  unpublishModule(moduleId: string) {
    return apiClient.post<{
      success: boolean;
      module_id: string;
      status: string;
    }>(`/api/admin/modules/${moduleId}/unpublish`);
  },
};
