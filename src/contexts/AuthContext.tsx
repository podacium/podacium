'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { authService, User } from '@/services/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    try {
      const token = authService.getAccessToken()
      
      if (token && !authService.isTokenExpired()) {
        // Token is valid, fetch user data
        const userData = await authService.getCurrentUser()
        setUser(userData)
        setIsAuthenticated(true)
        
        // Store user in localStorage for quick access
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(userData))
        }
      } else if (token) {
        // Token exists but might be expired, try to refresh
        try {
          await authService.refreshToken()
          const userData = await authService.getCurrentUser()
          setUser(userData)
          setIsAuthenticated(true)
          
          if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(userData))
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens
          await authService.logout()
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      await authService.logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      const authData = await authService.login({ email, password })
      const userData = await authService.getCurrentUser()
      
      setUser(userData)
      setIsAuthenticated(true)
      
      // Store user in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(userData))
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await authService.logout()
      setUser(null)
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser()
      setUser(userData)
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(userData))
      }
    } catch (error) {
      console.error('Refresh user error:', error)
      throw error
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}