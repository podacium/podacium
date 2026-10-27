import { useMemo } from 'react'
import { EnrollmentResponse } from '@/lib/api'
import { AccessState, Permissions } from '../types'

export const useCourseAccess = (
    isAuthenticated: boolean,
    enrollment: EnrollmentResponse | null,
    overallProgress: number,
    user: any | null, // Using any for now to avoid deep import issues, but conceptually UserResponse
    module: any | null // Conceptually ModuleResponse
) => {
    const accessState = useMemo(() => {
        if (!isAuthenticated) return AccessState.UNAUTHENTICATED

        // Check for instructor or admin bypass
        if (user && module) {
            // Instructor bypass
            if (user.id === module.instructorId) {
                return AccessState.ENROLLED
            }
            // Admin bypass
            if (user.role === 'ADMIN') {
                return AccessState.ENROLLED
            }
        }

        if (!enrollment) return AccessState.AUTHENTICATED_NOT_ENROLLED
        return AccessState.ENROLLED
    }, [isAuthenticated, enrollment, user, module])

    const permissions = useMemo(() => {
        const basePermissions: Permissions = {
            canViewLesson: accessState === AccessState.ENROLLED,
            canTakeQuiz: accessState === AccessState.ENROLLED,
            canDownloadResources: accessState === AccessState.ENROLLED,
            canGenerateCertificate: accessState === AccessState.ENROLLED && overallProgress >= 100,
            canAccessAnalytics: accessState === AccessState.ENROLLED,
            canSaveProgress: accessState === AccessState.ENROLLED,
            canRequestSupport: isAuthenticated
        }

        return basePermissions
    }, [accessState, overallProgress, isAuthenticated])

    return {
        accessState,
        permissions
    }
}
