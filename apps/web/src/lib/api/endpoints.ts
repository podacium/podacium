export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    REFRESH: "/auth/refresh-token",
    ME: "/auth/me",
    VERIFY_EMAIL: "/auth/verify-email",
    RESEND_VERIFICATION: "/auth/resend-verification",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    OAUTH_AUTHORIZE: (provider: string) => `/auth/oauth/${provider}/authorize`,
    OAUTH_CALLBACK: (provider: string) => `/auth/oauth/${provider}/callback`,
    OAUTH_LOGIN: (provider: string) => `/api/auth/oauth/${provider}/login`,
    OAUTH_REDIRECT: (provider: string) =>
      `/api/auth/oauth/${provider}/redirect`,
  },
  USERS: {
    PROFILE: "/api/users/profile",
    DASHBOARD: "/api/user/initial-data",
    ME_LIGHT: "/api/auth/me-light",
    ME: "/api/me",
    ME_PUBLIC: "/api/me/public",
    ME_PROFILE: "/api/me/profile",
    ME_SETTINGS: "/api/me/settings",
    ME_NOTIFICATIONS: "/api/users/me/notifications",
    ME_SECURITY: "/api/users/me/security",
    ME_SKILLS: "/api/users/me/skills",
    DELETE_ACCOUNT: "/api/users/me/delete-account",
    DELETE_REQUEST: "/api/users/me/delete-request",
    EXPORT_DATA: "/api/users/me/export",
    USER_PUBLIC: (id: number) => `/api/users/${id}/public`,
    USER_SKILLS: (id: number) => `/api/users/${id}/skills`,
    USER_STATS: (id: number) => `/api/users/${id}/stats`,
  },
  WAITLIST: {
    REGISTER: "/api/waitlist/register",
    POSITION: (email: string) =>
      `/api/waitlist/position?email=${encodeURIComponent(email)}`,
    LEADERBOARD: "/api/waitlist/leaderboard",
    STATS: "/api/waitlist/stats",
    STATUS: (email: string) =>
      `/api/waitlist/status?email=${encodeURIComponent(email)}`,
  },
  FILES: {
    UPLOAD: "/api/files/upload",
    LIST: "/api/files",
    DELETE: (id: number) => `/api/files/${id}`,
  },
  BI: {
    DATASETS: "/api/bi/datasets",
    DATASET: (id: string) => `/api/bi/datasets/${id}`,
    DATASET_PREVIEW: (id: string) => `/api/bi/datasets/${id}/preview`,
    DATASET_STATS: (id: string) => `/api/bi/datasets/${id}/stats`,
    DATASET_QUERY: (id: string) => `/api/bi/datasets/${id}/query`,
    DATASET_EXPORT: (id: string) => `/api/bi/datasets/${id}/export`,
    DATASET_VALIDATE: (id: string) => `/api/bi/datasets/${id}/validate`,
    DATASET_QUALITY: (id: string) => `/api/bi/datasets/${id}/quality`,
    DATASET_PREPROCESS: (id: string) => `/api/bi/datasets/${id}/preprocess`,
    DATASET_CORE: (id: string) => `/api/bi/analytics/${id}/core`,
    INGEST_JSON: "/api/bi/datasets/ingest-json",

    DASHBOARDS: "/api/bi/dashboards",
    DASHBOARD: (id: string) => `/api/bi/dashboards/${id}`,
    DASHBOARD_SHARE: (id: string) => `/api/bi/dashboards/${id}/share`,
    DASHBOARD_WIDGETS: (id: string) => `/api/bi/dashboards/${id}/widgets`,
    DASHBOARD_INSIGHTS: (id: string) => `/api/bi/dashboards/${id}/insights`,
    DASHBOARD_GENERATE: "/api/bi/dashboards/generate",

    WIDGETS: "/api/bi/widgets",
    WIDGET: (id: string) => `/api/bi/widgets/${id}`,
    WIDGET_DATA: (id: string) => `/api/bi/widgets/${id}/data`,
    WIDGET_PREVIEW: "/api/bi/widgets/preview-config",
    WIDGET_TEMPLATES: "/api/bi/widget-templates",
    WIDGET_TEMPLATE_INSTANTIATE: (id: string) =>
      `/api/bi/widget-templates/${id}/instantiate`,

    ANALYTICS_KPI: "/api/bi/analytics/kpi",
    ANALYTICS_TIMESERIES: "/api/bi/analytics/timeseries",
    ANALYTICS_BREAKDOWN: "/api/bi/analytics/breakdown",
    ANALYTICS_ANALYZE: (id: string) => `/api/bi/analytics/${id}/analyze`,
    ANALYTICS_EVALUATE: (id: string) => `/api/bi/analytics/${id}/evaluate`,
    DECISIONS: (id: string) => `/api/bi/decisions/${id}/decisions`,
    FULL_PIPELINE: (id: string) => `/api/bi/decisions/${id}/full-pipeline`,

    // Decisions CRUD
    DECISIONS_LIST: "/api/bi/decisions",
    DECISION: (id: string) => `/api/bi/decisions/${id}`,
    DECISION_STATUS: (id: string) => `/api/bi/decisions/${id}/status`,
    DECISION_HISTORY: (id: string) => `/api/bi/decisions/${id}/history`,
    DECISION_COMMENTS: (id: string) => `/api/bi/decisions/${id}/comments`,

    // Reports CRUD
    REPORTS_LIST: "/api/bi/reports",
    REPORT: (id: string) => `/api/bi/reports/${id}`,
    REPORT_RUN: (id: string) => `/api/bi/reports/${id}/run`,
    REPORT_TOGGLE: (id: string) => `/api/bi/reports/${id}/toggle`,
    REPORT_RUNS: (id: string) => `/api/bi/reports/${id}/runs`,
    REPORT_RETRY: (reportId: string, runId: string) =>
      `/api/bi/reports/${reportId}/runs/${runId}/retry`,

    // Quality Issues
    QUALITY_ISSUES: (datasetId: string) =>
      `/api/bi/datasets/${datasetId}/quality/issues`,
    QUALITY_ISSUE: (id: string) => `/api/bi/quality/issues/${id}`,
    QUALITY_HISTORY: (datasetId: string) =>
      `/api/bi/datasets/${datasetId}/quality/history`,

    UPLOAD_PRESIGNED: "/api/bi/upload/presigned",
    UPLOAD_DATASET: "/api/bi/datasets/upload",
    UPLOAD_DIRECT: "/api/bi/upload/direct",

    EXPORTS: "/api/bi/exports",
    EXPORT_STATUS: (id: string) => `/api/bi/exports/${id}`,
    EXPORT_DOWNLOAD: (id: string) => `/api/bi/exports/${id}/download`,

    ORG_SUMMARY: (orgId: string) => `/api/bi/organizations/${orgId}/summary`,
    USER_USAGE: (orgId: string, userId: string) =>
      `/api/bi/organizations/${orgId}/users/${userId}/usage`,
    HEALTH: "/api/bi/health",
    DEBUG_RAW: (id: string) => `/api/bi/debug/datasets/${id}/raw`,
    DEBUG_PERMISSIONS: "/api/bi/debug/permissions",
    ERROR_TEST: "/api/bi/errors/test",
  },
  FREELANCING: {
    PROJECTS: "/api/hub/projects",
    PROJECT: (id: number) => `/api/hub/projects/${id}`,
    PROJECT_PROPOSALS: (id: number) => `/api/hub/projects/${id}/proposals`,
    PUBLIC_PROJECTS: "/api/hub/public/projects",
    PUBLIC_PROJECT: (id: number) => `/api/hub/public/projects/${id}`,
    PROPOSALS: "/api/hub/proposals",
    ACCEPT_PROPOSAL: (id: number) => `/api/hub/proposals/${id}/accept`,
    REJECT_PROPOSAL: (id: number) => `/api/hub/proposals/${id}/reject`,
    CONTRACTS: "/api/hub/contracts",
    CONTRACT: (id: number) => `/api/hub/contracts/${id}`,
    CONTRACT_DELIVER: (id: number) => `/api/hub/contracts/${id}/deliver`,
    CONTRACT_COMPLETE: (id: number) => `/api/hub/contracts/${id}/complete`,
    CONTRACT_CANCEL: (id: number) => `/api/hub/contracts/${id}/cancel`,
    FREELANCERS: "/api/hub/freelancers",
    FREELANCER_PROFILE: (id: number) => `/api/hub/freelancers/${id}`,
    PUBLIC_FREELANCERS: "/api/hub/public/freelancers",
    PUBLIC_FREELANCER_PROFILE: (id: number) =>
      `/api/hub/public/freelancers/${id}`,
    FREELANCE_DASHBOARD_STATS: "/api/hub/dashboard/stats",
    PUBLIC_STATS: "/api/hub/public/stats",
    ASSIGN_PROJECT: (projectId: number, freelancerId: number) =>
      `/api/hub/projects/${projectId}/assign/${freelancerId}`,
  },
  CONTACTS: {
    SUBMIT: "/api/contact",
  },
  EDUCATION: {
    MODULES_PUBLIC: "/api/education/modules/public",
    MODULE_PUBLIC: (id: string) => `/api/education/modules/public/${id}`,
    PATHS_PUBLIC: "/api/education/paths/public",
    PATH_PUBLIC: (id: string) => `/api/education/paths/public/${id}`,
    MODULES: "/api/education/modules",
    MODULE: (id: string) => `/api/education/modules/${id}`,
    PATHS: "/api/education/paths",
    PATH: (id: string) => `/api/education/paths/${id}`,
    ENROLL_MODULE: (id: string) => `/api/education/enroll/module/${id}`,
    ENROLL_PATH: (id: string) => `/api/education/enroll/path/${id}`,
    MY_ENROLLMENTS: "/api/education/me/enrollments",
    MODULE_LESSONS: (id: string) => `/api/education/modules/${id}/lessons`,
    LESSON: (id: string) => `/api/education/lessons/${id}`,
    LESSON_PROGRESS: (id: string) => `/api/education/lessons/${id}/progress`,
    LESSON_COMPLETE: (id: string) => `/api/education/lessons/${id}/complete`,
    MY_STATS: "/api/education/me/stats",
    MY_RECOMMENDATIONS: "/api/education/me/recommendations",
    SEARCH: "/api/education/search",
    QUICK_SEARCH: "/api/education/search/quick",
    CREATE_MODULE: "/api/education/modules",
    UPDATE_MODULE: (id: string) => `/api/education/modules/${id}`,
    CREATE_LESSON: (moduleId: string) =>
      `/api/education/modules/${moduleId}/lessons`,
    UPDATE_LESSON: (lessonId: string) => `/api/education/lessons/${lessonId}`,
    DELETE_LESSON: (lessonId: string) => `/api/education/lessons/${lessonId}`,
    REORDER_LESSONS: (moduleId: string) =>
      `/api/education/modules/${moduleId}/lessons/reorder`,
    LESSON_QUIZ: (lessonId: string) =>
      `/api/education/lessons/${lessonId}/quiz`,
    QUIZ: (lessonId: string) => `/api/education/quizzes/${lessonId}`,
    QUIZ_START: (lessonId: string) =>
      `/api/education/quizzes/${lessonId}/start`,
    QUIZ_SUBMIT: (attemptId: number) =>
      `/api/education/quizzes/attempts/${attemptId}/submit`,
    QUIZ_ATTEMPTS: (lessonId: string) =>
      `/api/education/quizzes/${lessonId}/attempts`,
    CERTIFICATE_GENERATE_MODULE: (moduleId: string) =>
      `/api/education/certificates/generate/module/${moduleId}`,
    CERTIFICATE_GENERATE_PATH: (pathId: string) =>
      `/api/education/certificates/generate/path/${pathId}`,
    CERTIFICATE_AUTO_GENERATE: "/api/education/certificates/auto-generate",
    CERTIFICATE_MY: "/api/education/certificates/my",
    CERTIFICATE_GET: (certId: string) =>
      `/api/education/certificates/${certId}`,
    CERTIFICATE_VERIFY: (certId: string) =>
      `/api/education/certificates/verify/${certId}`,
    HEALTH: "/api/education/health",
    STATS: "/api/education/stats",
  },
  INTEGRATIONS: {
    LIST: "/api/integrations",
    CONNECT: "/api/integrations",
    DISCONNECT: (provider: string) => `/api/integrations/${provider}`,
  },
  DASHBOARD: {
    DASHBOARD: "/api/dashboard",
    QUICK_STATS: "/api/dashboard/quick-stats",
    ACTIVITIES: "/api/dashboard/activities",
    SUMMARY: "/api/dashboard/summary",
  },
  PAYMENTS: {
    SUBSCRIPTIONS: "/api/payments/subscriptions",
    PLANS: "/api/payments/plans",
    CREATE_CHECKOUT: "/api/payments/create-checkout",
    CHECKOUT_STATUS: "/api/payments/checkout",
    WEBHOOK: "/api/payments/webhook",
    TRANSACTIONS: "/api/payments/transactions",
  },
  NOTIFICATIONS: {
    BASE: "/api/notifications",
    STATS: "/api/notifications/stats",
    PREFERENCES: "/api/notifications/preferences",
    READ_ALL: "/api/notifications/read-all",
    MARK_READ: (id: number) => `/api/notifications/${id}/read`,
    DELETE: (id: number) => `/api/notifications/${id}`,
    ADMIN_CREATE: (userId: number) => `/api/notifications/admin/${userId}`,
    ADMIN_BROADCAST: "/api/notifications/admin/broadcast",
    ADMIN_BROADCAST_ROLE: "/api/notifications/admin/broadcast-role",
  },
  SETTINGS: {
    ACCOUNT: "/api/settings/account",
    SECURITY: "/api/settings/security",
    SECURITY_CHANGE_PASSWORD: "/api/settings/security/change-password",
    SECURITY_DEVICES: "/api/settings/security/devices",
    SECURITY_DEVICE: (id: string) => `/api/settings/security/devices/${id}`,
    USAGE: "/api/settings/usage",
    APPEARANCE: "/api/settings/appearance",
    PRIVACY: "/api/settings/privacy",
    PRIVACY_SECTION: (section: string) =>
      `/api/settings/privacy/section/${section}`,
    NOTIFICATIONS: "/api/settings/notifications",
    BILLING: "/api/settings/billing",
    BILLING_PLAN: "/api/settings/billing/plan",
    BILLING_INVOICES: "/api/settings/billing/invoices",
    BILLING_PAYMENT_METHOD: "/api/settings/billing/payment-method",
    BILLING_PAYMENT_METHOD_DELETE: (id: string) =>
      `/api/settings/billing/payment-method/${id}`,
    INTEGRATIONS: "/api/settings/integrations",
    INTEGRATION: (provider: string) => `/api/settings/integrations/${provider}`,
    ADVANCED: "/api/settings/advanced",
    ADVANCED_EXPORT_DATA: "/api/settings/advanced/export-data",
    ADVANCED_EXPORTS: "/api/settings/advanced/exports",
    ACCOUNT_DEACTIVATE: "/api/settings/account/deactivate",
    ACCOUNT_DELETE: "/api/settings/account/delete",
    ACCOUNT_VERIFY_EMAIL: "/api/settings/account/verify-email",
    ACCOUNT_VERIFY_PHONE: "/api/settings/account/verify-phone",
  },
  LIVE_SESSIONS: {
    SESSIONS: "/api/v1/live-sessions/sessions",
    SESSION: (id: string) => `/api/v1/live-sessions/sessions/${id}`,
    MY_SESSIONS: "/api/v1/live-sessions/my-sessions",
    START_SESSION: (id: string) => `/api/v1/live-sessions/sessions/${id}/start`,
    END_SESSION: (id: string) => `/api/v1/live-sessions/sessions/${id}/end`,
    BOOK: (id: string) => `/api/v1/live-sessions/sessions/${id}/book`,
    BOOKINGS: "/api/v1/live-sessions/bookings",
    CANCEL_BOOKING: (id: number) =>
      `/api/v1/live-sessions/bookings/${id}/cancel`,
    JOIN: (id: string) => `/api/v1/live-sessions/sessions/${id}/join`,
    LEAVE: (id: string) => `/api/v1/live-sessions/sessions/${id}/leave`,
    PARTICIPANTS: (id: string) =>
      `/api/v1/live-sessions/sessions/${id}/participants`,
    TOKEN: (id: string) => `/api/v1/live-sessions/sessions/${id}/token`,
    WAITLIST: (id: string) => `/api/v1/live-sessions/sessions/${id}/waitlist`,
    CO_HOSTS: (id: string) => `/api/v1/live-sessions/sessions/${id}/co-hosts`,
    CO_HOST: (id: string, userId: number) =>
      `/api/v1/live-sessions/sessions/${id}/co-hosts/${userId}`,
    REPLAY: (id: string) => `/api/v1/live-sessions/sessions/${id}/replay`,
    RECORDING_START: (id: string) =>
      `/api/v1/live-sessions/sessions/${id}/recording/start`,
    RECORDING_STOP: (id: string) =>
      `/api/v1/live-sessions/sessions/${id}/recording/stop`,
    RECORDING_DOWNLOAD: (id: string) =>
      `/api/v1/live-sessions/sessions/${id}/recording/download`,
    TRENDING: "/api/v1/live-sessions/trending",
    UPCOMING: "/api/v1/live-sessions/upcoming",
    WEBHOOK: "/api/v1/live-sessions/webhooks/livekit",
    ADMIN_STATS: "/api/v1/live-sessions/admin/stats",
    ADMIN_SESSIONS: "/api/v1/live-sessions/admin/sessions",
  },
  ADMIN: {
    DASHBOARD: "/api/admin/dashboard",
    USERS: "/api/admin/users",
    USER: (id: number) => `/api/admin/users/${id}`,
    ORGANIZATIONS: "/api/admin/organizations",
    ORGANIZATION: (id: number) => `/api/admin/organizations/${id}`,
    PATHS: "/api/admin/paths",
    PATH: (id: string) => `/api/admin/paths/${id}`,
    PATH_MODULES: (id: string) => `/api/admin/paths/${id}/modules`,
    PATH_MODULES_REORDER: (id: string) =>
      `/api/admin/paths/${id}/modules/reorder`,
    MODULES: "/api/admin/modules",
    MODULE: (id: string) => `/api/admin/modules/${id}`,
    MODULES_BULK: "/api/admin/modules/bulk-action",
    MODULE_LESSONS: (id: string) => `/api/admin/modules/${id}/lessons`,
    MODULE_LESSONS_REORDER: (id: string) =>
      `/api/admin/modules/${id}/lessons/reorder`,
    LESSON: (id: string) => `/api/admin/lessons/${id}`,
    LESSON_QUIZ: (id: string) => `/api/admin/lessons/${id}/quiz`,
    QUIZ: (id: number) => `/api/admin/quizzes/${id}`,
    QUIZ_QUESTIONS: (id: number) => `/api/admin/quizzes/${id}/questions`,
    QUESTION: (id: number) => `/api/admin/questions/${id}`,
    UPLOAD: "/api/admin/upload",
    UPLOAD_VIDEO_AWS: "/api/admin/upload-video-aws",
    MIGRATE_VIDEO: "/api/admin/migrate-video-to-aws",
    WAITLIST: "/api/admin/waitlist",
    WAITLIST_STATS: "/api/admin/waitlist/stats",
    WAITLIST_EXPORT: "/api/admin/waitlist/export/csv",
    WAITLIST_ENTRY: (id: number) => `/api/admin/waitlist/${id}`,
    WAITLIST_MILESTONES: "/api/admin/waitlist/milestones",
    WAITLIST_MILESTONE: (id: number) => `/api/admin/waitlist/milestones/${id}`,
  },
  ORGANIZATIONS: {
    DIRECTORY: "/api/organizations/public/directory",
    LIST: "/api/organizations",
    CREATE: "/api/organizations",
    GET: (id: number) => `/api/organizations/${id}`,
    GET_BY_SLUG: (slug: string) => `/api/organizations/by-slug/${slug}`,
    UPDATE: (id: number) => `/api/organizations/${id}`,
    DELETE: (id: number) => `/api/organizations/${id}`,
    SLUG: (id: number) => `/api/organizations/${id}/slug`,
    SWITCH: (id: number) => `/api/organizations/${id}/switch`,
    MEMBERS: (id: number) => `/api/organizations/${id}/members`,
    INVITATIONS: "/api/organizations/invitations/me",
    ACCEPT_INVITATION: (token: string) =>
      `/api/organizations/invitations/${token}/accept`,
    DECLINE_INVITATION: (token: string) =>
      `/api/organizations/invitations/${token}/decline`,
  },
  PROFILES: {
    GET: (identifier: string | number) => `/api/profiles/${identifier}`,
    ME: "/api/profiles/me",
    COMPLETION: "/api/profiles/me/completion",
    USERNAME: "/api/profiles/me/username",
    USERNAME_AVAILABLE: (username: string) =>
      `/api/profiles/username/available/${username}`,
    FOLLOW: (identifier: string | number) =>
      `/api/profiles/${identifier}/follow`,
    FOLLOWERS: (identifier: string | number) =>
      `/api/profiles/${identifier}/followers`,
    FOLLOWING: (identifier: string | number) =>
      `/api/profiles/${identifier}/following`,
    FOLLOW_STATUS: (identifier: string | number) =>
      `/api/profiles/${identifier}/follow/status`,
    BLOCK: (identifier: string | number) => `/api/profiles/${identifier}/block`,
    BLOCKS: "/api/profiles/me/blocks",
    SKILLS: (identifier: string | number) =>
      `/api/profiles/${identifier}/skills`,
    CERTIFICATES: (identifier: string | number) =>
      `/api/profiles/${identifier}/certificates`,
    BADGES: (identifier: string | number) =>
      `/api/profiles/${identifier}/badges`,
    FREELANCER: (identifier: string | number) =>
      `/api/profiles/${identifier}/freelancer`,
    FREELANCER_SERVICES: (identifier: string | number) =>
      `/api/profiles/${identifier}/freelancer/services`,
    BUSINESS: (identifier: string | number) =>
      `/api/profiles/${identifier}/business`,
    BUSINESS_DATASETS: (identifier: string | number) =>
      `/api/profiles/${identifier}/business/datasets`,
    BUSINESS_ML_MODELS: (identifier: string | number) =>
      `/api/profiles/${identifier}/business/ml-models`,
    INSTRUCTOR: (identifier: string | number) =>
      `/api/profiles/${identifier}/instructor`,
    PORTFOLIO: (identifier: string | number) =>
      `/api/profiles/${identifier}/portfolio`,
    REVIEWS: (identifier: string | number) =>
      `/api/profiles/${identifier}/reviews`,
    ENDORSEMENTS: (identifier: string | number) =>
      `/api/profiles/${identifier}/endorsements`,
    ACTIVITY: (identifier: string | number) =>
      `/api/profiles/${identifier}/activity`,
    STUDENT: (identifier: string | number) =>
      `/api/profiles/${identifier}/student`,
    DASHBOARDS: (identifier: string | number) =>
      `/api/profiles/${identifier}/dashboards`,
  },
} as const;
