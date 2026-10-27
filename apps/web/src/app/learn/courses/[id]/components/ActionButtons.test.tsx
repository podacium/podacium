import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => (key: string) => key,
}))

import { ActionButtons } from './ActionButtons'

const baseModule = {
  id: 1,
  instructorId: 1002,
  title: 'Test Course',
  instructor: { id: 1002, fullName: 'Redha Habib', bio: 'Bio', role: 'INSTRUCTOR' },
  paths: [{ id: 'p1', title: 'Path 1' }],
  lessons: [],
}

describe('ActionButtons', () => {
  it('invokes share, bookmark, support, and view profile handlers', () => {
    const onShare = vi.fn()
    const onBookmark = vi.fn()
    const onSupport = vi.fn()
    const onViewProfile = vi.fn()

    render(
      <ActionButtons
        module={baseModule}
        isRtl={false}
        onShare={onShare}
        onBookmark={onBookmark}
        bookmarked={false}
        onSupport={onSupport}
        onViewProfile={onViewProfile}
      />
    )

    fireEvent.click(screen.getByText('course.social.share'))
    fireEvent.click(screen.getByText('course.social.bookmark'))
    fireEvent.click(screen.getByText('course.social.support'))
    fireEvent.click(screen.getByText('course.social.viewProfile'))

    expect(onShare).toHaveBeenCalledTimes(1)
    expect(onBookmark).toHaveBeenCalledTimes(1)
    expect(onSupport).toHaveBeenCalledTimes(1)
    expect(onViewProfile).toHaveBeenCalledTimes(1)
  })

  it('renders bookmarked label and filled state when bookmarked', () => {
    render(
      <ActionButtons
        module={baseModule}
        isRtl={false}
        onBookmark={() => {}}
        bookmarked={true}
      />
    )

    expect(screen.getByText('course.social.bookmarked')).toBeTruthy()
  })
})
