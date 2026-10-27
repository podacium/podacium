import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/lib/metadata.config'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id: slug } = await params

    return {
        title: `Contract Payment | ${SITE_CONFIG.name} Hub`,
        description: `Process payments for your contracts securely on ${SITE_CONFIG.name} Hub.`,
        robots: {
            index: false,
            follow: false,
        },
        alternates: {
            canonical: `${SITE_CONFIG.url}/hub/contracts/${slug}/payment`,
        },
    }
}

export default function HubContractPaymentLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
