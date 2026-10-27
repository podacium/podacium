'use client'

import React from 'react'
import UniversalImage from '@/components/UniversalImage'
import { User } from 'lucide-react'

interface UserAvatarProps {
  src: string | null | undefined
  alt: string
  size?: number
  className?: string
}

const UserAvatar: React.FC<UserAvatarProps> = ({ src, alt, size = 40, className = '' }) => (
  <UniversalImage
    src={src}
    alt={alt}
    fill
    sizes={`${size}px`}
    className={`object-cover rounded-full ${className}`}
    fallback={
      <div
        className="flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full"
        style={{ width: size, height: size }}
      >
        <User className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    }
    fallbackClassName="rounded-full"
  />
)

export default UserAvatar
