import { MetadataRoute } from 'next'
import sitemap from '@/lib/sitemap-data'

function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function generateXml(sitemap: MetadataRoute.Sitemap): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

    for (const item of sitemap) {
        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(item.url)}</loc>\n`;

        if (item.lastModified) {
            const dateStr = item.lastModified instanceof Date
                ? item.lastModified.toISOString()
                : new Date(item.lastModified).toISOString();
            xml += `    <lastmod>${dateStr}</lastmod>\n`;
        }

        if (item.changeFrequency) {
            xml += `    <changefreq>${item.changeFrequency}</changefreq>\n`;
        }

        if (item.priority !== undefined) {
            xml += `    <priority>${item.priority}</priority>\n`;
        }

        if (item.alternates?.languages) {
            for (const [lang, langUrl] of Object.entries(item.alternates.languages)) {
                if (langUrl) {
                    xml += `    <xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(langUrl)}" />\n`;
                }
            }
        }

        xml += `  </url>\n`;
    }

    xml += `</urlset>`;
    return xml;
}

export async function GET() {
    try {
        const sitemapData = await sitemap();
        const xmlContent = generateXml(sitemapData);

        return new Response(xmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/xml',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    } catch (error) {
        console.error('Failed to generate sitemap:', error);
        return new Response('Error generating sitemap', { status: 500 });
    }
}
