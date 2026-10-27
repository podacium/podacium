// /app/terms/page.tsx - Terms of Service Page
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
  Users,
  BookOpen,
  Brain,
  BarChart3,
  Briefcase,
  Lock,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Globe,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Download,
  Printer,
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

// =============================================================================
// SKELETON LOADER
// =============================================================================

const TermsSkeleton = () => {
  const t = useTranslations("legal");

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
// MAIN TERMS PAGE COMPONENT
// =============================================================================

export default function TermsOfServicePage() {
  const t = useTranslations("legal");
  const [activeSection, setActiveSection] = useState("introduction");
  const [isLoading, setIsLoading] = useState(false);
  const direction = t.dir;

  // Table of Contents sections
  const sections = [
    { id: "introduction", title: t("terms.sections.introduction"), level: 1 },
    { id: "definitions", title: t("terms.sections.definitions"), level: 1 },
    { id: "eligibility", title: t("terms.sections.eligibility"), level: 1 },
    { id: "services", title: t("terms.sections.services"), level: 1 },
    {
      id: "responsibilities",
      title: t("terms.sections.responsibilities"),
      level: 1,
    },
    {
      id: "intellectual-property",
      title: t("terms.sections.intellectualProperty"),
      level: 1,
    },
    { id: "payments", title: t("terms.sections.payments"), level: 1 },
    {
      id: "data-protection",
      title: t("terms.sections.dataProtection"),
      level: 1,
    },
    { id: "third-party", title: t("terms.sections.thirdParty"), level: 1 },
    { id: "disclaimers", title: t("terms.sections.disclaimers"), level: 1 },
    { id: "force-majeure", title: t("terms.sections.forceMajeure"), level: 1 },
    { id: "termination", title: t("terms.sections.termination"), level: 1 },
    {
      id: "dispute-resolution",
      title: t("terms.sections.disputeResolution"),
      level: 1,
    },
    {
      id: "general-provisions",
      title: t("terms.sections.generalProvisions"),
      level: 1,
    },
    { id: "contact", title: t("terms.sections.contact"), level: 1 },
  ];

  // Handle scroll for active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      // Find the current section based on scroll position
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
    const c = t.raw("terms.content");
    const sectionDefs: { id: string; ck: string; keys: string[] }[] = [
      {
        id: "introduction",
        ck: "introduction",
        keys: [
          "aboutTheseTerms",
          "acceptanceOfTerms",
          "acceptanceWarning",
          "amendments",
          "legalContinuity",
        ],
      },
      { id: "definitions", ck: "definitions", keys: ["intro"] },
      {
        id: "eligibility",
        ck: "eligibility",
        keys: [
          "ageRequirements",
          "parentalConsentProcess",
          "parentalConsentItem1",
          "parentalConsentItem2",
          "parentalConsentItem3",
          "accountRegistration",
          "accountSecurity",
          "accountTypes",
        ],
      },
      {
        id: "services",
        ck: "services",
        keys: [
          "educationalServices",
          "certificatesAndCredentials",
          "aiServices",
          "biFeatures",
        ],
      },
      {
        id: "responsibilities",
        ck: "responsibilities",
        keys: ["licenseToUse", "permittedUses", "prohibitedUses"],
      },
      {
        id: "intellectual-property",
        ck: "intellectualProperty",
        keys: ["ourIP", "userContentOwnership", "licenseToPodacium"],
      },
      {
        id: "payments",
        ck: "payments",
        keys: ["pricing", "paymentMethods", "taxes", "refundPolicy"],
      },
      {
        id: "data-protection",
        ck: "dataProtection",
        keys: ["privacyCommitment", "userRights", "dataRetention"],
      },
      {
        id: "third-party",
        ck: "thirdParty",
        keys: ["integrations", "liability"],
      },
      {
        id: "disclaimers",
        ck: "disclaimers",
        keys: [
          "educationalDisclaimer",
          "aiDisclaimer",
          "limitationOfLiability",
        ],
      },
      { id: "force-majeure", ck: "forceMajeure", keys: ["intro"] },
      { id: "termination", ck: "termination", keys: ["byUser", "byPodacium"] },
      {
        id: "dispute-resolution",
        ck: "disputeResolution",
        keys: ["governingLaw", "jurisdiction", "adr"],
      },
      {
        id: "general-provisions",
        ck: "generalProvisions",
        keys: ["entireAgreement", "language"],
      },
      {
        id: "contact",
        ck: "contact",
        keys: [
          "responseTimes",
          "responseTime1",
          "responseTime2",
          "responseTime3",
        ],
      },
    ];
    const sections = sectionDefs.map(({ ck, keys }) => ({
      title: t(`terms.sections.${ck}`),
      items: [
        t(`terms.sections.${ck}Desc`) as string,
        ...keys.map((k) => c[ck]?.[k]).filter(Boolean),
      ],
    }));
    downloadPageAsPdf(
      ".terms-content",
      "podacium-terms-of-service.pdf",
      {
        title: t("terms.hero.title"),
        locale: t.i18n.language,
        companyName: t("terms.company.name"),
        companyAddress: t("terms.company.fullAddress"),
        effectiveDate: t("terms.dates.effectiveDate"),
        version: t("terms.dates.version"),
      },
      sections,
    );
  };

  if (isLoading) {
    return <TermsSkeleton />;
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
        pageNamespace="terms"
        icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
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
                {t("terms.hero.badge")}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("terms.hero.title")}
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("terms.hero.description")}
              </p>

              {/* Quick Stats */}
              <div className="flex flex-wrap justify-center gap-6 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    15
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("terms.hero.sections")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">2026</div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("terms.hero.effectiveDate")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    1.0
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("terms.hero.version")}
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
                  {t("terms.actions.print")}
                </button>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                >
                  <Download className="w-4 h-4 me-2" />
                  {t("terms.actions.download")}
                </button>
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
              <div className="flex-1 terms-content">
                <LegalCompanyHeader
                  pageNamespace="terms"
                  mainIcon={
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  }
                />

                {/* 1. INTRODUCTION AND ACCEPTANCE */}
                <section id="introduction" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.introduction")}
                    description={t("terms.sections.introductionDesc")}
                    icon={<FileText className="w-6 h-6" />}
                    badge={t("terms.badges.important")}
                  />

                  <SubSection
                    title={t("terms.subSections.introduction.section1_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.introduction.aboutTheseTerms")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                      <HighlightCard
                        icon={<Shield className="w-5 h-5" />}
                        title={t("terms.cards.bindingAgreement.title")}
                        description={t(
                          "terms.cards.bindingAgreement.description",
                        )}
                        color="blue"
                      />
                      <HighlightCard
                        icon={<Users className="w-5 h-5" />}
                        title={t("terms.cards.governedByAlgerianLaw.title")}
                        description={t(
                          "terms.cards.governedByAlgerianLaw.description",
                        )}
                        color="green"
                      />
                    </div>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.introduction.section1_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.introduction.acceptanceOfTerms")}
                    </ContentBlock>

                    <ContentBlock type="warning">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("terms.content.introduction.acceptanceWarning")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.introduction.section1_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.introduction.amendments")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.introduction.section1_4")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.introduction.legalContinuity")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 2. DEFINITIONS */}
                <section id="definitions" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.definitions")}
                    description={t("terms.sections.definitionsDesc")}
                    icon={<BookOpen className="w-6 h-6" />}
                  />

                  <ContentBlock>
                    {t("terms.content.definitions.intro")}
                  </ContentBlock>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                    <HighlightCard
                      icon={<Brain className="w-5 h-5" />}
                      title={t("terms.definitions.aiServices.title")}
                      description={t(
                        "terms.definitions.aiServices.description",
                      )}
                      color="purple"
                    />
                    <HighlightCard
                      icon={<BarChart3 className="w-5 h-5" />}
                      title={t("terms.definitions.biFeatures.title")}
                      description={t(
                        "terms.definitions.biFeatures.description",
                      )}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<Briefcase className="w-5 h-5" />}
                      title={t(
                        "terms.definitions.freelancingMarketplace.title",
                      )}
                      description={t(
                        "terms.definitions.freelancingMarketplace.description",
                      )}
                      color="green"
                    />
                    <HighlightCard
                      icon={<Users className="w-5 h-5" />}
                      title={t("terms.definitions.userGeneratedContent.title")}
                      description={t(
                        "terms.definitions.userGeneratedContent.description",
                      )}
                      color="yellow"
                    />
                  </div>
                </section>

                {/* 3. ELIGIBILITY AND USER ACCOUNTS */}
                <section id="eligibility" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.eligibility")}
                    description={t("terms.sections.eligibilityDesc")}
                    icon={<Users className="w-6 h-6" />}
                    badge={t("terms.badges.important")}
                  />

                  <SubSection
                    title={t("terms.subSections.eligibility.section3_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.eligibility.ageRequirements")}
                    </ContentBlock>

                    <SubSection
                      title={t(
                        "terms.content.eligibility.parentalConsentProcess",
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
                                "terms.content.eligibility.parentalConsentItem1",
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "terms.content.eligibility.parentalConsentItem2",
                              )}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                            <span>
                              {t(
                                "terms.content.eligibility.parentalConsentItem3",
                              )}
                            </span>
                          </li>
                        </ul>
                      </ContentBlock>
                    </SubSection>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.eligibility.section3_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.eligibility.accountRegistration")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.eligibility.section3_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.eligibility.accountSecurity")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.eligibility.section3_4")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.eligibility.accountTypes")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 4. PLATFORM SERVICES */}
                <section id="services" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.services")}
                    description={t("terms.sections.servicesDesc")}
                    icon={<Briefcase className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("terms.subSections.services.section4_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.services.educationalServices")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.services.section4_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.services.certificatesAndCredentials")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.services.section4_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.services.aiServices")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.services.section4_4")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.services.biFeatures")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 5. USER RIGHTS AND RESPONSIBILITIES */}
                <section id="responsibilities" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.responsibilities")}
                    description={t("terms.sections.responsibilitiesDesc")}
                    icon={<Shield className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("terms.subSections.responsibilities.section5_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.responsibilities.licenseToUse")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.responsibilities.section5_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.responsibilities.permittedUses")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.responsibilities.section5_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.responsibilities.prohibitedUses")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 6. CONTENT AND INTELLECTUAL PROPERTY */}
                <section
                  id="intellectual-property"
                  className="scroll-mt-24 mb-12"
                >
                  <SectionHeader
                    title={t("terms.sections.intellectualProperty")}
                    description={t("terms.sections.intellectualPropertyDesc")}
                    icon={<Lock className="w-6 h-6" />}
                    badge={t("terms.badges.important")}
                  />

                  <SubSection
                    title={t(
                      "terms.subSections.intellectualProperty.section6_1",
                    )}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.intellectualProperty.ourIP")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t(
                      "terms.subSections.intellectualProperty.section6_2",
                    )}
                    level={3}
                  >
                    <ContentBlock>
                      {t(
                        "terms.content.intellectualProperty.userContentOwnership",
                      )}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t(
                      "terms.subSections.intellectualProperty.section6_3",
                    )}
                    level={3}
                  >
                    <ContentBlock>
                      {t(
                        "terms.content.intellectualProperty.licenseToPodacium",
                      )}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 7. PAYMENTS, FEES, AND REFUNDS */}
                <section id="payments" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.payments")}
                    description={t("terms.sections.paymentsDesc")}
                    icon={<DollarSign className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("terms.subSections.payments.section7_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.payments.pricing")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.payments.section7_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.payments.paymentMethods")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.payments.section7_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.payments.taxes")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.payments.section7_6")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.payments.refundPolicy")}
                    </ContentBlock>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                      <HighlightCard
                        icon={<Clock className="w-5 h-5" />}
                        title={t("terms.refunds.coolingOffPeriod.title")}
                        description={t(
                          "terms.refunds.coolingOffPeriod.description",
                        )}
                        color="green"
                      />
                      <HighlightCard
                        icon={<AlertCircle className="w-5 h-5" />}
                        title={t("terms.refunds.nonRefundable.title")}
                        description={t(
                          "terms.refunds.nonRefundable.description",
                        )}
                        color="yellow"
                      />
                      <HighlightCard
                        icon={<Shield className="w-5 h-5" />}
                        title={t("terms.refunds.consent.title")}
                        description={t("terms.refunds.consent.description")}
                        color="blue"
                      />
                    </div>
                  </SubSection>
                </section>

                {/* 8. DATA PROTECTION AND PRIVACY */}
                <section id="data-protection" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.dataProtection")}
                    description={t("terms.sections.dataProtectionDesc")}
                    icon={<Shield className="w-6 h-6" />}
                    badge={t("terms.badges.important")}
                  />

                  <SubSection
                    title={t("terms.subSections.dataProtection.section8_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.dataProtection.privacyCommitment")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.dataProtection.section8_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.dataProtection.userRights")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.dataProtection.section8_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.dataProtection.dataRetention")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 9. THIRD-PARTY SERVICES AND LINKS */}
                <section id="third-party" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.thirdParty")}
                    description={t("terms.sections.thirdPartyDesc")}
                    icon={<Globe className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("terms.subSections.thirdParty.section9_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.thirdParty.integrations")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.thirdParty.section9_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.thirdParty.liability")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 10. DISCLAIMERS AND LIMITATION OF LIABILITY */}
                <section id="disclaimers" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.disclaimers")}
                    description={t("terms.sections.disclaimersDesc")}
                    icon={<AlertCircle className="w-6 h-6" />}
                    badge={t("terms.badges.important")}
                  />

                  <SubSection
                    title={t("terms.subSections.disclaimers.section10_1")}
                    level={3}
                  >
                    <ContentBlock type="warning">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("terms.content.disclaimers.educationalDisclaimer")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.disclaimers.section10_2")}
                    level={3}
                  >
                    <ContentBlock type="warning">
                      <div
                        className={`flex ${direction === "rtl" ? "text-right" : ""} items-start gap-3`}
                      >
                        <Brain className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span>
                          {t("terms.content.disclaimers.aiDisclaimer")}
                        </span>
                      </div>
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.disclaimers.section10_4")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.disclaimers.limitationOfLiability")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 11. FORCE MAJEURE */}
                <section id="force-majeure" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.forceMajeure")}
                    description={t("terms.sections.forceMajeureDesc")}
                    icon={<AlertCircle className="w-6 h-6" />}
                  />

                  <ContentBlock>
                    {t("terms.content.forceMajeure.intro")}
                  </ContentBlock>
                </section>

                {/* 12. ACCOUNT SUSPENSION AND TERMINATION */}
                <section id="termination" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.termination")}
                    description={t("terms.sections.terminationDesc")}
                    icon={<Shield className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("terms.subSections.termination.section12_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.termination.byUser")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.termination.section12_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.termination.byPodacium")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 13. DISPUTE RESOLUTION */}
                <section id="dispute-resolution" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.disputeResolution")}
                    description={t("terms.sections.disputeResolutionDesc")}
                    icon={<Shield className="w-6 h-6" />}
                    badge={t("terms.badges.important")}
                  />

                  <SubSection
                    title={t("terms.subSections.disputeResolution.section13_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.disputeResolution.governingLaw")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.disputeResolution.section13_2")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.disputeResolution.jurisdiction")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.disputeResolution.section13_3")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.disputeResolution.adr")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 14. GENERAL PROVISIONS */}
                <section id="general-provisions" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.generalProvisions")}
                    description={t("terms.sections.generalProvisionsDesc")}
                    icon={<FileText className="w-6 h-6" />}
                  />

                  <SubSection
                    title={t("terms.subSections.generalProvisions.section14_1")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.generalProvisions.entireAgreement")}
                    </ContentBlock>
                  </SubSection>

                  <SubSection
                    title={t("terms.subSections.generalProvisions.section14_5")}
                    level={3}
                  >
                    <ContentBlock>
                      {t("terms.content.generalProvisions.language")}
                    </ContentBlock>
                  </SubSection>
                </section>

                {/* 15. CONTACT INFORMATION */}
                <section id="contact" className="scroll-mt-24 mb-12">
                  <SectionHeader
                    title={t("terms.sections.contact")}
                    description={t("terms.sections.contactDesc")}
                    icon={<Mail className="w-6 h-6" />}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <HighlightCard
                      icon={<Mail className="w-5 h-5" />}
                      title={t("terms.contact.email.title")}
                      description={t.forceLTR(t("terms.company.email"))}
                      color="blue"
                    />
                    <HighlightCard
                      icon={<Phone className="w-5 h-5" />}
                      title={t("terms.contact.phone.title")}
                      description={t.forceLTR(t("terms.company.phone"))}
                      color="green"
                    />
                    <HighlightCard
                      icon={<MapPin className="w-5 h-5" />}
                      title={t("terms.contact.address.title")}
                      description={t("terms.company.fullAddress")}
                      color="purple"
                    />
                    <HighlightCard
                      icon={<Globe className="w-5 h-5" />}
                      title={t("terms.contact.website.title")}
                      description={t.forceLTR(t("terms.company.website"))}
                      color="yellow"
                    />
                  </div>

                  <div className="mt-6">
                    <SubSection
                      title={t("terms.content.contact.responseTimes")}
                      level={4}
                    >
                      <ContentBlock type="list">
                        <ul
                          className={`space-y-2 ${direction === "rtl" ? "list-none" : ""}`}
                        >
                          <li className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                            <span>
                              {t("terms.content.contact.responseTime1")}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                            <span>
                              {t("terms.content.contact.responseTime2")}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                            <span>
                              {t("terms.content.contact.responseTime3")}
                            </span>
                          </li>
                        </ul>
                      </ContentBlock>
                    </SubSection>
                  </div>
                </section>

                {/* 16. ACKNOWLEDGMENT */}
                <section className="mt-16 pt-12 border-t border-gray-200 dark:border-slate-800">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 rounded-2xl p-8 border border-blue-200 dark:border-blue-800/80">
                    <div className="text-center">
                      <Shield className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                        {t("terms.acknowledgment.title")}
                      </h3>
                      <p className="text-gray-700 dark:text-slate-300 mb-6 max-w-2xl mx-auto">
                        {t("terms.acknowledgment.description")}
                      </p>
                      <div
                        className={`flex ${direction === "rtl" ? "space-x-reverse" : ""} space-x-4 justify-center flex-wrap gap-4`}
                      >
                        <Link
                          href="/privacy"
                          className="inline-flex items-center text-green-600 hover:text-green-700 font-semibold"
                        >
                          {t("terms.actions.viewPrivacy")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                        <Link
                          href="/cookies"
                          className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 font-semibold"
                        >
                          {t("terms.actions.viewCookiePolicy")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                        <Link
                          href="/refund"
                          className="inline-flex items-center text-amber-600 dark:text-amber-400 hover:text-amber-700 font-semibold"
                        >
                          {t("terms.actions.viewRefund")}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 text-center text-gray-600 dark:text-slate-400 text-sm">
                    <p>{t("terms.footer.thankYou")}</p>
                    <p className="mt-2">
                      {t("terms.lastUpdated")}: {t("terms.dates.lastUpdated")} •{" "}
                      {t("terms.version")}: {t("terms.dates.version")} •{" "}
                      {t("terms.effectiveDate")}:{" "}
                      {t("terms.dates.effectiveDate")}
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
