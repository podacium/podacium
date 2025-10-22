'use client'

import { ButtonHTMLAttributes, AnchorHTMLAttributes, forwardRef } from 'react'
import Link from 'next/link'

interface BaseProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
}

type ButtonProps = BaseProps & (
  | (ButtonHTMLAttributes<HTMLButtonElement> & { href?: never })
  | (AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
)

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', href, className = '', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
    
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700 shadow-sm hover:shadow-md',
      outline: 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50',
      ghost: 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
    }
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    }

    const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`

    if (href) {
      return (
        <Link
          href={href}
          className={combinedClassName}
          {...props as AnchorHTMLAttributes<HTMLAnchorElement>}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        >
          {children}
        </Link>
      )
    }

    return (
      <button
        className={combinedClassName}
        {...props as ButtonHTMLAttributes<HTMLButtonElement>}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button