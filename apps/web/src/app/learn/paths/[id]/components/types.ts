export enum AccessState {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  AUTHENTICATED_NOT_ENROLLED = 'AUTHENTICATED_NOT_ENROLLED',
  ENROLLED = 'ENROLLED'
}

export enum ModuleStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface Permissions {
  canViewPath: boolean
  canEnroll: boolean
  canAccessModules: boolean
  canDownloadResources: boolean
  canGenerateCertificate: boolean
  canAccessAnalytics: boolean
  canSaveProgress: boolean
  canRequestSupport: boolean
  canSharePath: boolean
  canBookmarkPath: boolean
}

export interface PathProgressState {
  overall: number
  modules: Record<string, { progress: number; completedLessons: string[]; lastAccessed: string; status: ModuleStatus }>
  currentModuleId?: string
  completedModules: string[]
  totalTimeSpent: number
  streakDays: number
  lastAccessed: string
  startedAt: string
  estimatedCompletion: string
  pace: 'ahead' | 'on-track' | 'behind'
}
