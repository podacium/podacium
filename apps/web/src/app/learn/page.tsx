'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { motion, AnimatePresence, cubicBezier } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Variants } from 'framer-motion';
import { Quote, Building, CheckCircle, Trophy, Users, Target, Star, TrendingUp } from 'lucide-react'

// =============================================================================
// MOCK DATA
// =============================================================================

interface Testimonial {
  id: string
  name: string
  content: string
  rating: number
  course: string
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  icon: string;
  rating: number;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  students: number;
  lessons: number;
  instructor: string;
  category: string;
  tags: string[];
  price: {
    original: number;
    discounted: number | null;
  };
  features: string[];
  progress?: number;
  isPopular?: boolean;
  isNew?: boolean;
  path: string[];
}

export const LEARNING_MODULES: LearningModule[] = [
  // Common Foundation Module (Used by all paths)
  {
    id: 'common-1',
    title: 'Common Foundations',
    description: 'Essential skills and knowledge required across all career paths in the digital age.',
    thumbnail: '/thumbnails/common-foundations.jpg',
    icon: '🌐',
    rating: 4.8,
    duration: '4 hours',
    level: 'Beginner',
    students: 1250,
    lessons: 4,
    instructor: 'Digital Skills Academy',
    category: 'Foundation',
    tags: ['digital-literacy', 'critical-thinking', 'analytics', 'communication'],
    price: {
      original: 99,
      discounted: 0
    },
    features: ['Digital Literacy', 'Critical Thinking', 'Basic Analytics', 'Communication Skills'],
    isPopular: true,
    path: ['All Paths']
  },

  // Data & AI Category
  {
    id: 'de-1',
    title: 'Data Literacy & Ethics',
    description: 'Understand data fundamentals, privacy concerns, and ethical considerations in data handling.',
    thumbnail: '/thumbnails/data-literacy-ethics.jpg',
    icon: '📚',
    rating: 4.6,
    duration: '5 hours',
    level: 'Beginner',
    students: 890,
    lessons: 5,
    instructor: 'Dr. Sarah Chen',
    category: 'Data & AI',
    tags: ['data-ethics', 'privacy', 'governance', 'compliance'],
    price: {
      original: 129,
      discounted: 99
    },
    features: ['Data Ethics', 'Privacy Laws', 'Data Governance', 'Case Studies'],
    path: ['Data Explorer']
  },
  {
    id: 'de-2',
    title: 'Spreadsheets & SQL Basics',
    description: 'Master essential data manipulation skills using spreadsheets and basic SQL queries.',
    thumbnail: '/thumbnails/spreadsheets-sql.jpg',
    icon: '📊',
    rating: 4.7,
    duration: '6 hours',
    level: 'Beginner',
    students: 1120,
    lessons: 6,
    instructor: 'Mike Rodriguez',
    category: 'Data & AI',
    tags: ['excel', 'sql', 'data-analysis', 'spreadsheets'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['Excel/Sheets', 'Basic SQL', 'Data Filtering', 'Simple Aggregations'],
    path: ['Data Explorer']
  },
  {
    id: 'de-3',
    title: 'Data Visualization & Storytelling',
    description: 'Learn to create compelling visualizations and tell stories with data.',
    thumbnail: '/thumbnails/data-visualization.jpg',
    icon: '📈',
    rating: 4.9,
    duration: '7 hours',
    level: 'Intermediate',
    students: 760,
    lessons: 7,
    instructor: 'Emma Wilson',
    category: 'Data & AI',
    tags: ['data-viz', 'storytelling', 'charts', 'dashboard'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Chart Types', 'Color Theory', 'Narrative Structure', 'Audience Engagement'],
    isNew: true,
    path: ['Data Explorer']
  },
  {
    id: 'de-4',
    title: 'Applied Data Exploration Project',
    description: 'Hands-on project exploring real datasets to uncover insights and patterns.',
    thumbnail: '/thumbnails/data-exploration-project.jpg',
    icon: '🔍',
    rating: 4.7,
    duration: '7 hours',
    level: 'Intermediate',
    students: 540,
    lessons: 7,
    instructor: 'David Park',
    category: 'Applied Practice',
    tags: ['hands-on', 'real-data', 'exploratory-analysis', 'project'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['Real Datasets', 'Exploratory Analysis', 'Insight Generation', 'Presentation'],
    path: ['Data Explorer']
  },
  {
    id: 'bi-1',
    title: 'Data Cleaning & Preparation',
    description: 'Master techniques for cleaning, transforming, and preparing data for analysis.',
    thumbnail: '/thumbnails/data-cleaning.jpg',
    icon: '🧹',
    rating: 4.5,
    duration: '6 hours',
    level: 'Intermediate',
    students: 940,
    lessons: 6,
    instructor: 'Alex Thompson',
    category: 'Data & AI',
    tags: ['data-cleaning', 'etl', 'data-quality', 'automation'],
    price: {
      original: 159,
      discounted: 129
    },
    features: ['Data Cleaning', 'Transformation', 'Quality Checks', 'Automation'],
    path: ['Business Intelligence Analyst']
  },
  {
    id: 'bi-2',
    title: 'Business Metrics & KPIs',
    description: 'Learn to define, track, and analyze key business performance indicators.',
    thumbnail: '/thumbnails/business-metrics.jpg',
    icon: '🎯',
    rating: 4.6,
    duration: '6 hours',
    level: 'Intermediate',
    students: 870,
    lessons: 6,
    instructor: 'Lisa Wang',
    category: 'Business & Strategy',
    tags: ['kpi', 'metrics', 'performance', 'analytics'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['KPI Framework', 'Performance Tracking', 'Goal Setting', 'Industry Standards'],
    path: ['Business Intelligence Analyst']
  },
  {
    id: 'bi-3',
    title: 'Dashboard Design Principles',
    description: 'Design effective and user-friendly dashboards that drive business decisions.',
    thumbnail: '/thumbnails/dashboard-design.jpg',
    icon: '📱',
    rating: 4.8,
    duration: '6 hours',
    level: 'Intermediate',
    students: 690,
    lessons: 6,
    instructor: 'Carlos Mendez',
    category: 'Technology',
    tags: ['dashboard', 'ui-ux', 'design', 'visualization'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['UI/UX Principles', 'Information Hierarchy', 'User Testing', 'Iterative Design'],
    path: ['Business Intelligence Analyst']
  },
  {
    id: 'bi-4',
    title: 'Advanced BI Tools (Power BI, Tableau)',
    description: 'Master industry-leading BI tools for advanced analytics and visualization.',
    thumbnail: '/thumbnails/bi-tools.jpg',
    icon: '🛠️',
    rating: 4.8,
    duration: '6 hours',
    level: 'Advanced',
    students: 680,
    lessons: 6,
    instructor: 'Jessica Lee',
    category: 'Data & AI',
    tags: ['power-bi', 'tableau', 'bi', 'dashboard'],
    price: {
      original: 199,
      discounted: 159
    },
    features: ['Power BI', 'Tableau', 'Advanced Calculations', 'Custom Visuals'],
    isPopular: true,
    path: ['Business Intelligence Analyst']
  },
  {
    id: 'bi-5',
    title: 'Real-World BI Case Study',
    description: 'Complete BI project from data sourcing to dashboard deployment.',
    thumbnail: '/thumbnails/bi-case-study.jpg',
    icon: '🏢',
    rating: 4.9,
    duration: '6 hours',
    level: 'Advanced',
    students: 520,
    lessons: 6,
    instructor: 'Rachel Green',
    category: 'Applied Practice',
    tags: ['case-study', 'real-world', 'deployment', 'stakeholder'],
    price: {
      original: 189,
      discounted: 159
    },
    features: ['End-to-End Project', 'Stakeholder Management', 'Deployment', 'Documentation'],
    path: ['Business Intelligence Analyst']
  },
  {
    id: 'ai-think-1',
    title: 'Philosophy & Logic of AI',
    description: 'Explore the philosophical foundations and logical frameworks behind artificial intelligence.',
    thumbnail: '/thumbnails/ai-philosophy.jpg',
    icon: '🧠',
    rating: 4.4,
    duration: '5 hours',
    level: 'Beginner',
    students: 520,
    lessons: 5,
    instructor: 'Dr. Robert Kim',
    category: 'Data & AI',
    tags: ['ai-philosophy', 'logic', 'ethics', 'cognitive-science'],
    price: {
      original: 139,
      discounted: 109
    },
    features: ['AI History', 'Logical Reasoning', 'Cognitive Science', 'Ethical Foundations'],
    path: ['AI Thinker']
  },
  {
    id: 'ai-think-2',
    title: 'Cognitive Systems & Human-Machine Thinking',
    description: 'Understand how human cognition intersects with machine intelligence systems.',
    thumbnail: '/thumbnails/cognitive-systems.jpg',
    icon: '🤔',
    rating: 4.6,
    duration: '6 hours',
    level: 'Intermediate',
    students: 430,
    lessons: 6,
    instructor: 'Dr. Maria Gonzalez',
    category: 'Data & AI',
    tags: ['cognitive-systems', 'human-ai', 'decision-making', 'pattern-recognition'],
    price: {
      original: 159,
      discounted: 129
    },
    features: ['Cognitive Models', 'Human-AI Collaboration', 'Decision Making', 'Pattern Recognition'],
    path: ['AI Thinker']
  },
  {
    id: 'ai-think-3',
    title: 'Ethical AI & Societal Implications',
    description: 'Examine the ethical considerations and societal impacts of AI technologies.',
    thumbnail: '/thumbnails/ethical-ai.jpg',
    icon: '⚖️',
    rating: 4.7,
    duration: '6 hours',
    level: 'Intermediate',
    students: 380,
    lessons: 6,
    instructor: 'Dr. James Peterson',
    category: 'Data & AI',
    tags: ['ai-ethics', 'societal-impact', 'bias', 'fairness'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['Bias & Fairness', 'Privacy', 'Accountability', 'Future Scenarios'],
    isNew: true,
    path: ['AI Thinker']
  },
  {
    id: 'ai-think-4',
    title: 'Reflective AI Project',
    description: 'Critical analysis project examining AI systems and their societal context.',
    thumbnail: '/thumbnails/reflective-ai.jpg',
    icon: '📝',
    rating: 4.5,
    duration: '8 hours',
    level: 'Advanced',
    students: 290,
    lessons: 8,
    instructor: 'Dr. Sarah Johnson',
    category: 'Applied Practice',
    tags: ['critical-analysis', 'policy', 'future-forecasting', 'research'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['Case Analysis', 'Critical Thinking', 'Policy Recommendations', 'Future Forecasting'],
    path: ['AI Thinker']
  },
  {
    id: 'ml-1',
    title: 'Python for Machine Learning',
    description: 'Build Python programming skills specifically for machine learning applications.',
    thumbnail: '/thumbnails/python-ml.jpg',
    icon: '🐍',
    rating: 4.7,
    duration: '5 hours',
    level: 'Beginner',
    students: 980,
    lessons: 5,
    instructor: 'Daniel Kim',
    category: 'Data & AI',
    tags: ['python', 'programming', 'numpy', 'pandas'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['Python Basics', 'NumPy/Pandas', 'Data Structures', 'ML Libraries'],
    path: ['Machine Builder']
  },
  {
    id: 'ml-2',
    title: 'Core ML Algorithms & Models',
    description: 'Learn fundamental machine learning algorithms and their practical applications.',
    thumbnail: '/thumbnails/ml-algorithms.jpg',
    icon: '📊',
    rating: 4.8,
    duration: '6 hours',
    level: 'Intermediate',
    students: 720,
    lessons: 6,
    instructor: 'Dr. Amanda Chen',
    category: 'Data & AI',
    tags: ['ml-algorithms', 'supervised-learning', 'unsupervised-learning', 'models'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Supervised Learning', 'Unsupervised Learning', 'Model Evaluation', 'Hyperparameter Tuning'],
    isPopular: true,
    path: ['Machine Builder']
  },
  {
    id: 'ml-3',
    title: 'Neural Networks & Deep Learning',
    description: 'Dive into neural networks, deep learning architectures, and their implementations.',
    thumbnail: '/thumbnails/neural-networks.jpg',
    icon: '🕸️',
    rating: 4.9,
    duration: '7 hours',
    level: 'Advanced',
    students: 510,
    lessons: 7,
    instructor: 'Dr. Michael Zhang',
    category: 'Data & AI',
    tags: ['neural-networks', 'deep-learning', 'tensorflow', 'pytorch'],
    price: {
      original: 199,
      discounted: 169
    },
    features: ['Neural Networks', 'TensorFlow/PyTorch', 'CNN/RNN', 'Transfer Learning'],
    path: ['Machine Builder']
  },
  {
    id: 'ml-4',
    title: 'Mini ML Project',
    description: 'End-to-end machine learning project from data collection to model deployment.',
    thumbnail: '/thumbnails/ml-project.jpg',
    icon: '🚀',
    rating: 4.7,
    duration: '6 hours',
    level: 'Intermediate',
    students: 450,
    lessons: 6,
    instructor: 'Sophia Rodriguez',
    category: 'Applied Practice',
    tags: ['end-to-end', 'deployment', 'pipeline', 'real-project'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['End-to-End Pipeline', 'Model Training', 'Evaluation Metrics', 'Deployment Basics'],
    path: ['Machine Builder']
  },
  {
    id: 'ai-innovate-1',
    title: 'AI Systems & Product Thinking',
    description: 'Learn to design AI-powered products and systems with user-centric approaches.',
    thumbnail: '/thumbnails/ai-systems.jpg',
    icon: '💡',
    rating: 4.6,
    duration: '5 hours',
    level: 'Intermediate',
    students: 560,
    lessons: 5,
    instructor: 'Kevin Patel',
    category: 'Data & AI',
    tags: ['product-thinking', 'user-centric', 'ai-systems', 'design'],
    price: {
      original: 159,
      discounted: 129
    },
    features: ['Product Design', 'User Research', 'AI Integration', 'Prototyping'],
    path: ['Applied AI Innovator']
  },
  {
    id: 'ai-innovate-2',
    title: 'From Prototype to Deployment',
    description: 'Master the process of taking AI prototypes to production-ready deployments.',
    thumbnail: '/thumbnails/prototype-deployment.jpg',
    icon: '🔄',
    rating: 4.8,
    duration: '6 hours',
    level: 'Advanced',
    students: 420,
    lessons: 6,
    instructor: 'Brian Wilson',
    category: 'Technology',
    tags: ['mlops', 'deployment', 'scalability', 'ci-cd'],
    price: {
      original: 189,
      discounted: 159
    },
    features: ['MLOps Basics', 'Scalability', 'Monitoring', 'CI/CD'],
    path: ['Applied AI Innovator']
  },
  {
    id: 'ai-innovate-3',
    title: 'AI in Industry & Society',
    description: 'Explore real-world AI applications across different industries and societal contexts.',
    thumbnail: '/thumbnails/ai-industry.jpg',
    icon: '🏭',
    rating: 4.5,
    duration: '7 hours',
    level: 'Intermediate',
    students: 380,
    lessons: 7,
    instructor: 'Dr. Lisa Thompson',
    category: 'Data & AI',
    tags: ['industry-applications', 'real-world', 'impact-analysis', 'case-studies'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Industry Cases', 'Impact Analysis', 'Implementation Challenges', 'Success Metrics'],
    path: ['Applied AI Innovator']
  },
  {
    id: 'ai-innovate-4',
    title: 'Innovation Capstone Project',
    description: 'Design and prototype an innovative AI solution for a real-world problem.',
    thumbnail: '/thumbnails/innovation-capstone.jpg',
    icon: '🎓',
    rating: 4.7,
    duration: '6 hours',
    level: 'Advanced',
    students: 320,
    lessons: 6,
    instructor: 'Nina Garcia',
    category: 'Applied Practice',
    tags: ['capstone', 'innovation', 'prototype', 'pitch'],
    price: {
      original: 199,
      discounted: 169
    },
    features: ['Ideation', 'Technical Design', 'Prototype Development', 'Pitch Presentation'],
    path: ['Applied AI Innovator']
  },
  {
    id: 'builder-1',
    title: 'Web & App Development Fundamentals',
    description: 'Learn core web and mobile development technologies and frameworks.',
    thumbnail: '/thumbnails/web-dev-fundamentals.jpg',
    icon: '🌐',
    rating: 4.6,
    duration: '5 hours',
    level: 'Beginner',
    students: 1100,
    lessons: 5,
    instructor: 'Tom Anderson',
    category: 'Technology',
    tags: ['web-development', 'html-css', 'javascript', 'react'],
    price: {
      original: 139,
      discounted: 109
    },
    features: ['HTML/CSS/JS', 'React Basics', 'Mobile Principles', 'UI Development'],
    path: ['Builder / Tech & Product Development']
  },
  {
    id: 'builder-2',
    title: 'Databases, APIs & Backend Integration',
    description: 'Master database design, API development, and backend system integration.',
    thumbnail: '/thumbnails/databases-apis.jpg',
    icon: '🗄️',
    rating: 4.7,
    duration: '6 hours',
    level: 'Intermediate',
    students: 780,
    lessons: 6,
    instructor: 'Sarah Martinez',
    category: 'Technology',
    tags: ['databases', 'apis', 'backend', 'integration'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Database Design', 'REST APIs', 'Authentication', 'System Architecture'],
    path: ['Builder / Tech & Product Development']
  },
  {
    id: 'builder-3',
    title: 'AI-Integrated Product Development',
    description: 'Build products that seamlessly integrate AI capabilities and features.',
    thumbnail: '/thumbnails/ai-integrated.jpg',
    icon: '🤖',
    rating: 4.8,
    duration: '7 hours',
    level: 'Advanced',
    students: 450,
    lessons: 7,
    instructor: 'Alex Rivera',
    category: 'Data & AI',
    tags: ['ai-integration', 'product-dev', 'apis', 'optimization'],
    price: {
      original: 189,
      discounted: 159
    },
    features: ['AI APIs', 'Custom Models', 'User Experience', 'Performance Optimization'],
    isNew: true,
    path: ['Builder / Tech & Product Development']
  },
  {
    id: 'builder-4',
    title: 'Full Project Capstone',
    description: 'Complete full-stack project incorporating AI features and modern development practices.',
    thumbnail: '/thumbnails/full-project-capstone.jpg',
    icon: '🏗️',
    rating: 4.9,
    duration: '7 hours',
    level: 'Advanced',
    students: 380,
    lessons: 7,
    instructor: 'David Kim',
    category: 'Applied Practice',
    tags: ['full-stack', 'capstone', 'ai-features', 'deployment'],
    price: {
      original: 199,
      discounted: 169
    },
    features: ['Full-Stack Development', 'AI Integration', 'Testing', 'Deployment'],
    path: ['Builder / Tech & Product Development']
  },
  {
    id: 'systems-1',
    title: 'Systems & Complexity Theory',
    description: 'Understand complex systems theory and its application to modern challenges.',
    thumbnail: '/thumbnails/systems-theory.jpg',
    icon: '🔄',
    rating: 4.5,
    duration: '5 hours',
    level: 'Intermediate',
    students: 420,
    lessons: 5,
    instructor: 'Dr. Emily Chen',
    category: 'Technology',
    tags: ['systems-thinking', 'complexity', 'emergent-behavior', 'feedback'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['Systems Thinking', 'Complexity Science', 'Emergent Behavior', 'Feedback Loops'],
    path: ['Systems Thinker']
  },
  {
    id: 'systems-2',
    title: 'Interdisciplinary Modeling & Feedback Loops',
    description: 'Learn to model complex systems across disciplines and understand feedback mechanisms.',
    thumbnail: '/thumbnails/interdisciplinary-modeling.jpg',
    icon: '📐',
    rating: 4.6,
    duration: '6 hours',
    level: 'Advanced',
    students: 350,
    lessons: 6,
    instructor: 'Dr. Mark Williams',
    category: 'Technology',
    tags: ['modeling', 'interdisciplinary', 'feedback-loops', 'simulation'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Cross-disciplinary Models', 'Dynamic Systems', 'Simulation Techniques', 'Scenario Analysis'],
    path: ['Systems Thinker']
  },
  {
    id: 'systems-3',
    title: 'AI as a Systemic Force',
    description: 'Explore how AI systems interact with and transform larger societal systems.',
    thumbnail: '/thumbnails/ai-systemic-force.jpg',
    icon: '🌍',
    rating: 4.7,
    duration: '7 hours',
    level: 'Advanced',
    students: 290,
    lessons: 7,
    instructor: 'Dr. Rachel Liu',
    category: 'Data & AI',
    tags: ['societal-impact', 'ecosystem', 'policy', 'transformation'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['Societal Impact', 'Ecosystem Analysis', 'Long-term Effects', 'Policy Implications'],
    path: ['Systems Thinker']
  },
  {
    id: 'systems-4',
    title: 'Strategic Systems Mapping Project',
    description: 'Create comprehensive system maps for complex real-world challenges.',
    thumbnail: '/thumbnails/systems-mapping.jpg',
    icon: '🗺️',
    rating: 4.8,
    duration: '7 hours',
    level: 'Advanced',
    students: 260,
    lessons: 7,
    instructor: 'Dr. James Wilson',
    category: 'Applied Practice',
    tags: ['system-mapping', 'strategic', 'stakeholder-analysis', 'impact-forecasting'],
    price: {
      original: 189,
      discounted: 159
    },
    features: ['System Mapping', 'Stakeholder Analysis', 'Intervention Design', 'Impact Forecasting'],
    path: ['Systems Thinker']
  },
  {
    id: 'worker-1',
    title: 'Productivity Tools & AI Automation',
    description: 'Master AI-powered tools to automate routine tasks and boost productivity.',
    thumbnail: '/thumbnails/productivity-tools.jpg',
    icon: '🚀',
    rating: 4.7,
    duration: '5 hours',
    level: 'Beginner',
    students: 950,
    lessons: 5,
    instructor: 'Michelle Lee',
    category: 'Collaboration',
    tags: ['productivity', 'automation', 'ai-tools', 'efficiency'],
    price: {
      original: 129,
      discounted: 99
    },
    features: ['AI Assistants', 'Workflow Automation', 'Task Management', 'Efficiency Tools'],
    path: ['AI-Enhanced Worker']
  },
  {
    id: 'worker-2',
    title: 'Communication & Collaboration with AI',
    description: 'Enhance team communication and collaboration using AI-powered platforms.',
    thumbnail: '/thumbnails/communication-collaboration.jpg',
    icon: '💬',
    rating: 4.6,
    duration: '6 hours',
    level: 'Intermediate',
    students: 680,
    lessons: 6,
    instructor: 'Chris Johnson',
    category: 'Collaboration',
    tags: ['communication', 'collaboration', 'ai-tools', 'remote-work'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['AI Writing Assistants', 'Meeting Tools', 'Collaboration Platforms', 'Remote Work'],
    path: ['AI-Enhanced Worker']
  },
  {
    id: 'worker-3',
    title: 'Decision-Making & AI Augmentation',
    description: 'Use AI tools to enhance decision-making processes and strategic thinking.',
    thumbnail: '/thumbnails/decision-making.jpg',
    icon: '🎯',
    rating: 4.8,
    duration: '6 hours',
    level: 'Intermediate',
    students: 520,
    lessons: 6,
    instructor: 'Dr. Amanda Rodriguez',
    category: 'Business & Strategy',
    tags: ['decision-making', 'strategy', 'risk-assessment', 'planning'],
    price: {
      original: 159,
      discounted: 129
    },
    features: ['Data Analysis', 'Predictive Insights', 'Risk Assessment', 'Strategic Planning'],
    path: ['AI-Enhanced Worker']
  },
  {
    id: 'worker-4',
    title: 'Workplace Transformation Project',
    description: 'Design and implement AI-enhanced workflows for real workplace scenarios.',
    thumbnail: '/thumbnails/workplace-transformation.jpg',
    icon: '🏢',
    rating: 4.7,
    duration: '7 hours',
    level: 'Advanced',
    students: 380,
    lessons: 7,
    instructor: 'Robert Chen',
    category: 'Applied Practice',
    tags: ['workplace', 'transformation', 'workflows', 'implementation'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['Process Analysis', 'Tool Implementation', 'Change Management', 'Impact Measurement'],
    path: ['AI-Enhanced Worker']
  },
  {
    id: 'entrepreneur-1',
    title: 'Startup Fundamentals & Market Discovery',
    description: 'Learn startup basics and how to identify market opportunities using data.',
    thumbnail: '/thumbnails/startup-fundamentals.jpg',
    icon: '🔍',
    rating: 4.6,
    duration: '5 hours',
    level: 'Beginner',
    students: 720,
    lessons: 5,
    instructor: 'Jessica Martinez',
    category: 'Business & Strategy',
    tags: ['startup', 'market-research', 'validation', 'lean'],
    price: {
      original: 139,
      discounted: 109
    },
    features: ['Idea Validation', 'Market Research', 'Customer Discovery', 'Lean Methodology'],
    path: ['Entrepreneur']
  },
  {
    id: 'entrepreneur-2',
    title: 'AI-Powered Business Models',
    description: 'Design innovative business models leveraging AI technologies and capabilities.',
    thumbnail: '/thumbnails/ai-business-models.jpg',
    icon: '💡',
    rating: 4.7,
    duration: '6 hours',
    level: 'Intermediate',
    students: 580,
    lessons: 6,
    instructor: 'Marcus Thompson',
    category: 'Business & Strategy',
    tags: ['business-models', 'innovation', 'revenue', 'scalability'],
    price: {
      original: 159,
      discounted: 129
    },
    features: ['AI Business Cases', 'Revenue Models', 'Competitive Advantage', 'Scalability'],
    path: ['Entrepreneur']
  },
  {
    id: 'entrepreneur-3',
    title: 'Finance, Strategy & Growth',
    description: 'Master financial planning, strategic decision-making, and growth strategies.',
    thumbnail: '/thumbnails/finance-strategy.jpg',
    icon: '📈',
    rating: 4.8,
    duration: '6 hours',
    level: 'Advanced',
    students: 450,
    lessons: 6,
    instructor: 'Daniel Wilson',
    category: 'Business & Strategy',
    tags: ['finance', 'strategy', 'growth', 'funding'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Financial Modeling', 'Funding Strategies', 'Growth Metrics', 'Strategic Planning'],
    path: ['Entrepreneur']
  },
  {
    id: 'entrepreneur-4',
    title: 'Startup Simulation Project',
    description: 'Complete startup simulation from idea to business plan presentation.',
    thumbnail: '/thumbnails/startup-simulation.jpg',
    icon: '🎮',
    rating: 4.9,
    duration: '7 hours',
    level: 'Advanced',
    students: 320,
    lessons: 7,
    instructor: 'Sophia Chen',
    category: 'Applied Practice',
    tags: ['simulation', 'business-plan', 'pitch', 'investor'],
    price: {
      original: 189,
      discounted: 159
    },
    features: ['Business Plan', 'Financial Projections', 'Pitch Development', 'Investor Prep'],
    path: ['Entrepreneur']
  },
  {
    id: 'freelance-1',
    title: 'Building a Digital Portfolio',
    description: 'Create compelling digital portfolios that showcase your skills and attract clients.',
    thumbnail: '/thumbnails/digital-portfolio.jpg',
    icon: '💼',
    rating: 4.7,
    duration: '5 hours',
    level: 'Beginner',
    students: 890,
    lessons: 5,
    instructor: 'Alex Kim',
    category: 'Collaboration',
    tags: ['portfolio', 'personal-branding', 'showcase', 'online-presence'],
    price: {
      original: 129,
      discounted: 99
    },
    features: ['Portfolio Design', 'Case Studies', 'Personal Branding', 'Online Presence'],
    path: ['Freelancer']
  },
  {
    id: 'freelance-2',
    title: 'Client Acquisition & Proposal Writing',
    description: 'Master strategies for finding clients and writing winning proposals.',
    thumbnail: '/thumbnails/client-acquisition.jpg',
    icon: '📝',
    rating: 4.6,
    duration: '6 hours',
    level: 'Intermediate',
    students: 640,
    lessons: 6,
    instructor: 'Maria Garcia',
    category: 'Business & Strategy',
    tags: ['clients', 'proposals', 'pricing', 'contracts'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['Lead Generation', 'Pricing Strategies', 'Proposal Writing', 'Contract Basics'],
    path: ['Freelancer']
  },
  {
    id: 'freelance-3',
    title: 'AI Tools for Freelancers',
    description: 'Leverage AI tools to enhance productivity and service delivery.',
    thumbnail: '/thumbnails/ai-freelancer.jpg',
    icon: '⚡',
    rating: 4.8,
    duration: '7 hours',
    level: 'Intermediate',
    students: 520,
    lessons: 7,
    instructor: 'Tom Wilson',
    category: 'Collaboration',
    tags: ['ai-tools', 'productivity', 'automation', 'quality'],
    price: {
      original: 159,
      discounted: 129
    },
    features: ['AI Assistants', 'Automation Tools', 'Quality Enhancement', 'Time Management'],
    path: ['Freelancer']
  },
  {
    id: 'freelance-4',
    title: 'Freelance Project Simulation',
    description: 'Simulated freelance project covering client interaction to delivery.',
    thumbnail: '/thumbnails/freelance-simulation.jpg',
    icon: '🎭',
    rating: 4.7,
    duration: '7 hours',
    level: 'Advanced',
    students: 380,
    lessons: 7,
    instructor: 'Lisa Martinez',
    category: 'Applied Practice',
    tags: ['simulation', 'client-management', 'project-delivery', 'feedback'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['Client Communication', 'Project Management', 'Delivery & Feedback', 'Payment Processing'],
    path: ['Freelancer']
  },
  {
    id: 'leader-1',
    title: 'Organizational Change & Data Culture',
    description: 'Lead digital transformation by building data-driven cultures and managing change.',
    thumbnail: '/thumbnails/organizational-change.jpg',
    icon: '🏛️',
    rating: 4.7,
    duration: '5 hours',
    level: 'Intermediate',
    students: 580,
    lessons: 5,
    instructor: 'Dr. Michael Brown',
    category: 'Business & Strategy',
    tags: ['change-management', 'culture', 'leadership', 'transformation'],
    price: {
      original: 159,
      discounted: 129
    },
    features: ['Change Management', 'Culture Building', 'Stakeholder Engagement', 'Transformation Roadmaps'],
    path: ['Digital Transformation Leader']
  },
  {
    id: 'leader-2',
    title: 'Emerging Tech & Systems Integration',
    description: 'Understand emerging technologies and how to integrate them into existing systems.',
    thumbnail: '/thumbnails/emerging-tech.jpg',
    icon: '🔗',
    rating: 4.8,
    duration: '6 hours',
    level: 'Advanced',
    students: 420,
    lessons: 6,
    instructor: 'Dr. Sarah Williams',
    category: 'Business & Strategy',
    tags: ['emerging-tech', 'integration', 'vendor-evaluation', 'trends'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Tech Landscape', 'Integration Strategies', 'Vendor Evaluation', 'Future Trends'],
    path: ['Digital Transformation Leader']
  },
  {
    id: 'leader-3',
    title: 'Leadership in the Age of AI',
    description: 'Develop leadership skills specifically for AI-driven organizational environments.',
    thumbnail: '/thumbnails/ai-leadership.jpg',
    icon: '👑',
    rating: 4.9,
    duration: '6 hours',
    level: 'Advanced',
    students: 350,
    lessons: 6,
    instructor: 'Dr. Robert Chen',
    category: 'Business & Strategy',
    tags: ['leadership', 'ai-strategy', 'governance', 'innovation'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['AI Strategy', 'Team Leadership', 'Ethical Governance', 'Innovation Culture'],
    path: ['Digital Transformation Leader']
  },
  {
    id: 'leader-4',
    title: 'Digital Transformation Roadmap Project',
    description: 'Create comprehensive digital transformation strategy for a real organization.',
    thumbnail: '/thumbnails/transformation-roadmap.jpg',
    icon: '🗺️',
    rating: 4.8,
    duration: '7 hours',
    level: 'Advanced',
    students: 290,
    lessons: 7,
    instructor: 'Dr. Emily Rodriguez',
    category: 'Applied Practice',
    tags: ['strategy', 'roadmap', 'implementation', 'roi'],
    price: {
      original: 189,
      discounted: 159
    },
    features: ['Strategy Development', 'Implementation Plan', 'Risk Assessment', 'ROI Analysis'],
    path: ['Digital Transformation Leader']
  },
  {
    id: 'comms-1',
    title: 'Storytelling with Data',
    description: 'Master the art of crafting compelling narratives using data and insights.',
    thumbnail: '/thumbnails/storytelling-data.jpg',
    icon: '📖',
    rating: 4.7,
    duration: '5 hours',
    level: 'Beginner',
    students: 820,
    lessons: 5,
    instructor: 'Rachel Lee',
    category: 'Collaboration',
    tags: ['storytelling', 'data-narrative', 'visualization', 'persuasion'],
    price: {
      original: 139,
      discounted: 109
    },
    features: ['Narrative Structure', 'Data Visualization', 'Audience Analysis', 'Persuasive Techniques'],
    path: ['Communicator']
  },
  {
    id: 'comms-2',
    title: 'Visual & Written Communication',
    description: 'Enhance visual and written communication skills for various platforms and audiences.',
    thumbnail: '/thumbnails/visual-communication.jpg',
    icon: '✍️',
    rating: 4.6,
    duration: '6 hours',
    level: 'Intermediate',
    students: 670,
    lessons: 6,
    instructor: 'David Wilson',
    category: 'Collaboration',
    tags: ['visual-design', 'writing', 'platforms', 'brand-voice'],
    price: {
      original: 149,
      discounted: 119
    },
    features: ['Visual Design', 'Writing Techniques', 'Platform Optimization', 'Brand Voice'],
    path: ['Communicator']
  },
  {
    id: 'comms-3',
    title: 'Public Speaking & Thought Leadership',
    description: 'Develop public speaking skills and establish yourself as a thought leader.',
    thumbnail: '/thumbnails/public-speaking.jpg',
    icon: '🎤',
    rating: 4.9,
    duration: '7 hours',
    level: 'Advanced',
    students: 480,
    lessons: 7,
    instructor: 'Sarah Johnson',
    category: 'Collaboration',
    tags: ['public-speaking', 'thought-leadership', 'presentation', 'personal-branding'],
    price: {
      original: 169,
      discounted: 139
    },
    features: ['Presentation Skills', 'Audience Engagement', 'Content Development', 'Personal Branding'],
    isPopular: true,
    path: ['Communicator']
  },
  {
    id: 'comms-4',
    title: 'AI-Assisted Communication Project',
    description: 'Create comprehensive communication strategy using AI tools and traditional methods.',
    thumbnail: '/thumbnails/ai-communication.jpg',
    icon: '🤝',
    rating: 4.7,
    duration: '7 hours',
    level: 'Advanced',
    students: 340,
    lessons: 7,
    instructor: 'Michael Garcia',
    category: 'Applied Practice',
    tags: ['ai-tools', 'multi-channel', 'impact-measurement', 'crisis-comms'],
    price: {
      original: 179,
      discounted: 149
    },
    features: ['Multi-channel Strategy', 'AI Enhancement', 'Impact Measurement', 'Crisis Communication'],
    path: ['Communicator']
  }
];

const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Abbes Kadri',
    content: 'The Data Analytics Fundamentals course transformed how I approach data.',
    rating: 5,
    course: 'Data Analytics Fundamentals'
  },
  {
    id: '2',
    name: 'Anes Neggar',
    content: 'As someone with no background, the Python course was incredibly accessible.',
    rating: 5,
    course: 'Python for Data Science'
  },
  {
    id: '3',
    name: 'Saleh Nenni',
    content: 'The Machine Learning course provided practical skills I could apply directly.',
    rating: 4,
    course: 'Machine Learning for Business'
  },
  {
    id: '4',
    name: 'Ahmed Tchier',
    content: 'SQL Mastery course exceeded my expectations.AMAZING.',
    rating: 5,
    course: 'SQL Mastery: From Query to Insight'
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
    <section className="relative bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden pt-30">
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
            <Button variant="primary" size="xl" href="/auth/signup">
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

const LearningModules: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'popular' | 'new' | 'duration' | 'lessons'>('popular')
  const [displayedModules, setDisplayedModules] = useState<LearningModule[]>([])

    const categories = ['All', 'Data & AI', 'Technology', 'Business & Strategy', 'Collaboration', 'Applied Practice']
  // Get random 9 modules on initial load and when filters change
  useEffect(() => {
    setIsLoading(true)
    
    let filtered = LEARNING_MODULES

    // Apply filters first
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(module => module.category === selectedCategory)
    }

    if (searchQuery) {
      filtered = filtered.filter(module => 
        module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module.features.some(feature => feature.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Apply sorting
    switch (sortBy) {
      case 'popular':
        filtered = filtered.sort((a, b) => {
          if (a.isPopular && !b.isPopular) return -1
          if (!a.isPopular && b.isPopular) return 1
          return 0
        })
        break
      case 'new':
        filtered = filtered.sort((a, b) => {
          if (a.isNew && !b.isNew) return -1
          if (!a.isNew && b.isNew) return 1
          return 0
        })
        break
      case 'duration':
        filtered = filtered.sort((a, b) => {
          const aDuration = parseInt(a.duration)
          const bDuration = parseInt(b.duration)
          return aDuration - bDuration
        })
        break
      case 'lessons':
        filtered = filtered.sort((a, b) => b.lessons - a.lessons)
        break
    }

    // Get random 9 modules from filtered results
    const shuffled = [...filtered].sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, 9)
    
    setDisplayedModules(selected)
    setTimeout(() => setIsLoading(false), 300)
  }, [selectedCategory, searchQuery, sortBy])

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08 // Reduced for faster loading
      }
    }
  }
  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.4,
        ease: cubicBezier(0.42, 0, 0.58, 1), // ✅ Correct
      },
    },
  };


  const handleCategoryFilter = (category: string) => {
    setIsLoading(true)
    setSelectedCategory(category)
  }

  // Particle system for background
  const particles = Array.from({ length: 20 }, (_, i) => ({ // Reduced particles
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.5 + 0.5, // Smaller particles
    delay: Math.random() * 2
  }))

  if (isLoading) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50 relative overflow-hidden">
        <div className="absolute inset-0">
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full bg-blue-200/20" // Reduced opacity
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                duration: 1.5, // Faster animation
                delay: particle.delay,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 py-12"> {/* Reduced padding */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Skeleton Header - More compact */}
            <div className="text-center mb-12"> {/* Reduced margin */}
              <div className="animate-pulse">
                <div className="h-6 w-48 bg-blue-200/40 rounded-full mx-auto mb-4"></div> {/* Smaller */}
                <div className="h-8 w-80 bg-blue-200/40 rounded-lg mx-auto mb-3"></div> {/* Smaller */}
                <div className="h-4 w-96 bg-blue-200/40 rounded-lg mx-auto"></div> {/* Smaller */}
              </div>
            </div>
            
            {/* Skeleton Filters - More compact */}
            <div className="flex flex-wrap justify-center gap-2 mb-6"> {/* Reduced gap and margin */}
              {[...Array(6)].map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="h-8 w-20 bg-blue-200/40 rounded-full"></div> {/* Smaller */}
                </div>
              ))}
            </div>
            
            {/* Skeleton Grid - More compact cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Reduced gap */}
              {[...Array(6)].map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="h-64 bg-white/80 rounded-xl shadow-md border border-blue-100"></div> {/* Smaller height */}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Optimized Background Elements */}
      <div className="absolute inset-0">
        {/* Smaller Gradient Orbs */}
        <div className="absolute top-5 left-5 w-48 h-48 bg-blue-200/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-5 right-5 w-48 h-48 bg-cyan-200/20 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
        
        {/* Floating Particles */}
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-blue-300/15"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0, 0.6, 0]
            }}
            transition={{
              duration: 2.5,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Subtle Geometric Pattern */}
        <div className="absolute inset-0 opacity-[0.015]">
          <div className="w-full h-full" style={{
            backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px),
                              linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
            backgroundSize: '40px 40px' // Smaller pattern
          }}></div>
        </div>
      </div>

      <div className="relative z-10 py-12"> {/* Reduced vertical padding */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Compact Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center mb-12" // Reduced margin
          >
            {/* Smaller Animated Badge */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.1, type: "spring" }}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-white/80 backdrop-blur-md border border-blue-200 shadow-lg mb-6 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5"></div>
              <div className="flex items-center space-x-2 relative z-10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                ></motion.div>
                <span className="text-xs font-semibold text-gray-700">Featured Modules</span>
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                ></motion.div>
              </div>
            </motion.div>

            {/* Compact Main Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
                Discover{' '}
                <motion.span 
                  className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent"
                  animate={{ backgroundPosition: ['0%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                  style={{ backgroundSize: '200% 100%' }}
                >
                  Our Courses
                </motion.span>
              </h2>
              
            </motion.div>

            {/* Enhanced Search and Controls - More Compact */}
            <motion.div
              className="flex flex-col lg:flex-row gap-4 justify-center items-center mb-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {/* Search Bar */}
              <div className="relative w-full max-w-md">
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="relative"
                >
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search modules, skills, topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl shadow-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                  />
                </motion.div>
              </div>

              {/* Sort and View Controls */}
              <div className="flex gap-2">
                <motion.select
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl shadow-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                >
                  <option value="popular">Most Popular</option>
                  <option value="new">Newest</option>
                  <option value="duration">Shortest Duration</option>
                  <option value="lessons">Most Lessons</option>
                </motion.select>

                {/* View Toggle */}
                <motion.div
                  className="flex bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl shadow-md p-1"
                  whileHover={{ scale: 1.02 }}
                >
                  <motion.button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      viewMode === 'grid' 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Grid className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      viewMode === 'list' 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <List className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>

            {/* Compact Category Filter */}
            <motion.div
              className="flex flex-wrap justify-center gap-2 mb-6"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              {categories.map((category) => (
                <motion.button
                  key={category}
                  onClick={() => handleCategoryFilter(category)}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm border shadow-sm text-sm ${
                    selectedCategory === category
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-transparent shadow-md'
                      : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-white hover:shadow-md hover:border-blue-200'
                  }`}
                >
                  {category}
                </motion.button>
              ))}
            </motion.div>
          </motion.div>

          {/* Results Count and Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6"
          >
            <div className="text-gray-600 text-sm">
              Showing <span className="font-semibold text-gray-900">{displayedModules.length}</span> of{' '}
              <span className="font-semibold text-blue-600">{LEARNING_MODULES.length}</span> total modules
              {selectedCategory !== 'All' && (
                <span> in <span className="font-semibold text-blue-600">{selectedCategory}</span></span>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSelectedCategory('All')
                  setSearchQuery('')
                }}
                className="px-3 py-1.5 text-xs bg-white/80 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-gray-600 hover:text-gray-900"
              >
                Clear Filters
              </motion.button>
              
              {/* View All Courses Button */}
              <Link href="/learn/courses">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 text-sm flex items-center gap-2"
                >
                  <span>View All Courses</span>
                  <ArrowRight className="w-3 h-3" />
                </motion.div>
              </Link>
            </div>
          </motion.div>

          {/* Premium Modules Grid - Compact Cards */}
          {viewMode === 'grid' ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" // Reduced gap
            >
              {displayedModules.map((module, index) => (
                <motion.div
                  key={module.id}
                  variants={itemVariants}
                  whileHover={{ 
                    y: -4, // Reduced hover lift
                    scale: 1.01,
                    transition: { duration: 0.2 }
                  }}
                  onHoverStart={() => setHoveredCard(module.id)}
                  onHoverEnd={() => setHoveredCard(null)}
                  className="group relative"
                >
                  {/* Subtle Background Glow */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    animate={{
                      background: [
                        `radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05), transparent)`,
                        `radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.05), transparent)`,
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  <Link href={`/learn/courses/${module.id}`} className="block h-full">
                    <div className="relative h-full bg-white/90 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
                      
                      {/* Compact Animated Header */}
                      <div className="relative h-3 bg-gradient-to-r from-blue-500 to-cyan-500 overflow-hidden">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400"
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.5, delay: index * 0.1 }} // Faster
                        />
                      </div>

                      {/* Compact Card Content */}
                      <div className="p-4"> {/* Reduced padding */}
                        {/* Badges and Icon Row */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-1.5">
                            <motion.span 
                              className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                module.level === 'Beginner' ? 'bg-green-100 text-green-700 border-green-200' :
                                module.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                'bg-red-100 text-red-700 border-red-200'
                              }`}
                              whileHover={{ scale: 1.03 }}
                            >
                              {module.level}
                            </motion.span>
                            
                            {module.isNew && (
                              <motion.span 
                                className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium border border-blue-200"
                                whileHover={{ scale: 1.03 }}
                                animate={{ 
                                  scale: [1, 1.05, 1],
                                }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                New
                              </motion.span>
                            )}
                          </div>
                          
                          {/* Compact Animated Icon */}
                          <motion.div
                            className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-lg text-white shadow-md"
                            whileHover={{ scale: 1.08, rotate: 3 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            {module.icon}
                          </motion.div>
                        </div>

                        {/* Title and Description */}
                        <div className="mb-3">
                          <motion.h3
                            className="text-lg font-bold text-gray-900 mb-1.5 group-hover:text-blue-600 transition-colors duration-200 line-clamp-2"
                            whileHover={{ x: 1 }}
                          >
                            {module.title}
                          </motion.h3>
                          <p className="text-gray-600 text-xs leading-relaxed line-clamp-2 mb-2">
                            {module.description}
                          </p>
                        </div>

                        {/* Features - More Compact */}
                        <div className="mb-3">
                          <div className="flex items-center space-x-1.5 mb-2">
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
                            <span className="text-xs font-semibold text-gray-500">SKILLS</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {module.features.slice(0, 2).map((feature, idx) => (
                              <motion.span 
                                key={idx}
                                whileHover={{ scale: 1.03 }}
                                className="px-2 py-1 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-600 rounded-lg text-xs font-medium border border-blue-200"
                              >
                                {feature}
                              </motion.span>
                            ))}
                            {module.features.length > 2 && (
                              <motion.span 
                                whileHover={{ scale: 1.03 }}
                                className="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium border border-gray-200"
                              >
                                +{module.features.length - 2}
                              </motion.span>
                            )}
                          </div>
                        </div>

                        {/* Meta Information - Compact */}
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                          <div className="flex items-center space-x-3">
                            <motion.div 
                              className="flex items-center space-x-1"
                              whileHover={{ scale: 1.03 }}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{module.duration}</span>
                            </motion.div>
                            <motion.div 
                              className="flex items-center space-x-1"
                              whileHover={{ scale: 1.03 }}
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>{module.lessons} lessons</span>
                            </motion.div>
                          </div>
                          
                          {module.isPopular && (
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <TrendingUp className="w-3 h-3 text-green-500" />
                            </motion.div>
                          )}
                        </div>

                        {/* Compatible Paths - Compact */}
                        <div className="mb-4">
                          <div className="flex items-center space-x-1.5 mb-1.5">
                            <MapPin className="w-2.5 h-2.5 text-gray-400" />
                            <span className="text-xs font-semibold text-gray-500">PATHS</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {module.path.slice(0, 2).map((path, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs border border-gray-200">
                                {path}
                              </span>
                            ))}
                            {module.path.length > 2 && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs border border-gray-200">
                                +{module.path.length - 2}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Compact Action Button */}
                        <motion.div
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <button className="w-full py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 text-sm group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                            <span className="relative z-10 flex items-center justify-center space-x-1.5">
                              <span>Start Learning</span>
                              <motion.div
                                animate={{ x: [0, 3, 0] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                              >
                                <ArrowRight className="w-3 h-3" />
                              </motion.div>
                            </span>
                          </button>
                        </motion.div>
                      </div>

                      {/* Subtle Hover Effect */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-t from-blue-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
                      />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            // Compact List View
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3" // Reduced spacing
            >
              {displayedModules.map((module, index) => (
                <motion.div
                  key={module.id}
                  variants={itemVariants}
                  whileHover={{ x: 2 }}
                  className="group"
                >
                  <Link href={`/learn/courses/${module.id}`}>
                    <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-md hover:shadow-lg transition-all duration-200 border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          {/* Compact Icon */}
                          <motion.div
                            className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-xl text-white shadow-md"
                            whileHover={{ scale: 1.05 }}
                          >
                            {module.icon}
                          </motion.div>

                          {/* Compact Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                {module.title}
                              </h3>
                              <div className="flex space-x-1.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                  module.level === 'Beginner' ? 'bg-green-100 text-green-700' :
                                  module.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {module.level}
                                </span>
                                {module.isNew && (
                                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs font-medium">
                                    New
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-600 text-xs mb-1 line-clamp-1">
                              {module.description}
                            </p>
                            <div className="flex items-center space-x-3 text-xs text-gray-500">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{module.duration}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <BookOpen className="w-3 h-3" />
                                <span>{module.lessons} lessons</span>
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-xs text-gray-500">{module.category}</span>
                            </div>
                          </div>
                        </div>

                        {/* Compact Action */}
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          className="ml-3"
                        >
                          <button className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 text-xs">
                            Start
                          </button>
                        </motion.div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Enhanced Empty State - Compact */}
          {displayedModules.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-5xl mb-3"
              >
                🔍
              </motion.div>
              <div className="text-gray-700 text-lg mb-3 font-semibold">
                No modules found
              </div>
              <p className="text-gray-500 mb-4 max-w-md mx-auto text-sm">
                Try adjusting your search terms or browse all available courses.
              </p>
              <div className="flex gap-3 justify-center">
                <motion.button
                  onClick={() => {
                    setSelectedCategory('All')
                    setSearchQuery('')
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 text-sm"
                >
                  Clear Filters
                </motion.button>
                <Link href="/learn/courses">
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-4 py-2 bg-white/80 border border-gray-200 text-gray-700 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 text-sm hover:border-blue-200"
                  >
                    View All Courses
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Compact Bottom CTA */}
          {displayedModules.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="text-center mt-12"
            >
              <div className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 rounded-2xl p-6 border border-blue-200 shadow-lg relative overflow-hidden backdrop-blur-md">
                <div className="relative z-10">
                  <motion.h3
                    className="text-xl font-bold text-gray-900 mb-3"
                  >
                    Want to see more?
                  </motion.h3>
                  <p className="text-gray-600 mb-4 max-w-md mx-auto text-sm">
                    Explore our complete collection of {LEARNING_MODULES.length} learning modules and find the perfect path for your goals.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/learn/courses">
                      <motion.div
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 text-sm relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                        <span className="relative z-10">Browse All {LEARNING_MODULES.length} Modules</span>
                      </motion.div>
                    </Link>
                    <Link href="/auth/signup">
                      <motion.div
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        className="px-6 py-2.5 bg-white/80 backdrop-blur-md text-gray-700 border border-gray-200 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 text-sm hover:bg-white hover:border-blue-200"
                      >
                        Start Free Trial
                      </motion.div>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}

// Premium Icon Components
const Search = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const Grid = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
)

const List = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
)

const BookOpen = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
)

const MapPin = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

interface Pathway {
  title: string
  description: string
  duration: string
  courses: number
  lessons: number
  level: string
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
}

const LearningPathways: React.FC = () => {
  const allPathways = [
    {
      id: '1',
      title: 'Data Explorer',
      description: 'Master data analysis and visualization to extract meaningful insights from complex datasets. Build strong statistical thinking and data-driven decision making skills.',
      duration: '6 months',
      modules: 5,
      lessons: 29,
      level: 'Beginner',
      skills: ['SQL', 'Python', 'Data Visualization', 'Statistical Analysis', 'Excel'],
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
      new: false,
      featured: true,
      progress: 0,
      startDate: '2024-01-15'
    },
    {
      id: '2',
      title: 'Business Intelligence Analyst',
      description: 'Transform raw data into actionable business intelligence that drives strategic decisions. Create compelling dashboards and communicate insights effectively.',
      duration: '7 months',
      modules: 6,
      lessons: 30,
      level: 'Intermediate',
      skills: ['Power BI', 'Tableau', 'SQL', 'Data Modeling', 'KPI Development'],
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
      new: true,
      featured: false,
      progress: 0,
      startDate: '2024-02-01'
    },
    {
      id: '3',
      title: 'AI Thinker',
      description: 'Develop comprehensive understanding of AI concepts and practical applications. Explore machine learning fundamentals and ethical considerations.',
      duration: '7 months',
      modules: 5,
      lessons: 29,
      level: 'Intermediate',
      skills: ['Machine Learning', 'Neural Networks', 'AI Ethics', 'Python', 'Algorithm Design'],
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
      new: false,
      featured: true,
      progress: 0,
      startDate: '2024-01-20'
    },
    {
      id: '4',
      title: 'Machine Builder',
      description: 'Master building and deploying machine learning models in production environments. Learn MLOps practices and scalable system design.',
      duration: '8 months',
      modules: 5,
      lessons: 28,
      level: 'Advanced',
      skills: ['TensorFlow', 'PyTorch', 'MLOps', 'Docker', 'AWS'],
      color: 'from-purple-700 to-pink-600',
      gradient: 'bg-gradient-to-br from-purple-700 to-pink-600',
      icon: '⚙️',
      enrolled: 7430,
      rating: 4.8,
      projects: 9,
      certificate: true,
      weeklyHours: '10-12 hours',
      link: '/learn/paths/04',
      popularity: 'medium',
      trend: 'up',
      new: false,
      featured: false,
      progress: 0,
      startDate: '2024-03-01'
    },
    {
      id: '5',
      title: 'Applied AI Innovator',
      description: 'Bridge AI research and real-world applications. Implement innovative solutions with focus on practical implementation and ROI analysis.',
      duration: '7 months',
      modules: 5,
      lessons: 28,
      level: 'Advanced',
      skills: ['Computer Vision', 'NLP', 'AI Strategy', 'Project Management', 'Business Analysis'],
      color: 'from-pink-600 to-rose-600',
      gradient: 'bg-gradient-to-br from-pink-600 to-rose-600',
      icon: '💡',
      enrolled: 5680,
      rating: 4.7,
      projects: 8,
      certificate: true,
      weeklyHours: '9-11 hours',
      link: '/learn/paths/05',
      popularity: 'medium',
      trend: 'stable',
      new: true,
      featured: true,
      progress: 0,
      startDate: '2024-02-15'
    },
    {
      id: '6',
      title: 'Builder',
      description: 'Develop comprehensive technical skills to build robust software products. Master full-stack development, system design, and product thinking.',
      duration: '8 months',
      modules: 5,
      lessons: 29,
      level: 'Mixed',
      skills: ['JavaScript', 'React', 'Node.js', 'System Design', 'Product Management'],
      color: 'from-amber-500 to-orange-600',
      gradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
      icon: '🛠️',
      enrolled: 21340,
      rating: 4.8,
      projects: 10,
      certificate: true,
      weeklyHours: '8-10 hours',
      link: '/learn/paths/06',
      popularity: 'high',
      trend: 'up',
      new: false,
      featured: true,
      progress: 0,
      startDate: '2024-01-10'
    },
    {
      id: '7',
      title: 'Freelancer',
      description: 'Build a successful freelance career mastering both technical skills and business fundamentals. Learn client acquisition and entrepreneurial mindset.',
      duration: '6 months',
      modules: 5,
      lessons: 29,
      level: 'Intermediate',
      skills: ['Client Acquisition', 'Project Management', 'Contract Law', 'Personal Branding', 'Financial Planning'],
      color: 'from-orange-500 to-red-500',
      gradient: 'bg-gradient-to-br from-orange-500 to-red-500',
      icon: '💼',
      enrolled: 16780,
      rating: 4.6,
      projects: 6,
      certificate: true,
      weeklyHours: '6-8 hours',
      link: '/learn/paths/07',
      popularity: 'high',
      trend: 'stable',
      new: false,
      featured: false,
      progress: 0,
      startDate: '2024-02-01'
    },
    {
      id: '8',
      title: 'AI Enhanced Worker',
      description: 'Leverage AI to supercharge productivity and effectiveness. Integrate AI tools into daily workflow and enhance decision-making capabilities.',
      duration: '5 months',
      modules: 5,
      lessons: 28,
      level: 'Beginner',
      skills: ['AI Tools', 'Process Automation', 'Prompt Engineering', 'Workflow Optimization', 'Data Analysis'],
      color: 'from-teal-500 to-cyan-600',
      gradient: 'bg-gradient-to-br from-teal-500 to-cyan-600',
      icon: '🚀',
      enrolled: 28960,
      rating: 4.7,
      projects: 5,
      certificate: true,
      weeklyHours: '5-7 hours',
      link: '/learn/paths/08',
      popularity: 'very high',
      trend: 'up',
      new: true,
      featured: true,
      progress: 0,
      startDate: '2024-01-05'
    },
    {
      id: '9',
      title: 'Entrepreneur',
      description: 'Develop mindset and skills to launch and grow successful ventures. Learn market validation, fundraising strategies, and team building.',
      duration: '7 months',
      modules: 5,
      lessons: 28,
      level: 'Intermediate',
      skills: ['Business Modeling', 'Market Research', 'Fundraising', 'Team Leadership', 'Financial Management'],
      color: 'from-red-600 to-amber-600',
      gradient: 'bg-gradient-to-br from-red-600 to-amber-600',
      icon: '🌟',
      enrolled: 13450,
      rating: 4.8,
      projects: 7,
      certificate: true,
      weeklyHours: '7-9 hours',
      link: '/learn/paths/09',
      popularity: 'medium',
      trend: 'up',
      new: false,
      featured: false,
      progress: 0,
      startDate: '2024-03-15'
    },
    {
      id: '10',
      title: 'Digital Transformation Leader',
      description: 'Lead organizational change and digital innovation initiatives. Master change management and technology adoption frameworks.',
      duration: '8 months',
      modules: 5,
      lessons: 28,
      level: 'Advanced',
      skills: ['Change Management', 'Digital Strategy', 'Technology Adoption', 'Stakeholder Management', 'Innovation Frameworks'],
      color: 'from-amber-600 to-orange-700',
      gradient: 'bg-gradient-to-br from-amber-600 to-orange-700',
      icon: '🎯',
      enrolled: 6780,
      rating: 4.9,
      projects: 6,
      certificate: true,
      weeklyHours: '9-11 hours',
      link: '/learn/paths/10',
      popularity: 'low',
      trend: 'stable',
      new: true,
      featured: true,
      progress: 0,
      startDate: '2024-04-01'
    },
    {
      id: '11',
      title: 'Communicator',
      description: 'Master effective communication across various mediums and audiences. Develop storytelling, public speaking, and technical writing skills.',
      duration: '6 months',
      modules: 6,
      lessons: 29,
      level: 'Mixed',
      skills: ['Public Speaking', 'Technical Writing', 'Storytelling', 'Active Listening', 'Presentation Design'],
      color: 'from-emerald-500 to-teal-600',
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      icon: '🗣️',
      enrolled: 19870,
      rating: 4.7,
      projects: 5,
      certificate: true,
      weeklyHours: '6-8 hours',
      link: '/learn/paths/11',
      popularity: 'high',
      trend: 'stable',
      new: false,
      featured: false,
      progress: 0,
      startDate: '2024-02-20'
    },
    {
      id: '12',
      title: 'Systems Thinker',
      description: 'Understand and analyze complex systems and their interconnections. Learn systems mapping, causal analysis, and intervention design.',
      duration: '7 months',
      modules: 5,
      lessons: 29,
      level: 'Advanced',
      skills: ['Systems Mapping', 'Causal Analysis', 'Complexity Theory', 'Strategic Planning', 'Problem Framing'],
      color: 'from-indigo-600 to-slate-700',
      gradient: 'bg-gradient-to-br from-indigo-600 to-slate-700',
      icon: '🔄',
      enrolled: 5230,
      rating: 4.8,
      projects: 6,
      certificate: true,
      weeklyHours: '8-10 hours',
      link: '/learn/paths/12',
      popularity: 'low',
      trend: 'up',
      new: false,
      featured: true,
      progress: 0,
      startDate: '2024-03-10'
    }
  ]

  const [displayedPathways, setDisplayedPathways] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shuffleKey, setShuffleKey] = useState(0)
  const [selectedLevel, setSelectedLevel] = useState('All')
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'cinematic'>('cinematic')
  const router = useRouter()

  const levels = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Mixed']

  // Particle system for background
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    speed: Math.random() * 2 + 0.5,
    delay: Math.random() * 5
  }))

  useEffect(() => {
    const timer = setTimeout(() => {
      let filtered = allPathways
      
      if (selectedLevel !== 'All') {
        filtered = allPathways.filter(pathway => pathway.level === selectedLevel)
      }
      
      const shuffled = [...filtered].sort(() => 0.5 - Math.random())
      setDisplayedPathways(shuffled.slice(0, 6))
      setIsLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [shuffleKey, selectedLevel])

  const handleShuffle = () => {
    setIsLoading(true)
    setShuffleKey(prev => prev + 1)
  }

  const handleViewAll = () => {
    router.push('/learn/paths')
  }

  const handleLevelFilter = (level: string) => {
    setIsLoading(true)
    setSelectedLevel(level)
  }

  if (isLoading) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute rounded-full bg-white/10 animate-pulse"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.speed}s`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Skeleton Header */}
            <div className="text-center mb-16">
              <div className="animate-pulse">
                <div className="h-8 w-64 bg-white/20 rounded-full mx-auto mb-6"></div>
                <div className="h-12 w-96 bg-white/20 rounded-lg mx-auto mb-4"></div>
                <div className="h-6 w-128 bg-white/20 rounded-lg mx-auto"></div>
              </div>
            </div>
            
            {/* Skeleton Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="h-80 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-128 h-128 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
        
        {/* Floating Particles */}
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-white/5"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: particle.speed,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Animated Grid */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}></div>
        </div>
      </div>

      <div className="relative z-10 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Enhanced Header */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-center mb-16"
          >
            {/* Animated Badge */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
              className="inline-flex items-center px-6 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl mb-8 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20"></div>
              <div className="flex items-center space-x-3 relative z-10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                ></motion.div>
                <span className="text-sm font-semibold text-white">Featured Learning Paths</span>
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"
                ></motion.div>
              </div>
            </motion.div>

            {/* Main Title */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <h2 className="text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
                Discover Your
                <motion.span 
                  className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent"
                  animate={{ backgroundPosition: ['0%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
                  style={{ backgroundSize: '200% 100%' }}
                >
                  Perfect Path
                </motion.span>
              </h2>
              
              <motion.p
                className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                Explore randomly selected learning paths each visit. Find your perfect career trajectory with our expertly curated roadmaps.
              </motion.p>
            </motion.div>

            {/* Enhanced Level Filter */}
            <motion.div
              className="flex flex-wrap justify-center gap-3 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
            >
              {levels.map((level) => (
                <motion.button
                  key={level}
                  onClick={() => handleLevelFilter(level)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-5 py-2.5 rounded-2xl font-semibold transition-all duration-300 backdrop-blur-sm border ${
                    selectedLevel === level
                      ? 'bg-white/20 text-white border-white/30 shadow-2xl'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  {level}
                </motion.button>
              ))}
            </motion.div>

            {/* Interactive Controls */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <motion.button
                onClick={handleShuffle}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center space-x-3 px-8 py-3.5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-5 h-5" />
                </motion.div>
                <span className="font-semibold">Show Different Paths</span>
              </motion.button>

              <motion.button
                onClick={handleViewAll}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center space-x-3 px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <span className="font-semibold relative z-10">View All 12 Paths</span>
                <motion.div
                  className="relative z-10"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.div>
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Cinematic Pathways Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayedPathways.map((pathway, index) => (
              <motion.div
                key={`${pathway.id}-${shuffleKey}`}
                initial={{ opacity: 0, y: 60, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  duration: 0.8, 
                  delay: 0.1 * index,
                  ease: "easeOut"
                }}
                whileHover={{ 
                  y: -8,
                  scale: 1.02,
                  transition: { duration: 0.3 }
                }}
                onHoverStart={() => setHoveredCard(pathway.id)}
                onHoverEnd={() => setHoveredCard(null)}
                className="group relative"
              >
                {/* Animated Background Glow */}
                <motion.div
                  className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  animate={{
                    background: [
                      `radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15), transparent)`,
                      `radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15), transparent)`,
                      `radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15), transparent)`
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                
                <Link href={pathway.link} className="block h-full">
                  <div className="relative h-full bg-white/5 backdrop-blur-md rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-500 border border-white/10 overflow-hidden">
                    
                    {/* Animated Header */}
                    <div className={`relative h-24 ${pathway.gradient} overflow-hidden`}>
                      {/* Animated Background Pattern */}
                      <div className="absolute inset-0 opacity-20">
                        <div className="absolute inset-0" style={{
                          backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px)`,
                          backgroundSize: '20px 20px'
                        }}></div>
                      </div>
                      
                      {/* Floating Icon */}
                      <motion.div
                        className="absolute top-4 left-4 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-xl"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        {pathway.icon}
                      </motion.div>
                      
                      {/* Animated Elements */}
                      <motion.div
                        className="absolute top-3 right-3 w-4 h-4 bg-white/30 rounded-full"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <motion.div
                        className="absolute bottom-4 right-4 w-3 h-3 bg-white/40 rounded-full"
                        animate={{ scale: [1, 2, 1] }}
                        transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                      />
                    </div>

                    {/* Compact Content */}
                    <div className="p-5">
                      {/* Title and Metadata Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-white truncate group-hover:text-cyan-100 transition-colors">
                            {pathway.title}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                              pathway.level === 'Beginner' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                              pathway.level === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                              pathway.level === 'Advanced' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}>
                              {pathway.level}
                            </span>
                            <div className="flex items-center space-x-1 bg-amber-500/20 px-2 py-1 rounded-full border border-amber-500/30">
                              <Star className="w-3 h-3 text-amber-300" />
                              <span className="text-xs font-semibold text-amber-300">{pathway.rating}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Compact Description */}
                      <p className="text-gray-400 text-sm mb-4 leading-relaxed line-clamp-2">
                        {pathway.description}
                      </p>

                      {/* Mini Stats Grid */}
                      <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-white/5 rounded-2xl border border-white/5">
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{pathway.modules}</div>
                          <div className="text-xs text-gray-400">Mods</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{pathway.lessons}</div>
                          <div className="text-xs text-gray-400">Less</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{pathway.projects}</div>
                          <div className="text-xs text-gray-400">Proj</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-white">{pathway.duration.split(' ')[0]}</div>
                          <div className="text-xs text-gray-400">Mos</div>
                        </div>
                      </div>

                      {/* Compact Skills */}
                      <div className="mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></div>
                          <span className="text-xs font-semibold text-gray-300">Skills</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pathway.skills.slice(0, 3).map((skill: string, idx: number) => (
                            <motion.span 
                              key={idx}
                              whileHover={{ scale: 1.05 }}
                              className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-xs font-medium border border-cyan-500/30"
                            >
                              {skill}
                            </motion.span>
                          ))}
                          {pathway.skills.length > 3 && (
                            <span className="px-2 py-1 bg-white/10 text-gray-400 rounded-lg text-xs font-medium border border-white/10">
                              +{pathway.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Compact Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <div className="flex items-center space-x-3 text-xs text-gray-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{pathway.weeklyHours}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>{(pathway.enrolled / 1000).toFixed(0)}k</span>
                          </span>
                        </div>
                        
                        <motion.div 
                          className="flex items-center space-x-1 px-3 py-1.5 bg-white/10 text-white rounded-xl group-hover:bg-white/20 transition-colors border border-white/10"
                          whileHover={{ scale: 1.05 }}
                        >
                          <span className="text-xs font-semibold">View</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </motion.div>
                      </div>
                    </div>

                    {/* Certificate Badge */}
                    {pathway.certificate && (
                      <motion.div 
                        className="absolute top-3 right-3"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      >
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-lg flex items-center space-x-1 border border-emerald-400/30">
                          <Award className="w-2.5 h-2.5" />
                          <span>Cert</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Hover Effect Overlay */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none"
                      animate={{
                        background: hoveredCard === pathway.id ? [
                          'linear-gradient(to top, rgba(6, 182, 212, 0.05), transparent)',
                          'linear-gradient(to top, rgba(139, 92, 246, 0.05), transparent)',
                          'linear-gradient(to top, rgba(6, 182, 212, 0.05), transparent)'
                        ] : []
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />

                    {/* Animated Border */}
                    <motion.div
                      className="absolute inset-0 rounded-3xl pointer-events-none"
                      style={{
                        background: `linear-gradient(45deg, transparent, transparent), linear-gradient(45deg, #06b6d4, #8b5cf6, #06b6d4)`,
                        backgroundSize: '400% 400%',
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        maskComposite: 'exclude',
                        padding: '1px'
                      }}
                      animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Enhanced Empty State */}
          {displayedPathways.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl mb-4"
              >
                🎯
              </motion.div>
              <div className="text-white text-xl mb-4">
                No pathways found for the selected level filter.
              </div>
              <motion.button
                onClick={() => handleLevelFilter('All')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300"
              >
                Show All Pathways
              </motion.button>
            </motion.div>
          )}

          {/* Cinematic Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="text-center mt-16"
          >
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl p-8 border border-cyan-500/20 shadow-2xl relative overflow-hidden backdrop-blur-md">
              {/* Animated Background */}
              <motion.div
                className="absolute inset-0"
                animate={{
                  background: [
                    'linear-gradient(45deg, rgba(6, 182, 212, 0.1), rgba(59, 130, 246, 0.1))',
                    'linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
                    'linear-gradient(45deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1))'
                  ]
                }}
                transition={{ duration: 5, repeat: Infinity }}
              />
              
              <div className="relative z-10">
                <motion.h3
                  className="text-3xl font-bold text-white mb-4"
                  animate={{ textShadow: ['0 0 20px rgba(255,255,255,0.5)', '0 0 30px rgba(255,255,255,0.8)', '0 0 20px rgba(255,255,255,0.5)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Ready to Start Your Journey?
                </motion.h3>
                <p className="text-gray-300 mb-6 max-w-2xl mx-auto text-lg">
                  Join over 50,000 learners who have transformed their careers with our structured learning paths.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.button 
                    onClick={handleViewAll}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative z-10">Browse All 12 Paths</span>
                  </motion.button>
                  <Link href="/auth/signup">
                    <motion.div
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-8 py-4 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-2xl font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:bg-white/20"
                    >
                      Start Free Trial
                    </motion.div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Custom Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.5); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-glow {
          animation: glow 3s ease-in-out infinite;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #06b6d4, #8b5cf6);
          border-radius: 10px;
        }
      `}</style>
    </section>
  )
}

// Icon Components
const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
)

const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const Award = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const TestimonialsSection: React.FC = () => {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // Auto-rotate testimonials
  useEffect(() => {
    if (!isAutoPlaying) return
    
    const interval = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % TESTIMONIALS.length)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [isAutoPlaying])

  // Enhanced animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12
      }
    }
  }

  const itemVariants = {
    hidden: { 
      opacity: 0,
      y: 20,
      scale: 0.97
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  }

  const floatingVariants = {
    float: {
      y: [-8, 8, -8],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  }

  return (
    <section className="relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 overflow-hidden py-16">
      {/* Enhanced Background Elements */}
      <div className="absolute inset-0">
        {/* Animated Gradient Orbs */}
        <motion.div
          className="absolute top-1/4 -left-10 w-80 h-80 bg-gradient-to-r from-blue-200/25 to-cyan-200/20 rounded-full blur-4xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, 20, 0]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-10 w-96 h-96 bg-gradient-to-r from-purple-200/20 to-pink-200/15 rounded-full blur-4xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.15, 0.3],
            y: [0, -15, 0]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Enhanced Floating Particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-r from-blue-400/15 to-purple-400/10"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, Math.random() * 20 - 10, 0],
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0]
            }}
            transition={{
              duration: Math.random() * 4 + 3,
              delay: Math.random() * 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}

        {/* Animated Grid Pattern */}
        <motion.div
          className="absolute inset-0 opacity-[0.015]"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%']
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            backgroundImage: `linear-gradient(to right, #3b82f6 1px, transparent 1px),
                             linear-gradient(to bottom, #3b82f6 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          viewport={{ once: true, margin: "-50px" }}
          className="text-center mb-16"
        >
          {/* Animated Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            whileInView={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.1, type: "spring" }}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-white/80 backdrop-blur-md border border-blue-200/60 shadow-lg shadow-blue-100/50 mb-6 relative overflow-hidden group cursor-pointer"
            whileHover={{ scale: 1.05, y: -2 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5 group-hover:from-blue-500/10 group-hover:via-purple-500/10 group-hover:to-cyan-500/10 transition-all duration-500"></div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mr-2"
            />
            <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Trusted by Thousands
            </span>
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full ml-2"
            />
          </motion.div>

          {/* Enhanced Main Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl lg:text-5xl font-bold text-gray-900 mb-4 tracking-tight"
          >
            Transformative{' '}
            <motion.span
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent relative"
              animate={{ backgroundPosition: ['0%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
              style={{ backgroundSize: '200% 100%' }}
            >
              Success Stories
              <motion.div
                className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              />
            </motion.span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed"
          >
            Join <span className="font-semibold text-blue-600 relative">
              12,000+
              <motion.span
                className="absolute -bottom-1 left-0 w-full h-0.5 bg-blue-600/20"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              />
            </span> learners who transformed their careers
          </motion.p>
        </motion.div>

        {/* Compact Testimonials Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-12"
        >
          {TESTIMONIALS.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              whileHover={{ 
                y: -6,
                scale: 1.02,
                transition: { duration: 0.3, ease: "easeOut" }
              }}
              className="group relative"
            >
              {/* Enhanced Background Glow */}
              <motion.div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                animate={{
                  background: [
                    'radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.1), transparent)',
                    'radial-gradient(circle at 70% 80%, rgba(168, 85, 247, 0.1), transparent)',
                  ]
                }}
                transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
              />
              
              {/* Compact Card */}
              <Card className="relative bg-white/90 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100/60 overflow-hidden h-full">
                {/* Enhanced Animated Header Bar */}
                <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 relative overflow-hidden">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
                    initial={{ x: '-100%' }}
                    whileInView={{ x: '100%' }}
                    transition={{ duration: 2, delay: index * 0.15, repeat: Infinity, repeatDelay: 5 }}
                  />
                </div>

                <div className="p-6">
                  {/* Compact Profile Section */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <motion.div
                        whileHover={{ scale: 1.05, rotate: 3 }}
                        className="relative"
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-md relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                          {testimonial.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        {/* Online Indicator */}
                        <motion.div
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </motion.div>

                      <div className="min-w-0 flex-1">
                        <motion.h3
                          className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300 truncate"
                          whileHover={{ x: 1 }}
                        >
                          {testimonial.name}
                        </motion.h3>
                      </div>
                    </div>

                    {/* Compact Company Logo */}
                    <motion.div
                      whileHover={{ scale: 1.05, rotate: 2 }}
                      className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center border border-gray-200 shadow-sm flex-shrink-0"
                    >
                      <Building className="w-4 h-4 text-gray-600" />
                    </motion.div>
                  </div>

                  {/* Compact Rating Stars */}
                  <motion.div
                    className="flex items-center space-x-0.5 mb-4"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.08 + 0.2 }}
                  >
                    {[...Array(5)].map((_, i) => (
                      <motion.svg
                        key={i}
                        className={`w-4 h-4 ${i < testimonial.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        whileHover={{ scale: 1.3, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400 }}
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </motion.svg>
                    ))}
                    <span className="ml-1.5 text-xs font-semibold text-gray-500">
                      {testimonial.rating}.0
                    </span>
                  </motion.div>

                  {/* Compact Testimonial Content */}
                  <motion.blockquote
                    className="text-gray-700 text-sm leading-relaxed mb-4 relative"
                    whileHover={{ x: 1 }}
                  >
                    <Quote className="w-5 h-5 text-blue-200 absolute -left-1 -top-1 transform -rotate-12" />
                    <span className="relative z-10 line-clamp-3">{testimonial.content}</span>
                    <Quote className="w-5 h-5 text-cyan-200 absolute -right-1 -bottom-1 transform rotate-12" />
                  </motion.blockquote>

                  {/* Compact Course Completion */}
                  <motion.div
                    className="flex items-center justify-between pt-4 border-t border-gray-100"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.08 + 0.3 }}
                  >
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-semibold text-gray-700">Completed:</span>
                      <span className="text-blue-600 font-medium text-xs truncate max-w-[100px]">{testimonial.course}</span>
                    </div>

                    {/* Compact Achievement Badge */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="flex items-center space-x-1 px-2 py-0.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 flex-shrink-0"
                    >
                      <Trophy className="w-2.5 h-2.5 text-green-600" />
                      <span className="text-xs font-semibold text-green-700">Top</span>
                    </motion.div>
                  </motion.div>

                  {/* Compact Progress Metrics */}
                  <motion.div
                    className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100"
                    initial={{ opacity: 0, y: 5 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.08 + 0.4 }}
                  >
                    {[
                      { value: '98%', label: 'Done', color: 'text-blue-600' },
                      { value: '4.2x', label: 'Speed', color: 'text-purple-600' },
                      { value: '12', label: 'Projects', color: 'text-green-600' }
                    ].map((metric, i) => (
                      <div key={metric.label} className="text-center">
                        <div className={`text-lg font-bold ${metric.color}`}>{metric.value}</div>
                        <div className="text-xs text-gray-500">{metric.label}</div>
                      </div>
                    ))}
                  </motion.div>
                </div>

                {/* Enhanced Hover Effect Overlay */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                  whileHover={{ opacity: 1 }}
                />
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Enhanced Compact Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          viewport={{ once: true }}
          className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100/60 p-8 mb-12 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"></div>
          <div className="relative z-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
              {[
                { number: '12K+', label: 'Students', icon: Users },
                { number: '94%', label: 'Completion', icon: Target },
                { number: '4.9/5', label: 'Rating', icon: Star },
                { number: '2.3x', label: 'Growth', icon: TrendingUp }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="group"
                >
                  <motion.div
                    className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white mx-auto mb-3 shadow-md relative overflow-hidden"
                    whileHover={{ scale: 1.08, rotate: 3 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                    <stat.icon className="w-5 h-5" />
                  </motion.div>
                  <motion.div
                    className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1"
                    whileHover={{ scale: 1.05 }}
                  >
                    {stat.number}
                  </motion.div>
                  <div className="text-gray-600 text-xs font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}

const CTASection: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [activeSpark, setActiveSpark] = useState(0)

  // Particle system for background
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 10 + 5,
    delay: Math.random() * 5
  }))

  // Floating elements data
  const floatingShapes = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    type: i % 3,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 40 + 20,
    duration: Math.random() * 8 + 4,
    delay: Math.random() * 3
  }))

  // Sparkle particles for buttons
  const sparkles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    duration: Math.random() * 2 + 1,
    delay: Math.random() * 1
  }))

  // Mouse move handler for parallax
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect()
    const x = ((clientX - left) / width) * 100
    const y = ((clientY - top) / height) * 100
    setMousePosition({ x, y })
  }

  // Spark animation interval
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSpark(prev => (prev + 1) % 5)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

   return (
    <section 
      className="relative min-h-[80vh] overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Advanced Background Layers */}
      <div className="absolute inset-0">
        {/* Animated Gradient Background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
          animate="animate"
          style={{
            backgroundSize: '200% 200%'
          }}
        />

        {/* Dynamic Grid Overlay */}
        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{
            backgroundPosition: ['0px 0px', '100px 100px']
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            backgroundImage: `
              linear-gradient(90deg, transparent 79px, #ffffff 79px, #ffffff 81px, transparent 81px),
              linear-gradient(transparent 79px, #ffffff 79px, #ffffff 81px, transparent 81px)
            `,
            backgroundSize: '100px 100px'
          }}
        />

        {/* Floating Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-white/20"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
            }}
            animate="float"
            custom={particle}
          />
        ))}

        {/* Animated Floating Shapes */}
        {floatingShapes.map((shape) => (
          <motion.div
            key={shape.id}
            className={`absolute opacity-10 ${
              shape.type === 0 ? 'bg-cyan-400 rounded-full' : 
              shape.type === 1 ? 'bg-purple-400 rounded-lg' : 
              'bg-blue-400 rotate-45'
            }`}
            style={{
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              width: `${shape.size}px`,
              height: `${shape.size}px`,
            }}
            animate="float"
            custom={shape}
          />
        ))}

        {/* Interactive Light Orbs */}
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-cyan-400/10 blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            left: '10%',
            top: '20%'
          }}
        />
        
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-purple-400/10 blur-3xl"
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
            scale: [1.2, 1, 1.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            right: '15%',
            bottom: '30%'
          }}
        />

        {/* Mouse Following Spotlight */}
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none"
          animate={{
            x: mousePosition.x - 25,
            y: mousePosition.y - 25,
          }}
          transition={{
            type: "spring",
            stiffness: 50,
            damping: 20
          }}
          style={{
            left: `${mousePosition.x}%`,
            top: `${mousePosition.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        />

        {/* Animated Ripple Effects */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-x-0 mx-auto w-1 h-1 bg-white/30 rounded-full"
              initial="initial"
              animate="animate"
              transition={{
                delay: i * 0.6,
                repeat: Infinity,
                repeatDelay: 3
              }}
              style={{
                top: '50%'
              }}
            />
          ))}
        </motion.div>

        {/* Animated Noise Texture */}
        <motion.div
          className="absolute inset-0 opacity-5"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%']
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px'
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center min-h-[80vh] flex items-center justify-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="w-full"
        >
          {/* Enhanced Title with Multiple Animation Layers */}
          <div className="relative mb-8">
            {/* Title Shadow/Glow Effect */}
            <motion.div
              className="absolute inset-0 blur-2xl opacity-30"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 0.3, scale: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              <h2 className="text-5xl lg:text-7xl font-bold text-white">
                Ready to Start Your Learning Journey?
              </h2>
            </motion.div>

            {/* Main Title */}
            <motion.h2 
              className="text-4xl lg:text-6xl font-bold text-white mb-6 relative"
            >
              {/* Animated Gradient Text */}
              <motion.span
                className="bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear"
                }}
                style={{
                  backgroundSize: '200% 100%'
                }}
              >
                Ready to Start
              </motion.span>
              
              <br />
              
              <motion.span
                className="bg-gradient-to-r from-cyan-200 via-white to-purple-200 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ['100% 50%', '0% 50%', '100% 50%']
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear",
                  delay: 0.5
                }}
                style={{
                  backgroundSize: '200% 100%'
                }}
              >
                Your Learning Journey?
              </motion.span>

              {/* Animated Underline */}
              <motion.div
                className="absolute bottom-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                transition={{ duration: 1, delay: 1 }}
              />
            </motion.h2>

            {/* Floating Accent Elements */}
            <motion.div
              className="absolute -top-4 -left-4 w-8 h-8 bg-cyan-400 rounded-full blur-sm"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute -bottom-4 -right-4 w-6 h-6 bg-purple-400 rounded-full blur-sm"
              animate={{
                scale: [1.5, 1, 1.5],
                opacity: [1, 0.5, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            />
          </div>

          {/* Enhanced Description Text */}
          <motion.div className="relative mb-12">
            <motion.p 
              className="text-xl lg:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed"
            >
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Join thousands of learners building in-demand skills with our{' '}
              <motion.span
                className="font-semibold bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent"
                animate={{ 
                  textShadow: [
                    '0 0 0px rgba(34, 211, 238, 0)',
                    '0 0 20px rgba(34, 211, 238, 0.5)',
                    '0 0 0px rgba(34, 211, 238, 0)'
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                AI-powered platform
              </motion.span>
              . Start for free and transform your career today.
            </motion.span>
            </motion.p>
          </motion.div>

          {/* Enhanced CTA Buttons Container */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12 relative"
          >
            {/* Primary Button with Advanced Effects */}
            <motion.div
              whileHover="hover"
              whileTap="tap"
              className="relative group"
            >
              {/* Button Glow Effect */}
              <motion.div
                className="absolute inset-0 bg-cyan-400 rounded-2xl blur-xl opacity-0 group-hover:opacity-50"
                animate={{
                  scale: [1, 1.2, 1],
                opacity: [0, 0.3, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity
                }}
              />

              {/* Main Button */}
              <a
                href="/auth/signup"
                className="relative inline-block px-12 py-4 rounded-2xl bg-white text-blue-600 font-bold text-lg overflow-hidden group"
              >
                {/* Animated Background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-white to-cyan-50"
                  whileHover={{
                    scale: 1.1,
                    transition: { duration: 0.3 }
                  }}
                />

                {/* Sparkle Particles */}
                {sparkles.map((sparkle) => (
                  <motion.div
                    key={sparkle.id}
                    className="absolute rounded-full bg-cyan-400/80"
                    style={{
                      left: `${sparkle.x}%`,
                      top: `${sparkle.y}%`,
                      width: `${sparkle.size}px`,
                      height: `${sparkle.size}px`,
                    }}
                    initial="initial"
                    animate="animate"
                    custom={sparkle.id}
                  />
                ))}

                {/* Hover Shine Effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '200%' }}
                  transition={{ duration: 0.8 }}
                />

                {/* Button Text */}
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  <motion.span
                    animate={{ x: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    🚀
                  </motion.span>
                  <span>Get Started Free</span>
                  <motion.span
                    animate={{ x: [0, 2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                  >
                    →
                  </motion.span>
                </span>
              </a>
            </motion.div>

            {/* Secondary Button with Enhanced Effects */}
            <motion.div
              whileHover="hover"
              whileTap="tap"
              className="relative group"
            >
              {/* Border Glow Effect */}
              <motion.div
                className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-400 p-0.5"
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity
                }}
              >
                <div className="w-full h-full rounded-2xl bg-transparent backdrop-blur-sm" />
              </motion.div>

              <a
                href="/learn/courses"
                className="relative inline-block px-12 py-4 rounded-2xl bg-transparent border-2 border-white text-white font-bold text-lg overflow-hidden group"
              >
                {/* Hover Fill Effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />

                {/* Animated Border */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(90deg, #22d3ee, #a855f7, #22d3ee)',
                    backgroundSize: '200% 100%'
                  }}
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 0%']
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                >
                  <div className="absolute inset-0.5 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700" />
                </motion.div>

                <span className="relative z-10 flex items-center from-slate-900 via-purple-900 to-slate-900 justify-center space-x-2">
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    📚
                  </motion.span>
                  <span>Browse Courses</span>
                </span>
              </a>
            </motion.div>
          </motion.div>

          {/* Enhanced Footer Text with Micro-Interactions */}
          <motion.div 
            className="text-blue-100/80 text-base relative"
          >
            {/* Animated Bullet Points */}
            <motion.div 
              className="flex items-center justify-center space-x-8 mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {[
                { icon: '💳', text: 'No credit card required' },
                { icon: '📅', text: '14-day free trial' },
                { icon: '⏹️', text: 'Cancel anytime' }
              ].map((item, index) => (
                <motion.div
                  key={item.text}
                  className="flex items-center space-x-2"
                  whileHover={{ scale: 1.05, y: -2 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <motion.span
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.5
                    }}
                  >
                    {item.icon}
                  </motion.span>
                  <span className="text-sm font-medium">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* Progress Indicator */}
            <motion.div
              className="w-32 h-1 bg-white/20 rounded-full mx-auto overflow-hidden"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                initial={{ width: '0%' }}
                whileInView={{ width: '100%' }}
                transition={{ duration: 2, delay: 0.8 }}
              />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Additional Ambient Effects */}
        <motion.div
          className="absolute bottom-8 left-8 text-blue-200/40 text-sm"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <div className="flex items-center space-x-2">
            <motion.div
              className="w-2 h-2 bg-cyan-400 rounded-full"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span>Live</span>
          </div>
        </motion.div>
      </div>

      {/* Interactive Background Canvas for Additional Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Pulsing Rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 border-2 border-cyan-400/20 rounded-3xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: [0, 0.3, 0] }}
            transition={{
              duration: 4,
              delay: i * 1.5,
              repeat: Infinity,
              ease: "easeOut"
            }}
          />
        ))}

        {/* Corner Accents */}
        <motion.div
          className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-cyan-400/30"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-purple-400/30"
          animate={{ opacity: [0.7, 0.3, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1 }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-cyan-400/30"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: 2 }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-purple-400/30"
          animate={{ opacity: [0.8, 0.4, 0.8] }}
          transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
        />
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
        
        {/* Learning Modules */}
        <LearningModules />
        
        {/* Learning Pathways */}
        <LearningPathways />
        
        {/* Testimonials */}
        <TestimonialsSection />
        
        {/* Final CTA */}
        <CTASection />

        <Footer />
      </main>
    </>
  )
}