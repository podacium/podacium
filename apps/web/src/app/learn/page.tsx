/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface LearningModule {
  id: string
  title: string
  description: string
  icon: string
  duration: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  lessons: number
  category: string
  features: string[]
  progress?: number
  isNew?: boolean
  isPopular?: boolean
}

interface Testimonial {
  id: string
  name: string
  role: string
  company: string
  avatar: string
  content: string
  rating: number
  course: string
}

interface FAQ {
  id: string
  question: string
  answer: string
  category: 'general' | 'courses' | 'pricing' | 'technical'
}

// =============================================================================
// MOCK DATA
// =============================================================================

const LEARNING_MODULES: LearningModule[] = [
  {
    id: '1',
    title: 'Data Analytics Fundamentals',
    description: 'Master the basics of data analysis and visualization with hands-on projects and real-world datasets.',
    icon: '📊',
    duration: '6 hours',
    level: 'Beginner',
    lessons: 24,
    category: 'Data Analytics',
    features: ['Excel & SQL', 'Data Visualization', 'Statistical Analysis', 'Real Projects'],
    isPopular: true
  },
  {
    id: '2',
    title: 'Machine Learning for Business',
    description: 'Learn how to apply ML algorithms to solve real business problems with Python and scikit-learn.',
    icon: '🤖',
    duration: '8 hours',
    level: 'Intermediate',
    lessons: 32,
    category: 'Machine Learning',
    features: ['Python Programming', 'Scikit-learn', 'Business Cases', 'Model Deployment'],
    isNew: true
  },
  {
    id: '3',
    title: 'Python for Data Science',
    description: 'From basics to advanced data manipulation with Python, pandas, numpy, and matplotlib.',
    icon: '🐍',
    duration: '12 hours',
    level: 'Beginner',
    lessons: 42,
    category: 'Data Science',
    features: ['Pandas Mastery', 'Data Cleaning', 'Visualization', 'Jupyter Notebooks'],
    isPopular: true
  },
  {
    id: '4',
    title: 'SQL Mastery: From Query to Insight',
    description: 'Comprehensive SQL training covering basic queries to advanced analytics functions.',
    icon: '🗄️',
    duration: '9 hours',
    level: 'Beginner',
    lessons: 35,
    category: 'Database',
    features: ['Advanced Queries', 'Performance Tuning', 'Data Modeling', 'Interview Prep']
  },
  {
    id: '5',
    title: 'Deep Learning with TensorFlow',
    description: 'Build and deploy neural networks using TensorFlow and Keras for various applications.',
    icon: '🧠',
    duration: '14 hours',
    level: 'Advanced',
    lessons: 48,
    category: 'Deep Learning',
    features: ['Neural Networks', 'TensorFlow', 'Model Deployment', 'GPU Support'],
    isNew: true
  },
  {
    id: '6',
    title: 'Data Visualization with D3.js',
    description: 'Create stunning, interactive data visualizations using D3.js and modern web technologies.',
    icon: '📈',
    duration: '8 hours',
    level: 'Intermediate',
    lessons: 30,
    category: 'Visualization',
    features: ['Interactive Charts', 'JavaScript', 'Web Standards', 'Mobile Responsive']
  },
  {
    id: '7',
    title: 'Business Metrics and KPIs',
    description: 'Learn to define, track, and analyze key business metrics across different industries.',
    icon: '🎯',
    duration: '5 hours',
    level: 'Beginner',
    lessons: 20,
    category: 'Business Analytics',
    features: ['KPI Framework', 'Dashboard Design', 'Industry Templates', 'Reporting']
  },
  {
    id: '8',
    title: 'Cloud Data Engineering with AWS',
    description: 'Build scalable data pipelines and infrastructure on AWS cloud platform.',
    icon: '☁️',
    duration: '11 hours',
    level: 'Advanced',
    lessons: 38,
    category: 'Data Engineering',
    features: ['AWS Services', 'Data Pipelines', 'ETL Processes', 'Cost Optimization']
  }
]

const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Data Analyst',
    company: 'TechCorp Inc.',
    avatar: '/avatars/sarah-chen.jpg',
    content: 'The Data Analytics Fundamentals course transformed how I approach data. The hands-on projects gave me confidence to tackle real business problems immediately.',
    rating: 5,
    course: 'Data Analytics Fundamentals'
  },
  {
    id: '2',
    name: 'Marcus Rodriguez',
    role: 'Marketing Director',
    company: 'GrowthLabs',
    avatar: '/avatars/marcus-rodriguez.jpg',
    content: 'As someone with no technical background, the Python course was incredibly accessible. The AI tutor helped me through tough concepts and kept me motivated.',
    rating: 5,
    course: 'Python for Data Science'
  },
  {
    id: '3',
    name: 'Priya Patel',
    role: 'Startup Founder',
    company: 'InnovateSphere',
    avatar: '/avatars/priya-patel.jpg',
    content: 'The Machine Learning course provided practical skills I could apply directly to our product. We improved our recommendation system by 40% after implementing what I learned.',
    rating: 4,
    course: 'Machine Learning for Business'
  },
  {
    id: '4',
    name: 'James Wilson',
    role: 'Operations Manager',
    company: 'GlobalRetail',
    avatar: '/avatars/james-wilson.jpg',
    content: 'SQL Mastery course exceeded my expectations. The real-world exercises and performance optimization techniques have made me much more efficient at work.',
    rating: 5,
    course: 'SQL Mastery: From Query to Insight'
  }
]

const FAQS: FAQ[] = [
  {
    id: '1',
    question: 'Do I need any prior experience to start learning?',
    answer: 'No prior experience is required for our beginner courses. We start from the fundamentals and gradually build up to advanced concepts. Our AI tutor provides personalized guidance based on your learning pace.',
    category: 'general'
  },
  {
    id: '2',
    question: 'How long do I have access to the courses?',
    answer: 'You get lifetime access to all courses you enroll in. This includes all future updates, new content, and additional resources we add to the courses over time.',
    category: 'courses'
  },
  {
    id: '3',
    question: 'Are there any certificates provided upon completion?',
    answer: 'Yes, you receive a verified certificate of completion for each course you finish. These certificates can be shared on LinkedIn and added to your resume to showcase your skills.',
    category: 'courses'
  },
  {
    id: '4',
    question: 'Can I learn at my own pace?',
    answer: 'Absolutely! All courses are self-paced. You can learn whenever and wherever you want. The AI tutor adapts to your schedule and provides reminders to keep you on track.',
    category: 'general'
  },
  {
    id: '5',
    question: 'What if I need help during the course?',
    answer: 'You get access to our AI tutor 24/7, community forums where you can ask questions, and weekly live Q&A sessions with course instructors and teaching assistants.',
    category: 'technical'
  },
  {
    id: '6',
    question: 'Do you offer team or enterprise plans?',
    answer: 'Yes, we offer enterprise plans with advanced admin controls, progress tracking, and dedicated support. Contact our sales team for custom pricing and features.',
    category: 'pricing'
  }
]

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
  const hoverClasses = hover ? 'transition-all duration-300 hover:shadow-2xl hover:-translate-y-1' : ''
  
  return (
    <div
      className={`${baseClasses} ${paddingClasses[padding]} ${hoverClasses} ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  )
}

import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

// =============================================================================
// LEARN PAGE COMPONENTS
// =============================================================================

const LearnHero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="text-center max-w-4xl mx-auto">
          <motion.h1 
            className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Master Data Skills with{' '}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI-Powered Learning
            </span>
          </motion.h1>
          
          <motion.p 
            className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Transform your career with interactive courses, real-world projects, and personalized AI tutoring. 
            Learn at your own pace and build in-demand data skills that employers value.
          </motion.p>
          
          <motion.div 
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button variant="primary" size="xl" href="/signup">
              Start Learning Free
            </Button>
            <Button variant="outline" size="xl" href="#courses">
              Explore Courses
            </Button>
          </motion.div>
          
          <motion.div 
            className="mt-8 flex items-center justify-center space-x-8 text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              No credit card required
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              14-day free trial
            </div>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Certificate upon completion
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

const FeaturesShowcase: React.FC = () => {
  const features = [
    {
      icon: '🎯',
      title: 'Personalized Learning Paths',
      description: 'AI-powered recommendations based on your goals, skill level, and learning style'
    },
    {
      icon: '🤖',
      title: '24/7 AI Tutor',
      description: 'Get instant answers and guidance from our intelligent learning assistant'
    },
    {
      icon: '💼',
      title: 'Real-World Projects',
      description: 'Build portfolio-worthy projects with datasets from actual companies'
    },
  ]

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Why Learn with Podacium?
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Experience the future of education with our AI-driven learning platform designed for maximum engagement and retention
          </p>
        </div>
        
        <div className="flex justify-center">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {features.map((feature, index) => (
                    <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    >
                    <Card hover className="text-center p-6 h-full">
                        <div className="text-4xl mb-4">{feature.icon}</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                        <p className="text-gray-600">{feature.description}</p>
                    </Card>
                    </motion.div>
                ))}
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center">
        </div>
      </div>
    </section>
  )
}

const LearningModules: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All')
  
  const categories = ['All', 'Data Analytics', 'Machine Learning', 'Data Science', 'Database', 'Deep Learning', 'Visualization', 'Business Analytics', 'Data Engineering']
  
  const filteredModules = selectedCategory === 'All' 
    ? LEARNING_MODULES
    : LEARNING_MODULES.filter(module => module.category === selectedCategory)

  return (
    <section id="courses" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Explore Our Courses
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Choose from our carefully crafted learning paths designed by industry experts and updated regularly
          </p>
        </div>
        
        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        
        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredModules.map((module, index) => (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card hover className="h-full flex flex-col">
                {/* Badges */}
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    module.level === 'Beginner' ? 'bg-green-100 text-green-800' :
                    module.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {module.level}
                  </span>
                  <div className="flex gap-2">
                    {module.isNew && (
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">
                        New
                      </span>
                    )}
                    {module.isPopular && (
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-semibold">
                        Popular
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Icon and Title */}
                <div className="flex items-center mb-4">
                  <div className="text-3xl mr-4">{module.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900">{module.title}</h3>
                </div>
                
                <p className="text-gray-600 mb-4 flex-grow">{module.description}</p>
                
                {/* Features */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {module.features.slice(0, 3).map((feature) => (
                      <span key={feature} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                        {feature}
                      </span>
                    ))}
                    {module.features.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                        +{module.features.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Meta Info */}
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {module.duration}
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {module.lessons} lessons
                  </div>
                </div>
                
                <Button variant="primary" className="w-full" href={`/learn/courses/${module.id}`}>
                  Start Learning
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>
        
        {/* View All CTA */}
        <div className="text-center mt-12">
          <Button variant="outline" size="lg" href="/learn/courses">
            View All Courses
          </Button>
        </div>
      </div>
    </section>
  )
}

const LearningPathways: React.FC = () => {
  const pathways = [
    {
      title: 'Data Analyst Career Path',
      description: 'Go from beginner to job-ready data analyst in 6 months',
      duration: '6 months',
      courses: 8,
      level: 'Beginner to Advanced',
      skills: ['SQL', 'Excel', 'Python', 'Tableau', 'Statistics'],
      color: 'from-blue-500 to-blue-600'
    },
    {
      title: 'Machine Learning Engineer',
      description: 'Master ML algorithms and deployment for production systems',
      duration: '8 months',
      courses: 10,
      level: 'Intermediate to Advanced',
      skills: ['Python', 'TensorFlow', 'MLOps', 'AWS', 'Docker'],
      color: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Business Intelligence Specialist',
      description: 'Learn to create impactful dashboards and drive business decisions',
      duration: '4 months',
      courses: 6,
      level: 'Beginner to Intermediate',
      skills: ['Power BI', 'SQL', 'Data Modeling', 'Dashboard Design', 'KPIs'],
      color: 'from-green-500 to-green-600'
    }
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Structured Learning Paths
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Follow our expert-curated career paths to systematically build the skills you need for your dream job
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {pathways.map((pathway, index) => (
            <motion.div
              key={pathway.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card hover className="h-full relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${pathway.color}`}></div>
                
                <div className="pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{pathway.title}</h3>
                  <p className="text-gray-600 mb-4">{pathway.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-gray-500">Duration</div>
                      <div className="font-semibold">{pathway.duration}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Courses</div>
                      <div className="font-semibold">{pathway.courses}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Level</div>
                      <div className="font-semibold">{pathway.level}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Skills</div>
                      <div className="font-semibold">{pathway.skills.length}+</div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <div className="text-sm text-gray-500 mb-2">Key Skills:</div>
                    <div className="flex flex-wrap gap-2">
                      {pathway.skills.map((skill) => (
                        <span key={skill} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    Explore Path
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const TestimonialsSection: React.FC = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Success Stories
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Join thousands of learners who transformed their careers with Podacium
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-gray-600 text-sm">{testimonial.role} at {testimonial.company}</div>
                  </div>
                </div>
                
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < testimonial.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                
                <blockquote className="text-gray-700 mb-4">
                  "{testimonial.content}"
                </blockquote>
                
                <div className="text-sm text-blue-600 font-medium">
                  Completed: {testimonial.course}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQSection: React.FC = () => {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  
  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems)
    newOpenItems.has(id) ? newOpenItems.delete(id) : newOpenItems.add(id)
    setOpenItems(newOpenItems)
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Find answers to common questions about learning with Podacium
          </p>
        </div>
        
        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <motion.div
              key={faq.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="w-full text-left flex justify-between items-center p-6 hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 pr-4">
                    {faq.question}
                  </h3>
                  <svg
                    className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${
                      openItems.has(faq.id) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <AnimatePresence>
                  {openItems.has(faq.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                        <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">
            Still have questions? We're here to help!
          </p>
          <Button variant="outline" href="/contact">
            Contact Support
          </Button>
        </div>
      </div>
    </section>
  )
}

const CTASection: React.FC = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2 
          className="text-3xl lg:text-4xl font-bold text-white mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          Ready to Start Your Learning Journey?
        </motion.h2>
        
        <motion.p 
          className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
        >
          Join thousands of learners building in-demand skills with our AI-powered platform. 
          Start for free and transform your career today.
        </motion.p>
        
        <motion.div 
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <Button 
            variant="primary" 
            size="lg"
            className="bg-white text-blue-600 hover:bg-gray-100"
            href="/signup"
          >
            Get Started Free
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="border-white text-white hover:bg-white hover:text-blue-600"
            href="/learn/courses"
          >
            Browse Courses
          </Button>
        </motion.div>
        
        <motion.div 
          className="mt-8 text-blue-100 text-sm"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
        >
          No credit card required • 14-day free trial • Cancel anytime
        </motion.div>
      </div>
    </section>
  )
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function LearnPage() {
  return (
    <>
      <Head>
        <title>Learn Data Skills | Podacium</title>
        <meta 
          name="description" 
          content="Master data analytics, machine learning, and data science with AI-powered courses. Learn from industry experts and build in-demand skills for your career." 
        />
      </Head>
      
      <main className="min-h-screen">
       <Navbar />
        {/* Hero Section */}
        <LearnHero />
        
        {/* Features Showcase */}
        <FeaturesShowcase />
        
        {/* Learning Modules */}
        <LearningModules />
        
        {/* Learning Pathways */}
        <LearningPathways />
        
        {/* Testimonials */}
        <TestimonialsSection />
        
        {/* FAQ Section */}
        <FAQSection />
        
        {/* Final CTA */}
        <CTASection />

        <Footer />
      </main>
    </>
  )
}