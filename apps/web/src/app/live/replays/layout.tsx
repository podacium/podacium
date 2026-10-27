import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'liveReplays', path: '/live/replays' })
}

export default function ReplaysLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
