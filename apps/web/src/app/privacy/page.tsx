// /app/privacy/page.tsx - Privacy Policy Page
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
  Lock,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Globe,
  Mail,
  Phone,
  MapPin,
  Download,
  Printer,
  Eye,
  Trash2,
  Database,
  Server,
  Cookie,
  Scale,
  Building,
  Target,
  Network,
  Cloud,
  Key,
  Bell,
  UserCheck,
  Fingerprint,
  PieChart,
  MessageSquare,
  CreditCard,
  BarChart3,
  Cpu,
  MailWarning,
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
// REUSABLE COMPONENTS (Same as Terms page with some additions)
// =============================================================================

// =============================================================================
// SKELETON LOADER
// =============================================================================

const PrivacySkeleton = () => {
  const t = useTranslations("legal.privacy");

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
            {[...Array(8)].map((_, i) => (
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
// MAIN PRIVACY PAGE COMPONENT
// =============================================================================

export default function PrivacyPolicyPage() {
  const t = useTranslations("legal.privacy");
  const [activeSection, setActiveSection] = useState("introduction");
  const [isLoading, setIsLoading] = useState(false);
  const direction = t.dir;

  // Table of Contents sections based on Privacy Policy structure
  const sections = [
    { id: "introduction", title: t("sections.introduction"), level: 1 },
    { id: "legal-basis", title: t("sections.legalBasis"), level: 1 },
    { id: "data-collection", title: t("sections.dataCollection"), level: 1 },
    { id: "data-usage", title: t("sections.dataUsage"), level: 1 },
    { id: "data-retention", title: t("sections.dataRetention"), level: 1 },
    { id: "data-sharing", title: t("sections.dataSharing"), level: 1 },
    { id: "cross-border", title: t("sections.crossBorder"), level: 1 },
    { id: "data-security", title: t("sections.dataSecurity"), level: 1 },
    { id: "user-rights", title: t("sections.userRights"), level: 1 },
    {
      id: "minors-protection",
      title: t("sections.minorsProtection"),
      level: 1,
    },
    { id: "cookies", title: t("sections.cookies"), level: 1 },
    { id: "policy-changes", title: t("sections.policyChanges"), level: 1 },
    {
      id: "international-users",
      title: t("sections.internationalUsers"),
      level: 1,
    },
    { id: "bi-enterprise", title: t("sections.biEnterprise"), level: 1 },
    { id: "contact", title: t("sections.contact"), level: 1 },
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
          "ourCommitment",
          "scope",
          "regulatoryCompliance",
          "relationshipToPolicies",
        ],
      },
      { id: "legalBasis", ck: "legalBasis", keys: ["intro"] },
      {
        id: "dataCollection",
        ck: "dataCollection",
        keys: [
          "authenticationData",
          "usageLearningData",
          "technicalDeviceData",
          "communicationData",
          "biData",
          "aiInteractionData",
          "userGeneratedContent",
        ],
      },
      {
        id: "dataUsage",
        ck: "dataUsage",
        keys: ["optOut", "optOut1", "optOut2", "optOut3", "aiTraining"],
      },
      {
        id: "dataRetention",
        ck: "dataRetention",
        keys: ["activeAccounts", "backupData"],
      },
      {
        id: "dataSharing",
        ck: "dataSharing",
        keys: ["noSale", "aggregateData"],
      },
      {
        id: "crossBorder",
        ck: "crossBorder",
        keys: ["dataLocalization", "internationalTransfers"],
      },
      { id: "dataSecurity", ck: "dataSecurity", keys: ["breachResponse"] },
      { id: "userRights", ck: "userRights", keys: ["intro", "responseTimes"] },
      {
        id: "minorsProtection",
        ck: "minorsProtection",
        keys: ["ageRequirements"],
      },
      { id: "cookies", ck: "cookies", keys: ["overview"] },
      {
        id: "policyChanges",
        ck: "policyChanges",
        keys: ["notificationChanges", "consentChanges"],
      },
      {
        id: "internationalUsers",
        ck: "internationalUsers",
        keys: ["euStatus", "ccpaStatus", "ksaPDPL", "expansionContact"],
      },
      {
        id: "biEnterprise",
        ck: "biEnterprise",
        keys: ["additionalProtections", "clientResponsibilities"],
      },
      { id: "contact", ck: "contact", keys: ["anpdpContact"] },
    ];
    const sections = sectionDefs.map(({ id, ck, keys }) => ({
      title: t(`sections.${id}`),
      items: [
        t(`sections.${id}Desc`) as string,
        ...keys.map((k) => c[ck]?.[k]).filter(Boolean),
      ],
    }));
    downloadPageAsPdf(
      ".privacy-content",
      "podacium-privacy-policy.pdf",
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
    return <PrivacySkeleton />;
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
        pageNamespace="privacy"
        icon={<Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
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
                <Shield className="w-4 h-4 me-2" />
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
                    15
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
            <div className="flex gap-8">
              {/* Content */}
              <div className="flex-1 privacy-content">
                {/* Company Header */}
                <LegalCompanyHeader
                  pageNamespace="privacy"
                  mainIcon={
                    <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.ourCommitment")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.introduction.section1_2")}
                    level={3}
                    icon={<Target className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.scope")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.introduction.section1_4")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.regulatoryCompliance")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.introduction.section1_5")}
                    level={3}
                    icon={<FileText className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.introduction.relationshipToPolicies")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                      <Link href="/terms" className="block">
                        <HighlightCard
                          icon={<FileText className="w-5 h-5" />}
                          title={t("cards.terms.title")}
                          description={t("cards.terms.description")}
                          color="blue"
                        />
                      </Link>
                      <Link href="/cookies" className="block">
                        <HighlightCard
                          icon={<Cookie className="w-5 h-5" />}
                          title={t("cards.cookiePolicy.title")}
                          description={t("cards.cookiePolicy.description")}
                          color="green"
                        />
                      </Link>
                      <Link href="/refund" className="block">
                        <HighlightCard
                          icon={<DollarSign className="w-5 h-5" />}
                          title={t("cards.refundPolicy.title")}
                          description={t("cards.refundPolicy.description")}
                          color="purple"
                        />
                      </Link>
                    </div>
                  </SubSection>
                </section>

                {/* 2. LEGAL BASIS FOR DATA PROCESSING */}
                <section id="legal-basis" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.legalBasis")}
                    description={t("sections.legalBasisDesc")}
                    icon={<Scale className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <ContentBlock>{t("content.legalBasis.intro")}</ContentBlock>

                  <SubSection
                    title={t("subSections.legalBasis.section2_1")}
                    level={3}
                    icon={<UserCheck className="w-5 h-5" />}
                  >
                    <ContentBlock type="important">
                      <LegalContentRenderer
                        data={t.raw("content.legalBasis.consent.main")}
                      />
                    </ContentBlock>

                    <SubSection
                      title={t("content.legalBasis.consent.withdrawal")}
                      level={4}
                    >
                      <ContentBlock type="list">
                        <ul
                          className={`space-y-2 ${direction === "rtl" ? "list-none" : ""}`}
                        >
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t("content.legalBasis.consent.withdrawal1")}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t("content.legalBasis.consent.withdrawal2")}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t("content.legalBasis.consent.withdrawal3")}
                            </span>
                          </li>
                        </ul>
                      </ContentBlock>
                    </SubSection>
                  </SubSection>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                    <HighlightCard
                      icon={<FileText className="w-5 h-5" />}
                      title={t("cards.contract.title")}
                      description={t("cards.contract.description")}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<Scale className="w-5 h-5" />}
                      title={t("cards.legalObligation.title")}
                      description={t("cards.legalObligation.description")}
                      color="green"
                    />
                    <HighlightCard
                      icon={<Shield className="w-5 h-5" />}
                      title={t("cards.legitimateInterest.title")}
                      description={t("cards.legitimateInterest.description")}
                      color="purple"
                    />
                  </div>
                </section>

                {/* 3. DATA WE COLLECT */}
                <section id="data-collection" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.dataCollection")}
                    description={t("sections.dataCollectionDesc")}
                    icon={<Database className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.dataCollection.section3_1")}
                    level={3}
                    icon={<Fingerprint className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw(
                          "content.dataCollection.personalIdentification",
                        )}
                      />
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_2")}
                    level={3}
                    icon={<Key className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataCollection.authenticationData")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_3")}
                    level={3}
                    icon={<BookOpen className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataCollection.usageLearningData")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_4")}
                    level={3}
                    icon={<Cpu className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataCollection.technicalDeviceData")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_5")}
                    level={3}
                    icon={<MessageSquare className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataCollection.communicationData")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_6")}
                    level={3}
                    icon={<BarChart3 className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataCollection.biData")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_7")}
                    level={3}
                    icon={<Cpu className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataCollection.aiInteractionData")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_8")}
                    level={3}
                    icon={<CreditCard className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw("content.dataCollection.paymentData")}
                      />
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_9")}
                    level={3}
                    icon={<Users className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataCollection.userGeneratedContent")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataCollection.section3_10")}
                    level={3}
                    icon={<AlertCircle className="w-5 h-5" />}
                  >
                    <ContentBlock type="warning">
                      <LegalContentRenderer
                        data={t.raw("content.dataCollection.dataNotCollected")}
                      />
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 4. HOW WE USE YOUR DATA */}
                <section id="data-usage" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.dataUsage")}
                    description={t("sections.dataUsageDesc")}
                    icon={<PieChart className="w-6 h-6" />}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <HighlightCard
                      icon={<UserCheck className="w-5 h-5" />}
                      title={t("cards.accountManagement.title")}
                      description={t("cards.accountManagement.description")}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<BookOpen className="w-5 h-5" />}
                      title={t("cards.educationalService.title")}
                      description={t("cards.educationalService.description")}
                      color="green"
                    />
                    <HighlightCard
                      icon={<CreditCard className="w-5 h-5" />}
                      title={t("cards.paymentProcessing.title")}
                      description={t("cards.paymentProcessing.description")}
                      color="purple"
                    />
                    <HighlightCard
                      icon={<BarChart3 className="w-5 h-5" />}
                      title={t("cards.platformImprovement.title")}
                      description={t("cards.platformImprovement.description")}
                      color="indigo"
                    />
                    <HighlightCard
                      icon={<Shield className="w-5 h-5" />}
                      title={t("cards.securityFraud.title")}
                      description={t("cards.securityFraud.description")}
                      color="red"
                    />
                    <HighlightCard
                      icon={<Scale className="w-5 h-5" />}
                      title={t("cards.legalCompliance.title")}
                      description={t("cards.legalCompliance.description")}
                      color="emerald"
                    />
                  </div>

                  <SubSection
                    title={t("subSections.dataUsage.section4_6")}
                    level={3}
                    icon={<Bell className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw("content.dataUsage.communicationMarketing")}
                      />
                    </ContentBlock>

                    <SubSection title={t("content.dataUsage.optOut")} level={4}>
                      <ContentBlock type="list">
                        <ul
                          className={`space-y-2 ${direction === "rtl" ? "list-none" : ""}`}
                        >
                          <li className="flex items-start gap-2">
                            <Mail className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-1 flex-shrink-0" />
                            <span>{t("content.dataUsage.optOut1")}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Users className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>{t("content.dataUsage.optOut2")}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <MailWarning className="w-4 h-4 text-purple-500 dark:text-purple-400 mt-1 flex-shrink-0" />
                            <span>{t("content.dataUsage.optOut3")}</span>
                          </li>
                        </ul>
                      </ContentBlock>
                    </SubSection>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataUsage.section4_10")}
                    level={3}
                    icon={<Cpu className="w-5 h-5" />}
                  >
                    <ContentBlock type="info">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>{t("content.dataUsage.aiTraining")}</span>
                      </div>
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 5. DATA RETENTION */}
                <section id="data-retention" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.dataRetention")}
                    description={t("sections.dataRetentionDesc")}
                    icon={<Clock className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.dataRetention.section5_1")}
                    level={3}
                    icon={<Database className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataRetention.activeAccounts")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataRetention.section5_2")}
                    level={3}
                    icon={<Trash2 className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataRetention.deletedAccounts.intro")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                      <HighlightCard
                        icon={<Clock className="w-5 h-5" />}
                        title={t("cards.personalData.title")}
                        description={t("cards.personalData.description")}
                        color="blue"
                      />
                      <HighlightCard
                        icon={<CreditCard className="w-5 h-5" />}
                        title={t("cards.financialRecords.title")}
                        description={t("cards.financialRecords.description")}
                        color="green"
                      />
                      <HighlightCard
                        icon={<FileText className="w-5 h-5" />}
                        title={t("cards.certificates.title")}
                        description={t("cards.certificates.description")}
                        color="purple"
                      />
                    </div>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataRetention.section5_5")}
                    level={3}
                    icon={<Server className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataRetention.backupData")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 6. DATA SHARING AND DISCLOSURE */}
                <section id="data-sharing" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.dataSharing")}
                    description={t("sections.dataSharingDesc")}
                    icon={<Network className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.dataSharing.section6_1")}
                    level={3}
                    icon={<AlertCircle className="w-5 h-5" />}
                  >
                    <ContentBlock type="important">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <span>{t("content.dataSharing.noSale")}</span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataSharing.section6_2")}
                    level={3}
                    icon={<Users className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw("content.dataSharing.serviceProviders")}
                      />
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataSharing.section6_6")}
                    level={3}
                    icon={<PieChart className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataSharing.aggregateData")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 7. CROSS-BORDER DATA TRANSFERS */}
                <section id="cross-border" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.crossBorder")}
                    description={t("sections.crossBorderDesc")}
                    icon={<Globe className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.crossBorder.section7_1")}
                    level={3}
                    icon={<MapPin className="w-5 h-5" />}
                  >
                    <ContentBlock type="info">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <MapPin className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{t("content.crossBorder.dataLocalization")}</span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.crossBorder.section7_2")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.crossBorder.internationalTransfers")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.crossBorder.section7_3")}
                    level={3}
                    icon={<Server className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw("content.crossBorder.localHosting")}
                      />
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 8. DATA SECURITY */}
                <section id="data-security" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.dataSecurity")}
                    description={t("sections.dataSecurityDesc")}
                    icon={<Lock className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.dataSecurity.section8_1")}
                    level={3}
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataSecurity.securityMeasures.intro")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                      <HighlightCard
                        icon={<Key className="w-5 h-5" />}
                        title={t("cards.encryption.title")}
                        description={t("cards.encryption.description")}
                        color="blue"
                      />
                      <HighlightCard
                        icon={<Lock className="w-5 h-5" />}
                        title={t("cards.accessControls.title")}
                        description={t("cards.accessControls.description")}
                        color="green"
                      />
                      <HighlightCard
                        icon={<Server className="w-5 h-5" />}
                        title={t("cards.infrastructureSecurity.title")}
                        description={t(
                          "cards.infrastructureSecurity.description",
                        )}
                        color="purple"
                      />
                      <HighlightCard
                        icon={<Cloud className="w-5 h-5" />}
                        title={t("cards.backupRecovery.title")}
                        description={t("cards.backupRecovery.description")}
                        color="indigo"
                      />
                    </div>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataSecurity.section8_2")}
                    level={3}
                    icon={<AlertCircle className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.dataSecurity.breachResponse")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.dataSecurity.section8_3")}
                    level={3}
                    icon={<Users className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw(
                          "content.dataSecurity.userResponsibilities",
                        )}
                      />
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 9. YOUR RIGHTS UNDER ALGERIAN LAW */}
                <section id="user-rights" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.userRights")}
                    description={t("sections.userRightsDesc")}
                    icon={<Scale className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <ContentBlock>
                    <LegalContentRenderer data={t.raw("content.userRights")} />
                  </ContentBlock>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <HighlightCard
                      icon={<Eye className="w-5 h-5" />}
                      title={t("cards.rightAccess.title")}
                      description={t("cards.rightAccess.description")}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<FileText className="w-5 h-5" />}
                      title={t("cards.rightRectification.title")}
                      description={t("cards.rightRectification.description")}
                      color="green"
                    />
                    <HighlightCard
                      icon={<Trash2 className="w-5 h-5" />}
                      title={t("cards.rightErasure.title")}
                      description={t("cards.rightErasure.description")}
                      color="purple"
                    />
                    <HighlightCard
                      icon={<Database className="w-5 h-5" />}
                      title={t("cards.rightPortability.title")}
                      description={t("cards.rightPortability.description")}
                      color="indigo"
                    />
                    <HighlightCard
                      icon={<UserCheck className="w-5 h-5" />}
                      title={t("cards.rightWithdraw.title")}
                      description={t("cards.rightWithdraw.description")}
                      color="emerald"
                    />
                    <HighlightCard
                      icon={<Scale className="w-5 h-5" />}
                      title={t("cards.rightComplaint.title")}
                      description={t("cards.rightComplaint.description")}
                      color="red"
                    />
                  </div>

                  <SubSection
                    title={t("subSections.userRights.section9_9")}
                    level={3}
                    icon={<Clock className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.userRights.responseTimes")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 10. MINORS' DATA PROTECTION */}
                <section id="minors-protection" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.minorsProtection")}
                    description={t("sections.minorsProtectionDesc")}
                    icon={<Users className="w-6 h-6" />}
                    badge={t("badges.important")}
                  />

                  <SubSection
                    title={t("subSections.minorsProtection.section10_1")}
                    level={3}
                    icon={<Users className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.minorsProtection.ageRequirements")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.minorsProtection.section10_2")}
                    level={3}
                    icon={<UserCheck className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.minorsProtection.parentalConsent.intro")}
                    </ContentBlock>

                    <SubSection
                      title={t(
                        "content.minorsProtection.parentalConsent.process",
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
                                "content.minorsProtection.parentalConsent.process1",
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "content.minorsProtection.parentalConsent.process2",
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "content.minorsProtection.parentalConsent.process3",
                              )}
                            </span>
                          </li>
                        </ul>
                      </ContentBlock>
                    </SubSection>
                  </SubSection>
                </section>

                {/* 11. COOKIES AND TRACKING TECHNOLOGIES */}
                <section id="cookies" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.cookies")}
                    description={t("sections.cookiesDesc")}
                    icon={<Cookie className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.cookies.section11_1")}
                    level={3}
                    icon={<Cookie className="w-5 h-5" />}
                  >
                    <ContentBlock>{t("content.cookies.overview")}</ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.cookies.section11_3")}
                    level={3}
                    icon={<UserCheck className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      <LegalContentRenderer
                        data={t.raw("content.cookies.cookieConsent")}
                      />
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 12. CHANGES TO THIS PRIVACY POLICY */}
                <section id="policy-changes" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.policyChanges")}
                    description={t("sections.policyChangesDesc")}
                    icon={<FileText className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.policyChanges.section12_2")}
                    level={3}
                    icon={<Bell className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.policyChanges.notificationChanges")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.policyChanges.section12_3")}
                    level={3}
                    icon={<UserCheck className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.policyChanges.consentChanges")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 13. INTERNATIONAL USERS AND GDPR */}
                <section
                  id="international-users"
                  className="scroll-mt-24 mb-12"
                >
                  <SectionHeader
                    title={t("sections.internationalUsers")}
                    description={t("sections.internationalUsersDesc")}
                    icon={<Globe className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.internationalUsers.section13_1")}
                    level={3}
                    icon={<AlertCircle className="w-5 h-5" />}
                  >
                    <ContentBlock type="warning">
                      <LegalContentRenderer
                        data={t.raw("content.internationalUsers.currentStatus")}
                      />
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.internationalUsers.section13_2")}
                    level={3}
                    icon={<Globe className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.internationalUsers.euStatus")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.internationalUsers.section13_3")}
                    level={3}
                    icon={<Globe className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.internationalUsers.ccpaStatus")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.internationalUsers.section13_4")}
                    level={3}
                    icon={<Globe className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.internationalUsers.ksaPDPL")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 14. BUSINESS INTELLIGENCE ENTERPRISE CLIENTS */}
                <section id="bi-enterprise" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("sections.biEnterprise")}
                    description={t("sections.biEnterpriseDesc")}
                    icon={<Building className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("subSections.biEnterprise.section14_1")}
                    level={3}
                    icon={<Shield className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.biEnterprise.additionalProtections")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.biEnterprise.section14_3")}
                    level={3}
                    icon={<Users className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.biEnterprise.clientResponsibilities")}
                    </ContentBlock>
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
                      {t("content.contact.responseTimes.intro")}
                    </ContentBlock>

                    <ContentBlock type="list">
                      <ul
                        className={`space-y-2 ${direction === "rtl" ? "list-none" : ""}`}
                      >
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span>
                            {t("content.contact.responseTimes.general")}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span>
                            {t("content.contact.responseTimes.dataRequests")}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span>
                            {t(
                              "content.contact.responseTimes.breachNotifications",
                            )}
                          </span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                          <span>
                            {t("content.contact.responseTimes.complaints")}
                          </span>
                        </li>
                      </ul>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("subSections.contact.section15_3")}
                    level={3}
                    icon={<Scale className="w-5 h-5" />}
                  >
                    <ContentBlock>
                      {t("content.contact.anpdpContact")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 16. ACKNOWLEDGMENT */}
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
                          href="/cookies"
                          className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 font-semibold"
                        >
                          {t("actions.viewCookiePolicy")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                        <Link
                          href="/refund"
                          className="inline-flex items-center text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold"
                        >
                          {t("actions.viewRefundPolicy")}
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
