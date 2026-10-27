// app/partners/page.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Handshake,
  Building2,
  GraduationCap,
  Briefcase,
  Target,
  Globe,
  ArrowUpRight,
  Mail,
  ExternalLink,
  Sparkles,
  CheckCircle,
  Award,
  Shield,
  TrendingUp,
  BookOpen,
  Cpu,
  Database,
  MessageCircle,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, ContactFormRequest, handleApiError } from "@/lib/api";
import ESEOranLogo from "@/components/logo/ese-logo.png";
import { useTranslations } from "@/lib/i18n";
import { PodaciumSpotlightCard } from "@/components/design-system/PodaciumSpotlightCard";

// =============================================================================
// ANIMATION CONFIGURATION (Consistent with about/page.tsx)
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
// TYPES & INTERFACES
// =============================================================================

interface PartnerFormData {
  name: string;
  email: string;
  organization: string;
  message: string;
  partnerType: "university" | "business" | "ngo" | "investor" | "other";
  phone?: string;
}

interface PartnershipType {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  benefits: string[];
  color: string;
  gradient: string;
}

interface PartnerBenefit {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

// =============================================================================
// DATA & CONSTANTS
// =============================================================================

const createPartnershipTypes = (
  t: (key: string) => string,
): PartnershipType[] => [
  {
    id: 1,
    title: t("partners.partnershipTypes.university.title"),
    description: t("partners.partnershipTypes.university.description"),
    icon: <GraduationCap className="w-6 h-6" />,
    benefits: [
      t("partners.partnershipTypes.university.benefits.0"),
      t("partners.partnershipTypes.university.benefits.1"),
      t("partners.partnershipTypes.university.benefits.2"),
      t("partners.partnershipTypes.university.benefits.3"),
    ],
    color: "text-blue-500",
    gradient:
      "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800",
  },
  {
    id: 2,
    title: t("partners.partnershipTypes.business.title"),
    description: t("partners.partnershipTypes.business.description"),
    icon: <Building2 className="w-6 h-6" />,
    benefits: [
      t("partners.partnershipTypes.business.benefits.0"),
      t("partners.partnershipTypes.business.benefits.1"),
      t("partners.partnershipTypes.business.benefits.2"),
      t("partners.partnershipTypes.business.benefits.3"),
    ],
    color: "text-green-500",
    gradient: "bg-gradient-to-br from-green-50 to-emerald-50",
  },
  {
    id: 3,
    title: t("partners.partnershipTypes.innovator.title"),
    description: t("partners.partnershipTypes.innovator.description"),
    icon: <TrendingUp className="w-6 h-6" />,
    benefits: [
      t("partners.partnershipTypes.innovator.benefits.0"),
      t("partners.partnershipTypes.innovator.benefits.1"),
      t("partners.partnershipTypes.innovator.benefits.2"),
      t("partners.partnershipTypes.innovator.benefits.3"),
    ],
    color: "text-purple-500",
    gradient: "bg-gradient-to-br from-purple-50 to-pink-50",
  },
  {
    id: 4,
    title: t("partners.partnershipTypes.government.title"),
    description: t("partners.partnershipTypes.government.description"),
    icon: <Globe className="w-6 h-6" />,
    benefits: [
      t("partners.partnershipTypes.government.benefits.0"),
      t("partners.partnershipTypes.government.benefits.1"),
      t("partners.partnershipTypes.government.benefits.2"),
      t("partners.partnershipTypes.government.benefits.3"),
    ],
    color: "text-orange-500",
    gradient: "bg-gradient-to-br from-orange-50 to-amber-50",
  },
];

const createPartnerBenefits = (
  t: (key: string) => string,
): PartnerBenefit[] => [
  {
    id: 1,
    title: t("partners.benefits.talentPipeline.title"),
    description: t("partners.benefits.talentPipeline.description"),
    icon: <Users className="w-5 h-5" />,
    color: "text-blue-500",
  },
  {
    id: 2,
    title: t("partners.benefits.brandVisibility.title"),
    description: t("partners.benefits.brandVisibility.description"),
    icon: <Target className="w-5 h-5" />,
    color: "text-green-500",
  },
  {
    id: 3,
    title: t("partners.benefits.technologyAccess.title"),
    description: t("partners.benefits.technologyAccess.description"),
    icon: <Cpu className="w-5 h-5" />,
    color: "text-purple-500",
  },
  {
    id: 4,
    title: t("partners.benefits.marketInsights.title"),
    description: t("partners.benefits.marketInsights.description"),
    icon: <Database className="w-5 h-5" />,
    color: "text-orange-500",
  },
  {
    id: 5,
    title: t("partners.benefits.communityImpact.title"),
    description: t("partners.benefits.communityImpact.description"),
    icon: <Handshake className="w-5 h-5" />,
    color: "text-red-500",
  },
  {
    id: 6,
    title: t("partners.benefits.revenueShare.title"),
    description: t("partners.benefits.revenueShare.description"),
    icon: <Briefcase className="w-5 h-5" />,
    color: "text-indigo-500",
  },
];

const createCurrentPartners = (t: (key: string) => string) => [
  {
    id: 1,
    name: t("partners.currentPartners.eseOran.name"),
    description: t("partners.currentPartners.eseOran.description"),
    logo: ESEOranLogo,
    type: "university",
    established: t("partners.currentPartners.eseOran.established"),
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
];

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

interface PartnershipCardProps {
  partnership: PartnershipType;
  index: number;
}

const PARTNERSHIP_TONES = ["blue", "indigo", "purple", "brand"] as const;

const PartnershipCard: React.FC<PartnershipCardProps> = ({
  partnership,
  index,
}) => {
  return (
    <PodaciumSpotlightCard
      tone={PARTNERSHIP_TONES[index % PARTNERSHIP_TONES.length]}
      strength={8}
      depth={0.35}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="h-full"
      contentClassName="p-8"
    >
      <div className="p-3 rounded-xl bg-white/15 w-fit mb-6">
        {partnership.icon}
      </div>
      <h3 className="text-2xl font-bold text-white mb-4">
        {partnership.title}
      </h3>
      <p className="text-white/85 mb-6 leading-relaxed">
        {partnership.description}
      </p>
      <ul className="space-y-3">
        {partnership.benefits.map((benefit, idx) => (
          <li key={idx} className="flex items-start text-white/90">
            <CheckCircle className="w-4 h-4 me-2 mt-0.5 shrink-0 text-white/80" />
            <span className="text-sm">{benefit}</span>
          </li>
        ))}
      </ul>
    </PodaciumSpotlightCard>
  );
};

interface BenefitCardProps {
  benefit: PartnerBenefit;
  index: number;
}

const BenefitCard: React.FC<BenefitCardProps> = ({ benefit, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="group bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 hover:shadow-lg transition-all duration-300 hover:border-blue-200 dark:border-blue-800/80"
    >
      <div
        className={`p-3 rounded-lg ${benefit.color} bg-opacity-10 w-fit mb-4 group-hover:scale-110 transition-transform duration-300`}
      >
        {benefit.icon}
      </div>
      <h4 className="font-bold text-gray-900 dark:text-slate-100 text-lg mb-2">
        {benefit.title}
      </h4>
      <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">
        {benefit.description}
      </p>
    </motion.div>
  );
};

interface PartnerLogoCardProps {
  partner: ReturnType<typeof createCurrentPartners>[0];
}

const PartnerLogoCard: React.FC<PartnerLogoCardProps> = ({ partner }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ y: -8, scale: 1.02 }}
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl border ${partner.borderColor} p-8 shadow-md hover:shadow-xl transition-all duration-300`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="relative z-10 text-center space-y-6">
        <div
          className={`${partner.bgColor} rounded-xl p-6 mx-auto w-32 h-32 flex items-center justify-center`}
        >
          {typeof partner.logo === "string" ? (
            <img
              src={partner.logo}
              alt={partner.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={partner.logo.src}
              alt={partner.name}
              className="w-full h-full object-contain"
            />
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {partner.name}
          </h3>
          <p className="text-gray-600 dark:text-slate-400 text-sm">
            {partner.description}
          </p>
          <div className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
            {partner.established}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </motion.div>
  );
};

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function PartnersPage() {
  const { isAuthenticated, user } = useAuth();
  const t = useTranslations();
  const [formData, setFormData] = useState<PartnerFormData>({
    name: "",
    email: "",
    organization: "",
    message: "",
    partnerType: "business",
    phone: "",
  });
  const [errors, setErrors] = useState<Partial<PartnerFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Create dynamic data based on translations
  const PARTNERSHIP_TYPES = createPartnershipTypes(t);
  const PARTNER_BENEFITS = createPartnerBenefits(t);
  const CURRENT_PARTNERS = createCurrentPartners(t);

  // Pre-fill form for authenticated users
  React.useEffect(() => {
    if (isAuthenticated && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.fullName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        organization: user.role === "BUSINESS" ? prev.organization || "" : "",
      }));
    }
  }, [isAuthenticated, user]);

  const validateForm = (): boolean => {
    const newErrors: Partial<PartnerFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("partners.form.errors.nameRequired");
    }

    if (!formData.email.trim()) {
      newErrors.email = t("partners.form.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("partners.form.errors.emailInvalid");
    }

    if (!formData.organization.trim()) {
      newErrors.organization = t("partners.form.errors.organizationRequired");
    }

    if (!formData.message.trim()) {
      newErrors.message = t("partners.form.errors.messageRequired");
    } else if (formData.message.length < 20) {
      newErrors.message = t("partners.form.errors.messageTooShort");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const contactData: ContactFormRequest = {
        name: formData.name,
        email: formData.email,
        message: `${t("partners.form.emailSubject", { type: formData.partnerType })}\n${t("partners.form.emailOrganization")}: ${formData.organization}\n${t("partners.form.emailPhone")}: ${formData.phone || t("partners.form.emailPhoneNotProvided")}\n\n${t("partners.form.emailMessage")}: ${formData.message}`,
        phone: formData.phone,
        subject: t("partners.form.emailSubjectFull", {
          organization: formData.organization,
        }),
        category: "partnership",
      };

      await api.submitContactForm(contactData);

      setIsSuccess(true);
      setFormData({
        name: "",
        email: "",
        organization: "",
        message: "",
        partnerType: "business",
        phone: "",
      });

      setTimeout(() => setIsSuccess(false), 5000);
    } catch (error) {
      setSubmitError(handleApiError(error));
      console.error("Partnership form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof PartnerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const scrollToForm = () => {
    document
      .getElementById("partner-form")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  // Get direction from locale for RTL support
  const isRTL = false; // This would come from your i18n config

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
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
                className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg"
              >
                <Handshake className="w-4 h-4 ml-2 mr-2" />
                {t("partners.hero.badge")}
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                {t("partners.hero.title.prefix")}{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {t("partners.hero.title.highlight")}
                </span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("partners.hero.description")}
              </p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row justify-center gap-4 pt-4"
              >
                <button
                  onClick={scrollToForm}
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <Handshake className="w-5 h-5 ml-2 mr-2" />
                  {t("partners.hero.buttons.becomePartner")}
                  <ArrowUpRight className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </button>

                <a
                  href={`mailto:${t("partners.contact.email")}`}
                  className="group inline-flex items-center justify-center px-8 py-3.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all duration-300 shadow-lg hover:shadow-xl border-2 border-blue-200 dark:border-blue-800/80"
                >
                  <Mail className="w-5 h-5 ml-2 mr-2" />
                  {t("partners.hero.buttons.emailUs")}
                  <ExternalLink className="w-5 h-5 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Partnership Benefits */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                {t("partners.benefitsSection.title.prefix")}{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {t("partners.benefitsSection.title.highlight")}
                </span>
                {t("partners.benefitsSection.title.suffix")}
              </h2>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("partners.benefitsSection.description")}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
              {PARTNER_BENEFITS.map((benefit, index) => (
                <BenefitCard key={benefit.id} benefit={benefit} index={index} />
              ))}
            </div>

            {/* Partnership Types */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mb-20"
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                  {t("partners.partnershipTypesSection.title")}
                </h2>
                <p className="text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
                  {t("partners.partnershipTypesSection.description")}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {PARTNERSHIP_TYPES.map((partnership, index) => (
                  <PartnershipCard
                    key={partnership.id}
                    partnership={partnership}
                    index={index}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Current Partners */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                {t("partners.currentPartnersSection.title")}
              </h2>
              <p className="text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
                {t("partners.currentPartnersSection.description")}
              </p>
            </motion.div>

            {/* Current Partners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {CURRENT_PARTNERS.map((partner) => (
                <PartnerLogoCard key={partner.id} partner={partner} />
              ))}
            </div>

            {/* Coming Soon Notice */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 dark:from-purple-950/60 dark:to-pink-950/60 dark:text-purple-300 dark:text-purple-300 rounded-full text-sm font-semibold mb-4">
                <Sparkles className="w-4 h-4 ml-2 mr-2" />
                {t("partners.currentPartnersSection.comingSoon.badge")}
              </div>
              <p className="text-gray-600 dark:text-slate-400">
                {t("partners.currentPartnersSection.comingSoon.description")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Partner With Us Form */}
        <section
          id="partner-form"
          className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900"
        >
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-700/30 to-indigo-700/30"></div>
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]"></div>

              <div className="relative z-10">
                <div className="text-center mb-10">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-6 shadow-lg"
                  >
                    <Handshake className="w-4 h-4 ml-2 mr-2" />
                    {t("partners.form.badge")}
                  </motion.div>

                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    {t("partners.form.title")}
                  </h2>

                  <p className="text-blue-200 max-w-2xl mx-auto">
                    {t("partners.form.description.prefix")}{" "}
                    <a
                      href={`mailto:${t("partners.contact.email")}`}
                      className="text-white hover:underline font-medium"
                    >
                      {t("partners.contact.email")}
                    </a>
                  </p>
                </div>

                {isSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 backdrop-blur-sm rounded-2xl p-8 text-center border border-green-500/20"
                  >
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold mb-4">
                      {t("partners.form.success.title")}
                    </h3>
                    <p className="text-green-200 mb-6">
                      {t("partners.form.success.description")}
                    </p>
                    <button
                      onClick={() => setIsSuccess(false)}
                      className="px-6 py-3 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors duration-200"
                    >
                      {t("partners.form.success.button")}
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name & Email */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-blue-200 mb-2"
                        >
                          {t("partners.form.labels.name")}
                        </label>
                        <input
                          type="text"
                          id="name"
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          className={`w-full px-4 py-3 bg-white/10 backdrop-blur-sm border ${
                            errors.name ? "border-red-400" : "border-white/20"
                          } rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-white placeholder-blue-300`}
                          placeholder={t("partners.form.placeholders.name")}
                        />
                        {errors.name && (
                          <p className="mt-1 text-sm text-red-300">
                            {errors.name}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium text-blue-200 mb-2"
                        >
                          {t("partners.form.labels.email")}
                        </label>
                        <input
                          type="email"
                          id="email"
                          value={formData.email}
                          onChange={(e) =>
                            handleChange("email", e.target.value)
                          }
                          className={`w-full px-4 py-3 bg-white/10 backdrop-blur-sm border ${
                            errors.email ? "border-red-400" : "border-white/20"
                          } rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-white placeholder-blue-300`}
                          placeholder={t("partners.form.placeholders.email")}
                        />
                        {errors.email && (
                          <p className="mt-1 text-sm text-red-300">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Organization & Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label
                          htmlFor="organization"
                          className="block text-sm font-medium text-blue-200 mb-2"
                        >
                          {t("partners.form.labels.organization")}
                        </label>
                        <input
                          type="text"
                          id="organization"
                          value={formData.organization}
                          onChange={(e) =>
                            handleChange("organization", e.target.value)
                          }
                          className={`w-full px-4 py-3 bg-white/10 backdrop-blur-sm border ${
                            errors.organization
                              ? "border-red-400"
                              : "border-white/20"
                          } rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-white placeholder-blue-300`}
                          placeholder={t(
                            "partners.form.placeholders.organization",
                          )}
                        />
                        {errors.organization && (
                          <p className="mt-1 text-sm text-red-300">
                            {errors.organization}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="phone"
                          className="block text-sm font-medium text-blue-200 mb-2"
                        >
                          {t("partners.form.labels.phone")}
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          value={formData.phone}
                          onChange={(e) =>
                            handleChange("phone", e.target.value)
                          }
                          className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-white placeholder-blue-300"
                          placeholder={t("partners.form.placeholders.phone")}
                        />
                      </div>
                    </div>

                    {/* Partner Type */}
                    <div>
                      <label
                        htmlFor="partnerType"
                        className="block text-sm font-medium text-blue-200 mb-2"
                      >
                        {t("partners.form.labels.partnerType")}
                      </label>
                      <select
                        id="partnerType"
                        value={formData.partnerType}
                        onChange={(e) =>
                          handleChange("partnerType", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-white"
                      >
                        <option
                          value="university"
                          className="bg-slate-900 text-white"
                        >
                          {t("partners.form.options.university")}
                        </option>
                        <option
                          value="business"
                          className="bg-slate-900 text-white"
                        >
                          {t("partners.form.options.business")}
                        </option>
                        <option value="ngo" className="bg-slate-900 text-white">
                          {t("partners.form.options.ngo")}
                        </option>
                        <option
                          value="investor"
                          className="bg-slate-900 text-white"
                        >
                          {t("partners.form.options.investor")}
                        </option>
                        <option
                          value="other"
                          className="bg-slate-900 text-white"
                        >
                          {t("partners.form.options.other")}
                        </option>
                      </select>
                    </div>

                    {/* Message */}
                    <div>
                      <label
                        htmlFor="message"
                        className="block text-sm font-medium text-blue-200 mb-2"
                      >
                        {t("partners.form.labels.message")}
                      </label>
                      <textarea
                        id="message"
                        rows={5}
                        value={formData.message}
                        onChange={(e) =>
                          handleChange("message", e.target.value)
                        }
                        className={`w-full px-4 py-3 bg-white/10 backdrop-blur-sm border ${
                          errors.message ? "border-red-400" : "border-white/20"
                        } rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-white placeholder-blue-300 resize-none`}
                        placeholder={t("partners.form.placeholders.message")}
                      />
                      {errors.message && (
                        <p className="mt-1 text-sm text-red-300">
                          {errors.message}
                        </p>
                      )}
                    </div>

                    {/* Submit Button & Error */}
                    <div className="space-y-4">
                      {submitError && (
                        <div className="bg-red-900/30 backdrop-blur-sm border border-red-500/20 rounded-xl p-4">
                          <p className="text-red-200 text-sm">{submitError}</p>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-4">
                        <motion.button
                          type="submit"
                          disabled={isSubmitting}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="group flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? (
                            <span className="flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin ml-2 mr-2"></div>
                              {t("partners.form.buttons.submitting")}
                            </span>
                          ) : (
                            <span className="flex items-center justify-center">
                              <Handshake className="w-5 h-5 ml-2 mr-2" />
                              {t("partners.form.buttons.submit")}
                              <ArrowUpRight className="w-4 h-4 ml-2 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                            </span>
                          )}
                        </motion.button>

                        <a
                          href={`mailto:${t("partners.contact.email")}`}
                          className="group inline-flex items-center justify-center px-6 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white/15 transition-all duration-300"
                        >
                          <Mail className="w-5 h-5 ml-2 mr-2" />
                          {t("partners.form.buttons.emailDirectly")}
                        </a>
                      </div>

                      <p className="text-blue-300 text-sm text-center">
                        {t("partners.form.responseTime")}
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Additional Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 text-center"
            >
              <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {t("partners.contact.emailLabel")}
                    </p>
                    <a
                      href={`mailto:${t("partners.contact.email")}`}
                      className="font-bold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                    >
                      {t("partners.contact.email")}
                    </a>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {t("partners.contact.locationLabel")}
                    </p>
                    <p className="font-bold text-gray-900 dark:text-slate-100">
                      {t("partners.contact.location")}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
