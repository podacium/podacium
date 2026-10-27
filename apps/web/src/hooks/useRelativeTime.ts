'use client'

import { useCallback } from 'react'
import { useTranslations } from '@/lib/i18n'

export function useRelativeTime() {
  const t = useTranslations()

  const formatRelativeTime = useCallback((dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      const diffWeeks = Math.floor(diffDays / 7)

      if (diffMins < 1) {
        return t('hub.activity.now')
      } else if (diffMins < 60) {
        return t('hub.activity.minutesAgo', { count: String(diffMins) })
      } else if (diffHours < 24) {
        return t('hub.activity.hoursAgo', { count: String(diffHours) })
      } else if (diffDays < 7) {
        return t('hub.activity.daysAgo', { count: String(diffDays) })
      } else if (diffWeeks < 4) {
        return t('hub.activity.weeksAgo', { count: String(diffWeeks) })
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    } catch {
      return ''
    }
  }, [t])

  return { formatRelativeTime }
}

export default useRelativeTime
