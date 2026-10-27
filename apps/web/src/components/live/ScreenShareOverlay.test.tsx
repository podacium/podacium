import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({ dir: 'ltr' }),
  useLocale: () => 'en',
}))

const mockComponentsReact = vi.hoisted(() => ({
  useTracks: vi.fn(),
  VideoTrack: () => <div data-testid="screen-video" />,
}))

vi.mock('@livekit/components-react', () => mockComponentsReact)

vi.mock('livekit-client', () => ({
  Track: { Source: { ScreenShare: 'screenshare', Camera: 'camera' } },
}))

import { ScreenShareOverlay } from './ScreenShareOverlay'

describe('ScreenShareOverlay', () => {
  it('renders nothing when no screen-share track is present', () => {
    mockComponentsReact.useTracks.mockReturnValue([])
    const { container } = render(<ScreenShareOverlay />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the shared video without a redundant stop button', () => {
    mockComponentsReact.useTracks.mockReturnValue([
      { participant: { identity: 'p1', name: 'Speaker' } },
    ])

    render(<ScreenShareOverlay />)

    expect(screen.getByTestId('screen-video')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})