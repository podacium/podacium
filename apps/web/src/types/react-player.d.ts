declare module 'react-player' {
  import * as React from 'react';

  export interface ReactPlayerProps {
    url?: string | string[];
    playing?: boolean;
    loop?: boolean;
    controls?: boolean;
    light?: boolean | string;
    volume?: number;
    muted?: boolean;
    playbackRate?: number;
    width?: string | number;
    height?: string | number;
    onReady?: () => void;
    onStart?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onBuffer?: () => void;
    onSeek?: (seconds: number) => void;
    onEnded?: () => void;
    onError?: (error: any, data?: any, hlsInstance?: any, hlsGlobal?: any) => void;
    onProgress?: (state: { played: number; playedSeconds: number; loaded: number; loadedSeconds: number }) => void;
    onDuration?: (duration: number) => void;
    progressInterval?: number;
    playsinline?: boolean;
    pip?: boolean;
    stopOnUnmount?: boolean;
    fallback?: React.ReactNode;
    wrapper?: React.ElementType;
    config?: any;
  }

  export interface ReactPlayerInstance {
    seekTo: (amount: number, type?: 'seconds' | 'fraction') => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    getInternalPlayer: (key?: string) => any;
  }

  export default class ReactPlayer extends React.Component<ReactPlayerProps> implements ReactPlayerInstance {}
}