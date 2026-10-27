// /app/refund/page.tsx - Refund Policy Page
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
import LegalContentRenderer from "@/components/LegalContentRenderer";
import {
  SectionHeader,
  SubSection,
  ContentBlock,
} from "@/components/LegalSectionComponents";
import {
  ChevronRight,
  Shield,
  FileText,
  Users,
  BookOpen,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Globe,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Download,
  Printer,
  CreditCard,
  Receipt,
  ArrowLeftRight,
  Pause,
  Gift,
  Scale,
  BarChart3,
  Briefcase,
  Server,
  Cloud,
  Lock,
  Bell,
  UserCheck,
  Database,
  RefreshCw,
  ShieldAlert,
  Target,
  PieChart,
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
// REUSABLE COMPONENTS (Same as other legal pages)
// =============================================================================

// =============================================================================
// SKELETON LOADER
// =============================================================================

const RefundSkeleton = () => {
  const t = useTranslations("legal.refund");

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
// REFUND POLICY TABLE COMPONENT
// =============================================================================

const RefundTable: React.FC = () => {
  const t = useTranslations("legal.refund");
  const direction = t.dir;

  const tableData = [
    {
      product: t("table.products.individualCourse7Day"),
      scenario: t("table.scenarios.zeroAccessed7Days"),
      status: t("categories.fullRefund"),
      timeline: t("table.timelines.standard"),
    },
    {
      product: t("table.products.individualCourseConditional"),
      scenario: t("table.scenarios.partialAccessed7Days"),
      status: t("categories.conditionalRefund"),
      timeline: t("table.timelines.conditional"),
    },
    {
      product: t("table.products.individualCourseNoRefund"),
      scenario: t("table.scenarios.overConsumedOrTime"),
      status: t("categories.noRefund"),
      timeline: t("table.timelines.notApplicable"),
    },
    {
      product: t("table.products.subscription72Hours"),
      scenario: t("table.scenarios.first72HoursNoUsage"),
      status: t("categories.fullRefund"),
      timeline: t("table.timelines.standard"),
    },
    {
      product: t("table.products.subscription30Day"),
      scenario: t("table.scenarios.first30Days"),
      status: t("categories.noRefund"),
      timeline: t("table.timelines.notApplicable"),
    },
    {
      product: t("table.products.freelancingFeature"),
      scenario: t("table.scenarios.zeroCompletion"),
      status: t("categories.fullRefund"),
      timeline: t("table.timelines.standard"),
    },
    {
      product: t("table.products.technicalDowntime"),
      scenario: t("table.scenarios.lowDowntime"),
      status: t("categories.alternativeCompensation"),
      timeline: t("table.timelines.automatic"),
    },
  ];

  const statusColors = {
    [t("categories.fullRefund")]:
      "bg-green-100 text-green-800 border-green-200",
    [t("categories.conditionalRefund")]:
      "bg-yellow-100 text-yellow-800 border-yellow-200",
    [t("categories.noRefund")]: "bg-red-100 text-red-800 border-red-200",
    [t("categories.alternativeCompensation")]:
      "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 dark:bg-slate-900/60">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("table.headers.productService")}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("table.headers.scenario")}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("table.headers.refundStatus")}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-start text-xs font-semibold text-gray-900 dark:text-slate-100 uppercase tracking-wider"
            >
              {t("table.headers.timeline")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200">
          {tableData.map((row, index) => (
            <tr
              key={index}
              className="hover:bg-gray-50 dark:hover:bg-slate-800/60"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100 text-start">
                {row.product}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700 dark:text-slate-300 text-start">
                {row.scenario}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[row.status]}`}
                >
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300 text-start">
                {row.timeline}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// MAIN REFUND POLICY PAGE COMPONENT
// =============================================================================

export default function RefundPolicyPage() {
  const t = useTranslations("legal.refund");
  const [activeSection, setActiveSection] = useState("introduction");
  const [isLoading, setIsLoading] = useState(false);
  const direction = t.dir;

  // Table of Contents sections
  const sections = [
    { id: "introduction", title: t("sections.introduction"), level: 1 },
    {
      id: "general-principles",
      title: t("sections.generalPrinciples"),
      level: 1,
    },
    {
      id: "education-refunds",
      title: t("sections.educationRefunds"),
      level: 1,
    },
    {
      id: "subscription-refunds",
      title: t("sections.subscriptionRefunds"),
      level: 1,
    },
    {
      id: "freelancing-refunds",
      title: t("sections.freelancingRefunds"),
      level: 1,
    },
    { id: "technical-issues", title: t("sections.technicalIssues"), level: 1 },
    { id: "force-majeure", title: t("sections.forceMajeure"), level: 1 },
    {
      id: "payment-processing",
      title: t("sections.paymentProcessing"),
      level: 1,
    },
    { id: "platform-credits", title: t("sections.platformCredits"), level: 1 },
    { id: "fraud-prevention", title: t("sections.fraudPrevention"), level: 1 },
    { id: "special-cases", title: t("sections.specialCases"), level: 1 },
    { id: "procedures", title: t("sections.procedures"), level: 1 },
    {
      id: "dispute-resolution",
      title: t("sections.disputeResolution"),
      level: 1,
    },
    { id: "policy-updates", title: t("sections.policyUpdates"), level: 1 },
    { id: "contact", title: t("sections.contact"), level: 1 },
    { id: "quick-reference", title: t("sections.quickReference"), level: 1 },
    { id: "acknowledgment", title: t("sections.acknowledgment"), level: 1 },
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
        keys: [
          "policyExplanation",
          "languageNotice",
          "multiPillarEcosystem",
          "relationshipToTerms",
        ],
      },
      {
        id: "generalPrinciples",
        ck: "generalPrinciples",
        keys: [
          "digitalContentBarrier",
          "servicePerformance",
          "consumerProtection",
          "withdrawalRight",
        ],
      },
      {
        id: "educationRefunds",
        ck: "educationRefunds",
        keys: [
          "individualCourse7Day",
          "individualCourseConditional",
          "individualCourseNoRefund",
          "courseBundles",
          "liveCoursesBeforeStart",
          "liveCoursesAfterStart",
          "certificatesIssued",
        ],
      },
      {
        id: "subscriptionRefunds",
        ck: "subscriptionRefunds",
        keys: [
          "first72Hours",
          "thirtyDayCommitment",
          "proRataRefunds",
          "automaticRenewal",
          "failedNoticeProtection",
          "pauseFeature",
        ],
      },
      {
        id: "freelancingRefunds",
        ck: "freelancingRefunds",
        keys: [
          "statusNotice",
          "featurePurchaseRefund",
          "escrowPartialCompletion",
          "nonEscrowContracts",
          "noCommission",
        ],
      },
      {
        id: "technicalIssues",
        ck: "technicalIssues",
        keys: [
          "downtimeLess24Hours",
          "downtimeMore24Hours",
          "catastrophicDowntime",
          "technicalDefects",
          "contentUnavailability",
        ],
      },
      {
        id: "forceMajeure",
        ck: "forceMajeure",
        keys: [
          "interruptionsLess14Days",
          "interruptionsMore14Days",
          "notification",
        ],
      },
      {
        id: "paymentProcessing",
        ck: "paymentProcessing",
        keys: ["refundMethod", "processingTime", "currency", "taxHandling"],
      },
      {
        id: "platformCredits",
        ck: "platformCredits",
        keys: ["creditBonus", "creditTerms", "userChoice"],
      },
      {
        id: "fraudPrevention",
        ck: "fraudPrevention",
        keys: [
          "abuseIndicators",
          "largeRefundVerification",
          "chargebackPolicy",
          "chargebackFees",
        ],
      },
      {
        id: "specialCases",
        ck: "specialCases",
        keys: [
          "giftPurchases",
          "duplicatePurchases",
          "accountDeletion",
          "deceasedUsers",
          "promotionalPurchases",
          "bundleUpgrades",
        ],
      },
      {
        id: "procedures",
        ck: "procedures",
        keys: ["requiredInformation", "processingTimeline", "statusTracking"],
      },
      {
        id: "disputeResolution",
        ck: "disputeResolution",
        keys: ["internalAppeals", "externalResolution", "voluntaryMediation"],
      },
      {
        id: "policyUpdates",
        ck: "policyUpdates",
        keys: [
          "rightToModify",
          "noticeOfChanges",
          "acceptanceOfChanges",
          "grandfatheringProvision",
        ],
      },
      {
        id: "contact",
        ck: "contact",
        keys: ["responseTime", "regulatoryInformation"],
      },
      { id: "quickReference", ck: "quickReference", keys: ["legend"] },
      { id: "acknowledgment", ck: "acknowledgment", keys: ["acceptance"] },
    ];
    const sections = sectionDefs.map(({ id, ck, keys }) => ({
      title: t(`sections.${id}`),
      items: [
        t(`sections.${id}Desc`) as string,
        ...keys.map((k) => c[ck]?.[k]).filter(Boolean),
      ],
    }));
    downloadPageAsPdf(
      ".refund-content",
      "podacium-refund-policy.pdf",
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
    return <RefundSkeleton />;
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
        pageNamespace="refund"
        icon={
          <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                <DollarSign className="w-4 h-4 me-2" />
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
                    {t("dates.version")}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("hero.version")}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className="flex justify-center pt-6 gap-4 flex-wrap"
                dir={direction}
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
                  href="/terms"
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300"
                >
                  <FileText className="w-4 h-4 me-2" />
                  {t("actions.viewTerms")}
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
              <div className="flex-1 refund-content min-w-0">
                {/* Company Header */}
                <LegalCompanyHeader
                  pageNamespace="refund"
                  mainIcon={
                    <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
                    icon={<FileText className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.policyExplanation")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.introduction.section1_2")}
                    level={3}
                    icon={<Globe className="w-5 h-5" />}
                  >
                    <ContentBlock type="warning">
                      <div className="flex text-start items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>{t("content.introduction.languageNotice")}</span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.introduction.section1_3")}
                    level={3}
                    icon={<BarChart3 className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.multiPillarEcosystem")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.introduction.section1_4")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.relationshipToTerms")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                      <Link href="/terms" className="block">
                        <HighlightCard
                          icon={<FileText className="w-5 h-5" />}
                          title={t("actions.viewTerms")}
                          description={t(
                            "content.introduction.relationshipToTerms",
                          )}
                          color="blue"
                        />
                      </Link>
                      <Link href="/privacy" className="block">
                        <HighlightCard
                          icon={<Shield className="w-5 h-5" />}
                          title={t("actions.viewPrivacy")}
                          description={t("contentExtras.privacyDesc")}
                          color="green"
                        />
                      </Link>
                      <Link href="/cookies" className="block">
                        <HighlightCard
                          icon={<BookOpen className="w-5 h-5" />}
                          title={t("actions.viewCookies")}
                          description={t("contentExtras.cookiesDesc")}
                          color="purple"
                        />
                      </Link>
                    </div>
                  </SubSection>
                </section>

                {/* 2. GENERAL REFUND PRINCIPLES */}
                <section id="general-principles" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.generalPrinciples")}
                    description={t("sections.generalPrinciplesDesc")}
                    icon={<Scale className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.generalPrinciples.section2_1")}
                    level={3}
                    icon={<Database className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.generalPrinciples.digitalContentBarrier")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                      <HighlightCard
                        icon={<Database className="w-5 h-5" />}
                        title={t("cards.digitalContent.title")}
                        description={t("cards.digitalContent.description")}
                        color="blue"
                      />
                      <HighlightCard
                        icon={<Server className="w-5 h-5" />}
                        title={t("cards.serviceFees.title")}
                        description={t("cards.serviceFees.description")}
                        color="green"
                      />
                    </div>
                  </SubSection>

                  <SubSection
                    title={t("subSections.generalPrinciples.section2_2")}
                    level={3}
                    icon={<Receipt className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.generalPrinciples.servicePerformance")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.generalPrinciples.section2_3")}
                    level={3}
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.generalPrinciples.consumerProtection")}
                    </ContentBlock>

                    <ContentBlock type="info">
                      <div className="flex text-start items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.generalPrinciples.withdrawalRight")}
                        </span>
                      </div>
                    </ContentBlock>

                    <HighlightCard
                      icon={<Shield className="w-5 h-5" />}
                      title={t("cards.consumerRights.title")}
                      description={t("cards.consumerRights.description")}
                      color="orange"
                      className="my-6"
                    />
                  </SubSection>
                </section>

                {/* 3. EDUCATION PLATFORM REFUNDS */}
                <section id="education-refunds" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.educationRefunds")}
                    description={t("sections.educationRefundsDesc")}
                    icon={<BookOpen className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.educationRefunds.section3_1")}
                    level={3}
                    icon={<Clock className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.educationRefunds.individualCourse7Day")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.educationRefunds.checkpoints.zeroAccessed",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.educationRefunds.checkpoints.noCertificate",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.educationRefunds.checkpoints.within7Days",
                            )}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>

                    <HighlightCard
                      icon={<Clock className="w-5 h-5" />}
                      title={t("cards.coolingOff.title")}
                      description={t("cards.coolingOff.description")}
                      color="green"
                      className="my-6"
                    />
                  </SubSection>

                  <SubSection
                    title={t("subSections.educationRefunds.section3_2")}
                    level={3}
                    icon={<Target className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t(
                        "content.educationRefunds.individualCourseConditional",
                      )}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.educationRefunds.section3_3")}
                    level={3}
                    icon={<AlertCircle className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.educationRefunds.individualCourseNoRefund")}
                    </ContentBlock>

                    <ContentBlock type="warning" className="mt-4">
                      <div className="flex text-start items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t(
                            "content.educationRefunds.checkpoints.noRefundAfterCertificate",
                          )}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.educationRefunds.section3_4")}
                    level={3}
                    icon={<Briefcase className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.educationRefunds.liveCoursesBeforeStart")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 4. SUBSCRIPTION SERVICE REFUNDS */}
                <section
                  id="subscription-refunds"
                  className="scroll-mt-24 mb-12"
                >
                  <SectionHeader
                    title={t("sections.subscriptionRefunds")}
                    description={t("sections.subscriptionRefundsDesc")}
                    icon={<CreditCard className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.subscriptionRefunds.section4_2")}
                    level={3}
                    icon={<Clock className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.subscriptionRefunds.first72Hours")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.subscriptionRefunds.section4_3")}
                    level={3}
                    icon={<ShieldAlert className="w-5 h-5" />}
                  >
                    <ContentBlock type="important">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.subscriptionRefunds.thirtyDayCommitment")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.subscriptionRefunds.section4_4")}
                    level={3}
                    icon={<PieChart className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.subscriptionRefunds.proRataRefunds")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.subscriptionRefunds.section4_6")}
                    level={3}
                    icon={<Pause className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.subscriptionRefunds.pauseFeature")}
                    </ContentBlock>

                    <HighlightCard
                      icon={<Pause className="w-5 h-5" />}
                      title={t("cards.subscriptionPause.title")}
                      description={t("cards.subscriptionPause.description")}
                      color="blue"
                      className="my-6"
                    />
                  </SubSection>
                </section>

                {/* 5. FREELANCING MARKETPLACE REFUNDS */}
                <section
                  id="freelancing-refunds"
                  className="scroll-mt-24 mb-12"
                >
                  <SectionHeader
                    title={t("sections.freelancingRefunds")}
                    description={t("sections.freelancingRefundsDesc")}
                    icon={<Briefcase className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.freelancingRefunds.section5_1")}
                    level={3}
                    icon={<Lock className="w-5 h-5" />}
                  >
                    <ContentBlock type="info">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.freelancingRefunds.statusNotice")}
                        </span>
                      </div>
                    </ContentBlock>

                    <ContentBlock>
                      {t("content.freelancingRefunds.featurePurchaseRefund")}
                    </ContentBlock>

                    <HighlightCard
                      icon={<Lock className="w-5 h-5" />}
                      title={t("cards.escrowProtection.title")}
                      description={t("cards.escrowProtection.description")}
                      color="green"
                      className="my-6"
                    />
                  </SubSection>

                  <SubSection
                    title={t("subSections.freelancingRefunds.section5_3")}
                    level={3}
                    icon={<DollarSign className="w-5 h-5" />}
                  >
                    <ContentBlock type="important">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.freelancingRefunds.noCommission")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 6. TECHNICAL ISSUES AND PLATFORM UNAVAILABILITY */}
                <section id="technical-issues" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.technicalIssues")}
                    description={t("sections.technicalIssuesDesc")}
                    icon={<Server className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.technicalIssues.section6_1")}
                    level={3}
                    icon={<Cloud className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.technicalIssues.downtimeLess24Hours")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.technicalIssues.section6_2")}
                    level={3}
                    icon={<RefreshCw className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.technicalIssues.technicalDefects")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t("content.technicalIssues.examples.brokenVideos")}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.technicalIssues.examples.nonFunctionalQuizzes",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.technicalIssues.examples.corruptDownloads",
                            )}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 7. FORCE MAJEURE AND EXTRAORDINARY EVENTS */}
                <section id="force-majeure" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.forceMajeure")}
                    description={t("sections.forceMajeureDesc")}
                    icon={<AlertCircle className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.forceMajeure.section7_1")}
                    level={3}
                    icon={<AlertCircle className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.forceMajeure.interruptionsLess14Days")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.forceMajeure.section7_2")}
                    level={3}
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.forceMajeure.interruptionsMore14Days")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 8. PAYMENT PROCESSING AND CURRENCY */}
                <section id="payment-processing" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.paymentProcessing")}
                    description={t("sections.paymentProcessingDesc")}
                    icon={<CreditCard className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.paymentProcessing.section8_1")}
                    level={3}
                    icon={<ArrowLeftRight className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.paymentProcessing.refundMethod")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.paymentProcessing.section8_2")}
                    level={3}
                    icon={<Clock className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.paymentProcessing.processingTime")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.paymentProcessing.section8_3")}
                    level={3}
                    icon={<Globe className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.paymentProcessing.currency")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 9. PLATFORM CREDITS AS ALTERNATIVE TO CASH REFUNDS */}
                <section id="platform-credits" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.platformCredits")}
                    description={t("sections.platformCreditsDesc")}
                    icon={<DollarSign className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.platformCredits.section9_1")}
                    level={3}
                    icon={<Target className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.platformCredits.creditBonus")}
                    </ContentBlock>

                    <HighlightCard
                      icon={<DollarSign className="w-5 h-5" />}
                      title={t("cards.platformCredits.title")}
                      description={t("cards.platformCredits.description")}
                      color="purple"
                      className="my-6"
                    />
                  </SubSection>

                  <SubSection
                    title={t("subSections.platformCredits.section9_2")}
                    level={3}
                    icon={<FileText className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.platformCredits.creditTerms")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.platformCredits.conditions.valid12Months",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t("content.platformCredits.conditions.usageScope")}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>
                            {t("content.platformCredits.conditions.giftable")}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.platformCredits.conditions.nonConvertible",
                            )}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 10. FRAUD, ABUSE, AND CHARGEBACKS */}
                <section id="fraud-prevention" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.fraudPrevention")}
                    description={t("sections.fraudPreventionDesc")}
                    icon={<ShieldAlert className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.fraudPrevention.section10_1")}
                    level={3}
                    icon={<UserCheck className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.fraudPrevention.abuseIndicators")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.fraudPrevention.section10_2")}
                    level={3}
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.fraudPrevention.largeRefundVerification")}
                    </ContentBlock>

                    <HighlightCard
                      icon={<Shield className="w-5 h-5" />}
                      title={t("cards.identityVerification.title")}
                      description={t("cards.identityVerification.description")}
                      color="red"
                      className="my-6"
                    />
                  </SubSection>

                  <SubSection
                    title={t("subSections.fraudPrevention.section10_3")}
                    level={3}
                    icon={<AlertCircle className="w-5 h-5" />}
                  >
                    <ContentBlock type="warning">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("content.fraudPrevention.chargebackFees")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 11. SPECIAL CASES AND EXCEPTIONS */}
                <section id="special-cases" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.specialCases")}
                    description={t("sections.specialCasesDesc")}
                    icon={<Users className="w-6 h-6" />}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                    <HighlightCard
                      icon={<Gift className="w-5 h-5" />}
                      title={t("cards.giftPurchases.title")}
                      description={t("cards.giftPurchases.description")}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<RefreshCw className="w-5 h-5" />}
                      title={t("cards.duplicatePurchases.title")}
                      description={t("cards.duplicatePurchases.description")}
                      color="green"
                    />
                    <HighlightCard
                      icon={<UserCheck className="w-5 h-5" />}
                      title={t("cards.accountDeletion.title")}
                      description={t("cards.accountDeletion.description")}
                      color="purple"
                    />
                    <HighlightCard
                      icon={<Scale className="w-5 h-5" />}
                      title={t("cards.deceasedUsers.title")}
                      description={t("cards.deceasedUsers.description")}
                      color="orange"
                    />
                  </div>
                </section>

                {/* 12. REFUND REQUEST PROCEDURES */}
                <section id="procedures" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.procedures")}
                    description={t("sections.proceduresDesc")}
                    icon={<FileText className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.procedures.section12_1")}
                    level={3}
                    icon={<Mail className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw("content.procedures.howToRequest")}
                      />
                    </ContentBlock>

                    <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-6 my-6 border border-gray-200 dark:border-slate-800">
                      <div className="text-sm space-y-4" dir={direction}>
                        <div className="flex items-center gap-3">
                          <ChevronRight
                            className={`w-4 h-4 text-green-600 flex-shrink-0 ${direction === "rtl" ? "rotate-180" : ""}`}
                          />
                          <span className="text-gray-800 dark:text-slate-200 font-medium">
                            {t.forceLTR(
                              t("content.procedures.channels.dashboard"),
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <ChevronRight
                            className={`w-4 h-4 text-green-600 flex-shrink-0 ${direction === "rtl" ? "rotate-180" : ""}`}
                          />
                          <span className="text-gray-800 dark:text-slate-200 font-medium">
                            {t.forceLTR(t("content.procedures.channels.email"))}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <ChevronRight
                            className={`w-4 h-4 text-green-600 flex-shrink-0 ${direction === "rtl" ? "rotate-180" : ""}`}
                          />
                          <span className="text-gray-800 dark:text-slate-200 font-medium">
                            {t.forceLTR(t("content.procedures.channels.phone"))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </SubSection>

                  <SubSection
                    title={t("subSections.procedures.section12_3")}
                    level={3}
                    icon={<Clock className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.procedures.processingTimeline")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.procedures.timelineCheckpoints.acknowledgment",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0" />
                          <span>
                            {t("content.procedures.timelineCheckpoints.review")}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.procedures.timelineCheckpoints.complex",
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0" />
                          <span>
                            {t(
                              "content.procedures.timelineCheckpoints.processing",
                            )}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 13. DISPUTE RESOLUTION AND APPEALS */}
                <section id="dispute-resolution" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.disputeResolution")}
                    description={t("sections.disputeResolutionDesc")}
                    icon={<Scale className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.disputeResolution.section13_1")}
                    level={3}
                    icon={<ArrowLeftRight className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.disputeResolution.internalAppeals")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.disputeResolution.section13_3")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.disputeResolution.voluntaryMediation")}
                    </ContentBlock>

                    <HighlightCard
                      icon={<Scale className="w-5 h-5" />}
                      title={t("cards.mediation.title")}
                      description={t("cards.mediation.description")}
                      color="emerald"
                      className="my-6"
                    />
                  </SubSection>
                </section>

                {/* 14. POLICY UPDATES AND AMENDMENTS */}
                <section id="policy-updates" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.policyUpdates")}
                    description={t("sections.policyUpdatesDesc")}
                    icon={<Bell className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.policyUpdates.section14_4")}
                    level={3}
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.policyUpdates.grandfatheringProvision")}
                    </ContentBlock>

                    <HighlightCard
                      icon={<Shield className="w-5 h-5" />}
                      title={t("cards.grandfathering.title")}
                      description={t("cards.grandfathering.description")}
                      color="indigo"
                      className="my-6"
                    />
                  </SubSection>
                </section>

                {/* 15. CONTACT INFORMATION */}
                <section id="contact" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.contact")}
                    description={t("sections.contactDesc")}
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
                    title={t("subSections.contact.section15_2")}
                    level={3}
                    icon={<Clock className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.contact.responseTime")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span>
                            {t("content.contact.responseTimeCheckpoints.email")}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span>
                            {t(
                              "content.contact.responseTimeCheckpoints.refund",
                            )}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span>
                            {t(
                              "content.contact.responseTimeCheckpoints.appeals",
                            )}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 16. QUICK REFERENCE REFUND TABLE */}
                <section id="quick-reference" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.quickReference")}
                    description={t("sections.quickReferenceDesc")}
                    icon={<FileText className="w-6 h-6" />}
                  />

                  <ContentBlock>
                    {t("content.quickReference.legend")}
                  </ContentBlock>

                  <RefundTable />

                  <ContentBlock type="info" className="mt-6">
                    <div className="flex text-start items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>{t("contentExtras.quickReferenceDisclaimer")}</span>
                    </div>
                  </ContentBlock>
                </section>

                {/* 17. ACKNOWLEDGMENT */}
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
                          href="/terms"
                          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold"
                        >
                          {t("actions.viewTerms")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                        <Link
                          href="/privacy"
                          className="inline-flex items-center text-green-600 hover:text-green-700 font-semibold"
                        >
                          {t("actions.viewPrivacy")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                        <Link
                          href="/cookies"
                          className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 font-semibold"
                        >
                          {t("actions.viewCookies")}
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
