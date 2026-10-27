import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'liveBookings', path: '/live/bookings' })
}

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
