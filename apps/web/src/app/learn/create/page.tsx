import { type Metadata } from 'next'
import { generateI18nMetadata } from '@/lib/i18n-metadata'
import { redirect } from 'next/navigation'

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: 'learn', path: '/learn' })
}

export default function CreateRedirectPage() {
  redirect('/learn/create/module')
}
