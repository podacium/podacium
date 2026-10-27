import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_PROTOCOLS = ['https:']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const TIMEOUT = 5000

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url param' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only HTTPS allowed' }, { status: 400 })
  }

  // Block internal/private IPs (SSRF prevention)
  if (parsed.hostname === 'localhost' || parsed.hostname.startsWith('127.') || parsed.hostname.startsWith('10.') || parsed.hostname.startsWith('192.168.')) {
    return NextResponse.json({ error: 'Blocked' }, { status: 403 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'image/*' },
    })
    clearTimeout(timeout)

    if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 })

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 400 })
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
    if (contentLength > MAX_SIZE) {
      return NextResponse.json({ error: 'Too large' }, { status: 413 })
    }

    const body = await res.arrayBuffer()

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }
}
