'use client'

/**
 * /settings/data — Personal Data Management Portal
 *
 * This page now delegates all rendering to the shared DataPrivacySection
 * component used by the Danger Zone tab in /settings.
 */

import DataPrivacySection from '@/components/settings/DataPrivacySection'

export default function DataPrivacyPage() {
  return <DataPrivacySection />
}
