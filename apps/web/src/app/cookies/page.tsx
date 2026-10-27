// /app/cookies/page.tsx - Cookie Policy Page
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { downloadPageAsPdf } from "@/lib/pdf-export";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LegalCompanyHeader from "@/components/LegalCompanyHeader";
import LegalTableOfContents from "@/components/LegalTableOfContents";
import HighlightCard from "@/components/LegalHighlightCard";
import {
  SectionHeader,
  SubSection,
  ContentBlock,
} from "@/components/LegalSectionComponents";
import {
  ChevronRight,
  Shield,
  FileText,
  Cookie as CookieIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Mail,
  Phone,
  MapPin,
  Users,
  Download,
  Printer,
  Eye,
  Trash2,
  Database,
  Server,
  Scale,
  Building,
  Network,
  Cloud,
  Key,
  Bell,
  UserCheck,
  BarChart3,
  Target,
  Lock,
  Settings,
  ExternalLink,
  ShieldAlert,
  Cookie,
  Fingerprint,
} from "lucide-react";

// =============================================================================
// ANIMATION CONFIGURATION
// =============================================================================

const ANIMATION_CONFIGS = {
  EASING: {
    ENTER: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
    STANDARD: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  STAGGER: {
    NORMAL: 0.1,
    SLOW: 0.2,
  },
} as const;

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface CookieTableRow {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  dataShared: string;
  category: "essential" | "analytics" | "functional" | "marketing";
}

const CookieTable: React.FC<{ cookies: CookieTableRow[] }> = ({ cookies }) => {
  const t = useTranslations("legal");
  const direction = t.dir;

  const categoryColors = {
    essential: "bg-red-50 text-red-700 border-red-200",
    analytics: "bg-blue-50 text-blue-700 border-blue-200",
    functional: "bg-green-50 text-green-700 border-green-200",
    marketing: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const categoryLabels = {
    essential: t("cookies.categories.essential"),
    analytics: t("cookies.categories.analytics"),
    functional: t("cookies.categories.functional"),
    marketing: t("cookies.categories.marketing"),
  };

  const tdClass = "px-4 py-3 text-sm";

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 dark:bg-slate-900/60">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("cookies.table.headers.cookieName")}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("cookies.table.headers.provider")}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("cookies.table.headers.purpose")}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("cookies.table.headers.duration")}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("cookies.table.headers.dataShared")}
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("cookies.table.headers.category")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200">
          {cookies.map((cookie, index) => (
            <tr
              key={index}
              className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <td
                className={`${tdClass} font-mono text-gray-900 dark:text-slate-100 whitespace-nowrap text-start`}
              >
                {cookie.name}
              </td>
              <td
                className={`${tdClass} text-gray-700 dark:text-slate-300 text-start`}
              >
                {cookie.provider}
              </td>
              <td
                className={`${tdClass} text-gray-700 dark:text-slate-300 text-start`}
              >
                {cookie.purpose}
              </td>
              <td
                className={`${tdClass} text-gray-700 dark:text-slate-300 whitespace-nowrap text-start`}
              >
                {cookie.duration}
              </td>
              <td
                className={`${tdClass} text-gray-700 dark:text-slate-300 text-start`}
              >
                {cookie.dataShared}
              </td>
              <td className="px-4 py-3 text-start whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[cookie.category]}`}
                >
                  {categoryLabels[cookie.category]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// SKELETON LOADER
// =============================================================================

const CookiesSkeleton = () => {
  const t = useTranslations("legal.cookies");

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={t.dir}
    >
      <Navbar />
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-12 animate-pulse">
            <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-3/4 mb-4"></div>
            <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-1/2"></div>
          </div>

          {/* Content Skeleton */}
          <div className="space-y-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-2/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-full"></div>
                  <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-5/6"></div>
                  <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-4/6"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

// =============================================================================
// MAIN COOKIES PAGE COMPONENT
// =============================================================================

export default function CookiePolicyPage() {
  const t = useTranslations("legal.cookies");
  const [activeSection, setActiveSection] = useState("introduction");
  const [isLoading, setIsLoading] = useState(false);
  const direction = t.dir;

  // Table of Contents sections based on Cookie Policy structure
  const sections = [
    { id: "introduction", title: t("sections.introduction"), level: 1 },
    { id: "what-are-cookies", title: t("sections.whatAreCookies"), level: 1 },
    {
      id: "how-we-use-cookies",
      title: t("sections.howWeUseCookies"),
      level: 1,
    },
    {
      id: "your-consent-control",
      title: t("sections.yourConsentControl"),
      level: 1,
    },
    { id: "types-of-cookies", title: t("sections.typesOfCookies"), level: 1 },
    {
      id: "detailed-cookie-list",
      title: t("sections.detailedCookieList"),
      level: 1,
    },
    { id: "data-retention", title: t("sections.dataRetention"), level: 1 },
    { id: "data-transfers", title: t("sections.dataTransfers"), level: 1 },
    { id: "minors-privacy", title: t("sections.minorsPrivacy"), level: 1 },
    { id: "your-rights", title: t("sections.yourRights"), level: 1 },
    {
      id: "contact-information",
      title: t("sections.contactInformation"),
      level: 1,
    },
    { id: "policy-changes", title: t("sections.policyChanges"), level: 1 },
  ];

  // Cookie data for the table
  const cookiesData: CookieTableRow[] = [
    {
      name: "session_id",
      provider: t("company.name"),
      purpose: t("cookies.sessionId.purpose"),
      duration: t("durations.session"),
      dataShared: t("dataShared.none"),
      category: "essential",
    },
    {
      name: "csrf_token",
      provider: t("company.name"),
      purpose: t("cookies.csrfToken.purpose"),
      duration: t("durations.session"),
      dataShared: t("dataShared.none"),
      category: "essential",
    },
    {
      name: "cookie_consent",
      provider: t("company.name"),
      purpose: t("cookies.cookieConsent.purpose"),
      duration: t("durations.oneYear"),
      dataShared: t("dataShared.none"),
      category: "essential",
    },
    {
      name: "_ga",
      provider: t("providers.googleAnalytics"),
      purpose: t("cookies.googleAnalytics.purpose"),
      duration: t("durations.twoYears"),
      dataShared: t("dataShared.google"),
      category: "analytics",
    },
    {
      name: "_gid",
      provider: t("providers.googleAnalytics"),
      purpose: t("cookies.googleAnalytics24h.purpose"),
      duration: t("durations.twentyFourHours"),
      dataShared: t("dataShared.google"),
      category: "analytics",
    },
  ];

  // Handle scroll for active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      let currentSection = sections[0].id;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const offsetTop = element.offsetTop;

          if (scrollPosition >= offsetTop) {
            currentSection = section.id;
          } else {
            break;
          }
        }
      }

      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle download
  const handleDownload = () => {
    const c = t.raw("content");
    const sectionDefs = [
      {
        id: "introduction",
        ck: "introduction",
        keys: ["policyExplanation", "complianceCommitment"],
      },
      {
        id: "whatAreCookies",
        ck: "whatAreCookies",
        keys: ["definition", "trackingTechnologies"],
      },
      { id: "howWeUseCookies", ck: "howWeUseCookies", keys: ["intro"] },
      {
        id: "yourConsentControl",
        ck: "yourConsentControl",
        keys: [
          "priorConsent",
          "withdrawConsent",
          "rejectionWarning",
          "browserSettings",
          "blockingWarning",
        ],
      },
      {
        id: "typesOfCookies",
        ck: "typesOfCookies",
        keys: ["firstPartyCookies", "thirdPartyCookies"],
      },
      {
        id: "detailedCookieList",
        ck: "detailedCookieList",
        keys: [
          "strictlyNecessaryNote",
          "analyticsNote",
          "functionalityMarketingNote",
          "updateNote",
        ],
      },
      {
        id: "dataRetention",
        ck: "dataRetention",
        keys: ["intro", "privacyPolicyReference"],
      },
      { id: "dataTransfers", ck: "dataTransfers", keys: ["intro"] },
      {
        id: "minorsPrivacy",
        ck: "minorsPrivacy",
        keys: ["intro", "parentalConsent"],
      },
      { id: "yourRights", ck: "yourRights", keys: ["intro", "exerciseRights"] },
      {
        id: "contactInformation",
        ck: "contactInformation",
        keys: ["dpoNote", "anpdpContact", "anpdpRegistration"],
      },
      {
        id: "policyChanges",
        ck: "policyChanges",
        keys: ["intro", "notificationMethod", "continuedUse"],
      },
    ];
    const sections = sectionDefs.map(({ id, ck, keys }) => ({
      title: t(`sections.${id}`),
      items: [
        t(`sections.${id}Desc`) as string,
        ...keys.map((k) => c[ck]?.[k]).filter(Boolean),
      ],
    }));
    downloadPageAsPdf(
      ".cookies-content",
      "podacium-cookie-policy.pdf",
      {
        title: t("hero.title"),
        locale: t.i18n.language,
        companyName: t("company.name"),
        companyAddress: t("company.fullAddress"),
        effectiveDate: t("dates.effectiveDate"),
        version: t("dates.version"),
      },
      sections,
    );
  };

  if (isLoading) {
    return <CookiesSkeleton />;
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100 print:bg-white dark:bg-slate-900"
      dir={direction}
    >
      {/* Render TableOfContents as fixed overlay */}
      <LegalTableOfContents
        sections={sections}
        activeSection={activeSection}
        pageNamespace="cookies"
        icon={
          <CookieIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        }
      />

      <Navbar />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* Hero Section */}
        <section className="relative pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 print:hidden">
          <div className="absolute inset-0 bg-grid-blue-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
          <div className="relative max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ANIMATION_CONFIGS.EASING.ENTER}
              className="text-center space-y-6"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg">
                <CookieIcon className="w-4 h-4 me-2" />
                {t("hero.badge")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("hero.title")}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("hero.description")}
              </p>

              {/* Quick Stats */}
              <div className="flex flex-wrap justify-center gap-6 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {sections.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("hero.sections")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">2026</div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("hero.effectiveDate")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    1.0
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("hero.version")}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className={`flex ${direction === "rtl" ? "space-x-reverse" : ""} space-x-4 justify-center pt-6 gap-4`}
              >
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
                >
                  <Printer className="w-4 h-4 me-2" />
                  {t("actions.print")}
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                >
                  <Download className="w-4 h-4 me-2" />
                  {t("actions.download")}
                </button>
                <Link
                  href="/privacy"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300"
                >
                  <Shield className="w-4 h-4 me-2" />
                  {t("actions.viewPrivacy")}
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Main Content */}
        <section
          className="pb-20 px-4 sm:px-6 lg:px-8 py-8 lg:mx-80"
          dir={direction}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex gap-8 min-w-0">
              {/* Content */}
              <div className="flex-1 cookies-content min-w-0">
                {/* Company Header */}
                <LegalCompanyHeader
                  pageNamespace="cookies"
                  mainIcon={
                    <CookieIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  }
                />

                {/* 1. INTRODUCTION */}
                <section id="introduction" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.introduction")}
                    description={t("sections.introductionDesc")}
                    icon={<FileText className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.introduction.section1_1")}
                    level={3}
                    icon={<CookieIcon className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.policyExplanation")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.introduction.section1_2")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.complianceCommitment")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                      <Link href="/privacy" className="block">
                        <HighlightCard
                          icon={<Shield className="w-5 h-5" />}
                          title={t("cards.privacyPolicy.title")}
                          description={t("cards.privacyPolicy.description")}
                          color="blue"
                        />
                      </Link>
                      <Link href="/terms" className="block">
                        <HighlightCard
                          icon={<FileText className="w-5 h-5" />}
                          title={t("cards.termsOfService.title")}
                          description={t("cards.termsOfService.description")}
                          color="green"
                        />
                      </Link>
                    </div>
                  </SubSection>
                </section>

                {/* 2. WHAT ARE COOKIES? */}
                <section id="what-are-cookies" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.whatAreCookies")}
                    description={t("sections.whatAreCookiesDesc")}
                    icon={<CookieIcon className="w-6 h-6" />}
                  />

                  <ContentBlock>
                    {t("content.whatAreCookies.definition")}
                  </ContentBlock>

                  <SubSection
                    title={t("subSections.whatAreCookies.section2_2")}
                    level={3}
                    icon={<Database className="w-5 h-5" />}
                  >
                    <ContentBlock type="info">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <Database className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.whatAreCookies.trackingTechnologies")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                    <HighlightCard
                      icon={<CookieIcon className="w-5 h-5" />}
                      title={t("cards.textFiles.title")}
                      description={t("cards.textFiles.description")}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<Settings className="w-5 h-5" />}
                      title={t("cards.websiteEfficiency.title")}
                      description={t("cards.websiteEfficiency.description")}
                      color="green"
                    />
                    <HighlightCard
                      icon={<Shield className="w-5 h-5" />}
                      title={t("cards.legalCompliance.title")}
                      description={t("cards.legalCompliance.description")}
                      color="purple"
                    />
                    <HighlightCard
                      icon={<UserCheck className="w-5 h-5" />}
                      title={t("cards.userConsent.title")}
                      description={t("cards.userConsent.description")}
                      color="orange"
                    />
                  </div>
                </section>

                {/* 3. HOW WE USE COOKIES & LEGAL BASIS */}
                <section id="how-we-use-cookies" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.howWeUseCookies")}
                    description={t("sections.howWeUseCookiesDesc")}
                    icon={<Scale className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <ContentBlock>
                    {t("content.howWeUseCookies.intro")}
                  </ContentBlock>

                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 my-6">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 dark:bg-slate-900/60">
                        <tr>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider`}
                          >
                            {t("usageTable.headers.purpose")}
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider`}
                          >
                            {t("usageTable.headers.description")}
                          </th>
                          <th
                            scope="col"
                            className={`px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider`}
                          >
                            {t("usageTable.headers.legalBasis")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200">
                        <tr className="hover:bg-red-50 dark:hover:bg-red-950/60">
                          <td
                            className={`px-6 py-4 font-semibold text-red-700 dark:text-red-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.strictlyNecessary.purpose")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.strictlyNecessary.description")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.strictlyNecessary.legalBasis")}
                          </td>
                        </tr>
                        <tr className="hover:bg-blue-50 dark:hover:bg-blue-950/60">
                          <td
                            className={`px-6 py-4 font-semibold text-blue-700 dark:text-blue-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.performanceAnalytics.purpose")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.performanceAnalytics.description")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.performanceAnalytics.legalBasis")}
                          </td>
                        </tr>
                        <tr className="hover:bg-green-50 dark:bg-emerald-950/40">
                          <td
                            className={`px-6 py-4 font-semibold text-green-700 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.functionality.purpose")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.functionality.description")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.functionality.legalBasis")}
                          </td>
                        </tr>
                        <tr className="hover:bg-purple-50 dark:bg-purple-950/60">
                          <td
                            className={`px-6 py-4 font-semibold text-purple-700 dark:text-purple-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.targeting.purpose")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.targeting.description")}
                          </td>
                          <td
                            className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                          >
                            {t("usageTable.targeting.legalBasis")}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 4. YOUR CONSENT & CONTROL */}
                <section
                  id="your-consent-control"
                  className="scroll-mt-24 mb-12"
                >
                  <SectionHeader
                    title={t("sections.yourConsentControl")}
                    description={t("sections.yourConsentControlDesc")}
                    icon={<UserCheck className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.yourConsentControl.section4_1")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock type="important">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <Scale className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.yourConsentControl.priorConsent")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.yourConsentControl.section4_2")}
                    level={3}
                    icon={<Bell className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.yourConsentControl.consentFlow.intro")}
                    </ContentBlock>

                    <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-6 my-6 border border-gray-200 dark:border-slate-800">
                      <div className="font-mono text-sm space-y-4">
                        <div
                          className={`flex items-center gap-2 ${direction === "rtl" ? "flex-row-reverse" : ""}`}
                        >
                          <ChevronRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>
                            {t("content.yourConsentControl.consentFlow.step1")}
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-2 ${direction === "rtl" ? "flex-row-reverse" : ""}`}
                        >
                          <ChevronRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>
                            {t("content.yourConsentControl.consentFlow.step2")}
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-2 ${direction === "rtl" ? "flex-row-reverse" : ""}`}
                        >
                          <ChevronRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>
                            {t("content.yourConsentControl.consentFlow.step3")}
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-2 ${direction === "rtl" ? "flex-row-reverse" : ""}`}
                        >
                          <ChevronRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span>
                            {t("content.yourConsentControl.consentFlow.step4")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <SubSection
                      title={t(
                        "content.yourConsentControl.consentFlow.keyPoints",
                      )}
                      level={4}
                    >
                      <ContentBlock type="list">
                        <ul
                          className={`space-y-2 ${direction === "rtl" ? "list-none" : ""}`}
                        >
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "content.yourConsentControl.consentFlow.point1",
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "content.yourConsentControl.consentFlow.point2",
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "content.yourConsentControl.consentFlow.point3",
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "content.yourConsentControl.consentFlow.point4",
                              )}
                            </span>
                          </li>
                        </ul>
                      </ContentBlock>
                    </SubSection>
                  </SubSection>

                  <SubSection
                    title={t("subSections.yourConsentControl.section4_3")}
                    level={3}
                    icon={<Settings className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.yourConsentControl.withdrawConsent")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul
                        className={`space-y-2 ${direction === "rtl" ? "list-none" : ""}`}
                      >
                        <li className="flex items-start gap-2">
                          <Settings className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.yourConsentControl.manageOptions.option1",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CookieIcon className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.yourConsentControl.manageOptions.option2",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Mail className="w-4 h-4 text-purple-500 dark:text-purple-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.yourConsentControl.manageOptions.option3",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.yourConsentControl.manageOptions.option4",
                            )}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>

                    <ContentBlock type="warning" className="mt-4">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.yourConsentControl.rejectionWarning")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.yourConsentControl.section4_4")}
                    level={3}
                    icon={<Globe className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.yourConsentControl.browserSettings")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                      <a
                        href="https://support.google.com/chrome/answer/95647"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <HighlightCard
                          icon={<ExternalLink className="w-5 h-5" />}
                          title={t(
                            "content.yourConsentControl.browserGuides.chromeTitle",
                          )}
                          description={t(
                            "content.yourConsentControl.browserGuides.chrome",
                          )}
                          color="blue"
                        />
                      </a>
                      <a
                        href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <HighlightCard
                          icon={<ExternalLink className="w-5 h-5" />}
                          title={t(
                            "content.yourConsentControl.browserGuides.firefoxTitle",
                          )}
                          description={t(
                            "content.yourConsentControl.browserGuides.firefox",
                          )}
                          color="orange"
                        />
                      </a>
                      <a
                        href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <HighlightCard
                          icon={<ExternalLink className="w-5 h-5" />}
                          title={t(
                            "content.yourConsentControl.browserGuides.safariTitle",
                          )}
                          description={t(
                            "content.yourConsentControl.browserGuides.safari",
                          )}
                          color="purple"
                        />
                      </a>
                      <a
                        href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <HighlightCard
                          icon={<ExternalLink className="w-5 h-5" />}
                          title={t(
                            "content.yourConsentControl.browserGuides.edgeTitle",
                          )}
                          description={t(
                            "content.yourConsentControl.browserGuides.edge",
                          )}
                          color="green"
                        />
                      </a>
                    </div>

                    <ContentBlock type="warning">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.yourConsentControl.blockingWarning")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 5. TYPES OF COOKIES WE USE */}
                <section id="types-of-cookies" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.typesOfCookies")}
                    description={t("sections.typesOfCookiesDesc")}
                    icon={<Database className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.typesOfCookies.section5_1")}
                    level={3}
                    icon={<Fingerprint className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.typesOfCookies.firstPartyCookies")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.typesOfCookies.section5_2")}
                    level={3}
                    icon={<Network className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.typesOfCookies.thirdPartyCookies")}
                    </ContentBlock>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800 my-6">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 dark:bg-slate-900/60">
                          <tr>
                            <th
                              scope="col"
                              className={`px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider`}
                            >
                              {t("providersTable.headers.serviceProvider")}
                            </th>
                            <th
                              scope="col"
                              className={`px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider`}
                            >
                              {t("providersTable.headers.purpose")}
                            </th>
                            <th
                              scope="col"
                              className={`px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider`}
                            >
                              {t("providersTable.headers.dataLocation")}
                            </th>
                            <th
                              scope="col"
                              className={`px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider`}
                            >
                              {t("providersTable.headers.yourControl")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200">
                          <tr className="hover:bg-blue-50 dark:hover:bg-blue-950/60">
                            <td
                              className={`px-6 py-4 font-semibold text-gray-900 dark:text-slate-100 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.paymentGateways.provider")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.paymentGateways.purpose")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.paymentGateways.dataLocation")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.paymentGateways.yourControl")}
                            </td>
                          </tr>
                          <tr className="hover:bg-green-50 dark:bg-emerald-950/40">
                            <td
                              className={`px-6 py-4 font-semibold text-gray-900 dark:text-slate-100 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.analyticsProviders.provider")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.analyticsProviders.purpose")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t(
                                "providersTable.analyticsProviders.dataLocation",
                              )}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t(
                                "providersTable.analyticsProviders.yourControl",
                              )}
                            </td>
                          </tr>
                          <tr className="hover:bg-purple-50 dark:bg-purple-950/60">
                            <td
                              className={`px-6 py-4 font-semibold text-gray-900 dark:text-slate-100 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.aiServiceProviders.provider")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.aiServiceProviders.purpose")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t(
                                "providersTable.aiServiceProviders.dataLocation",
                              )}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t(
                                "providersTable.aiServiceProviders.yourControl",
                              )}
                            </td>
                          </tr>
                          <tr className="hover:bg-yellow-50">
                            <td
                              className={`px-6 py-4 font-semibold text-gray-900 dark:text-slate-100 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.marketingPlatforms.provider")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t("providersTable.marketingPlatforms.purpose")}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t(
                                "providersTable.marketingPlatforms.dataLocation",
                              )}
                            </td>
                            <td
                              className={`px-6 py-4 text-sm text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right" : ""}`}
                            >
                              {t(
                                "providersTable.marketingPlatforms.yourControl",
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </SubSection>
                </section>

                {/* 6. DETAILED COOKIE LIST */}
                <section
                  id="detailed-cookie-list"
                  className="scroll-mt-24 mb-12"
                >
                  <SectionHeader
                    title={t("sections.detailedCookieList")}
                    description={t("sections.detailedCookieListDesc")}
                    icon={<FileText className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.detailedCookieList.section6_1")}
                    level={3}
                    icon={<ShieldAlert className="w-5 h-5" />}
                  >
                    <ContentBlock type="important">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t(
                            "content.detailedCookieList.strictlyNecessaryNote",
                          )}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <CookieTable cookies={cookiesData} />

                  <SubSection
                    title={t("subSections.detailedCookieList.section6_2")}
                    level={3}
                    icon={<BarChart3 className="w-5 h-5" />}
                  >
                    <ContentBlock type="info">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.detailedCookieList.analyticsNote")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.detailedCookieList.section6_3")}
                    level={3}
                    icon={<Bell className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t(
                        "content.detailedCookieList.functionalityMarketingNote",
                      )}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.detailedCookieList.section6_4")}
                    level={3}
                    icon={<Clock className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.detailedCookieList.updateNote")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 7. DATA RETENTION */}
                <section id="data-retention" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.dataRetention")}
                    description={t("sections.dataRetentionDesc")}
                    icon={<Clock className="w-6 h-6" />}
                  />

                  <ContentBlock>
                    {t("content.dataRetention.intro")}
                  </ContentBlock>

                  <SubSection
                    title={t("subSections.dataRetention.section7_2")}
                    level={3}
                    icon={<Database className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataRetention.privacyPolicyReference")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 8. DATA TRANSFERS OUTSIDE ALGERIA */}
                <section id="data-transfers" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.dataTransfers")}
                    description={t("sections.dataTransfersDesc")}
                    icon={<Globe className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <ContentBlock>
                    {t("content.dataTransfers.intro")}
                  </ContentBlock>

                  <SubSection
                    title={t("subSections.dataTransfers.section8_2")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataTransfers.ourCommitments.intro")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul
                        className={`space-y-2 ${direction === "rtl" ? "list-none" : ""}`}
                      >
                        <li className="flex items-start gap-2">
                          <Shield className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.dataTransfers.ourCommitments.commitment1",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Bell className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.dataTransfers.ourCommitments.commitment2",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Lock className="w-4 h-4 text-purple-500 dark:text-purple-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.dataTransfers.ourCommitments.commitment3",
                            )}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 9. MINORS' PRIVACY */}
                <section id="minors-privacy" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.minorsPrivacy")}
                    description={t("sections.minorsPrivacyDesc")}
                    icon={<Users className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <ContentBlock>
                    {t("content.minorsPrivacy.intro")}
                  </ContentBlock>

                  <SubSection
                    title={t("subSections.minorsPrivacy.section9_2")}
                    level={3}
                    icon={<UserCheck className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.minorsPrivacy.parentalConsent")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 10. YOUR DATA PROTECTION RIGHTS */}
                <section id="your-rights" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.yourRights")}
                    description={t("sections.yourRightsDesc")}
                    icon={<Scale className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <ContentBlock>{t("content.yourRights.intro")}</ContentBlock>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Link href="/privacy#user-rights" className="block">
                      <HighlightCard
                        icon={<Eye className="w-5 h-5" />}
                        title={t("cards.rightAccess.title")}
                        description={t("cards.rightAccess.description")}
                        color="blue"
                      />
                    </Link>
                    <Link href="/privacy#user-rights" className="block">
                      <HighlightCard
                        icon={<FileText className="w-5 h-5" />}
                        title={t("cards.rightRectification.title")}
                        description={t("cards.rightRectification.description")}
                        color="green"
                      />
                    </Link>
                    <Link href="/privacy#user-rights" className="block">
                      <HighlightCard
                        icon={<Trash2 className="w-5 h-5" />}
                        title={t("cards.rightErasure.title")}
                        description={t("cards.rightErasure.description")}
                        color="purple"
                      />
                    </Link>
                    <Link href="/privacy#user-rights" className="block">
                      <HighlightCard
                        icon={<Database className="w-5 h-5" />}
                        title={t("cards.rightPortability.title")}
                        description={t("cards.rightPortability.description")}
                        color="indigo"
                      />
                    </Link>
                  </div>

                  <SubSection
                    title={t("subSections.yourRights.section10_2")}
                    level={3}
                    icon={<Mail className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.yourRights.exerciseRights")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 11. CONTACT INFORMATION & DATA CONTROLLER */}
                <section
                  id="contact-information"
                  className="scroll-mt-24 mb-12"
                >
                  <SectionHeader
                    title={t("sections.contactInformation")}
                    description={t("sections.contactInformationDesc")}
                    icon={<Mail className="w-6 h-6" />}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <HighlightCard
                      icon={<Mail className="w-5 h-5" />}
                      title={t("contact.email.title")}
                      description={t("company.email")}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<Phone className="w-5 h-5" />}
                      title={t("contact.phone.title")}
                      description={t.forceLTR(t("company.phone"))}
                      color="green"
                    />
                    <HighlightCard
                      icon={<MapPin className="w-5 h-5" />}
                      title={t("contact.address.title")}
                      description={t("company.fullAddress")}
                      color="purple"
                    />
                    <HighlightCard
                      icon={<Globe className="w-5 h-5" />}
                      title={t("contact.website.title")}
                      description={t("company.website")}
                      color="yellow"
                    />
                  </div>

                  <SubSection
                    title={t("subSections.contactInformation.section11_2")}
                    level={3}
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.contactInformation.dpoNote")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.contactInformation.section11_3")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.contactInformation.anpdpContact")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.contactInformation.section11_4")}
                    level={3}
                    icon={<FileText className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.contactInformation.anpdpRegistration")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 12. CHANGES TO THIS COOKIE POLICY */}
                <section id="policy-changes" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.policyChanges")}
                    description={t("sections.policyChangesDesc")}
                    icon={<Bell className="w-6 h-6" />}
                  />

                  <ContentBlock>
                    {t("content.policyChanges.intro")}
                  </ContentBlock>

                  <SubSection
                    title={t("subSections.policyChanges.section12_2")}
                    level={3}
                    icon={<Bell className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.policyChanges.notificationMethod")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.policyChanges.section12_3")}
                    level={3}
                    icon={<UserCheck className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.policyChanges.continuedUse")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 13. ACKNOWLEDGMENT */}
                <section className="mt-16 pt-12 border-t border-gray-200 dark:border-slate-800">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border border-blue-200 dark:border-blue-800/80">
                    <div className="text-center">
                      <Shield className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                        {t("acknowledgment.title")}
                      </h3>
                      <p className="text-gray-700 dark:text-slate-300 mb-6 max-w-2xl mx-auto">
                        {t("acknowledgment.description")}
                      </p>
                      <div
                        className={`flex ${direction === "rtl" ? "space-x-reverse" : ""} space-x-4 justify-center flex-wrap gap-4`}
                      >
                        <Link
                          href="/privacy"
                          className="inline-flex items-center text-green-600 hover:text-green-700 font-semibold"
                        >
                          {t("actions.viewPrivacy")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                        <Link
                          href="/terms"
                          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
                        >
                          {t("actions.viewTerms")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                        <Link
                          href="/refund"
                          className="inline-flex items-center text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold"
                        >
                          {t("actions.viewRefund")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 text-center text-gray-600 dark:text-slate-400 text-sm">
                    <p>{t("footer.thankYou")}</p>
                    <p className="mt-2">
                      {t("lastUpdated")}: {t("dates.lastUpdated")} •{" "}
                      {t("version")}: {t("dates.version")} •{" "}
                      {t("effectiveDate")}: {t("dates.effectiveDate")}
                    </p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
