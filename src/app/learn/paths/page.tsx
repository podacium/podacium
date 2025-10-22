'use client'

import React, { useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Search, Filter, Clock, Users, BookOpen, Target, Star, ArrowRight, CheckCircle, Play, Lock, Award, Zap, TrendingUp, BarChart3, Brain, Cpu, Rocket, Briefcase, Lightbulb, Crown, MessageSquare, Network } from 'lucide-react'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'
import type { Variants, Easing } from "framer-motion"


// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

interface Lesson {
  id: string
  title: string
  description: string
  duration: string
  isCompleted?: boolean
  isLocked?: boolean
  videoUrl?: string
  resources?: string[]
}

interface Module {
  id: string
  title: string
  description: string
  duration: string
  lessons: Lesson[]
  icon: string
  category: string
  order: number
  isCompleted?: boolean
  progress?: number
}

interface LearningPath {
  id: string
  title: string
  description: string
  fullDescription: string
  duration: string
  totalModules: number
  totalLessons: number
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Mixed'
  skills: string[]
  color: string
  gradient: string
  icon: string
  enrolled: number
  rating: number
  projects: number
  certificate: boolean
  weeklyHours: string
  link: string
  popularity: 'low' | 'medium' | 'high' | 'very high'
  trend: 'up' | 'down' | 'stable'
  isNew: boolean
  isFeatured: boolean
  progress: number
  startDate: string
  modules: Module[]
  category: string
  gradientStart?: string;
  gradientEnd?: string;
  gradientAccent?: string;
}

// =============================================================================
// MOCK DATA - COMPREHENSIVE LEARNING PATHS
// =============================================================================

const COMPREHENSIVE_LEARNING_PATHS: LearningPath[] = [
  {
    id: '1',
    title: 'Data Explorer',
    description: 'Master data analysis and visualization to extract meaningful insights from complex datasets.',
    fullDescription: 'Become proficient in data analysis and visualization techniques that transform raw data into actionable insights. This path covers everything from basic data literacy to advanced visualization methods, empowering you to make data-driven decisions with confidence.',
    duration: '6 months',
    totalModules: 5,
    totalLessons: 29,
    level: 'Beginner',
    skills: ['SQL', 'Python', 'Data Visualization', 'Statistical Analysis', 'Excel', 'Data Ethics', 'Storytelling'],
    color: 'from-blue-500 to-cyan-600',
    gradient: 'bg-gradient-to-br from-blue-500 to-cyan-600',
    icon: '📊',
    enrolled: 12470,
    rating: 4.8,
    projects: 8,
    certificate: true,
    weeklyHours: '6-8 hours',
    link: '/learn/paths/01',
    popularity: 'high',
    trend: 'up',
    isNew: false,
    isFeatured: true,
    progress: 0,
    startDate: '2024-01-15',
    category: 'Data & AI',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'de-1',
        title: 'Data Literacy & Ethics',
        description: 'Understand data fundamentals, privacy concerns, and ethical considerations in data handling.',
        duration: '5 hours',
        lessons: [
          {
            id: 'de-1-1',
            title: 'Introduction to Data Concepts',
            description: 'Learn fundamental data types, structures, and their real-world applications.',
            duration: '45 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-1-2',
            title: 'Data Privacy Fundamentals',
            description: 'Understand privacy laws and ethical considerations in data collection and usage.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-1-3',
            title: 'Data Governance Principles',
            description: 'Explore frameworks for managing data quality, security, and compliance.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-1-4',
            title: 'Ethical Data Decision Making',
            description: 'Apply ethical frameworks to real-world data scenarios and case studies.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-1-5',
            title: 'Data Ethics Case Studies',
            description: 'Analyze real-world examples of ethical challenges in data-driven organizations.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📚',
        category: 'Data & AI',
        order: 2,
        progress: 0
      },
      {
        id: 'de-2',
        title: 'Spreadsheets & SQL Basics',
        description: 'Master essential data manipulation skills using spreadsheets and basic SQL queries.',
        duration: '6 hours',
        lessons: [
          {
            id: 'de-2-1',
            title: 'Advanced Spreadsheet Functions',
            description: 'Master complex formulas, pivot tables, and data analysis in Excel/Sheets.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-2-2',
            title: 'SQL Query Fundamentals',
            description: 'Learn basic SELECT statements, filtering, and sorting data in databases.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-2-3',
            title: 'Data Filtering Techniques',
            description: 'Master WHERE clauses, pattern matching, and conditional filtering.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-2-4',
            title: 'Aggregate Functions & Grouping',
            description: 'Use SUM, COUNT, AVG and GROUP BY for data summarization.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-2-5',
            title: 'Joining Multiple Data Tables',
            description: 'Understand INNER JOIN, LEFT JOIN and combining datasets.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-2-6',
            title: 'Practical SQL Exercises',
            description: 'Apply SQL skills to solve real-world data analysis problems.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📊',
        category: 'Data & AI',
        order: 3,
        progress: 0
      },
      {
        id: 'de-3',
        title: 'Data Visualization & Storytelling',
        description: 'Learn to create compelling visualizations and tell stories with data.',
        duration: '7 hours',
        lessons: [
          {
            id: 'de-3-1',
            title: 'Principles of Data Visualization',
            description: 'Learn fundamental principles for creating effective and accurate visualizations.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-3-2',
            title: 'Choosing the Right Chart Types',
            description: 'Match visualization types to different data stories and analysis goals.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-3-3',
            title: 'Color Theory & Design Principles',
            description: 'Apply color psychology and design best practices to visualizations.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-3-4',
            title: 'Data Storytelling Framework',
            description: 'Structure compelling narratives that guide audiences through data insights.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-3-5',
            title: 'Interactive Visualization Tools',
            description: 'Create dynamic and interactive charts using modern visualization libraries.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-3-6',
            title: 'Audience Engagement Strategies',
            description: 'Tailor visualizations and stories to different stakeholder groups.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-3-7',
            title: 'Dashboard Design Best Practices',
            description: 'Create comprehensive dashboards that drive decision-making.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📈',
        category: 'Data & AI',
        order: 4,
        progress: 0
      },
      {
        id: 'de-4',
        title: 'Applied Data Exploration Project',
        description: 'Hands-on project exploring real datasets to uncover insights and patterns.',
        duration: '7 hours',
        lessons: [
          {
            id: 'de-4-1',
            title: 'Project Setup & Data Acquisition',
            description: 'Set up your analysis environment and source relevant datasets.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-4-2',
            title: 'Data Cleaning & Preparation',
            description: 'Clean and transform raw data for analysis using best practices.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-4-3',
            title: 'Exploratory Data Analysis',
            description: 'Perform comprehensive exploration to understand data patterns and relationships.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-4-4',
            title: 'Statistical Analysis Techniques',
            description: 'Apply statistical methods to validate findings and insights.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-4-5',
            title: 'Visualization Development',
            description: 'Create comprehensive visualizations that tell the data story.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-4-6',
            title: 'Insight Generation & Synthesis',
            description: 'Synthesize findings into actionable business insights.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'de-4-7',
            title: 'Final Presentation & Documentation',
            description: 'Prepare and present your findings to stakeholders.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🔍',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '2',
    title: 'Business Intelligence Analyst',
    description: 'Transform raw data into actionable business intelligence that drives strategic decisions.',
    fullDescription: 'Learn to bridge the gap between data and business strategy by creating powerful BI solutions. This path covers data cleaning, KPI development, dashboard design, and advanced BI tools.',
    duration: '7 months',
    totalModules: 6,
    totalLessons: 30,
    level: 'Intermediate',
    skills: ['Power BI', 'Tableau', 'SQL', 'Data Modeling', 'KPI Development', 'Dashboard Design', 'Business Metrics'],
    color: 'from-blue-600 to-indigo-700',
    gradient: 'bg-gradient-to-br from-blue-600 to-indigo-700',
    icon: '📈',
    enrolled: 8920,
    rating: 4.7,
    projects: 7,
    certificate: true,
    weeklyHours: '7-9 hours',
    link: '/learn/paths/02',
    popularity: 'medium',
    trend: 'up',
    isNew: true,
    isFeatured: false,
    progress: 0,
    startDate: '2024-02-01',
    category: 'Data & AI',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'bi-1',
        title: 'Data Cleaning & Preparation',
        description: 'Master techniques for cleaning, transforming, and preparing data for analysis.',
        duration: '6 hours',
        lessons: [
          {
            id: 'bi-1-1',
            title: 'Data Quality Assessment',
            description: 'Evaluate data quality and identify common data issues.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-1-2',
            title: 'Data Cleaning Techniques',
            description: 'Master techniques for handling missing values and outliers.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-1-3',
            title: 'Data Transformation Methods',
            description: 'Learn to reshape and transform data for analysis.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-1-4',
            title: 'Data Validation & Quality Checks',
            description: 'Implement validation rules and quality assurance processes.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-1-5',
            title: 'Automation of Data Processes',
            description: 'Create automated workflows for repetitive data tasks.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-1-6',
            title: 'Data Preparation Best Practices',
            description: 'Establish standards and documentation for data preparation.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🧹',
        category: 'Data & AI',
        order: 2,
        progress: 0
      },
      {
        id: 'bi-2',
        title: 'Business Metrics & KPIs',
        description: 'Learn to define, track, and analyze key business performance indicators.',
        duration: '6 hours',
        lessons: [
          {
            id: 'bi-2-1',
            title: 'KPI Framework Development',
            description: 'Design comprehensive KPI frameworks aligned with business objectives.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-2-2',
            title: 'Performance Tracking Systems',
            description: 'Implement systems to monitor and track KPIs effectively.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-2-3',
            title: 'Goal Setting & Target Management',
            description: 'Set realistic targets and manage performance against goals.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-2-4',
            title: 'Industry Standard Metrics',
            description: 'Understand common KPIs across different industries and functions.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-2-5',
            title: 'KPI Visualization Techniques',
            description: 'Create effective visualizations for different types of KPIs.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-2-6',
            title: 'KPI Reporting Best Practices',
            description: 'Develop comprehensive reporting frameworks for stakeholders.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🎯',
        category: 'Business & Strategy',
        order: 3,
        progress: 0
      },
      {
        id: 'bi-3',
        title: 'Dashboard Design Principles',
        description: 'Design effective and user-friendly dashboards that drive business decisions.',
        duration: '6 hours',
        lessons: [
          {
            id: 'bi-3-1',
            title: 'UI/UX Principles for Dashboards',
            description: 'Apply user-centered design principles to dashboard creation.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-3-2',
            title: 'Information Hierarchy & Layout',
            description: 'Design intuitive layouts that guide users through information.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-3-3',
            title: 'User Testing & Feedback Integration',
            description: 'Conduct user testing and incorporate feedback into designs.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-3-4',
            title: 'Iterative Design Process',
            description: 'Implement continuous improvement cycles for dashboard design.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-3-5',
            title: 'Accessibility & Inclusivity',
            description: 'Design dashboards that are accessible to diverse user groups.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-3-6',
            title: 'Mobile & Responsive Design',
            description: 'Create dashboards that work across different devices and screen sizes.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📱',
        category: 'Technology',
        order: 4,
        progress: 0
      },
      {
        id: 'bi-4',
        title: 'Advanced BI Tools (Power BI, Tableau)',
        description: 'Master industry-leading BI tools for advanced analytics and visualization.',
        duration: '6 hours',
        lessons: [
          {
            id: 'bi-4-1',
            title: 'Power BI Fundamentals',
            description: 'Master the core features and capabilities of Power BI.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-4-2',
            title: 'Tableau Core Concepts',
            description: 'Learn essential Tableau features for data visualization.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-4-3',
            title: 'Advanced Calculations & Measures',
            description: 'Create complex calculations and custom measures in BI tools.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-4-4',
            title: 'Custom Visual Development',
            description: 'Build and customize visualizations to meet specific business needs.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-4-5',
            title: 'Data Modeling in BI Tools',
            description: 'Create efficient data models and relationships within BI platforms.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-4-6',
            title: 'Tool Integration & Automation',
            description: 'Integrate BI tools with other systems and automate reporting.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🛠️',
        category: 'Data & AI',
        order: 5,
        progress: 0
      },
      {
        id: 'bi-5',
        title: 'Real-World BI Case Study',
        description: 'Complete BI project from data sourcing to dashboard deployment.',
        duration: '6 hours',
        lessons: [
          {
            id: 'bi-5-1',
            title: 'End-to-End Project Planning',
            description: 'Plan and scope a comprehensive BI project from start to finish.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-5-2',
            title: 'Stakeholder Management',
            description: 'Engage stakeholders and manage expectations throughout the project.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-5-3',
            title: 'Data Integration & ETL Processes',
            description: 'Implement complete data integration and transformation pipelines.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-5-4',
            title: 'Dashboard Development & Testing',
            description: 'Build and thoroughly test interactive dashboards.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-5-5',
            title: 'Deployment & User Training',
            description: 'Deploy solutions and train end-users effectively.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'bi-5-6',
            title: 'Documentation & Maintenance',
            description: 'Create comprehensive documentation and establish maintenance processes.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🏢',
        category: 'Applied Practice',
        order: 6,
        progress: 0
      }
    ]
  },
  {
    id: '3',
    title: 'AI Thinker',
    description: 'Develop comprehensive understanding of AI concepts and practical applications.',
    fullDescription: 'Explore the philosophical foundations, cognitive systems, and ethical implications of artificial intelligence. This path takes you beyond technical implementation to understand how AI systems think, learn, and impact society.',
    duration: '7 months',
    totalModules: 5,
    totalLessons: 29,
    level: 'Intermediate',
    skills: ['Machine Learning', 'Neural Networks', 'AI Ethics', 'Python', 'Algorithm Design', 'Cognitive Science', 'Philosophy'],
    color: 'from-purple-600 to-indigo-700',
    gradient: 'bg-gradient-to-br from-purple-600 to-indigo-700',
    icon: '🧠',
    enrolled: 15630,
    rating: 4.9,
    projects: 6,
    certificate: true,
    weeklyHours: '8-10 hours',
    link: '/learn/paths/03',
    popularity: 'high',
    trend: 'up',
    isNew: false,
    isFeatured: true,
    progress: 0,
    startDate: '2024-01-20',
    category: 'Data & AI',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'ait-1',
        title: 'Philosophy & Logic of AI',
        description: 'Explore the philosophical underpinnings and logical foundations of artificial intelligence.',
        duration: '5 hours',
        lessons: [
          {
            id: 'ait-1-1',
            title: 'History of AI & Philosophical Roots',
            description: 'Trace the evolution of AI from philosophical concepts to modern implementations.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-1-2',
            title: 'Symbolic AI & Logic Systems',
            description: 'Understand symbolic reasoning and logical foundations of early AI systems.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-1-3',
            title: 'Consciousness & Machine Intelligence',
            description: 'Explore theories of consciousness and their relevance to AI development.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-1-4',
            title: 'The Turing Test & Beyond',
            description: 'Examine intelligence tests and their limitations in evaluating AI systems.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-1-5',
            title: 'Philosophical Debates in AI',
            description: 'Analyze key philosophical questions surrounding artificial intelligence.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🤔',
        category: 'Philosophy & Ethics',
        order: 2,
        progress: 0
      },
      {
        id: 'ait-2',
        title: 'Cognitive Systems & Human-Machine Thinking',
        description: 'Study how AI systems mimic and augment human cognitive processes.',
        duration: '6 hours',
        lessons: [
          {
            id: 'ait-2-1',
            title: 'Human Cognition & AI Parallels',
            description: 'Compare human cognitive processes with AI system architectures.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-2-2',
            title: 'Neural Networks & Brain Analogies',
            description: 'Explore how artificial neural networks relate to biological neural systems.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-2-3',
            title: 'Learning Theories in AI Systems',
            description: 'Understand different learning paradigms and their cognitive counterparts.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-2-4',
            title: 'Decision-Making Systems',
            description: 'Study how AI systems make decisions compared to human reasoning.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-2-5',
            title: 'Creativity & AI Generation',
            description: 'Examine AI capabilities in creative tasks and problem-solving.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-2-6',
            title: 'Human-AI Collaboration Models',
            description: 'Learn frameworks for effective collaboration between humans and AI systems.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🧩',
        category: 'Cognitive Science',
        order: 3,
        progress: 0
      },
      {
        id: 'ait-3',
        title: 'Ethical AI & Societal Implications',
        description: 'Investigate the ethical considerations and societal impacts of AI technologies.',
        duration: '6 hours',
        lessons: [
          {
            id: 'ait-3-1',
            title: 'AI Bias & Fairness',
            description: 'Understand sources of bias in AI systems and mitigation strategies.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-3-2',
            title: 'Privacy & Surveillance Concerns',
            description: 'Examine privacy implications of AI technologies and data collection.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-3-3',
            title: 'AI in Social Systems',
            description: 'Analyze how AI impacts social structures and community dynamics.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-3-4',
            title: 'Economic Impact & Job Transformation',
            description: 'Study AI effects on employment and economic systems.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-3-5',
            title: 'Regulatory Frameworks & Governance',
            description: 'Explore legal and regulatory approaches to AI oversight.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-3-6',
            title: 'Global AI Policy Perspectives',
            description: 'Compare different national and international approaches to AI governance.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '⚖️',
        category: 'Ethics & Society',
        order: 4,
        progress: 0
      },
      {
        id: 'ait-4',
        title: 'Reflective AI Project',
        description: 'Apply philosophical and ethical frameworks to analyze real-world AI systems.',
        duration: '8 hours',
        lessons: [
          {
            id: 'ait-4-1',
            title: 'Project Scope & System Selection',
            description: 'Define project parameters and select AI systems for analysis.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-4-2',
            title: 'Ethical Framework Application',
            description: 'Apply ethical frameworks to evaluate selected AI systems.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-4-3',
            title: 'Cognitive Process Analysis',
            description: 'Analyze how AI systems mimic or differ from human cognition.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-4-4',
            title: 'Societal Impact Assessment',
            description: 'Evaluate broader societal implications of the AI systems studied.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-4-5',
            title: 'Stakeholder Perspective Analysis',
            description: 'Consider impacts from multiple stakeholder viewpoints.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-4-6',
            title: 'Alternative Design Considerations',
            description: 'Propose alternative approaches to address identified issues.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-4-7',
            title: 'Policy Recommendation Development',
            description: 'Develop policy recommendations based on analysis findings.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'ait-4-8',
            title: 'Final Reflection & Presentation',
            description: 'Synthesize findings and present comprehensive analysis.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🔍',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '4',
    title: 'Machine Builder',
    description: 'Build and deploy machine learning models to solve real-world problems.',
    fullDescription: 'Gain hands-on experience in developing, training, and deploying machine learning models. This path covers everything from Python programming to advanced neural networks and practical ML project implementation.',
    duration: '8 months',
    totalModules: 5,
    totalLessons: 28,
    level: 'Intermediate',
    skills: ['Python', 'Scikit-learn', 'TensorFlow', 'Neural Networks', 'Model Deployment', 'Data Preprocessing', 'MLOps'],
    color: 'from-green-600 to-emerald-700',
    gradient: 'bg-gradient-to-br from-green-600 to-emerald-700',
    icon: '⚙️',
    enrolled: 11320,
    rating: 4.6,
    projects: 5,
    certificate: true,
    weeklyHours: '8-10 hours',
    link: '/learn/paths/04',
    popularity: 'medium',
    trend: 'up',
    isNew: false,
    isFeatured: false,
    progress: 0,
    startDate: '2024-02-15',
    category: 'Data & AI',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'mb-1',
        title: 'Python for Machine Learning',
        description: 'Master Python programming fundamentals essential for machine learning development.',
        duration: '5 hours',
        lessons: [
          {
            id: 'mb-1-1',
            title: 'Python Syntax & Data Structures',
            description: 'Learn essential Python syntax and data structures for ML applications.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-1-2',
            title: 'NumPy for Numerical Computing',
            description: 'Master NumPy arrays and operations for efficient numerical computations.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-1-3',
            title: 'Pandas for Data Manipulation',
            description: 'Learn data manipulation and analysis with Pandas DataFrames.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-1-4',
            title: 'Data Visualization with Matplotlib',
            description: 'Create effective visualizations for data exploration and model evaluation.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-1-5',
            title: 'Python Functions & Classes for ML',
            description: 'Build reusable code structures for machine learning pipelines.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🐍',
        category: 'Programming',
        order: 2,
        progress: 0
      },
      {
        id: 'mb-2',
        title: 'Core ML Algorithms & Models',
        description: 'Understand and implement fundamental machine learning algorithms.',
        duration: '6 hours',
        lessons: [
          {
            id: 'mb-2-1',
            title: 'Linear Regression & Model Evaluation',
            description: 'Implement linear models and learn evaluation metrics for regression.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-2-2',
            title: 'Classification Algorithms',
            description: 'Master logistic regression, SVM, and decision trees for classification.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-2-3',
            title: 'Clustering & Unsupervised Learning',
            description: 'Implement K-means and hierarchical clustering algorithms.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-2-4',
            title: 'Model Selection & Hyperparameter Tuning',
            description: 'Learn cross-validation and hyperparameter optimization techniques.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-2-5',
            title: 'Ensemble Methods',
            description: 'Implement random forests and gradient boosting algorithms.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-2-6',
            title: 'Model Interpretation & Explainability',
            description: 'Learn techniques to interpret and explain model predictions.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📊',
        category: 'Machine Learning',
        order: 3,
        progress: 0
      },
      {
        id: 'mb-3',
        title: 'Neural Networks & Deep Learning',
        description: 'Dive into deep learning with neural networks and advanced architectures.',
        duration: '7 hours',
        lessons: [
          {
            id: 'mb-3-1',
            title: 'Neural Network Fundamentals',
            description: 'Understand perceptrons, activation functions, and backpropagation.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-3-2',
            title: 'Building Neural Networks with TensorFlow',
            description: 'Create and train neural networks using TensorFlow/Keras.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-3-3',
            title: 'Convolutional Neural Networks',
            description: 'Implement CNNs for image recognition and computer vision tasks.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-3-4',
            title: 'Recurrent Neural Networks',
            description: 'Build RNNs and LSTMs for sequence data and time series analysis.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-3-5',
            title: 'Transfer Learning & Pre-trained Models',
            description: 'Leverage pre-trained models for efficient deep learning applications.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-3-6',
            title: 'Regularization & Optimization Techniques',
            description: 'Apply dropout, batch normalization, and advanced optimizers.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-3-7',
            title: 'Model Deployment Considerations',
            description: 'Prepare models for production deployment and scaling.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🧠',
        category: 'Deep Learning',
        order: 4,
        progress: 0
      },
      {
        id: 'mb-4',
        title: 'Mini ML Project',
        description: 'End-to-end machine learning project from data collection to model deployment.',
        duration: '6 hours',
        lessons: [
          {
            id: 'mb-4-1',
            title: 'Problem Definition & Data Collection',
            description: 'Define ML problem and gather relevant datasets for analysis.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-4-2',
            title: 'Exploratory Data Analysis',
            description: 'Perform comprehensive EDA to understand data characteristics.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-4-3',
            title: 'Feature Engineering & Selection',
            description: 'Create and select meaningful features for model training.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-4-4',
            title: 'Model Training & Evaluation',
            description: 'Train multiple models and evaluate their performance systematically.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-4-5',
            title: 'Model Optimization & Tuning',
            description: 'Optimize best-performing model through hyperparameter tuning.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'mb-4-6',
            title: 'Deployment & Documentation',
            description: 'Deploy final model and create comprehensive documentation.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🚀',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '5',
    title: 'Applied AI Innovator',
    description: 'Bridge AI technology with real-world applications and innovative solutions.',
    fullDescription: 'Learn to identify opportunities for AI application and develop innovative solutions that create real value. This path focuses on product thinking, deployment strategies, and understanding AI impact across industries.',
    duration: '7 months',
    totalModules: 5,
    totalLessons: 28,
    level: 'Advanced',
    skills: ['Product Management', 'AI Strategy', 'Deployment', 'Industry Analysis', 'Innovation Frameworks', 'Stakeholder Management'],
    color: 'from-orange-500 to-red-600',
    gradient: 'bg-gradient-to-br from-orange-500 to-red-600',
    icon: '💡',
    enrolled: 8450,
    rating: 4.7,
    projects: 4,
    certificate: true,
    weeklyHours: '7-9 hours',
    link: '/learn/paths/05',
    popularity: 'medium',
    trend: 'up',
    isNew: true,
    isFeatured: false,
    progress: 0,
    startDate: '2024-03-01',
    category: 'Business & Strategy',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'aai-1',
        title: 'AI Systems & Product Thinking',
        description: 'Develop product mindset for creating AI-powered solutions that deliver user value.',
        duration: '5 hours',
        lessons: [
          {
            id: 'aai-1-1',
            title: 'AI Product Lifecycle',
            description: 'Understand end-to-end lifecycle of AI-powered products and services.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-1-2',
            title: 'User-Centered AI Design',
            description: 'Apply human-centered design principles to AI system development.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-1-3',
            title: 'Value Proposition Development',
            description: 'Define clear value propositions for AI solutions across different domains.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-1-4',
            title: 'Minimum Viable AI Products',
            description: 'Learn rapid prototyping and MVP development for AI applications.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-1-5',
            title: 'Product-Market Fit for AI',
            description: 'Identify and validate product-market fit for AI-powered solutions.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🎯',
        category: 'Product Management',
        order: 2,
        progress: 0
      },
      {
        id: 'aai-2',
        title: 'From Prototype to Deployment',
        description: 'Master the process of taking AI solutions from concept to production deployment.',
        duration: '6 hours',
        lessons: [
          {
            id: 'aai-2-1',
            title: 'Technical Feasibility Assessment',
            description: 'Evaluate technical feasibility and resource requirements for AI projects.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-2-2',
            title: 'Scalability & Infrastructure Planning',
            description: 'Design scalable architectures and plan infrastructure needs.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-2-3',
            title: 'Deployment Strategies & CI/CD',
            description: 'Implement continuous integration and deployment for AI systems.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-2-4',
            title: 'Monitoring & Maintenance Systems',
            description: 'Establish monitoring, logging, and maintenance procedures.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-2-5',
            title: 'Performance Optimization',
            description: 'Optimize AI system performance and resource utilization.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-2-6',
            title: 'Security & Compliance Considerations',
            description: 'Address security, privacy, and regulatory compliance requirements.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🚀',
        category: 'Technology',
        order: 3,
        progress: 0
      },
      {
        id: 'aai-3',
        title: 'AI in Industry & Society',
        description: 'Explore AI applications across different industries and their societal impacts.',
        duration: '7 hours',
        lessons: [
          {
            id: 'aai-3-1',
            title: 'Healthcare AI Applications',
            description: 'Examine AI use cases in healthcare, diagnostics, and treatment planning.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-3-2',
            title: 'Financial Services & AI',
            description: 'Explore AI applications in banking, insurance, and financial markets.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-3-3',
            title: 'Retail & E-commerce AI',
            description: 'Study AI in customer experience, recommendation systems, and supply chain.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-3-4',
            title: 'Manufacturing & Industrial AI',
            description: 'Learn about AI in predictive maintenance, quality control, and automation.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-3-5',
            title: 'Education & Learning Technologies',
            description: 'Explore AI applications in personalized learning and educational tools.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-3-6',
            title: 'Environmental & Sustainability AI',
            description: 'Study AI applications in climate science and environmental protection.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-3-7',
            title: 'Cross-Industry Innovation Patterns',
            description: 'Identify patterns and transferable innovations across different sectors.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🏭',
        category: 'Industry Applications',
        order: 4,
        progress: 0
      },
      {
        id: 'aai-4',
        title: 'Innovation Capstone Project',
        description: 'Develop and present a comprehensive AI innovation proposal for real-world impact.',
        duration: '6 hours',
        lessons: [
          {
            id: 'aai-4-1',
            title: 'Opportunity Identification & Research',
            description: 'Identify and research potential AI innovation opportunities.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-4-2',
            title: 'Solution Design & Architecture',
            description: 'Design comprehensive solution architecture and technical approach.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-4-3',
            title: 'Business Case Development',
            description: 'Create detailed business case with ROI analysis and implementation plan.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-4-4',
            title: 'Stakeholder Analysis & Engagement',
            description: 'Identify stakeholders and develop engagement strategies.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-4-5',
            title: 'Risk Assessment & Mitigation',
            description: 'Analyze risks and develop comprehensive mitigation strategies.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aai-4-6',
            title: 'Final Proposal & Presentation',
            description: 'Prepare and deliver compelling innovation proposal to stakeholders.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📋',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '6',
    title: 'Builder',
    description: 'Master full-stack development and create AI-integrated digital products.',
    fullDescription: 'Learn to build complete web applications with integrated AI capabilities. This path covers frontend and backend development, database design, API integration, and deploying AI-powered features in production environments.',
    duration: '8 months',
    totalModules: 5,
    totalLessons: 29,
    level: 'Intermediate',
    skills: ['JavaScript', 'React', 'Node.js', 'Python', 'APIs', 'Database Design', 'Cloud Deployment'],
    color: 'from-yellow-500 to-orange-600',
    gradient: 'bg-gradient-to-br from-yellow-500 to-orange-600',
    icon: '🔨',
    enrolled: 9670,
    rating: 4.5,
    projects: 6,
    certificate: true,
    weeklyHours: '8-10 hours',
    link: '/learn/paths/06',
    popularity: 'high',
    trend: 'up',
    isNew: false,
    isFeatured: true,
    progress: 0,
    startDate: '2024-02-20',
    category: 'Technology',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'b-1',
        title: 'Web & App Development Fundamentals',
        description: 'Master core web development technologies and modern application architecture.',
        duration: '5 hours',
        lessons: [
          {
            id: 'b-1-1',
            title: 'HTML5 & Semantic Web',
            description: 'Learn modern HTML5 and semantic markup for accessible web applications.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-1-2',
            title: 'CSS3 & Responsive Design',
            description: 'Master CSS3, Flexbox, Grid, and responsive design principles.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-1-3',
            title: 'JavaScript ES6+ Fundamentals',
            description: 'Learn modern JavaScript syntax, functions, and asynchronous programming.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-1-4',
            title: 'React Components & State Management',
            description: 'Build reusable React components and manage application state effectively.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-1-5',
            title: 'Development Tools & Workflow',
            description: 'Set up development environment with Git, npm, and modern build tools.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🌐',
        category: 'Web Development',
        order: 2,
        progress: 0
      },
      {
        id: 'b-2',
        title: 'Databases, APIs & Backend Integration',
        description: 'Design robust backend systems and integrate with databases and external services.',
        duration: '6 hours',
        lessons: [
          {
            id: 'b-2-1',
            title: 'Database Design & SQL',
            description: 'Design relational databases and write efficient SQL queries.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-2-2',
            title: 'NoSQL Databases & MongoDB',
            description: 'Work with document databases and understand NoSQL principles.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-2-3',
            title: 'RESTful API Design',
            description: 'Design and implement RESTful APIs with proper authentication.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-2-4',
            title: 'Node.js & Express Server Development',
            description: 'Build scalable backend servers with Node.js and Express framework.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-2-5',
            title: 'API Integration & Third-Party Services',
            description: 'Integrate external APIs and handle data from multiple sources.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-2-6',
            title: 'Authentication & Authorization',
            description: 'Implement secure user authentication and role-based access control.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🗄️',
        category: 'Backend Development',
        order: 3,
        progress: 0
      },
      {
        id: 'b-3',
        title: 'AI-Integrated Product Development',
        description: 'Integrate AI capabilities into web applications and create intelligent features.',
        duration: '7 hours',
        lessons: [
          {
            id: 'b-3-1',
            title: 'AI API Integration Patterns',
            description: 'Learn patterns for integrating AI services and APIs into applications.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-3-2',
            title: 'Real-time AI Features',
            description: 'Implement real-time AI capabilities like chatbots and recommendations.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-3-3',
            title: 'Data Processing for AI Integration',
            description: 'Prepare and process data for AI model consumption in web apps.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-3-4',
            title: 'AI-Powered User Interfaces',
            description: 'Design interfaces that effectively showcase AI capabilities.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-3-5',
            title: 'Performance Optimization for AI Features',
            description: 'Optimize application performance when integrating AI components.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-3-6',
            title: 'Error Handling & Fallback Strategies',
            description: 'Implement robust error handling for AI service failures.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-3-7',
            title: 'AI Feature Testing & Validation',
            description: 'Test and validate AI-integrated features thoroughly.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🤖',
        category: 'AI Integration',
        order: 4,
        progress: 0
      },
      {
        id: 'b-4',
        title: 'Full Project Capstone',
        description: 'Build a complete AI-integrated web application from concept to deployment.',
        duration: '7 hours',
        lessons: [
          {
            id: 'b-4-1',
            title: 'Project Planning & Architecture',
            description: 'Plan full-stack application with AI integration and define architecture.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-4-2',
            title: 'Frontend Development & UI/UX',
            description: 'Build responsive frontend with modern React patterns and components.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-4-3',
            title: 'Backend API Development',
            description: 'Develop robust backend APIs with database integration and business logic.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-4-4',
            title: 'AI Feature Integration',
            description: 'Integrate AI capabilities and ensure seamless user experience.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-4-5',
            title: 'Testing & Quality Assurance',
            description: 'Implement comprehensive testing strategies for all application layers.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-4-6',
            title: 'Deployment & DevOps',
            description: 'Deploy application to cloud platform and set up CI/CD pipeline.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'b-4-7',
            title: 'Documentation & Presentation',
            description: 'Create comprehensive documentation and present final project.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🚀',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '7',
    title: 'Freelancer',
    description: 'Build a successful freelance career with AI-enhanced workflows and client management.',
    fullDescription: 'Learn to establish and grow a freelance business using AI tools to enhance productivity and deliver exceptional client results. This path covers portfolio development, client acquisition, project management, and leveraging AI for competitive advantage.',
    duration: '6 months',
    totalModules: 5,
    totalLessons: 29,
    level: 'Beginner',
    skills: ['Portfolio Development', 'Client Acquisition', 'Proposal Writing', 'Project Management', 'AI Tools', 'Freelance Business'],
    color: 'from-teal-500 to-green-600',
    gradient: 'bg-gradient-to-br from-teal-500 to-green-600',
    icon: '💼',
    enrolled: 7230,
    rating: 4.6,
    projects: 5,
    certificate: true,
    weeklyHours: '5-7 hours',
    link: '/learn/paths/07',
    popularity: 'medium',
    trend: 'up',
    isNew: true,
    isFeatured: false,
    progress: 0,
    startDate: '2024-03-15',
    category: 'Business & Career',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'f-1',
        title: 'Building a Digital Portfolio',
        description: 'Create compelling portfolio that showcases your skills and attracts ideal clients.',
        duration: '5 hours',
        lessons: [
          {
            id: 'f-1-1',
            title: 'Portfolio Strategy & Personal Branding',
            description: 'Define your unique value proposition and personal brand identity.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-1-2',
            title: 'Showcase Project Selection & Presentation',
            description: 'Select and present projects that demonstrate your capabilities effectively.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-1-3',
            title: 'Online Presence & Social Media Strategy',
            description: 'Build consistent online presence across relevant platforms and networks.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-1-4',
            title: 'Portfolio Website Development',
            description: 'Create professional portfolio website that converts visitors to clients.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-1-5',
            title: 'Testimonials & Social Proof',
            description: 'Collect and leverage testimonials and case studies effectively.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📁',
        category: 'Personal Branding',
        order: 2,
        progress: 0
      },
      {
        id: 'f-2',
        title: 'Client Acquisition & Proposal Writing',
        description: 'Master the art of finding clients and writing winning proposals.',
        duration: '6 hours',
        lessons: [
          {
            id: 'f-2-1',
            title: 'Client Research & Targeting',
            description: 'Identify and research potential clients that match your skills and interests.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-2-2',
            title: 'Networking & Relationship Building',
            description: 'Build professional networks and relationships that lead to client opportunities.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-2-3',
            title: 'Proposal Structure & Persuasion Techniques',
            description: 'Create compelling proposal structures that address client needs effectively.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-2-4',
            title: 'Pricing Strategies & Value-Based Pricing',
            description: 'Develop pricing strategies that reflect your value and market position.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-2-5',
            title: 'Contract Development & Legal Considerations',
            description: 'Create professional contracts that protect both you and your clients.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-2-6',
            title: 'Follow-up & Conversion Strategies',
            description: 'Implement effective follow-up sequences to convert proposals into projects.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📝',
        category: 'Business Development',
        order: 3,
        progress: 0
      },
      {
        id: 'f-3',
        title: 'AI Tools for Freelancers',
        description: 'Leverage AI tools to enhance productivity, quality, and competitive advantage.',
        duration: '7 hours',
        lessons: [
          {
            id: 'f-3-1',
            title: 'AI-Powered Productivity Tools',
            description: 'Master AI tools for task management, scheduling, and workflow optimization.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-3-2',
            title: 'Content Creation & Writing Assistance',
            description: 'Use AI for content creation, editing, and communication enhancement.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-3-3',
            title: 'Design & Creative AI Tools',
            description: 'Leverage AI for graphic design, video editing, and creative tasks.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-3-4',
            title: 'Code Generation & Technical Assistance',
            description: 'Use AI coding assistants to accelerate development and problem-solving.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-3-5',
            title: 'Client Communication Automation',
            description: 'Implement AI tools for efficient client communication and updates.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-3-6',
            title: 'Market Research & Competitive Analysis',
            description: 'Use AI for market research, trend analysis, and competitive intelligence.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-3-7',
            title: 'AI Ethics in Freelance Work',
            description: 'Understand ethical considerations when using AI in client projects.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🤖',
        category: 'AI Tools',
        order: 4,
        progress: 0
      },
      {
        id: 'f-4',
        title: 'Freelance Project Simulation',
        description: 'Complete end-to-end freelance project from client brief to final delivery.',
        duration: '7 hours',
        lessons: [
          {
            id: 'f-4-1',
            title: 'Client Brief Analysis & Requirements Gathering',
            description: 'Analyze client brief and gather comprehensive project requirements.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-4-2',
            title: 'Project Planning & Scope Definition',
            description: 'Create detailed project plan with clear scope, timeline, and deliverables.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-4-3',
            title: 'Proposal & Contract Development',
            description: 'Develop comprehensive proposal and professional service agreement.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-4-4',
            title: 'Project Execution with AI Tools',
            description: 'Execute project using AI tools to enhance efficiency and quality.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-4-5',
            title: 'Client Communication & Progress Updates',
            description: 'Manage client communication and provide regular progress updates.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-4-6',
            title: 'Quality Assurance & Final Delivery',
            description: 'Conduct quality assurance and prepare final deliverables for client.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'f-4-7',
            title: 'Project Review & Continuous Improvement',
            description: 'Conduct project review and identify opportunities for improvement.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🎯',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '8',
    title: 'AI Enhanced Worker',
    description: 'Augment your professional capabilities with AI tools and transform workplace productivity.',
    fullDescription: 'Learn to integrate AI tools into your daily work to enhance productivity, decision-making, and professional effectiveness. This path focuses on practical AI applications across various business functions and industries.',
    duration: '5 months',
    totalModules: 5,
    totalLessons: 28,
    level: 'Beginner',
    skills: ['Productivity Tools', 'AI Automation', 'Decision Support', 'Communication', 'Workflow Optimization', 'Collaboration'],
    color: 'from-indigo-500 to-purple-600',
    gradient: 'bg-gradient-to-br from-indigo-500 to-purple-600',
    icon: '🚀',
    enrolled: 15680,
    rating: 4.8,
    projects: 4,
    certificate: true,
    weeklyHours: '4-6 hours',
    link: '/learn/paths/08',
    popularity: 'high',
    trend: 'up',
    isNew: false,
    isFeatured: true,
    progress: 0,
    startDate: '2024-01-10',
    category: 'Business & Career',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'aew-1',
        title: 'Productivity Tools & AI Automation',
        description: 'Master AI-powered tools to automate routine tasks and boost productivity.',
        duration: '5 hours',
        lessons: [
          {
            id: 'aew-1-1',
            title: 'AI Task Management Systems',
            description: 'Implement AI-enhanced task management and priority setting.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-1-2',
            title: 'Email Automation & Management',
            description: 'Use AI to automate email organization and response generation.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-1-3',
            title: 'Document Processing & Analysis',
            description: 'Leverage AI for document summarization, analysis, and organization.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-1-4',
            title: 'Meeting Automation & Follow-ups',
            description: 'Automate meeting scheduling, note-taking, and action item tracking.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-1-5',
            title: 'Workflow Optimization with AI',
            description: 'Identify and optimize inefficient workflows using AI tools.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '⚡',
        category: 'Productivity',
        order: 2,
        progress: 0
      },
      {
        id: 'aew-2',
        title: 'Communication & Collaboration with AI',
        description: 'Enhance team communication and collaboration using AI-powered tools.',
        duration: '6 hours',
        lessons: [
          {
            id: 'aew-2-1',
            title: 'AI Writing Assistants & Communication',
            description: 'Use AI to enhance written communication across different contexts.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-2-2',
            title: 'Presentation & Visual Communication',
            description: 'Leverage AI for creating compelling presentations and visual materials.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-2-3',
            title: 'Virtual Collaboration Tools',
            description: 'Master AI-enhanced virtual meeting and collaboration platforms.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-2-4',
            title: 'Cross-cultural Communication',
            description: 'Use AI tools to enhance communication across different cultures and languages.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-2-5',
            title: 'Feedback & Performance Communication',
            description: 'Leverage AI for providing and receiving constructive feedback.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-2-6',
            title: 'Team Coordination & Project Updates',
            description: 'Use AI to streamline team coordination and progress reporting.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '💬',
        category: 'Communication',
        order: 3,
        progress: 0
      },
      {
        id: 'aew-3',
        title: 'Decision-Making & AI Augmentation',
        description: 'Enhance decision-making capabilities with AI-powered analysis and insights.',
        duration: '6 hours',
        lessons: [
          {
            id: 'aew-3-1',
            title: 'Data-Driven Decision Frameworks',
            description: 'Implement frameworks for incorporating AI insights into decision processes.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-3-2',
            title: 'Market & Competitive Analysis',
            description: 'Use AI for comprehensive market research and competitive intelligence.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-3-3',
            title: 'Risk Assessment & Mitigation',
            description: 'Leverage AI for identifying and assessing potential risks in decisions.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-3-4',
            title: 'Scenario Planning & Forecasting',
            description: 'Use AI tools for scenario analysis and business forecasting.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-3-5',
            title: 'Performance Metrics & KPI Analysis',
            description: 'Implement AI for tracking and analyzing key performance indicators.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-3-6',
            title: 'Ethical Decision-Making with AI',
            description: 'Navigate ethical considerations when using AI for business decisions.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🎯',
        category: 'Decision Making',
        order: 4,
        progress: 0
      },
      {
        id: 'aew-4',
        title: 'Workplace Transformation Project',
        description: 'Design and implement AI-enhanced workflow for real workplace scenario.',
        duration: '7 hours',
        lessons: [
          {
            id: 'aew-4-1',
            title: 'Workplace Assessment & Opportunity Identification',
            description: 'Assess current workflows and identify AI enhancement opportunities.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-4-2',
            title: 'AI Tool Selection & Implementation Plan',
            description: 'Select appropriate AI tools and create implementation roadmap.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-4-3',
            title: 'Stakeholder Engagement & Change Management',
            description: 'Develop strategies for engaging stakeholders and managing change.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-4-4',
            title: 'Workflow Redesign & Integration',
            description: 'Redesign workflows to incorporate AI tools effectively.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-4-5',
            title: 'Training & Adoption Strategies',
            description: 'Develop training materials and strategies for team adoption.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-4-6',
            title: 'Performance Measurement & ROI Analysis',
            description: 'Establish metrics to measure impact and calculate return on investment.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'aew-4-7',
            title: 'Scalability & Continuous Improvement',
            description: 'Plan for scaling successful implementations and ongoing optimization.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🏢',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '9',
    title: 'Entrepreneur',
    description: 'Launch and grow successful AI-powered businesses with comprehensive entrepreneurial skills.',
    fullDescription: 'Develop the mindset, skills, and strategies needed to build successful AI-driven ventures. This path covers everything from ideation and market discovery to funding, growth strategies, and business model innovation.',
    duration: '7 months',
    totalModules: 5,
    totalLessons: 28,
    level: 'Advanced',
    skills: ['Startup Fundamentals', 'Business Models', 'Funding', 'Growth Strategy', 'AI Innovation', 'Market Analysis'],
    color: 'from-red-500 to-pink-600',
    gradient: 'bg-gradient-to-br from-red-500 to-pink-600',
    icon: '🚀',
    enrolled: 6340,
    rating: 4.7,
    projects: 5,
    certificate: true,
    weeklyHours: '7-9 hours',
    link: '/learn/paths/09',
    popularity: 'medium',
    trend: 'up',
    isNew: false,
    isFeatured: false,
    progress: 0,
    startDate: '2024-02-10',
    category: 'Business & Strategy',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'e-1',
        title: 'Startup Fundamentals & Market Discovery',
        description: 'Master the fundamentals of startup creation and effective market opportunity identification.',
        duration: '5 hours',
        lessons: [
          {
            id: 'e-1-1',
            title: 'Entrepreneurial Mindset & Opportunity Recognition',
            description: 'Develop entrepreneurial thinking and learn to identify viable business opportunities.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-1-2',
            title: 'Market Research & Validation Techniques',
            description: 'Conduct comprehensive market research and validate business ideas effectively.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-1-3',
            title: 'Customer Discovery & Persona Development',
            description: 'Identify target customers and develop detailed customer personas.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-1-4',
            title: 'Problem-Solution Fit Analysis',
            description: 'Analyze and validate the fit between customer problems and proposed solutions.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-1-5',
            title: 'Competitive Landscape Analysis',
            description: 'Map competitive landscape and identify unique positioning opportunities.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🔍',
        category: 'Startup Fundamentals',
        order: 2,
        progress: 0
      },
      {
        id: 'e-2',
        title: 'AI-Powered Business Models',
        description: 'Design innovative business models that leverage AI for competitive advantage.',
        duration: '6 hours',
        lessons: [
          {
            id: 'e-2-1',
            title: 'AI Business Model Patterns',
            description: 'Explore proven business model patterns for AI-powered ventures.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-2-2',
            title: 'Value Proposition Design for AI Solutions',
            description: 'Design compelling value propositions for AI-powered products and services.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-2-3',
            title: 'Revenue Models & Pricing Strategies',
            description: 'Develop sustainable revenue models and effective pricing strategies.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-2-4',
            title: 'Platform Business Models with AI',
            description: 'Design and scale platform business models enhanced by AI capabilities.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-2-5',
            title: 'Subscription & SaaS Models',
            description: 'Master subscription-based and software-as-a-service business models.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-2-6',
            title: 'Scalability & Network Effects',
            description: 'Design for scalability and leverage network effects in AI businesses.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '💡',
        category: 'Business Models',
        order: 3,
        progress: 0
      },
      {
        id: 'e-3',
        title: 'Finance, Strategy & Growth',
        description: 'Master financial planning, strategic decision-making, and growth strategies for AI ventures.',
        duration: '6 hours',
        lessons: [
          {
            id: 'e-3-1',
            title: 'Financial Modeling & Projections',
            description: 'Create comprehensive financial models and realistic revenue projections.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-3-2',
            title: 'Funding Strategies & Investor Pitching',
            description: 'Develop funding strategies and master investor pitch presentations.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-3-3',
            title: 'Unit Economics & Profitability Analysis',
            description: 'Analyze unit economics and path to profitability for AI businesses.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-3-4',
            title: 'Growth Marketing & Customer Acquisition',
            description: 'Implement growth marketing strategies and optimize customer acquisition.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-3-5',
            title: 'Strategic Partnerships & Alliances',
            description: 'Develop strategic partnerships to accelerate growth and market reach.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-3-6',
            title: 'International Expansion & Scaling',
            description: 'Plan and execute international expansion strategies for AI businesses.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📈',
        category: 'Strategy & Finance',
        order: 4,
        progress: 0
      },
      {
        id: 'e-4',
        title: 'Startup Simulation Project',
        description: 'Develop complete business plan and pitch for an AI-powered startup idea.',
        duration: '7 hours',
        lessons: [
          {
            id: 'e-4-1',
            title: 'Business Idea Generation & Refinement',
            description: 'Generate and refine AI-powered business ideas through systematic evaluation.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-4-2',
            title: 'Business Plan Development',
            description: 'Create comprehensive business plan covering all key business elements.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-4-3',
            title: 'Financial Model Creation',
            description: 'Build detailed financial model with revenue projections and cost analysis.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-4-4',
            title: 'Go-to-Market Strategy Development',
            description: 'Design comprehensive go-to-market strategy and launch plan.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-4-5',
            title: 'Investor Pitch Deck Creation',
            description: 'Create compelling investor pitch deck with clear narrative and financials.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-4-6',
            title: 'Pitch Practice & Delivery',
            description: 'Practice and refine pitch delivery with feedback and coaching.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'e-4-7',
            title: 'Business Model Validation & Iteration',
            description: 'Validate business model assumptions and iterate based on feedback.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🎯',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '10',
    title: 'Digital Transformation Leader',
    description: 'Lead organizational change and digital transformation initiatives with AI at the core.',
    fullDescription: 'Develop the leadership skills and strategic vision needed to drive digital transformation in organizations. This path covers change management, technology integration, data culture development, and leading AI adoption across enterprises.',
    duration: '8 months',
    totalModules: 5,
    totalLessons: 28,
    level: 'Advanced',
    skills: ['Change Management', 'Digital Strategy', 'Leadership', 'Technology Integration', 'Data Culture', 'Organizational Design'],
    color: 'from-gray-600 to-blue-700',
    gradient: 'bg-gradient-to-br from-gray-600 to-blue-700',
    icon: '🏢',
    enrolled: 5120,
    rating: 4.8,
    projects: 4,
    certificate: true,
    weeklyHours: '6-8 hours',
    link: '/learn/paths/10',
    popularity: 'medium',
    trend: 'up',
    isNew: true,
    isFeatured: false,
    progress: 0,
    startDate: '2024-03-20',
    category: 'Business & Strategy',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'dtl-1',
        title: 'Organizational Change & Data Culture',
        description: 'Lead cultural transformation and build data-driven organizations.',
        duration: '5 hours',
        lessons: [
          {
            id: 'dtl-1-1',
            title: 'Change Management Frameworks',
            description: 'Master proven change management frameworks for digital transformation.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-1-2',
            title: 'Building Data-Driven Culture',
            description: 'Develop strategies for fostering data literacy and evidence-based decision making.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-1-3',
            title: 'Stakeholder Engagement Strategies',
            description: 'Design comprehensive stakeholder engagement and communication plans.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-1-4',
            title: 'Talent Development & Upskilling',
            description: 'Create talent development strategies for digital and AI capabilities.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-1-5',
            title: 'Measuring Transformation Success',
            description: 'Establish KPIs and metrics to track transformation progress and impact.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🔄',
        category: 'Change Management',
        order: 2,
        progress: 0
      },
      {
        id: 'dtl-2',
        title: 'Emerging Tech & Systems Integration',
        description: 'Understand and integrate emerging technologies into organizational systems.',
        duration: '6 hours',
        lessons: [
          {
            id: 'dtl-2-1',
            title: 'Technology Landscape Assessment',
            description: 'Assess emerging technologies and their potential organizational impact.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-2-2',
            title: 'Systems Thinking & Architecture',
            description: 'Apply systems thinking to technology integration and organizational design.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-2-3',
            title: 'Legacy System Modernization',
            description: 'Develop strategies for modernizing legacy systems and infrastructure.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-2-4',
            title: 'Cloud Transformation Strategies',
            description: 'Plan and execute cloud adoption and migration strategies.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-2-5',
            title: 'API Economy & Microservices',
            description: 'Understand API-driven architectures and microservices implementation.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-2-6',
            title: 'Security & Compliance Integration',
            description: 'Integrate security and compliance considerations into technology strategies.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🔗',
        category: 'Technology Integration',
        order: 3,
        progress: 0
      },
      {
        id: 'dtl-3',
        title: 'Leadership in the Age of AI',
        description: 'Develop leadership capabilities for guiding organizations through AI transformation.',
        duration: '6 hours',
        lessons: [
          {
            id: 'dtl-3-1',
            title: 'Strategic Vision & AI Roadmapping',
            description: 'Develop strategic vision and create comprehensive AI adoption roadmaps.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-3-2',
            title: 'Ethical Leadership & AI Governance',
            description: 'Establish ethical frameworks and governance structures for AI adoption.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-3-3',
            title: 'Innovation Culture & Experimentation',
            description: 'Foster innovation culture and create safe spaces for experimentation.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-3-4',
            title: 'Cross-Functional Team Leadership',
            description: 'Lead diverse, cross-functional teams through complex transformations.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-3-5',
            title: 'Decision-Making in Uncertainty',
            description: 'Make effective decisions in rapidly changing technological landscapes.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-3-6',
            title: 'Crisis Management & Resilience',
            description: 'Develop crisis management capabilities and organizational resilience.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '👑',
        category: 'Leadership',
        order: 4,
        progress: 0
      },
      {
        id: 'dtl-4',
        title: 'Digital Transformation Roadmap Project',
        description: 'Develop comprehensive digital transformation strategy for real organization.',
        duration: '7 hours',
        lessons: [
          {
            id: 'dtl-4-1',
            title: 'Organizational Assessment & Analysis',
            description: 'Conduct comprehensive assessment of organizational readiness and capabilities.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-4-2',
            title: 'Vision & Strategy Development',
            description: 'Develop clear transformation vision and strategic objectives.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-4-3',
            title: 'Transformation Roadmap Creation',
            description: 'Create detailed transformation roadmap with timelines and milestones.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-4-4',
            title: 'Change Management Plan Development',
            description: 'Develop comprehensive change management and communication plans.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-4-5',
            title: 'Technology Implementation Strategy',
            description: 'Design technology implementation strategy with phased approach.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-4-6',
            title: 'Talent & Capability Development Plan',
            description: 'Create talent development and capability building strategies.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'dtl-4-7',
            title: 'Measurement & Success Framework',
            description: 'Establish measurement framework and success criteria for transformation.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🗺️',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '11',
    title: 'Communicator',
    description: 'Master the art of effective communication in the digital age with AI-enhanced techniques.',
    fullDescription: 'Develop advanced communication skills for the digital era, leveraging AI tools to enhance storytelling, public speaking, and cross-cultural communication. This path covers data storytelling, visual communication, and AI-assisted content creation.',
    duration: '6 months',
    totalModules: 5,
    totalLessons: 29,
    level: 'Beginner',
    skills: ['Storytelling', 'Public Speaking', 'Visual Communication', 'Writing', 'Presentation Skills', 'AI Content Tools'],
    color: 'from-pink-500 to-rose-600',
    gradient: 'bg-gradient-to-br from-pink-500 to-rose-600',
    icon: '🎤',
    enrolled: 8920,
    rating: 4.6,
    projects: 5,
    certificate: true,
    weeklyHours: '5-7 hours',
    link: '/learn/paths/11',
    popularity: 'medium',
    trend: 'up',
    isNew: false,
    isFeatured: false,
    progress: 0,
    startDate: '2024-02-05',
    category: 'Collaboration',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'c-1',
        title: 'Storytelling with Data',
        description: 'Transform data into compelling narratives that drive action and understanding.',
        duration: '5 hours',
        lessons: [
          {
            id: 'c-1-1',
            title: 'Data Narrative Structures',
            description: 'Learn fundamental narrative structures for effective data storytelling.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-1-2',
            title: 'Audience Analysis & Message Tailoring',
            description: 'Analyze audience needs and tailor data stories for different stakeholders.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-1-3',
            title: 'Visual Storytelling Techniques',
            description: 'Master visual techniques that enhance data narratives and engagement.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-1-4',
            title: 'Emotional Connection with Data',
            description: 'Create emotional connections through data-driven stories and examples.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-1-5',
            title: 'Call-to-Action Design',
            description: 'Design compelling calls-to-action that drive desired outcomes from data stories.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📖',
        category: 'Storytelling',
        order: 2,
        progress: 0
      },
      {
        id: 'c-2',
        title: 'Visual & Written Communication',
        description: 'Master visual and written communication across digital platforms and media.',
        duration: '6 hours',
        lessons: [
          {
            id: 'c-2-1',
            title: 'Visual Design Principles',
            description: 'Apply fundamental design principles to create effective visual communications.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-2-2',
            title: 'Digital Writing & Content Strategy',
            description: 'Master digital writing techniques and develop comprehensive content strategies.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-2-3',
            title: 'Presentation Design & Delivery',
            description: 'Create compelling presentations and master delivery techniques.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-2-4',
            title: 'Infographics & Data Visualization',
            description: 'Design effective infographics and data visualizations for communication.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-2-5',
            title: 'Cross-Platform Content Adaptation',
            description: 'Adapt content effectively across different digital platforms and formats.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-2-6',
            title: 'Brand Voice & Consistency',
            description: 'Develop consistent brand voice and maintain communication standards.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '✍️',
        category: 'Visual Communication',
        order: 3,
        progress: 0
      },
      {
        id: 'c-3',
        title: 'Public Speaking & Thought Leadership',
        description: 'Develop confidence and skill in public speaking and establishing thought leadership.',
        duration: '7 hours',
        lessons: [
          {
            id: 'c-3-1',
            title: 'Public Speaking Fundamentals',
            description: 'Master core public speaking techniques and overcome presentation anxiety.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-3-2',
            title: 'Audience Engagement Strategies',
            description: 'Develop strategies for engaging and connecting with diverse audiences.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-3-3',
            title: 'Thought Leadership Development',
            description: 'Establish yourself as a thought leader in your field or industry.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-3-4',
            title: 'Media Interview Techniques',
            description: 'Master techniques for effective media interviews and public appearances.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-3-5',
            title: 'Panel Discussions & Moderating',
            description: 'Excel in panel discussions and develop moderating skills.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-3-6',
            title: 'Virtual Presentation Mastery',
            description: 'Master virtual presentation techniques for remote and hybrid environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-3-7',
            title: 'Handling Q&A Sessions',
            description: 'Develop confidence and skill in handling audience questions effectively.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🎭',
        category: 'Public Speaking',
        order: 4,
        progress: 0
      },
      {
        id: 'c-4',
        title: 'AI-Assisted Communication Project',
        description: 'Apply AI tools to create comprehensive communication campaign or presentation.',
        duration: '7 hours',
        lessons: [
          {
            id: 'c-4-1',
            title: 'Communication Strategy Development',
            description: 'Develop comprehensive communication strategy for specific audience and goals.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-4-2',
            title: 'AI Content Creation & Enhancement',
            description: 'Use AI tools to create and enhance written and visual content.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-4-3',
            title: 'Multi-Platform Campaign Design',
            description: 'Design communication campaign that works across multiple platforms.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-4-4',
            title: 'Presentation Development with AI',
            description: 'Create compelling presentation using AI-assisted design and content tools.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-4-5',
            title: 'Delivery Practice & Refinement',
            description: 'Practice delivery and refine communication based on AI feedback tools.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-4-6',
            title: 'Audience Feedback Integration',
            description: 'Incorporate audience feedback and analytics to improve communication.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'c-4-7',
            title: 'Final Presentation & Impact Assessment',
            description: 'Deliver final presentation and assess communication impact.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🤖',
        category: 'Applied Practice',
        order: 5,
        progress: 0
      }
    ]
  },
  {
    id: '12',
    title: 'Systems Thinker',
    description: 'Develop holistic understanding of complex systems and AI impact on organizational ecosystems.',
    fullDescription: 'Learn to analyze and understand complex systems, identify interconnections, and anticipate emergent behaviors. This path covers systems theory, complexity science, and applying systemic thinking to AI implementation and organizational design.',
    duration: '7 months',
    totalModules: 5,
    totalLessons: 29,
    level: 'Advanced',
    skills: ['Systems Theory', 'Complexity Science', 'Interdisciplinary Analysis', 'Strategic Planning', 'Emergent Behavior', 'Feedback Loops'],
    color: 'from-purple-500 to-indigo-600',
    gradient: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    icon: '🔄',
    enrolled: 4230,
    rating: 4.7,
    projects: 4,
    certificate: true,
    weeklyHours: '6-8 hours',
    link: '/learn/paths/12',
    popularity: 'medium',
    trend: 'up',
    isNew: true,
    isFeatured: false,
    progress: 0,
    startDate: '2024-03-10',
    category: 'Business & Strategy',
    modules: [
      {
        id: 'common-1',
        title: 'Common Foundations',
        description: 'Essential skills and knowledge required across all career paths in the digital age.',
        duration: '4 hours',
        lessons: [
          {
            id: 'common-1-1',
            title: 'Digital Literacy Fundamentals',
            description: 'Understand core digital concepts and tools essential for modern workplaces.',
            duration: '45 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-2',
            title: 'Critical Thinking & Problem Solving',
            description: 'Develop analytical thinking skills to approach complex challenges systematically.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-3',
            title: 'Basic Data Analytics Concepts',
            description: 'Introduction to data analysis principles and common analytical approaches.',
            duration: '75 min',
            isCompleted: false,
            isLocked: false
          },
          {
            id: 'common-1-4',
            title: 'Effective Communication Skills',
            description: 'Master professional communication techniques for collaborative environments.',
            duration: '60 min',
            isCompleted: false,
            isLocked: false
          }
        ],
        icon: '🌐',
        category: 'Foundation',
        order: 1,
        progress: 0
      },
      {
        id: 'st-1',
        title: 'Systems & Complexity Theory',
        description: 'Master fundamental concepts of systems thinking and complexity science.',
        duration: '5 hours',
        lessons: [
          {
            id: 'st-1-1',
            title: 'Introduction to Systems Thinking',
            description: 'Learn core principles of systems thinking and its application to complex problems.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-1-2',
            title: 'Complexity Science Fundamentals',
            description: 'Understand complexity theory and emergent behavior in complex systems.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-1-3',
            title: 'System Archetypes & Patterns',
            description: 'Identify common system archetypes and their behavioral patterns.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-1-4',
            title: 'Boundary Definition & System Scope',
            description: 'Learn to define system boundaries and scope analysis effectively.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-1-5',
            title: 'Leverage Points & Intervention',
            description: 'Identify high-leverage points for effective system intervention.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🧩',
        category: 'Systems Theory',
        order: 2,
        progress: 0
      },
      {
        id: 'st-2',
        title: 'Interdisciplinary Modeling & Feedback Loops',
        description: 'Apply systems modeling across disciplines and understand feedback dynamics.',
        duration: '6 hours',
        lessons: [
          {
            id: 'st-2-1',
            title: 'Causal Loop Diagrams',
            description: 'Create and interpret causal loop diagrams to map system dynamics.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-2-2',
            title: 'Stock and Flow Modeling',
            description: 'Master stock and flow modeling for dynamic system analysis.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-2-3',
            title: 'Feedback Loop Analysis',
            description: 'Analyze reinforcing and balancing feedback loops in systems.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-2-4',
            title: 'Cross-Disciplinary System Applications',
            description: 'Apply systems thinking across business, ecology, and social domains.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-2-5',
            title: 'System Dynamics Simulation',
            description: 'Introduction to system dynamics simulation and modeling tools.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-2-6',
            title: 'Delays & Nonlinear Effects',
            description: 'Understand time delays and nonlinear effects in complex systems.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '📊',
        category: 'Modeling',
        order: 3,
        progress: 0
      },
      {
        id: 'st-3',
        title: 'AI as a Systemic Force',
        description: 'Analyze AI as transformative force within organizational and societal systems.',
        duration: '7 hours',
        lessons: [
          {
            id: 'st-3-1',
            title: 'AI System Integration Patterns',
            description: 'Analyze how AI systems integrate with and transform existing systems.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-3-2',
            title: 'Emergent Behavior in AI Systems',
            description: 'Study emergent behaviors in complex AI systems and networks.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-3-3',
            title: 'Systemic Risk & AI Safety',
            description: 'Identify systemic risks and safety considerations in AI deployment.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-3-4',
            title: 'AI Ecosystem Mapping',
            description: 'Map AI ecosystems and identify key stakeholders and relationships.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-3-5',
            title: 'Feedback in AI-Enhanced Systems',
            description: 'Analyze feedback mechanisms in systems enhanced by AI capabilities.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-3-6',
            title: 'Adaptive Systems & Machine Learning',
            description: 'Study how machine learning creates adaptive, evolving systems.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-3-7',
            title: 'System Resilience & AI',
            description: 'Design systems for resilience in the age of AI transformation.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🤖',
        category: 'AI Systems',
        order: 4,
        progress: 0
      },
      {
        id: 'st-4',
        title: 'Strategic Systems Mapping Project',
        description: 'Apply systems thinking to analyze and design solutions for complex real-world challenges.',
        duration: '7 hours',
        lessons: [
          {
            id: 'st-4-1',
            title: 'Problem Framing & System Selection',
            description: 'Frame complex problem and select appropriate system for analysis.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-4-2',
            title: 'Stakeholder & Boundary Analysis',
            description: 'Identify key stakeholders and define system boundaries for analysis.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-4-3',
            title: 'System Mapping & Relationship Modeling',
            description: 'Create comprehensive system maps showing relationships and dynamics.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-4-4',
            title: 'Feedback Loop Identification',
            description: 'Identify and analyze key feedback loops within the system.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-4-5',
            title: 'Leverage Point Analysis',
            description: 'Identify high-leverage intervention points for system change.',
            duration: '60 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-4-6',
            title: 'Intervention Strategy Development',
            description: 'Develop comprehensive intervention strategies based on system analysis.',
            duration: '90 min',
            isCompleted: false,
            isLocked: true
          },
          {
            id: 'st-4-7',
            title: 'Implementation Roadmap & Monitoring',
            description: 'Create implementation roadmap and monitoring framework for interventions.',
            duration: '75 min',
            isCompleted: false,
            isLocked: true
          }
        ],
        icon: '🗺️',
        category: 'Business & Career',
        order: 5,
        progress: 0
      }
    ]
  }
]

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface SkillTagProps {
  skill: string
  className?: string
}

interface ExploreButtonProps {
  href: string
  className?: string
}

const ExploreButton: React.FC<{ href: string }> = ({ href }) => (
  <motion.a
    href={href}
    className="inline-flex items-center px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group/explore relative overflow-hidden"
    whileHover={{ 
      scale: 1.05,
      y: -2,
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)'
    }}
    whileTap={{ scale: 0.95 }}
  >
    {/* Button Shine Effect */}
    <motion.div
      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
      initial={{ x: '-100%' }}
      whileHover={{ x: '200%' }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
    />
    
    <motion.span
      className="relative z-10 flex items-center space-x-3"
      whileHover={{ x: 3 }}
      transition={{ duration: 0.2 }}
    >
      <span>🚀 Explore Path</span>
      <motion.span
        animate={{ x: [0, 5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        →
      </motion.span>
    </motion.span>
  </motion.a>
)

interface ModuleAccordionProps {
  module: Module
  isExpanded: boolean
  onToggle: () => void
}

const ModuleAccordion: React.FC<ModuleAccordionProps> = ({ module, isExpanded, onToggle }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
      >
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold">
            {module.order}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">{module.title}</h3>
            <p className="text-gray-600 text-sm mt-1">{module.description}</p>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                {module.duration}
              </span>
              <span className="flex items-center">
                <BookOpen className="w-4 h-4 mr-1" />
                {module.lessons.length} lessons
              </span>
            </div>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-gray-200"
          >
            <div className="p-6 space-y-4">
              {module.lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  className="flex items-center space-x-4 p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors duration-200"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                    <p className="text-gray-600 text-sm mt-1">{lesson.description}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">{lesson.duration}</span>
                    {lesson.isLocked ? (
                      <Lock className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Play className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface PathCardProps {
  path: LearningPath
  isExpanded: boolean
  onToggle: () => void
}

const PathCard: React.FC<PathCardProps> = ({ path, isExpanded, onToggle }) => {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [isHovered, setIsHovered] = useState(false)
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 50 })
  const cardRef = useRef<HTMLDivElement>(null)

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId)
    } else {
      newExpanded.add(moduleId)
    }
    setExpandedModules(newExpanded)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    
    const rect = cardRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setGlowPosition({ x, y })
  }

  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.23, 1, 0.32, 1],
        staggerChildren: 0.08
      }
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.99,
      transition: {
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1]
      }
    }
  }

  return (
    <motion.div
      ref={cardRef}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={containerVariants}
      whileHover={{ 
        y: -2,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      className="relative bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden cursor-pointer group"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)'
      }}
    >
      {/* Enhanced Animated Background Effects */}
      <motion.div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        animate={{
          background: `radial-gradient(600px circle at ${glowPosition.x}% ${glowPosition.y}%, rgba(99, 102, 241, 0.08) 0%, transparent 80%)`
        }}
        transition={{ duration: 0.1 }}
      />
      
      {/* Multi-layer Glow Effects */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, 
            rgba(99, 102, 241, 0.15) 0%, 
            rgba(168, 85, 247, 0.08) 25%, 
            rgba(236, 72, 153, 0.08) 50%, 
            rgba(239, 68, 68, 0.08) 75%, 
            rgba(245, 158, 11, 0.15) 100%)`,
          filter: 'blur(20px)'
        }}
        animate={{
          opacity: isHovered ? 0.6 : 0
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Main Content - Optimized Layout */}
      <div className="relative z-10">
        {/* Compact Header Section */}
        <motion.div
          className={`relative overflow-hidden ${path.gradient} p-6 text-white`}
          style={{
            background: `linear-gradient(135deg, 
              ${path.gradientStart || '#6366f1'} 0%, 
              ${path.gradientEnd || '#8b5cf6'} 50%, 
              ${path.gradientAccent || '#ec4899'} 100%)`
          }}
        >
          {/* Animated Background Pattern */}
          <motion.div 
            className="absolute inset-0 opacity-[0.03]"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 0)`,
              backgroundSize: '40px 40px'
            }}
          />
          
          {/* Floating Micro Particles */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-0.5 h-0.5 bg-white rounded-full"
                initial={{
                  x: Math.random() * 100 + '%',
                  y: Math.random() * 100 + '%',
                }}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0, 0.8, 0],
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 1.5,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>

          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Compact Icon and Badges Row */}
                <motion.div 
                  className="flex items-center gap-3 mb-4 flex-wrap"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <motion.span 
                    className="text-2xl flex-shrink-0"
                    whileHover={{ 
                      scale: 1.1,
                      rotate: 5,
                      transition: { duration: 0.2 }
                    }}
                  >
                    {path.icon}
                  </motion.span>
                  
                  <div className="flex gap-2 flex-wrap">
                    {path.isNew && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 300,
                          delay: 0.2
                        }}
                        className="px-2 py-1 bg-white/20 backdrop-blur-md rounded-xl text-xs font-bold border border-white/30 shadow-sm"
                        whileHover={{ scale: 1.05 }}
                      >
                        🆕 New
                      </motion.span>
                    )}
                    {path.isFeatured && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 300,
                          delay: 0.3
                        }}
                        className="px-2 py-1 bg-amber-500/30 backdrop-blur-md rounded-xl text-xs font-bold border border-amber-400/40 shadow-sm"
                        whileHover={{ scale: 1.05 }}
                      >
                        ⭐ Featured
                      </motion.span>
                    )}
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 300,
                        delay: 0.4
                      }}
                      className={`px-2 py-1 backdrop-blur-md rounded-xl text-xs font-bold border shadow-sm ${
                        path.level === 'Beginner' ? 'bg-green-500/30 border-green-400/40' :
                        path.level === 'Intermediate' ? 'bg-yellow-500/30 border-yellow-400/40' :
                        path.level === 'Advanced' ? 'bg-red-500/30 border-red-400/40' :
                        'bg-purple-500/30 border-purple-400/40'
                      }`}
                      whileHover={{ scale: 1.05 }}
                    >
                      {path.level}
                    </motion.span>
                  </div>
                </motion.div>
                
                {/* Compact Title and Description */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="mb-4"
                >
                  <motion.h2
                    className="text-2xl font-black mb-2 leading-tight tracking-tight transition-all duration-200 line-clamp-2"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    style={{
                      background: isHovered ? 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)' : undefined,
                      backgroundClip: isHovered ? 'text' : undefined,
                      WebkitBackgroundClip: isHovered ? 'text' : undefined,
                      WebkitTextFillColor: isHovered ? 'transparent' : undefined
                    }}
                    whileHover={{ scale: 1.01 }}
                  >
                    {path.title}
                  </motion.h2>

                  <motion.p 
                    className="text-white/90 text-sm leading-relaxed font-medium line-clamp-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                  >
                    {path.fullDescription}
                  </motion.p>
                </motion.div>

                {/* Compact Stats Grid */}
                <motion.div 
                  className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.05
                      }
                    }
                  }}
                >
                  {[
                    { icon: Clock, text: path.duration },
                    { icon: BookOpen, text: `${path.totalLessons} lessons` },
                    { icon: Target, text: `${path.totalModules} modules` },
                    { icon: Users, text: `${(path.enrolled / 1000).toFixed(0)}k enrolled` },
                    { icon: Star, text: path.rating }
                  ].map((stat, index) => (
                    <motion.div
                      key={index}
                      variants={{
                        hidden: { opacity: 0, scale: 0.9 },
                        visible: { 
                          opacity: 1, 
                          scale: 1,
                          transition: {
                            duration: 0.4,
                            ease: [0.23, 1, 0.32, 1]
                          }
                        }
                      }}
                      className="flex items-center gap-2 bg-white/15 backdrop-blur-md px-2 py-1.5 rounded-xl border border-white/20 hover:border-white/30 transition-all duration-200 group/stat"
                      whileHover={{ 
                        scale: 1.03,
                        y: -1,
                        backgroundColor: 'rgba(255,255,255,0.2)'
                      }}
                    >
                      <motion.div
                        whileHover={{ rotate: 8, scale: 1.05 }}
                        transition={{ duration: 0.15 }}
                      >
                        <stat.icon className="w-3 h-3 text-white" />
                      </motion.div>
                      <span className="text-white font-semibold text-xs whitespace-nowrap">{stat.text}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
              
              {/* Compact Toggle Button */}
              <motion.button
                onClick={onToggle}
                whileHover={{ 
                  scale: 1.1,
                  rotate: 3,
                  backgroundColor: 'rgba(255,255,255,0.3)'
                }}
                whileTap={{ scale: 0.9 }}
                className="flex-shrink-0 w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 shadow-lg hover:shadow-xl transition-all duration-200"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 300,
                  delay: 0.4
                }}
              >
                <motion.div
                  animate={{ 
                    rotate: isExpanded ? 180 : 0,
                    scale: isHovered ? 1.1 : 1
                  }}
                  transition={{ 
                    duration: 0.25,
                    ease: [0.23, 1, 0.32, 1]
                  }}
                >
                  <ChevronDown className="w-4 h-4 text-white" />
                </motion.div>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Compact Skills Section */}
        <motion.div 
          className="p-4 border-b border-gray-100 bg-gradient-to-br from-white via-blue-50/10 to-purple-50/5 rounded-xl mx-3 mt-2 mb-3 shadow-inner"
          initial={{ opacity: 0, scale: 0.98, height: 0 }}
          animate={{ opacity: 1, scale: 1, height: "auto" }}
          transition={{ 
            duration: 0.5, 
            delay: 0.2,
            ease: [0.23, 1, 0.32, 1]
          }}
          whileHover={{
            scale: 1.01,
            transition: { duration: 0.2, ease: "easeOut" }
          }}
        >
          {/* Compact Skills Header */}
          <motion.div 
            className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200/30"
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <motion.h3 
              className="font-bold text-gray-800 text-sm flex items-center gap-2"
              whileHover={{ 
                scale: 1.03,
                transition: { duration: 0.15 }
              }}
            >
              <motion.span
                className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent"
                whileHover={{
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #4f46e5 100%)",
                  backgroundClip: "text",
                  transition: { duration: 0.3 }
                }}
              >
                Core Skills
              </motion.span>
              <motion.div
                animate={{ 
                  rotate: [0, 3, 0, -3, 0],
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                🎯
              </motion.div>
            </motion.h3>
            
            <motion.div 
              className="flex items-center gap-1 px-2 py-1 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200/50 shadow-xs"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              whileHover={{ 
                scale: 1.05,
                backgroundColor: "rgba(255,255,255,0.8)",
                transition: { duration: 0.15 }
              }}
            >
              <motion.span 
                className="text-xs font-semibold text-gray-600"
                whileHover={{ color: "#4f46e5" }}
              >
                {path.skills.length}
              </motion.span>
            </motion.div>
          </motion.div>

          {/* Compact Skills Grid */}
          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.04,
                  delayChildren: 0.2
                }
              }
            }}
          >
            {path.skills.map((skill, index) => (
              <motion.div
                key={index}
                custom={index}
                variants={{
                  hidden: { 
                    opacity: 0, 
                    y: 10, 
                    scale: 0.9,
                  },
                  visible: (i: number) => ({
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: {
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                      delay: i * 0.04,
                      duration: 0.4,
                      ease: [0.23, 1, 0.32, 1]
                    }
                  })
                }}
                whileHover={{
                  y: -2,
                  scale: 1.02,
                  backgroundColor: "rgba(255,255,255,0.9)",
                  borderColor: "rgba(99, 102, 241, 0.2)",
                  boxShadow: "0 4px 12px -4px rgba(99, 102, 241, 0.3)",
                  transition: {
                    duration: 0.2,
                    ease: "easeOut",
                  }
                }}
                whileTap={{ 
                  scale: 0.98,
                  y: 0,
                  transition: { duration: 0.1 }
                }}
                className="relative group"
              >
                <motion.div
                  className="relative flex items-center justify-between p-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/50 shadow-xs cursor-pointer group-hover:shadow-sm transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%)"
                  }}
                >
                  <motion.div 
                    className="flex items-center gap-1.5 flex-1 min-w-0"
                    whileHover={{ x: 1 }}
                  >
                    <motion.div
                      className="flex-shrink-0 w-4 h-4 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xs"
                      animate={{
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: index * 0.3
                      }}
                      whileHover={{
                        scale: 1.1,
                        rotate: 5,
                        transition: { duration: 0.15 }
                      }}
                    >
                      <motion.span 
                        className="text-[10px] font-bold text-white"
                        whileHover={{ scale: 1.2 }}
                      >
                        {index + 1}
                      </motion.span>
                    </motion.div>
                    
                    <motion.span 
                      className="text-xs font-semibold text-gray-700 truncate pr-1"
                      whileHover={{ 
                        color: "#374151",
                        transition: { duration: 0.15 }
                      }}
                    >
                      {skill}
                    </motion.span>
                  </motion.div>

                  <motion.div 
                    className="flex-shrink-0"
                    initial={{ opacity: 0.5 }}
                    whileHover={{ opacity: 1 }}
                  >
                    <motion.div
                      className="w-1 h-1 rounded-full bg-green-400"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.6, 1, 0.6]
                      }}
                      transition={{ 
                        duration: 1.5,
                        repeat: Infinity,
                        delay: index * 0.2
                      }}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Enhanced Compact Expanded Content */}
        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.div
              initial={{ 
                height: 0, 
                opacity: 0,
                scale: 0.99
              }}
              animate={{ 
                height: 'auto', 
                opacity: 1,
                scale: 1
              }}
              exit={{ 
                height: 0, 
                opacity: 0,
                scale: 0.99
              }}
              transition={{ 
                duration: 0.4,
                ease: [0.23, 1, 0.32, 1]
              }}
              className="overflow-hidden"
            >
              <motion.div 
                className="p-6 space-y-6 bg-gradient-to-br from-white via-gray-50 to-blue-50/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                {/* Compact Modules Section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.h3 
                    className="text-xl font-black text-gray-900 mb-6 bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent"
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.15 }}
                  >
                    Learning Journey
                  </motion.h3>
                  <motion.div 
                    className="space-y-3"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.1
                        }
                      }
                    }}
                  >
                    {path.modules.map((module, index) => (
                      <ModuleAccordion
                        key={module.id}
                        module={module}
                        isExpanded={expandedModules.has(module.id)}
                        onToggle={() => toggleModule(module.id)}
                      />
                    ))}
                  </motion.div>
                </motion.div>

                {/* Compact Action Buttons */}
                <motion.div 
                  className="flex flex-wrap gap-3 pt-6 border-t border-gray-200/50"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <ExploreButton href={path.link} />
                  <motion.button 
                    className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-400 hover:shadow-md transition-all duration-200 group/btn"
                    whileHover={{ 
                      scale: 1.03,
                      y: -1
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <motion.span
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm"
                    >
                      💫 Wishlist
                    </motion.span>
                  </motion.button>
                  <motion.button 
                    className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-400 hover:shadow-md transition-all duration-200 group/btn"
                    whileHover={{ 
                      scale: 1.03,
                      y: -1
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <motion.span
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm"
                    >
                      📤 Share
                    </motion.span>
                  </motion.button>
                </motion.div>

                {/* Compact Progress Indicator */}
                <motion.div 
                  className="pt-4 border-t border-gray-200/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Your Progress</span>
                    <span className="font-bold text-blue-600">0%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    />
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Enhanced Subtle Shadow Animation */}
      <motion.div
        className="absolute inset-0 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, transparent 50%)',
          filter: 'blur(20px)'
        }}
        animate={{
          opacity: isHovered ? 0.2 : 0
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  )
}

// Enhanced SkillTag component with more animations
const SkillTag: React.FC<{ skill: string; index: number }> = ({ skill, index }) => (
  <motion.span
    className="px-5 py-3 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200/60 text-blue-900 font-semibold rounded-2xl text-sm shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group/skill"
    whileHover={{ 
      scale: 1.1,
      y: -2,
      borderColor: 'rgba(99, 102, 241, 0.4)',
      background: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)'
    }}
    whileTap={{ scale: 0.95 }}
    initial={{ opacity: 0, scale: 0, rotate: -10 }}
    animate={{ opacity: 1, scale: 1, rotate: 0 }}
    transition={{
      type: "spring",
      stiffness: 200,
      delay: index * 0.1
    }}
  >
    <span className="flex items-center space-x-2">
      <motion.span
        whileHover={{ rotate: 15, scale: 1.2 }}
        transition={{ duration: 0.2 }}
      >
        ⚡
      </motion.span>
      <span>{skill}</span>
    </span>
  </motion.span>
)

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function LearningPathsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const categories = ['all', 'Data & AI', 'Technology', 'Business & Strategy', 'Collaboration', 'Business & Career']
  const levels = ['all', 'Beginner', 'Intermediate', 'Advanced', 'Mixed']

  const filteredPaths = useMemo(() => {
    return COMPREHENSIVE_LEARNING_PATHS.filter(path => {
      const matchesSearch = path.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          path.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          path.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'all' || path.category === selectedCategory
      const matchesLevel = selectedLevel === 'all' || path.level === selectedLevel
      
      return matchesSearch && matchesCategory && matchesLevel
    })
  }, [searchTerm, selectedCategory, selectedLevel])

  const togglePath = (pathId: string) => {
    const newExpanded = new Set(expandedPaths)
    if (newExpanded.has(pathId)) {
      newExpanded.delete(pathId)
    } else {
      newExpanded.add(pathId)
    }
    setExpandedPaths(newExpanded)
  }

    return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Head>
        <title>All Learning Paths | Podacium</title>
        <meta
            name="description"
            content="Explore all structured paths to master data, AI, and digital skills at Podacium"
        />
        </Head>

        <Navbar />

        {/* Header Section */}
        <div className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative"
            >
              {/* Enhanced Title */}
              <motion.h1
                className="text-6xl md:text-7xl font-black mb-6 tracking-tight"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  All
                </span>
                <br />
                <span className="bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
                  Learning Paths
                </span>
              </motion.h1>

              <motion.p
                className="text-xl md:text-2xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                Explore all structured paths to master data, AI, and digital skills at Podacium
              </motion.p>

              {/* Search and Filter Bar */}
              <motion.div
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 max-w-4xl mx-auto"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              >
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search paths by title, description, or skills..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category} className="text-gray-900">
                          {category === "all" ? "All Categories" : category}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="px-4 py-3 bg-white/5 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-300"
                    >
                      {levels.map((level) => (
                        <option key={level} value={level} className="text-gray-900">
                          {level === "all" ? "All Levels" : level}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>


        {/* Paths Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
            <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            >
            <h2 className="text-3xl font-bold text-gray-900">
                {filteredPaths.length} Learning Paths
            </h2>
            <p className="text-gray-600 mt-2">
                Discover comprehensive learning journeys tailored to your career goals
            </p>
            </motion.div>

            <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center space-x-4"
            >
            <span className="text-sm text-gray-500">Sort by:</span>
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option>Most Popular</option>
                <option>Newest First</option>
                <option>Difficulty Level</option>
                <option>Duration</option>
            </select>
            </motion.div>
        </div>

        {/* Paths List */}
        <div className="space-y-8">
            {filteredPaths.map((path, index) => (
            <motion.div
                key={path.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
            >
                <PathCard
                path={path}
                isExpanded={expandedPaths.has(path.id)}
                onToggle={() => togglePath(path.id)}
                />
            </motion.div>
            ))}
        </div>

        {/* Empty State */}
        {filteredPaths.length === 0 && (
            <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
            >
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No paths found</h3>
            <p className="text-gray-600 max-w-md mx-auto">
                Try adjusting your search terms or filters to find what you're looking for.
            </p>
            </motion.div>
        )}
        </div>

        {/* ✅ Footer moved inside the main container */}
        <Footer />
    </div>
    );

}