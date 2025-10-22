// /src/app/demo/page.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Import components
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

// Enhanced TypeScript interfaces with comprehensive typing
interface FormData {
  // Personal Information
  name: string;
  email: string;
  phone: string;
  company: string;
  companySize: string;
  industry: string;
  role: string;
  department: string;
  jobTitle: string;
  companyName: string;
  website: string;
  
  // Scheduling Details
  date: string;
  time: string;
  duration: string;
  timezone: string;
  attendees: number;
  attendeeDetails: AttendeeDetail[];
  
  // Technical Requirements
  integrationRequirements: string[];
  currentTools: string[];
  technicalEnvironment: string;
  securityRequirements: string[];
  complianceNeeds: string[];
  
  // Business Context
  useCase: string;
  businessGoals: string[];
  challenges: string[];
  budgetTimeline: string;
  decisionMakers: string[];
  
  // Demo Customization
  productInterest: string[];
  demoFocusAreas: string[];
  customRequirements: string;
  successMetrics: string[];
  
  // Additional Information
  notes: string;
  urgency: string;
  referralSource: string;
  communicationPreference: string;
  followUpTiming: string;
  
  // System Information
  preferredLanguage: string;
  accessibilityNeeds: string[];
  recordingConsent: boolean;
  marketingConsent: boolean;
}

interface AttendeeDetail {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  isDecisionMaker: boolean;
}

interface FormErrors {
  [key: string]: string | undefined;
}

interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message: string;
}

interface Feature {
  id: number;
  icon: string;
  title: string;
  description: string;
  category: string;
  detailedDescription: string;
  benefits: string[];
  useCases: string[];
  integrationPartners: string[];
  technicalSpecs: TechnicalSpec[];
  demoVideo?: string;
  caseStudy?: string;
  popularity: number;
  implementationTime: string;
  supportLevel: string;
}

interface TechnicalSpec {
  name: string;
  value: string;
  icon: string;
  description: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  bookedBy?: string;
  recommended: boolean;
  popularity: number;
}

interface CalendarDay {
  date: string;
  available: boolean;
  slots: TimeSlot[];
  isToday: boolean;
  isSelected: boolean;
  isPopular: boolean;
}

// NEW: Enhanced interfaces for advanced features
interface AnimationState {
  isPlaying: boolean;
  progress: number;
  type: string;
}

interface UserPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  language: string;
  timezone: string;
}

interface AnalyticsEvent {
  type: string;
  timestamp: Date;
  data: any;
}

// NEW: Advanced calendar interfaces
interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  endDate?: string;
  exceptions: string[];
}

interface SchedulingRule {
  minNotice: number; // minutes
  maxAdvance: number; // days
  durationOptions: number[];
  blackoutPeriods: Array<{ start: string; end: string }>;
}

// Enhanced main component with additional state and features
export default function ScheduleDemo() {
  // Comprehensive state management
  const [activeTab, setActiveTab] = useState('all');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<CalendarDay[]>([]);
  const [recommendedTimes, setRecommendedTimes] = useState<string[]>([]);
  const [timezoneSuggestions, setTimezoneSuggestions] = useState<string[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const [formProgress, setFormProgress] = useState(0);

  // NEW: Advanced state management
  const [animationStates, setAnimationStates] = useState<Map<string, AnimationState>>(new Map());
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    reducedMotion: false,
    highContrast: false,
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [gestureStart, setGestureStart] = useState<{ x: number; y: number } | null>(null);

  // Enhanced form state with comprehensive data structure
  const [formData, setFormData] = useState<FormData>({
    // Personal Information
    name: '',
    email: '',
    phone: '',
    company: '',
    companySize: '',
    industry: '',
    role: '',
    department: '',
    jobTitle: '',
    companyName: '',
    website: '',
    
    // Scheduling Details
    date: '',
    time: '',
    duration: '30',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    attendees: 1,
    attendeeDetails: [{
      id: '1',
      name: '',
      email: '',
      role: '',
      department: '',
      isDecisionMaker: false
    }],
    
    // Technical Requirements
    integrationRequirements: [],
    currentTools: [],
    technicalEnvironment: '',
    securityRequirements: [],
    complianceNeeds: [],
    
    // Business Context
    useCase: '',
    businessGoals: [],
    challenges: [],
    budgetTimeline: '',
    decisionMakers: [],
    
    // Demo Customization
    productInterest: [],
    demoFocusAreas: [],
    customRequirements: '',
    successMetrics: [],
    
    // Additional Information
    notes: '',
    urgency: 'normal',
    referralSource: '',
    communicationPreference: 'email',
    followUpTiming: '24_hours',
    
    // System Information
    preferredLanguage: 'en',
    accessibilityNeeds: [],
    recordingConsent: false,
    marketingConsent: false
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [visitedSteps, setVisitedSteps] = useState<number[]>([1]);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // NEW: Advanced state for enhanced features
  const [schedulingRules, setSchedulingRules] = useState<SchedulingRule>({
    minNotice: 30,
    maxAdvance: 90,
    durationOptions: [15, 30, 45, 60],
    blackoutPeriods: []
  });
  
  const [recurringPattern, setRecurringPattern] = useState<RecurringPattern | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [realTimeValidation, setRealTimeValidation] = useState<Map<string, boolean>>(new Map());
  
  // Refs for scroll management and animations
  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  // NEW: Advanced refs for enhanced interactions
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const particlesRef = useRef<any[]>([]);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const gestureAreaRef = useRef<HTMLDivElement | null>(null);

  // Enhanced validation rules with comprehensive coverage
  const validationRules: { [key: string]: ValidationRule } = {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      message: 'Full name must be between 2 and 100 characters'
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Please enter a valid email address'
    },
    company: {
      required: true,
      minLength: 1,
      maxLength: 200,
      message: 'Company name is required'
    },
    role: {
      required: true,
      message: 'Please select your role'
    },
    date: {
      required: true,
      message: 'Please select a date for your demo'
    },
    time: {
      required: true,
      message: 'Please select a time for your demo'
    },
    attendees: {
      required: true,
      custom: (value) => value > 0 && value <= 20,
      message: 'Number of attendees must be between 1 and 20'
    },
    jobTitle: {
      required: true,
      message: 'Job title is required'
    },
    companyName: {
      required: true,
      message: 'Company name is required'
    },
    industry: {
      required: true,
      message: 'Please select your industry'
    },
    companySize: {
      required: true,
      message: 'Please select company size'
    }
  };

  // NEW: Advanced utility functions
  /**
   * Generates a sophisticated particle system for background animations
   */
  const initializeParticleSystem = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Initialize particles
    particlesRef.current = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1,
      color: `rgba(99, 102, 241, ${Math.random() * 0.3 + 0.1})`
    }));

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle, index) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off edges
        if (particle.x <= 0 || particle.x >= canvas.width) particle.vx *= -1;
        if (particle.y <= 0 || particle.y >= canvas.height) particle.vy *= -1;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();

        // Draw connections
        particlesRef.current.forEach((otherParticle, otherIndex) => {
          if (index >= otherIndex) return;

          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.2 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
          }
        });
      });

      if (!userPreferences.reducedMotion) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [userPreferences.reducedMotion]);

  /**
   * Tracks analytics events for user interactions
   */
  const trackAnalyticsEvent = useCallback((type: string, data?: any) => {
    const event: AnalyticsEvent = {
      type,
      timestamp: new Date(),
      data
    };
    setAnalyticsEvents(prev => [...prev, event]);
    
    // In a real app, send to analytics service
    console.log('Analytics Event:', event);
  }, []);

  /**
   * AI-powered field suggestions based on user input
   */
  const getAISuggestions = useCallback(async (field: string, value: string) => {
    // Simulate AI API call
    const suggestions: { [key: string]: string[] } = {
      industry: ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing'],
      role: ['Executive', 'Manager', 'Individual Contributor', 'IT Professional'],
      companySize: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']
    };

    await new Promise(resolve => setTimeout(resolve, 500));
    return suggestions[field]?.filter(item => 
      item.toLowerCase().includes(value.toLowerCase())
    ) || [];
  }, []);

  /**
   * Advanced timezone detection and suggestions
   */
  const detectOptimalTimezone = useCallback(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const commonTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Australia/Sydney'
    ];

    // Suggest timezones based on user's location and common business zones
    const suggestions = commonTimezones.filter(tz => tz !== userTimezone);
    setTimezoneSuggestions([userTimezone, ...suggestions.slice(0, 3)]);
  }, []);

  // Enhanced handler functions with advanced features
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      };
      
      // Calculate form progress
      const filledFields = Object.values(newData).filter(val => 
        val !== '' && 
        val !== null && 
        val !== undefined && 
        (typeof val !== 'object' || (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0))
      ).length;
      const totalFields = Object.keys(newData).length;
      setFormProgress(Math.round((filledFields / totalFields) * 100));

      // Auto-save functionality
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      const timer = setTimeout(() => {
        localStorage.setItem('demoFormData', JSON.stringify(newData));
      }, 1000);
      setAutoSaveTimer(timer);
      
      return newData;
    });
    
    // Real-time validation
    if (validationRules[name]) {
      validateField(name, value);
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }

    // Track analytics
    trackAnalyticsEvent('form_field_change', { field: name, value });
  }, [errors, autoSaveTimer, trackAnalyticsEvent]);

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: checked 
        ? [...(prev[name as keyof FormData] as string[]), value]
        : (prev[name as keyof FormData] as string[]).filter(item => item !== value)
    }));

    trackAnalyticsEvent('checkbox_toggle', { field: name, value, checked });
  }, [trackAnalyticsEvent]);

  const handleAttendeeChange = useCallback((index: number, field: string, value: string) => {
    setFormData(prev => {
      const updatedAttendees = [...prev.attendeeDetails];
      updatedAttendees[index] = {
        ...updatedAttendees[index],
        [field]: value
      };
      return { ...prev, attendeeDetails: updatedAttendees };
    });
  }, []);

  const addAttendee = useCallback(() => {
    if (formData.attendeeDetails.length < 10) {
      setFormData(prev => ({
        ...prev,
        attendeeDetails: [
          ...prev.attendeeDetails,
          {
            id: Date.now().toString(),
            name: '',
            email: '',
            role: '',
            department: '',
            isDecisionMaker: false
          }
        ],
        attendees: prev.attendees + 1
      }));
      trackAnalyticsEvent('attendee_added');
    }
  }, [formData.attendeeDetails.length, trackAnalyticsEvent]);

  const removeAttendee = useCallback((index: number) => {
    if (formData.attendeeDetails.length > 1) {
      setFormData(prev => ({
        ...prev,
        attendeeDetails: prev.attendeeDetails.filter((_, i) => i !== index),
        attendees: prev.attendees - 1
      }));
      trackAnalyticsEvent('attendee_removed');
    }
  }, [formData.attendeeDetails.length, trackAnalyticsEvent]);

    // Advanced validation system
  const validateField = useCallback((fieldName: string, value: any): boolean => {
    const rule = validationRules[fieldName];
    if (!rule) return true;

    let isValid = true;

    if (rule.required && (!value || value.toString().trim() === '')) {
      isValid = false;
    } else if (rule.minLength && value.length < rule.minLength) {
      isValid = false;
    } else if (rule.maxLength && value.length > rule.maxLength) {
      isValid = false;
    } else if (rule.pattern && !rule.pattern.test(value)) {
      isValid = false;
    } else if (rule.custom && !rule.custom(value)) {
      isValid = false;
    }

    if (!isValid) {
      setErrors(prev => ({ ...prev, [fieldName]: rule.message }));
    } else {
      setErrors(prev => ({ ...prev, [fieldName]: undefined }));
    }

    // Update real-time validation state
    setRealTimeValidation(prev => new Map(prev.set(fieldName, isValid)));

    return isValid;
  }, [validationRules]);


  const validateStep = useCallback((step: number): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    switch (step) {
      case 1:
        ['name', 'email', 'jobTitle'].forEach(field => {
          if (!validateField(field, formData[field as keyof FormData])) {
            isValid = false;
          }
        });
        break;
      
      case 2:
        ['companyName', 'industry', 'companySize'].forEach(field => {
          if (!validateField(field, formData[field as keyof FormData])) {
            isValid = false;
          }
        });
        break;
      
      case 3:
        ['date', 'time', 'attendees'].forEach(field => {
          if (!validateField(field, formData[field as keyof FormData])) {
            isValid = false;
          }
        });
        break;
      
      case 4:
        if (!formData.useCase) {
          newErrors.useCase = 'Please describe your primary use case';
          isValid = false;
        }
        if (formData.businessGoals.length === 0) {
          newErrors.businessGoals = 'Please select at least one business goal';
          isValid = false;
        }
        break;
      
      case 5:
        // Technical requirements validation
        if (formData.integrationRequirements.length === 0) {
          newErrors.integrationRequirements = 'Please select at least one integration requirement';
          isValid = false;
        }
        break;
      
      case 6:
        // Final review - comprehensive validation
        Object.keys(validationRules).forEach(field => {
          if (!validateField(field, formData[field as keyof FormData])) {
            isValid = false;
          }
        });
        break;
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return isValid;
  }, [formData, validateField]);

    const handleStepContinue = useCallback((nextStep: number) => {
    if (validateStep(currentStep)) {
      setCurrentStep(nextStep);
      setVisitedSteps(prev => [...prev, nextStep]);
      trackAnalyticsEvent('form_step_completed', { from: currentStep, to: nextStep });
      
      // Scroll to top of form section
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [currentStep, validateStep, trackAnalyticsEvent]);

  const handleStepBack = useCallback((prevStep: number) => {
    setCurrentStep(prevStep);
    trackAnalyticsEvent('form_step_back', { from: currentStep, to: prevStep });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [currentStep, trackAnalyticsEvent]);

  // NEW: Advanced gesture handlers
  const handleGestureStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e ? e.touches[0] : e;
    setGestureStart({ x: point.clientX, y: point.clientY });
  }, []);

  const handleGestureEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!gestureStart) return;

    const point = 'touches' in e ? e.changedTouches[0] : e;
    const deltaX = point.clientX - gestureStart.x;
    const deltaY = point.clientY - gestureStart.y;

    // Swipe detection
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 30) {
      if (deltaX > 0) {
        // Swipe right - go to previous step
        if (currentStep > 1) {
          handleStepBack(currentStep - 1);
          trackAnalyticsEvent('swipe_navigation', { direction: 'previous', step: currentStep });
        }
      } else {
        // Swipe left - go to next step
        if (currentStep < 6) {
          handleStepContinue(currentStep + 1);
          trackAnalyticsEvent('swipe_navigation', { direction: 'next', step: currentStep });
        }
      }
    }

    setGestureStart(null);
  }, [gestureStart, currentStep, handleStepBack, handleStepContinue, trackAnalyticsEvent]);


  // Enhanced submission handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) {
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    setIsSubmitting(true);
    trackAnalyticsEvent('form_submission_started');
    
    try {
      // Simulate comprehensive API call with multiple steps
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Clear saved form data
      localStorage.removeItem('demoFormData');
      
      setSubmitted(true);
      setShowSuccessAnimation(true);
      trackAnalyticsEvent('form_submission_success');
      
      if (successRef.current) {
        successRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      
      // Reset animation after delay
      setTimeout(() => setShowSuccessAnimation(false), 5000);
    } catch (error) {
      console.error('Submission error:', error);
      setErrors(prev => ({ ...prev, submit: 'Failed to schedule demo. Please try again.' }));
      trackAnalyticsEvent('form_submission_failed', { error });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, validateStep, trackAnalyticsEvent]);

  // NEW: Advanced effect hooks
  useEffect(() => {
    // Initialize particle system
    const cleanup = initializeParticleSystem();
    
    // Detect optimal timezone
    detectOptimalTimezone();
    
    // Set up online/offline detection
    const handleOnline = () => {
      setIsOnline(true);
      trackAnalyticsEvent('connection_restored');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      trackAnalyticsEvent('connection_lost');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Set up intersection observer for animations
    intersectionObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            trackAnalyticsEvent('section_view', { section: entry.target.id });
          }
        });
      },
      { threshold: 0.3 }
    );
    
    // Observe sections
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
      intersectionObserverRef.current?.observe(section);
    });
    
    return () => {
      cleanup?.();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      intersectionObserverRef.current?.disconnect();
    };
  }, [initializeParticleSystem, detectOptimalTimezone, trackAnalyticsEvent]);

  // Load saved form data
  useEffect(() => {
    const savedData = localStorage.getItem('demoFormData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsedData }));
        
        // Calculate initial progress
        const filledFields = Object.values(parsedData).filter(val => 
          val !== '' && 
          val !== null && 
          val !== undefined && 
          (typeof val !== 'object' || (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0))
        ).length;
        const totalFields = Object.keys(parsedData).length;
        setFormProgress(Math.round((filledFields / totalFields) * 100));
        
        trackAnalyticsEvent('form_data_restored');
      } catch (error) {
        console.error('Error loading saved form data:', error);
        trackAnalyticsEvent('form_restore_failed', { error });
      }
    }
  }, [trackAnalyticsEvent]);

  // Scroll detection for navbar effects
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Enhanced feature data with comprehensive details
  const features: Feature[] = [
    {
      id: 1,
      icon: '📅',
      title: 'AI-Powered Smart Scheduling',
      description: 'Intelligent scheduling that learns preferences and optimizes meeting times automatically',
      category: 'scheduling',
      detailedDescription: 'Our advanced AI algorithms analyze participant preferences, historical meeting data, and organizational patterns to suggest optimal meeting times that maximize attendance and productivity.',
      benefits: [
        'Reduces scheduling conflicts by 85%',
        'Saves average 4 hours per week per employee',
        'Increases meeting attendance by 40%',
        'Automatically handles timezone conversions',
        'Predicts optimal meeting durations',
        'Integrates with existing calendar systems'
      ],
      useCases: [
        'Enterprise sales demos',
        'Cross-departmental planning',
        'Client onboarding sessions',
        'Team stand-up meetings',
        'Board meetings',
        'Customer success check-ins'
      ],
      integrationPartners: ['Google Calendar', 'Microsoft Outlook', 'Slack', 'Salesforce', 'Zoom', 'Teams'],
      technicalSpecs: [
        { name: 'Processing Speed', value: '< 100ms', icon: '⚡', description: 'AI recommendation generation' },
        { name: 'Accuracy Rate', value: '98.7%', icon: '🎯', description: 'Scheduling conflict prevention' },
        { name: 'Supported Calendars', value: '25+', icon: '📚', description: 'Platform integrations' },
        { name: 'API Response Time', value: '< 50ms', icon: '🚀', description: 'Real-time availability checks' }
      ],
      demoVideo: '/demos/smart-scheduling.mp4',
      caseStudy: '/case-studies/enterprise-scheduling',
      popularity: 95,
      implementationTime: '24 hours',
      supportLevel: '24/7 Premium'
    },
    {
      id: 2,
      icon: '🔄',
      title: 'Advanced Workflow Automation',
      description: 'Automate complex scheduling workflows with conditional logic and multi-step approvals',
      category: 'automation',
      detailedDescription: 'Create sophisticated scheduling workflows that automatically route requests, handle approvals, and manage exceptions without manual intervention.',
      benefits: [
        'Reduces manual work by 90%',
        'Accelerates scheduling process by 5x',
        'Eliminates human error in complex workflows',
        'Provides full audit trail for compliance',
        'Scales to handle enterprise-level volume',
        'Integrates with existing HR and ERP systems'
      ],
      useCases: [
        'Enterprise resource scheduling',
        'Multi-location team coordination',
        'Client service delivery scheduling',
        'Equipment and facility booking',
        'Interview and recruitment coordination',
        'Project milestone planning'
      ],
      integrationPartners: ['Workday', 'ServiceNow', 'Jira', 'Asana', 'Salesforce', 'SAP'],
      technicalSpecs: [
        { name: 'Workflow Complexity', value: 'Unlimited', icon: '🏗️', description: 'Nested conditional logic support' },
        { name: 'Approval Chains', value: '20+ levels', icon: '⛓️', description: 'Multi-level approval workflows' },
        { name: 'Automation Rules', value: '1000+', icon: '🤖', description: 'Concurrent automation capacity' },
        { name: 'Processing Time', value: '< 200ms', icon: '⚡', description: 'Workflow execution speed' }
      ],
      popularity: 88,
      implementationTime: '48 hours',
      supportLevel: '24/7 Enterprise'
    },
    {
      id: 3,
      icon: '📊',
      title: 'Real-Time Analytics Dashboard',
      description: 'Comprehensive analytics and insights into scheduling efficiency and resource utilization',
      category: 'analytics',
      detailedDescription: 'Gain deep visibility into your scheduling operations with real-time dashboards, predictive analytics, and customizable reporting that drives data-informed decisions.',
      benefits: [
        'Identifies scheduling bottlenecks instantly',
        'Predicts future capacity requirements',
        'Optimizes resource allocation automatically',
        'Provides executive-level reporting',
        'Tracks ROI and efficiency metrics',
        'Supports compliance and audit requirements'
      ],
      useCases: [
        'Capacity planning and forecasting',
        'Resource utilization optimization',
        'Scheduling performance monitoring',
        'Executive reporting and dashboards',
        'Compliance and audit reporting',
        'Cost optimization and analysis'
      ],
      integrationPartners: ['Tableau', 'Power BI', 'Google Data Studio', 'Snowflake', 'Redshift', 'BigQuery'],
      technicalSpecs: [
        { name: 'Data Points', value: '10M+/day', icon: '📈', description: 'Real-time data processing capacity' },
        { name: 'Report Generation', value: '< 2s', icon: '🚀', description: 'Complex report rendering time' },
        { name: 'Data Sources', value: '50+', icon: '🔗', description: 'Supported integration endpoints' },
        { name: 'Custom Metrics', value: 'Unlimited', icon: '🎯', description: 'User-defined KPI tracking' }
      ],
      popularity: 92,
      implementationTime: '72 hours',
      supportLevel: '24/7 Business'
    },
    {
      id: 4,
      icon: '🔒',
      title: 'Enterprise-Grade Security',
      description: 'Military-grade security with end-to-end encryption and compliance certifications',
      category: 'security',
      detailedDescription: 'Protect your sensitive scheduling data with enterprise-grade security features including end-to-end encryption, advanced access controls, and comprehensive compliance frameworks.',
      benefits: [
        'End-to-end encryption for all data',
        'SOC 2 Type II and ISO 27001 certified',
        'GDPR and CCPA compliant by design',
        'Advanced threat detection and prevention',
        'Real-time security monitoring',
        'Comprehensive audit logging'
      ],
      useCases: [
        'Healthcare patient scheduling',
        'Financial services meeting coordination',
        'Government agency resource planning',
        'Legal case management scheduling',
        'Enterprise executive protection',
        'Regulated industry compliance'
      ],
      integrationPartners: ['Okta', 'Azure AD', 'Ping Identity', 'Duo', 'CrowdStrike', 'Splunk'],
      technicalSpecs: [
        { name: 'Encryption', value: 'AES-256', icon: '🔐', description: 'Military-grade encryption standard' },
        { name: 'Certifications', value: '15+', icon: '🏅', description: 'Security and compliance certs' },
        { name: 'Audit Logs', value: '7 years', icon: '📝', description: 'Compliant retention period' },
        { name: 'Access Controls', value: 'RBAC/ABAC', icon: '👥', description: 'Advanced permission models' }
      ],
      popularity: 97,
      implementationTime: '24 hours',
      supportLevel: '24/7 Security'
    },
    {
      id: 5,
      icon: '🌐',
      title: 'Global Scale Infrastructure',
      description: 'Multi-region deployment with 99.99% uptime SLA and global CDN acceleration',
      category: 'infrastructure',
      detailedDescription: 'Our globally distributed infrastructure ensures lightning-fast performance and unmatched reliability with automatic failover, load balancing, and real-time synchronization across regions.',
      benefits: [
        '99.99% uptime SLA guarantee',
        'Global low-latency performance',
        'Automatic disaster recovery',
        'Real-time cross-region sync',
        'Unlimited scalability',
        'Predictable performance under load'
      ],
      useCases: [
        'Global enterprise deployments',
        'High-volume scheduling operations',
        'Mission-critical business applications',
        'Multi-national team coordination',
        'Disaster recovery scenarios',
        'Peak load handling'
      ],
      integrationPartners: ['AWS', 'Google Cloud', 'Azure', 'Cloudflare', 'Fastly', 'Akamai'],
      technicalSpecs: [
        { name: 'Uptime SLA', value: '99.99%', icon: '🔄', description: 'Enterprise service level agreement' },
        { name: 'Data Centers', value: '15+', icon: '🏢', description: 'Global deployment regions' },
        { name: 'Response Time', value: '< 100ms', icon: '⚡', description: 'Global average latency' },
        { name: 'Concurrent Users', value: '1M+', icon: '👥', description: 'Supported user capacity' }
      ],
      popularity: 94,
      implementationTime: '48 hours',
      supportLevel: '24/7 Infrastructure'
    },
    {
      id: 6,
      icon: '🤝',
      title: 'Advanced Collaboration Tools',
      description: 'Real-time collaboration features with comments, mentions, and shared availability',
      category: 'collaboration',
      detailedDescription: 'Enable seamless team collaboration with real-time updates, intelligent notifications, shared resource management, and contextual communication tools built directly into the scheduling workflow.',
      benefits: [
        'Reduces meeting coordination time by 70%',
        'Improves team alignment and visibility',
        'Streamlines cross-functional planning',
        'Provides context-aware notifications',
        'Supports asynchronous collaboration',
        'Integrates with team communication tools'
      ],
      useCases: [
        'Project team coordination',
        'Sales team territory planning',
        'Marketing campaign scheduling',
        'Product development planning',
        'Executive assistant coordination',
        'Client services team management'
      ],
      integrationPartners: ['Slack', 'Microsoft Teams', 'Zoom', 'Webex', 'Notion', 'Confluence'],
      technicalSpecs: [
        { name: 'Real-time Sync', value: '< 500ms', icon: '🔄', description: 'Cross-user state synchronization' },
        { name: 'Collaboration Features', value: '25+', icon: '🤝', description: 'Integrated collaboration tools' },
        { name: 'Notification Channels', value: '10+', icon: '🔔', description: 'Multi-channel alert system' },
        { name: 'Team Size', value: 'Unlimited', icon: '👥', description: 'Scalable team management' }
      ],
      popularity: 89,
      implementationTime: '24 hours',
      supportLevel: '24/7 Collaboration'
    }
  ];

  // NEW: Advanced utility components
  /**
   * Enhanced Loading Spinner with sophisticated animations
   */
  const LoadingSpinner = ({ size = 'medium', message = 'Loading...' }: { size?: 'small' | 'medium' | 'large'; message?: string }) => (
    <div className={`flex flex-col items-center justify-center p-8 ${size === 'large' ? 'min-h-[200px]' : ''}`}>
      <div className={`
        relative
        ${size === 'small' ? 'w-6 h-6' : size === 'medium' ? 'w-12 h-12' : 'w-16 h-16'}
        animate-spin
      `}>
        <div className="absolute inset-0 rounded-full border-2 border-gray-200"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-600"></div>
      </div>
      {message && (
        <p className="mt-4 text-sm text-gray-600 font-medium">{message}</p>
      )}
    </div>
  );

  /**
   * Advanced Success Animation Component
   */
  const SuccessAnimation = ({ isVisible }: { isVisible: boolean }) => {
    if (!isVisible) return null;
    
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Demo Scheduled Successfully!</h3>
          <p className="text-gray-600 mb-4">
            We've sent a confirmation email with all the details. Our team is looking forward to connecting with you.
          </p>
          <button
            onClick={() => setShowSuccessAnimation(false)}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Continue Exploring
          </button>
        </div>
      </div>
    );
  };

  /**
   * Enhanced Feature Card with interactive elements
   */
  const FeatureCard = ({ feature, index }: { feature: Feature; index: number }) => (
    <div
      className={`
        bg-white rounded-xl shadow-lg p-6 border border-gray-200 transition-all duration-300
        hover:shadow-xl hover:scale-105 hover:border-indigo-300
        ${hoveredFeature === feature.id ? 'ring-2 ring-indigo-500' : ''}
      `}
      onMouseEnter={() => setHoveredFeature(feature.id)}
      onMouseLeave={() => setHoveredFeature(null)}
      style={{
        animationDelay: `${index * 100}ms`,
        animation: 'fadeInUp 0.6s ease-out forwards'
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl mb-2">{feature.icon}</div>
        <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded">
          {feature.popularity}% Popular
        </span>
      </div>
      
      <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
      <p className="text-gray-600 mb-4">{feature.description}</p>
      
      <div className="space-y-2">
        {feature.benefits.slice(0, 3).map((benefit, i) => (
          <div key={i} className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {benefit}
          </div>
        ))}
      </div>
      
      <button className="mt-4 text-indigo-600 font-medium text-sm hover:text-indigo-800 transition-colors">
        Learn more →
      </button>
    </div>
  );

  /**
   * Enhanced Form Progress Indicator
   */
  const FormProgressIndicator = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">Step {currentStep} of 6</span>
        <span className="text-sm font-medium text-gray-700">{formProgress}% Complete</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${formProgress}%` }}
        ></div>
      </div>
      <div className="flex justify-between mt-4">
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <div
            key={step}
            className={`flex flex-col items-center ${
              visitedSteps.includes(step) ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step
                  ? 'bg-indigo-600 text-white'
                  : visitedSteps.includes(step)
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {step}
            </div>
            <span className="text-xs mt-1">
              {step === 1 && 'Personal'}
              {step === 2 && 'Company'}
              {step === 3 && 'Schedule'}
              {step === 4 && 'Goals'}
              {step === 5 && 'Technical'}
              {step === 6 && 'Review'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Enhanced Form Step Navigation
   */
  const FormStepNavigation = () => (
    <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
      <button
        type="button"
        onClick={() => handleStepBack(currentStep - 1)}
        disabled={currentStep === 1}
        className={`
          px-6 py-2 rounded-lg font-medium transition-all
          ${currentStep === 1
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
          }
        `}
      >
        ← Back
      </button>
      
      {currentStep < 6 ? (
        <button
          type="button"
          onClick={() => handleStepContinue(currentStep + 1)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Continue →
        </button>
      ) : (
        <button
          type="submit"
          disabled={isSubmitting}
          className={`
            px-8 py-2 rounded-lg font-medium transition-all
            ${isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <LoadingSpinner size="small" message="" />
              Scheduling...
            </span>
          ) : (
            'Schedule Demo'
          )}
        </button>
      )}
    </div>
  );

  /**
   * Enhanced Error Display Component
   */
  const ErrorDisplay = ({ field }: { field: string }) => {
    if (!errors[field]) return null;
    
    return (
      <div className="flex items-center mt-1 text-red-600 text-sm">
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {errors[field]}
      </div>
    );
  };

  // Enhanced form sections with comprehensive fields
  const renderFormStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Personal Information</h3>
              <p className="text-gray-600 mb-6">Tell us about yourself so we can personalize your demo experience.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Enter your full name"
                />
                <ErrorDisplay field="name" />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="your@company.com"
                />
                <ErrorDisplay field="email" />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              
              <div>
                <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  id="jobTitle"
                  name="jobTitle"
                  value={formData.jobTitle}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="e.g., Product Manager"
                />
                <ErrorDisplay field="jobTitle" />
              </div>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Company Information</h3>
              <p className="text-gray-600 mb-6">Help us understand your organization's needs and context.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Your company name"
                />
                <ErrorDisplay field="companyName" />
              </div>
              
              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Website
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="https://company.com"
                />
              </div>
              
              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                  Industry *
                </label>
                <select
                  id="industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="">Select Industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                  <option value="Education">Education</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Retail">Retail</option>
                  <option value="Other">Other</option>
                </select>
                <ErrorDisplay field="industry" />
              </div>
              
              <div>
                <label htmlFor="companySize" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Size *
                </label>
                <select
                  id="companySize"
                  name="companySize"
                  value={formData.companySize}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="">Select Size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="501-1000">501-1000 employees</option>
                  <option value="1000+">1000+ employees</option>
                </select>
                <ErrorDisplay field="companySize" />
              </div>
            </div>
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Schedule Your Demo</h3>
              <p className="text-gray-600 mb-6">Choose the perfect time for your personalized demo session.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Date *
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                <ErrorDisplay field="date" />
              </div>
              
              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Time *
                </label>
                <select
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="">Select Time</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                </select>
                <ErrorDisplay field="time" />
              </div>
              
              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <select
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </option>
                  {timezoneSuggestions.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="attendees" className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Attendees *
                </label>
                <input
                  type="number"
                  id="attendees"
                  name="attendees"
                  value={formData.attendees}
                  onChange={handleInputChange}
                  min="1"
                  max="20"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                <ErrorDisplay field="attendees" />
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Attendee Details</h4>
              {formData.attendeeDetails.map((attendee, index) => (
                <div key={attendee.id} className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-medium text-gray-900">Attendee {index + 1}</h5>
                    {formData.attendeeDetails.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAttendee(index)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={attendee.name}
                        onChange={(e) => handleAttendeeChange(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Attendee name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={attendee.email}
                        onChange={(e) => handleAttendeeChange(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="attendee@company.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        value={attendee.role}
                        onChange={(e) => handleAttendeeChange(index, 'role', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., Decision Maker"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`decision-maker-${index}`}
                        checked={attendee.isDecisionMaker}
                        onChange={(e) => handleAttendeeChange(index, 'isDecisionMaker', e.target.checked.toString())}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor={`decision-maker-${index}`} className="ml-2 text-sm text-gray-700">
                        Decision Maker
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              
              {formData.attendeeDetails.length < 10 && (
                <button
                  type="button"
                  onClick={addAttendee}
                  className="flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Another Attendee
                </button>
              )}
            </div>
          </div>
        );
      
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Business Goals & Use Case</h3>
              <p className="text-gray-600 mb-6">Help us understand your objectives to tailor the demo accordingly.</p>
            </div>
            
            <div>
              <label htmlFor="useCase" className="block text-sm font-medium text-gray-700 mb-1">
                Primary Use Case *
              </label>
              <textarea
                id="useCase"
                name="useCase"
                value={formData.useCase}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="Describe how you plan to use our platform..."
              />
              <ErrorDisplay field="useCase" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Business Goals (Select all that apply) *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Increase team productivity',
                  'Reduce scheduling conflicts',
                  'Improve resource utilization',
                  'Enhance customer experience',
                  'Streamline operations',
                  'Scale scheduling operations',
                  'Improve reporting & analytics',
                  'Reduce administrative overhead'
                ].map((goal) => (
                  <label key={goal} className="flex items-center">
                    <input
                      type="checkbox"
                      name="businessGoals"
                      value={goal}
                      checked={formData.businessGoals.includes(goal)}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{goal}</span>
                  </label>
                ))}
              </div>
              <ErrorDisplay field="businessGoals" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Current Challenges (Select all that apply)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Manual scheduling processes',
                  'Time zone coordination issues',
                  'High no-show rates',
                  'Poor resource visibility',
                  'Limited reporting capabilities',
                  'Integration complexity',
                  'Security concerns',
                  'Scalability limitations'
                ].map((challenge) => (
                  <label key={challenge} className="flex items-center">
                    <input
                      type="checkbox"
                      name="challenges"
                      value={challenge}
                      checked={formData.challenges.includes(challenge)}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{challenge}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Technical Requirements</h3>
              <p className="text-gray-600 mb-6">Tell us about your technical environment and integration needs.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Integration Requirements (Select all that apply) *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Google Calendar',
                  'Microsoft Outlook',
                  'Slack',
                  'Microsoft Teams',
                  'Salesforce',
                  'Zoom',
                  'Webex',
                  'Jira',
                  'ServiceNow',
                  'Workday',
                  'Custom API Integration',
                  'Single Sign-On (SSO)'
                ].map((integration) => (
                  <label key={integration} className="flex items-center">
                    <input
                      type="checkbox"
                      name="integrationRequirements"
                      value={integration}
                      checked={formData.integrationRequirements.includes(integration)}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{integration}</span>
                  </label>
                ))}
              </div>
              <ErrorDisplay field="integrationRequirements" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Current Tools & Systems
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'Google Workspace',
                  'Microsoft 365',
                  'Salesforce',
                  'Jira',
                  'ServiceNow',
                  'Workday',
                  'SAP',
                  'Oracle',
                  'Custom CRM',
                  'Other ERP System'
                ].map((tool) => (
                  <label key={tool} className="flex items-center">
                    <input
                      type="checkbox"
                      name="currentTools"
                      value={tool}
                      checked={formData.currentTools.includes(tool)}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{tool}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label htmlFor="technicalEnvironment" className="block text-sm font-medium text-gray-700 mb-1">
                Technical Environment Description
              </label>
              <textarea
                id="technicalEnvironment"
                name="technicalEnvironment"
                value={formData.technicalEnvironment}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="Describe your current technical infrastructure, any specific requirements, or constraints..."
              />
            </div>
          </div>
        );
      
      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Review & Submit</h3>
              <p className="text-gray-600 mb-6">Please review all the information before scheduling your demo.</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 space-y-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Personal Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Name:</span> {formData.name}</div>
                  <div><span className="font-medium">Email:</span> {formData.email}</div>
                  <div><span className="font-medium">Phone:</span> {formData.phone || 'Not provided'}</div>
                  <div><span className="font-medium">Job Title:</span> {formData.jobTitle}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Company Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Company:</span> {formData.companyName}</div>
                  <div><span className="font-medium">Website:</span> {formData.website || 'Not provided'}</div>
                  <div><span className="font-medium">Industry:</span> {formData.industry}</div>
                  <div><span className="font-medium">Company Size:</span> {formData.companySize}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Demo Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="font-medium">Date:</span> {formData.date}</div>
                  <div><span className="font-medium">Time:</span> {formData.time}</div>
                  <div><span className="font-medium">Duration:</span> {formData.duration} minutes</div>
                  <div><span className="font-medium">Timezone:</span> {formData.timezone}</div>
                  <div><span className="font-medium">Attendees:</span> {formData.attendees}</div>
                </div>
              </div>
              
              {formData.useCase && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Use Case</h4>
                  <p className="text-sm text-gray-700">{formData.useCase}</p>
                </div>
              )}
              
              {formData.businessGoals.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Business Goals</h4>
                  <ul className="text-sm text-gray-700 list-disc list-inside">
                    {formData.businessGoals.map((goal, index) => (
                      <li key={index}>{goal}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {formData.integrationRequirements.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Integration Requirements</h4>
                  <ul className="text-sm text-gray-700 list-disc list-inside">
                    {formData.integrationRequirements.map((integration, index) => (
                      <li key={index}>{integration}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Important Information
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      After submitting, you'll receive a confirmation email with the demo details and calendar invitation. 
                      Our team will reach out 24 hours before the demo to confirm and answer any preliminary questions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="recordingConsent"
                name="recordingConsent"
                checked={formData.recordingConsent}
                onChange={handleInputChange}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="recordingConsent" className="ml-2 text-sm text-gray-700">
                I consent to the recording of this demo session for internal training and quality assurance purposes.
              </label>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Enhanced main component render
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100" ref={gestureAreaRef}>
      {/* Enhanced Success Animation */}
      <SuccessAnimation isVisible={showSuccessAnimation} />
      
      {/* Advanced Particle Background */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: userPreferences.reducedMotion ? 0 : 0.6 }}
      />
      
      {/* Enhanced Navigation */}
      <Navbar />
      
      {/* Enhanced Hero Section */}
      <section 
        id="hero" 
        ref={heroRef}
        className="relative pt-32 pb-12 px-6 sm:px-10 lg:px-16 bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 text-white overflow-hidden"
        onMouseMove={(e) => {
          const { clientX, clientY } = e;
          const elements = document.querySelectorAll<HTMLElement>('.parallax-element');
          elements.forEach((element) => {
            const speed = parseFloat(element.getAttribute('data-speed') || '0.02');
            const x = (window.innerWidth - clientX * speed) / 100;
            const y = (window.innerHeight - clientY * speed) / 100;
            element.style.transform = `translateX(${x}px) translateY(${y}px)`;
          });
        }}

      >
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-white/80 to-transparent z-20 pointer-events-none"></div>
        {/* Enhanced Multi-layer Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Primary gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/95 via-purple-900/90 to-blue-900/95 backdrop-blur-[1px] animate-gradient-shift"></div>
          
          {/* Dynamic floating orbs */}
          <div className="absolute top-0 left-0 w-full h-full">
            <div 
              className="parallax-element absolute -top-16 -left-16 w-60 h-60 bg-gradient-to-r from-blue-400/20 to-purple-500/20 rounded-full animate-[float_12s_ease-in-out_infinite] hover:animate-pulse"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[40vh]">
            {/* Premium Hero Content - Compact & Elegant */}
            <div className="text-center lg:text-left space-y-6">
              {/* Enhanced Trust & Social Proof */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4">
                <div 
                  className="bg-white/20 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:scale-105 cursor-pointer group"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <div className="relative">
                      <div className="w-1.5 h-1.5 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-pulse"></div>
                    </div>
                    15,000+ Teams
                  </div>
                </div>
                <div 
                  className="bg-white/20 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 hover:scale-105 cursor-pointer group"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <svg className="w-3 h-3 text-amber-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                    <span className="whitespace-nowrap">4.9/5 (2.8k)</span>
                  </div>
                </div>
              </div>

              {/* Master Headline with Enhanced Typography */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent leading-tight tracking-tight">
                  Enterprise Scheduling
                  <span className="block text-xl sm:text-2xl lg:text-3xl font-light mt-1 text-indigo-100">
                    Reimagined
                  </span>
                </h1>
                
                {/* Compelling Subheadline */}
                <p className="text-base sm:text-lg text-indigo-200 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                  AI-powered scheduling that saves 85% of your time and boosts team productivity.
                </p>

                {/* Value Proposition */}
                <p className="text-sm text-indigo-200/90 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Eliminate scheduling conflicts, reduce no-shows, and optimize team performance with intelligent automation.
                </p>
              </div>

              {/* Advanced CTA & Engagement Section */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <button
                    onClick={() => {
                      formRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="group relative bg-white text-indigo-900 hover:bg-indigo-100 px-6 py-3 rounded-xl font-semibold text-base transition-all duration-500 transform hover:scale-105 shadow-xl hover:shadow-2xl overflow-hidden"
                  >
                    <div className="button-shine absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <div className="relative flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      Schedule Demo
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="group border border-white/60 text-white px-6 py-3 rounded-xl font-semibold text-base hover:bg-white/10 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                      </svg>
                      Explore Features
                    </div>
                  </button>
                </div>

                {/* Enhanced Trust & Urgency Indicators */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 text-xs text-indigo-200 font-medium">
                    <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-sm border border-white/20 hover:bg-white/30 transition-all duration-300 cursor-pointer">
                      <div className="relative">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                      </div>
                      No credit card
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-sm border border-white/20 hover:bg-white/30 transition-all duration-300 cursor-pointer">
                      <div className="relative">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                      </div>
                      30-minute demo
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-sm border border-white/20 hover:bg-white/30 transition-all duration-300 cursor-pointer">
                      <div className="relative">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></div>
                      </div>
                      Custom pricing
                    </div>
                  </div>
                  
                  {/* Real-time Availability Widget */}
                  <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 shadow-xl border border-white/20 max-w-xs mx-auto lg:mx-0 transform hover:scale-105 transition-all duration-300 cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-white">Live Availability</div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></div>
                        <div className="text-xs text-green-300 font-medium bg-green-500/20 px-1.5 py-0.5 rounded-full">Next: 15 min</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-indigo-200">Today:</span>
                        <span className="font-semibold text-green-300">8 slots open</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-emerald-400 h-1.5 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: '75%' }}
                        ></div>
                      </div>
                      <div className="text-xs text-indigo-200/80 text-center">
                        High demand • Book now
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Interactive Calendar Visualization */}
            <div className="relative">
              <div 
                className="relative bg-white/10 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 p-6 transform perspective-1000 hover:rotate-y-2 transition-all duration-500 hover:shadow-3xl"
              >
                {/* Enhanced Card Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-white/30 to-white/10 rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                        Smart Scheduler Pro
                      </h3>
                      <p className="text-xs text-indigo-200/80 font-medium">AI-Powered Platform</p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>

                {/* Interactive Calendar Preview */}
                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-1 mb-3">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div 
                        key={i} 
                        className="text-center text-xs font-semibold text-indigo-200 py-1 hover:scale-110 transition-transform duration-200 cursor-pointer"
                      >
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 14 }, (_, i) => {
                      const date = i + 1;
                      const isAvailable = date > 0 && date < 8 && Math.random() > 0.3;
                      const isToday = date === 3;
                      const isPopular = date === 5 || date === 7;
                      
                      return (
                        <div
                          key={i}
                          className={`h-6 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-300 cursor-pointer group relative ${
                            isToday
                              ? 'bg-white text-indigo-900 shadow-md transform scale-110'
                              : isAvailable
                              ? 'bg-white/10 hover:bg-white/20 text-white hover:text-white hover:shadow-sm border border-transparent hover:border-white/30 hover:scale-105'
                              : 'bg-white/5 text-white/30'
                          } ${isPopular ? 'ring-1 ring-yellow-400/50' : ''}`}
                        >
                          {date}
                          {isPopular && (
                            <div className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-yellow-400 rounded-full animate-pulse"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Smart Time Slot Recommendations */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                      AI-Recommended Times
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['9:00', '11:30', '14:00', '16:30'].map((time, i) => (
                        <div
                          key={i}
                          className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-lg p-1.5 text-center cursor-pointer hover:shadow-md transition-all duration-300 group hover:scale-105"
                        >
                          <div className="text-xs font-semibold text-green-300 group-hover:text-green-200">{time}</div>
                          <div className="text-[10px] text-green-200/80 font-medium">Available</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendation Badge */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/40 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-white">AI Recommendation</div>
                        <div className="text-[10px] text-indigo-200/80">Optimal time based on team availability</div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/20">
                    {[
                      { value: '85%', label: 'Faster', color: 'from-white to-indigo-200' },
                      { value: '40%', label: 'Attendance', color: 'from-green-300 to-emerald-300' },
                      { value: '347%', label: 'ROI', color: 'from-purple-300 to-pink-300' }
                    ].map((stat, index) => (
                      <div 
                        key={index}
                        className="text-center transform transition-all duration-300 hover:scale-110 cursor-pointer group"
                      >
                        <div className={`text-sm font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                          {stat.value}
                        </div>
                        <div className="text-[10px] text-indigo-200/80 group-hover:text-white transition-colors">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Background Effects */}
              <div className="parallax-element absolute -z-10 top-4 -right-4 w-24 h-24 bg-gradient-to-r from-blue-400/15 to-purple-500/15 rounded-full blur-2xl animate-pulse" data-speed="0.02"></div>
              <div className="parallax-element absolute -z-10 -bottom-4 -left-4 w-20 h-20 bg-gradient-to-r from-cyan-400/10 to-blue-500/10 rounded-full blur-2xl animate-pulse delay-1000" data-speed="0.03"></div>
            </div>
          </div>

          {/* Compact Stats Section */}
          <div className="text-center mt-8 pt-6 border-t border-white/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {[
                { value: '99.99%', label: 'Uptime SLA' },
                { value: '15+', label: 'Global Regions' },
                { value: '98.7%', label: 'Satisfaction' },
                { value: '24/7', label: 'Support' }
              ].map((stat, index) => (
                <div 
                  key={index} 
                  className="text-center transform transition-all duration-300 hover:scale-105 cursor-pointer group"
                >
                  <div className="text-lg font-bold text-white mb-0.5 group-hover:animate-pulse">{stat.value}</div>
                  <div className="text-indigo-200/80 text-xs group-hover:text-white transition-colors">{stat.label}</div>
                </div>
              ))}
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
          .animate-gradient-shift {
            background-size: 200% 200%;
            animation: gradient-shift 8s ease infinite;
          }
          .animate-grid-flow {
            animation: grid-flow 20s linear infinite;
          }
          .perspective-1000 {
            perspective: 1000px;
          }
        `}</style>
      </section>


      {/* Enhanced Features Section */}
      <section 
        id="features" 
        ref={featuresRef}
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white"
      >

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Enterprise-Grade Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built for scale, security, and performance with the most advanced scheduling technology available.
            </p>
          </div>
          
          {/* Enhanced Feature Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {['all', 'scheduling', 'automation', 'analytics', 'security', 'infrastructure', 'collaboration'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-4 py-2 rounded-full font-medium transition-all duration-300
                  ${activeTab === tab
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }
                `}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Enhanced Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features
              .filter(feature => activeTab === 'all' || feature.category === activeTab)
              .map((feature, index) => (
                <FeatureCard key={feature.id} feature={feature} index={index} />
              ))}
          </div>
          
          {/* Enhanced Feature Comparison */}
          <div className="mt-20 bg-gray-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Compare Enterprise Plans
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {[
                { name: 'Business', price: '$199', users: 'Up to 50' },
                { name: 'Enterprise', price: '$499', users: 'Up to 200' },
                { name: 'Enterprise Plus', price: '$999', users: 'Unlimited' },
                { name: 'Elite', price: 'Custom', users: 'Unlimited+' }
              ].map((plan, index) => (
                <div key={index} className="bg-white rounded-xl p-6 text-center shadow-lg border border-gray-200">
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h4>
                  <div className="text-3xl font-bold text-indigo-600 mb-2">{plan.price}</div>
                  <div className="text-gray-600 mb-4">per month</div>
                  <div className="text-sm text-gray-700 mb-4">{plan.users} users</div>
                  <button className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                    Select Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Demo Scheduling Form Section */}
      <section 
        id="schedule-demo" 
        ref={formRef}
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white"
        onTouchStart={handleGestureStart}
        onTouchEnd={handleGestureEnd}
        onMouseDown={handleGestureStart}
        onMouseUp={handleGestureEnd}
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Schedule Your Personalized Demo
            </h2>
            <p className="text-xl text-gray-600">
              Experience the power of enterprise scheduling with a customized demo tailored to your needs.
            </p>
          </div>
          
          {submitted ? (
            <div ref={successRef} className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Demo Scheduled Successfully!</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Thank you for scheduling a demo! We've sent a confirmation email with all the details. 
                Our team is excited to show you how we can transform your scheduling operations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Schedule Another Demo
                </button>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Back to Top
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
              {/* Enhanced Progress Indicator */}
              <FormProgressIndicator />
              
              {/* Form Steps */}
              <div className="mb-8">
                {renderFormStep()}
              </div>
              
              {/* Enhanced Navigation */}
              <FormStepNavigation />
              
              {/* Enhanced Error Display */}
              {errors.submit && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-800">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.submit}
                  </div>
                </div>
              )}
              
              {/* Enhanced Help Text */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Need immediate assistance?{' '}
                  <a href="mailto:sales@company.com" className="text-indigo-600 hover:text-indigo-800 font-medium">
                    Contact our sales team
                  </a>
                </p>
              </div>
            </form>
          )}
        </div>
      </section>
  
      {/* Enhanced Footer */}
      <Footer />
      
      {/* Enhanced Online Status Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            You are currently offline. Form will be saved locally.
          </div>
        </div>
      )}
      
      {/* Enhanced Accessibility Controls */}
      <div className="fixed bottom-4 left-4 z-40">
        <div className="bg-white rounded-lg shadow-lg p-3 space-y-2">
          <button
            onClick={() => setUserPreferences(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }))}
            className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-medium"
            title="Toggle reduced motion"
          >
            {userPreferences.reducedMotion ? '🎬' : '⚡'}
          </button>
          <button
            onClick={() => setUserPreferences(prev => ({ ...prev, highContrast: !prev.highContrast }))}
            className="w-8 h-8 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-medium"
            title="Toggle high contrast"
          >
            {userPreferences.highContrast ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Enhanced CSS Animations (included in global CSS or styled-jsx)
const styles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes blob {
    0% {
      transform: translate(0px, 0px) scale(1);
    }
    33% {
      transform: translate(30px, -50px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
    100% {
      transform: translate(0px, 0px) scale(1);
    }
  }
  
  .animate-blob {
    animation: blob 7s infinite;
  }
  
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  
  .animation-delay-4000 {
    animation-delay: 4s;
  }
`;