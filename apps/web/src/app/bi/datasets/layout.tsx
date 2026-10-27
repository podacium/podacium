import type { Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'
import { PAGE_METADATA } from '@/lib/metadata.config'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({
    key: 'biDatasets',
    path: '/bi/datasets',
    keywords: PAGE_METADATA.biDatasets?.keywords,
  })
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
