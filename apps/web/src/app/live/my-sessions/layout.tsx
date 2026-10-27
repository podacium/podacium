import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'liveMySessions', path: '/live/my-sessions' })
}

export default function MySessionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
