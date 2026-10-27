"use client";

import React, { useState, Suspense, lazy, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  HelpCircle,
  MessageSquare,
  Mail,
  Search,
  BookOpen,
  GraduationCap,
  Briefcase,
  BarChart3,
  CreditCard,
  User,
  ArrowRight,
  Users,
  Send,
  AlertCircle,
  Sparkles,
  FileText,
  Clock,
  LayoutGrid,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import FAQAccordion from "@/components/FAQAccordion";

const Footer = lazy(() => import("@/components/Footer"));

// Animation configurations matching BI/Learn/Hub design system
const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    STANDARD: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  STAGGER: {
    FAST: 0.05,
    NORMAL: 0.1,
  },
};

// Safe array access helper
const safeArray = (
  val: unknown,
): Array<{ question: string; answer: string; category?: string }> => {
  if (Array.isArray(val))
    return val as Array<{
      question: string;
      answer: string;
      category?: string;
    }>;
  return [];
};

// Support Card Component
interface SupportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  href?: string;
  onClick?: () => void;
  color: "blue" | "purple" | "green" | "orange";
  delay?: number;
}

const SupportCard: React.FC<SupportCardProps> = ({
  icon,
  title,
  description,
  action,
  href,
  onClick,
  color,
  delay = 0,
}) => {
  const colorClasses = {
    blue: {
      bg: "from-blue-100 to-indigo-100",
      text: "text-blue-600",
      border: "hover:border-blue-300 hover:shadow-blue-200/50",
      button: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20",
    },
    purple: {
      bg: "from-purple-100 to-pink-100",
      text: "text-purple-600",
      border: "hover:border-purple-300 hover:shadow-purple-200/50",
      button: "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20",
    },
    green: {
      bg: "from-green-100 to-emerald-100",
      text: "text-green-600",
      border: "hover:border-green-300 hover:shadow-green-200/50",
      button: "bg-green-600 hover:bg-green-700 shadow-green-500/20",
    },
    orange: {
      bg: "from-orange-100 to-amber-100",
      text: "text-orange-600",
      border: "hover:border-orange-300 hover:shadow-orange-200/50",
      button: "bg-orange-600 hover:bg-orange-700 shadow-orange-500/20",
    },
  };
  const colors = colorClasses[color];

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className={`group relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-3xl border border-gray-200/50 dark:border-slate-800/50 shadow-md p-8 hover:shadow-xl transition-all duration-300 flex flex-col h-full ${colors.border}`}
    >
      <div
        className={`p-4 rounded-2xl bg-gradient-to-br ${colors.bg} w-fit mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300 group-hover:rotate-3`}
      >
        <div className={colors.text}>{icon}</div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-3">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-slate-400 mb-8 leading-relaxed flex-grow">
        {description}
      </p>
      <span
        className={`inline-flex justify-center items-center w-full py-3 text-white font-semibold rounded-xl shadow-md transition-colors mt-auto ${colors.button}`}
      >
        {action}{" "}
        <ArrowRight className="w-5 h-5 ml-2 rtl:ml-0 rtl:mr-2 rtl:rotate-180 group-hover:translate-x-1 transition-transform" />
      </span>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block w-full">
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="text-left w-full h-full">
      {content}
    </button>
  );
};

// Category Badge Component
const CategoryBadge: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95 ${
      active
        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600 ring-offset-2"
        : "bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200/60 dark:border-slate-800/80 hover:border-blue-300 hover:bg-blue-50/50 hover:text-gray-900 dark:hover:text-white shadow-sm"
    }`}
  >
    {icon}
    {label}
  </button>
);

// Fallback FAQs (only shown when translations fail to load)
const fallbackFAQs: Array<{
  category: string;
  question: string;
  answer: string;
}> = [];

// Main Help Page
export default function HelpPage() {
  const t = useTranslations("help");
  const { dir } = useBidi();
  const { user, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  // Contact form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formCategory, setFormCategory] = useState("other");
  const [formMessage, setFormMessage] = useState("");
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formSuccessTicket, setFormSuccessTicket] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("open-help-launcher", {
            detail: { view: "ticket", subject: formSubject || formName },
          }),
        );
      }
      return;
    }

    if (formSubject.trim().length < 3) {
      setFormError(t("formSubjectMin"));
      return;
    }
    if (formMessage.trim().length < 10) {
      setFormError(t("formMessageMin"));
      return;
    }

    const categoryMap: Record<string, string> = {
      account: "ACCOUNT",
      learning: "LEARNING",
      hub: "HUB",
      bi: "BI",
      billing: "BILLING",
      technical: "GENERAL",
      other: "GENERAL",
    };

    setIsSubmittingForm(true);
    try {
      const res = (await api.post("/api/v1/tickets", {
        subject: formSubject.trim(),
        message: `[Contact Form - ${formName || user?.fullName || "Utilisateur"} (${formEmail || user?.email || "email"})]\n\n${formMessage.trim()}`,
        category: categoryMap[formCategory] || "GENERAL",
        priority: "NORMAL",
      })) as { ticket_number?: string; id?: number };

      setFormSuccessTicket(res.ticket_number || "Support Ticket");
      setFormSubject("");
      setFormMessage("");
    } catch (err: unknown) {
      console.error("Failed to submit contact ticket:", err);
      setFormError(t("ticketSubmitFailed"));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const categories = useMemo(
    () => [
      {
        id: "all",
        icon: <LayoutGrid className="w-4 h-4" />,
        label: t("categories.all"),
      },
      {
        id: "account",
        icon: <User className="w-4 h-4" />,
        label: t("categories.account"),
      },
      {
        id: "learning",
        icon: <GraduationCap className="w-4 h-4" />,
        label: t("categories.learning"),
      },
      {
        id: "hub",
        icon: <Briefcase className="w-4 h-4" />,
        label: t("categories.hub"),
      },
      {
        id: "bi",
        icon: <BarChart3 className="w-4 h-4" />,
        label: t("categories.bi"),
      },
      {
        id: "billing",
        icon: <CreditCard className="w-4 h-4" />,
        label: t("categories.billing"),
      },
    ],
    [t],
  );

  const faqs = useMemo(() => {
    try {
      const translatedFAQs = safeArray(t.raw("faqs"));
      return translatedFAQs.length ? translatedFAQs : fallbackFAQs;
    } catch {
      return fallbackFAQs;
    }
  }, [t]);

  const filteredFAQs =
    activeCategory === "all"
      ? faqs
      : faqs.filter((faq) => faq.category === activeCategory);

  const supportOptions = useMemo(
    () => [
      {
        icon: <MessageSquare className="w-7 h-7" />,
        title: t("support.liveChat.title"),
        description: t("support.liveChat.description"),
        action: t("support.liveChat.action"),
        color: "blue" as const,
        onClick: () => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("open-help-launcher", {
                detail: { view: "aiChat" },
              }),
            );
          }
        },
      },
      {
        icon: <Mail className="w-7 h-7" />,
        title: t("support.email.title"),
        description: t("support.email.description"),
        action: t("support.email.action"),
        href: "/contact",
        color: "purple" as const,
      },
      {
        icon: <BookOpen className="w-7 h-7" />,
        title: t("support.docs.title"),
        description: t("support.docs.description"),
        action: t("support.docs.action"),
        href: "/docs",
        color: "green" as const,
      },
      {
        icon: <Users className="w-7 h-7" />,
        title: t("support.community.title"),
        description: t("support.community.description"),
        action: t("support.community.action"),
        href: "#",
        color: "orange" as const,
      },
    ],
    [t],
  );

  return (
    <div
      dir={dir}
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100 selection:bg-blue-200 dark:bg-blue-800/80 selection:text-blue-900 dark:text-blue-100"
    >
      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-purple-50/80 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-900/90"></div>

        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-blue-200/40 to-indigo-300/20 rounded-full filter blur-3xl opacity-50 mix-blend-multiply pointer-events-none transform translate-x-1/3 -translate-y-1/4"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-purple-200/40 to-pink-300/20 rounded-full filter blur-3xl opacity-50 mix-blend-multiply pointer-events-none transform -translate-x-1/3 translate-y-1/4"></div>

        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={ANIMATION_CONFIGS.EASING.ENTER}
            className="text-center"
          >
            <span className="inline-flex items-center px-5 py-2.5 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-md text-blue-700 dark:text-blue-300 text-sm font-semibold mb-8 border border-blue-100 dark:border-blue-900/50 dark:border-blue-900/50 shadow-sm uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-blue-500 dark:text-blue-400" />
              {t("hero.badge")}
            </span>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 dark:text-slate-100 mb-8 tracking-tight">
              {t("hero.title")}{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {t("hero.titleHighlight")}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
              {t("hero.subtitle")}
            </p>

            {/* Search Bar */}
            <div className="max-w-3xl mx-auto group relative">
              <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl transition-all duration-300 group-hover:bg-blue-500/10"></div>
              <div className="relative flex items-center bg-white dark:bg-slate-900/95 backdrop-blur-lg border border-gray-200/60 dark:border-slate-800/80 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:border-blue-300/50 dark:border-blue-700 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500">
                <Search className="absolute start-5 w-6 h-6 text-gray-400 group-focus-within:text-blue-500 dark:text-blue-400 transition-colors pointer-events-none" />
                <input
                  type="text"
                  placeholder={t("hero.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full ps-14 pe-12 py-5 bg-transparent focus:outline-none text-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 rounded-2xl text-start"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label={t("hero.clearSearch")}
                    className="absolute end-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Links / Categories Map */}
      <section className="sticky top-20 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-y border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto hide-scrollbar py-4 justify-start md:justify-center gap-3 md:gap-4">
            {categories.map((category) => (
              <CategoryBadge
                key={category.id}
                icon={category.icon}
                label={category.label}
                active={activeCategory === category.id}
                onClick={() => setActiveCategory(category.id)}
              />
            ))}
          </div>
        </div>
      </section>

      <main className="pb-24">
        {/* FAQ Section */}
        <section className="py-24 scroll-mt-32">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <FAQAccordion
              items={filteredFAQs}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              title={t("faq.title")}
              subtitle={t("faq.subtitle")}
              multiOpen
              variant="embedded"
              showJsonLd={true}
            />
          </div>
        </section>

        {/* Support Options Section */}
        <section className="py-24 bg-gray-50 dark:bg-slate-900/60 border-y border-gray-200/50 dark:border-slate-800/50 relative overflow-hidden">
          {/* Subtle decorative blob */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-blue-100/30 to-purple-100/30 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-slate-100 mb-5 tracking-tight">
                {t("support.title")}
              </h2>
              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t("support.subtitle")}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {supportOptions.map((option, index) => (
                <SupportCard
                  key={option.title}
                  {...option}
                  delay={index * 0.1}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/60 dark:border-slate-800/80 shadow-2xl overflow-hidden flex flex-col md:flex-row relative"
            >
              <div className="md:w-5/12 bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-12 flex flex-col">
                <h3 className="text-3xl font-bold mb-6">
                  {t("contactForm.title")}
                </h3>
                <p className="text-blue-100 text-lg mb-12">
                  {t("contactForm.subtitle")}
                </p>
                <div className="space-y-8 mt-auto">
                  <div className="flex items-center text-blue-100">
                    <div className="p-3 rounded-full bg-white/10 mr-4 rtl:ml-4 rtl:mr-0 backdrop-blur-sm">
                      <Mail className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm opacity-80 uppercase tracking-widest font-semibold">
                        {t("contactForm.emailUs")}
                      </p>
                      <p className="font-semibold text-lg text-white">
                        support@podacium.com
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center text-blue-100">
                    <div className="p-3 rounded-full bg-white/10 mr-4 rtl:ml-4 rtl:mr-0 backdrop-blur-sm">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm opacity-80 uppercase tracking-widest font-semibold">
                        {t("contactForm.liveChat")}
                      </p>
                      <p className="font-semibold text-lg text-white">
                        {t("contactForm.availableHours")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
                <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              </div>
              <div className="p-10 md:p-16 md:w-7/12">
                <form onSubmit={handleContactSubmit} className="space-y-6">
                  {formSuccessTicket && (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold">{t("ticketCreatedTitle")}</p>
                        <p className="text-xs opacity-90">
                          {t("ticketCreatedDesc", {
                            number: formSuccessTicket,
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        {t("contactForm.nameLabel")}
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder={t("contactForm.namePlaceholder")}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-slate-900 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        {t("contactForm.emailLabel")}
                      </label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder={t("contactForm.emailPlaceholder")}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-slate-900 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      {t("contactForm.subjectLabel")}
                    </label>
                    <div className="space-y-2">
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-slate-900 transition-colors text-gray-700 dark:text-slate-300"
                      >
                        <option value="account">
                          {t("contactForm.subjects.account")}
                        </option>
                        <option value="learning">
                          {t("contactForm.subjects.learning")}
                        </option>
                        <option value="hub">
                          {t("contactForm.subjects.hub")}
                        </option>
                        <option value="bi">
                          {t("contactForm.subjects.bi")}
                        </option>
                        <option value="billing">
                          {t("contactForm.subjects.billing")}
                        </option>
                        <option value="technical">
                          {t("contactForm.subjects.technical")}
                        </option>
                        <option value="other">
                          {t("contactForm.subjects.other")}
                        </option>
                      </select>
                      <input
                        type="text"
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        placeholder={t("contactForm.subjectPlaceholder")}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-slate-900 transition-colors text-sm"
                        required
                        minLength={3}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                      {t("contactForm.messageLabel")}
                    </label>
                    <textarea
                      rows={5}
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      placeholder={t("contactForm.messagePlaceholder")}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-slate-900 transition-colors resize-none"
                      required
                      minLength={10}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="w-full px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg hover:shadow-xl hover:shadow-blue-500/25 flex items-center justify-center gap-2 mt-8 text-lg disabled:opacity-60"
                  >
                    {isSubmittingForm ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t("contactForm.submitting")}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        {t("contactForm.submit")}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Quick Tips Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-indigo-800 to-purple-900"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/25 text-sm font-semibold mb-6 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-blue-200" />
                {t("proTips.badge")}
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12 tracking-tight">
                {t("proTips.title")}
              </h2>
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[
                  {
                    icon: <FileText className="w-8 h-8" />,
                    title: t("proTips.includeDetails.title"),
                    description: t("proTips.includeDetails.description"),
                  },
                  {
                    icon: <Clock className="w-8 h-8" />,
                    title: t("proTips.businessHours.title"),
                    description: t("proTips.businessHours.description"),
                  },
                  {
                    icon: <AlertCircle className="w-8 h-8" />,
                    title: t("proTips.checkStatus.title"),
                    description: t("proTips.checkStatus.description"),
                  },
                ].map((tip, index) => (
                  <motion.div
                    key={tip.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 text-white shadow-xl hover:bg-white/15 transition-all text-left group"
                  >
                    <div className="p-4 rounded-2xl bg-white/20 w-fit mb-6 shadow-sm border border-white/10 group-hover:bg-white/30 transition-colors">
                      {tip.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3">{tip.title}</h3>
                    <p className="text-blue-100/90 text-[15px] leading-relaxed font-light">
                      {tip.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Suspense fallback={<div className="h-64" />}>
        <Footer />
      </Suspense>
    </div>
  );
}
