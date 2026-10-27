// app/careers/page.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Rocket,
  Heart,
  Globe,
  Award,
  Sparkles,
  Brain,
  Code,
  Database,
  Cpu,
  Cloud,
  CheckCircle,
  ArrowUpRight,
  Mail,
  MapPin,
  Calendar,
  TrendingUp,
  Shield,
  BookOpen,
  Briefcase,
  ExternalLink,
  ChevronDown,
  GitBranch,
  MessageCircle,
  Target,
  Zap,
  Coffee,
  GraduationCap,
  Smartphone,
  Layers,
  PieChart,
  MessageSquare,
  GitMerge,
  Server,
  BarChart,
  Terminal,
  Wifi,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";
import { useTranslations, useBidi } from "@/lib/i18n";
import { PodaciumSpotlightCard } from "@/components/design-system/PodaciumSpotlightCard";
import { getAccentStyle } from "@/lib/accent-styles";

// =============================================================================
// ANIMATION CONFIGURATION (Consistent with About page)
// =============================================================================

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring", stiffness: 200, damping: 25, mass: 1 },
    BOUNCY: { type: "spring", stiffness: 400, damping: 15, mass: 1 },
    SMOOTH: { type: "spring", stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
    STANDARD: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
    BOUNCE: { duration: 0.6, ease: [0.68, -0.55, 0.265, 1.55] },
  },
  STAGGER: {
    FAST: 0.05,
    NORMAL: 0.1,
    SLOW: 0.2,
  },
} as const;

// =============================================================================
// REUSABLE COMPONENTS (Consistent with existing pages)
// =============================================================================

interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: string;
  requirements: string[];
  applyLink: string;
  isExpanded: boolean;
  onExpand: () => void;
  index: number;
}

const RoleCard: React.FC<RoleCardProps> = ({
  title,
  description,
  icon,
  color,
  category,
  requirements,
  applyLink,
  isExpanded,
  onExpand,
  index,
}) => {
  const t = useTranslations();
  const accent = getAccentStyle(color);

  // Ref to track if we're clicking inside interactive elements
  const interactiveClick = React.useRef(false);

  const handleCardClick = () => {
    if (!interactiveClick.current) {
      onExpand();
    }
    // Reset for next click
    interactiveClick.current = false;
  };

  const handleInteractiveClick = (e: React.MouseEvent) => {
    interactiveClick.current = true;
    e.stopPropagation();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 1,
        delay: index * 0.1,
      }}
      className="relative max-w-5xl mx-auto"
    >
      {/* Card Container - Now with proper event handling */}
      <motion.div
        layout
        className={`
          relative overflow-hidden rounded-2xl border
          ${isExpanded ? "border-gray-300 dark:border-slate-700 shadow-2xl" : "border-gray-200/50 dark:border-slate-800/50 shadow-lg"}
          bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm
          cursor-pointer
          transition-all duration-500
          hover:shadow-xl
          ${isExpanded ? "z-10" : "hover:z-5"}
        `}
        onClick={handleCardClick}
        whileHover={
          !isExpanded
            ? {
                y: -8,
                scale: 1.02,
                boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.1)",
              }
            : {}
        }
        animate={{
          height: isExpanded ? "auto" : "auto",
          transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
        }}
      >
        {/* Background Gradient Layer */}
        <motion.div
          className={`
            absolute inset-0 bg-gradient-to-br ${accent.from} ${accent.to}
            opacity-0
          `}
          animate={{
            opacity: isExpanded ? 0.3 : 0,
          }}
          transition={{ duration: 0.4 }}
        />

        {/* Compact View */}
        <motion.div
          layout
          className={`
            p-6
            ${isExpanded ? "pb-4" : ""}
            relative z-10
          `}
          animate={{
            paddingBottom: isExpanded ? 16 : 24,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              {/* Role Icon */}
              <motion.div
                layout
                className={`
                  relative flex-shrink-0
                  ${accent.bg}
                  rounded-xl p-3
                  ${isExpanded ? "scale-110" : ""}
                `}
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <div className={`${accent.text}`}>{icon}</div>
              </motion.div>

              {/* Role Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <motion.h3
                    layout
                    className="text-xl font-bold text-gray-900 dark:text-slate-100 truncate"
                  >
                    {title}
                  </motion.h3>

                  <motion.span
                    layout
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${accent.bg} ${accent.text}`}
                  >
                    {category}
                  </motion.span>
                </div>

                {/* Description Preview */}
                <motion.p
                  layout
                  className="text-gray-600 dark:text-slate-400 text-sm line-clamp-2"
                  animate={{
                    opacity: isExpanded ? 0 : 1,
                    height: isExpanded ? 0 : "auto",
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {description}
                </motion.p>

                {/* Requirements Preview */}
                {!isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      {requirements.slice(0, 3).map((req, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-xs rounded-lg"
                        >
                          {req}
                        </span>
                      ))}
                      {requirements.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-xs rounded-lg">
                          {t("careers.roles.moreRequirements", {
                            count: (requirements.length - 3).toString(),
                          })}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Expand/Collapse Button */}
            <motion.button
              className={`
                flex-shrink-0 self-start p-2 rounded-lg
                ${accent.text} ${accent.hoverBg}
                transition-colors duration-300
                ml-4
              `}
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => {
                handleInteractiveClick(e);
                onExpand();
              }}
            >
              <ChevronDown className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()} // Prevent clicks in expanded area
            >
              <div className="px-6 pb-8 space-y-8">
                {/* Divider */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                  className={`h-px bg-gradient-to-r from-transparent ${accent.border} to-transparent`}
                />

                {/* Full Description */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-1 h-4 ${accent.bg} rounded-full`} />
                    <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                      {t("careers.roles.description")}
                    </h4>
                  </div>
                  <p className="text-gray-600 dark:text-slate-400 leading-relaxed">
                    {description}
                  </p>
                </motion.div>

                {/* Requirements */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-1 h-4 ${accent.bg} rounded-full`} />
                    <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                      {t("careers.roles.requirements")}
                    </h4>
                  </div>

                  <ul className="space-y-2">
                    {requirements.map((requirement, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + idx * 0.05 }}
                        className="flex items-start space-x-2"
                      >
                        <CheckCircle
                          className={`w-4 h-4 ${accent.text} flex-shrink-0 mt-0.5`}
                        />
                        <span className="text-sm text-gray-600 dark:text-slate-400">
                          {requirement}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>

                {/* Apply Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="pt-4 mx-auto max-w-sm"
                  onClick={handleInteractiveClick} // Mark as interactive area
                >
                  <div className="space-y-3">
                    {/* Primary Email Application Button */}
                    <a
                      href={applyLink}
                      onClick={handleInteractiveClick}
                      className={`
                        group inline-flex items-center justify-center w-full
                        px-6 py-3 ${accent.bg} ${accent.text}
                        rounded-xl font-bold hover:opacity-90
                        transition-all duration-300 shadow-md hover:shadow-lg
                        relative z-20
                      `}
                    >
                      <Mail className="w-5 h-5 ml-2 mr-2" />
                      {t("careers.buttons.applyViaEmail")}
                      <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </a>

                    {/* LinkedIn Connect Option */}
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-slate-700"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400">
                          {t("careers.roles.connectOn")}
                        </span>
                      </div>
                    </div>

                    {/* LinkedIn Button */}
                    <a
                      href="https://linkedin.com/company/podacium"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleInteractiveClick}
                      className="group inline-flex items-center justify-center w-full px-6 py-3 bg-[#0077B5] text-white rounded-xl font-medium hover:bg-[#006396] transition-all duration-300 shadow-sm hover:shadow-md relative z-20"
                    >
                      <svg
                        className="w-5 h-5 ml-2 mr-2"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                      {t("careers.buttons.connectLinkedIn")}
                      <ExternalLink className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </a>

                    {/* Contact Options Info */}
                    <div
                      className="text-xs text-gray-500 dark:text-slate-400 space-y-1 mt-2"
                      onClick={handleInteractiveClick}
                    >
                      <p className="text-center">
                        <span className="font-medium">
                          {t("careers.roles.applicationOptions")}:
                        </span>
                      </p>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
                        <div className="flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          <span>
                            {t("careers.contact.email")}:{" "}
                            <a
                              href="mailto:podaciumcareers@gmail.com"
                              className="hover:underline"
                            >
                              podaciumcareers@gmail.com
                            </a>
                          </span>
                        </div>
                        <div className="flex items-center">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                          </svg>
                          <span>
                            {"LinkedIn"}:{" "}
                            <a
                              href="https://linkedin.com/company/podacium"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              /company/podacium
                            </a>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Micro-interaction Border */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                  className={`
                    h-0.5 bg-gradient-to-r from-transparent
                    ${accent.via} to-transparent
                    rounded-full
                  `}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

interface ValueCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  tone: "brand" | "blue" | "indigo" | "purple";
  index: number;
}

const ValueCard: React.FC<ValueCardProps> = ({
  title,
  description,
  icon,
  tone,
  index,
}) => {
  return (
    <PodaciumSpotlightCard
      tone={tone}
      strength={8}
      depth={0.35}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="h-full"
      contentClassName="p-6"
    >
      <div className="p-3 bg-white/15 rounded-xl w-fit mb-4">{icon}</div>

      <h3 className="font-bold text-white text-lg mb-3">{title}</h3>
      <p className="text-white/85 text-sm leading-relaxed">{description}</p>
    </PodaciumSpotlightCard>
  );
};

// =============================================================================
// DATA
// =============================================================================

const createCompanyValues = (t: (key: string) => string) => [
  {
    title: t("careers.values.0.title"),
    description: t("careers.values.0.description"),
    icon: <Target className="w-6 h-6" />,
    tone: "blue" as const,
  },
  {
    title: t("careers.values.1.title"),
    description: t("careers.values.1.description"),
    icon: <GraduationCap className="w-6 h-6" />,
    tone: "indigo" as const,
  },
  {
    title: t("careers.values.2.title"),
    description: t("careers.values.2.description"),
    icon: <Globe className="w-6 h-6" />,
    tone: "purple" as const,
  },
  {
    title: t("careers.values.3.title"),
    description: t("careers.values.3.description"),
    icon: <Rocket className="w-6 h-6" />,
    tone: "brand" as const,
  },
];

const createOpenRoles = (t: (key: string) => string) => [
  {
    id: 1,
    title: t("careers.roles.openRoles.0.title"),
    description: t("careers.roles.openRoles.0.description"),
    icon: <Server className="w-6 h-6" />,
    color: "blue",
    category: t("careers.roles.categories.engineering"),
    requirements: [
      t("careers.roles.openRoles.0.requirements.0"),
      t("careers.roles.openRoles.0.requirements.1"),
      t("careers.roles.openRoles.0.requirements.2"),
      t("careers.roles.openRoles.0.requirements.3"),
      t("careers.roles.openRoles.0.requirements.4"),
      t("careers.roles.openRoles.0.requirements.5"),
    ],
    applyLink:
      "mailto:podaciumcareers@gmail.com?subject=Application for Backend Developer",
  },
  {
    id: 2,
    title: t("careers.roles.openRoles.1.title"),
    description: t("careers.roles.openRoles.1.description"),
    icon: <Code className="w-6 h-6" />,
    color: "green",
    category: t("careers.roles.categories.engineering"),
    requirements: [
      t("careers.roles.openRoles.1.requirements.0"),
      t("careers.roles.openRoles.1.requirements.1"),
      t("careers.roles.openRoles.1.requirements.2"),
      t("careers.roles.openRoles.1.requirements.3"),
      t("careers.roles.openRoles.1.requirements.4"),
      t("careers.roles.openRoles.1.requirements.5"),
    ],
    applyLink:
      "mailto:podaciumcareers@gmail.com?subject=Application for Frontend Developer",
  },
  {
    id: 3,
    title: t("careers.roles.openRoles.2.title"),
    description: t("careers.roles.openRoles.2.description"),
    icon: <CheckCircle className="w-6 h-6" />,
    color: "purple",
    category: t("careers.roles.categories.qualityAssurance"),
    requirements: [
      t("careers.roles.openRoles.2.requirements.0"),
      t("careers.roles.openRoles.2.requirements.1"),
      t("careers.roles.openRoles.2.requirements.2"),
      t("careers.roles.openRoles.2.requirements.3"),
      t("careers.roles.openRoles.2.requirements.4"),
      t("careers.roles.openRoles.2.requirements.5"),
    ],
    applyLink:
      "mailto:podaciumcareers@gmail.com?subject=Application for QA Tester",
  },
  {
    id: 4,
    title: t("careers.roles.openRoles.3.title"),
    description: t("careers.roles.openRoles.3.description"),
    icon: <Cloud className="w-6 h-6" />,
    color: "orange",
    category: t("careers.roles.categories.infrastructure"),
    requirements: [
      t("careers.roles.openRoles.3.requirements.0"),
      t("careers.roles.openRoles.3.requirements.1"),
      t("careers.roles.openRoles.3.requirements.2"),
      t("careers.roles.openRoles.3.requirements.3"),
      t("careers.roles.openRoles.3.requirements.4"),
      t("careers.roles.openRoles.3.requirements.5"),
    ],
    applyLink:
      "mailto:podaciumcareers@gmail.com?subject=Application for DevOps Engineer",
  },
  {
    id: 5,
    title: t("careers.roles.openRoles.4.title"),
    description: t("careers.roles.openRoles.4.description"),
    icon: <Brain className="w-6 h-6" />,
    color: "red",
    category: t("careers.roles.categories.aiResearch"),
    requirements: [
      t("careers.roles.openRoles.4.requirements.0"),
      t("careers.roles.openRoles.4.requirements.1"),
      t("careers.roles.openRoles.4.requirements.2"),
      t("careers.roles.openRoles.4.requirements.3"),
      t("careers.roles.openRoles.4.requirements.4"),
      t("careers.roles.openRoles.4.requirements.5"),
    ],
    applyLink:
      "mailto:podaciumcareers@gmail.com?subject=Application for AI/ML Engineer",
  },
];

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function CareersPage() {
  const { isAuthenticated, user } = useAuth();
  const t = useTranslations();
  const { isRTL } = useBidi();
  const [expandedRoleId, setExpandedRoleId] = React.useState<number | null>(
    null,
  );
  const [roleClicks, setRoleClicks] = React.useState<Record<number, number>>(
    {},
  );

  // Create dynamic data based on translations
  const COMPANY_VALUES = React.useMemo(() => createCompanyValues(t), [t]);
  const OPEN_ROLES = React.useMemo(() => createOpenRoles(t), [t]);

  const handleRoleExpand = (id: number) => {
    setExpandedRoleId(expandedRoleId === id ? null : id);

    // Track role view for analytics (optional)
    setRoleClicks((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const handleApplyClick = (role: string) => {};

  return (
    <div
      className={`min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100 ${isRTL ? "rtl" : "ltr"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Navbar />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
          <div className="absolute inset-0 bg-grid-gray-100/50 dark:bg-grid-slate-800/30 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
          <div className="relative max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ANIMATION_CONFIGS.EASING.ENTER}
              className="text-center space-y-8"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg"
              >
                <Rocket className="w-4 h-4 ml-2 mr-2" />
                {t("careers.hero.badge")}
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                {t("careers.hero.title.prefix")}{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {t("careers.hero.title.highlight")}
                </span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("careers.hero.description")}
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row justify-center gap-4 pt-4"
              >
                <a
                  href="#open-roles"
                  onClick={() => handleApplyClick("general_inquiry")}
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <Briefcase className="w-5 h-5 ml-2 mr-2" />
                  {t("careers.hero.buttons.viewRoles")}
                  <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </a>

                <a
                  href="mailto:podaciumcareers@gmail.com?subject=General Career Inquiry"
                  onClick={() => handleApplyClick("general_inquiry")}
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-blue-200 dark:border-blue-800/80"
                >
                  <Mail className="w-5 h-5 ml-2 mr-2" />
                  {t("careers.hero.buttons.generalInquiry")}
                  <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="pt-8"
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {t("careers.hero.quote")}
                  </span>
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Why Work at Podacium */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-sm font-semibold mb-6 shadow-lg"
              >
                <Heart className="w-4 h-4 ml-2 mr-2" />
                {t("careers.whyWork.cultureBadge")}
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                {t("careers.whyWork.title.prefix")}{" "}
                <span className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  {t("careers.whyWork.title.highlight")}
                </span>
              </h2>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed"
              >
                {t("careers.whyWork.description")}
              </motion.p>
            </motion.div>

            {/* Values Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {COMPANY_VALUES.map((value, index) => (
                <ValueCard
                  key={value.title}
                  title={value.title}
                  description={value.description}
                  icon={value.icon}
                  tone={value.tone}
                  index={index}
                />
              ))}
            </div>

            {/* Perks Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="mt-16"
            >
              <div className="bg-gradient-to-r from-gray-900 to-blue-900 rounded-3xl p-8 md:p-12 text-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {[
                    {
                      icon: <Coffee className="w-8 h-8" />,
                      label: t("careers.perks.0"),
                    },
                    {
                      icon: <BookOpen className="w-8 h-8" />,
                      label: t("careers.perks.1"),
                    },
                    {
                      icon: <MapPin className="w-8 h-8" />,
                      label: t("careers.perks.2"),
                    },
                    {
                      icon: <Zap className="w-8 h-8" />,
                      label: t("careers.perks.3"),
                    },
                  ].map((perk, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 * index + 0.6 }}
                      className="text-center group"
                    >
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                        {perk.icon}
                      </div>
                      <div className="text-lg font-semibold">{perk.label}</div>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 }}
                  className="mt-8 pt-8 border-t border-white/20 dark:border-slate-800/40 text-center"
                >
                  <p className="text-blue-200">
                    {t("careers.perks.description")}
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Open Roles */}
        <section
          id="open-roles"
          className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50/30 dark:from-slate-900 dark:to-slate-950/50"
        >
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full text-sm font-semibold mb-6 shadow-lg"
              >
                <Briefcase className="w-4 h-4 ml-2 mr-2" />
                {t("careers.openRoles.badge")}
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                {t("careers.openRoles.title.prefix")}{" "}
                <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
                  {t("careers.openRoles.title.highlight")}
                </span>
              </h2>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed mb-8"
              >
                {t("careers.openRoles.description")}
              </motion.p>
            </motion.div>

            {/* Role Cards */}
            <div className="space-y-6">
              {OPEN_ROLES.map((role, index) => (
                <RoleCard
                  key={role.id}
                  title={role.title}
                  description={role.description}
                  icon={role.icon}
                  color={role.color}
                  category={role.category}
                  requirements={role.requirements}
                  applyLink={role.applyLink}
                  isExpanded={expandedRoleId === role.id}
                  onExpand={() => handleRoleExpand(role.id)}
                  index={index}
                />
              ))}
            </div>

            {/* No Match Found Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="mt-20"
            >
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 rounded-3xl p-8 md:p-12 border border-gray-200 dark:border-slate-800">
                <div className="text-center max-w-2xl mx-auto">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl mb-6">
                    <MessageSquare className="w-8 h-8 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                    {t("careers.noMatch.title")}
                  </h3>

                  <p className="text-gray-600 dark:text-slate-400 mb-8 leading-relaxed">
                    {t("careers.noMatch.description")}
                  </p>

                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <a
                      href="mailto:podaciumcareers@gmail.com?subject=General Application - My Skills & Interest"
                      onClick={() => handleApplyClick("general_application")}
                      className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <Mail className="w-5 h-5 ml-2 mr-2" />
                      {t("careers.noMatch.buttons.sendApplication")}
                      <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </a>

                    <Link
                      href="/about"
                      className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-blue-200 dark:border-blue-800/80"
                    >
                      <Users className="w-5 h-5 ml-2 mr-2" />
                      {t("careers.noMatch.buttons.learnAbout")}
                      <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </Link>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-6">
                    {t("careers.noMatch.footnote")}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Application Process */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-semibold mb-6 shadow-lg"
              >
                <Calendar className="w-4 h-4 ml-2 mr-2" />
                {t("careers.process.badge")}
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                {t("careers.process.title.prefix")}{" "}
                <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
                  {t("careers.process.title.highlight")}
                </span>
              </h2>
            </motion.div>

            {/* Process Steps */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                {
                  step: "1",
                  title: t("careers.process.steps.0.title"),
                  description: t("careers.process.steps.0.description"),
                  icon: <Mail className="w-6 h-6" />,
                  color: "blue",
                },
                {
                  step: "2",
                  title: t("careers.process.steps.1.title"),
                  description: t("careers.process.steps.1.description"),
                  icon: <CheckCircle className="w-6 h-6" />,
                  color: "green",
                },
                {
                  step: "3",
                  title: t("careers.process.steps.2.title"),
                  description: t("careers.process.steps.2.description"),
                  icon: <MessageCircle className="w-6 h-6" />,
                  color: "purple",
                },
                {
                  step: "4",
                  title: t("careers.process.steps.3.title"),
                  description: t("careers.process.steps.3.description"),
                  icon: <Sparkles className="w-6 h-6" />,
                  color: "orange",
                },
              ].map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 h-full">
                    <div className="flex items-center mb-4">
                      <div
                        className={`w-10 h-10 ${getAccentStyle(step.color).bg} ${getAccentStyle(step.color).text} rounded-xl flex items-center justify-center font-bold text-lg ml-2 mr-2`}
                      >
                        {step.step}
                      </div>
                      <div
                        className={`p-2 ${getAccentStyle(step.color).bg} rounded-lg`}
                      >
                        <div className={`${getAccentStyle(step.color).text}`}>
                          {step.icon}
                        </div>
                      </div>
                    </div>

                    <h3 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
                      {step.description}
                    </p>

                    {/* Connector line for desktop */}
                    {index < 3 && (
                      <div className="hidden md:block absolute top-1/2 right-0 w-8 h-0.5 bg-gray-200 dark:bg-slate-800/90 translate-x-4 -translate-y-1/2"></div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Combined CTA & Contact Section (Consistent with About page) */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-blue-900">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left: Contact Info */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold">
                    <MessageCircle className="w-4 h-4 ml-2 mr-2" />
                    {t("careers.contact.questionsBadge")}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    {t("careers.contact.title")}
                  </h2>
                  <p className="text-blue-200 text-lg">
                    {t("careers.contact.description")}
                  </p>
                </div>

                {/* Contact Cards */}
                <div className="space-y-6">
                  {/* Careers Email */}
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
                  >
                    <a
                      href="mailto:podaciumcareers@gmail.com"
                      className="block"
                      aria-label={t("careers.contact.emailAriaLabel")}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                          <Mail className="w-6 h-6 text-blue-300" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg mb-1">
                            {t("careers.contact.emailTitle")}
                          </h3>
                          <p className="text-blue-200 mb-2">
                            {t("careers.contact.emailDescription")}
                          </p>
                          <div className="inline-flex items-center text-blue-300 font-medium group-hover:text-blue-200 transition-colors duration-300">
                            <span>{t("careers.contact.emailAddress")}</span>
                            <ArrowUpRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                          </div>
                        </div>
                      </div>
                    </a>
                  </motion.div>

                  {/* Visit Location */}
                  <motion.div
                    whileHover={{ y: -4 }}
                    className="group bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
                  >
                    <a
                      href="https://maps.app.goo.gl/egrbHeMaiptuyMCs7"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                      aria-label={t("careers.contact.locationAriaLabel")}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-green-500/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
                          <MapPin className="w-6 h-6 text-green-300" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg mb-1">
                            {t("careers.contact.locationTitle")}
                          </h3>
                          <p className="text-blue-200 mb-2">
                            {t("careers.contact.locationDescription")}
                          </p>
                          <div className="inline-flex items-center text-green-300 font-medium group-hover:text-green-200 transition-colors duration-300">
                            <span>{t("careers.contact.locationAddress")}</span>
                            <ExternalLink className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                          </div>
                        </div>
                      </div>
                    </a>
                  </motion.div>
                </div>
              </motion.div>

              {/* Right: Dynamic CTA based on Auth Status */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-8 md:p-10 text-white relative overflow-hidden"
              >
                {/* Background pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-700/30 to-indigo-700/30"></div>
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]"></div>

                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="inline-flex items-center px-4 py-2 bg-white/15 border border-white/25 backdrop-blur-sm rounded-full text-sm font-semibold text-white">
                      <Zap className="w-4 h-4 ml-2 mr-2" />
                      {t("careers.cta.readyBadge")}
                    </div>

                    <h3 className="text-2xl font-bold">
                      {t("careers.cta.title")}
                    </h3>

                    <p className="text-blue-100 leading-relaxed">
                      {t("careers.cta.description")}
                    </p>
                  </div>

                  {/* Dynamic Button Section */}
                  <div className="pt-8 space-y-4">
                    {/* Apply Now Button */}
                    <a
                      href="mailto:podaciumcareers@gmail.com?subject=Job Application - Ready to Apply"
                      onClick={() => handleApplyClick("ready_to_apply")}
                      className="group inline-flex items-center justify-center w-full px-6 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl"
                    >
                      <Briefcase className="w-5 h-5 ml-2 mr-2" />
                      {t("careers.cta.buttons.applyNow")}
                      <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </a>

                    {/* For existing users */}
                    {isAuthenticated && (
                      <div className="grid grid-cols-2 gap-4">
                        <Link
                          href="/dashboard"
                          className="group inline-flex items-center justify-center px-4 py-3 bg-white/15 border border-white/20 text-white rounded-xl font-medium hover:bg-white/25 transition-all duration-300"
                        >
                          <TrendingUp className="w-4 h-4 ml-2 mr-2" />
                          {t("careers.cta.buttons.dashboard")}
                        </Link>

                        <Link
                          href="/learn"
                          className="group inline-flex items-center justify-center px-4 py-3 bg-white/15 border border-white/20 text-white rounded-xl font-medium hover:bg-white/25 transition-all duration-300"
                        >
                          <BookOpen className="w-4 h-4 ml-2 mr-2" />
                          {t("careers.cta.buttons.learn")}
                        </Link>
                      </div>
                    )}

                    {/* Partner/Investor CTA */}
                    <div className="pt-6 border-t border-white/20 dark:border-slate-800/40">
                      <Link
                        href="/partners"
                        className="group inline-flex items-center justify-center w-full px-6 py-3 bg-transparent border-2 border-white text-white rounded-xl font-bold hover:bg-white/15 transition-all duration-300"
                      >
                        <Users className="w-5 h-5 ml-2 mr-2" />
                        {t("careers.cta.buttons.partner")}
                        <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="col-span-full mt-12 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full"
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
