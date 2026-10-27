import { useState, useEffect, useCallback } from 'react'
import { apiHelpers, ModuleResponse } from '@/lib/api'

export const usePublicCourseData = (courseId: string) => {
    const [state, setState] = useState<{
        module: ModuleResponse | null
        isLoading: boolean
        error: string | null
    }>({
        module: null,
        isLoading: true,
        error: null
    })

    const fetchPublicModuleData = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }))

            if (!courseId || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(courseId)) {
                throw new Error('Invalid course ID')
            }

            const moduleData = await apiHelpers.education.getPublicModule(courseId)

            if (!moduleData) {
                throw new Error('Course not found')
            }

            setState(prev => ({ ...prev, module: moduleData }))

        } catch (error: any) {
            console.error('Error fetching public course data:', error)
            if (!error.message?.includes('Authentication') && !error.message?.includes('auth')) {
                setState(prev => ({
                    ...prev,
                    error: error.message || 'Failed to load course data'
                }))
            }
        } finally {
            setState(prev => ({ ...prev, isLoading: false }))
        }
    }, [courseId])

    useEffect(() => {
        fetchPublicModuleData()
    }, [fetchPublicModuleData])

    return state
}
