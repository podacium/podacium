import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'
import { PAGE_METADATA } from '@/lib/metadata.config'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({
    key: 'biDecisions',
    path: '/bi/decisions',
    keywords: PAGE_METADATA.biDecisions?.keywords,
  })
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
