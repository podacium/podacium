import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'liveAcceptTransfer', path: '/live/transfer/accept', noindex: true })
}

export default function AcceptTransferLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
