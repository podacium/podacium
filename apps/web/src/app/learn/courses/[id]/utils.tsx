import React from 'react'
import {
    Lock,
    CheckCircle,
    Video,
    FileText,
    BookOpen,
    FileCode,
    Layers,
    Music
} from 'lucide-react'
import { ModuleResponse } from '@/lib/api'
import { PriceInfo } from './types'

export const formatDuration = (minutes?: number, t?: (key: string) => string): string => {
    if (!minutes) return `0 ${t?.('learn.labels.minutes') || 'min'}`
    if (minutes < 60) return `${minutes} ${t?.('learn.labels.minutes') || 'min'}`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    const h = t?.('learn.labels.hours') || 'h'
    const m = t?.('learn.labels.minutes') || 'min'
    return mins > 0 ? `${hours}${h} ${mins}${m}` : `${hours}${h}`
}

export const calculateProgress = (completed: number, total: number): number => {
    if (total === 0) return 0
    return Math.min(100, Math.round((completed / total) * 100))
}

export const getPriceInfo = (module: ModuleResponse | null): PriceInfo => {
    if (!module) return {
        current: 0,
        original: null,
        isDiscounted: false,
        discountPercentage: null
    }
    let current = 0
    let original: number | null = null

    if (module.price && typeof module.price === 'object') {
        const origVal = typeof (module.price as any).original === 'number' ? (module.price as any).original : 0
        const discVal = typeof (module.price as any).discounted === 'number' ? (module.price as any).discounted : null

        original = origVal
        current = discVal !== null ? discVal : origVal
    } else if (typeof module.price === 'number' && !isNaN(module.price) && module.price > 0) {
        current = module.price
        original = current
    }

    const isDiscounted = original !== null && original > 0 && current < original
    const discountPercentage = isDiscounted && original !== null && original > 0
        ? Math.round(((original - current) / original) * 100)
        : null

    return {
        current,
        original,
        isDiscounted,
        discountPercentage
    }
}

export const normalizePrice = (module: ModuleResponse | null): number => {
    const priceInfo = getPriceInfo(module)
    return priceInfo.current
}

export const getLessonIcon = (type: string, isCompleted?: boolean, isLocked?: boolean): React.ReactNode => {
    const iconClass = "w-5 h-5"
    const typeLower = type.toLowerCase()

    if (isLocked) return <Lock className={iconClass} />
    if (isCompleted) return <CheckCircle className={iconClass} />

    switch (typeLower) {
        case 'video': return <Video className={iconClass} />
        case 'quiz': return <FileText className={iconClass} />
        case 'reading': return <BookOpen className={iconClass} />
        case 'coding': return <FileCode className={iconClass} />
        case 'interactive': return <Layers className={iconClass} />
        case 'audio': return <Music className={iconClass} />
        case 'case-study': return <FileText className={iconClass} />
        default: return <FileText className={iconClass} />
    }
}
