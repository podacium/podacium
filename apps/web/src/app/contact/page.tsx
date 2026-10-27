// app/contact/page.tsx
"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  MessageSquare,
  Send,
  CheckCircle,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  ExternalLink,
  User,
  Mail as MailIcon,
  MessageCircle,
  Globe,
  GitBranch,
  Youtube,
  YoutubeIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, ContactFormRequest, handleApiError } from "@/lib/api";
import { useTranslations, useBidi } from "@/lib/i18n";
import { FAQPageJsonLd } from "@/components/StructuredData";
import FAQAccordion from "@/components/FAQAccordion";

// Animation configurations matching about/page.tsx
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
} as const;

// Contact form data interface
interface ContactFormData {
  name: string;
  email: string;
  message: string;
  phone?: string;
  subject?: string;
  category?: "general" | "support" | "partnership" | "technical" | "feedback";
}

export default function ContactPage() {
  const { isAuthenticated, user } = useAuth();
  const t = useTranslations();
  const { isolateText } = useBidi();
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    message: "",
    phone: "",
    subject: "",
    category: "general",
  });
  const [errors, setErrors] = useState<Partial<ContactFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Get direction from locale for RTL support
  const isRTL = t.dir === "rtl";

  // Create dynamic data based on translations
  const SOCIAL_LINKS = React.useMemo(
    () => [
      {
        name: t("contact.socialLinks.whatsapp.name"),
        icon: <MessageSquare className="w-5 h-5" />,
        action: t("contact.socialLinks.whatsapp.action"),
        url: "https://wa.me/213792913873",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor:
          "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-100 dark:border-emerald-900/50",
        hoverColor: "text-emerald-700 dark:text-emerald-300",
      },
      {
        name: t("contact.socialLinks.youtube.name"),
        icon: <YoutubeIcon className="w-5 h-5" />,
        action: t("contact.socialLinks.youtube.action"),
        url: "https://www.youtube.com/@PodaciumDZ",
        color: "text-red-600 dark:text-red-400",
        bgColor:
          "bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-100 dark:border-red-900/50",
        hoverColor: "text-red-700 dark:text-red-300",
      },
      {
        name: t("contact.socialLinks.facebook.name"),
        icon: <Facebook className="w-5 h-5" />,
        action: t("contact.socialLinks.facebook.action"),
        url: "https://facebook.com/podacium",
        color: "text-blue-600 dark:text-blue-400",
        bgColor:
          "bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-100 dark:border-blue-900/50",
        hoverColor: "text-blue-700 dark:text-blue-300",
      },
      {
        name: t("contact.socialLinks.instagram.name"),
        icon: <Instagram className="w-5 h-5" />,
        action: t("contact.socialLinks.instagram.action"),
        url: "https://instagram.com/podacium",
        color: "text-pink-600 dark:text-pink-400",
        bgColor:
          "bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/60 border border-pink-100 dark:border-pink-900/50",
        hoverColor: "text-pink-700 dark:text-pink-300",
      },
      {
        name: t("contact.socialLinks.linkedin.name"),
        icon: <Linkedin className="w-5 h-5" />,
        action: t("contact.socialLinks.linkedin.action"),
        url: "https://linkedin.com/company/podacium",
        color: "text-blue-700 dark:text-blue-400",
        bgColor:
          "bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-100 dark:border-blue-900/50",
        hoverColor: "text-blue-800 dark:text-blue-300",
      },
      {
        name: t("contact.socialLinks.twitter.name"),
        icon: <Twitter className="w-5 h-5" />,
        action: t("contact.socialLinks.twitter.action"),
        url: "https://twitter.com/podacium",
        color: "text-gray-900 dark:text-slate-100",
        bgColor:
          "bg-gray-100 dark:bg-slate-800/80 hover:bg-gray-200 dark:hover:bg-slate-700/80 border border-gray-200 dark:border-slate-700",
        hoverColor: "text-black dark:text-white",
      },
    ],
    [t],
  );

  const CONTACT_METHODS = React.useMemo(
    () => [
      {
        title: t("contact.contactMethods.email.title"),
        description: t("contact.contactMethods.email.description"),
        icon: <Mail className="w-6 h-6" />,
        value: "podacium@podacium.com",
        action: "mailto:podacium@podacium.com",
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        dir: "ltr",
      },
      {
        title: t("contact.contactMethods.visit.title"),
        description: t("contact.contactMethods.visit.description"),
        icon: <MapPin className="w-6 h-6" />,
        value: t("contact.contactMethods.visit.value"),
        action: "https://maps.app.goo.gl/egrbHeMaiptuyMCs7",
        color: "text-green-600",
        bgColor: "bg-green-100",
      },
      {
        title: t("contact.contactMethods.call.title"),
        description: t("contact.contactMethods.call.description"),
        icon: <Phone className="w-6 h-6" />,
        value: "+213 (0) 792 91 38 73",
        action: "tel:+213792913873",
        color: "text-purple-600",
        bgColor: "bg-purple-100",
        dir: "ltr",
      },
    ],
    [t],
  );

  const FAQ_ITEMS = React.useMemo(
    () => [
      {
        q: t("contact.faq.0.question"),
        a: t("contact.faq.0.answer"),
      },
      {
        q: t("contact.faq.1.question"),
        a: t("contact.faq.1.answer"),
      },
      {
        q: t("contact.faq.2.question"),
        a: t("contact.faq.2.answer"),
      },
    ],
    [t],
  );

  // Pre-fill form for authenticated users
  React.useEffect(() => {
    if (isAuthenticated && user) {
      setFormData((prev) => ({
        ...prev,
        name: user.fullName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
      }));
    }
  }, [isAuthenticated, user]);

  const validateForm = (): boolean => {
    const newErrors: Partial<ContactFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("contact.form.errors.nameRequired");
    }

    if (!formData.email.trim()) {
      newErrors.email = t("contact.form.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("contact.form.errors.emailInvalid");
    }

    if (!formData.message.trim()) {
      newErrors.message = t("contact.form.errors.messageRequired");
    } else if (formData.message.length < 10) {
      newErrors.message = t("contact.form.errors.messageTooShort");
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
        message: formData.message,
        phone: formData.phone,
        subject: formData.subject || t("contact.form.defaultSubject"),
        category: formData.category,
      };

      await api.submitContactForm(contactData);

      setIsSuccess(true);
      setFormData({
        name: "",
        email: "",
        message: "",
        phone: "",
        subject: "",
        category: "general",
      });

      // Reset success state after 5 seconds
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (error) {
      setSubmitError(handleApiError(error));
      console.error("Contact form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Navbar />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {/* Hero Section */}
        <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
          <div className="absolute inset-0 bg-grid-gray-100/50 dark:bg-grid-slate-800/30 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
          <div className="relative max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ANIMATION_CONFIGS.EASING.ENTER}
              className="text-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg"
              >
                <MessageCircle className="w-4 h-4 ml-2 mr-2" />
                {t("contact.hero.badge")}
              </motion.div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                {t("contact.hero.title.prefix")}{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {t("contact.hero.title.highlight")}
                </span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {t("contact.hero.description")}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left Column: Contact Form */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-8"
              >
                {/* Contact Form Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="p-8">
                    <div className="flex items-center mb-6">
                      <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl me-4">
                        <Send className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                          {t("contact.form.title")}
                        </h2>
                        <p className="text-gray-600 dark:text-slate-400">
                          {t("contact.form.subtitle")}
                        </p>
                      </div>
                    </div>

                    {isSuccess ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-xl p-6 text-center"
                      >
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                          {t("contact.form.success.title")}
                        </h3>
                        <p className="text-gray-600 dark:text-slate-400">
                          {t("contact.form.success.description")}
                        </p>
                        <button
                          onClick={() => setIsSuccess(false)}
                          className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
                        >
                          {t("contact.form.success.button")}
                        </button>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name & Email Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label
                              htmlFor="name"
                              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                            >
                              {t("contact.form.labels.name")}
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                              </div>
                              <input
                                type="text"
                                id="name"
                                value={formData.name}
                                onChange={(e) =>
                                  handleChange("name", e.target.value)
                                }
                                className={`ps-10 pe-4 w-full py-3 border ${
                                  errors.name
                                    ? "border-red-300 dark:border-red-700"
                                    : "border-gray-300 dark:border-slate-700"
                                } rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                                placeholder={t(
                                  "contact.form.placeholders.name",
                                )}
                              />
                            </div>
                            {errors.name && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {errors.name}
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor="email"
                              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                            >
                              {t("contact.form.labels.email")}
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                              </div>
                              <input
                                type="email"
                                id="email"
                                value={formData.email}
                                onChange={(e) =>
                                  handleChange("email", e.target.value)
                                }
                                className={`ps-10 pe-4 w-full py-3 border ${
                                  errors.email
                                    ? "border-red-300 dark:border-red-700"
                                    : "border-gray-300 dark:border-slate-700"
                                } rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200`}
                                placeholder={t(
                                  "contact.form.placeholders.email",
                                )}
                              />
                            </div>
                            {errors.email && (
                              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {errors.email}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Phone & Category Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label
                              htmlFor="phone"
                              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                            >
                              {t("contact.form.labels.phone")}
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                                <Phone className="h-5 w-5 text-gray-400" />
                              </div>
                              <input
                                type="tel"
                                id="phone"
                                value={formData.phone}
                                onChange={(e) =>
                                  handleChange("phone", e.target.value)
                                }
                                className="ps-10 pe-4 w-full py-3 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                                placeholder={t(
                                  "contact.form.placeholders.phone",
                                )}
                              />
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor="category"
                              className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                            >
                              {t("contact.form.labels.category")}
                            </label>
                            <select
                              id="category"
                              value={formData.category}
                              onChange={(e) =>
                                handleChange("category", e.target.value)
                              }
                              className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white dark:bg-slate-900"
                            >
                              <option value="general">
                                {t("contact.form.categories.general")}
                              </option>
                              <option value="support">
                                {t("contact.form.categories.support")}
                              </option>
                              <option value="partnership">
                                {t("contact.form.categories.partnership")}
                              </option>
                              <option value="technical">
                                {t("contact.form.categories.technical")}
                              </option>
                              <option value="feedback">
                                {t("contact.form.categories.feedback")}
                              </option>
                            </select>
                          </div>
                        </div>

                        {/* Subject */}
                        <div>
                          <label
                            htmlFor="subject"
                            className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                          >
                            {t("contact.form.labels.subject")}
                          </label>
                          <input
                            type="text"
                            id="subject"
                            value={formData.subject}
                            onChange={(e) =>
                              handleChange("subject", e.target.value)
                            }
                            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                            placeholder={t("contact.form.placeholders.subject")}
                          />
                        </div>

                        {/* Message */}
                        <div>
                          <label
                            htmlFor="message"
                            className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2"
                          >
                            {t("contact.form.labels.message")}
                          </label>
                          <textarea
                            id="message"
                            rows={5}
                            value={formData.message}
                            onChange={(e) =>
                              handleChange("message", e.target.value)
                            }
                            className={`w-full px-4 py-3 border ${
                              errors.message
                                ? "border-red-300 dark:border-red-700"
                                : "border-gray-300 dark:border-slate-700"
                            } rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-none`}
                            placeholder={t("contact.form.placeholders.message")}
                          />
                          {errors.message && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                              {errors.message}
                            </p>
                          )}
                        </div>

                        {/* Submit Button & Error */}
                        <div className="space-y-4">
                          {submitError && (
                            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl p-4">
                              <p className="text-red-700 dark:text-red-300 text-sm">
                                {submitError}
                              </p>
                            </div>
                          )}

                          <motion.button
                            type="submit"
                            disabled={isSubmitting}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="group w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? (
                              <span className="flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin ms-2 me-2"></div>
                                {t("contact.form.buttons.submitting")}
                              </span>
                            ) : (
                              <span className="flex items-center justify-center">
                                <Send className="w-5 h-5 ms-2 me-2" />
                                {t("contact.form.buttons.submit")}
                                <ExternalLink className="w-4 h-4 ms-2 me-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                              </span>
                            )}
                          </motion.button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                {/* FAQ Section */}
                <FAQAccordion
                  items={FAQ_ITEMS}
                  title={t("contact.faq.title")}
                  headingLevel="h3"
                  variant="embedded"
                  multiOpen
                  footerSlot={
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                      <Link
                        href="/about"
                        className="group inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
                      >
                        {t("contact.faq.link")}
                        <ExternalLink className="w-4 h-4 ms-2 me-2 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                      </Link>
                    </div>
                  }
                />

                {/* Additional Info for Authenticated Users */}
                {isAuthenticated && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-emerald-950/40 dark:to-emerald-900/30 rounded-2xl p-6 border border-green-200 dark:border-emerald-800/80"
                  >
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-green-100 dark:bg-emerald-950/60 rounded-lg ms-2 me-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-slate-100">
                        {t("contact.authenticated.title", {
                          name: user?.fullName || "",
                        })}
                      </h3>
                    </div>
                    <p className="text-gray-700 dark:text-slate-300 text-sm mb-4">
                      {t("contact.authenticated.description")}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href="/dashboard"
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors duration-200"
                      >
                        {t("contact.authenticated.buttons.dashboard")}
                      </Link>
                      <Link
                        href="/learn"
                        className="px-4 py-2 bg-white dark:bg-slate-900 text-green-600 text-sm font-medium rounded-lg border border-green-200 dark:border-emerald-800/80 hover:bg-green-50 dark:bg-emerald-950/40 transition-colors duration-200"
                      >
                        {t("contact.authenticated.buttons.continueLearning")}
                      </Link>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Right Column: Social & Info */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-8"
              >
                {/* Social Media Card */}
                <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-8 text-white">
                  <div className="space-y-6">
                    <div className="flex items-center">
                      <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl me-4">
                        <Globe className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">
                          {t("contact.social.title")}
                        </h2>
                        <p className="text-blue-200">
                          {t("contact.social.subtitle")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {SOCIAL_LINKS.map((social, index) => (
                        <motion.a
                          key={social.name}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * (index + 1) }}
                          whileHover={{ x: 4 }}
                          className={`group flex items-center justify-between p-4 rounded-xl ${social.bgColor} transition-all duration-300`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`${social.color} transition-colors duration-300`}
                            >
                              {social.icon}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 dark:text-slate-100">
                                {social.name}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-slate-400">
                                {social.action}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-slate-200 dark:text-slate-400 transition-colors duration-300" />
                        </motion.a>
                      ))}
                    </div>

                    <div className="pt-6 border-t border-white/20 dark:border-slate-800/40">
                      <p className="text-blue-200 text-sm">
                        {t("contact.social.footer")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Contact Cards (Moved here from left column) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CONTACT_METHODS.map((method, index) => (
                    <motion.a
                      key={method.title}
                      href={method.action}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * (index + 1) }}
                      whileHover={{ y: -4 }}
                      className="group bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 hover:shadow-lg transition-all duration-300"
                    >
                      <div
                        className={`p-2 ${method.bgColor} rounded-lg w-fit mb-3 group-hover:scale-110 transition-transform duration-300`}
                      >
                        <div className={method.color}>{method.icon}</div>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-slate-100 text-sm mb-1">
                        {method.title}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mb-2">
                        {method.description}
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                        {method.dir ? (
                          <span dir={method.dir}>{method.value}</span>
                        ) : (
                          method.value
                        )}
                      </p>
                    </motion.a>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
