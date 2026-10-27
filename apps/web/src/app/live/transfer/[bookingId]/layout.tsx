import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'liveTransfer', path: '/live/transfer', noindex: true })
}

export default function TransferBookingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
