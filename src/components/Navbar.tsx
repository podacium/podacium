'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/services/auth'

// Types
interface NavItem {
  name: string
  href: string
  description?: string
  icon?: string
  badge?: 'New' | 'Popular' | 'Beta'
  children?: NavItem[]
}

interface UserMenuProps {
  user: any
  onClose: () => void
}

// Simple Button component (self-contained)
const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  href, 
  className = '', 
  children, 
  onClick,
  type = 'button'
}: {
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
    outline: 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`

  if (href) {
    return (
      <Link href={href} className={combinedClassName}>
        {children}
      </Link>
    )
  }

  return (
    <button 
      type={type}
      className={combinedClassName} 
      onClick={onClick}
    >
      {children}
    </button>
  )
}


// Sub-components with improved dropdown handling
const UserMenu: React.FC<UserMenuProps> = ({ user, onClose }) => (
  <div 
    className="absolute right-0 top-full mt-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
    onMouseEnter={(e) => e.stopPropagation()}
  >
    <div className="px-4 py-3 border-b border-gray-100">
      <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
      <p className="text-sm text-gray-500 truncate">{user.email}</p>
    </div>
    
    <div className="py-2">
      <Link 
        href="/dashboard" 
        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        onClick={onClose}
      >
        <span className="mr-3">📊</span>
        Dashboard
      </Link>
      <Link 
        href="/profile" 
        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        onClick={onClose}
      >
        <span className="mr-3">👤</span>
        Profile Settings
      </Link>
      <Link 
        href="/billing" 
        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        onClick={onClose}
      >
        <span className="mr-3">💳</span>
        Billing & Plans
      </Link>
    </div>
    
    <div className="py-2 border-t border-gray-100">
      <Link 
        href="/settings" 
        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        onClick={onClose}
      >
        <span className="mr-3">⚙️</span>
        Account Settings
      </Link>
      <Link 
        href="/help" 
        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        onClick={onClose}
      >
        <span className="mr-3">❓</span>
        Help & Support
      </Link>
    </div>
    
    <div className="pt-2 border-t border-gray-100">
      <button 
        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        onClick={() => {
          localStorage.removeItem('user')
          onClose()
        }}
      >
        <span className="mr-3">🚪</span>
        Sign Out
      </button>
    </div>
  </div>
)

const MegaMenu: React.FC<{ item: NavItem; onClose: () => void }> = ({ item, onClose }) => (
  <div 
    className="absolute left-0 top-full mt-0 w-screen max-w-4xl bg-white rounded-xl shadow-2xl border border-gray-200 z-50"
    onMouseEnter={(e) => e.stopPropagation()}
  >
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {item.children?.map((child, index) => (
        <div key={index} className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{child.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center">
                {child.name}
                {child.badge && (
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    child.badge === 'New' ? 'bg-green-100 text-green-800' :
                    child.badge === 'Popular' ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {child.badge}
                  </span>
                )}
              </h3>
              {child.description && (
                <p className="text-sm text-gray-500 mt-1">{child.description}</p>
              )}
            </div>
          </div>
          
          {child.children && (
            <div className="space-y-2">
              {child.children.map((grandchild, grandIndex) => (
                <Link
                  key={grandIndex}
                  href={grandchild.href}
                  className="block text-sm text-gray-600 hover:text-blue-600 transition-colors"
                  onClick={onClose}
                >
                  {grandchild.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
    
    <div className="bg-gray-50 rounded-b-xl px-8 py-6 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-900">Need help getting started?</h4>
          <p className="text-sm text-gray-600">Explore our comprehensive guides and documentation</p>
        </div>
        <Button variant="primary" size="sm" href="/docs">
          View Documentation
        </Button>
      </div>
    </div>
  </div>
)

const navigation: NavItem[] = [
  {
    name: 'BI',
    href: '/bi',
    icon: '📊',
    description: 'Business Intelligence & Analytics',
    children: [
      {
        name: 'Business Intelligence',
        href: '/bi',
        icon: '📈',
        description: 'Advanced analytics and data visualization',
        children: []
      },
      {
        name: 'AI Analytics',
        href: '/ai-analytics',
        icon: '🤖',
        description: 'AI-powered insights and predictions',
        children: []
      },
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: '🖥️',
        description: 'Your personalized dashboard',
        children: []
      },
      {
        name: 'Enterprise',
        href: '/enterprise',
        icon: '🏛️',
        description: 'Solutions for large organizations',
        children: []
      },
      {
        name: 'Notifications',
        href: '/notifications',
        icon: '🔔',
        description: 'Stay updated with alerts',
        children: []
      },
      {
        name: 'Demo',
        href: '/demo',
        icon: '🎬',
        description: 'See our platform in action',
        children: []
      }
    ]
  },
  
  {
    name: 'Learning',
    href: '/learn',
    icon: '📘',
    description: 'Educational Resources & Documentation',
    children: [
      {
        name: 'Learning Center',
        href: '/learn',
        icon: '🎓',
        description: 'Interactive learning experiences',
        children: []
      },
      {
        name: 'Paths',
        href: '/learn/paths',
        icon: '🛤️',
        description: 'Guided learning paths',
        children: []
      },
      {
        name: 'Courses',
        href: '/learn/courses',
        icon: '📖',
        description: 'Individual courses to deepen knowledge',
        children: []
      },
      {
        name: 'Documentation',
        href: '/docs',
        icon: '📚',
        description: 'Comprehensive technical docs',
        children: []
      },
      {
        name: 'Features',
        href: '/features',
        icon: '⭐',
        description: 'Explore platform capabilities',
        children: []
      }
    ]
  },

  {
    name: 'Developer Hub',
    href: '/hub',
    icon: '💻',
    description: 'Tools & Resources for Developers',
    children: [
      {
        name: 'Developer Center',
        href: '/hub',
        icon: '⚡',
        description: 'Tools and resources for developers',
        children: []
      },
      {
        name: 'Partners',
        href: '/partners',
        icon: '🤝',
        description: 'Partner programs and resources',
        children: []
      },
      {
        name: 'Community',
        href: '/community',
        icon: '👥',
        description: 'Connect with other developers',
        children: []
      },
      {
        name: 'Press',
        href: '/press',
        icon: '📰',
        description: 'Media resources and news',
        children: []
      },
      {
        name: 'News',
        href: '/news',
        icon: '📢',
        description: 'Latest company announcements',
        children: []
      },
      {
        name: 'Blog',
        href: '/blog',
        icon: '✍️',
        description: 'Latest news and insights',
        children: []
      }
    ]
  },
  {
    name: 'Pricing',
    href: '/pricing',
    icon: '💰',
    description: 'Plans & Pricing Options',
    children: [
      {
        name: 'Pricing Plans',
        href: '/pricing',
        icon: '💎',
        description: 'Choose the right plan for you',
        children: []
      },
      {
        name: 'Billing & Plans',
        href: '/billing',
        icon: '💳',
        description: 'Manage your subscription',
        children: []
      },
      {
        name: 'System Status',
        href: '/status',
        icon: '🟢',
        description: 'Check our service status',
        children: []
      },
      {
        name: 'Contact',
        href: '/contact',
        icon: '📞',
        description: 'Get in touch with us',
        children: []
      }
    ]
  },
  {
    name: 'About',
    href: '/about',
    icon: '🏢',
    description: 'Company Information & Policies',
    children: [
      {
        name: 'Company',
        href: '/about',
        icon: '🏢',
        description: 'Learn about our company',
        children: []
      },
      {
        name: 'Careers',
        href: '/careers',
        icon: '💼',
        description: 'Join our team',
        children: []
      },
      {
        name: 'Security & Trust',
        href: '/security',
        icon: '🔒',
        description: 'Our commitment to security',
        children: []
      },
      {
        name: 'Legal & Policies',
        href: '/privacy',
        icon: '⚖️',
        description: 'Legal documents and policies',
        children: [
          { name: 'Privacy Policy', href: '/privacy' },
          { name: 'Terms of Service', href: '/terms' },
          { name: 'Cookie Policy', href: '/cookies' },
          { name: 'Affiliate Program', href: '/affiliate' }
        ]
      },
      {
        name: 'Help & Support',
        href: '/help',
        icon: '❓',
        description: 'Get help when you need it',
        children: []
      }
    ]
  }
]

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { user, isAuthenticated, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const navbarRef = useRef<HTMLElement>(null)
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Enhanced scroll effect with parallax
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY
      setScrolled(scrollY > 20)
      
      // Parallax effect for navbar background
      if (navbarRef.current) {
        const opacity = Math.min(scrollY / 200, 0.95)
        navbarRef.current.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`
      }
    }
    
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Enhanced outside click handler with escape key support
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
        setSearchOpen(false)
      }
    }

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null)
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current)
      }
    }
  }, [])

  // Enhanced active path matching with sub-routes
  const isActivePath = (href: string) => {
    if (pathname === href) return true
    if (pathname?.startsWith(href + '/')) return true
    // Special case for dashboard sub-routes
    if (href === '/dashboard' && pathname?.includes('/dashboard')) return true
    return false
  }

  // Enhanced dropdown handlers with animations
  const closeDropdown = () => {
    // Clear any existing timeout
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
    }
    // Set a small delay before closing to allow for mouse movement between button and dropdown
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null)
    }, 150) // 150ms delay
  }

  const openDropdown = (name: string) => {
    // Clear any pending close timeouts
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
    }
    setActiveDropdown(name)
    setSearchOpen(false)
  }

  const toggleSearch = () => {
    setSearchOpen(!searchOpen)
    setActiveDropdown(null)
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <nav
      ref={navbarRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 backdrop-blur-lg bg-white/90 ${
        scrolled 
          ? 'shadow-2xl shadow-indigo-500/10 border-b border-white/20' 
          : 'border-b border-transparent'
      }`}
      aria-label="Primary Navigation"
    >

      {/* Main Navbar Container */}
      <div className="max-w-8xl mx-auto px-8 py-2 flex items-center justify-between">
        
        {/* Enhanced Logo with animation */}
        <Link 
          href="/" 
          aria-label="Podacium Home" 
          className="flex items-center space-x-4 group relative"
        >
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
          </div>
          
          <div className="flex flex-col">
            <h1 className="text-3xl font-black bg-gradient-to-r from-gray-900 via-indigo-700 to-purple-600 bg-clip-text text-transparent select-none leading-tight">
              Podacium
            </h1>
            <p className="text-xs text-gray-500 font-medium tracking-wider select-none bg-gradient-to-r from-gray-500 to-purple-500 bg-clip-text text-transparent">
              AI-POWERED PLATFORM
            </p>
          </div>
        </Link>

        {/* Enhanced Desktop Navigation */}
        <div className="hidden xl:flex items-center space-x-1 flex-1 justify-center mx-12">
          <ul className="flex items-center space-x-1" role="menubar" aria-label="Main menu">
            {navigation.map((item) => (
              <li
                key={item.name}
                className="relative"
                onMouseEnter={() => item.children && openDropdown(item.name)}
                onMouseLeave={() => item.children && closeDropdown()}
                role="none"
              >
                {item.children ? (
                  <>
                    <button
                      aria-haspopup="true"
                      aria-expanded={activeDropdown === item.name}
                      className={`group relative flex items-center space-x-2 px-4 py-2 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                        isActivePath(item.href)
                          ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/40'
                          : 'text-gray-700 hover:text-indigo-700 hover:bg-white/80 hover:shadow-lg'
                      } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.name}</span>
                      {item.badge && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full shadow-sm">
                          {item.badge}
                        </span>
                      )}
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${
                          activeDropdown === item.name ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {activeDropdown === item.name && (
                      <div
                        role="menu"
                        aria-label={item.name}
                        className="absolute left-1/2 transform -translate-x-1/2 mt-1 w-80 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-500/20 border border-white/20 p-2 z-50 animate-in fade-in-0 zoom-in-95"
                        onMouseEnter={() => openDropdown(item.name)}
                        onMouseLeave={closeDropdown}
                      >
                        <div className="grid gap-1">
                          {item.children.map((child) => (
                            <Link
                              key={`${child.name}-${child.href}`}
                              href={child.href}
                              className="group flex items-start space-x-4 p-3 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200 border border-transparent hover:border-indigo-100"
                              onClick={closeDropdown}
                            >
                              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                                <span className="text-lg">{child.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                    {child.name}
                                  </p>
                                  {child.badge && (
                                    <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full">
                                      {child.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">{child.description}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`group relative flex items-center space-x-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 ${
                      isActivePath(item.href)
                        ? 'text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/40'
                        : 'text-gray-700 hover:text-indigo-700 hover:bg-white/80 hover:shadow-lg'
                    } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                    role="menuitem"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Enhanced Desktop Auth & Search */}
        <div className="hidden xl:flex items-center space-x-4">
          {isAuthenticated && user ? (
            <>
              {/* Notifications */}
              <div className="relative">
                <button
                  className="relative w-12 h-12 flex items-center justify-center bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group"
                  aria-label="Notifications"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform duration-200">🔔</span>
                  <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-pink-600 animate-pulse shadow-sm"></span>
                </button>
              </div>

              {/* Enhanced User Menu */}
              <div
                className="relative"
                onMouseEnter={() => openDropdown('user')}
                onMouseLeave={() => closeDropdown()}
              >
                <button
                  aria-haspopup="true"
                  aria-expanded={activeDropdown === 'user'}
                  className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-white/80 hover:shadow-lg transition-all duration-300 group border border-transparent hover:border-gray-200"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
                      {user.fullName?.[0] || user.email?.[0] || 'U'}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full border-2 border-white shadow-sm"></div>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-gray-900 text-sm">
                      {user.fullName || 'User'}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{user.role?.toLowerCase() || 'Member'}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                      activeDropdown === 'user' ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {activeDropdown === 'user' && (
                  <div
                    role="menu"
                    aria-label="User menu"
                    className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-500/20 border border-white/20 p-6 z-50 animate-in fade-in-0 zoom-in-95"
                    onMouseEnter={() => openDropdown('user')}
                    onMouseLeave={closeDropdown}
                  >
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                        {user.fullName?.[0] || user.email?.[0] || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-lg truncate">
                          {user.fullName || 'User'}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-full capitalize">
                            {user.role?.toLowerCase() || 'member'}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">Member</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-3 text-center border border-indigo-100">
                        <div className="text-2xl font-bold text-indigo-700">0</div>
                        <div className="text-xs text-gray-600">Projects</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 text-center border border-green-100">
                        <div className="text-2xl font-bold text-green-700">0</div>
                        <div className="text-xs text-gray-600">Courses</div>
                      </div>
                    </div>

                    <nav className="space-y-2">
                      {[
                        { icon: '📊', label: 'Dashboard', href: '/dashboard' },
                        { icon: '👤', label: 'Profile', href: '/profile' },
                        { icon: '⚙️', label: 'Settings', href: '/settings' },
                        { icon: '🛠️', label: 'Workspace', href: '/workspace' },
                        { icon: '💳', label: 'Billing', href: '/billing' },
                        { icon: '❓', label: 'Help & Support', href: '/help' }
                      ].map((item) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200 group"
                          onClick={closeDropdown}
                        >
                          <span className="text-lg">{item.icon}</span>
                          <span className="font-medium text-gray-700 group-hover:text-indigo-700">
                            {item.label}
                          </span>
                        </Link>
                      ))}
                    </nav>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 rounded-xl font-semibold text-gray-700 transition-all duration-200 shadow-sm"
                      >
                        <span>🚪</span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="px-6 py-3 text-gray-700 hover:text-indigo-700 font-semibold rounded-2xl hover:bg-white/80 hover:shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Sign In
              </Link>

              <Link
                href="/auth/signup"
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/50 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Get Started Free
              </Link>
            </>
          )}
        </div>

        {/* Enhanced Mobile Hamburger */}
        <button
          className="xl:hidden w-12 h-12 flex items-center justify-center bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group"
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <div className="relative w-6 h-6">
            <span
              className={`absolute top-1/2 left-1/2 w-6 h-0.5 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                isMenuOpen ? 'rotate-45' : '-translate-y-2'
              }`}
            ></span>
            <span
              className={`absolute top-1/2 left-1/2 w-6 h-0.5 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                isMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            ></span>
            <span
              className={`absolute top-1/2 left-1/2 w-6 h-0.5 bg-gray-700 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                isMenuOpen ? '-rotate-45' : 'translate-y-2'
              }`}
            ></span>
          </div>
        </button>
      </div>

      {/* Enhanced Mobile Menu */}
      {isMenuOpen && (
        <div className="xl:hidden bg-white/95 backdrop-blur-xl border-t border-white/20 shadow-2xl shadow-indigo-500/20">
          <nav className="max-w-8xl mx-auto px-8 py-6" aria-label="Mobile Navigation">
            
            {/* Mobile Search */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Search content..."
                className="w-full pl-12 pr-4 py-4 bg-white/80 backdrop-blur-sm border border-indigo-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-lg"
              />
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <span className="text-xl text-gray-500">🔍</span>
              </div>
            </div>

            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name} className="border-b border-gray-100 last:border-b-0">
                  {item.children ? (
                    <details className="group" open={activeDropdown === item.name}>
                      <summary
                        onClick={() =>
                          setActiveDropdown(activeDropdown === item.name ? null : item.name)
                        }
                        className="flex justify-between items-center cursor-pointer py-4 text-gray-900 font-semibold text-base hover:text-indigo-700 transition-colors duration-200 list-none"
                      >
                        <span className="flex items-center space-x-3">
                          <span className="text-xl">{item.icon}</span>
                          <span>{item.name}</span>
                          {item.badge && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </span>
                        <svg
                          className="w-5 h-5 text-gray-500 transition-transform duration-200 group-open:rotate-180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>

                      <ul className="mt-1 pl-11 space-y-3 pb-3">
                        {item.children.map((child) => (
                          <li key={child.name}>
                            <Link
                              href={child.href}
                              className="flex items-center space-x-3 py-2 text-gray-600 hover:text-indigo-700 transition-colors duration-200 group"
                              onClick={() => setIsMenuOpen(false)}
                            >
                              <span className="text-lg">{child.icon}</span>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{child.name}</span>
                                  {child.badge && (
                                    <span className="px-1.5 py-0.5 text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full">
                                      {child.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{child.description}</p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center space-x-3 py-4 text-gray-900 font-semibold hover:text-indigo-700 transition-colors duration-200 group"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <div className="flex items-center space-x-2">
                        <span>{item.name}</span>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {/* Enhanced Mobile Auth Section */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              {isAuthenticated && user ? (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {user.fullName?.[0] || user.email?.[0] || 'U'}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full border-2 border-white shadow-sm"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-lg truncate">
                        {user.fullName || 'User'}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-full capitalize">
                          {user.role?.toLowerCase() || 'member'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/dashboard"
                      className="flex items-center justify-center space-x-2 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/40 hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span>📊</span>
                      <span>Dashboard</span>
                    </Link>
                    <button
                      className="flex items-center justify-center space-x-2 py-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-2xl hover:border-gray-400 hover:shadow-lg transition-all duration-300"
                      onClick={() => {
                        handleLogout()
                        setIsMenuOpen(false)
                      }}
                    >
                      <span>🚪</span>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/auth/login"
                    className="flex items-center justify-center space-x-2 py-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-2xl hover:border-gray-400 hover:shadow-lg transition-all duration-300 text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span>🔑</span>
                    <span>Sign In</span>
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="flex items-center justify-center space-x-2 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/40 hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span>🚀</span>
                    <span>Get Started</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Enhanced Mobile Additional Links */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <div className="grid grid-cols-2 gap-2 text-gray-600 text-sm">
                {[
                  { icon: '💬', label: 'Help Center', href: '/help' },
                  { icon: '📚', label: 'Documentation', href: '/docs' },
                  { icon: '✍️', label: 'Blog', href: '/blog' },
                  { icon: '📊', label: 'System Status', href: '/status' },
                  { icon: '🏢', label: 'About Us', href: '/about' },
                  { icon: '📞', label: 'Contact', href: '/contact' },
                  { icon: '🔒', label: 'Privacy', href: '/privacy' },
                  { icon: '📝', label: 'Terms', href: '/terms' }
                ].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="flex items-center space-x-2 py-2 hover:text-indigo-700 transition-colors duration-200 group"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="text-base">{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Social Links */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <div className="flex items-center justify-center space-x-6">
                {['Twitter', 'LinkedIn', 'GitHub', 'Discord'].map((social) => (
                  <button
                    key={social}
                    className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group"
                    aria-label={social}
                  >
                    <span className="text-xl group-hover:scale-110 transition-transform duration-200">
                      {social === 'Twitter' ? '🐦' : 
                       social === 'LinkedIn' ? '💼' : 
                       social === 'GitHub' ? '💻' : '💬'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}
    </nav>
  )
}

export default Navbar