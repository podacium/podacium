'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function OAuthHandler() {
    const router = useRouter()
    const params = useSearchParams()
    const pathname = usePathname()
    const { refreshUser } = useAuth()
    const handled = useRef(false)

    useEffect(() => {
        const oauthSuccess = params.get('oauth_success')
        if (oauthSuccess !== 'true' || handled.current) return

        handled.current = true

        refreshUser()
            .then((user: any) => {
                const stored = findOAuthReturnUrl()
                const redirectParam = stored ? extractRedirectParam(stored) : null
                const destination = redirectParam || (user?.onboardingCompleted ? '/dashboard/' : '/onboarding/')
                router.replace(destination)
            })
            .catch((e) => {
                console.error('Failed to sync OAuth user state', e);
                router.replace('/auth/login');
            })
    }, [params, router, pathname, refreshUser])

    return null
}

function findOAuthReturnUrl(): string | null {
    if (typeof window === 'undefined') return null
    for (const key of Object.keys(localStorage)) {
        if (key.startsWith('oauth_return_')) {
            const url = localStorage.getItem(key)
            localStorage.removeItem(key)
            if (url) return url
        }
    }
    return null
}

function extractRedirectParam(storedUrl: string): string | null {
    try {
        const parsed = new URL(storedUrl)
        return parsed.searchParams.get('redirect')
    } catch {
        return null
    }
}
