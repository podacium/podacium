export const ROUTES = {
  HOME: '/',
  LOGIN: '/auth/login',
  SIGNUP: '/auth/signup',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_EMAIL: '/auth/verify-email',
  RESEND_VERIFICATION: '/auth/resend-verification',
  PROFILE: '/dashboard/profile',
  PROFILE_BY_USERNAME: (username: string) => `/profile/${username}`,
  DASHBOARD: '/dashboard',
}