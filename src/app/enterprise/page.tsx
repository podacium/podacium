/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { motion } from 'framer-motion'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface EnterpriseFeature {
  id: string
  title: string
  description: string
  icon: string
}

interface CaseStudy {
  id: string
  company: string
  logo: string
  industry: string
  challenge: string
  solution: string
  results: string[]
  quote: string
  author: string
  role: string
  metrics: Array<{
    value: string
    label: string
    change: string
  }>
}

interface PricingTier {
  id: string
  name: string
  description: string
  price: {
    monthly: number
    yearly: number
  }
  features: string[]
  limitations: string[]
  cta: string
  popular: boolean
  highlighted: boolean
  sla: string
  support: string
  users: string
}

// =============================================================================
// MOCK DATA - ENTERPRISE SPECIFIC
// =============================================================================

const ENTERPRISE_FEATURES: EnterpriseFeature[] = [
  {
    id: '1',
    title: 'Advanced Security & Compliance',
    description: 'Enterprise-grade security with SOC 2 Type II, GDPR, HIPAA compliance, and advanced threat protection.',
    icon: '🛡️'
  },
  {
    id: '2',
    title: 'Custom AI Model Training',
    description: 'Train custom machine learning models on your proprietary data with dedicated compute resources.',
    icon: '🤖'
  },
  {
    id: '3',
    title: 'Enterprise Single Sign-On',
    description: 'Seamless integration with your existing identity providers including SAML, OAuth, and Active Directory.',
    icon: '🔐'
  },
  {
    id: '4',
    title: 'Real-time Collaboration Suite',
    description: 'Advanced collaboration tools for teams including real-time editing, comments, and version control.',
    icon: '👥'
  },
  {
    id: '5',
    title: 'Custom Data Integration',
    description: 'Connect to any data source with custom connectors, ETL pipelines, and data transformation tools.',
    icon: '🔗'
  },
  {
    id: '6',
    title: 'Dedicated Infrastructure',
    description: 'Isolated, dedicated infrastructure with guaranteed resources and custom scaling configurations.',
    icon: '🏢'
  },
  {
    id: '7',
    title: '24/7 Premium Support',
    description: 'Round-the-clock support with dedicated account managers and 15-minute response time SLAs.',
    icon: '🎯'
  },
  {
    id: '8',
    title: 'Advanced Analytics Dashboard',
    description: 'Customizable dashboards with advanced analytics, predictive modeling, and automated reporting.',
    icon: '📊'
  },
  {
    id: '9',
    title: 'Custom Workflow Automation',
    description: 'Build custom workflows and automation rules tailored to your specific business processes.',
    icon: '⚡'
  },
  {
    id: '10',
    title: 'Enterprise API Access',
    description: 'Full API access with rate limiting, custom endpoints, and dedicated API gateway.',
    icon: '🔌'
  },
  {
    id: '11',
    title: 'Custom Branding & White-labeling',
    description: 'Complete white-label solution with custom branding, domains, and user interface customization.',
    icon: '🎨'
  },
  {
    id: '12',
    title: 'Advanced Data Governance',
    description: 'Comprehensive data governance framework with lineage tracking, quality scoring, and compliance reporting.',
    icon: '📋'
  },
  {
    id: '13',
    title: 'Custom Training & Onboarding',
    description: 'Tailored training programs and dedicated onboarding specialists for your team.',
    icon: '🎓'
  },
  {
    id: '14',
    title: 'Multi-region Deployment',
    description: 'Deploy across multiple regions with data residency compliance and geo-redundant backups.',
    icon: '🌍'
  },
  {
    id: '15',
    title: 'Custom SLA Agreements',
    description: 'Negotiable service level agreements with financial guarantees and performance commitments.',
    icon: '📝'
  }
]

const ENTERPRISE_CASE_STUDIES: CaseStudy[] = [
  {
    id: '1',
    company: 'GlobalTech Solutions',
    logo: '/logos/globaltech.svg',
    industry: 'Technology',
    challenge: 'Needed to unify data from 15+ sources and provide real-time analytics to 500+ users across 20 countries.',
    solution: 'Implemented Podacium Enterprise with custom data connectors, advanced security protocols, and multi-region deployment.',
    results: [
      '85% reduction in reporting time',
      '40% improvement in data accuracy',
      '99.9% platform uptime',
      '$2.3M annual cost savings'
    ],
    quote: 'Podacium transformed how we leverage data across our global organization. The enterprise features provided the security and scalability we needed.',
    author: 'Sarah Chen',
    role: 'Chief Data Officer',
    metrics: [
      { value: '85%', label: 'Faster Reporting', change: 'improvement' },
      { value: '500+', label: 'Active Users', change: 'growth' },
      { value: '99.9%', label: 'Uptime', change: 'reliability' }
    ]
  },
  {
    id: '2',
    company: 'FinSecure Bank',
    logo: '/logos/finsecure.svg',
    industry: 'Finance',
    challenge: 'Required HIPAA and SOC 2 compliance while processing sensitive financial data for risk analysis.',
    solution: 'Deployed Podacium with advanced encryption, custom compliance frameworks, and dedicated infrastructure.',
    results: [
      'Achieved HIPAA compliance in 4 weeks',
      'Reduced risk analysis time by 70%',
      'Zero security incidents',
      '40% faster regulatory reporting'
    ],
    quote: 'The security and compliance features gave us the confidence to move our most sensitive workloads to Podacium.',
    author: 'Michael Rodriguez',
    role: 'CISO',
    metrics: [
      { value: '100%', label: 'Compliance', change: 'achieved' },
      { value: '70%', label: 'Time Saved', change: 'reduction' },
      { value: '0', label: 'Security Incidents', change: 'maintained' }
    ]
  },
  {
    id: '3',
    company: 'HealthCare Plus',
    logo: '/logos/healthcare-plus.svg',
    industry: 'Healthcare',
    challenge: 'Needed to process patient data securely while enabling collaborative research across multiple hospitals.',
    solution: 'Implemented Podacium with custom HIPAA compliance modules, advanced collaboration tools, and audit trails.',
    results: [
      'Enabled secure collaboration across 15 hospitals',
      'Reduced research data processing time by 60%',
      'Maintained 100% compliance with healthcare regulations',
      'Accelerated research outcomes by 3x'
    ],
    quote: 'Podacium enabled us to collaborate securely while maintaining the highest standards of patient data protection.',
    author: 'Dr. Emily Watson',
    role: 'Head of Research',
    metrics: [
      { value: '60%', label: 'Processing Time', change: 'reduction' },
      { value: '15', label: 'Hospitals Connected', change: 'growth' },
      { value: '3x', label: 'Research Speed', change: 'acceleration' }
    ]
  },
  {
    id: '4',
    company: 'Retail Giant Inc.',
    logo: '/logos/retail-giant.svg',
    industry: 'Retail',
    challenge: 'Required real-time inventory analytics across 500+ stores with predictive demand forecasting.',
    solution: 'Deployed Podacium with custom ML models, real-time data streaming, and advanced visualization dashboards.',
    results: [
      'Reduced inventory costs by 25%',
      'Improved demand forecasting accuracy by 40%',
      'Enabled real-time inventory tracking',
      'Increased sales through better stock management'
    ],
    quote: 'The predictive analytics and real-time capabilities transformed our supply chain operations.',
    author: 'Robert Kim',
    role: 'VP of Operations',
    metrics: [
      { value: '25%', label: 'Cost Reduction', change: 'savings' },
      { value: '40%', label: 'Forecast Accuracy', change: 'improvement' },
      { value: '500+', label: 'Stores Connected', change: 'scale' }
    ]
  },
  {
    id: '5',
    company: 'EduTech Global',
    logo: '/logos/edutech-global.svg',
    industry: 'Education',
    challenge: 'Required scalable platform for 100,000+ students with personalized learning paths and progress tracking.',
    solution: 'Deployed Podacium with custom learning analytics, AI-powered recommendations, and scalable infrastructure.',
    results: [
      'Supported 100,000+ concurrent users',
      'Personalized learning paths for each student',
      '95% student satisfaction rate',
      'Reduced administrative overhead by 50%'
    ],
    quote: 'The scalability and AI capabilities allowed us to deliver personalized education at an unprecedented scale.',
    author: 'Dr. Lisa Zhang',
    role: 'Chief Learning Officer',
    metrics: [
      { value: '100K+', label: 'Concurrent Users', change: 'scale' },
      { value: '95%', label: 'Satisfaction Rate', change: 'quality' },
      { value: '50%', label: 'Admin Overhead', change: 'reduction' }
    ]
  },
  {
    id: '6',
    company: 'Energy Solutions Co.',
    logo: '/logos/energy-solutions.svg',
    industry: 'Energy',
    challenge: 'Needed to optimize energy distribution across smart grid with real-time consumption analytics.',
    solution: 'Implemented Podacium with real-time data processing, predictive analytics, and custom visualization tools.',
    results: [
      'Optimized energy distribution by 18%',
      'Reduced peak load by 25%',
      'Real-time fault detection',
      'Improved customer satisfaction scores'
    ],
    quote: 'Podacium provided the real-time analytics we needed to optimize our smart grid operations.',
    author: 'Maria Garcia',
    role: 'Smart Grid Director',
    metrics: [
      { value: '18%', label: 'Distribution Optimization', change: 'improvement' },
      { value: '25%', label: 'Peak Load Reduction', change: 'reduction' },
      { value: 'Real-time', label: 'Fault Detection', change: 'capability' }
    ]
  },
  {
    id: '7',
    company: 'Logistics Pro',
    logo: '/logos/logistics-pro.svg',
    industry: 'Logistics',
    challenge: 'Required route optimization and real-time tracking for 5,000+ delivery vehicles across North America.',
    solution: 'Deployed Podacium with custom route optimization algorithms, real-time GPS tracking, and predictive ETA.',
    results: [
      'Reduced fuel costs by 20%',
      'Improved on-time delivery to 98.5%',
      'Real-time vehicle tracking',
      'Optimized route planning'
    ],
    quote: 'The route optimization and real-time tracking features revolutionized our logistics operations.',
    author: 'David Thompson',
    role: 'Logistics Director',
    metrics: [
      { value: '20%', label: 'Fuel Cost Reduction', change: 'savings' },
      { value: '98.5%', label: 'On-time Delivery', change: 'improvement' },
      { value: '5,000+', label: 'Vehicles Tracked', change: 'scale' }
    ]
  },
  {
    id: '8',
    company: 'Media Network Inc.',
    logo: '/logos/media-network.svg',
    industry: 'Media',
    challenge: 'Needed content personalization and audience analytics for 10M+ monthly users across multiple platforms.',
    solution: 'Implemented Podacium with advanced user segmentation, content recommendation engines, and cross-platform analytics.',
    results: [
      'Increased user engagement by 45%',
      'Improved content discovery',
      'Personalized user experiences',
      'Cross-platform audience insights'
    ],
    quote: 'Podacium enabled us to deliver personalized content experiences that dramatically increased engagement.',
    author: 'Sophie Martin',
    role: 'Head of Product',
    metrics: [
      { value: '45%', label: 'Engagement Increase', change: 'growth' },
      { value: '10M+', label: 'Monthly Users', change: 'scale' },
      { value: 'Personalized', label: 'User Experience', change: 'quality' }
    ]
  },
  {
    id: '9',
    company: 'Insurance Group Ltd.',
    logo: '/logos/insurance-group.svg',
    industry: 'Insurance',
    challenge: 'Required fraud detection and risk assessment automation while maintaining regulatory compliance.',
    solution: 'Deployed Podacium with custom ML models for fraud detection, automated underwriting, and compliance reporting.',
    results: [
      'Reduced fraud losses by 60%',
      'Automated 80% of underwriting',
      'Real-time risk assessment',
      'Maintained full compliance'
    ],
    quote: 'The AI-powered fraud detection and automation capabilities transformed our risk management processes.',
    author: 'Ahmed Hassan',
    role: 'Chief Risk Officer',
    metrics: [
      { value: '60%', label: 'Fraud Reduction', change: 'improvement' },
      { value: '80%', label: 'Automation Rate', change: 'efficiency' },
      { value: 'Real-time', label: 'Risk Assessment', change: 'capability' }
    ]
  }
]

const ENTERPRISE_PRICING: PricingTier[] = [
  {
    id: 'business',
    name: 'Business',
    description: 'For growing teams needing advanced features and security',
    price: {
      monthly: 199,
      yearly: 1990
    },
    features: [
      'Up to 50 users',
      'Advanced analytics',
      'Basic security features',
      'Standard support',
      'API access',
      'Custom dashboards'
    ],
    limitations: [
      'Limited custom integrations',
      'Standard compliance',
      'Business hours support'
    ],
    cta: 'Start Free Trial',
    popular: false,
    highlighted: false,
    sla: '99.5%',
    support: 'Business hours',
    users: 'Up to 50'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations requiring full platform capabilities and security',
    price: {
      monthly: 499,
      yearly: 4990
    },
    features: [
      'Unlimited users',
      'Advanced security & compliance',
      'Custom integrations',
      '24/7 premium support',
      'Dedicated account manager',
      'Custom SLA agreements',
      'White-label options',
      'Advanced analytics'
    ],
    limitations: [
      'Minimum 12-month commitment',
      'Custom pricing for 500+ users'
    ],
    cta: 'Contact Sales',
    popular: true,
    highlighted: true,
    sla: '99.9%',
    support: '24/7 with 15-min response',
    users: 'Unlimited'
  },
  {
    id: 'enterprise-plus',
    name: 'Enterprise Plus',
    description: 'For large enterprises with complex requirements and custom needs',
    price: {
      monthly: 999,
      yearly: 9990
    },
    features: [
      'Everything in Enterprise',
      'Dedicated infrastructure',
      'Custom AI model training',
      'On-premise deployment option',
      'Custom feature development',
      'Executive business reviews',
      'Advanced training programs',
      'Multi-region deployment'
    ],
    limitations: [
      'Custom contract terms',
      'Enterprise security review required'
    ],
    cta: 'Schedule Consultation',
    popular: false,
    highlighted: false,
    sla: '99.95%',
    support: '24/7 with 5-min response',
    users: 'Unlimited + custom'
  }
]

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
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
      <Link href={href} className={classes} onClick={onClick}>
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
      type={typeof type !== 'undefined' ? type : 'button'}
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

const Card: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
}> = ({ children, className = '', hover = false }) => {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${hover ? 'hover:shadow-xl transition-all duration-300 hover:border-blue-200' : 'shadow-lg'} ${className}`}>
      {children}
    </div>
  )
}

const Section: React.FC<{
  children: React.ReactNode
  className?: string
  id?: string
}> = ({ children, className = '', id }) => {
  return (
    <section id={id} className={`py-20 lg:py-28 ${className}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  )
}

// =============================================================================
// PAGE COMPONENTS
// =============================================================================

const HeroSection: React.FC = () => {
  const handleScrollToPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById('pricing');
    if (!element) return;

    const yOffset = -80;
    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const elements = document.querySelectorAll('.parallax-element');
    elements.forEach((element) => {
      const speed = element.getAttribute('data-speed') || 0.02;
      const x = (window.innerWidth - clientX * Number(speed)) / 100;
      const y = (window.innerHeight - clientY * Number(speed)) / 100;
      (element as HTMLElement).style.transform = `translateX(${x}px) translateY(${y}px)`;
    });
  };

  return (
    <Section 
      className="relative mt-5 pt-32 pb-2 px-6 sm:px-10 lg:px-16 bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 text-white overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white/80 to-transparent z-20 pointer-events-none"></div>
      <div onMouseMove={handleMouseMove}>
        {/* Enhanced Multi-layer Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Primary gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-indigo-900/90 to-purple-900/95 backdrop-blur-[1px] animate-gradient-shift"></div>
          
          {/* Dynamic floating orbs */}
          <div className="absolute top-0 left-0 w-full h-full">
            <div 
              className="parallax-element absolute -top-16 -left-16 w-60 h-60 bg-gradient-to-r from-blue-400/20 to-cyan-500/20 rounded-full animate-[float_12s_ease-in-out_infinite]"
              data-speed="0.03"
            ></div>
            <div 
              className="parallax-element absolute top-1/4 -right-20 w-48 h-48 bg-gradient-to-r from-cyan-400/15 to-blue-500/15 rounded-full animate-[float_10s_ease-in-out_infinite_1.5s]"
              data-speed="0.02"
            ></div>
            <div 
              className="parallax-element absolute -bottom-20 -left-8 w-72 h-72 bg-gradient-to-r from-indigo-400/15 to-purple-600/15 rounded-full animate-[float_14s_ease-in-out_infinite_2s]"
              data-speed="0.04"
            ></div>
          </div>
          
          {/* Enhanced grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_75%_45%_at_50%_50%,black_40%,transparent_70%)] animate-grid-flow"></div>
          
          {/* Subtle noise texture */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url%28%23noise%29%22 opacity=%220.02%22/%3E%3C/svg%3E')]"></div>
        </div>

        {/* Light fade overlay for navbar spacing */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/50 to-transparent z-0 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Enhanced Content Section */}
            <div className="space-y-8">
              {/* Trust Badge with Animation */}
              <div className="space-y-4">
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-sm shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer group">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse group-hover:animate-ping"></span>
                  Trusted by Fortune 500 companies worldwide
                </div>
                
                {/* Enhanced Headline */}
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  Enterprise-Grade
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-cyan-200 to-indigo-200 animate-text-shimmer">
                    AI Solutions
                  </span>
                </h1>
                
                {/* Enhanced Description */}
                <p className="text-xl text-blue-100 leading-relaxed max-w-2xl">
                  Scale your business with secure, compliant, and powerful AI infrastructure. 
                  <span className="block mt-2 text-blue-200/90">
                    Built for enterprises with mission-critical requirements and global scale.
                  </span>
                </p>
              </div>

              {/* Enhanced CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="group relative bg-white !text-blue-900 border border-white hover:bg-blue-900 hover:!text-white ..."
                  href="../../demo"
                >
                  <div className="button-shine absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <div className="relative flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Schedule Enterprise Demo
                  </div>
                </Button>

                <Button
                  size="lg"
                  className="group border border-white/60 text-white bg-transparent hover:bg-white/10 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  href="#pricing"
                  onClick={handleScrollToPricing}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
                    </svg>
                    View Pricing Plans
                  </div>
                </Button>
              </div>

              {/* Enhanced Stats Grid */}
              <div className="grid grid-cols-3 gap-8 pt-8">
                {[
                  { value: '99.9%', label: 'Uptime SLA', color: 'from-green-400 to-emerald-400' },
                  { value: '24/7', label: 'Premium Support', color: 'from-blue-400 to-cyan-400' },
                  { value: 'SOC 2', label: 'Compliant', color: 'from-purple-400 to-indigo-400' }
                ].map((stat, index) => (
                  <div 
                    key={index}
                    className="text-center transform transition-all duration-300 hover:scale-110 cursor-pointer group"
                  >
                    <div className={`text-2xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent group-hover:animate-pulse`}>
                      {stat.value}
                    </div>
                    <div className="text-blue-200 text-sm group-hover:text-white transition-colors">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enhanced Features Card */}
            <div className="relative">
              <div className="relative z-10 bg-white/10 backdrop-blur-2xl rounded-2xl p-8 border border-white/20 shadow-2xl transform perspective-1000 hover:rotate-y-2 transition-all duration-500 hover:shadow-3xl">
                {/* Card Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-white/30 to-white/10 rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
                        Enterprise AI Platform
                      </h3>
                      <p className="text-xs text-blue-200/80 font-medium">Powered by Advanced Intelligence</p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* Enhanced Features List */}
                <div className="grid gap-4">
                  {[
                    { text: 'Real-time AI Processing', color: 'bg-green-400', icon: '⚡' },
                    { text: 'Advanced Security Controls', color: 'bg-blue-400', icon: '🔒' },
                    { text: 'Custom Model Training', color: 'bg-purple-400', icon: '🧠' },
                    { text: 'Enterprise Integrations', color: 'bg-yellow-400', icon: '🔗' }
                  ].map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-center space-x-4 p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group"
                    >
                      <div className="relative">
                        <div className={`w-3 h-3 ${feature.color} rounded-full animate-pulse group-hover:animate-ping`}></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm opacity-70 group-hover:opacity-100 transition-opacity">{feature.icon}</span>
                        <div className="text-white group-hover:text-blue-100 transition-colors">{feature.text}</div>
                      </div>
                      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-white/20">
                  {[
                    { value: '256-bit', label: 'Encryption', color: 'from-blue-300 to-cyan-300' },
                    { value: '50ms', label: 'Latency', color: 'from-green-300 to-emerald-300' },
                    { value: '99.99%', label: 'Accuracy', color: 'from-purple-300 to-pink-300' }
                  ].map((metric, index) => (
                    <div 
                      key={index}
                      className="text-center transform transition-all duration-300 hover:scale-110 cursor-pointer group"
                    >
                      <div className={`text-sm font-bold bg-gradient-to-r ${metric.color} bg-clip-text text-transparent`}>
                        {metric.value}
                      </div>
                      <div className="text-[10px] text-blue-200/80 group-hover:text-white transition-colors">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Background Effects */}
              <div className="parallax-element absolute -z-10 top-4 -right-4 w-24 h-24 bg-gradient-to-r from-blue-400/15 to-cyan-500/15 rounded-full blur-2xl animate-pulse" data-speed="0.02"></div>
              <div className="parallax-element absolute -z-10 -bottom-4 -left-4 w-20 h-20 bg-gradient-to-r from-indigo-400/10 to-purple-500/10 rounded-full blur-2xl animate-pulse delay-1000" data-speed="0.03"></div>
            </div>
          </div>
        </div>

        {/* Additional CSS Animations */}
        <style>{`
          @keyframes gradient-shift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes grid-flow {
            0% { background-position: 0 0; }
            100% { background-position: 60px 60px; }
          }
          @keyframes text-shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          .animate-gradient-shift {
            background-size: 200% 200%;
            animation: gradient-shift 8s ease infinite;
          }
          .animate-grid-flow {
            animation: grid-flow 20s linear infinite;
          }
          .animate-text-shimmer {
            background-size: 200% auto;
            animation: text-shimmer 3s ease-in-out infinite;
          }
          .perspective-1000 {
            perspective: 1000px;
          }
          .button-shine {
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          }
        `}</style>
      </div>
    </Section>
  );
};

const FeaturesSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all')

  return (
    <Section id="features" className="bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            Enterprise-Grade Features
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to scale AI across your organization with confidence
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {ENTERPRISE_FEATURES.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card hover className="h-full p-4">
                <div className="flex flex-col h-full">
                  <div className="text-2xl mb-2">{feature.icon}</div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 flex-grow">
                    {feature.description}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  )
}



const CaseStudiesSection = () => {
  const [activeIndustry, setActiveIndustry] = React.useState('Education')
  const [selectedStudy, setSelectedStudy] = React.useState<CaseStudy | null>(null)

  const industries = [
    'Technology',
    'Finance',
    'Healthcare',
    'Retail',
    'Education',
    'Energy',
    'Logistics',
    'Media',
    'Insurance',

  ]
  const filteredCaseStudies = ENTERPRISE_CASE_STUDIES.filter(
    (study) => study.industry === activeIndustry
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, study: CaseStudy) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedStudy(study)
    }
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setSelectedStudy(null)
    }
  }

  return (
    <section id="case-studies" className="bg-gradient-to-br from-gray-900 to-blue-900 text-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="text-center max-w-4xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            Enterprise Success Stories
          </h2>
          <p className="text-lg md:text-xl text-blue-200 leading-relaxed">
            Learn how global leaders are scaling innovation and performance with Podacium Enterprise.
          </p>
        </header>

        {/* Industry Filter */}
        <nav
          aria-label="Filter case studies by industry"
          className="flex flex-wrap justify-center gap-3 mb-16"
        >
          {industries.map((industry) => {
            const isActive = activeIndustry === industry
            return (
              <button
                key={industry}
                onClick={() => setActiveIndustry(industry)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveIndustry(industry)
                  }
                }}
                className={`
                  px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-900
                  ${
                    isActive
                      ? 'bg-white text-blue-900 shadow-lg transform scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                  }
                `}
                aria-pressed={isActive}
              >
                {industry}
              </button>
            )
          })}
        </nav>

        {/* Case Studies Grid */}
        <div className="flex flex-col items-center space-y-12">
          {filteredCaseStudies.length > 0 ? (
            filteredCaseStudies.map((study, index) => (
              <div
                key={study.id}
                className="relative group w-full max-w-6xl bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-3xl hover:scale-[1.02] focus-within:scale-[1.02] overflow-hidden cursor-pointer"
                tabIndex={0}
                onClick={() => setSelectedStudy(study)}
                onKeyDown={(e) => handleKeyDown(e, study)}
                role="button"
                aria-label={`View case study for ${study.company} in ${study.industry}`}
              >
                <div className="p-8 md:p-12 flex flex-col space-y-8">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      {study.logo ? (
                        <img
                          src={study.logo}
                          alt={`${study.company} logo`}
                          className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-contain bg-white/20 p-2"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-500 rounded-xl flex items-center justify-center text-lg md:text-xl font-bold text-white select-none">
                          {study.company.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-white text-lg">{study.company}</p>
                        <p className="text-blue-200 text-sm">{study.industry}</p>
                      </div>
                    </div>
                    <div className="text-right text-blue-200 text-sm">
                      <p className="font-medium">{study.author}</p>
                      <p>{study.role}</p>
                    </div>
                  </div>

                  {/* Challenge + Solution */}
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="font-semibold text-white mb-3 text-lg">Challenge</h3>
                      <p className="text-blue-100 leading-relaxed">{study.challenge}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-3 text-lg">Solution</h3>
                      <p className="text-blue-100 leading-relaxed">{study.solution}</p>
                    </div>
                  </div>
                  
                  {/* Quote
                  <blockquote className="border-t border-white/20 pt-8 italic text-blue-100 text-center text-lg leading-relaxed">
                    “{study.quote}”
                  </blockquote>
                   */}

                  {/* Metrics */}
                  {study.metrics && study.metrics.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center pt-8 border-t border-white/20">
                      {study.metrics.map((metric, idx) => (
                        <div key={idx}>
                          <p className="text-2xl md:text-3xl font-bold text-white">{metric.value}</p>
                          <p className="text-blue-200 text-sm mt-1">{metric.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Results
                  {study.results && study.results.length > 0 && (
                    <div className="border-t border-white/20 pt-8">
                      <h4 className="font-semibold text-white mb-4 text-lg">Key Results</h4>
                      <ul className="space-y-3 text-blue-100">
                        {study.results.map((result, idx) => (
                          <li key={idx} className="flex items-start">
                            <svg
                              className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                     */}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pointer-events-none p-8">
                  <p className="text-white text-sm font-medium bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    Click to view full case study
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <p className="text-xl text-blue-200">No case studies found for {activeIndustry}.</p>
            </div>
          )}
        </div>

        {/* Modal */}
        {selectedStudy && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="max-w-4xl w-full bg-white rounded-2xl p-6 md:p-10 relative overflow-auto max-h-[90vh]">
              <button
                onClick={() => setSelectedStudy(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              <div className="pr-8">
                <h3 id="modal-title" className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  {selectedStudy.company} Case Study
                </h3>
                <p className="text-blue-600 font-medium mb-8">{selectedStudy.industry}</p>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 text-lg">Challenge</h4>
                    <p className="text-gray-700 leading-relaxed">{selectedStudy.challenge}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2 text-lg">Solution</h4>
                    <p className="text-gray-700 leading-relaxed">{selectedStudy.solution}</p>
                  </div>
                  
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 text-lg">
                    “{selectedStudy.quote}”
                    <footer className="text-sm text-gray-500 mt-2 not-italic">
                      — {selectedStudy.author}, {selectedStudy.role}
                    </footer>
                  </blockquote>

                  {selectedStudy.results && selectedStudy.results.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4 text-lg">Key Achievements</h4>
                      <ul className="space-y-2 text-gray-700">
                        {selectedStudy.results.map((result, idx) => (
                          <li key={idx} className="flex items-start">
                            <svg
                              className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}


const PricingSection: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')

  const toggleBillingCycle = () => {
    setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')
  }

  return (
    <section  id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Enterprise Pricing
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Flexible plans designed to scale with your organization's needs
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center items-center mb-12 space-x-4">
          <span
            className={`text-lg ${
              billingCycle === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'
            }`}
          >
            Monthly
          </span>
          <button
            onClick={toggleBillingCycle}
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Toggle billing cycle"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span
            className={`text-lg ${
              billingCycle === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'
            }`}
          >
            Yearly
          </span>
          <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
            Save 20%
          </span>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {ENTERPRISE_PRICING.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly
            const period = billingCycle === 'monthly' ? 'month' : 'year'

            return (
              <motion.div
                key={plan.id}
                className={`relative ${plan.highlighted ? 'scale-105 z-10' : ''}`}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {/* Badge */}
                {plan.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <span className="bg-purple-600 text-white px-4 py-1 rounded-full text-xs font-semibold shadow-sm">
                      Most Popular
                    </span>
                  </div>
                )}

                <Card
                  className={`h-full p-8 transition-all ${
                    plan.highlighted
                      ? 'border-2 border-blue-500 shadow-2xl'
                      : 'border border-gray-200 hover:shadow-lg'
                  }`}
                >
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <p className="text-gray-600 mb-4">{plan.description}</p>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">${price}</span>
                      <span className="text-gray-600 ml-2">/{period}</span>
                    </div>
                  </div>

                  {/* SLA, Support, Users Info */}
                  <ul className="space-y-4 mb-8 text-gray-700 text-left">
                    <li className="flex justify-between border-b border-gray-200 py-2">
                      <span>SLA Uptime</span>
                      <span className="font-semibold">{plan.sla}</span>
                    </li>
                    <li className="flex justify-between border-b border-gray-200 py-2">
                      <span>Support</span>
                      <span className="font-semibold">{plan.support}</span>
                    </li>
                    <li className="flex justify-between border-b border-gray-200 py-2">
                      <span>Users</span>
                      <span className="font-semibold">{plan.users}</span>
                    </li>
                  </ul>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-gray-700">
                        <svg
                          className="w-5 h-5 text-green-500 mr-3 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* Limitations */}
                  {plan.limitations.length > 0 && (
                    <ul className="space-y-2 mb-8 text-gray-500 text-sm">
                      {plan.limitations.map((limitation, idx) => (
                        <li key={idx} className="flex items-center">
                          <svg
                            className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    variant={plan.highlighted ? 'primary' : 'outline'}
                    size="lg"
                    className="w-full"
                    href="#contact"
                  >
                    {plan.cta}
                  </Button>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Additional Enterprise Info */}
        <div className="mt-20 text-center">
          <div className="bg-gray-50 rounded-2xl p-10 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Need a Custom Solution?
            </h3>
            <p className="text-gray-600 mb-6 max-w-3xl mx-auto">
              We offer custom enterprise agreements for organizations with unique requirements, including dedicated instances, custom feature development, and specialized compliance needs.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="primary" size="lg" href="/contact">
                Contact Sales
              </Button>
              <Button variant="outline" size="lg" href="../../demo">
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

const EnterprisePage: React.FC = () => {
  return (
    <>
      <Head>
        <title>Enterprise Solutions | Podacium AI</title>
        <meta name="description" content="Enterprise-grade AI solutions with advanced security, compliance, and scalability. Transform your organization with Podacium Enterprise." />
        <meta name="keywords" content="enterprise AI, business intelligence, secure AI platform, compliance, scalability" />
      </Head>

      <div className="min-h-screen bg-white">
        <Navbar />
        
        <main>
          <HeroSection />
          <FeaturesSection />
          <CaseStudiesSection />
          <PricingSection />
        </main>

        <Footer />
      </div>
    </>
  )
}

export default EnterprisePage