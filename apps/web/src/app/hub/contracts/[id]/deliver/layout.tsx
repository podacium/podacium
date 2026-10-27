import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/lib/metadata.config'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: slug } = await params

    return {
        title: `Deliver Work | ${SITE_CONFIG.name} Hub`,
        description: `Submit your work and deliverables on ${SITE_CONFIG.name} Hub.`,
        robots: {
            index: false,
            follow: false,
        },
        alternates: {
            canonical: `${SITE_CONFIG.url}/hub/contracts/${slug}/deliver`,
        },
    }
}

export default function HubContractDeliverLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
