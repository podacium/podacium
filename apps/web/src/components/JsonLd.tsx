import React from 'react'

interface JsonLdProps {
    data: Record<string, any>
}

/**
 * Component to inject JSON-LD structured data into the <head>
 * @see https://developers.google.com/search/docs/appearance/structured-data
 */
export default function JsonLd({ data }: JsonLdProps) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    )
}
