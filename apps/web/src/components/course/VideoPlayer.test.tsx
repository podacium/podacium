import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import VideoPlayer from './VideoPlayer'

// Mock hls.js
vi.mock('hls.js', () => {
  class MockHls {
    static isSupported() {
      return true
    }
    static Events = {
      MANIFEST_PARSED: 'hlsManifestParsed',
      ERROR: 'hlsError',
    }
    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError',
    }
    loadSource() {}
    attachMedia() {}
    on() {}
    destroy() {}
  }
  return {
    default: MockHls,
  }
})

// Mock i18n
vi.mock('@/lib/i18n', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

describe('VideoPlayer Component', () => {
  it('renders video element with given src', () => {
    const { container } = render(<VideoPlayer src="https://example.com/video.mp4" />)
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://example.com/video.mp4')
  })

  it('renders HLS video correctly without setting direct src on video element', () => {
    const { container } = render(<VideoPlayer src="https://example.com/master.m3u8" isHls={true} />)
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).not.toHaveAttribute('src')
  })

  it('renders subtitles track when subtitlesUrl is provided', () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        subtitlesUrl="https://example.com/subs.vtt"
        subtitlesLanguage="ar"
      />
    )
    const track = container.querySelector('track')
    expect(track).toBeInTheDocument()
    expect(track).toHaveAttribute('src', 'https://example.com/subs.vtt')
    expect(track).toHaveAttribute('srclang', 'ar')
  })

  it('renders replay button when video controls are active', () => {
    render(<VideoPlayer src="https://example.com/video.mp4" controls={true} />)
    const replayButton = screen.getByText('compcourse.video.controls.replay')
    expect(replayButton).toBeInTheDocument()
  })
})
