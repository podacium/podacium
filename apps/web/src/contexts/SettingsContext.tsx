/**
 * SettingsContext — User preferences, security, and account management.
 * Handles: notification prefs, security settings, password change, account deletion.
 */
'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  api,
  UserProfileResponse,
  NotificationPreferences,
  SecuritySettings,
  handleApiError,
} from '@/lib/api'
import { useAuth } from './AuthContext'

// =============================================================================
// TYPES
// =============================================================================

interface PasswordChangeData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface AccountDeletionData {
  password: string
  reason?: string
}

export interface SettingsContextType {
  error: string | null

  updatePrivateSettings: (data: { email?: string; phoneNumber?: string; subscribeNewsletter?: boolean }) => Promise<UserProfileResponse>
  updateNotificationPreferences: (data: NotificationPreferences) => Promise<void>
  updateSecuritySettings: (data: SecuritySettings) => Promise<void>
  changePassword: (data: PasswordChangeData) => Promise<void>
  requestEmailVerification: (data: { email: string; token: string }) => Promise<void>
  requestPhoneVerification: (data: { phoneNumber: string }) => Promise<void>
  deleteAccount: (data: AccountDeletionData) => Promise<void>
  clearError: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

// =============================================================================
// PROVIDER
// =============================================================================

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout, refreshUser } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const updatePrivateSettings = useCallback(async (data: { email?: string; phoneNumber?: string; subscribeNewsletter?: boolean }) => {
    setError(null)
    try {
      const updatedProfile = await api.updatePrivateSettings(data)
      await refreshUser()
      return updatedProfile
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [refreshUser])

  const updateNotificationPreferences = useCallback(async (data: NotificationPreferences) => {
    setError(null)
    try {
      await api.updateUserNotificationPreferences(data)
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [])

  const updateSecuritySettings = useCallback(async (data: SecuritySettings) => {
    setError(null)
    try {
      await api.updateUserSecuritySettings(data)
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [])

  const changePassword = useCallback(async (data: PasswordChangeData) => {
    setError(null)
    try {
      await api.changePassword(data)
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [])

  const requestEmailVerification = useCallback(async (data: { email: string; token: string }) => {
    setError(null)
    try {
      await api.requestEmailVerification(data)
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [])

  const requestPhoneVerification = useCallback(async (data: { phoneNumber: string }) => {
    setError(null)
    try {
      await api.requestPhoneVerification(data)
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [])

  const deleteAccount = useCallback(async (data: AccountDeletionData) => {
    setError(null)
    try {
      await api.deleteAccount(data)
      await logout()
    } catch (err) {
      setError(handleApiError(err))
      throw err
    }
  }, [logout])

  const value: SettingsContextType = {
    error,
    updatePrivateSettings,
    updateNotificationPreferences,
    updateSecuritySettings,
    changePassword,
    requestEmailVerification,
    requestPhoneVerification,
    deleteAccount,
    clearError,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

// =============================================================================
// HOOK
// =============================================================================

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
