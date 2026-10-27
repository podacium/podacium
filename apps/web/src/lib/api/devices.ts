/**
 * Device Fingerprinting & Security API module.
 * Manages user devices, trust settings, security events, and escrow cooldowns.
 */

import { apiClient } from './client'

// =============================================================================
// DEVICE TYPES
// =============================================================================

export interface DeviceItem {
  id: number
  fingerprintHash: string
  platform?: string | null
  browserName?: string | null
  browserVersion?: string | null
  osVersion?: string | null
  deviceModel?: string | null
  screenResolution?: string | null
  lastKnownWilaya?: string | null
  lastActiveAt: string
  firstSeenAt: string
  loginCount: number
  isTrusted: boolean
  isPrimary: boolean
}

export interface DeviceListResponse {
  devices: DeviceItem[]
  currentDeviceId?: number | null
}

export interface DeviceResponse {
  id: number
  isTrusted?: boolean | null
  isPrimary?: boolean | null
}

export interface SecurityEventItem {
  id: number
  eventType: string
  description?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  wilaya?: string | null
}

export interface EscrowEligibilityResponse {
  allowed: boolean
  cooldownExpiresAt?: string | null
  requires2faBypass: boolean
}

export interface DeviceStatsResponse {
  total: number
  trusted: number
  active_today: number
  events_7d: number
}

// =============================================================================
// DEVICES API METHODS
// =============================================================================

export const devicesApi = {
  /** List all active devices for the current user */
  listDevices() {
    return apiClient.get<DeviceListResponse>('/api/devices')
  },

  /** Get device summary stats */
  getDeviceStats() {
    return apiClient.get<DeviceStatsResponse>('/api/devices/stats')
  },

  /** Get recent security events */
  listSecurityEvents(limit = 20) {
    return apiClient.get<SecurityEventItem[]>(`/api/devices/events?limit=${limit}`)
  },

  /** Set a device as primary (unsets any existing primary) */
  setDevicePrimary(deviceId: number) {
    return apiClient.post<DeviceResponse>(`/api/devices/${deviceId}/primary`)
  },

  /** Toggle device trusted status (requires prior 2FA) */
  setDeviceTrust(deviceId: number, isTrusted: boolean) {
    return apiClient.post<DeviceResponse>(`/api/devices/${deviceId}/trust`, { is_trusted: isTrusted })
  },

  /** Check escrow/payout eligibility for current device */
  getEscrowEligibility(fingerprintHash: string) {
    return apiClient.get<EscrowEligibilityResponse>(
      `/api/devices/escrow-eligibility?fingerprint_hash=${encodeURIComponent(fingerprintHash)}`
    )
  },

  /** Remove (soft-delete) a device */
  removeDevice(deviceId: number) {
    return apiClient.delete<DeviceResponse>(`/api/devices/${deviceId}`)
  },

  /** Bypass device cooldown via 2FA */
  bypassCooldown(fingerprintHash: string) {
    return apiClient.post<EscrowEligibilityResponse>(
      `/api/devices/cooldown-bypass?fingerprint_hash=${encodeURIComponent(fingerprintHash)}`
    )
  },
}
