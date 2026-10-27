import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'biOrganizationInvitations', path: '/bi/organizations/invitations', noindex: true })
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
