import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/lib/metadata.config'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: slug } = await params

    return {
        title: `Dispute Resolution | ${SITE_CONFIG.name} Hub`,
        description: `Resolve contract disputes on ${SITE_CONFIG.name} Hub.`,
        robots: {
            index: false,
            follow: false,
        },
        alternates: {
            canonical: `${SITE_CONFIG.url}/hub/contracts/${slug}/dispute`,
        },
    }
}

export default function HubContractDisputeLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
