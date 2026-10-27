import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'learnPaths', path: '/learn/paths' })
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
