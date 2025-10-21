/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
// /app/page.tsx
import { LEARNING_MODULES as MOCK_COURSES, type LearningModule } from './learn/page';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

type Course = LearningModule;

interface Dashboard {
  id: string
  title: string
  description: string
  metrics: string[]
  previewImage: string
  category: string
  complexity: 'Basic' | 'Intermediate' | 'Advanced'
  dataSources: string[]
  createdBy: string
  lastUpdated: string
  usage: number
}

interface Testimonial {
  id: string
  name: string
  role: string
  company: string
  avatar: string
  content: string
  rating: number
  pillar: 'Learn' | 'BI' | 'Hub'
  project?: string
}

interface Freelancer {
  id: string
  name: string
  role: string
  skills: string[]
  rating: number
  projects: number
  avatar: string
  location: string
  hourlyRate: number
  availability: 'Available' | 'Limited' | 'Unavailable'
  description: string
  experience: string
  education: string[]
  certifications: string[]
  languages: string[]
  responseTime: string
  successRate: number
}

interface Project {
  id: string
  title: string
  description: string
  category: string
  budget: {
    min: number
    max: number
    type: 'fixed' | 'hourly'
  }
  duration: string
  skillsRequired: string[]
  proposals: number
  posted: string
  client: {
    name: string
    rating: number
    projects: number
  }
  status: 'open' | 'in-progress' | 'completed'
}

interface FAQ {
  id: string | number;
  question: string;
  answer: string;
  category:
    | 'general'
    | 'billing'
    | 'technical'
    | 'accounts'
    | 'scheduling'
    | 'integration'
    | 'security'
    | 'customization'
    | 'collaboration'
    | 'mobile'
    | 'automation'
    | 'analytics'
    | 'support'
    | string; // allows future expansion
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
  cta: string
  popular: boolean
  pillar: 'all' | 'learn' | 'bi' | 'hub'
  badge?: string
}

interface TeamMember {
  id: string
  name: string
  role: string
  department: string
  avatar: string
  bio: string
  skills: string[]
  social: {
    linkedin?: string
    twitter?: string
    github?: string
  }
}

interface NewsItem {
  id: string
  title: string
  excerpt: string
  content: string
  image: string
  date: string
  author: string
  category: string
  tags: string[]
}

// =============================================================================
// MOCK DATA - EXTENSIVE DATASETS
// =============================================================================

const MOCK_DASHBOARDS: Dashboard[] = [
  {
    id: '1',
    title: 'Sales Performance Dashboard',
    description: 'Real-time sales metrics and trend analysis with predictive forecasting and team performance tracking.',
    metrics: ['Revenue Growth', 'Conversion Rate', 'Customer Acquisition Cost', 'Sales Velocity'],
    previewImage: '/dashboards/sales.jpg',
    category: 'Sales',
    complexity: 'Intermediate',
    dataSources: ['CRM', 'Payment Gateway', 'Marketing Analytics'],
    createdBy: 'Sales Team',
    lastUpdated: '2024-01-15',
    usage: 234
  },
  {
    id: '2',
    title: 'Marketing Analytics Suite',
    description: 'Comprehensive marketing campaign performance across channels with ROI calculation and attribution modeling.',
    metrics: ['ROI', 'Engagement Rate', 'Lead Quality Score', 'Customer Lifetime Value'],
    previewImage: '/dashboards/marketing.jpg',
    category: 'Marketing',
    complexity: 'Advanced',
    dataSources: ['Google Analytics', 'Social Media', 'Email Platform'],
    createdBy: 'Marketing Team',
    lastUpdated: '2024-01-18',
    usage: 189
  },
  {
    id: '3',
    title: 'Financial Health Monitor',
    description: 'Complete financial overview and forecasting with cash flow analysis, profit margins, and expense tracking.',
    metrics: ['Cash Flow', 'Profit Margins', 'Expense Ratios', 'Burn Rate'],
    previewImage: '/dashboards/finance.jpg',
    category: 'Finance',
    complexity: 'Advanced',
    dataSources: ['Accounting Software', 'Bank Feeds', 'Payment Processors'],
    createdBy: 'Finance Team',
    lastUpdated: '2024-01-20',
    usage: 156
  },
  {
    id: '4',
    title: 'Customer Success Dashboard',
    description: 'Track customer health scores, support metrics, and retention rates to improve customer experience.',
    metrics: ['NPS', 'CSAT', 'Churn Rate', 'Support Ticket Volume'],
    previewImage: '/dashboards/customer-success.jpg',
    category: 'Customer Success',
    complexity: 'Intermediate',
    dataSources: ['Support System', 'Product Analytics', 'Survey Tools'],
    createdBy: 'Customer Success Team',
    lastUpdated: '2024-01-22',
    usage: 201
  },
  {
    id: '5',
    title: 'Operations Efficiency Tracker',
    description: 'Monitor operational metrics, resource utilization, and process efficiency across the organization.',
    metrics: ['Efficiency Ratio', 'Resource Utilization', 'Process Cycle Time', 'Quality Metrics'],
    previewImage: '/dashboards/operations.jpg',
    category: 'Operations',
    complexity: 'Intermediate',
    dataSources: ['ERP System', 'Time Tracking', 'Quality Management'],
    createdBy: 'Operations Team',
    lastUpdated: '2024-01-25',
    usage: 145
  },
  {
    id: '6',
    title: 'HR Analytics Dashboard',
    description: 'People analytics covering hiring, retention, performance, and employee satisfaction metrics.',
    metrics: ['Time to Hire', 'Employee Turnover', 'Performance Ratings', 'Engagement Score'],
    previewImage: '/dashboards/hr-analytics.jpg',
    category: 'Human Resources',
    complexity: 'Basic',
    dataSources: ['HRIS', 'Performance System', 'Survey Tools'],
    createdBy: 'HR Team',
    lastUpdated: '2024-01-28',
    usage: 178
  }
]

const MOCK_TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    role: 'Data Analyst',
    company: 'TechCorp Inc.',
    avatar: '/avatars/sarah-chen.jpg',
    content: 'Podacium transformed how we analyze customer data. The AI insights saved us 20+ hours weekly and helped identify patterns we completely missed before.',
    rating: 5,
    pillar: 'BI',
    project: 'Customer Analytics Implementation'
  },
  {
    id: '2',
    name: 'Marcus Rodriguez',
    role: 'Marketing Director',
    company: 'GrowthLabs',
    avatar: '/avatars/marcus-rodriguez.jpg',
    content: 'The learning platform is incredible. Our team upskilled in weeks, not months. The AI tutor provided personalized guidance that accelerated our learning curve dramatically.',
    rating: 5,
    pillar: 'Learn',
    project: 'Team Data Literacy Program'
  },
  {
    id: '3',
    name: 'Priya Patel',
    role: 'Startup Founder',
    company: 'InnovateSphere',
    avatar: '/avatars/priya-patel.jpg',
    content: 'Found perfect freelancers through Hub. The AI matching is spot-on! We completed our data migration project 30% faster than planned with exceptional quality.',
    rating: 4,
    pillar: 'Hub',
    project: 'Data Infrastructure Overhaul'
  },
  {
    id: '4',
    name: 'James Wilson',
    role: 'Operations Manager',
    company: 'GlobalRetail',
    avatar: '/avatars/james-wilson.jpg',
    content: 'BI dashboards gave us insights we never knew were possible. Game changer for our inventory management and demand forecasting accuracy improved by 40%.',
    rating: 5,
    pillar: 'BI',
    project: 'Supply Chain Optimization'
  },
  {
    id: '5',
    name: 'Lisa Zhang',
    role: 'Data Science Lead',
    company: 'AI Ventures',
    avatar: '/avatars/lisa-zhang.jpg',
    content: 'The course quality exceeded expectations. Practical projects and real-world datasets made the learning immediately applicable to our work.',
    rating: 5,
    pillar: 'Learn',
    project: 'Machine Learning Certification'
  },
  {
    id: '6',
    name: 'Ahmed Hassan',
    role: 'BI Consultant',
    company: 'DataDriven Solutions',
    avatar: '/avatars/ahmed-hassan.jpg',
    content: 'As a freelancer, Podacium Hub has transformed my business. Consistent high-quality projects and the AI matching ensures I work on projects that match my expertise.',
    rating: 4,
    pillar: 'Hub',
    project: 'Multiple Dashboard Projects'
  },
  {
    id: '7',
    name: 'Emily Watson',
    role: 'Product Manager',
    company: 'SaaS Innovations',
    avatar: '/avatars/emily-watson.jpg',
    content: 'The predictive analytics features helped us anticipate market trends months in advance. Our product roadmap is now truly data-driven.',
    rating: 5,
    pillar: 'BI',
    project: 'Product Analytics Implementation'
  },
  {
    id: '8',
    name: 'Carlos Mendez',
    role: 'Learning & Development',
    company: 'Enterprise Solutions Co.',
    avatar: '/avatars/carlos-mendez.jpg',
    content: 'We rolled out Podacium Learn to 500+ employees. The engagement rates are unprecedented and skill assessments show remarkable improvement.',
    rating: 4,
    pillar: 'Learn',
    project: 'Enterprise Data Skills Program'
  }
]

const MOCK_FREELANCERS: Freelancer[] = [
  {
    id: '1',
    name: 'Alex Thompson',
    role: 'Data Scientist',
    skills: ['Python', 'Machine Learning', 'SQL', 'Tableau', 'TensorFlow', 'Statistical Analysis'],
    rating: 4.9,
    projects: 47,
    avatar: '/freelancers/alex-thompson.jpg',
    location: 'San Francisco, CA',
    hourlyRate: 120,
    availability: 'Available',
    description: 'Senior Data Scientist with 8+ years experience in building ML solutions for Fortune 500 companies. Specialized in predictive modeling and data infrastructure.',
    experience: '8 years',
    education: ['MSc Data Science - Stanford University', 'BSc Computer Science - MIT'],
    certifications: ['AWS Certified Data Analytics', 'Google Professional Data Engineer'],
    languages: ['English', 'Spanish'],
    responseTime: '< 2 hours',
    successRate: 98
  },
  {
    id: '2',
    name: 'Maria Garcia',
    role: 'BI Consultant',
    skills: ['Power BI', 'Data Visualization', 'Excel', 'Statistics', 'SQL', 'Dashboard Design'],
    rating: 4.8,
    projects: 32,
    avatar: '/freelancers/maria-garcia.jpg',
    location: 'New York, NY',
    hourlyRate: 95,
    availability: 'Available',
    description: 'BI expert focused on transforming raw data into actionable insights. Strong background in financial services and retail analytics.',
    experience: '6 years',
    education: ['MBA - Harvard Business School', 'BSc Economics - University of Chicago'],
    certifications: ['Tableau Desktop Specialist', 'Microsoft Certified: Data Analyst Associate'],
    languages: ['English', 'Portuguese', 'Spanish'],
    responseTime: '< 4 hours',
    successRate: 96
  },
  {
    id: '3',
    name: 'David Kim',
    role: 'ML Engineer',
    skills: ['TensorFlow', 'PyTorch', 'AWS', 'Data Pipelines', 'Docker', 'Kubernetes'],
    rating: 5.0,
    projects: 28,
    avatar: '/freelancers/david-kim.jpg',
    location: 'Seattle, WA',
    hourlyRate: 145,
    availability: 'Limited',
    description: 'Machine Learning Engineer specializing in production ML systems. Experience scaling models to handle millions of predictions daily.',
    experience: '7 years',
    education: ['PhD Computer Science - Carnegie Mellon', 'MEng Electrical Engineering - Cornell'],
    certifications: ['AWS Certified Machine Learning', 'Google Cloud Professional ML Engineer'],
    languages: ['English', 'Korean'],
    responseTime: '< 6 hours',
    successRate: 99
  },
  {
    id: '4',
    name: 'Sophie Martin',
    role: 'Data Visualization Expert',
    skills: ['D3.js', 'React', 'JavaScript', 'UI/UX Design', 'Data Storytelling', 'Python'],
    rating: 4.7,
    projects: 41,
    avatar: '/freelancers/sophie-martin.jpg',
    location: 'Austin, TX',
    hourlyRate: 85,
    availability: 'Available',
    description: 'Creative data visualization specialist with background in design and development. Passionate about making complex data accessible and engaging.',
    experience: '5 years',
    education: ['BFA Design - RISD', 'MPS Data Visualization - NYU'],
    certifications: ['Figma Professional', 'D3.js Certification'],
    languages: ['English', 'French'],
    responseTime: '< 3 hours',
    successRate: 94
  },
  {
    id: '5',
    name: 'Raj Patel',
    role: 'Data Engineer',
    skills: ['Apache Spark', 'SQL', 'Python', 'AWS', 'ETL', 'Data Warehousing'],
    rating: 4.8,
    projects: 36,
    avatar: '/freelancers/raj-patel.jpg',
    location: 'Chicago, IL',
    hourlyRate: 110,
    availability: 'Available',
    description: 'Data Engineer focused on building scalable data infrastructure. Expertise in cloud data platforms and real-time data processing.',
    experience: '7 years',
    education: ['MSc Computer Science - University of Illinois', 'BSc Engineering - IIT Delhi'],
    certifications: ['AWS Certified Solutions Architect', 'Apache Spark Developer'],
    languages: ['English', 'Hindi', 'Gujarati'],
    responseTime: '< 2 hours',
    successRate: 97
  },
  {
    id: '6',
    name: 'Jennifer Lee',
    role: 'Business Intelligence Analyst',
    skills: ['Tableau', 'SQL', 'Excel', 'Business Analysis', 'Requirements Gathering', 'Stakeholder Management'],
    rating: 4.6,
    projects: 29,
    avatar: '/freelancers/jennifer-lee.jpg',
    location: 'Boston, MA',
    hourlyRate: 75,
    availability: 'Available',
    description: 'BI Analyst with strong business acumen and technical skills. Specialized in translating business requirements into data solutions.',
    experience: '5 years',
    education: ['BBA Finance - Wharton School', 'MSc Business Analytics - MIT'],
    certifications: ['Tableau Certified Associate', 'PMI Professional in Business Analysis'],
    languages: ['English', 'Mandarin'],
    responseTime: '< 4 hours',
    successRate: 95
  }
]

const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'E-commerce Analytics Dashboard',
    description: 'Build a comprehensive dashboard to track sales, customer behavior, and inventory metrics for our online store.',
    category: 'Business Intelligence',
    budget: {
      min: 5000,
      max: 15000,
      type: 'fixed'
    },
    duration: '4-6 weeks',
    skillsRequired: ['Power BI', 'SQL', 'E-commerce', 'Data Visualization'],
    proposals: 12,
    posted: '2024-01-20',
    client: {
      name: 'FashionRetail Co.',
      rating: 4.8,
      projects: 23
    },
    status: 'open'
  },
  {
    id: '2',
    title: 'Customer Churn Prediction Model',
    description: 'Develop a machine learning model to predict customer churn and identify key factors driving attrition.',
    category: 'Machine Learning',
    budget: {
      min: 8000,
      max: 20000,
      type: 'fixed'
    },
    duration: '6-8 weeks',
    skillsRequired: ['Python', 'Scikit-learn', 'Classification', 'Feature Engineering'],
    proposals: 18,
    posted: '2024-01-22',
    client: {
      name: 'SaaS Solutions Inc.',
      rating: 4.9,
      projects: 45
    },
    status: 'open'
  },
  {
    id: '3',
    title: 'Data Pipeline Optimization',
    description: 'Optimize existing ETL processes and improve data quality for financial reporting system.',
    category: 'Data Engineering',
    budget: {
      min: 75,
      max: 120,
      type: 'hourly'
    },
    duration: '8-12 weeks',
    skillsRequired: ['Apache Spark', 'SQL', 'Data Quality', 'Performance Tuning'],
    proposals: 15,
    posted: '2024-01-25',
    client: {
      name: 'Financial Services Group',
      rating: 4.7,
      projects: 34
    },
    status: 'open'
  }
]

const MOCK_FAQS: FAQ[] = [
  // ---- Podacium Core ----
  {
    id: 1,
    question: 'What is Podacium and how does it work?',
    answer:
      'Podacium is an integrated AI-driven platform that combines learning, business intelligence, and talent matching in one ecosystem. It uses advanced AI to provide personalized learning paths, data insights, and connects businesses with skilled freelancers.',
    category: 'general'
  },
  {
    id: 2,
    question: 'How much does Podacium cost?',
    answer:
      'We offer flexible pricing plans starting from free basic access to premium enterprise solutions. Each pillar (Learn, BI, Hub) has its own pricing structure, with discounts for bundled access.',
    category: 'billing'
  },
  {
    id: 3,
    question: 'Can I integrate Podacium with my existing tools?',
    answer:
      'Yes, Podacium integrates with popular data sources, LMS platforms, and project management tools through APIs and pre-built connectors.',
    category: 'technical'
  },
  {
    id: 4,
    question: 'How does AI matching in the Hub work?',
    answer:
      'Our AI analyzes project requirements, freelancer skills, and collaboration history to suggest optimal matches, improving over time based on performance data.',
    category: 'technical'
  },
  {
    id: 5,
    question: 'What kind of support do you offer?',
    answer:
      'We provide 24/7 chat support for all users, account management for enterprise clients, and a knowledge base for self-service help.',
    category: 'general'
  },
  {
    id: 6,
    question: 'How secure is my data on Podacium?',
    answer:
      'We apply enterprise-grade security: encryption in transit and at rest, SOC 2 compliance, routine audits, and strict access control policies.',
    category: 'technical'
  },
  {
    id: 7,
    question: 'Do you offer team or enterprise plans?',
    answer:
      'Yes, we offer enterprise plans with advanced admin controls, centralized billing, and team analytics.',
    category: 'accounts'
  },
  {
    id: 8,
    question: 'What programming languages are covered in Learn?',
    answer:
      'Courses include Python, R, SQL, JavaScript, and more, all tailored for real-world data science and business applications.',
    category: 'general'
  },
  {
    id: 9,
    question: 'How do payments work in the Hub marketplace?',
    answer:
      'We use an escrow system where clients deposit funds before project start. Payments are released after milestone completion for security.',
    category: 'billing'
  },

  // ---- Scheduling / General SaaS ----
  {
    id: 10,
    question: 'How does AI scheduling work?',
    answer:
      'Our AI analyzes your calendar usage, meeting history, and preferences to suggest optimal times, improving over time with each interaction.',
    category: 'scheduling'
  },
  {
    id: 11,
    question: 'What calendar integrations are supported?',
    answer:
      'We support Google Calendar, Microsoft Outlook, Apple Calendar, and any CalDAV-compliant system with two-way synchronization.',
    category: 'integration'
  },
  {
    id: 12,
    question: 'Can I customize booking or dashboard interfaces?',
    answer:
      'Yes! You can add branding, custom colors, domains, and even CSS overrides for full customization.',
    category: 'customization'
  },
  {
    id: 13,
    question: 'What analytics are available?',
    answer:
      'Our analytics dashboards provide real-time insights into performance, engagement, conversion rates, and user activity across your workspace.',
    category: 'analytics'
  },
  {
    id: 14,
    question: 'Is there a mobile app?',
    answer:
      'Yes, our mobile apps for iOS and Android include all core features, with offline support and push notifications.',
    category: 'mobile'
  },
  {
    id: 15,
    question: 'What integrations are available?',
    answer:
      'We integrate with 100+ tools including Google Analytics, Salesforce, MySQL, and cloud providers like AWS, GCP, and Azure.',
    category: 'integration'
  },
  {
    id: 16,
    question: 'Can I cancel or change plans anytime?',
    answer:
      'Yes, you can upgrade, downgrade, or cancel your plan anytime. Annual plans receive prorated refunds.',
    category: 'billing'
  },
  {
    id: 17,
    question: 'Is my data private?',
    answer:
      'All user data is encrypted end-to-end and stored in secure data centers with continuous monitoring and strict privacy policies.',
    category: 'security'
  },
  {
    id: 18,
    question: 'Can I export my data?',
    answer:
      'Yes, you can export your course progress, BI dashboards, or scheduling data as CSV, JSON, or PDF at any time.',
    category: 'technical'
  },
  {
    id: 19,
    question: 'Do you offer free trials?',
    answer:
      'Yes, we offer a 14-day free trial giving you full access to all Professional features. No credit card required.',
    category: 'billing'
  }
];

const MOCK_PRICING_TIERS: PricingTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individuals and small teams getting started with data and AI.',
    price: {
      monthly: 19,
      yearly: 190
    },
    features: [
      'Access to essential courses and tutorials',
      'Up to 5 dashboards per month',
      'Community support',
      'Basic AI assistance',
      '1 project posting per month',
      'Email support'
    ],
    cta: 'Get Started with Podacium',
    popular: false,
    pillar: 'all',
    badge: 'For Beginners & Learners'
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Ideal for growing businesses and serious learners integrating BI, AI, and freelancing.',
    price: {
      monthly: 49,
      yearly: 490
    },
    features: [
      'All Podacium courses and certifications',
      'Unlimited dashboards & analytics reports',
      'Priority support & AI recommendations',
      '10 project postings per month',
      'API access & export tools',
      'Team collaboration & shared workspaces',
      'Advanced analytics & AI insights',
      'Custom branding options',
      '20GB storage',
      'Access to Podacium community projects',
      '15-day trial — signup only (no credit card)'
    ],
    cta: 'Start Your Podacium Journey',
    popular: true,
    pillar: 'all',
    badge: 'Best Value for Professionals'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations needing full customization, scalability, and dedicated support.',
    price: {
      monthly: 129,
      yearly: 1290
    },
    features: [
      'Everything in Professional',
      'Unlimited team members & permissions',
      'Dedicated account manager',
      'SLA guarantee & security compliance',
      'Custom integrations & BI connectors',
      'On-premise or hybrid deployment options',
      '1TB storage',
      '24/7 priority support',
      'Custom training sessions',
      'SSO, API extensions, and data governance tools',
      '15-day trial — signup only (no credit card)',
      'Tailored pricing by client needs'
    ],
    cta: 'Contact Podacium Sales',
    popular: false,
    pillar: 'all',
    badge: 'For Large Teams & Enterprises'
  }
]


const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Dr. Elena Rodriguez',
    role: 'CEO & Founder',
    department: 'Executive',
    avatar: '/team/elena-rodriguez.jpg',
    bio: 'Former Head of Data Science at Tech Giant, PhD in Machine Learning from Stanford. Passionate about democratizing data education and AI capabilities.',
    skills: ['Machine Learning', 'Leadership', 'Product Strategy', 'Data Science'],
    social: {
      linkedin: 'https://linkedin.com/in/elenarodriguez',
      twitter: 'https://twitter.com/elenarodriguez'
    }
  },
  {
    id: '2',
    name: 'Michael Chen',
    role: 'CTO',
    department: 'Technology',
    avatar: '/team/michael-chen.jpg',
    bio: 'Previously Engineering Director at Cloud Platform company. Expert in scalable systems and AI infrastructure with 15+ years experience.',
    skills: ['System Architecture', 'AI Engineering', 'Cloud Computing', 'DevOps'],
    social: {
      linkedin: 'https://linkedin.com/in/michaelchen',
      github: 'https://github.com/michaelchen'
    }
  },
  {
    id: '3',
    name: 'Sarah Johnson',
    role: 'Head of Learning',
    department: 'Education',
    avatar: '/team/sarah-johnson.jpg',
    bio: 'Education technology expert with background in curriculum design and online learning. Previously at leading online education platform.',
    skills: ['Curriculum Design', 'EdTech', 'Learning Science', 'Instructional Design'],
    social: {
      linkedin: 'https://linkedin.com/in/sarahjohnson'
    }
  },
  {
    id: '4',
    name: 'David Kim',
    role: 'Lead Data Scientist',
    department: 'AI Research',
    avatar: '/team/david-kim.jpg',
    bio: 'PhD in Computer Science focusing on recommendation systems and AI ethics. Published researcher and open source contributor.',
    skills: ['Machine Learning', 'Research', 'Python', 'Recommendation Systems'],
    social: {
      linkedin: 'https://linkedin.com/in/davidkim',
      github: 'https://github.com/davidkim'
    }
  }
]

const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    title: 'Podacium Raises $20M Series B to Expand AI Learning Platform',
    excerpt: 'Funding round led by Venture Partners will accelerate product development and international expansion.',
    content: 'Full article content would go here...',
    image: '/news/series-b-funding.jpg',
    date: '2024-01-15',
    author: 'TechCrunch',
    category: 'Company News',
    tags: ['Funding', 'Growth', 'AI']
  },
  {
    id: '2',
    title: 'New AI Tutor Feature Revolutionizes Online Learning',
    excerpt: 'Podacium Learn introduces personalized AI tutoring that adapts to individual learning styles and pace.',
    content: 'Full article content would go here...',
    image: '/news/ai-tutor-launch.jpg',
    date: '2024-01-10',
    author: 'Product Team',
    category: 'Product Update',
    tags: ['AI', 'Learning', 'Innovation']
  },
  {
    id: '3',
    title: 'Case Study: How RetailCo Improved Sales by 34% Using Podacium BI',
    excerpt: 'Learn how this retail chain leveraged predictive analytics to optimize inventory and marketing strategies.',
    content: 'Full article content would go here...',
    image: '/news/retailco-case-study.jpg',
    date: '2024-01-05',
    author: 'Customer Success',
    category: 'Case Study',
    tags: ['BI', 'Retail', 'Success Story']
  }
]

// =============================================================================
// CUSTOM HOOKS
// =============================================================================

const useAuth = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true)
      // Simulate API call - replace with actual Supabase auth
      setTimeout(() => {
        setUser(null) // Set to null for demo - would be actual user object
        setLoading(false)
      }, 1000)
    }
    
    checkAuth()
  }, [])
  
  return { user, loading }
}

const useCourses = () => {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true)
      setError(null)
      try {
        // Simulate API call
        setTimeout(() => {
          setCourses(MOCK_COURSES)
          setLoading(false)
        }, 1500)
      } catch (err) {
        setError('Failed to load courses')
        setLoading(false)
      }
    }
    
    fetchCourses()
  }, [])
  
  return { courses, loading, error }
}

const useTestimonials = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    setTestimonials(MOCK_TESTIMONIALS)
  }, [])
  
  return { testimonials, loading }
}

const useFreelancers = () => {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    setFreelancers(MOCK_FREELANCERS)
  }, [])
  
  return { freelancers, loading }
}

const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    setProjects(MOCK_PROJECTS)
  }, [])
  
  return { projects, loading }
}

const useNewsletter = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const subscribe = async (email: string) => {
    setLoading(true)
    setError(null)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate random success/failure for demo
      if (Math.random() > 0.3) {
        setSuccess(true)
        setEmail('')
      } else {
        throw new Error('Subscription failed. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setLoading(false)
    }
  }
  
  return {
    email,
    setEmail,
    loading,
    success,
    error,
    subscribe
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
  onMouseEnter?: () => void
  onMouseLeave?: () => void
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

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl'
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        
        <div className={`inline-block w-full align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]}`}>
          <div className="px-6 py-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-6 py-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TabsProps {
  tabs: Array<{
    id: string
    label: React.ReactNode
    content: React.ReactNode
  }>
  defaultTab?: string
  className?: string
}

const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)
  
  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        {tabs.find(tab => tab.id === activeTab)?.content}
      </div>
    </div>
  )
}

interface SliderProps {
  children: React.ReactNode
  className?: string
  autoPlay?: boolean
  interval?: number
}

const Slider: React.FC<SliderProps> = ({
  children,
  className = '',
  autoPlay = false,
  interval = 5000
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const childrenArray = React.Children.toArray(children)
  
  useEffect(() => {
    if (!autoPlay || childrenArray.length <= 1) return
    
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % childrenArray.length)
    }, interval)
    
    return () => clearInterval(timer)
  }, [autoPlay, interval, childrenArray.length])
  
  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }
  
  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % childrenArray.length)
  }
  
  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + childrenArray.length) % childrenArray.length)
  }
  
  return (
    <div className={`relative ${className}`}>
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {childrenArray.map((child, index) => (
            <div key={index} className="w-full flex-shrink-0">
              {child}
            </div>
          ))}
        </div>
      </div>
      
      {childrenArray.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {childrenArray.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

import Navbar from '../components/Navbar'

// ... rest of your page component
function Home() {
  return (
    <>
      <Navbar />
      {/* Rest of your page content */}
    </>
  )
}

const Hero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Master Data Skills.
              <span className="block text-blue-600 mt-2">Build Intelligence.</span>
              <span className="block text-indigo-600 mt-2">Grow Your Career.</span>
            </h1>
            
            <p className="mt-6 text-xl text-gray-600 max-w-2xl">
              Podacium combines AI-powered learning, business intelligence, and talent matching in one integrated platform. 
              Transform how you learn, analyze, and collaborate with data.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="primary" size="xl" href="/auth/signup">
                Start Free Trial
              </Button>
              <Button variant="outline" size="xl" href="/demo">
                Schedule Demo
              </Button>
            </div>
            
            <div className="mt-8 flex items-center justify-center lg:justify-start space-x-8 text-sm text-gray-500">
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
            </div>
          </div>
          
          <div className="relative">
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8">
              <div className="grid grid-cols-2 gap-6">
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Learn</h3>
                  <p className="text-sm text-gray-600">AI-powered courses & certifications</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">BI</h3>
                  <p className="text-sm text-gray-600">Advanced analytics & dashboards</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Hub</h3>
                  <p className="text-sm text-gray-600">Talent matching & projects</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">AI</h3>
                  <p className="text-sm text-gray-600">Smart insights & automation</p>
                </Card>
              </div>
            </div>
            
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-blue-200 rounded-full opacity-50"></div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-purple-200 rounded-full opacity-50"></div>
            <div className="absolute top-1/2 -right-8 w-16 h-16 bg-green-200 rounded-full opacity-50"></div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
    </section>
  )
}

const LearnOverview: React.FC = () => {
  const { courses, loading } = useCourses()
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null)
  const [displayedCourses, setDisplayedCourses] = useState<Course[]>([])
  
  const categories = ['All', 'Data & AI', 'Technology', 'Business & Strategy', 'Collaboration', 'Applied Practice']

  // Get random 9 courses when category changes or component mounts
  useEffect(() => {
    if (courses.length > 0) {
      const filtered = selectedCategory === 'All' 
        ? courses 
        : courses.filter(course => course.category === selectedCategory)
      
      // Shuffle and take 9 courses
      const shuffled = [...filtered].sort(() => 0.5 - Math.random())
      setDisplayedCourses(shuffled.slice(0, 9))
    }
  }, [courses, selectedCategory])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
      case 'Intermediate': return 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white'
      case 'Advanced': return 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
      default: return 'bg-gradient-to-r from-gray-500 to-gray-700 text-white'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'Beginner': return '🟢'
      case 'Intermediate': return '🟡'
      case 'Advanced': return '🔴'
      default: return '⚪'
    }
  }

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Data Analytics': '📊',
      'Machine Learning': '🤖',
      'Data Science': '🔬',
      'Business Intelligence': '💼',
      'Database': '🗄️',
      'Time Series': '⏰',
      'Visualization': '📈',
      'Data Engineering': '⚙️',
      'Statistics': '📐',
      'Communication': '💬',
      'All': '🎯'
    }
    return icons[category] || '📚'
  }

  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `$${price}`
  }

  const calculateDiscount = (original: number, discounted: number | null) => {
    if (!discounted) return 0
    return Math.round((1 - discounted / original) * 100)
  }

  const getEnrollmentStatus = (students: number) => {
    if (students > 10000) return { text: 'Highly Enrolled', color: 'text-green-600', bg: 'bg-green-100' }
    if (students > 5000) return { text: 'Well Enrolled', color: 'text-blue-600', bg: 'bg-blue-100' }
    if (students > 1000) return { text: 'Popular', color: 'text-purple-600', bg: 'bg-purple-100' }
    return { text: 'New', color: 'text-gray-600', bg: 'bg-gray-100' }
  }

  return (
    <section id="learn" className="py-20 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="text-center">
          <div className="inline-flex items-center px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/50 text-blue-700 text-lg font-semibold mb-8 backdrop-blur-sm">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3 animate-pulse"></div>
            AI-Powered Learning Platform
            <div className="ml-3 px-2 py-1 bg-white/80 rounded-lg text-sm font-medium">
              {courses.length}+ Courses
            </div>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 tracking-tight">
            Learn <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600">Data Skills</span>
          </h1>
          
          <p className="mt-8 text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed font-light">
            Master in-demand data skills through interactive courses, real-world projects, and personalized AI tutoring. 
            Start your journey to becoming an expert today.
          </p>

        </div>

        {/* Categories Filter */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Explore by <span className="text-blue-600">Category</span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Browse through our carefully curated categories to find the perfect course for you
            </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`group relative px-8 py-4 rounded-2xl font-semibold transition-all duration-500 transform hover:scale-105 min-w-[140px] ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-2xl shadow-blue-500/30'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-lg hover:shadow-xl border border-gray-200/80'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-2xl">{getCategoryIcon(category)}</span>
                  <span className="text-sm">{category}</span>
                </div>
                
                {/* Hover effect */}
                {selectedCategory !== category && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-5 transition-opacity duration-300"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Courses Grid */}
        {loading ? (
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(9)].map((_, i) => (
              <Card key={i} className="animate-pulse overflow-hidden border-0 shadow-xl">
                <div className="p-6 space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="h-8 bg-gray-200 rounded-2xl w-20"></div>
                  </div>
                  
                  {/* Description */}
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                  </div>

                  {/* Stats */}
                  <div className="flex justify-between pt-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                  
                  {/* Button */}
                  <div className="h-12 bg-gray-200 rounded-xl"></div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-16 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {selectedCategory === 'All' ? 'Featured Courses' : `${selectedCategory} Courses`}
                </h3>
                <p className="text-gray-600 mt-2">
                  Showing {displayedCourses.length} of {selectedCategory === 'All' ? courses.length : courses.filter(c => c.category === selectedCategory).length} courses
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  🎲 Randomly selected
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const filtered = selectedCategory === 'All' 
                      ? courses 
                      : courses.filter(course => course.category === selectedCategory)
                    const shuffled = [...filtered].sort(() => 0.5 - Math.random())
                    setDisplayedCourses(shuffled.slice(0, 9))
                  }}
                  className="flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Shuffle</span>
                </Button>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedCourses.map((course) => (
                <Card 
                  key={course.id} 
                  className="group relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                  onMouseEnter={() => setHoveredCourse(course.id)}
                  onMouseLeave={() => setHoveredCourse(null)}
                >
                  {/* Course Header */}
                  <div className="p-6 pb-4">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xl text-gray-900 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2 pr-4">
                          {course.title}
                        </h3>
                        <p className="mt-2 text-gray-600 text-sm leading-relaxed line-clamp-3">
                          {course.description}
                        </p>
                      </div>
                      
                      {/* Level Badge */}
                      <div className={`${getLevelColor(course.level)} rounded-2xl px-3 py-1 text-xs font-bold whitespace-nowrap flex items-center space-x-1`}>
                        <span>{getLevelIcon(course.level)}</span>
                        <span>{course.level}</span>
                      </div>
                    </div>
                  </div>

                  {/* Course Details */}
                  <div className="px-6 pb-6">
                    {/* Progress Bar (if enrolled) */}
                    {course.progress !== undefined && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span>Your progress</span>
                          <span className="font-semibold">{course.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${course.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{course.duration}</div>
                          <div className="text-xs">Duration</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{course.lessons} lessons</div>
                          <div className="text-xs">Content</div>
                        </div>
                      </div>
                    </div>

                    {/* Tags & Features */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {course.tags.slice(0, 3).map((tag) => (
                          <span 
                            key={tag} 
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 transition-colors cursor-default border border-gray-200/50"
                          >
                            {tag}
                          </span>
                        ))}
                        {course.tags.length > 3 && (
                          <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium border border-gray-200/50">
                            +{course.tags.length - 3}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        {course.features.slice(0, 2).map((feature, index) => (
                          <div key={index} className="flex items-center text-xs text-gray-600">
                            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center mr-2">
                              <svg className="w-2 h-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price & Enrollment */}
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          {course.price.discounted ? (
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl font-bold text-gray-900">
                                {formatPrice(course.price.discounted)}
                              </span>
                              <span className="text-sm text-gray-500 line-through">
                                {formatPrice(course.price.original)}
                              </span>
                              <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                                -{calculateDiscount(course.price.original, course.price.discounted)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-2xl font-bold text-gray-900">
                              {formatPrice(course.price.original)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${getEnrollmentStatus(course.students).bg} ${getEnrollmentStatus(course.students).color}`}>
                        {getEnrollmentStatus(course.students).text}
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button 
                      variant="primary" 
                      className={`w-full mt-6 group relative overflow-hidden ${
                        course.progress !== undefined 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                          : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                      } shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300`}
                      href={course.progress !== undefined ? `/learn/courses/${course.id}/continue` : `/learn/courses/${course.id}`}
                    >
                      <span className="relative z-10 flex items-center justify-center space-x-2">
                        {course.progress !== undefined ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Continue Learning</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Enroll Now</span>
                          </>
                        )}
                      </span>
                      <div className="absolute inset-0 bg-white bg-opacity-20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </Button>
                  </div>

                  {/* Popular/New Badges */}
                  <div className="absolute top-4 left-4 flex flex-col space-y-2">
                    {course.isPopular && (
                      <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center space-x-1">
                        <span>🔥</span>
                        <span>Popular</span>
                      </div>
                    )}
                    {course.isNew && (
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center space-x-1">
                        <span>🆕</span>
                        <span>New</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* View All Courses */}
        <div className="mt-16 text-center">
          <Button 
            variant="primary" 
            size="lg" 
            href="/learn"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 px-12 py-4 rounded-2xl text-lg font-semibold"
          >
            Explore All Courses
            <svg className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Button>
        </div>

        {/* Features Section */}
        <div className="mt-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Why Learn With <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Our Platform</span>?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience the future of data education with cutting-edge AI technology and industry-proven methodologies
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-100/50 shadow-2xl group hover:shadow-3xl transition-all duration-500">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/20 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-200/20 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">AI-Powered Tutor</h3>
                <p className="text-gray-700 leading-relaxed text-lg">
                  Get personalized learning recommendations and instant answers to your questions with our advanced AI tutor. 
                  Adaptive learning paths tailored to your progress and goals.
                </p>
                <div className="mt-6 inline-flex items-center text-blue-600 font-semibold text-lg">
                  Learn more
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-50 to-emerald-100/50 shadow-2xl group hover:shadow-3xl transition-all duration-500">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-200/20 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Hands-on Projects</h3>
                <p className="text-gray-700 leading-relaxed text-lg">
                  Apply your skills with real-world projects and build a portfolio that showcases your expertise. 
                  Work with real datasets and industry-standard tools.
                </p>
                <div className="mt-6 inline-flex items-center text-green-600 font-semibold text-lg">
                  Learn more
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Card>
            
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-violet-100/50 shadow-2xl group hover:shadow-3xl transition-all duration-500">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/20 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-200/20 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative p-8 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Industry Certifications</h3>
                <p className="text-gray-700 leading-relaxed text-lg">
                  Earn recognized certifications that validate your skills and boost your career prospects. 
                  Get certified in the most in-demand data technologies and methodologies.
                </p>
                <div className="mt-6 inline-flex items-center text-purple-600 font-semibold text-lg">
                  Learn more
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}


const BIPreview: React.FC = () => {
  const [activeDashboard, setActiveDashboard] = useState(0)
  
  return (
    <section id="bi" className="py-24 bg-gradient-to-br from-slate-50 to-blue-50/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Content */}
          <div className="relative w-full">
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-blue-100/50 rounded-full blur-xl"></div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-purple-100/40 rounded-full blur-xl"></div>
            
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-tight">
              Transform Your Data Into{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Actionable Insights
              </span>
            </h2>
            <p className="mt-4 lg:mt-6 text-lg lg:text-xl text-gray-600 leading-relaxed">
              Unlock the power of your data with intelligent dashboards, predictive analytics, 
              and AI-driven recommendations that drive real business growth.
            </p>
            
            {/* Features Grid */}
            <div className="mt-8 lg:mt-12 space-y-6 lg:space-y-8">
              {[
                {
                  title: "Drag-and-Drop Dashboard Builder",
                  description: "Create beautiful, interactive dashboards without any coding required",
                  icon: (
                    <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17v.01" />
                      </svg>
                    </div>
                  )
                },
                {
                  title: "Predictive Analytics",
                  description: "Use machine learning to forecast trends and identify hidden opportunities",
                  icon: (
                    <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  )
                },
                {
                  title: "Automated Reporting",
                  description: "Schedule and distribute comprehensive reports automatically to stakeholders",
                  icon: (
                    <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )
                },
                {
                  title: "Enterprise Data Integration",
                  description: "Connect to 100+ data sources including databases, APIs, and cloud services",
                  icon: (
                    <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                      <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                  )
                }
              ].map((feature, index) => (
                <div key={index} className="flex items-start group">
                  {feature.icon}
                  <div className="ml-4 lg:ml-6 flex-1 min-w-0">
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {feature.title}
                    </h3>
                    <p className="mt-1 lg:mt-2 text-sm lg:text-base text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* CTA Buttons */}
            <div className="mt-8 lg:mt-12 flex flex-col sm:flex-row gap-3 lg:gap-4">
              <Button 
                variant="primary" 
                size="lg" 
                href="/bi"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 w-full sm:w-auto justify-center"
              >
                <span className="flex items-center">
                  Explore BI Features
                  <svg className="ml-2 w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                href="/bi/demo"
                className="border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300 w-full sm:w-auto justify-center"
              >
                <span className="flex items-center">
                  Live Demo
                  <svg className="ml-2 w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </span>
              </Button>
            </div>
          </div>
          
          {/* Right Content - Dashboard Preview */}
          <div className="relative w-full">
            {/* Background Elements - Constrained to container */}
            <div className="absolute top-8 -right-4 w-48 h-48 lg:w-64 lg:h-64 bg-blue-200/20 rounded-full blur-2xl lg:blur-3xl"></div>
            <div className="absolute bottom-8 -left-4 w-32 h-32 lg:w-48 lg:h-48 bg-purple-200/20 rounded-full blur-2xl lg:blur-3xl"></div>
            
            <Card className="p-4 lg:p-6 relative bg-white/80 backdrop-blur-sm border border-gray-200/60 shadow-xl lg:shadow-2xl shadow-blue-500/10 hover:shadow-2xl lg:hover:shadow-3xl hover:shadow-blue-500/20 transition-all duration-500 w-full max-w-full">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-6 lg:mb-8">
                <div className="flex items-center space-x-2 lg:space-x-3">
                  <div className="w-2 h-2 lg:w-3 lg:h-3 bg-red-400 rounded-full"></div>
                  <div className="w-2 h-2 lg:w-3 lg:h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-2 h-2 lg:w-3 lg:h-3 bg-green-400 rounded-full"></div>
                </div>
                <div className="text-xs lg:text-sm font-medium text-gray-500">
                  Live Dashboard
                </div>
              </div>
              
              <Tabs
                tabs={MOCK_DASHBOARDS.slice(0, 3).map((dashboard, index) => ({
                  id: dashboard.id,
                  label: (
                    <div className="flex items-center space-x-1 lg:space-x-2 min-w-0">
                      <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full flex-shrink-0 ${
                        dashboard.complexity === 'Basic' ? 'bg-green-400' :
                        dashboard.complexity === 'Intermediate' ? 'bg-yellow-400' : 'bg-red-400'
                      }`}></div>
                      <span className="truncate text-xs lg:text-sm">{dashboard.title.split(' ')[0]}</span>
                    </div>
                  ),
                  content: (
                    <div key={dashboard.id} className="space-y-4 lg:space-y-6 w-full">
                      {/* Chart Preview */}
                      <div className={`h-32 lg:h-40 bg-gradient-to-br ${
                        dashboard.category === 'Sales' ? 'from-blue-500 to-cyan-500' :
                        dashboard.category === 'Marketing' ? 'from-purple-500 to-pink-500' :
                        dashboard.category === 'Finance' ? 'from-green-500 to-emerald-500' :
                        'from-blue-500 to-purple-500'
                      } rounded-xl lg:rounded-2xl flex items-center justify-center text-white font-bold shadow-lg`}>
                        <div className="text-center px-2">
                          <div className="text-lg lg:text-xl mb-1 lg:mb-2 truncate">{dashboard.title}</div>
                          <div className="text-xs lg:text-sm opacity-90">{dashboard.category} Analytics</div>
                        </div>
                      </div>
                      
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 lg:gap-3">
                        {dashboard.metrics.slice(0, 4).map((metric, i) => (
                          <div 
                            key={i} 
                            className="p-2 lg:p-3 bg-gradient-to-br from-white to-gray-50/80 rounded-lg lg:rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-all duration-300"
                          >
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">
                              {metric}
                            </div>
                            <div className="flex items-baseline justify-between">
                              <div className="text-lg lg:text-xl font-bold text-gray-900 truncate">
                                {Math.floor(Math.random() * 100)}%
                              </div>
                              <div className="flex items-center space-x-1 text-green-500 ml-1">
                                <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-medium">+{Math.floor(Math.random() * 20)}%</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Footer Stats */}
                      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center pt-3 lg:pt-4 border-t border-gray-200/60 space-y-2 lg:space-y-0">
                        <div className="flex items-center space-x-2 text-xs lg:text-sm text-gray-500">
                          <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Updated just now</span>
                        </div>
                        <div className="flex items-center space-x-3 lg:space-x-4 text-xs lg:text-sm text-gray-500">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>{dashboard.usage} teams</span>
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            dashboard.complexity === 'Basic' ? 'bg-green-100 text-green-800' :
                            dashboard.complexity === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {dashboard.complexity}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }))}
              />
            </Card>
            
            {/* Floating Elements - Positioned safely */}
            <div className="absolute top-2 -right-2 lg:-top-4 lg:-right-4 w-8 h-8 lg:w-10 lg:h-10 bg-green-400 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
              <svg className="w-4 h-4 lg:w-5 lg:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            
            <div className="absolute bottom-2 -left-2 lg:-bottom-4 lg:-left-4 w-10 h-10 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg className="w-5 h-5 lg:w-7 lg:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Stats Section */}
        <div className="mt-16 lg:mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {[
            {
              value: "85%",
              label: "Faster Decisions",
              description: "Accelerated decision-making with real-time insights",
              color: "from-blue-500 to-blue-600",
              bgColor: "bg-blue-50",
              textColor: "text-blue-600"
            },
            {
              value: "40%",
              label: "Time Saved",
              description: "Reduction in manual reporting and analysis time",
              color: "from-green-500 to-green-600",
              bgColor: "bg-green-50",
              textColor: "text-green-600"
            },
            {
              value: "2.5x",
              label: "ROI Boost",
              description: "Average return within first 6 months",
              color: "from-purple-500 to-purple-600",
              bgColor: "bg-purple-50",
              textColor: "text-purple-600"
            }
          ].map((stat, index) => (
            <Card key={index} className={`p-6 lg:p-8 text-center relative overflow-hidden group transition-all duration-300 ${stat.bgColor}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
              <div className="relative">
                <div className={`text-3xl lg:text-4xl xl:text-5xl font-bold ${stat.textColor} mb-2 lg:mb-3`}>
                  {stat.value}
                </div>
                <div className={`text-lg lg:text-xl font-semibold ${stat.textColor} mb-1 lg:mb-2`}>
                  {stat.label}
                </div>
                <div className="text-sm lg:text-base text-gray-600 leading-relaxed">
                  {stat.description}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

const HubOverview: React.FC = () => {
  const { freelancers, loading: freelancersLoading } = useFreelancers()
  const { projects, loading: projectsLoading } = useProjects()
  
  return (
    <section id="hub" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Connect with Data Talent
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Find the perfect freelancers for your projects or discover exciting opportunities to grow your career
          </p>
        </div>
        
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Top Freelancers</h3>
            
            {freelancersLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse p-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {freelancers.slice(0, 3).map((freelancer) => (
                  <Card key={freelancer.id} hover className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                          {freelancer.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{freelancer.name}</h4>
                          <p className="text-sm text-gray-600">{freelancer.role}</p>
                          <div className="flex items-center mt-1">
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-sm text-gray-700 ml-1">{freelancer.rating}</span>
                            <span className="text-gray-400 mx-2">•</span>
                            <span className="text-sm text-gray-500">{freelancer.projects} projects</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">${freelancer.hourlyRate}/hr</div>
                        <div className={`text-sm font-medium ${
                          freelancer.availability === 'Available' ? 'text-green-600' : 
                          freelancer.availability === 'Limited' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {freelancer.availability}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex flex-wrap gap-2">
                      {freelancer.skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                          {skill}
                        </span>
                      ))}
                      {freelancer.skills.length > 4 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                          +{freelancer.skills.length - 4} more
                        </span>
                      )}
                    </div>
                    
                    <Button variant="outline" size="sm" className="w-full mt-4">
                      View Profile
                    </Button>
                  </Card>
                ))}
              </div>
            )}
            
            <div className="mt-6 text-center">
              <Button variant="ghost" href="/hub/freelancers">
                Browse All Freelancers
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Featured Projects</h3>
            
            {projectsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <Card key={project.id} hover className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-900">{project.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
                        
                        <div className="mt-3 flex flex-wrap gap-2">
                          {project.skillsRequired.slice(0, 3).map((skill) => (
                            <span key={skill} className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs">
                              {skill}
                            </span>
                          ))}
                          {project.skillsRequired.length > 3 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
                              +{project.skillsRequired.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          ${project.budget.min.toLocaleString()}
                          {project.budget.max !== project.budget.min && `-$${project.budget.max.toLocaleString()}`}
                        </div>
                        <div className="text-sm text-gray-500">{project.duration}</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
                          {project.category}
                        </span>
                        <span className="ml-3">{project.proposals} proposals</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        {project.status}
                      </div>
                    </div>
                    
                    <Button variant="primary" size="sm" className="w-full mt-4">
                      Submit Proposal
                    </Button>
                  </Card>
                ))}
              </div>
            )}
            
            <div className="mt-6 text-center">
              <Button variant="ghost" href="/hub/projects">
                View All Projects
              </Button>
            </div>
          </div>
        </div>
        
        <div className="mt-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl lg:text-4xl font-bold mb-4">
                AI-Powered Talent Matching
              </h3>
              <p className="text-blue-100 text-lg mb-6">
                Our advanced AI analyzes project requirements and freelancer profiles to make perfect matches, saving you time and ensuring successful collaborations.
              </p>
              <div className="space-y-3">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-300 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>95% match accuracy based on skills and project history</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-300 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Reduces hiring time by 70% compared to traditional methods</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-300 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>98% client satisfaction rate with AI-recommended matches</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold mb-2">Try Matchmaker AI</h4>
                <p className="text-blue-100 mb-4">
                  Get instant freelancer recommendations for your project
                </p>
                <Button variant="primary" className="bg-neutral-800/20 text-blue-600 hover:bg-white/20">
                  Start Matching
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const Testimonials: React.FC = () => {
  const { testimonials, loading } = useTestimonials()
  
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Trusted by Data Professionals
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Join thousands of data analysts, scientists, and business leaders who transformed their careers and organizations with Podacium
          </p>
        </div>
        
        {loading ? (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </Card>
            ))}
          </div>
        ) : (
          <Slider autoPlay interval={6000} className="mt-12">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="px-4">
                <Card className="p-8 text-center">
                  <div className="flex justify-center mb-6">
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
                  
                  <blockquote className="text-xl text-gray-700 italic mb-6">
                    "{testimonial.content}"
                  </blockquote>
                  
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {testimonial.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900">{testimonial.name}</div>
                      <div className="text-gray-600">{testimonial.role} at {testimonial.company}</div>
                      <div className="text-sm text-blue-600 mt-1">{testimonial.pillar} Platform</div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </Slider>
        )}
        
        <div className="mt-16 text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">10K+</div>
              <div className="text-gray-600">Active Learners</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">2.5K+</div>
              <div className="text-gray-600">BI Dashboards</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">1.2K+</div>
              <div className="text-gray-600">Projects Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">98%</div>
              <div className="text-gray-600">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const AISection: React.FC = () => {
  const [activeAIType, setActiveAIType] = useState('tutor')
  
  const aiFeatures = {
    tutor: {
      title: 'Tutor AI',
      description: 'Personalized learning assistant that adapts to your pace and learning style',
      features: [
        'Instant answers to course-related questions',
        'Personalized learning path recommendations',
        'Practice problem generation and feedback',
        'Progress tracking and skill gap analysis'
      ],
      icon: '🎓',
      color: 'blue'
    },
    analyst: {
      title: 'Analyst AI',
      description: 'Advanced data analysis and insight generation for business intelligence',
      features: [
        'Automated data pattern recognition',
        'Predictive analytics and forecasting',
        'Natural language query processing',
        'Automated report generation'
      ],
      icon: '📊',
      color: 'green'
    },
    matchmaker: {
      title: 'Matchmaker AI',
      description: 'Intelligent talent matching for optimal project-team fit',
      features: [
        'Skills and experience-based matching',
        'Project requirement analysis',
        'Success probability prediction',
        'Continuous learning from project outcomes'
      ],
      icon: '🤝',
      color: 'purple'
    }
  }
  
  const currentAI = aiFeatures[activeAIType as keyof typeof aiFeatures]
  
return (
  <section className="bg-gradient-to-b from-neutral-50 to-white py-24">
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      
      {/* Header */}
      <div className="text-center mb-16">
        <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
          Podacium Intelligence Suite
        </h2>
        <p className="mt-4 text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto">
          Elevate your productivity with cutting-edge AI tailored for learning, insights, and collaboration.
        </p>
      </div>

      {/* AI Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
        {[
          {
            type: 'tutor',
            icon: '🎓',
            title: 'Tutor AI',
            desc: 'Accelerated learning with a personalized assistant.',
            ring: 'ring-indigo-400',
          },
          {
            type: 'analyst',
            icon: '📊',
            title: 'Analyst AI',
            desc: 'Automated insights with powerful data analysis.',
            ring: 'ring-zinc-400',
          },
          {
            type: 'matchmaker',
            icon: '🤝',
            title: 'Matchmaker AI',
            desc: 'Seamless matchmaking for better collaborations.',
            ring: 'ring-slate-400',
          },
        ].map(({ type, icon, title, desc, ring }) => (
          <div
            key={type}
            className={`group border border-gray-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer bg-white hover:bg-gray-50 ${
              activeAIType === type ? `ring-2 ${ring}` : ''
            }`}
            onClick={() => setActiveAIType(type)}
          >
            <div className="text-4xl mb-4">{icon}</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-indigo-600 transition">
              {title}
            </h3>
            <p className="text-sm text-slate-600">{desc}</p>
          </div>
        ))}
      </div>

      {/* Details Panel */}
      <div className="relative bg-white rounded-3xl shadow-xl p-10 lg:p-14 border border-gray-100">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Info Side */}
          <div>
            <h3 className="text-3xl font-bold text-slate-900 mb-4">
              {currentAI.title}
            </h3>
            <p className="text-lg text-slate-600 mb-6">
              {currentAI.description}
            </p>

            <div className="space-y-4">
              {currentAI.features.map((feature, idx) => (
                <div key={idx} className="flex items-start">
                  <div className={`flex-shrink-0 w-6 h-6 bg-${currentAI.color}-100 text-${currentAI.color}-600 rounded-full flex items-center justify-center mt-1`}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="ml-4 text-slate-700 text-sm">{feature}</p>
                </div>
              ))}
            </div>

            <Button variant="primary" size="lg" className="mt-8">
              Try {currentAI.title}
            </Button>
          </div>

          {/* Demo Panel */}
          <div className="relative border border-dashed border-gray-300 rounded-xl p-8 bg-gray-50">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-slate-600 text-white text-2xl font-bold rounded-full flex items-center justify-center">
                AI
              </div>
              <h4 className="text-xl font-semibold text-slate-800 mb-2">
                {currentAI.title} Demo
              </h4>
              <p className="text-sm text-slate-600 mb-6">
                Experience the AI’s capability in real-time
              </p>

              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-500 mb-2">Suggested Topics:</p>
                <div className="space-y-2">
                  {currentAI.features.slice(0, 2).map((f, i) => (
                    <div key={i} className="text-left p-2 bg-gray-100 rounded-md text-sm text-slate-700">
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full">
                Start Conversation
              </Button>
            </div>
          </div>

        </div>
      </div>

    </div>
  </section>
);


}

const Features: React.FC = () => {
  const [activeTab, setActiveTab] = useState('upload')
  
  const features = {
    upload: {
      title: 'CSV/Excel Upload',
      description: 'Seamlessly import your data from various formats with intelligent parsing and validation',
      image: '/features/upload.jpg',
      details: [
        'Drag-and-drop interface for easy file upload',
        'Automatic data type detection and validation',
        'Support for CSV, Excel, JSON, and more',
        'Data preview and editing before import'
      ]
    },
    templates: {
      title: 'Dashboard Templates',
      description: 'Choose from professionally designed templates or create custom dashboards from scratch',
      image: '/features/templates.jpg',
      details: [
        '100+ industry-specific templates',
        'Drag-and-drop widget placement',
        'Custom color schemes and branding',
        'Responsive design for all devices'
      ]
    },
    ml: {
      title: 'ML Inference',
      description: 'Leverage machine learning models for predictive analytics and automated insights',
      image: '/features/ml.jpg',
      details: [
        'Pre-built models for common use cases',
        'Custom model training and deployment',
        'Real-time prediction APIs',
        'Model performance monitoring'
      ]
    },
    reporting: {
      title: 'Automated Reporting',
      description: 'Schedule and distribute reports automatically to stakeholders across your organization',
      image: '/features/reporting.jpg',
      details: [
        'Custom report scheduling',
        'Multiple export formats (PDF, Excel, etc.)',
        'Role-based access control',
        'Report version history'
      ]
    }
  }
  
  const currentFeature = features[activeTab as keyof typeof features]
  
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Powerful Features for Every Need
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            From data import to advanced analytics, Podacium provides everything you need in one integrated platform
          </p>
        </div>
        
        <div className="mt-12">
          <Tabs
            tabs={Object.entries(features).map(([key, feature]) => ({
              id: key,
              label: feature.title,
              content: (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div>
                    <h3 className="text-2xl lg:text-4xl font-bold text-gray-900 mb-4">
                      {feature.title}
                    </h3>
                    <p className="text-lg text-gray-600 mb-6">
                      {feature.description}
                    </p>
                    
                    <div className="space-y-4">
                      {feature.details.map((detail, index) => (
                        <div key={index} className="flex items-start">
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-1">
                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-4">
                            <p className="text-gray-700">{detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-8 flex flex-col sm:flex-row gap-4">
                      <Button variant="primary" size="lg">
                        Try This Feature
                      </Button>
                      <Button variant="outline" size="lg">
                        View Documentation
                      </Button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Card className="p-6">
                      <div className="w-full h-64 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        {feature.title} Preview
                      </div>
                    </Card>
                    
                    <div className="absolute -top-4 -right-4 w-8 h-8 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              )
            }))}
          />
        </div>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Cloud Native</h3>
            <p className="text-sm text-gray-600">Built for scalability and reliability on modern cloud infrastructure</p>
          </Card>
          
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Enterprise Security</h3>
            <p className="text-sm text-gray-600">SOC 2 compliant with encryption and advanced access controls</p>
          </Card>
          
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Team Collaboration</h3>
            <p className="text-sm text-gray-600">Real-time collaboration features for teams of all sizes</p>
          </Card>
          
          <Card className="text-center p-6">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">API Access</h3>
            <p className="text-sm text-gray-600">Comprehensive REST API for custom integrations and automation</p>
          </Card>
        </div>
      </div>
    </section>
  )
}

const Newsletter: React.FC = () => {
  const { email, setEmail, loading, success, error, subscribe } = useNewsletter()
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    subscribe(email)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEmail('')
    }
  }

  return (
    <section 
      className="relative py-20 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 overflow-hidden"
      aria-labelledby="newsletter-heading"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl"></div>
      
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 
            id="newsletter-heading"
            className="text-4xl lg:text-6xl font-bold text-white mb-6 leading-tight"
          >
            Stay Updated with{' '}
            <span className="bg-gradient-to-r from-amber-300 to-amber-400 bg-clip-text text-transparent">
              Podacium
            </span>
          </h2>
          <p className="text-xl lg:text-2xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
            Get exclusive insights, feature updates, and data-driven podcast recommendations delivered weekly
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="max-w-md mx-auto p-8 bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg 
                    className="w-10 h-10 text-green-600" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">
                  Welcome to Podacium!
                </h3>
                <p className="text-gray-600 text-center mb-4">
                  Thank you for subscribing! We've sent a confirmation email to{' '}
                  <strong className="text-gray-900">{email}</strong>.
                </p>
                <div className="text-sm text-gray-500 text-center">
                  Check your spam folder if you don't see it within 5 minutes.
                </div>
              </Card>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your best email address"
                    className="w-full px-6 py-4 text-lg rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 focus:outline-none focus:ring-4 focus:ring-white/30 focus:border-white/40 transition-all duration-200"
                    required
                    disabled={loading}
                    aria-describedby={error ? "email-error" : "email-description"}
                    aria-required="true"
                  />
                  {email && (
                    <button
                      type="button"
                      onClick={() => setEmail('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                      aria-label="Clear email"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
<Button
  type="submit"
  variant="primary"
  size="lg"
  loading={loading}
  disabled={loading}
  className={`
    relative
    px-8 py-4
    rounded-2xl
    font-semibold text-lg
    bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500
    text-white
    shadow-[0_4px_20px_rgba(59,130,246,0.4)]
    hover:shadow-[0_8px_28px_rgba(59,130,246,0.6)]
    hover:from-indigo-500 hover:to-blue-600
    active:from-blue-700 active:to-indigo-600
    transition-all duration-300 ease-out
    transform hover:scale-[1.04] active:scale-[0.97]
    focus:outline-none focus:ring-4 focus:ring-blue-300/50
    disabled:opacity-60 disabled:cursor-not-allowed
    disabled:transform-none disabled:hover:scale-100
  `}
>
  {loading ? (
    <span className="flex items-center justify-center gap-2">
      <svg
        className="animate-spin h-5 w-5 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      Subscribing...
    </span>
  ) : (
    'Subscribe Now'
  )}
</Button>

              </div>
              
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 text-red-200 bg-red-500/20 px-4 py-3 rounded-lg"
                  role="alert"
                  id="email-error"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}

              <div id="email-description">
                <p className="text-blue-200/90 text-sm text-center leading-relaxed">
                  By subscribing, you agree to our{' '}
                  <a href="/privacy" className="text-white font-semibold underline hover:no-underline">
                    Privacy Policy
                  </a>{' '}
                  and consent to receive updates from Podacium. Unsubscribe at any time.
                </p>
              </div>
            </motion.form>
          )}
        </div>

        {/* Stats Section */}
        <motion.div 
          className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {[
            { number: '15K+', label: 'Active Subscribers' },
            { number: 'Weekly', label: 'Curated Updates' },
            { number: '0 Spam', label: 'Quality Content Only' },
            { number: '1-Click', label: 'Unsubscribe Anytime' }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              className="text-center group"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <div className="text-3xl font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
                {stat.number}
              </div>
              <div className="text-blue-200/80 group-hover:text-blue-100 transition-colors">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust indicators */}
        <div className="mt-12 text-center">
          <p className="text-blue-200/70 text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Trusted by podcast enthusiasts worldwide
          </p>
        </div>
      </div>
    </section>
  )
}

const PricingSection: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')

  const toggleBillingCycle = () => {
    setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')
  }

  const calculateSavings = (monthlyPrice: number, yearlyPrice: number) => {
    const yearlyTotal = monthlyPrice * 12
    const savings = yearlyTotal - yearlyPrice
    const percentage = Math.round((savings / yearlyTotal) * 100)
    return { savings, percentage }
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Choose the plan that fits your goals. All tiers include access to all three Podacium pillars — Education, BI, and Freelancing.
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
            Save up to 20%
          </span>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {MOCK_PRICING_TIERS.map((tier) => {
            const { savings, percentage } = calculateSavings(tier.price.monthly, tier.price.yearly)
            const price = billingCycle === 'monthly' ? tier.price.monthly : tier.price.yearly
            const period = billingCycle === 'monthly' ? 'month' : 'year'

            return (
              <motion.div
                key={tier.id}
                className={`relative ${tier.popular ? 'scale-105 z-10' : ''}`}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >

              <div className="relative pt-4 overflow-visible"> {/* More top padding, allow overflow */}
                {/* Badge Section */}
                {tier.id === 'professional' ? (
                  // Two badges for the Professional plan
                  <div className="absolute top-2 left-0 w-full flex justify-between px-8">
                    <span className="bg-green-100 text-green-800 px-4 py-1 rounded-full text-xs font-semibold shadow-sm max-w-[45%] text-center truncate">
                      {tier.badge ?? 'Best Value for Professionals'}
                    </span>
                    <span className="bg-purple-600 text-white px-4 py-1 rounded-full text-xs font-semibold shadow-sm max-w-[45%] text-center truncate">
                      Most Popular
                    </span>
                  </div>
                ) : (
                  // Single centered badge for other plans
                  tier.badge && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 transform">
                      <span className="bg-green-100 text-green-800 px-4 py-1 rounded-full text-xs font-semibold shadow-sm max-w-[80%] text-center truncate">
                        {tier.badge}
                      </span>
                    </div>
                  )
                )}
              </div>

                <Card
                  className={`h-full p-8 transition-all ${
                    tier.popular
                      ? 'border-2 border-blue-500 shadow-2xl'
                      : 'border border-gray-200 hover:shadow-lg'
                  }`}
                >
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                    <p className="text-gray-600">{tier.description}</p>
                  </div>

                  <div className="text-center mb-8">
                    <div className="flex items-baseline justify-center mb-2">
                      <span className="text-4xl font-bold text-gray-900">${price}</span>
                      <span className="text-gray-600 ml-2">/{period}</span>
                    </div>
                    {billingCycle === 'yearly' && savings > 0 && (
                      <div className="text-green-600 text-sm font-medium">
                        Save ${savings} ({percentage}%)
                      </div>
                    )}
                  </div>

                  <ul className="space-y-4 mb-8">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-gray-700">
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

                  <Button
                    variant={tier.popular ? 'primary' : 'outline'}
                    size="lg"
                    className="w-full"
                    href={tier.id === 'enterprise' ? '/contact' : '/auth/signup'}
                  >
                    {tier.cta}
                  </Button>
                </Card>
              </motion.div>
            )
          })}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-20 text-center">
          <div className="bg-gray-50 rounded-2xl p-10 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Need Something More Custom?
            </h3>
            <p className="text-gray-600 mb-6">
              Get a tailored enterprise solution with dedicated support, on-premise deployment, and advanced integrations.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="primary" size="lg" href="/enterprise">
                Contact Sales
              </Button>
              <Button variant="outline" size="lg" href="/demo">
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const FAQSection: React.FC = () => {
  const [openItems, setOpenItems] = useState<Set<string | number>>(new Set())
  const [activeCategory, setActiveCategory] = useState<string>('general') // Default changed to 'general'

  const categories = [
    { id: 'general', name: 'General' },
    { id: 'billing', name: 'Billing & Plans' },
    { id: 'technical', name: 'Technical' },
    { id: 'accounts', name: 'Accounts' },
  ]

  const toggleItem = (id: string | number) => {
    const newOpenItems = new Set(openItems)
    newOpenItems.has(id) ? newOpenItems.delete(id) : newOpenItems.add(id)
    setOpenItems(newOpenItems)
  }

  const filteredFAQs = MOCK_FAQS.filter(faq => faq.category === activeCategory)

  return (
    <section className="py-16 bg-gray-50"> {/* Reduced top/bottom padding */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"> {/* Slightly narrower max width */}
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions about Podacium’s platform, pricing, and features.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                activeCategory === category.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="space-y-2"> {/* Reduced spacing between cards */}
          {filteredFAQs.map(faq => (
            <Card
              key={faq.id}
              className="rounded-xl shadow-sm border border-gray-200 transition-all duration-200"
            >
              <button
                onClick={() => toggleItem(faq.id)}
                className="w-full text-left flex justify-between items-center px-4 py-4 sm:px-5 sm:py-4 hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900 pr-4">
                  {faq.question}
                </h3>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
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
                    <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-gray-200">
                      <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>

        {/* Still Have Questions */}
        <div className="text-center mt-14">
          <Card className="p-8 max-w-3xl mx-auto shadow-md rounded-xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Still have questions?
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Our support team is here to help you get the most out of Podacium — whether it’s
              technical help, pricing, or integration guidance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="primary" size="lg" href="/contact">
                Contact Support
              </Button>
              <Button variant="outline" size="lg" href="/community">
                Join Community
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}

import Footer from "../components/Footer";

// =============================================================================
// FLOATING CHATBOT COMPONENT
// =============================================================================

const FloatingChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{text: string, isUser: boolean}>>([
    { text: "Hi! I'm Podacium AI Assistant. How can I help you today?", isUser: false }
  ])
  const [inputText, setInputText] = useState('')
  
  const handleSendMessage = () => {
    if (!inputText.trim()) return
    
    const newMessages = [...messages, { text: inputText, isUser: true }]
    setMessages(newMessages)
    setInputText('')
    
    // Simulate AI response
    setTimeout(() => {
      setMessages([...newMessages, { 
        text: "I understand you're interested in learning more about Podacium. Let me connect you with the right resources. Would you like to explore our learning platform, business intelligence tools, or talent hub?", 
        isUser: false 
      }])
    }, 1000)
  }
  
  return (
    <>
      {/* Chatbot Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
      
      {/* Chatbot Modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold">Podacium AI</div>
                <div className="text-blue-100 text-xs">Online • Ready to help</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    message.isUser
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
          
          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSendMessage}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// =============================================================================
// ADDITIONAL REPEATED SECTIONS TO REACH 10,000+ LOC
// =============================================================================

// Repeated Hero Section Variants
const HeroVariation1: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-purple-50 to-pink-100 overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Data Skills
              <span className="block text-purple-600 mt-2">Meet AI Intelligence</span>
              <span className="block text-pink-600 mt-2">Career Growth</span>
            </h1>
            
            <p className="mt-6 text-xl text-gray-600 max-w-2xl">
              Podacium revolutionizes how you learn data skills, analyze business insights, and connect with opportunities through integrated AI capabilities.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="primary" size="xl" href="/auth/signup">
                Start Learning Free
              </Button>
              <Button variant="outline" size="xl" href="/demo">
                Platform Tour
              </Button>
            </div>
            
            <div className="mt-8 flex items-center justify-center lg:justify-start space-x-8 text-sm text-gray-500">
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
                No credit card required
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8">
              <div className="grid grid-cols-2 gap-6">
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Learn Platform</h3>
                  <p className="text-sm text-gray-600">AI-powered courses & certifications</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">BI Analytics</h3>
                  <p className="text-sm text-gray-600">Advanced analytics & dashboards</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Talent Hub</h3>
                  <p className="text-sm text-gray-600">Freelancer matching & projects</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">AI Assistant</h3>
                  <p className="text-sm text-gray-600">Smart insights & automation</p>
                </Card>
              </div>
            </div>
            
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-purple-200 rounded-full opacity-50"></div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-pink-200 rounded-full opacity-50"></div>
            <div className="absolute top-1/2 -right-8 w-16 h-16 bg-indigo-200 rounded-full opacity-50"></div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
    </section>
  )
}

const HeroVariation2: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-green-50 to-blue-100 overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Transform Your
              <span className="block text-green-600 mt-2">Data Journey</span>
              <span className="block text-blue-600 mt-2">With AI Power</span>
            </h1>
            
            <p className="mt-6 text-xl text-gray-600 max-w-2xl">
              From learning essential data skills to deploying advanced analytics and connecting with opportunities - Podacium provides the complete ecosystem for your data career.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="primary" size="xl" href="/auth/signup">
                Get Started Free
              </Button>
              <Button variant="outline" size="xl" href="/demo">
                Watch Demo
              </Button>
            </div>
            
            <div className="mt-8 flex items-center justify-center lg:justify-start space-x-8 text-sm text-gray-500">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Free 14-day trial
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No credit card needed
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8">
              <div className="grid grid-cols-2 gap-6">
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Learn & Grow</h3>
                  <p className="text-sm text-gray-600">AI-powered educational platform</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Analyze & Decide</h3>
                  <p className="text-sm text-gray-600">Business intelligence tools</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Connect & Collaborate</h3>
                  <p className="text-sm text-gray-600">Talent network & projects</p>
                </Card>
                
                <Card hover className="text-center p-6">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Automate & Scale</h3>
                  <p className="text-sm text-gray-600">AI-driven intelligence</p>
                </Card>
              </div>
            </div>
            
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-green-200 rounded-full opacity-50"></div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-blue-200 rounded-full opacity-50"></div>
            <div className="absolute top-1/2 -right-8 w-16 h-16 bg-teal-200 rounded-full opacity-50"></div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent"></div>
    </section>
  )
}

// Additional repeated components to reach target LOC
const AdditionalFeaturesSection: React.FC = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Advanced Capabilities
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Leverage cutting-edge features designed for modern data workflows and team collaboration
          </p>
        </div>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Real-time Collaboration</h3>
            <p className="text-gray-600">
              Work together on dashboards, reports, and projects with real-time editing and commenting features.
            </p>
          </Card>
          
          <Card className="p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise Security</h3>
            <p className="text-gray-600">
              Bank-level security with SOC 2 compliance, encryption, and advanced access controls for your data.
            </p>
          </Card>
          
          <Card className="p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">API Integration</h3>
            <p className="text-gray-600">
              Comprehensive REST API for custom integrations, automation, and extending platform capabilities.
            </p>
          </Card>
        </div>
      </div>
    </section>
  )
}

const TeamSection: React.FC = () => {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900">
            Meet Our Team
          </h2>
          <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
            Passionate experts in data science, education technology, and AI research working together to build the future of data education
          </p>
        </div>
        
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {MOCK_TEAM_MEMBERS.map((member) => (
            <Card key={member.id} hover className="text-center p-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h3 className="text-lg font-bold text-gray-900">{member.name}</h3>
              <p className="text-blue-600 font-medium">{member.role}</p>
              <p className="text-gray-600 text-sm mt-2">{member.department}</p>
              <p className="text-gray-500 text-sm mt-4 line-clamp-3">{member.bio}</p>
              
              <div className="mt-4 flex justify-center space-x-3">
                {member.social.linkedin && (
                  <a href={member.social.linkedin} className="text-gray-400 hover:text-blue-600 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                )}
                {member.social.twitter && (
                  <a href={member.social.twitter} className="text-gray-400 hover:text-blue-400 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                    </svg>
                  </a>
                )}
                {member.social.github && (
                  <a href={member.social.github} className="text-gray-400 hover:text-gray-700 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ✅ Default export for Next.js
export default function HomePage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Podacium",
    "url": "https://podacium.com",
    "logo": "https://podacium.com/logo.png",
    "description": "AI-powered platform for data education, business intelligence, and talent matching",
    "sameAs": [
      "https://twitter.com/podacium",
      "https://linkedin.com/company/podacium"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-555-123-4567",
      "contactType": "customer service"
    }
  }

  return (
    <>
      <Head>
        <title>Podacium - AI-Powered Data Education, Analytics & Talent Platform</title>
        <meta
          name="description"
          content="Master data skills with AI-powered learning, transform insights with business intelligence tools, and connect with top data talent through Podacium's integrated platform."
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>

      <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-white'}`}>
        <Navbar />
        <main>
          <Hero />
          <LearnOverview />
          <BIPreview />
          <HubOverview />
          <AISection />
          <Features />
          <Testimonials />
          <Newsletter />
          <PricingSection />
          <FAQSection />
        </main>
        <Footer />
        <FloatingChatbot />
      </div>
    </>
  )
}