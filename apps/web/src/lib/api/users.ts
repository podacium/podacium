/**
 * Users API module.
 * Handles profile management, skills, settings, and account operations.
 */

import { apiClient } from "./client";
import { uploadFileWithProgress } from "./uploader";
import type { UserProfileResponse } from "./auth";

// =============================================================================
// USER TYPES
// =============================================================================

export interface OnboardingSubmitData {
  role?: string;
  primaryGoal?: string;
  experienceLevel?: string;
  fieldOfInterest?: string;
  weeklyTime?: string;
  discoverySource?: string;
  openAnswer?: string;
  skills?: string[];
  password?: string;
  [key: string]: any;
}

export interface OnboardingConfig {
  roles: Record<
    string,
    {
      label: string;
      steps: Array<{ key: string; type: string; optionKeys?: string[] }>;
    }
  >;
  category_skills: Record<string, string[]>;
}

export interface ProfileProgress {
  score: number;
  total: number;
  percentage: number;
  missing: string[];
  completed: boolean;
}

export interface PublicProfileUpdate {
  fullName?: string;
  headline?: string;
  bio?: string;
  country?: string;
  city?: string;
  profilePictureUrl?: string;
  skills?: string[];
  socialLinks?: Record<string, string>;
  role?: string;
}

export interface PrivateSettingsUpdate {
  email?: string;
  phoneNumber?: string;
  subscribeNewsletter?: boolean;
}

export interface PublicUserProfileResponse {
  id: number;
  fullName: string;
  headline?: string;
  bio?: string;
  profilePictureUrl?: string;
  country?: string;
  city?: string;
  skills: string[];
  socialLinks?: Record<string, string>;
  role: string;
  createdAt: string;
  certificates: any[];
  instructedModules: any[];
  skillsDetails: any[];
}

export interface UserSkillCreate {
  name: string;
}

export interface UserSkillResponse {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  newsletter: boolean;
  digestFrequency?: string;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  quietHoursTimezone?: string;
  digestTime?: string | null;
  digestTimezone?: string;
  digestDay?: number | null;
}

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  deviceManagement: boolean;
  sessionTimeout: number;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface EmailVerificationRequest {
  email: string;
  token: string;
}

export interface PhoneVerificationRequest {
  phoneNumber: string;
}

export interface AccountDeletionRequest {
  reason?: string;
  feedback?: string;
  password: string;
}

export interface DashboardStats {
  total_courses: number;
  completed_courses: number;
  active_projects: number;
  completed_projects: number;
  datasets_count: number;
  certifications_count: number;
  total_earnings: number;
  skill_level: string;
}

// ── New role-specific types ─────────────────────────────────────

export interface ProposalSummary {
  id: number;
  project_title: string;
  status: string;
  amount: number;
  submitted_at: string;
  client_name?: string;
}

export interface ContractSummary {
  id: number;
  project_title: string;
  client_name?: string;
  status: string;
  amount: number;
  start_date: string;
  end_date?: string;
}

export interface EarningsSummary {
  total_earned: number;
  pending_payments: number;
  this_month: number;
  last_month: number;
  average_per_project: number;
}

export interface JobListingSummary {
  id: number;
  title: string;
  applicants_count: number;
  status: string;
  created_at: string;
  budget_range?: string;
}

export interface PlatformMetrics {
  total_users: number;
  users_growth: number;
  total_revenue: number;
  revenue_growth: number;
  active_courses: number;
  active_projects: number;
  total_transactions: number;
  system_uptime: number;
}

export interface UserSummary {
  id: number;
  full_name: string;
  email?: string;
  role: string;
  joined_at: string;
  is_active: boolean;
}

export interface SystemAlert {
  id: number;
  type: "warning" | "error" | "info";
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

// ── View config ────────────────────────────────────────────────

export interface SectionConfig {
  id: string;
  priority: number;
  grid: "main" | "sidebar" | "full";
}

export interface ViewConfig {
  sections: SectionConfig[];
  show_quick_actions: boolean;
  show_wallet: boolean;
  show_skills: boolean;
  show_recommendations: boolean;
}

// ── Dashboard state (unified) ──────────────────────────────────

export interface DashboardState {
  user_stats?: DashboardStats;
  recent_activities: any[];
  recommendations: any[];
  skill_breakdown: Record<string, number>;
  ongoing_courses: any[];
  learning_streak?: number;
  certificates_earned: number;
  active_projects: any[];
  proposals: ProposalSummary[];
  active_contracts: ContractSummary[];
  freelance_earnings?: EarningsSummary;
  job_listings: JobListingSummary[];
  total_applications: number;
  total_hires: number;
  team_members: number;
  platform_stats?: PlatformMetrics;
  recent_users: UserSummary[];
  pending_reports: number;
  system_alerts: SystemAlert[];
  datasets: any[];
}

export interface DashboardResponse {
  role: string;
  view_config: ViewConfig;
  state: DashboardState;
}

export interface UserSettingsResponse {
  notificationPreferences: NotificationPreferences;
  securitySettings: SecuritySettings;
}

// =============================================================================
// USERS API METHODS
// =============================================================================

export const usersApi = {
  // Profile
  getPublicProfile(userId: number) {
    return apiClient.get<PublicUserProfileResponse>(
      `/api/users/${userId}/public`,
    );
  },

  updatePublicProfile(data: PublicProfileUpdate) {
    return apiClient.put<UserProfileResponse>("/api/me/profile", data);
  },

  updatePrivateSettings(data: PrivateSettingsUpdate) {
    return apiClient.put<UserProfileResponse>("/api/me/settings", data);
  },

  // Skills
  getUserSkills(userId: number) {
    return apiClient.get<UserSkillResponse[]>(`/api/users/${userId}/skills`);
  },

  getMySkills() {
    return apiClient.get<UserSkillResponse[]>("/api/users/me/skills");
  },

  addSkill(data: UserSkillCreate) {
    return apiClient.post<UserSkillResponse>("/api/users/me/skills", data);
  },

  deleteSkill(skillId: number) {
    return apiClient.delete<void>(`/api/users/me/skills/${skillId}`);
  },

  // Dashboard
  getDashboard(refresh = false) {
    const params = refresh ? "?refresh=true" : "";
    return apiClient.get<DashboardResponse>(`/api/dashboard${params}`);
  },

  getInitialData() {
    return apiClient.get<any>("/api/user/initial-data");
  },

  // Settings
  getNotificationPreferences() {
    return apiClient.get<NotificationPreferences>(
      "/api/notifications/preferences",
    );
  },

  updateNotificationPreferences(data: NotificationPreferences) {
    return apiClient.put<void>("/api/notifications/preferences", data);
  },

  getSecuritySettings() {
    return apiClient.get<SecuritySettings>("/api/settings/security");
  },

  updateSecuritySettings(data: SecuritySettings) {
    return apiClient.put<void>("/api/settings/security", data);
  },

  changePassword(data: PasswordChangeRequest) {
    return apiClient.post<void>("/api/settings/security/change-password", data);
  },

  requestEmailVerification(data: EmailVerificationRequest) {
    return apiClient.post<void>("/api/auth/verify-email", data);
  },

  requestPhoneVerification(data: PhoneVerificationRequest) {
    return apiClient.post<void>("/api/phone/verify/request", data);
  },

  deleteAccount(data: AccountDeletionRequest) {
    return apiClient.post<void>("/api/users/me/delete-account", data);
  },

  // Files
  async uploadFile(file: File, category: string) {
    try {
      const res = await uploadFileWithProgress(file, category as any);
      return { url: res.url, id: res.fileId };
    } catch {
      const formData = new FormData();
      formData.append("file", file);
      return apiClient.upload<{ url: string; id: number }>(
        `/api/files/upload?category=${category}`,
        formData,
      );
    }
  },

  // Onboarding
  submitOnboarding(data: any) {
    return apiClient.post<void>("/api/onboarding", data);
  },
  getOnboardingConfig() {
    return apiClient.get<OnboardingConfig>("/api/onboarding/config");
  },
  getProfileProgress() {
    return apiClient.get<ProfileProgress>("/api/users/me/profile-progress");
  },
};
