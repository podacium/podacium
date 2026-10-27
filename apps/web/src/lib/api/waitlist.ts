import { apiClient } from './client'

export interface WaitlistEntry {
  id: number
  fullName: string
  email: string
  referralCode: string
  friendsReferredCount: number
  status: string
  createdAt: string
}

export interface WaitlistRegisterRequest {
  fullName: string
  email: string
  referralCode?: string
  locale?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  fingerprint?: string
  userAgent?: string
  screenSize?: string
  honeypot?: string
}

export interface WaitlistRegisterResponse {
  ok: boolean
  entry: WaitlistEntry
  queuePosition: number
  alreadyRegistered?: boolean
}

export interface WaitlistStatsResponse {
  totalCount: number
}

export interface WaitlistPositionResponse {
  position: number
  totalCount: number
}

export interface WaitlistLeaderboardEntry {
  fullName: string
  friendsReferredCount: number
  createdAt: string
}

export interface WaitlistLeaderboardResponse {
  entries: WaitlistLeaderboardEntry[]
  totalCount: number
}

export interface WaitlistStatusResponse {
  registered: boolean
  entry?: WaitlistEntry
}

export interface WaitlistValidateReferralResponse {
  valid: boolean
  inviterName?: string
}

const REFERRAL_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function isReferralCodeValid(code: string): boolean {
  return code.length === 8 && [...code].every((c) => REFERRAL_CHARSET.includes(c))
}

export function getReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')?.trim().toUpperCase() ?? null
  return ref && isReferralCodeValid(ref) ? ref : null
}

export function getUtmsFromUrl() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    utmSource: params.get('utm_source') ?? undefined,
    utmMedium: params.get('utm_medium') ?? undefined,
    utmCampaign: params.get('utm_campaign') ?? undefined,
  }
}

export function getFingerprint(): string {
  if (typeof window === 'undefined') return ''
  const data = [
    navigator.userAgent,
    navigator.language,
    window.screen.width + 'x' + window.screen.height,
    (navigator as any).deviceMemory || '0',
    navigator.hardwareConcurrency || '0',
    new Date().getTimezoneOffset(),
    (navigator as any).platform || 'unknown',
  ].join('|')
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return 'fp_' + Math.abs(hash).toString(36)
}

export function getShareableLink(referralCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://podacium.com'
  return `${origin}/waitlist?ref=${referralCode}`
}

export function getShareUrls(referralCode: string) {
  const link = encodeURIComponent(getShareableLink(referralCode))
  const text = encodeURIComponent(
    'Join me on Podacium — Algeria\'s all-in-one platform for learning, freelancing, and business intelligence! 🇩🇿',
  )
  return {
    whatsapp: `https://wa.me/?text=${text}%0A${link}`,
    telegram: `https://t.me/share/url?url=${link}&text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${link}`,
    twitter: `https://x.com/intent/tweet?text=${text}&url=${link}`,
    viber: `viber://forward?text=${text}%0A${link}`,
  }
}

export const waitlistApi = {
  register(data: WaitlistRegisterRequest) {
    return apiClient.post<WaitlistRegisterResponse>('/api/waitlist/register', data)
  },

  getPosition(email: string) {
    return apiClient.get<WaitlistPositionResponse>(
      `/api/waitlist/position?email=${encodeURIComponent(email)}`,
    )
  },

  getLeaderboard() {
    return apiClient.get<WaitlistLeaderboardResponse>('/api/waitlist/leaderboard')
  },

  getStats() {
    return apiClient.get<WaitlistStatsResponse>('/api/waitlist/stats')
  },

  getStatus(email: string) {
    return apiClient.get<WaitlistStatusResponse>(
      `/api/waitlist/status?email=${encodeURIComponent(email)}`,
    )
  },

  validateReferral(code: string) {
    return apiClient.get<WaitlistValidateReferralResponse>(
      `/api/waitlist/validate-referral?code=${encodeURIComponent(code)}`,
    )
  },
}
