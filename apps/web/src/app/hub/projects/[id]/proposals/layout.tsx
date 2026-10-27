import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/lib/metadata.config'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: slug } = await params

    return {
        title: `Project Proposals | ${SITE_CONFIG.name} Hub`,
        description: `Review proposals for your project on ${SITE_CONFIG.name} Hub.`,
        robots: {
            index: false,
            follow: false,
        },
        alternates: {
            canonical: `${SITE_CONFIG.url}/hub/projects/${slug}/proposals`,
        },
    }
}

export default function HubProjectProposalsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
