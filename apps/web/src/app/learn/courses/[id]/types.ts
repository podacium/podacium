import type {
    ModuleResponse,
    LessonResponse,
    EnrollmentResponse,
    LessonProgressResponse,
    UserLearningStats
} from '@/lib/api'

export type {
    ModuleResponse,
    LessonResponse,
    EnrollmentResponse,
    LessonProgressResponse,
    UserLearningStats
}

export enum AccessState {
    UNAUTHENTICATED = 'UNAUTHENTICATED',
    AUTHENTICATED_NOT_ENROLLED = 'AUTHENTICATED_NOT_ENROLLED',
    ENROLLED = 'ENROLLED'
}

export enum LessonStatus {
    LOCKED = 'LOCKED',
    AVAILABLE = 'AVAILABLE',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED'
}

export enum SyncStatus {
    ONLINE = 'ONLINE',
    OFFLINE = 'OFFLINE',
    SYNCING = 'SYNCING',
    ERROR = 'ERROR'
}

export interface Permissions {
    canViewLesson: boolean
    canTakeQuiz: boolean
    canDownloadResources: boolean
    canGenerateCertificate: boolean
    canAccessAnalytics: boolean
    canSaveProgress: boolean
    canRequestSupport: boolean
}

export interface VideoMilestone {
    id: string
    timestamp: number
    percentage: number
    completed: boolean
    type: 'content' | 'quiz' | 'interaction'
}

export interface CourseState {
    module: ModuleResponse | null
    lessons: LessonResponse[]
    enrollment: EnrollmentResponse | null
    lessonProgress: Record<string, LessonProgressResponse>
    userStats: UserLearningStats | null
    isLoading: boolean
    isEnrolling: boolean
    error: string | null
    syncStatus: SyncStatus
    pendingUpdatesCount: number
    lastSyncTime: number
    showFailModal: boolean
}

export interface PriceInfo {
    current: number
    original: number | null
    isDiscounted: boolean
    discountPercentage: number | null
}
