/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface ResetRequestFormData {
  email: string
}

interface ResetConfirmFormData {
  password: string
  confirmPassword: string
}

interface ApiError {
  message: string
  code?: string
  details?: string
}

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

const useResetRequestForm = () => {
  const [formData, setFormData] = useState<ResetRequestFormData>({
    email: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('https://podacium-api.onrender.com/api/auth/reset-password-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.toLowerCase().trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Failed to send reset email')
      }

      setSuccess(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      setApiError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    if (apiError) {
      setApiError(null)
    }
  }

  return {
    formData,
    errors,
    loading,
    success,
    apiError,
    handleChange,
    handleSubmit
  }
}

const useResetConfirmForm = (token: string | null) => {
  const [formData, setFormData] = useState<ResetConfirmFormData>({
    password: '',
    confirmPassword: ''
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [tokenChecking, setTokenChecking] = useState(true)

  // Check token validity on component mount
  useEffect(() => {
    const checkTokenValidity = async () => {
      if (!token) {
        setTokenValid(false)
        setTokenChecking(false)
        return
      }

      try {
        // In a real implementation, you might want to validate the token with the backend
        // For now, we'll assume any non-empty token is valid
        await new Promise(resolve => setTimeout(resolve, 500))
        setTokenValid(true)
      } catch (error) {
        setTokenValid(false)
        setApiError('Invalid or expired reset token')
      } finally {
        setTokenChecking(false)
      }
    }

    checkTokenValidity()
  }, [token])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must include uppercase, lowercase, and numbers'
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    
    try {
      const response = await fetch('https://podacium-api.onrender.com/api/auth/reset-password-confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: formData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Failed to reset password')
      }

      setSuccess(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      setApiError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
    if (apiError) {
      setApiError(null)
    }
  }

  return {
    formData,
    errors,
    loading,
    success,
    apiError,
    tokenValid,
    tokenChecking,
    handleChange,
    handleSubmit
  }
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
  href?: string
  type?: 'button' | 'submit' | 'reset'
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  loading = false,
  className = '',
  href,
  type
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-4'
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-300 shadow-lg hover:shadow-xl',
    secondary: 'bg-gray-800 hover:bg-gray-900 text-white focus:ring-gray-300',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus:ring-blue-300',
    ghost: 'text-gray-700 hover:text-blue-600 hover:bg-blue-50 focus:ring-blue-300'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    xl: 'px-10 py-5 text-xl'
  }
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`
  
  if (href) {
    return (
      <Link href={href} className={classes}>
        {loading && (
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </Link>
    )
  }
  
  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      type={type || 'button'}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  )
}

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  padding = 'md',
  onClick
}) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  }
  
  const baseClasses = 'bg-white rounded-xl shadow-lg border border-gray-100'
  const hoverClasses = hover ? 'transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer' : ''
  
  return (
    <div
      className={`${baseClasses} ${paddingClasses[padding]} ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface InputProps {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  tooltip?: string
  autoComplete?: string
}

const Input: React.FC<InputProps> = ({
  label,
  type,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  tooltip,
  autoComplete
}) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const inputId = `input-${label.replace(/\s+/g, '-').toLowerCase()}`

  const isPassword = type === 'password'
  const displayType = isPassword && showPassword ? 'text' : type

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute z-10 w-64 p-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg -top-2 left-6">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        <input
          id={inputId}
          type={displayType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent transition-all ${
            error 
              ? 'border-red-300 focus:ring-red-200' 
              : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
          } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''} ${isPassword ? 'pr-10' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L7.757 7.757M9.878 9.878l-2.12 2.12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

interface PasswordStrengthIndicatorProps {
  password: string
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0
    if (pwd.length >= 8) score++
    if (/[a-z]/.test(pwd)) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++

    const strengthMap = [
      { label: 'Very Weak', color: 'bg-red-500' },
      { label: 'Weak', color: 'bg-orange-500' },
      { label: 'Fair', color: 'bg-yellow-500' },
      { label: 'Good', color: 'bg-blue-500' },
      { label: 'Strong', color: 'bg-green-500' }
    ]

    return { score, ...strengthMap[Math.min(score, 4)] }
  }

  const strength = getStrength(password)

  if (!password) return null

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">Password strength:</span>
        <span className={`font-medium ${
          strength.score <= 1 ? 'text-red-600' :
          strength.score <= 2 ? 'text-orange-600' :
          strength.score <= 3 ? 'text-yellow-600' :
          strength.score <= 4 ? 'text-blue-600' : 'text-green-600'
        }`}>
          {strength.label}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${strength.color}`}
          style={{ width: `${(strength.score / 5) * 100}%` }}
        ></div>
      </div>
    </div>
  )
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================



const ResetHero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden pt-40">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
      
      {/* Background decorations */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-50 blur-xl"></div>
      <div className="absolute top-40 right-20 w-32 h-32 bg-purple-200 rounded-full opacity-30 blur-2xl"></div>
      <div className="absolute bottom-20 left-1/3 w-24 h-24 bg-indigo-200 rounded-full opacity-40 blur-xl"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="text-center">
          <motion.h1 
            className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Reset Your <span className="text-blue-600 mt-2">Password</span>
          </motion.h1>
          
          <motion.p 
            className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Secure your Podacium account. Enter your email to receive a password reset link, or set a new password if you have a valid reset token.
          </motion.p>
          
          <motion.div 
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Secure process
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Encrypted transmission
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Instant support
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const ResetRequestForm: React.FC = () => {
  const { formData, errors, loading, success, apiError, handleChange, handleSubmit } = useResetRequestForm()

  if (success) {
    return (
      <Card className="max-w-md mx-auto p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email</h2>
        <p className="text-gray-600 mb-6">
          We've sent a password reset link to <strong>{formData.email}</strong>. 
          Please check your inbox and follow the instructions to reset your password.
        </p>
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-medium">Didn't receive the email?</p>
            <ul className="mt-2 space-y-1">
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                </svg>
                Check your spam folder
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                </svg>
                Verify you entered the correct email
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                </svg>
                Wait a few minutes and try again
              </li>
            </ul>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Try Another Email
          </Button>
          <Button
            href="/auth/login"
            variant="ghost"
            className="w-full"
          >
            Back to Login
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Your Password</h2>
        <p className="text-gray-600">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(value) => handleChange('email', value)}
          error={errors.email}
          placeholder="Enter your email address"
          required
          autoComplete="email"
        />

        {apiError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {apiError}
            </p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
          className="w-full"
        >
          Send Reset Link
        </Button>

        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-gray-600 text-sm">
            Remember your password?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
              Back to Login
            </Link>
          </p>
        </div>
      </form>
    </Card>
  )
}

const ResetConfirmForm: React.FC<{ token: string }> = ({ token }) => {
  const { formData, errors, loading, success, apiError, tokenValid, tokenChecking, handleChange, handleSubmit } = useResetConfirmForm(token)

  if (tokenChecking) {
    return (
      <Card className="max-w-md mx-auto p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Reset Link</h2>
        <p className="text-gray-600">
          Please wait while we verify your password reset link...
        </p>
      </Card>
    )
  }

  if (!tokenValid) {
    return (
      <Card className="max-w-md mx-auto p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
        <p className="text-gray-600 mb-6">
          This password reset link is invalid or has expired. Please request a new reset link.
        </p>
        <div className="space-y-4">
          <Button
            href="/auth/reset"
            variant="primary"
            className="w-full"
          >
            Request New Reset Link
          </Button>
          <Button
            href="/auth/login"
            variant="ghost"
            className="w-full"
          >
            Back to Login
          </Button>
        </div>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="max-w-md mx-auto p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Password Reset Successful!</h2>
        <p className="text-gray-600 mb-6">
          Your password has been successfully reset. You can now log in with your new password.
        </p>
        <div className="space-y-4">
          <Button
            href="/auth/login"
            variant="primary"
            size="lg"
            className="w-full"
          >
            Continue to Login
          </Button>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
            <p className="font-medium">Security Tip:</p>
            <p className="mt-1">
              Make sure to use a strong, unique password and enable two-factor authentication for added security.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Password</h2>
        <p className="text-gray-600">
          Enter your new password below. Make sure it's strong and secure.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="New Password"
          type="password"
          value={formData.password}
          onChange={(value) => handleChange('password', value)}
          error={errors.password}
          placeholder="Enter your new password"
          required
          autoComplete="new-password"
          tooltip="Password must be at least 8 characters with uppercase, lowercase, and numbers"
        />

        <PasswordStrengthIndicator password={formData.password} />

        <Input
          label="Confirm Password"
          type="password"
          value={formData.confirmPassword}
          onChange={(value) => handleChange('confirmPassword', value)}
          error={errors.confirmPassword}
          placeholder="Confirm your new password"
          required
          autoComplete="new-password"
        />

        {apiError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {apiError}
            </p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
          className="w-full"
        >
          Reset Password
        </Button>

        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-gray-600 text-sm">
            Remember your password?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
              Back to Login
            </Link>
          </p>
        </div>
      </form>
    </Card>
  )
}

const ResetProcess: React.FC = () => {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || null

  return (
    <section className="relative py-16 lg:py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Left sidebar - Process steps */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Reset Process</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    token ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    1
                  </div>
                  <div>
                    <h4 className={`font-medium ${
                      token ? 'text-gray-900' : 'text-blue-600'
                    }`}>
                      Request Reset Link
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Enter your email to receive a secure reset link
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    token ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    2
                  </div>
                  <div>
                    <h4 className={`font-medium ${
                      token ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      Check Your Email
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Click the reset link sent to your email
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    token ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    3
                  </div>
                  <div>
                    <h4 className={`font-medium ${
                      token ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      Set New Password
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Create a strong new password for your account
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Need Help?</h4>
                <p className="text-sm text-blue-700 mb-3">
                  If you're having trouble resetting your password, contact our support team.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  href="/support"
                >
                  Contact Support
                </Button>
              </div>
            </Card>
          </div>
          
          {/* Main content area */}
          <div className="lg:col-span-2">
            {token ? <ResetConfirmForm token={token} /> : <ResetRequestForm />}
          </div>
        </div>
      </div>
    </section>
  )
}

const SecurityFeatures: React.FC = () => {
  const features = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "Bank-Level Security",
      description: "Your password reset process is encrypted with industry-standard security protocols."
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: "Instant Link Expiry",
      description: "Reset links expire automatically after 1 hour for your security."
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: "No Password Storage",
      description: "We never store your password in plain text. All passwords are securely hashed."
    }
  ]

  return (
    <section className="py-16 bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Security is Our Priority</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We implement multiple layers of security to protect your Podacium account and data.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} hover padding="lg" className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4 text-blue-600">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ResetPasswordPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Reset Password | Podacium</title>
        <meta name="description" content="Reset your Podacium account password securely." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-white">
        <Navbar />
        
        <main>
          <ResetHero />
          <ResetProcess />
          <SecurityFeatures />
        </main>

        <Footer />
      </div>
    </>
  )
}