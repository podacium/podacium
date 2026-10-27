import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/lib/metadata.config'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: slug } = await params

    return {
        title: `Contract Messages | ${SITE_CONFIG.name} Hub`,
        description: `Communicate with your contract partners on ${SITE_CONFIG.name} Hub.`,
        robots: {
            index: false,
            follow: false,
        },
        alternates: {
            canonical: `${SITE_CONFIG.url}/hub/contracts/${slug}/messages`,
        },
    }
}

export default function HubContractMessagesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
