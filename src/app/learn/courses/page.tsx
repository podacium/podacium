'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion'
import { ChevronDown, ChevronUp, Search, Filter, Clock, BookOpen, Play, Lock, CheckCircle, Users, Star, Target, ArrowRight, Sparkles, Zap, Award, Bookmark, Share2, Eye, BookText, Video, Download, BarChart3, Target as TargetIcon, Globe, Cpu, Brain, Database, Code, TrendingUp } from 'lucide-react'
import Navbar from '../../../components/Navbar'
import Footer from '../../../components/Footer'

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
  resources?: number
  exercises?: number
  type?: 'video' | 'reading' | 'exercise' | 'quiz' | 'interactive' | 'case-study' | 'project' 
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced'
}

interface Module {
  id: string
  title: string
  description: string
  fullDescription: string
  duration: string
  lessons: Lesson[]
  icon: string
  category: string
  order: number
  isCompleted?: boolean
  progress?: number
  gradient: string
  skills: string[]
  path: string
  level: 'Foundation' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  rating?: number
  enrolled?: number
  featured?: boolean
  new?: boolean
  lastUpdated?: string
  instructor?: string
  learningObjectives?: string[]
  prerequisites?: string[]
  completionBadge?: string
  estimatedEffort?: string
}

// =============================================================================
// ENHANCED MOCK DATA
// =============================================================================

const COURSE_MODULES: Module[] = [
  // Foundation Modules (Common to All Paths)
  {
    id: 'common-1',
    title: 'Common Foundations',
    description: 'Essential skills and knowledge required across all career paths in the digital age.',
    fullDescription: 'Build the fundamental capabilities needed to thrive in modern digital environments. This module establishes core competencies in digital literacy, critical thinking, data awareness, and professional communication that form the bedrock of all specialized career paths.',
    duration: '4 hours',
    lessons: [
      {
        id: 'common-1-1',
        title: 'Digital Literacy Fundamentals',
        description: 'Understand core digital concepts and tools essential for modern workplaces.',
        duration: '45 min',
        isCompleted: false,
        isLocked: false,
        type: 'video',
        resources: 3,
        exercises: 2
      },
      {
        id: 'common-1-2',
        title: 'Critical Thinking & Problem Solving',
        description: 'Develop analytical thinking skills to approach complex challenges systematically.',
        duration: '60 min',
        isCompleted: false,
        isLocked: false,
        type: 'interactive',
        resources: 4,
        exercises: 3
      },
      {
        id: 'common-1-3',
        title: 'Basic Data Analytics Concepts',
        description: 'Introduction to data analysis principles and common analytical approaches.',
        duration: '75 min',
        isCompleted: false,
        isLocked: false,
        type: 'video',
        resources: 5,
        exercises: 2
      },
      {
        id: 'common-1-4',
        title: 'Effective Communication Skills',
        description: 'Master professional communication techniques for collaborative environments.',
        duration: '60 min',
        isCompleted: false,
        isLocked: false,
        type: 'interactive',
        resources: 3,
        exercises: 4
      }
    ],
    icon: '🌐',
    category: 'Foundation',
    order: 1,
    progress: 0,
    gradient: 'from-blue-500 to-cyan-500',
    skills: ['Digital Literacy', 'Critical Thinking', 'Data Analytics', 'Communication'],
    path: 'Common',
    level: 'Beginner',
    prerequisites: [],
    learningObjectives: [
      'Master essential digital tools and platforms',
      'Develop systematic problem-solving approaches',
      'Understand basic data analysis concepts',
      'Enhance professional communication skills'
    ],
    completionBadge: 'Digital Foundations Badge',
    estimatedEffort: '4-5 hours per week'
  },

  // Data Explorer Path Modules
  {
    id: 'de-1',
    title: 'Data Literacy & Ethics',
    description: 'Understand data fundamentals, privacy concerns, and ethical considerations in data handling.',
    fullDescription: 'Develop comprehensive understanding of data concepts, privacy frameworks, and ethical decision-making in data-driven environments. Learn to navigate complex data governance landscapes and apply ethical principles to real-world scenarios.',
    duration: '5 hours',
    lessons: [
      {
        id: 'de-1-1',
        title: 'Introduction to Data Concepts',
        description: 'Learn fundamental data types, structures, and their real-world applications.',
        duration: '45 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 2
      },
      {
        id: 'de-1-2',
        title: 'Data Privacy Fundamentals',
        description: 'Understand privacy laws and ethical considerations in data collection and usage.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 3
      },
      {
        id: 'de-1-3',
        title: 'Data Governance Principles',
        description: 'Explore frameworks for managing data quality, security, and compliance.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 6,
        exercises: 2
      },
      {
        id: 'de-1-4',
        title: 'Ethical Data Decision Making',
        description: 'Apply ethical frameworks to real-world data scenarios and case studies.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 4
      },
      {
        id: 'de-1-5',
        title: 'Data Ethics Case Studies',
        description: 'Analyze real-world examples of ethical challenges in data-driven organizations.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 5,
        exercises: 3
      }
    ],
    icon: '📚',
    category: 'Data & AI',
    order: 2,
    progress: 0,
    gradient: 'from-purple-500 to-pink-500',
    skills: ['Data Ethics', 'Privacy Laws', 'Data Governance', 'Case Studies'],
    path: 'Data Explorer',
    level: 'Beginner',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Understand data types and structures',
      'Master data privacy regulations',
      'Apply ethical frameworks to data decisions',
      'Analyze real-world data ethics cases'
    ],
    completionBadge: 'Data Ethics Specialist',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'de-2',
    title: 'Spreadsheets & SQL Basics',
    description: 'Master essential data manipulation skills using spreadsheets and basic SQL queries.',
    fullDescription: 'Develop proficiency in data manipulation and analysis using industry-standard tools. Learn Advanced spreadsheet functions and SQL querying to extract, transform, and analyze data efficiently.',
    duration: '6 hours',
    lessons: [
      {
        id: 'de-2-1',
        title: 'Advanced Spreadsheet Functions',
        description: 'Master complex formulas, pivot tables, and data analysis in Excel/Sheets.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'de-2-2',
        title: 'SQL Query Fundamentals',
        description: 'Learn basic SELECT statements, filtering, and sorting data in databases.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 6,
        exercises: 3
      },
      {
        id: 'de-2-3',
        title: 'Data Filtering Techniques',
        description: 'Master WHERE clauses, pattern matching, and conditional filtering.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 4,
        exercises: 4
      },
      {
        id: 'de-2-4',
        title: 'Aggregate Functions & Grouping',
        description: 'Use SUM, COUNT, AVG and GROUP BY for data summarization.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'de-2-5',
        title: 'Joining Multiple Data Tables',
        description: 'Understand INNER JOIN, LEFT JOIN and combining datasets.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'de-2-6',
        title: 'Practical SQL Exercises',
        description: 'Apply SQL skills to solve real-world data analysis problems.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      }
    ],
    icon: '📊',
    category: 'Data & AI',
    order: 3,
    progress: 0,
    gradient: 'from-green-500 to-teal-500',
    skills: ['SQL', 'Spreadsheets', 'Data Analysis', 'Database Queries'],
    path: 'Data Explorer',
    level: 'Beginner',
    prerequisites: ['de-1'],
    learningObjectives: [
      'Master Advanced spreadsheet functions',
      'Write complex SQL queries',
      'Perform data filtering and aggregation',
      'Solve real-world data problems'
    ],
    completionBadge: 'Data Manipulation Expert',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'de-3',
    title: 'Data Visualization & Storytelling',
    description: 'Learn to create compelling visualizations and tell stories with data.',
    fullDescription: 'Transform raw data into compelling narratives through effective visualization techniques. Master the art of data storytelling to communicate insights clearly and persuasively to diverse audiences.',
    duration: '7 hours',
    lessons: [
      {
        id: 'de-3-1',
        title: 'Principles of Data Visualization',
        description: 'Learn fundamental principles for creating effective and accurate visualizations.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'de-3-2',
        title: 'Choosing the Right Chart Types',
        description: 'Match visualization types to different data stories and analysis goals.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'de-3-3',
        title: 'Color Theory & Design Principles',
        description: 'Apply color psychology and design best practices to visualizations.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'de-3-4',
        title: 'Data Storytelling Framework',
        description: 'Structure compelling narratives that guide audiences through data insights.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'de-3-5',
        title: 'Interactive Visualization Tools',
        description: 'Create dynamic and interactive charts using modern visualization libraries.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'de-3-6',
        title: 'Audience Engagement Strategies',
        description: 'Tailor visualizations and stories to different stakeholder groups.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      },
      {
        id: 'de-3-7',
        title: 'Dashboard Design Best Practices',
        description: 'Create comprehensive dashboards that drive decision-making.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      }
    ],
    icon: '📈',
    category: 'Data & AI',
    order: 4,
    progress: 0,
    gradient: 'from-orange-500 to-red-500',
    skills: ['Data Visualization', 'Storytelling', 'Dashboard Design', 'Color Theory'],
    path: 'Data Explorer',
    level: 'Intermediate',
    prerequisites: ['de-2'],
    learningObjectives: [
      'Create effective data visualizations',
      'Structure compelling data narratives',
      'Design interactive dashboards',
      'Tailor communication to different audiences'
    ],
    completionBadge: 'Data Storytelling Specialist',
    estimatedEffort: '7-8 hours per week'
  },

  {
    id: 'de-4',
    title: 'Applied Data Exploration Project',
    description: 'Hands-on project exploring real datasets to uncover insights and patterns.',
    fullDescription: 'Apply all learned skills in a comprehensive data exploration project. Work with real-world datasets to uncover insights, create visualizations, and present findings to stakeholders.',
    duration: '7 hours',
    lessons: [
      {
        id: 'de-4-1',
        title: 'Project Setup & Data Acquisition',
        description: 'Set up your analysis environment and source relevant datasets.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'de-4-2',
        title: 'Data Cleaning & Preparation',
        description: 'Clean and transform raw data for analysis using best practices.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'de-4-3',
        title: 'Exploratory Data Analysis',
        description: 'Perform comprehensive exploration to understand data patterns and relationships.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'de-4-4',
        title: 'Statistical Analysis Techniques',
        description: 'Apply statistical methods to validate findings and insights.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'de-4-5',
        title: 'Visualization Development',
        description: 'Create comprehensive visualizations that tell the data story.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'de-4-6',
        title: 'Insight Generation & Synthesis',
        description: 'Synthesize findings into actionable business insights.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'de-4-7',
        title: 'Final Presentation & Documentation',
        description: 'Prepare and present your findings to stakeholders.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🔍',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-indigo-500 to-purple-500',
    skills: ['Data Analysis', 'Project Management', 'Statistical Methods', 'Presentation'],
    path: 'Data Explorer',
    level: 'Intermediate',
    prerequisites: ['de-3'],
    learningObjectives: [
      'Execute end-to-end data analysis projects',
      'Apply statistical validation methods',
      'Create comprehensive data visualizations',
      'Present findings effectively to stakeholders'
    ],
    completionBadge: 'Data Exploration Expert',
    estimatedEffort: '8-10 hours per week'
  },

  // Business Intelligence Analyst Path Modules
  {
    id: 'bi-1',
    title: 'Data Cleaning & Preparation',
    description: 'Master techniques for cleaning, transforming, and preparing data for analysis.',
    fullDescription: 'Develop expertise in data quality assessment, cleaning methodologies, and preparation techniques essential for reliable business intelligence. Learn to handle missing data, outliers, and data transformation at scale.',
    duration: '6 hours',
    lessons: [
      {
        id: 'bi-1-1',
        title: 'Data Quality Assessment',
        description: 'Evaluate data quality and identify common data issues.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'bi-1-2',
        title: 'Data Cleaning Techniques',
        description: 'Master techniques for handling missing values and outliers.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'bi-1-3',
        title: 'Data Transformation Methods',
        description: 'Learn to reshape and transform data for analysis.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'bi-1-4',
        title: 'Data Validation & Quality Checks',
        description: 'Implement validation rules and quality assurance processes.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'bi-1-5',
        title: 'Automation of Data Processes',
        description: 'Create automated workflows for repetitive data tasks.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'bi-1-6',
        title: 'Data Preparation Best Practices',
        description: 'Establish standards and documentation for data preparation.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🧹',
    category: 'Data & AI',
    order: 2,
    progress: 0,
    gradient: 'from-blue-600 to-indigo-600',
    skills: ['Data Cleaning', 'Data Quality', 'Automation', 'Data Validation'],
    path: 'Business Intelligence Analyst',
    level: 'Intermediate',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Assess and improve data quality',
      'Implement data cleaning techniques',
      'Automate data preparation workflows',
      'Establish data quality standards'
    ],
    completionBadge: 'Data Preparation Specialist',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'bi-2',
    title: 'Business Metrics & KPIs',
    description: 'Learn to define, track, and analyze key business performance indicators.',
    fullDescription: 'Master the art of developing and implementing KPI frameworks that align with business objectives. Learn to track performance, set targets, and create comprehensive reporting systems.',
    duration: '6 hours',
    lessons: [
      {
        id: 'bi-2-1',
        title: 'KPI Framework Development',
        description: 'Design comprehensive KPI frameworks aligned with business objectives.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'bi-2-2',
        title: 'Performance Tracking Systems',
        description: 'Implement systems to monitor and track KPIs effectively.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'bi-2-3',
        title: 'Goal Setting & Target Management',
        description: 'Set realistic targets and manage performance against goals.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'bi-2-4',
        title: 'Industry Standard Metrics',
        description: 'Understand common KPIs across different industries and functions.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'bi-2-5',
        title: 'KPI Visualization Techniques',
        description: 'Create effective visualizations for different types of KPIs.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'bi-2-6',
        title: 'KPI Reporting Best Practices',
        description: 'Develop comprehensive reporting frameworks for stakeholders.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🎯',
    category: 'Business & Strategy',
    order: 3,
    progress: 0,
    gradient: 'from-green-600 to-emerald-600',
    skills: ['KPI Development', 'Performance Tracking', 'Goal Setting', 'Business Metrics'],
    path: 'Business Intelligence Analyst',
    level: 'Intermediate',
    prerequisites: ['bi-1'],
    learningObjectives: [
      'Design comprehensive KPI frameworks',
      'Implement performance tracking systems',
      'Set and manage business targets',
      'Create effective KPI visualizations'
    ],
    completionBadge: 'KPI Strategy Expert',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'bi-3',
    title: 'Dashboard Design Principles',
    description: 'Design effective and user-friendly dashboards that drive business decisions.',
    fullDescription: 'Master the principles of user-centered dashboard design. Learn to create intuitive layouts, conduct user testing, and design accessible, responsive dashboards for diverse user groups.',
    duration: '6 hours',
    lessons: [
      {
        id: 'bi-3-1',
        title: 'UI/UX Principles for Dashboards',
        description: 'Apply user-centered design principles to dashboard creation.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'bi-3-2',
        title: 'Information Hierarchy & Layout',
        description: 'Design intuitive layouts that guide users through information.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'bi-3-3',
        title: 'User Testing & Feedback Integration',
        description: 'Conduct user testing and incorporate feedback into designs.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'bi-3-4',
        title: 'Iterative Design Process',
        description: 'Implement continuous improvement cycles for dashboard design.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'bi-3-5',
        title: 'Accessibility & Inclusivity',
        description: 'Design dashboards that are accessible to diverse user groups.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'bi-3-6',
        title: 'Mobile & Responsive Design',
        description: 'Create dashboards that work across different devices and screen sizes.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📱',
    category: 'Technology',
    order: 4,
    progress: 0,
    gradient: 'from-purple-600 to-pink-600',
    skills: ['UI/UX Design', 'Information Architecture', 'User Testing', 'Accessibility'],
    path: 'Business Intelligence Analyst',
    level: 'Intermediate',
    prerequisites: ['bi-2'],
    learningObjectives: [
      'Apply UI/UX principles to dashboard design',
      'Create intuitive information hierarchies',
      'Conduct effective user testing',
      'Design accessible and responsive dashboards'
    ],
    completionBadge: 'Dashboard Design Specialist',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'bi-4',
    title: 'Advanced BI Tools (Power BI, Tableau)',
    description: 'Master industry-leading BI tools for Advanced analytics and visualization.',
    fullDescription: 'Develop expertise in leading business intelligence platforms. Learn Advanced features, custom visualization development, data modeling, and integration capabilities of Power BI and Tableau.',
    duration: '6 hours',
    lessons: [
      {
        id: 'bi-4-1',
        title: 'Power BI Fundamentals',
        description: 'Master the core features and capabilities of Power BI.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'bi-4-2',
        title: 'Tableau Core Concepts',
        description: 'Learn essential Tableau features for data visualization.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'bi-4-3',
        title: 'Advanced Calculations & Measures',
        description: 'Create complex calculations and custom measures in BI tools.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'bi-4-4',
        title: 'Custom Visual Development',
        description: 'Build and customize visualizations to meet specific business needs.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'bi-4-5',
        title: 'Data Modeling in BI Tools',
        description: 'Create efficient data models and relationships within BI platforms.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'bi-4-6',
        title: 'Tool Integration & Automation',
        description: 'Integrate BI tools with other systems and automate reporting.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🛠️',
    category: 'Data & AI',
    order: 5,
    progress: 0,
    gradient: 'from-orange-600 to-red-600',
    skills: ['Power BI', 'Tableau', 'Data Modeling', 'BI Automation'],
    path: 'Business Intelligence Analyst',
    level: 'Intermediate',
    prerequisites: ['bi-3'],
    learningObjectives: [
      'Master Power BI and Tableau features',
      'Create Advanced calculations and measures',
      'Develop custom visualizations',
      'Implement BI tool integrations'
    ],
    completionBadge: 'BI Tools Expert',
    estimatedEffort: '7-8 hours per week'
  },

  {
    id: 'bi-5',
    title: 'Real-World BI Case Study',
    description: 'Complete BI project from data sourcing to dashboard deployment.',
    fullDescription: 'Apply all BI skills in a comprehensive real-world project. Manage stakeholders, implement ETL processes, develop dashboards, and deploy solutions in a simulated business environment.',
    duration: '6 hours',
    lessons: [
      {
        id: 'bi-5-1',
        title: 'End-to-End Project Planning',
        description: 'Plan and scope a comprehensive BI project from start to finish.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'bi-5-2',
        title: 'Stakeholder Management',
        description: 'Engage stakeholders and manage expectations throughout the project.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'bi-5-3',
        title: 'Data Integration & ETL Processes',
        description: 'Implement complete data integration and transformation pipelines.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'bi-5-4',
        title: 'Dashboard Development & Testing',
        description: 'Build and thoroughly test interactive dashboards.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'bi-5-5',
        title: 'Deployment & User Training',
        description: 'Deploy solutions and train end-users effectively.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'bi-5-6',
        title: 'Documentation & Maintenance',
        description: 'Create comprehensive documentation and establish maintenance processes.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🏢',
    category: 'Applied Practice',
    order: 6,
    progress: 0,
    gradient: 'from-teal-600 to-cyan-600',
    skills: ['Project Management', 'Stakeholder Engagement', 'ETL Processes', 'Solution Deployment'],
    path: 'Business Intelligence Analyst',
    level: 'Advanced',
    prerequisites: ['bi-4'],
    learningObjectives: [
      'Plan and execute end-to-end BI projects',
      'Manage stakeholder relationships effectively',
      'Implement comprehensive ETL processes',
      'Deploy and maintain BI solutions'
    ],
    completionBadge: 'BI Implementation Specialist',
    estimatedEffort: '8-10 hours per week'
  },

  // AI Thinker Path Modules
  {
    id: 'ait-1',
    title: 'Philosophy & Logic of AI',
    description: 'Explore the philosophical underpinnings and logical foundations of artificial intelligence.',
    fullDescription: 'Dive deep into the philosophical roots and logical frameworks that underpin artificial intelligence. Explore consciousness theories, symbolic AI, and the fundamental questions surrounding machine intelligence.',
    duration: '5 hours',
    lessons: [
      {
        id: 'ait-1-1',
        title: 'History of AI & Philosophical Roots',
        description: 'Trace the evolution of AI from philosophical concepts to modern implementations.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'ait-1-2',
        title: 'Symbolic AI & Logic Systems',
        description: 'Understand symbolic reasoning and logical foundations of early AI systems.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'ait-1-3',
        title: 'Consciousness & Machine Intelligence',
        description: 'Explore theories of consciousness and their relevance to AI development.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'ait-1-4',
        title: 'The Turing Test & Beyond',
        description: 'Examine intelligence tests and their limitations in evaluating AI systems.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'ait-1-5',
        title: 'Philosophical Debates in AI',
        description: 'Analyze key philosophical questions surrounding artificial intelligence.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🤔',
    category: 'Philosophy & Ethics',
    order: 2,
    progress: 0,
    gradient: 'from-indigo-600 to-purple-600',
    skills: ['AI Philosophy', 'Logic Systems', 'Consciousness Theory', 'Ethical Debates'],
    path: 'AI Thinker',
    level: 'Intermediate',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Understand AI historical development',
      'Master symbolic AI concepts',
      'Explore consciousness theories',
      'Analyze philosophical AI debates'
    ],
    completionBadge: 'AI Philosophy Specialist',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'ait-2',
    title: 'Cognitive Systems & Human-Machine Thinking',
    description: 'Study how AI systems mimic and augment human cognitive processes.',
    fullDescription: 'Explore the fascinating parallels between human cognition and artificial intelligence systems. Study neural networks, learning theories, decision-making processes, and human-AI collaboration models.',
    duration: '6 hours',
    lessons: [
      {
        id: 'ait-2-1',
        title: 'Human Cognition & AI Parallels',
        description: 'Compare human cognitive processes with AI system architectures.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'ait-2-2',
        title: 'Neural Networks & Brain Analogies',
        description: 'Explore how artificial neural networks relate to biological neural systems.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'ait-2-3',
        title: 'Learning Theories in AI Systems',
        description: 'Understand different learning paradigms and their cognitive counterparts.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'ait-2-4',
        title: 'Decision-Making Systems',
        description: 'Study how AI systems make decisions compared to human reasoning.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'ait-2-5',
        title: 'Creativity & AI Generation',
        description: 'Examine AI capabilities in creative tasks and problem-solving.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'ait-2-6',
        title: 'Human-AI Collaboration Models',
        description: 'Learn frameworks for effective collaboration between humans and AI systems.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🧩',
    category: 'Cognitive Science',
    order: 3,
    progress: 0,
    gradient: 'from-blue-500 to-cyan-500',
    skills: ['Cognitive Science', 'Neural Networks', 'Learning Theories', 'Human-AI Collaboration'],
    path: 'AI Thinker',
    level: 'Intermediate',
    prerequisites: ['ait-1'],
    learningObjectives: [
      'Compare human and AI cognitive processes',
      'Understand neural network-brain analogies',
      'Analyze AI learning paradigms',
      'Design human-AI collaboration frameworks'
    ],
    completionBadge: 'Cognitive Systems Analyst',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'ait-3',
    title: 'Ethical AI & Societal Implications',
    description: 'Investigate the ethical considerations and societal impacts of AI technologies.',
    fullDescription: 'Delve into the critical ethical dimensions of AI deployment. Examine bias, privacy concerns, economic impacts, and regulatory frameworks shaping the responsible development of artificial intelligence.',
    duration: '6 hours',
    lessons: [
      {
        id: 'ait-3-1',
        title: 'AI Bias & Fairness',
        description: 'Understand sources of bias in AI systems and mitigation strategies.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'ait-3-2',
        title: 'Privacy & Surveillance Concerns',
        description: 'Examine privacy implications of AI technologies and data collection.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'ait-3-3',
        title: 'AI in Social Systems',
        description: 'Analyze how AI impacts social structures and community dynamics.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'ait-3-4',
        title: 'Economic Impact & Job Transformation',
        description: 'Study AI effects on employment and economic systems.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'ait-3-5',
        title: 'Regulatory Frameworks & Governance',
        description: 'Explore legal and regulatory approaches to AI oversight.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'ait-3-6',
        title: 'Global AI Policy Perspectives',
        description: 'Compare different national and international approaches to AI governance.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '⚖️',
    category: 'Ethics & Society',
    order: 4,
    progress: 0,
    gradient: 'from-red-500 to-pink-500',
    skills: ['AI Ethics', 'Bias Mitigation', 'Policy Analysis', 'Social Impact'],
    path: 'AI Thinker',
    level: 'Intermediate',
    prerequisites: ['ait-2'],
    learningObjectives: [
      'Identify and mitigate AI bias',
      'Analyze privacy implications',
      'Understand economic impacts',
      'Evaluate regulatory frameworks'
    ],
    completionBadge: 'AI Ethics Analyst',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'ait-4',
    title: 'Reflective AI Project',
    description: 'Apply philosophical and ethical frameworks to analyze real-world AI systems.',
    fullDescription: 'Conduct a comprehensive analysis of real AI systems using philosophical and ethical frameworks. Evaluate cognitive processes, societal impacts, and propose alternative designs and policies.',
    duration: '8 hours',
    lessons: [
      {
        id: 'ait-4-1',
        title: 'Project Scope & System Selection',
        description: 'Define project parameters and select AI systems for analysis.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'ait-4-2',
        title: 'Ethical Framework Application',
        description: 'Apply ethical frameworks to evaluate selected AI systems.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'ait-4-3',
        title: 'Cognitive Process Analysis',
        description: 'Analyze how AI systems mimic or differ from human cognition.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'ait-4-4',
        title: 'Societal Impact Assessment',
        description: 'Evaluate broader societal implications of the AI systems studied.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'ait-4-5',
        title: 'Stakeholder Perspective Analysis',
        description: 'Consider impacts from multiple stakeholder viewpoints.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'ait-4-6',
        title: 'Alternative Design Considerations',
        description: 'Propose alternative approaches to address identified issues.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'ait-4-7',
        title: 'Policy Recommendation Development',
        description: 'Develop policy recommendations based on analysis findings.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'ait-4-8',
        title: 'Final Reflection & Presentation',
        description: 'Synthesize findings and present comprehensive analysis.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      }
    ],
    icon: '🔍',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-purple-600 to-indigo-600',
    skills: ['Ethical Analysis', 'Policy Development', 'Stakeholder Analysis', 'System Evaluation'],
    path: 'AI Thinker',
    level: 'Advanced',
    prerequisites: ['ait-3'],
    learningObjectives: [
      'Apply ethical frameworks to real AI systems',
      'Conduct comprehensive impact assessments',
      'Develop stakeholder-informed analyses',
      'Create actionable policy recommendations'
    ],
    completionBadge: 'AI Systems Analyst',
    estimatedEffort: '8-10 hours per week'
  },

  // Machine Builder Path Modules
  {
    id: 'mb-1',
    title: 'Python for Machine Learning',
    description: 'Master Python programming fundamentals essential for machine learning development.',
    fullDescription: 'Build strong Python programming foundations specifically tailored for machine learning applications. Master essential libraries, data structures, and programming patterns used in ML development.',
    duration: '5 hours',
    lessons: [
      {
        id: 'mb-1-1',
        title: 'Python Syntax & Data Structures',
        description: 'Learn essential Python syntax and data structures for ML applications.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'mb-1-2',
        title: 'NumPy for Numerical Computing',
        description: 'Master NumPy arrays and operations for efficient numerical computations.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'mb-1-3',
        title: 'Pandas for Data Manipulation',
        description: 'Learn data manipulation and analysis with Pandas DataFrames.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'mb-1-4',
        title: 'Data Visualization with Matplotlib',
        description: 'Create effective visualizations for data exploration and model evaluation.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'mb-1-5',
        title: 'Python Functions & Classes for ML',
        description: 'Build reusable code structures for machine learning pipelines.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🐍',
    category: 'Programming',
    order: 2,
    progress: 0,
    gradient: 'from-green-500 to-emerald-500',
    skills: ['Python', 'NumPy', 'Pandas', 'Data Visualization'],
    path: 'Machine Builder',
    level: 'Intermediate',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Master Python programming fundamentals',
      'Utilize NumPy for numerical computing',
      'Manipulate data with Pandas',
      'Create effective data visualizations'
    ],
    completionBadge: 'Python for ML Specialist',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'mb-2',
    title: 'Core ML Algorithms & Models',
    description: 'Understand and implement fundamental machine learning algorithms.',
    fullDescription: 'Dive into core machine learning algorithms and their practical implementation. Learn regression, classification, clustering, ensemble methods, and model evaluation techniques.',
    duration: '6 hours',
    lessons: [
      {
        id: 'mb-2-1',
        title: 'Linear Regression & Model Evaluation',
        description: 'Implement linear models and learn evaluation metrics for regression.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'mb-2-2',
        title: 'Classification Algorithms',
        description: 'Master logistic regression, SVM, and decision trees for classification.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'mb-2-3',
        title: 'Clustering & Unsupervised Learning',
        description: 'Implement K-means and hierarchical clustering algorithms.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'mb-2-4',
        title: 'Model Selection & Hyperparameter Tuning',
        description: 'Learn cross-validation and hyperparameter optimization techniques.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'mb-2-5',
        title: 'Ensemble Methods',
        description: 'Implement random forests and gradient boosting algorithms.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'mb-2-6',
        title: 'Model Interpretation & Explainability',
        description: 'Learn techniques to interpret and explain model predictions.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📊',
    category: 'Machine Learning',
    order: 3,
    progress: 0,
    gradient: 'from-blue-600 to-cyan-600',
    skills: ['Regression', 'Classification', 'Clustering', 'Model Evaluation'],
    path: 'Machine Builder',
    level: 'Intermediate',
    prerequisites: ['mb-1'],
    learningObjectives: [
      'Implement core ML algorithms',
      'Apply model evaluation techniques',
      'Perform hyperparameter tuning',
      'Create ensemble models'
    ],
    completionBadge: 'ML Algorithms Expert',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'mb-3',
    title: 'Neural Networks & Deep Learning',
    description: 'Dive into deep learning with neural networks and Advanced architectures.',
    fullDescription: 'Master deep learning concepts and architectures. Build and train neural networks, convolutional networks, recurrent networks, and understand transfer learning and deployment considerations.',
    duration: '7 hours',
    lessons: [
      {
        id: 'mb-3-1',
        title: 'Neural Network Fundamentals',
        description: 'Understand perceptrons, activation functions, and backpropagation.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'mb-3-2',
        title: 'Building Neural Networks with TensorFlow',
        description: 'Create and train neural networks using TensorFlow/Keras.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'mb-3-3',
        title: 'Convolutional Neural Networks',
        description: 'Implement CNNs for image recognition and computer vision tasks.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'mb-3-4',
        title: 'Recurrent Neural Networks',
        description: 'Build RNNs and LSTMs for sequence data and time series analysis.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'mb-3-5',
        title: 'Transfer Learning & Pre-trained Models',
        description: 'Leverage pre-trained models for efficient deep learning applications.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'mb-3-6',
        title: 'Regularization & Optimization Techniques',
        description: 'Apply dropout, batch normalization, and Advanced optimizers.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'mb-3-7',
        title: 'Model Deployment Considerations',
        description: 'Prepare models for production deployment and scaling.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🧠',
    category: 'Deep Learning',
    order: 4,
    progress: 0,
    gradient: 'from-purple-500 to-pink-500',
    skills: ['Neural Networks', 'TensorFlow', 'CNN', 'RNN', 'Transfer Learning'],
    path: 'Machine Builder',
    level: 'Advanced',
    prerequisites: ['mb-2'],
    learningObjectives: [
      'Build and train neural networks',
      'Implement CNN and RNN architectures',
      'Apply transfer learning techniques',
      'Prepare models for deployment'
    ],
    completionBadge: 'Deep Learning Specialist',
    estimatedEffort: '7-9 hours per week'
  },

  {
    id: 'mb-4',
    title: 'Mini ML Project',
    description: 'End-to-end machine learning project from data collection to model deployment.',
    fullDescription: 'Execute a complete machine learning project covering the entire pipeline from problem definition to model deployment. Apply all learned techniques in a practical, real-world scenario.',
    duration: '6 hours',
    lessons: [
      {
        id: 'mb-4-1',
        title: 'Problem Definition & Data Collection',
        description: 'Define ML problem and gather relevant datasets for analysis.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'mb-4-2',
        title: 'Exploratory Data Analysis',
        description: 'Perform comprehensive EDA to understand data characteristics.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'mb-4-3',
        title: 'Feature Engineering & Selection',
        description: 'Create and select meaningful features for model training.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'mb-4-4',
        title: 'Model Training & Evaluation',
        description: 'Train multiple models and evaluate their performance systematically.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'mb-4-5',
        title: 'Model Optimization & Tuning',
        description: 'Optimize best-performing model through hyperparameter tuning.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'mb-4-6',
        title: 'Deployment & Documentation',
        description: 'Deploy final model and create comprehensive documentation.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🚀',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-orange-500 to-red-500',
    skills: ['End-to-End ML', 'Feature Engineering', 'Model Deployment', 'Project Management'],
    path: 'Machine Builder',
    level: 'Advanced',
    prerequisites: ['mb-3'],
    learningObjectives: [
      'Execute complete ML project lifecycle',
      'Perform comprehensive feature engineering',
      'Optimize and tune model performance',
      'Deploy models to production environments'
    ],
    completionBadge: 'ML Project Engineer',
    estimatedEffort: '8-10 hours per week'
  },

  // Applied AI Innovator Path Modules
  {
    id: 'aai-1',
    title: 'AI Systems & Product Thinking',
    description: 'Develop product mindset for creating AI-powered solutions that deliver user value.',
    fullDescription: 'Cultivate a product-centric approach to AI development. Learn to design AI systems that solve real user problems, create compelling value propositions, and achieve product-market fit.',
    duration: '5 hours',
    lessons: [
      {
        id: 'aai-1-1',
        title: 'AI Product Lifecycle',
        description: 'Understand end-to-end lifecycle of AI-powered products and services.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aai-1-2',
        title: 'User-Centered AI Design',
        description: 'Apply human-centered design principles to AI system development.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aai-1-3',
        title: 'Value Proposition Development',
        description: 'Define clear value propositions for AI solutions across different domains.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aai-1-4',
        title: 'Minimum Viable AI Products',
        description: 'Learn rapid prototyping and MVP development for AI applications.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aai-1-5',
        title: 'Product-Market Fit for AI',
        description: 'Identify and validate product-market fit for AI-powered solutions.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🎯',
    category: 'Product Management',
    order: 2,
    progress: 0,
    gradient: 'from-teal-500 to-cyan-500',
    skills: ['Product Management', 'User-Centered Design', 'Value Proposition', 'MVP Development'],
    path: 'Applied AI Innovator',
    level: 'Advanced',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Manage AI product lifecycles',
      'Apply user-centered design principles',
      'Develop compelling value propositions',
      'Validate product-market fit'
    ],
    completionBadge: 'AI Product Strategist',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'aai-2',
    title: 'From Prototype to Deployment',
    description: 'Master the process of taking AI solutions from concept to production deployment.',
    fullDescription: 'Navigate the complete journey from AI prototype to production deployment. Learn technical feasibility assessment, scalability planning, deployment strategies, and operational considerations.',
    duration: '6 hours',
    lessons: [
      {
        id: 'aai-2-1',
        title: 'Technical Feasibility Assessment',
        description: 'Evaluate technical feasibility and resource requirements for AI projects.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aai-2-2',
        title: 'Scalability & Infrastructure Planning',
        description: 'Design scalable architectures and plan infrastructure needs.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aai-2-3',
        title: 'Deployment Strategies & CI/CD',
        description: 'Implement continuous integration and deployment for AI systems.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aai-2-4',
        title: 'Monitoring & Maintenance Systems',
        description: 'Establish monitoring, logging, and maintenance procedures.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aai-2-5',
        title: 'Performance Optimization',
        description: 'Optimize AI system performance and resource utilization.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'aai-2-6',
        title: 'Security & Compliance Considerations',
        description: 'Address security, privacy, and regulatory compliance requirements.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🚀',
    category: 'Technology',
    order: 3,
    progress: 0,
    gradient: 'from-blue-500 to-indigo-500',
    skills: ['Deployment Strategies', 'Scalability', 'CI/CD', 'Performance Optimization'],
    path: 'Applied AI Innovator',
    level: 'Advanced',
    prerequisites: ['aai-1'],
    learningObjectives: [
      'Assess technical feasibility of AI projects',
      'Design scalable AI architectures',
      'Implement CI/CD pipelines',
      'Ensure security and compliance'
    ],
    completionBadge: 'AI Deployment Specialist',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'aai-3',
    title: 'AI in Industry & Society',
    description: 'Explore AI applications across different industries and their societal impacts.',
    fullDescription: 'Examine real-world AI applications across diverse industries and understand their broader societal implications. Learn from case studies and identify cross-industry innovation patterns.',
    duration: '7 hours',
    lessons: [
      {
        id: 'aai-3-1',
        title: 'Healthcare AI Applications',
        description: 'Examine AI use cases in healthcare, diagnostics, and treatment planning.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aai-3-2',
        title: 'Financial Services & AI',
        description: 'Explore AI applications in banking, insurance, and financial markets.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aai-3-3',
        title: 'Retail & E-commerce AI',
        description: 'Study AI in customer experience, recommendation systems, and supply chain.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aai-3-4',
        title: 'Manufacturing & Industrial AI',
        description: 'Learn about AI in predictive maintenance, quality control, and automation.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aai-3-5',
        title: 'Education & Learning Technologies',
        description: 'Explore AI applications in personalized learning and educational tools.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'aai-3-6',
        title: 'Environmental & Sustainability AI',
        description: 'Study AI applications in climate science and environmental protection.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aai-3-7',
        title: 'Cross-Industry Innovation Patterns',
        description: 'Identify patterns and transferable innovations across different sectors.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      }
    ],
    icon: '🏭',
    category: 'Industry Applications',
    order: 4,
    progress: 0,
    gradient: 'from-green-600 to-emerald-600',
    skills: ['Industry Analysis', 'Use Case Development', 'Innovation Patterns', 'Cross-sector Applications'],
    path: 'Applied AI Innovator',
    level: 'Advanced',
    prerequisites: ['aai-2'],
    learningObjectives: [
      'Analyze AI applications across industries',
      'Identify industry-specific use cases',
      'Understand societal impacts of AI',
      'Recognize cross-industry innovation patterns'
    ],
    completionBadge: 'AI Industry Analyst',
    estimatedEffort: '7-9 hours per week'
  },

  {
    id: 'aai-4',
    title: 'Innovation Capstone Project',
    description: 'Develop and present a comprehensive AI innovation proposal for real-world impact.',
    fullDescription: 'Create a comprehensive AI innovation proposal addressing real-world challenges. Develop business cases, stakeholder engagement strategies, and implementation roadmaps for AI-powered solutions.',
    duration: '6 hours',
    lessons: [
      {
        id: 'aai-4-1',
        title: 'Opportunity Identification & Research',
        description: 'Identify and research potential AI innovation opportunities.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aai-4-2',
        title: 'Solution Design & Architecture',
        description: 'Design comprehensive solution architecture and technical approach.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aai-4-3',
        title: 'Business Case Development',
        description: 'Create detailed business case with ROI analysis and implementation plan.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aai-4-4',
        title: 'Stakeholder Analysis & Engagement',
        description: 'Identify stakeholders and develop engagement strategies.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aai-4-5',
        title: 'Risk Assessment & Mitigation',
        description: 'Analyze risks and develop comprehensive mitigation strategies.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'aai-4-6',
        title: 'Final Proposal & Presentation',
        description: 'Prepare and deliver compelling innovation proposal to stakeholders.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📋',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-purple-600 to-pink-600',
    skills: ['Innovation Strategy', 'Business Case Development', 'Stakeholder Management', 'Risk Assessment'],
    path: 'Applied AI Innovator',
    level: 'Advanced',
    prerequisites: ['aai-3'],
    learningObjectives: [
      'Identify AI innovation opportunities',
      'Develop comprehensive business cases',
      'Manage stakeholder relationships',
      'Assess and mitigate project risks'
    ],
    completionBadge: 'AI Innovation Leader',
    estimatedEffort: '8-10 hours per week'
  },

  // Builder Path Modules
  {
    id: 'b-1',
    title: 'Web & App Development Fundamentals',
    description: 'Master core web development technologies and modern application architecture.',
    fullDescription: 'Build strong foundations in modern web development. Learn HTML5, CSS3, JavaScript, React, and development tools to create responsive, accessible web applications.',
    duration: '5 hours',
    lessons: [
      {
        id: 'b-1-1',
        title: 'HTML5 & Semantic Web',
        description: 'Learn modern HTML5 and semantic markup for accessible web applications.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'b-1-2',
        title: 'CSS3 & Responsive Design',
        description: 'Master CSS3, Flexbox, Grid, and responsive design principles.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'b-1-3',
        title: 'JavaScript ES6+ Fundamentals',
        description: 'Learn modern JavaScript syntax, functions, and asynchronous programming.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'b-1-4',
        title: 'React Components & State Management',
        description: 'Build reusable React components and manage application state effectively.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'b-1-5',
        title: 'Development Tools & Workflow',
        description: 'Set up development environment with Git, npm, and modern build tools.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🌐',
    category: 'Web Development',
    order: 2,
    progress: 0,
    gradient: 'from-yellow-500 to-orange-500',
    skills: ['HTML5', 'CSS3', 'JavaScript', 'React', 'Development Tools'],
    path: 'Builder',
    level: 'Intermediate',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Create semantic HTML5 structures',
      'Implement responsive CSS designs',
      'Master modern JavaScript features',
      'Build React components and manage state'
    ],
    completionBadge: 'Web Development Foundations',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'b-2',
    title: 'Databases, APIs & Backend Integration',
    description: 'Design robust backend systems and integrate with databases and external services.',
    fullDescription: 'Develop comprehensive backend development skills. Learn database design, API development, server architecture, and integration patterns for full-stack applications.',
    duration: '6 hours',
    lessons: [
      {
        id: 'b-2-1',
        title: 'Database Design & SQL',
        description: 'Design relational databases and write efficient SQL queries.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'b-2-2',
        title: 'NoSQL Databases & MongoDB',
        description: 'Work with document databases and understand NoSQL principles.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'b-2-3',
        title: 'RESTful API Design',
        description: 'Design and implement RESTful APIs with proper authentication.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'b-2-4',
        title: 'Node.js & Express Server Development',
        description: 'Build scalable backend servers with Node.js and Express framework.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'b-2-5',
        title: 'API Integration & Third-Party Services',
        description: 'Integrate external APIs and handle data from multiple sources.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'b-2-6',
        title: 'Authentication & Authorization',
        description: 'Implement secure user authentication and role-based access control.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🗄️',
    category: 'Backend Development',
    order: 3,
    progress: 0,
    gradient: 'from-blue-600 to-indigo-600',
    skills: ['Database Design', 'API Development', 'Node.js', 'Authentication', 'Integration'],
    path: 'Builder',
    level: 'Intermediate',
    prerequisites: ['b-1'],
    learningObjectives: [
      'Design and implement databases',
      'Create RESTful APIs',
      'Build scalable backend servers',
      'Implement secure authentication systems'
    ],
    completionBadge: 'Backend Development Specialist',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'b-3',
    title: 'AI-Integrated Product Development',
    description: 'Integrate AI capabilities into web applications and create intelligent features.',
    fullDescription: 'Learn to seamlessly integrate AI capabilities into web applications. Master API integration patterns, real-time AI features, performance optimization, and error handling for AI-powered applications.',
    duration: '7 hours',
    lessons: [
      {
        id: 'b-3-1',
        title: 'AI API Integration Patterns',
        description: 'Learn patterns for integrating AI services and APIs into applications.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'b-3-2',
        title: 'Real-time AI Features',
        description: 'Implement real-time AI capabilities like chatbots and recommendations.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'b-3-3',
        title: 'Data Processing for AI Integration',
        description: 'Prepare and process data for AI model consumption in web apps.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'b-3-4',
        title: 'AI-Powered User Interfaces',
        description: 'Design interfaces that effectively showcase AI capabilities.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'b-3-5',
        title: 'Performance Optimization for AI Features',
        description: 'Optimize application performance when integrating AI components.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'b-3-6',
        title: 'Error Handling & Fallback Strategies',
        description: 'Implement robust error handling for AI service failures.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      },
      {
        id: 'b-3-7',
        title: 'AI Feature Testing & Validation',
        description: 'Test and validate AI-integrated features thoroughly.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      }
    ],
    icon: '🤖',
    category: 'AI Integration',
    order: 4,
    progress: 0,
    gradient: 'from-purple-500 to-pink-500',
    skills: ['AI Integration', 'API Patterns', 'Real-time Systems', 'Performance Optimization', 'Error Handling'],
    path: 'Builder',
    level: 'Advanced',
    prerequisites: ['b-2'],
    learningObjectives: [
      'Integrate AI APIs into web applications',
      'Implement real-time AI features',
      'Optimize performance of AI components',
      'Handle AI service failures gracefully'
    ],
    completionBadge: 'AI Integration Developer',
    estimatedEffort: '7-9 hours per week'
  },

  {
    id: 'b-4',
    title: 'Full Project Capstone',
    description: 'Build a complete AI-integrated web application from concept to deployment.',
    fullDescription: 'Execute a comprehensive full-stack project integrating AI capabilities. Plan, develop, test, and deploy a complete web application with AI features, following industry best practices.',
    duration: '7 hours',
    lessons: [
      {
        id: 'b-4-1',
        title: 'Project Planning & Architecture',
        description: 'Plan full-stack application with AI integration and define architecture.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'b-4-2',
        title: 'Frontend Development & UI/UX',
        description: 'Build responsive frontend with modern React patterns and components.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'b-4-3',
        title: 'Backend API Development',
        description: 'Develop robust backend APIs with database integration and business logic.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'b-4-4',
        title: 'AI Feature Integration',
        description: 'Integrate AI capabilities and ensure seamless user experience.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'b-4-5',
        title: 'Testing & Quality Assurance',
        description: 'Implement comprehensive testing strategies for all application layers.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'b-4-6',
        title: 'Deployment & DevOps',
        description: 'Deploy application to cloud platform and set up CI/CD pipeline.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'b-4-7',
        title: 'Documentation & Presentation',
        description: 'Create comprehensive documentation and present final project.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🚀',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-green-600 to-teal-600',
    skills: ['Full-Stack Development', 'Project Management', 'DevOps', 'Testing', 'Documentation'],
    path: 'Builder',
    level: 'Advanced',
    prerequisites: ['b-3'],
    learningObjectives: [
      'Plan and architect full-stack applications',
      'Develop comprehensive frontend and backend systems',
      'Integrate AI features seamlessly',
      'Deploy and maintain production applications'
    ],
    completionBadge: 'Full-Stack AI Developer',
    estimatedEffort: '8-10 hours per week'
  },

  // Freelancer Path Modules
  {
    id: 'f-1',
    title: 'Building a Digital Portfolio',
    description: 'Create compelling portfolio that showcases your skills and attracts ideal clients.',
    fullDescription: 'Develop a powerful digital presence that demonstrates your expertise and attracts the right clients. Learn portfolio strategy, personal branding, and effective presentation of your work.',
    duration: '5 hours',
    lessons: [
      {
        id: 'f-1-1',
        title: 'Portfolio Strategy & Personal Branding',
        description: 'Define your unique value proposition and personal brand identity.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'f-1-2',
        title: 'Showcase Project Selection & Presentation',
        description: 'Select and present projects that demonstrate your capabilities effectively.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'f-1-3',
        title: 'Online Presence & Social Media Strategy',
        description: 'Build consistent online presence across relevant platforms and networks.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'f-1-4',
        title: 'Portfolio Website Development',
        description: 'Create professional portfolio website that converts visitors to clients.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'f-1-5',
        title: 'Testimonials & Social Proof',
        description: 'Collect and leverage testimonials and case studies effectively.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📁',
    category: 'Personal Branding',
    order: 2,
    progress: 0,
    gradient: 'from-teal-500 to-green-500',
    skills: ['Portfolio Development', 'Personal Branding', 'Online Presence', 'Social Proof'],
    path: 'Freelancer',
    level: 'Beginner',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Develop compelling personal brand',
      'Create effective portfolio presentations',
      'Build consistent online presence',
      'Leverage social proof effectively'
    ],
    completionBadge: 'Digital Portfolio Specialist',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'f-2',
    title: 'Client Acquisition & Proposal Writing',
    description: 'Master the art of finding clients and writing winning proposals.',
    fullDescription: 'Develop systematic approaches to client acquisition and proposal writing. Learn targeting strategies, networking techniques, pricing models, and conversion optimization.',
    duration: '6 hours',
    lessons: [
      {
        id: 'f-2-1',
        title: 'Client Research & Targeting',
        description: 'Identify and research potential clients that match your skills and interests.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'f-2-2',
        title: 'Networking & Relationship Building',
        description: 'Build professional networks and relationships that lead to client opportunities.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'f-2-3',
        title: 'Proposal Structure & Persuasion Techniques',
        description: 'Create compelling proposal structures that address client needs effectively.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'f-2-4',
        title: 'Pricing Strategies & Value-Based Pricing',
        description: 'Develop pricing strategies that reflect your value and market position.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'f-2-5',
        title: 'Contract Development & Legal Considerations',
        description: 'Create professional contracts that protect both you and your clients.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'f-2-6',
        title: 'Follow-up & Conversion Strategies',
        description: 'Implement effective follow-up sequences to convert proposals into projects.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📝',
    category: 'Business Development',
    order: 3,
    progress: 0,
    gradient: 'from-blue-500 to-cyan-500',
    skills: ['Client Acquisition', 'Proposal Writing', 'Pricing Strategies', 'Contract Law'],
    path: 'Freelancer',
    level: 'Beginner',
    prerequisites: ['f-1'],
    learningObjectives: [
      'Identify and target ideal clients',
      'Build professional networks',
      'Create winning proposals',
      'Develop effective pricing strategies'
    ],
    completionBadge: 'Client Acquisition Expert',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'f-3',
    title: 'AI Tools for Freelancers',
    description: 'Leverage AI tools to enhance productivity, quality, and competitive advantage.',
    fullDescription: 'Master AI tools specifically designed to boost freelance productivity and quality. Learn to automate tasks, enhance creativity, improve communication, and maintain ethical standards while using AI assistance.',
    duration: '7 hours',
    lessons: [
      {
        id: 'f-3-1',
        title: 'AI-Powered Productivity Tools',
        description: 'Master AI tools for task management, scheduling, and workflow optimization.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'f-3-2',
        title: 'Content Creation & Writing Assistance',
        description: 'Use AI for content creation, editing, and communication enhancement.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'f-3-3',
        title: 'Design & Creative AI Tools',
        description: 'Leverage AI for graphic design, video editing, and creative tasks.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'f-3-4',
        title: 'Code Generation & Technical Assistance',
        description: 'Use AI coding assistants to accelerate development and problem-solving.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'f-3-5',
        title: 'Client Communication Automation',
        description: 'Implement AI tools for efficient client communication and updates.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'f-3-6',
        title: 'Market Research & Competitive Analysis',
        description: 'Use AI for market research, trend analysis, and competitive intelligence.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      },
      {
        id: 'f-3-7',
        title: 'AI Ethics in Freelance Work',
        description: 'Understand ethical considerations when using AI in client projects.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      }
    ],
    icon: '🤖',
    category: 'AI Tools',
    order: 4,
    progress: 0,
    gradient: 'from-purple-500 to-indigo-500',
    skills: ['AI Productivity', 'Content Creation', 'Design Tools', 'Code Generation', 'Ethical AI'],
    path: 'Freelancer',
    level: 'Intermediate',
    prerequisites: ['f-2'],
    learningObjectives: [
      'Implement AI productivity tools effectively',
      'Enhance content creation with AI assistance',
      'Utilize AI for design and creative tasks',
      'Maintain ethical standards in AI usage'
    ],
    completionBadge: 'AI-Enhanced Freelancer',
    estimatedEffort: '7-8 hours per week'
  },

  {
    id: 'f-4',
    title: 'Freelance Project Simulation',
    description: 'Complete end-to-end freelance project from client brief to final delivery.',
    fullDescription: 'Experience a complete freelance project lifecycle in a simulated environment. Practice client communication, project management, AI tool integration, and professional delivery processes.',
    duration: '7 hours',
    lessons: [
      {
        id: 'f-4-1',
        title: 'Client Brief Analysis & Requirements Gathering',
        description: 'Analyze client brief and gather comprehensive project requirements.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'f-4-2',
        title: 'Project Planning & Scope Definition',
        description: 'Create detailed project plan with clear scope, timeline, and deliverables.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'f-4-3',
        title: 'Proposal & Contract Development',
        description: 'Develop comprehensive proposal and professional service agreement.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'f-4-4',
        title: 'Project Execution with AI Tools',
        description: 'Execute project using AI tools to enhance efficiency and quality.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'f-4-5',
        title: 'Client Communication & Progress Updates',
        description: 'Manage client communication and provide regular progress updates.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'f-4-6',
        title: 'Quality Assurance & Final Delivery',
        description: 'Conduct quality assurance and prepare final deliverables for client.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'f-4-7',
        title: 'Project Review & Continuous Improvement',
        description: 'Conduct project review and identify opportunities for improvement.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🎯',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-orange-500 to-red-500',
    skills: ['Project Management', 'Client Communication', 'Quality Assurance', 'Continuous Improvement'],
    path: 'Freelancer',
    level: 'Intermediate',
    prerequisites: ['f-3'],
    learningObjectives: [
      'Manage complete freelance project lifecycle',
      'Communicate effectively with clients',
      'Deliver high-quality work using AI tools',
      'Implement continuous improvement processes'
    ],
    completionBadge: 'Freelance Project Manager',
    estimatedEffort: '8-10 hours per week'
  },

  // AI Enhanced Worker Path Modules
  {
    id: 'aew-1',
    title: 'Productivity Tools & AI Automation',
    description: 'Master AI-powered tools to automate routine tasks and boost productivity.',
    fullDescription: 'Transform your work efficiency with AI-powered productivity tools. Learn to automate repetitive tasks, optimize workflows, and leverage AI for enhanced personal and team productivity.',
    duration: '5 hours',
    lessons: [
      {
        id: 'aew-1-1',
        title: 'AI Task Management Systems',
        description: 'Implement AI-enhanced task management and priority setting.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aew-1-2',
        title: 'Email Automation & Management',
        description: 'Use AI to automate email organization and response generation.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aew-1-3',
        title: 'Document Processing & Analysis',
        description: 'Leverage AI for document summarization, analysis, and organization.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aew-1-4',
        title: 'Meeting Automation & Follow-ups',
        description: 'Automate meeting scheduling, note-taking, and action item tracking.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aew-1-5',
        title: 'Workflow Optimization with AI',
        description: 'Identify and optimize inefficient workflows using AI tools.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '⚡',
    category: 'Productivity',
    order: 2,
    progress: 0,
    gradient: 'from-indigo-500 to-purple-500',
    skills: ['Task Automation', 'Email Management', 'Document Processing', 'Workflow Optimization'],
    path: 'AI Enhanced Worker',
    level: 'Beginner',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Implement AI task management systems',
      'Automate email and communication workflows',
      'Process documents efficiently with AI',
      'Optimize personal and team workflows'
    ],
    completionBadge: 'AI Productivity Specialist',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'aew-2',
    title: 'Communication & Collaboration with AI',
    description: 'Enhance team communication and collaboration using AI-powered tools.',
    fullDescription: 'Revolutionize workplace communication and collaboration with AI tools. Master AI writing assistants, virtual collaboration platforms, and cross-cultural communication enhancement.',
    duration: '6 hours',
    lessons: [
      {
        id: 'aew-2-1',
        title: 'AI Writing Assistants & Communication',
        description: 'Use AI to enhance written communication across different contexts.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aew-2-2',
        title: 'Presentation & Visual Communication',
        description: 'Leverage AI for creating compelling presentations and visual materials.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aew-2-3',
        title: 'Virtual Collaboration Tools',
        description: 'Master AI-enhanced virtual meeting and collaboration platforms.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aew-2-4',
        title: 'Cross-cultural Communication',
        description: 'Use AI tools to enhance communication across different cultures and languages.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aew-2-5',
        title: 'Feedback & Performance Communication',
        description: 'Leverage AI for providing and receiving constructive feedback.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'aew-2-6',
        title: 'Team Coordination & Project Updates',
        description: 'Use AI to streamline team coordination and progress reporting.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '💬',
    category: 'Communication',
    order: 3,
    progress: 0,
    gradient: 'from-blue-500 to-cyan-500',
    skills: ['Written Communication', 'Visual Communication', 'Virtual Collaboration', 'Cross-cultural Skills'],
    path: 'AI Enhanced Worker',
    level: 'Beginner',
    prerequisites: ['aew-1'],
    learningObjectives: [
      'Enhance written communication with AI tools',
      'Create compelling visual presentations',
      'Master virtual collaboration platforms',
      'Improve cross-cultural communication'
    ],
    completionBadge: 'AI Communication Expert',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'aew-3',
    title: 'Decision-Making & AI Augmentation',
    description: 'Enhance decision-making capabilities with AI-powered analysis and insights.',
    fullDescription: 'Augment your decision-making processes with AI-powered analytical tools. Learn to incorporate AI insights, conduct market analysis, assess risks, and make data-driven decisions with confidence.',
    duration: '6 hours',
    lessons: [
      {
        id: 'aew-3-1',
        title: 'Data-Driven Decision Frameworks',
        description: 'Implement frameworks for incorporating AI insights into decision processes.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aew-3-2',
        title: 'Market & Competitive Analysis',
        description: 'Use AI for comprehensive market research and competitive intelligence.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aew-3-3',
        title: 'Risk Assessment & Mitigation',
        description: 'Leverage AI for identifying and assessing potential risks in decisions.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aew-3-4',
        title: 'Scenario Planning & Forecasting',
        description: 'Use AI tools for scenario analysis and business forecasting.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aew-3-5',
        title: 'Performance Metrics & KPI Analysis',
        description: 'Implement AI for tracking and analyzing key performance indicators.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'aew-3-6',
        title: 'Ethical Decision-Making with AI',
        description: 'Navigate ethical considerations when using AI for business decisions.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🎯',
    category: 'Decision Making',
    order: 4,
    progress: 0,
    gradient: 'from-green-500 to-teal-500',
    skills: ['Decision Frameworks', 'Market Analysis', 'Risk Assessment', 'Scenario Planning', 'Ethical AI'],
    path: 'AI Enhanced Worker',
    level: 'Intermediate',
    prerequisites: ['aew-2'],
    learningObjectives: [
      'Implement data-driven decision frameworks',
      'Conduct comprehensive market analysis',
      'Assess and mitigate decision risks',
      'Navigate ethical AI decision-making'
    ],
    completionBadge: 'AI-Augmented Decision Maker',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'aew-4',
    title: 'Workplace Transformation Project',
    description: 'Design and implement AI-enhanced workflow for real workplace scenario.',
    fullDescription: 'Apply AI enhancement strategies to transform real workplace scenarios. Design, implement, and measure the impact of AI tools on team productivity and workflow efficiency.',
    duration: '7 hours',
    lessons: [
      {
        id: 'aew-4-1',
        title: 'Workplace Assessment & Opportunity Identification',
        description: 'Assess current workflows and identify AI enhancement opportunities.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'aew-4-2',
        title: 'AI Tool Selection & Implementation Plan',
        description: 'Select appropriate AI tools and create implementation roadmap.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'aew-4-3',
        title: 'Stakeholder Engagement & Change Management',
        description: 'Develop strategies for engaging stakeholders and managing change.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'aew-4-4',
        title: 'Workflow Redesign & Integration',
        description: 'Redesign workflows to incorporate AI tools effectively.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'aew-4-5',
        title: 'Training & Adoption Strategies',
        description: 'Develop training materials and strategies for team adoption.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'aew-4-6',
        title: 'Performance Measurement & ROI Analysis',
        description: 'Establish metrics to measure impact and calculate return on investment.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'aew-4-7',
        title: 'Scalability & Continuous Improvement',
        description: 'Plan for scaling successful implementations and ongoing optimization.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🏢',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-purple-500 to-pink-500',
    skills: ['Workflow Analysis', 'Change Management', 'ROI Analysis', 'Scalability Planning'],
    path: 'AI Enhanced Worker',
    level: 'Intermediate',
    prerequisites: ['aew-3'],
    learningObjectives: [
      'Assess and identify AI enhancement opportunities',
      'Manage stakeholder engagement and change',
      'Measure implementation ROI effectively',
      'Plan for scalability and continuous improvement'
    ],
    completionBadge: 'Workplace AI Transformer',
    estimatedEffort: '8-10 hours per week'
  },

  // Entrepreneur Path Modules
  {
    id: 'e-1',
    title: 'Startup Fundamentals & Market Discovery',
    description: 'Master the fundamentals of startup creation and effective market opportunity identification.',
    fullDescription: 'Build strong entrepreneurial foundations by mastering startup fundamentals and market discovery techniques. Learn opportunity recognition, customer discovery, and competitive landscape analysis.',
    duration: '5 hours',
    lessons: [
      {
        id: 'e-1-1',
        title: 'Entrepreneurial Mindset & Opportunity Recognition',
        description: 'Develop entrepreneurial thinking and learn to identify viable business opportunities.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'e-1-2',
        title: 'Market Research & Validation Techniques',
        description: 'Conduct comprehensive market research and validate business ideas effectively.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'e-1-3',
        title: 'Customer Discovery & Persona Development',
        description: 'Identify target customers and develop detailed customer personas.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'e-1-4',
        title: 'Problem-Solution Fit Analysis',
        description: 'Analyze and validate the fit between customer problems and proposed solutions.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'e-1-5',
        title: 'Competitive Landscape Analysis',
        description: 'Map competitive landscape and identify unique positioning opportunities.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🔍',
    category: 'Startup Fundamentals',
    order: 2,
    progress: 0,
    gradient: 'from-red-500 to-pink-500',
    skills: ['Opportunity Recognition', 'Market Research', 'Customer Discovery', 'Competitive Analysis'],
    path: 'Entrepreneur',
    level: 'Advanced',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Develop entrepreneurial mindset and opportunity recognition',
      'Conduct effective market research and validation',
      'Create detailed customer personas',
      'Analyze competitive landscapes strategically'
    ],
    completionBadge: 'Startup Foundations Expert',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'e-2',
    title: 'AI-Powered Business Models',
    description: 'Design innovative business models that leverage AI for competitive advantage.',
    fullDescription: 'Create disruptive business models that harness AI capabilities for sustainable competitive advantage. Explore platform models, subscription services, and scalable AI-driven revenue streams.',
    duration: '6 hours',
    lessons: [
      {
        id: 'e-2-1',
        title: 'AI Business Model Patterns',
        description: 'Explore proven business model patterns for AI-powered ventures.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'e-2-2',
        title: 'Value Proposition Design for AI Solutions',
        description: 'Design compelling value propositions for AI-powered products and services.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'e-2-3',
        title: 'Revenue Models & Pricing Strategies',
        description: 'Develop sustainable revenue models and effective pricing strategies.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'e-2-4',
        title: 'Platform Business Models with AI',
        description: 'Design and scale platform business models enhanced by AI capabilities.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'e-2-5',
        title: 'Subscription & SaaS Models',
        description: 'Master subscription-based and software-as-a-service business models.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'e-2-6',
        title: 'Scalability & Network Effects',
        description: 'Design for scalability and leverage network effects in AI businesses.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '💡',
    category: 'Business Models',
    order: 3,
    progress: 0,
    gradient: 'from-orange-500 to-yellow-500',
    skills: ['Business Model Design', 'Value Proposition', 'Revenue Models', 'Platform Strategy', 'Scalability'],
    path: 'Entrepreneur',
    level: 'Advanced',
    prerequisites: ['e-1'],
    learningObjectives: [
      'Design innovative AI-powered business models',
      'Create compelling value propositions',
      'Develop sustainable revenue models',
      'Leverage platform effects and scalability'
    ],
    completionBadge: 'AI Business Model Innovator',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'e-3',
    title: 'Finance, Strategy & Growth',
    description: 'Master financial planning, strategic decision-making, and growth strategies for AI ventures.',
    fullDescription: 'Develop comprehensive financial and strategic capabilities for scaling AI ventures. Master financial modeling, funding strategies, growth marketing, and international expansion planning.',
    duration: '6 hours',
    lessons: [
      {
        id: 'e-3-1',
        title: 'Financial Modeling & Projections',
        description: 'Create comprehensive financial models and realistic revenue projections.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'e-3-2',
        title: 'Funding Strategies & Investor Pitching',
        description: 'Develop funding strategies and master investor pitch presentations.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'e-3-3',
        title: 'Unit Economics & Profitability Analysis',
        description: 'Analyze unit economics and path to profitability for AI businesses.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'e-3-4',
        title: 'Growth Marketing & Customer Acquisition',
        description: 'Implement growth marketing strategies and optimize customer acquisition.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'e-3-5',
        title: 'Strategic Partnerships & Alliances',
        description: 'Develop strategic partnerships to accelerate growth and market reach.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'e-3-6',
        title: 'International Expansion & Scaling',
        description: 'Plan and execute international expansion strategies for AI businesses.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📈',
    category: 'Strategy & Finance',
    order: 4,
    progress: 0,
    gradient: 'from-green-500 to-emerald-500',
    skills: ['Financial Modeling', 'Funding Strategies', 'Growth Marketing', 'Strategic Partnerships', 'International Expansion'],
    path: 'Entrepreneur',
    level: 'Advanced',
    prerequisites: ['e-2'],
    learningObjectives: [
      'Create comprehensive financial models',
      'Develop effective funding strategies',
      'Implement growth marketing techniques',
      'Plan international expansion strategies'
    ],
    completionBadge: 'AI Venture Strategist',
    estimatedEffort: '7-9 hours per week'
  },

  {
    id: 'e-4',
    title: 'Startup Simulation Project',
    description: 'Develop complete business plan and pitch for an AI-powered startup idea.',
    fullDescription: 'Execute a comprehensive startup simulation from idea generation to investor pitch. Develop business plans, financial models, and go-to-market strategies for AI-powered ventures.',
    duration: '7 hours',
    lessons: [
      {
        id: 'e-4-1',
        title: 'Business Idea Generation & Refinement',
        description: 'Generate and refine AI-powered business ideas through systematic evaluation.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'e-4-2',
        title: 'Business Plan Development',
        description: 'Create comprehensive business plan covering all key business elements.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'e-4-3',
        title: 'Financial Model Creation',
        description: 'Build detailed financial model with revenue projections and cost analysis.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'e-4-4',
        title: 'Go-to-Market Strategy Development',
        description: 'Design comprehensive go-to-market strategy and launch plan.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'e-4-5',
        title: 'Investor Pitch Deck Creation',
        description: 'Create compelling investor pitch deck with clear narrative and financials.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'e-4-6',
        title: 'Pitch Practice & Delivery',
        description: 'Practice and refine pitch delivery with feedback and coaching.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'e-4-7',
        title: 'Business Model Validation & Iteration',
        description: 'Validate business model assumptions and iterate based on feedback.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🎯',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-blue-500 to-indigo-500',
    skills: ['Business Planning', 'Financial Modeling', 'Go-to-Market Strategy', 'Pitch Development', 'Validation'],
    path: 'Entrepreneur',
    level: 'Advanced',
    prerequisites: ['e-3'],
    learningObjectives: [
      'Develop comprehensive business plans',
      'Create detailed financial models',
      'Design effective go-to-market strategies',
      'Deliver compelling investor pitches'
    ],
    completionBadge: 'AI Startup Founder',
    estimatedEffort: '8-10 hours per week'
  },

  // Digital Transformation Leader Path Modules
  {
    id: 'dtl-1',
    title: 'Organizational Change & Data Culture',
    description: 'Lead cultural transformation and build data-driven organizations.',
    fullDescription: 'Master organizational change management and cultivate data-driven cultures. Develop strategies for stakeholder engagement, talent development, and measuring transformation success.',
    duration: '5 hours',
    lessons: [
      {
        id: 'dtl-1-1',
        title: 'Change Management Frameworks',
        description: 'Master proven change management frameworks for digital transformation.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'dtl-1-2',
        title: 'Building Data-Driven Culture',
        description: 'Develop strategies for fostering data literacy and evidence-based decision making.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'dtl-1-3',
        title: 'Stakeholder Engagement Strategies',
        description: 'Design comprehensive stakeholder engagement and communication plans.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'dtl-1-4',
        title: 'Talent Development & Upskilling',
        description: 'Create talent development strategies for digital and AI capabilities.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'dtl-1-5',
        title: 'Measuring Transformation Success',
        description: 'Establish KPIs and metrics to track transformation progress and impact.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🔄',
    category: 'Change Management',
    order: 2,
    progress: 0,
    gradient: 'from-gray-600 to-blue-600',
    skills: ['Change Management', 'Data Culture', 'Stakeholder Engagement', 'Talent Development', 'Metrics'],
    path: 'Digital Transformation Leader',
    level: 'Advanced',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Implement effective change management frameworks',
      'Build data-driven organizational cultures',
      'Engage stakeholders strategically',
      'Measure transformation success effectively'
    ],
    completionBadge: 'Change Management Leader',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'dtl-2',
    title: 'Emerging Tech & Systems Integration',
    description: 'Understand and integrate emerging technologies into organizational systems.',
    fullDescription: 'Navigate the complex landscape of emerging technologies and their integration into organizational systems. Master cloud transformation, legacy modernization, and security integration strategies.',
    duration: '6 hours',
    lessons: [
      {
        id: 'dtl-2-1',
        title: 'Technology Landscape Assessment',
        description: 'Assess emerging technologies and their potential organizational impact.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'dtl-2-2',
        title: 'Systems Thinking & Architecture',
        description: 'Apply systems thinking to technology integration and organizational design.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'dtl-2-3',
        title: 'Legacy System Modernization',
        description: 'Develop strategies for modernizing legacy systems and infrastructure.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'dtl-2-4',
        title: 'Cloud Transformation Strategies',
        description: 'Plan and execute cloud adoption and migration strategies.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'dtl-2-5',
        title: 'API Economy & Microservices',
        description: 'Understand API-driven architectures and microservices implementation.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'dtl-2-6',
        title: 'Security & Compliance Integration',
        description: 'Integrate security and compliance considerations into technology strategies.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🔗',
    category: 'Technology Integration',
    order: 3,
    progress: 0,
    gradient: 'from-purple-600 to-indigo-600',
    skills: ['Technology Assessment', 'Systems Thinking', 'Cloud Migration', 'API Architecture', 'Security Integration'],
    path: 'Digital Transformation Leader',
    level: 'Advanced',
    prerequisites: ['dtl-1'],
    learningObjectives: [
      'Assess emerging technology landscapes',
      'Apply systems thinking to integration challenges',
      'Execute cloud transformation strategies',
      'Integrate security and compliance requirements'
    ],
    completionBadge: 'Technology Integration Specialist',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'dtl-3',
    title: 'Leadership in the Age of AI',
    description: 'Develop leadership capabilities for guiding organizations through AI transformation.',
    fullDescription: 'Cultivate advanced leadership skills specifically tailored for AI-driven organizational transformation. Master strategic visioning, ethical governance, innovation culture, and crisis management in rapidly evolving technological landscapes.',
    duration: '6 hours',
    lessons: [
      {
        id: 'dtl-3-1',
        title: 'Strategic Vision & AI Roadmapping',
        description: 'Develop strategic vision and create comprehensive AI adoption roadmaps.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'dtl-3-2',
        title: 'Ethical Leadership & AI Governance',
        description: 'Establish ethical frameworks and governance structures for AI adoption.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'dtl-3-3',
        title: 'Innovation Culture & Experimentation',
        description: 'Foster innovation culture and create safe spaces for experimentation.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'dtl-3-4',
        title: 'Cross-Functional Team Leadership',
        description: 'Lead diverse, cross-functional teams through complex transformations.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'dtl-3-5',
        title: 'Decision-Making in Uncertainty',
        description: 'Make effective decisions in rapidly changing technological landscapes.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'dtl-3-6',
        title: 'Crisis Management & Resilience',
        description: 'Develop crisis management capabilities and organizational resilience.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '👑',
    category: 'Leadership',
    order: 4,
    progress: 0,
    gradient: 'from-red-600 to-orange-600',
    skills: ['Strategic Vision', 'Ethical Governance', 'Innovation Culture', 'Cross-functional Leadership', 'Crisis Management'],
    path: 'Digital Transformation Leader',
    level: 'Advanced',
    prerequisites: ['dtl-2'],
    learningObjectives: [
      'Develop comprehensive AI transformation roadmaps',
      'Establish ethical AI governance frameworks',
      'Foster innovation and experimentation cultures',
      'Lead effectively through uncertainty and crisis'
    ],
    completionBadge: 'AI Transformation Leader',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'dtl-4',
    title: 'Digital Transformation Roadmap Project',
    description: 'Develop comprehensive digital transformation strategy for real organization.',
    fullDescription: 'Create and present a complete digital transformation roadmap for a real or simulated organization. Integrate all aspects of transformation including technology, culture, talent, and measurement frameworks.',
    duration: '7 hours',
    lessons: [
      {
        id: 'dtl-4-1',
        title: 'Organizational Assessment & Analysis',
        description: 'Conduct comprehensive assessment of organizational readiness and capabilities.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'dtl-4-2',
        title: 'Vision & Strategy Development',
        description: 'Develop clear transformation vision and strategic objectives.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'dtl-4-3',
        title: 'Transformation Roadmap Creation',
        description: 'Create detailed transformation roadmap with timelines and milestones.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'dtl-4-4',
        title: 'Change Management Plan Development',
        description: 'Develop comprehensive change management and communication plans.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'dtl-4-5',
        title: 'Technology Implementation Strategy',
        description: 'Design technology implementation strategy with phased approach.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'dtl-4-6',
        title: 'Talent & Capability Development Plan',
        description: 'Create talent development and capability building strategies.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'dtl-4-7',
        title: 'Measurement & Success Framework',
        description: 'Establish measurement framework and success criteria for transformation.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🗺️',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-teal-600 to-cyan-600',
    skills: ['Organizational Assessment', 'Strategy Development', 'Roadmapping', 'Change Management', 'Measurement Frameworks'],
    path: 'Digital Transformation Leader',
    level: 'Advanced',
    prerequisites: ['dtl-3'],
    learningObjectives: [
      'Conduct comprehensive organizational assessments',
      'Develop clear transformation visions and strategies',
      'Create detailed implementation roadmaps',
      'Establish effective measurement frameworks'
    ],
    completionBadge: 'Digital Transformation Strategist',
    estimatedEffort: '8-10 hours per week'
  },

  // Communicator Path Modules
  {
    id: 'c-1',
    title: 'Storytelling with Data',
    description: 'Transform data into compelling narratives that drive action and understanding.',
    fullDescription: 'Master the art of transforming complex data into compelling, actionable narratives. Learn narrative structures, audience analysis, visual storytelling, and emotional connection techniques for data-driven communication.',
    duration: '5 hours',
    lessons: [
      {
        id: 'c-1-1',
        title: 'Data Narrative Structures',
        description: 'Learn fundamental narrative structures for effective data storytelling.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'c-1-2',
        title: 'Audience Analysis & Message Tailoring',
        description: 'Analyze audience needs and tailor data stories for different stakeholders.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'c-1-3',
        title: 'Visual Storytelling Techniques',
        description: 'Master visual techniques that enhance data narratives and engagement.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'c-1-4',
        title: 'Emotional Connection with Data',
        description: 'Create emotional connections through data-driven stories and examples.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'c-1-5',
        title: 'Call-to-Action Design',
        description: 'Design compelling calls-to-action that drive desired outcomes from data stories.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📖',
    category: 'Storytelling',
    order: 2,
    progress: 0,
    gradient: 'from-pink-500 to-rose-500',
    skills: ['Data Narrative', 'Audience Analysis', 'Visual Storytelling', 'Emotional Connection', 'Call-to-Action'],
    path: 'Communicator',
    level: 'Beginner',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Structure compelling data narratives',
      'Analyze and tailor messages for different audiences',
      'Create engaging visual storytelling elements',
      'Design effective calls-to-action'
    ],
    completionBadge: 'Data Storytelling Specialist',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'c-2',
    title: 'Visual & Written Communication',
    description: 'Master visual and written communication across digital platforms and media.',
    fullDescription: 'Develop comprehensive visual and written communication skills for the digital age. Master design principles, digital writing, presentation development, and cross-platform content adaptation.',
    duration: '6 hours',
    lessons: [
      {
        id: 'c-2-1',
        title: 'Visual Design Principles',
        description: 'Apply fundamental design principles to create effective visual communications.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'c-2-2',
        title: 'Digital Writing & Content Strategy',
        description: 'Master digital writing techniques and develop comprehensive content strategies.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'c-2-3',
        title: 'Presentation Design & Delivery',
        description: 'Create compelling presentations and master delivery techniques.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'c-2-4',
        title: 'Infographics & Data Visualization',
        description: 'Design effective infographics and data visualizations for communication.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'c-2-5',
        title: 'Cross-Platform Content Adaptation',
        description: 'Adapt content effectively across different digital platforms and formats.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'c-2-6',
        title: 'Brand Voice & Consistency',
        description: 'Develop consistent brand voice and maintain communication standards.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '✍️',
    category: 'Visual Communication',
    order: 3,
    progress: 0,
    gradient: 'from-purple-500 to-indigo-500',
    skills: ['Visual Design', 'Digital Writing', 'Presentation Skills', 'Infographics', 'Brand Management'],
    path: 'Communicator',
    level: 'Beginner',
    prerequisites: ['c-1'],
    learningObjectives: [
      'Apply visual design principles effectively',
      'Master digital writing and content strategy',
      'Create compelling presentations and infographics',
      'Maintain consistent brand voice across platforms'
    ],
    completionBadge: 'Visual Communication Expert',
    estimatedEffort: '6-7 hours per week'
  },

  {
    id: 'c-3',
    title: 'Public Speaking & Thought Leadership',
    description: 'Develop confidence and skill in public speaking and establishing thought leadership.',
    fullDescription: 'Build confidence and expertise in public speaking, media engagement, and thought leadership development. Master presentation techniques, audience engagement, and establishing authority in your field.',
    duration: '7 hours',
    lessons: [
      {
        id: 'c-3-1',
        title: 'Public Speaking Fundamentals',
        description: 'Master core public speaking techniques and overcome presentation anxiety.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'c-3-2',
        title: 'Audience Engagement Strategies',
        description: 'Develop strategies for engaging and connecting with diverse audiences.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'c-3-3',
        title: 'Thought Leadership Development',
        description: 'Establish yourself as a thought leader in your field or industry.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'c-3-4',
        title: 'Media Interview Techniques',
        description: 'Master techniques for effective media interviews and public appearances.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'c-3-5',
        title: 'Panel Discussions & Moderating',
        description: 'Excel in panel discussions and develop moderating skills.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'c-3-6',
        title: 'Virtual Presentation Mastery',
        description: 'Master virtual presentation techniques for remote and hybrid environments.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      },
      {
        id: 'c-3-7',
        title: 'Handling Q&A Sessions',
        description: 'Develop confidence and skill in handling audience questions effectively.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      }
    ],
    icon: '🎭',
    category: 'Public Speaking',
    order: 4,
    progress: 0,
    gradient: 'from-blue-600 to-cyan-600',
    skills: ['Public Speaking', 'Audience Engagement', 'Thought Leadership', 'Media Skills', 'Virtual Presentation'],
    path: 'Communicator',
    level: 'Intermediate',
    prerequisites: ['c-2'],
    learningObjectives: [
      'Master public speaking techniques and confidence',
      'Develop effective audience engagement strategies',
      'Establish thought leadership in your field',
      'Excel in media interviews and virtual presentations'
    ],
    completionBadge: 'Public Speaking Pro',
    estimatedEffort: '7-8 hours per week'
  },

  {
    id: 'c-4',
    title: 'AI-Assisted Communication Project',
    description: 'Apply AI tools to create comprehensive communication campaign or presentation.',
    fullDescription: 'Integrate AI tools into a comprehensive communication project. Develop strategies, create content, design presentations, and measure impact using AI-enhanced communication techniques.',
    duration: '7 hours',
    lessons: [
      {
        id: 'c-4-1',
        title: 'Communication Strategy Development',
        description: 'Develop comprehensive communication strategy for specific audience and goals.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'c-4-2',
        title: 'AI Content Creation & Enhancement',
        description: 'Use AI tools to create and enhance written and visual content.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'c-4-3',
        title: 'Multi-Platform Campaign Design',
        description: 'Design communication campaign that works across multiple platforms.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'c-4-4',
        title: 'Presentation Development with AI',
        description: 'Create compelling presentation using AI-assisted design and content tools.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'c-4-5',
        title: 'Delivery Practice & Refinement',
        description: 'Practice delivery and refine communication based on AI feedback tools.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'c-4-6',
        title: 'Audience Feedback Integration',
        description: 'Incorporate audience feedback and analytics to improve communication.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'c-4-7',
        title: 'Final Presentation & Impact Assessment',
        description: 'Deliver final presentation and assess communication impact.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🤖',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-green-600 to-emerald-600',
    skills: ['Communication Strategy', 'AI Content Creation', 'Multi-platform Campaigns', 'Presentation Development', 'Impact Assessment'],
    path: 'Communicator',
    level: 'Intermediate',
    prerequisites: ['c-3'],
    learningObjectives: [
      'Develop comprehensive communication strategies',
      'Create AI-enhanced content across multiple platforms',
      'Design and deliver compelling presentations',
      'Measure communication impact effectively'
    ],
    completionBadge: 'AI-Enhanced Communicator',
    estimatedEffort: '8-10 hours per week'
  },

  // Systems Thinker Path Modules
  {
    id: 'st-1',
    title: 'Systems & Complexity Theory',
    description: 'Master fundamental concepts of systems thinking and complexity science.',
    fullDescription: 'Build strong foundations in systems thinking and complexity theory. Understand system archetypes, emergent behavior, boundary definition, and leverage points for effective system intervention.',
    duration: '5 hours',
    lessons: [
      {
        id: 'st-1-1',
        title: 'Introduction to Systems Thinking',
        description: 'Learn core principles of systems thinking and its application to complex problems.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'st-1-2',
        title: 'Complexity Science Fundamentals',
        description: 'Understand complexity theory and emergent behavior in complex systems.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'st-1-3',
        title: 'System Archetypes & Patterns',
        description: 'Identify common system archetypes and their behavioral patterns.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'st-1-4',
        title: 'Boundary Definition & System Scope',
        description: 'Learn to define system boundaries and scope analysis effectively.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'st-1-5',
        title: 'Leverage Points & Intervention',
        description: 'Identify high-leverage points for effective system intervention.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '🧩',
    category: 'Systems Theory',
    order: 2,
    progress: 0,
    gradient: 'from-purple-500 to-indigo-500',
    skills: ['Systems Thinking', 'Complexity Theory', 'System Archetypes', 'Boundary Analysis', 'Leverage Points'],
    path: 'Systems Thinker',
    level: 'Advanced',
    prerequisites: ['common-1'],
    learningObjectives: [
      'Apply core systems thinking principles',
      'Understand complexity and emergent behavior',
      'Identify system archetypes and patterns',
      'Recognize high-leverage intervention points'
    ],
    completionBadge: 'Systems Thinking Foundations',
    estimatedEffort: '5-6 hours per week'
  },

  {
    id: 'st-2',
    title: 'Interdisciplinary Modeling & Feedback Loops',
    description: 'Apply systems modeling across disciplines and understand feedback dynamics.',
    fullDescription: 'Master interdisciplinary systems modeling techniques and feedback loop analysis. Learn causal loop diagrams, stock and flow modeling, and cross-disciplinary application of systems thinking.',
    duration: '6 hours',
    lessons: [
      {
        id: 'st-2-1',
        title: 'Causal Loop Diagrams',
        description: 'Create and interpret causal loop diagrams to map system dynamics.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'st-2-2',
        title: 'Stock and Flow Modeling',
        description: 'Master stock and flow modeling for dynamic system analysis.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'st-2-3',
        title: 'Feedback Loop Analysis',
        description: 'Analyze reinforcing and balancing feedback loops in systems.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'st-2-4',
        title: 'Cross-Disciplinary System Applications',
        description: 'Apply systems thinking across business, ecology, and social domains.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'st-2-5',
        title: 'System Dynamics Simulation',
        description: 'Introduction to system dynamics simulation and modeling tools.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'st-2-6',
        title: 'Delays & Nonlinear Effects',
        description: 'Understand time delays and nonlinear effects in complex systems.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      }
    ],
    icon: '📊',
    category: 'Modeling',
    order: 3,
    progress: 0,
    gradient: 'from-blue-500 to-teal-500',
    skills: ['Causal Loop Diagrams', 'Stock and Flow Modeling', 'Feedback Analysis', 'System Dynamics', 'Cross-disciplinary Application'],
    path: 'Systems Thinker',
    level: 'Advanced',
    prerequisites: ['st-1'],
    learningObjectives: [
      'Create and interpret causal loop diagrams',
      'Master stock and flow modeling techniques',
      'Analyze complex feedback loop dynamics',
      'Apply systems thinking across multiple disciplines'
    ],
    completionBadge: 'Systems Modeling Expert',
    estimatedEffort: '6-8 hours per week'
  },

  {
    id: 'st-3',
    title: 'AI as a Systemic Force',
    description: 'Analyze AI as transformative force within organizational and societal systems.',
    fullDescription: 'Examine artificial intelligence as a transformative systemic force. Analyze integration patterns, emergent behaviors, systemic risks, and resilience considerations in AI-enhanced systems.',
    duration: '7 hours',
    lessons: [
      {
        id: 'st-3-1',
        title: 'AI System Integration Patterns',
        description: 'Analyze how AI systems integrate with and transform existing systems.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 5,
        exercises: 3
      },
      {
        id: 'st-3-2',
        title: 'Emergent Behavior in AI Systems',
        description: 'Study emergent behaviors in complex AI systems and networks.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 6,
        exercises: 4
      },
      {
        id: 'st-3-3',
        title: 'Systemic Risk & AI Safety',
        description: 'Identify systemic risks and safety considerations in AI deployment.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'video',
        resources: 4,
        exercises: 3
      },
      {
        id: 'st-3-4',
        title: 'AI Ecosystem Mapping',
        description: 'Map AI ecosystems and identify key stakeholders and relationships.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'interactive',
        resources: 5,
        exercises: 4
      },
      {
        id: 'st-3-5',
        title: 'Feedback in AI-Enhanced Systems',
        description: 'Analyze feedback mechanisms in systems enhanced by AI capabilities.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'st-3-6',
        title: 'Adaptive Systems & Machine Learning',
        description: 'Study how machine learning creates adaptive, evolving systems.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'case-study',
        resources: 4,
        exercises: 3
      },
      {
        id: 'st-3-7',
        title: 'System Resilience & AI',
        description: 'Design systems for resilience in the age of AI transformation.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      }
    ],
    icon: '🤖',
    category: 'AI Systems',
    order: 4,
    progress: 0,
    gradient: 'from-orange-500 to-red-500',
    skills: ['AI Integration', 'Emergent Behavior', 'Systemic Risk', 'Ecosystem Mapping', 'System Resilience'],
    path: 'Systems Thinker',
    level: 'Advanced',
    prerequisites: ['st-2'],
    learningObjectives: [
      'Analyze AI system integration patterns',
      'Understand emergent behaviors in AI systems',
      'Identify and mitigate systemic AI risks',
      'Design resilient AI-enhanced systems'
    ],
    completionBadge: 'AI Systems Analyst',
    estimatedEffort: '7-9 hours per week'
  },

  {
    id: 'st-4',
    title: 'Strategic Systems Mapping Project',
    description: 'Apply systems thinking to analyze and design solutions for complex real-world challenges.',
    fullDescription: 'Execute a comprehensive systems analysis project addressing complex real-world challenges. Apply systems mapping, feedback analysis, and intervention design to create sustainable solutions.',
    duration: '7 hours',
    lessons: [
      {
        id: 'st-4-1',
        title: 'Problem Framing & System Selection',
        description: 'Frame complex problem and select appropriate system for analysis.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 3
      },
      {
        id: 'st-4-2',
        title: 'Stakeholder & Boundary Analysis',
        description: 'Identify key stakeholders and define system boundaries for analysis.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 4
      },
      {
        id: 'st-4-3',
        title: 'System Mapping & Relationship Modeling',
        description: 'Create comprehensive system maps showing relationships and dynamics.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 7,
        exercises: 5
      },
      {
        id: 'st-4-4',
        title: 'Feedback Loop Identification',
        description: 'Identify and analyze key feedback loops within the system.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      },
      {
        id: 'st-4-5',
        title: 'Leverage Point Analysis',
        description: 'Identify high-leverage intervention points for system change.',
        duration: '60 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 4,
        exercises: 3
      },
      {
        id: 'st-4-6',
        title: 'Intervention Strategy Development',
        description: 'Develop comprehensive intervention strategies based on system analysis.',
        duration: '90 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 6,
        exercises: 5
      },
      {
        id: 'st-4-7',
        title: 'Implementation Roadmap & Monitoring',
        description: 'Create implementation roadmap and monitoring framework for interventions.',
        duration: '75 min',
        isCompleted: false,
        isLocked: true,
        type: 'project',
        resources: 5,
        exercises: 4
      }
    ],
    icon: '🗺️',
    category: 'Applied Practice',
    order: 5,
    progress: 0,
    gradient: 'from-green-600 to-emerald-600',
    skills: ['Problem Framing', 'Stakeholder Analysis', 'System Mapping', 'Intervention Design', 'Implementation Planning'],
    path: 'Systems Thinker',
    level: 'Advanced',
    prerequisites: ['st-3'],
    learningObjectives: [
      'Frame complex problems systemically',
      'Conduct comprehensive stakeholder and boundary analysis',
      'Create detailed system maps and models',
      'Develop and implement effective intervention strategies'
    ],
    completionBadge: 'Strategic Systems Analyst',
    estimatedEffort: '8-10 hours per week'
  }
];

// =============================================================================
// ENHANCED REUSABLE COMPONENTS WITH CINEMATIC EFFECTS
// =============================================================================

interface SkillTagProps {
  skill: string
  className?: string
  variant?: 'primary' | 'secondary' | 'accent'
}

const SkillTag: React.FC<SkillTagProps> = ({ skill, className = '', variant = 'primary' }) => {
  const variants = {
    primary: 'bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 text-blue-700 shadow-sm hover:shadow-md',
    secondary: 'bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 text-gray-700 shadow-sm hover:shadow-md',
    accent: 'bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 text-orange-700 shadow-sm hover:shadow-md'
  }

  return (
    <motion.span
      className={`px-3 py-1.5 font-medium rounded-lg text-xs backdrop-blur-sm transition-all duration-300 ${variants[variant]} ${className}`}
      whileHover={{ 
        scale: 1.05, 
        y: -1,
        boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {skill}
    </motion.span>
  )
}

interface ExploreButtonProps {
  href: string
  className?: string
  variant?: 'primary' | 'secondary'
  children?: React.ReactNode
}

const ExploreButton: React.FC<ExploreButtonProps> = ({ 
  href, 
  className = '', 
  variant = 'primary',
  children = 'Explore Module'
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl',
    secondary: 'bg-gradient-to-r from-gray-600 to-blue-600 hover:from-gray-700 hover:to-blue-700 shadow-md hover:shadow-lg'
  }

  return (
    <motion.a
      href={href}
      className={`group inline-flex items-center px-8 py-4 text-white font-semibold rounded-2xl transition-all duration-300 backdrop-blur-sm ${variants[variant]} ${className}`}
      whileHover={{ 
        scale: 1.05, 
        y: -3,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <span className="relative z-10">{children}</span>
      <ArrowRight className="w-5 h-5 ml-3 transition-transform duration-300 group-hover:translate-x-1" />
      
      {/* Animated background shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12"
        initial={{ x: '-100%' }}
        whileHover={{ x: '200%' }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
    </motion.a>
  )
}

interface LessonItemProps {
  lesson: Lesson
  index: number
  moduleId: string
}

const LessonItem: React.FC<LessonItemProps> = ({ lesson, index, moduleId }) => {
  const [isHovered, setIsHovered] = useState(false)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-20px" })
  
  const getLessonTypeIcon = (type?: string) => {
    switch (type) {
      case 'video': return <Video className="w-4 h-4" />
      case 'reading': return <BookText className="w-4 h-4" />
      case 'exercise': return <Code className="w-4 h-4" />
      case 'quiz': return <BarChart3 className="w-4 h-4" />
      default: return <BookOpen className="w-4 h-4" />
    }
  }

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-600 bg-green-50 border-green-200 shadow-green-100'
      case 'Intermediate': return 'text-yellow-600 bg-yellow-50 border-yellow-200 shadow-yellow-100'
      case 'Advanced': return 'text-red-600 bg-red-50 border-red-200 shadow-red-100'
      default: return 'text-gray-600 bg-gray-50 border-gray-200 shadow-gray-100'
    }
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ 
        duration: 0.5, 
        delay: index * 0.1,
        type: "spring",
        stiffness: 100,
        damping: 15
      }}
      whileHover={{ 
        y: -4,
        scale: 1.02,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative flex items-center justify-between p-8 bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/80 hover:border-blue-300/80 hover:shadow-2xl transition-all duration-500 group cursor-pointer overflow-hidden"
    >
      {/* Animated background gradient on hover */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-blue-50/30 via-purple-50/20 to-cyan-50/30 opacity-0"
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />
      
      {/* Progress indicator line with glow effect */}
      <motion.div 
        className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 via-purple-500 to-cyan-500 shadow-lg shadow-blue-500/30"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.6, delay: index * 0.1 + 0.4, ease: "easeOut" }}
      />

      {/* Floating particles effect */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
              initial={{
                x: Math.random() * 300,
                y: Math.random() * 100,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.6,
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Left content */}
      <div className="relative z-10 flex items-center space-x-6">
        {/* Lesson number with animated border */}
        <motion.div 
          className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 border-2 border-blue-200/80 shadow-lg shadow-blue-200/50 group-hover:shadow-xl group-hover:shadow-blue-300/50 transition-all duration-500"
          whileHover={{ 
            rotate: 5,
            scale: 1.1,
            transition: { duration: 0.3 }
          }}
        >
          <motion.span 
            className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-purple-600 bg-clip-text text-transparent"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.1 + 0.2, type: "spring", stiffness: 200 }}
          >
            {index + 1}
          </motion.span>
          
          {/* Pulsing ring effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-blue-300/50"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        {/* Lesson details */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
              {lesson.title}
            </h3>
            
            {/* Difficulty badge */}
            {lesson.difficulty && (
              <motion.span 
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border backdrop-blur-sm shadow-sm ${getDifficultyColor(lesson.difficulty)}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: index * 0.1 + 0.3 }}
              >
                {lesson.difficulty}
              </motion.span>
            )}
          </div>
          
          <p className="text-gray-600 max-w-3xl leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
            {lesson.description}
          </p>
          
          {/* Meta information */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>{lesson.duration}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {getLessonTypeIcon(lesson.type)}
              <span className="capitalize">{lesson.type || 'Lesson'}</span>
            </div>
            
            {lesson.resources && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <BookOpen className="w-4 h-4" />
                <span>{lesson.resources} resources</span>
              </div>
            )}
            
            {lesson.exercises && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Code className="w-4 h-4" />
                <span>{lesson.exercises} exercises</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right content - Status and action */}
      <div className="relative z-10 flex items-center space-x-4">
        {/* Status indicator */}
        {lesson.isCompleted ? (
          <motion.div 
            className="flex items-center space-x-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-200 shadow-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.1 + 0.5 }}
          >
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Completed</span>
          </motion.div>
        ) : lesson.isLocked ? (
          <motion.div 
            className="flex items-center space-x-2 text-gray-500 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 shadow-sm"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: index * 0.1 + 0.5 }}
          >
            <Lock className="w-4 h-4" />
            <span className="font-semibold">Locked</span>
          </motion.div>
        ) : (
          <motion.button 
            className="group/btn flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 + 0.5 }}
          >
            <Play className="w-4 h-4 group-hover/btn:scale-110 transition-transform duration-300" />
            <span className="font-semibold">Start Lesson</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// =============================================================================
// MAIN COURSE MODULES COMPONENT
// =============================================================================

const CourseModules: React.FC = () => {
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string>('All')
  const [selectedLevel, setSelectedLevel] = useState<string>('All')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })
  
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  // Enhanced filtering logic
  const filteredModules = useMemo(() => {
    return COURSE_MODULES.filter(module => {
      const matchesSearch = module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          module.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          module.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesPath = selectedPath === 'All' || module.path === selectedPath
      const matchesLevel = selectedLevel === 'All' || module.level === selectedLevel
      const matchesCategory = selectedCategory === 'All' || module.category === selectedCategory
      
      return matchesSearch && matchesPath && matchesLevel && matchesCategory
    })
  }, [searchQuery, selectedPath, selectedLevel, selectedCategory])

  // Enhanced unique values for filters
  const uniquePaths = useMemo(() => {
    const paths = [...new Set(COURSE_MODULES.map(module => module.path))]
    return ['All', ...paths]
  }, [])

  const uniqueLevels = useMemo(() => {
    const levels = [...new Set(COURSE_MODULES.map(module => module.level))]
    return ['All', ...levels]
  }, [])

  const uniqueCategories = useMemo(() => {
    const categories = [...new Set(COURSE_MODULES.map(module => module.category))]
    return ['All', ...categories]
  }, [])

  const toggleModule = (moduleId: string) => {
    setExpandedModule(expandedModule === moduleId ? null : moduleId)
  }

  // Gradient presets for cards
  const cardGradients = [
    'from-blue-500 via-indigo-500 to-purple-600',
    'from-blue-600 via-indigo-600 to-purple-700',
    'from-indigo-500 via-blue-600 to-purple-600',
    'from-purple-500 via-indigo-600 to-blue-600',
    'from-blue-600 via-purple-600 to-indigo-700',
    'from-indigo-600 via-purple-600 to-blue-700'
  ]

  const getCardGradient = (index: number) => {
    return cardGradients[index % cardGradients.length]
  }

  // Enhanced cinematic scroll progress indicator
  const ScrollProgress: React.FC = () => (
    <motion.div 
      className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 origin-left z-50 shadow-2xl shadow-blue-500/30 backdrop-blur-sm"
      style={{ scaleX }}
    />
  )

  return (
    <>
      <Head>
        <title>Learning Path Modules | Cinematic Learning Experience</title>
        <meta name="description" content="Explore our comprehensive learning modules with cinematic animations and professional design" />
      </Head>

      <div className="min-h-screen bg-white relative overflow-hidden">
        {/* Enhanced animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-indigo-50/20 to-purple-50/10">
          {/* Floating gradient orbs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-200/40 to-indigo-300/30 rounded-full blur-3xl"
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-indigo-200/30 to-purple-300/20 rounded-full blur-3xl"
            animate={{
              x: [0, -80, 0],
              y: [0, 60, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black_30%,transparent_100%)]" />
        </div>

        <ScrollProgress />
        
        <Navbar />
        
        {/* Header Section */}
        <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative max-w-8xl mx-auto text-center">
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
                <span className="bg-gradient-to-r from-blue-300 via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                  All
                </span>
                <br />
                <span className="bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent">
                  Modules / Courses
                </span>
              </motion.h1>

              <motion.p
                className="text-xl md:text-2xl text-blue-100 mb-12 max-w-3xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              >
                Dive deep into individual modules and master specific skills with our comprehensive course catalog
              </motion.p>

              {/* Search and Filter Bar */}
              <motion.div
                className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl shadow-blue-500/20 max-w-6xl mx-auto"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search courses by title, description, or skills..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-white/5 border border-white/20 rounded-2xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-500 backdrop-blur-sm shadow-inner shadow-blue-500/10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <select
                      value={selectedPath}
                      onChange={(e) => setSelectedPath(e.target.value)}
                      className="px-5 py-4 bg-white/5 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-500 backdrop-blur-sm shadow-inner shadow-blue-500/10"
                    >
                      {uniquePaths.map((path) => (
                        <option key={path} value={path} className="text-gray-900">
                          {path === 'All' ? 'All Paths' : path}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="px-5 py-4 bg-white/5 border border-white/20 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all duration-500 backdrop-blur-sm shadow-inner shadow-blue-500/10"
                    >
                      {uniqueLevels.map((level) => (
                        <option key={level} value={level} className="text-gray-900">
                          {level === 'All' ? 'All Levels' : level}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Enhanced Modules Section - Three Column Layout */}
        <section ref={containerRef} className="relative py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-8xl mx-auto">
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {filteredModules.map((module, index) => (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 100,
                    damping: 15
                  }}
                  whileHover={{ 
                    y: -8,
                    scale: 1.02,
                    transition: { duration: 0.4, ease: "easeOut" }
                  }}
                  className="relative group"
                  onHoverStart={() => setHoveredCard(module.id)}
                  onHoverEnd={() => setHoveredCard(null)}
                >
                  {/* Enhanced Module Card with Blue/Indigo Gradient */}
                  <div className={`bg-gradient-to-br ${getCardGradient(index)} rounded-3xl shadow-2xl shadow-blue-500/20 overflow-hidden backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-500 hover:shadow-3xl hover:shadow-indigo-500/30 relative`}>
                    
                    {/* Animated background overlay on hover */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 opacity-0"
                      animate={{ opacity: hoveredCard === module.id ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                    />
                    
                    {/* Shine effect on hover */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%]"
                      animate={{ translateX: hoveredCard === module.id ? ['0%', '100%'] : '0%' }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />

                    {/* Module header with enhanced styling */}
                    <motion.div 
                      className="p-6 cursor-pointer relative z-10"
                      onClick={() => toggleModule(module.id)}
                      whileHover={{ scale: 1.01 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <div className="flex flex-col space-y-4">
                        {/* Top row with icon and basic info */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-4">
                            {/* Enhanced module icon with glow */}
                            <motion.div 
                              className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-2xl shadow-blue-500/30"
                              whileHover={{ 
                                rotate: 5,
                                scale: 1.1,
                                transition: { duration: 0.3 }
                              }}
                            >
                              <span className="text-2xl text-white">{module.icon}</span>
                              
                              {/* Pulsing glow effect */}
                              <motion.div
                                className="absolute inset-0 rounded-2xl bg-white/30"
                                animate={{ 
                                  scale: [1, 1.2, 1],
                                  opacity: [0.5, 0.8, 0.5],
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              />
                            </motion.div>

                            {/* Module title and badges */}
                            <div className="flex flex-col space-y-2">
                              <h2 className="text-xl font-bold text-white leading-tight line-clamp-2">
                                {module.title}
                              </h2>
                              
                              {/* Enhanced badges */}
                              <div className="flex items-center space-x-2">
                                {module.featured && (
                                  <motion.span 
                                    className="px-2.5 py-1 bg-yellow-500/20 text-yellow-200 text-xs font-bold rounded-full border border-yellow-400/30 shadow-lg shadow-yellow-500/20"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ duration: 0.4, delay: index * 0.1 + 0.2 }}
                                  >
                                    Featured
                                  </motion.span>
                                )}
                                {module.new && (
                                  <motion.span 
                                    className="px-2.5 py-1 bg-green-500/20 text-green-200 text-xs font-bold rounded-full border border-green-400/30 shadow-lg shadow-green-500/20"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ duration: 0.4, delay: index * 0.1 + 0.3 }}
                                  >
                                    New
                                  </motion.span>
                                )}
                                <motion.span 
                                  className="px-2.5 py-1 bg-white/20 text-white text-xs font-semibold rounded-full backdrop-blur-sm border border-white/30 shadow-lg shadow-white/20"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ duration: 0.4, delay: index * 0.1 + 0.4 }}
                                >
                                  {module.level}
                                </motion.span>
                              </div>
                            </div>
                          </div>

                          {/* Expand button */}
                          <motion.button
                            className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-xl border border-white/30 text-white transition-all duration-300 backdrop-blur-sm shadow-lg shadow-blue-500/30 hover:shadow-white/20"
                            whileHover={{ scale: 1.1, rotate: 180 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform duration-500 ${
                              expandedModule === module.id ? 'rotate-180' : ''
                            }`} />
                          </motion.button>
                        </div>

                        {/* Description */}
                        <p className="text-blue-100 text-sm leading-relaxed line-clamp-2">
                          {module.description}
                        </p>
                        
                        {/* Enhanced meta information */}
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center space-x-2 text-blue-200">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium text-xs">{module.duration}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2 text-blue-200">
                            <BookOpen className="w-4 h-4" />
                            <span className="font-medium text-xs">{module.lessons.length} lessons</span>
                          </div>
                          
                          {module.rating && (
                            <div className="flex items-center space-x-2 text-blue-200">
                              <Star className="w-4 h-4 fill-yellow-300 text-yellow-300" />
                              <span className="font-medium text-xs">{module.rating}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Enhanced skills tags */}
                        <div className="flex flex-wrap gap-2">
                          {module.skills.slice(0, 2).map((skill, skillIndex) => (
                            <span 
                              key={skill} 
                              className="px-2 py-1 text-blue-200 text-xs font-medium bg-white/10 rounded-lg backdrop-blur-sm border border-white/20 shadow-inner shadow-blue-500/20"
                            >
                              {skill}
                            </span>
                          ))}
                          {module.skills.length > 2 && (
                            <span className="px-2 py-1 text-blue-300 text-xs font-medium bg-white/5 rounded-lg backdrop-blur-sm border border-white/10">
                              +{module.skills.length - 2} more
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-white/20">
                          <motion.button
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl border border-white/30 transition-all duration-300 backdrop-blur-sm shadow-lg shadow-blue-500/30 hover:shadow-white/20 font-medium text-xs"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Explore
                          </motion.button>
                          
                          <div className="flex items-center space-x-2 text-blue-200">
                            <motion.button 
                              className="p-1.5 hover:bg-white/20 rounded-lg transition-all duration-300 hover:text-white"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button 
                              className="p-1.5 hover:bg-white/20 rounded-lg transition-all duration-300 hover:text-white"
                              whileHover={{ scale: 1.1 }}
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Enhanced expanded content */}
                    <AnimatePresence>
                      {expandedModule === module.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 bg-white/10 backdrop-blur-xl border-t border-white/20">
                            {/* Enhanced module details */}
                            <div className="space-y-4">
                              <div>
                                <h3 className="text-lg font-bold text-white mb-3">Overview</h3>
                                <p className="text-blue-100 text-sm leading-relaxed">
                                  {module.fullDescription}
                                </p>
                              </div>
                              
                              {/* Learning objectives */}
                              {module.learningObjectives && (
                                <div>
                                  <h4 className="text-md font-semibold text-white mb-2">What You'll Learn</h4>
                                  <ul className="space-y-1">
                                    {module.learningObjectives.slice(0, 3).map((objective, idx) => (
                                      <motion.li 
                                        key={idx}
                                        className="flex items-center space-x-2 text-blue-100 text-sm"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.4, delay: idx * 0.1 }}
                                      >
                                        <CheckCircle className="w-3.5 h-3.5 text-green-300 flex-shrink-0" />
                                        <span>{objective}</span>
                                      </motion.li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Enhanced lessons preview */}
                              <div className="space-y-2">
                                <h4 className="text-md font-semibold text-white mb-2">Lessons Preview</h4>
                                <div className="space-y-1.5">
                                  {module.lessons.slice(0, 3).map((lesson, lessonIndex) => (
                                    <div 
                                      key={lesson.id}
                                      className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all duration-300"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <div className="w-6 h-6 flex items-center justify-center bg-white/10 rounded border border-white/20 text-blue-200 text-xs font-medium">
                                          {lessonIndex + 1}
                                        </div>
                                        <span className="text-blue-100 text-xs font-medium truncate max-w-[120px]">{lesson.title}</span>
                                      </div>
                                      <div className="text-blue-200 text-xs">
                                        {lesson.duration}
                                      </div>
                                    </div>
                                  ))}
                                  {module.lessons.length > 3 && (
                                    <div className="text-center pt-1">
                                      <span className="text-blue-300 text-xs font-medium">
                                        +{module.lessons.length - 3} more lessons
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Enhanced action buttons */}
                              <div className="flex space-x-5 pt-2">
                                <Link href={`/modules/${module.id}`} passHref>
                                  <motion.button 
                                    className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl border border-white/30 transition-all duration-300 backdrop-blur-sm shadow-lg shadow-blue-500/30 hover:shadow-white/20 font-medium text-xs text-center"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent triggering the card expand
                                    }}
                                  >
                                    Start Learning
                                  </motion.button>
                                </Link>
                               </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Enhanced empty state */}
            {filteredModules.length === 0 && (
              <motion.div 
                className="text-center py-24 col-span-3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <motion.div
                  className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-full flex items-center justify-center border border-blue-200 shadow-2xl shadow-blue-500/20"
                  animate={{ 
                    rotate: [0, 5, -5, 0],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Search className="w-16 h-16 text-blue-400" />
                </motion.div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">No courses found</h3>
                <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
                  Try adjusting your search criteria or filters to find what you're looking for.
                </p>
                <motion.button
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedPath('All')
                    setSelectedLevel('All')
                    setSelectedCategory('All')
                  }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-4 rounded-2xl font-semibold shadow-2xl shadow-blue-500/30 hover:shadow-3xl hover:shadow-indigo-500/40 transition-all duration-500 border border-blue-500/20 hover:border-blue-400/30"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Reset Filters
                </motion.button>
              </motion.div>
            )}
          </div>
        </section>

        <Footer />
      </div>
    </>
  )
}

export default CourseModules