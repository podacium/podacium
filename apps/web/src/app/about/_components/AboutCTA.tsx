// apps/web/src/app/about/_components/AboutCTA.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  Mail,
  MapPin,
  ArrowUpRight,
  Sparkles,
  Building2,
  User,
  LayoutDashboard,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  BarChart2,
} from "lucide-react";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useOptionalAuth } from "@/hooks/useAuth";

export const AboutCTA: React.FC = () => {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const shouldReduceMotion = useReducedMotion();
  const auth = useOptionalAuth();
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const user = auth?.user ?? null;

  // Resolve role config if user is logged in
  const roleKey =
    user?.role &&
    ["STUDENT", "FREELANCER", "BUSINESS", "ADMIN", "INSTRUCTOR"].includes(
      user.role,
    )
      ? user.role
      : "DEFAULT";

  const getRoleRoutes = (role: string) => {
    switch (role) {
      case "STUDENT":
        return { primary: "/learn", secondary: "/dashboard" };
      case "FREELANCER":
        return { primary: "/hub", secondary: "/dashboard" };
      case "BUSINESS":
        return { primary: "/hub", secondary: "/bi" };
      case "ADMIN":
        return { primary: "/admin", secondary: "/dashboard" };
      case "INSTRUCTOR":
        return { primary: "/learn/instructor", secondary: "/dashboard" };
      default:
        return { primary: "/dashboard", secondary: "/profile/me" };
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "STUDENT":
        return <GraduationCap className="w-6 h-6" />;
      case "FREELANCER":
        return <Briefcase className="w-6 h-6" />;
      case "BUSINESS":
        return <BarChart2 className="w-6 h-6" />;
      case "ADMIN":
        return <ShieldCheck className="w-6 h-6" />;
      case "INSTRUCTOR":
        return <GraduationCap className="w-6 h-6" />;
      default:
        return <User className="w-6 h-6" />;
    }
  };

  const roleRoutes = getRoleRoutes(roleKey);
  const userName =
    user?.fullName || (user?.email ? user.email.split("@")[0] : "");

  return (
    <section
      id="about-contact"
      className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-gray-950 text-white relative overflow-hidden"
      dir={dir}
      aria-labelledby="about-cta-title"
    >
      {/* Background dot pattern */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] bg-[size:24px_24px] pointer-events-none"
        aria-hidden="true"
      />
      {/* Ambient gradient glow */}
      <div
        className="absolute top-0 end-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <PodaciumBadge
            variant="gradient"
            className="px-3.5 py-1 text-xs font-semibold shadow-md inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t("about.cta.badge")}</span>
          </PodaciumBadge>

          <h2
            id="about-cta-title"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white"
          >
            {t("about.cta.title")}
          </h2>

          <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
            {t("about.cta.description")}
          </p>
        </div>

        {/* Dual Conversion Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Logged-in Personalized Portal OR Guest Learners & Freelancers */}
          {isAuthenticated && user ? (
            <motion.div
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }
              }
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5 }}
              className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-blue-950/40 via-white/5 to-white/5 border border-blue-400/30 backdrop-blur-xl flex flex-col justify-between space-y-8 relative overflow-hidden shadow-2xl"
            >
              <div
                className="absolute top-0 end-0 w-48 h-48 bg-blue-500/10 blur-2xl pointer-events-none"
                aria-hidden="true"
              />
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    {getRoleIcon(roleKey)}
                  </div>
                  <PodaciumBadge
                    variant="outline"
                    className="border-blue-400/40 bg-blue-500/10 text-blue-300 text-xs font-semibold px-3 py-1"
                  >
                    {t(`about.cta.loggedIn.roles.${roleKey}.badge`)}
                  </PodaciumBadge>
                </div>

                {userName && (
                  <p className="text-xs font-medium text-blue-300 tracking-wide uppercase">
                    {t("about.cta.loggedIn.greeting", { name: userName })}
                  </p>
                )}

                <h3 className="text-2xl font-bold text-white">
                  {t(`about.cta.loggedIn.roles.${roleKey}.title`)}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {t(`about.cta.loggedIn.roles.${roleKey}.description`)}
                </p>
              </div>

              <div className="space-y-3 relative z-10">
                <Link href={roleRoutes.primary} className="block w-full">
                  <PodaciumButton
                    variant="gradient"
                    size="lg"
                    glow
                    className="w-full justify-center min-h-[48px] text-base shadow-lg"
                  >
                    <span>
                      {t(`about.cta.loggedIn.roles.${roleKey}.primaryBtn`)}
                    </span>
                    <ArrowUpRight className="w-4 h-4 ms-2" />
                  </PodaciumButton>
                </Link>

                <Link
                  href={roleRoutes.secondary}
                  className="block w-full text-center"
                >
                  <PodaciumButton
                    variant="outline"
                    size="default"
                    className="w-full justify-center min-h-[40px] text-sm border-white/20 text-gray-300 hover:text-white hover:bg-white/10"
                  >
                    <LayoutDashboard className="w-4 h-4 me-2" />
                    <span>
                      {t(`about.cta.loggedIn.roles.${roleKey}.secondaryBtn`)}
                    </span>
                  </PodaciumButton>
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }
              }
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5 }}
              className="p-8 sm:p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between space-y-8"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">
                  {t("about.cta.talent.title")}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {t("about.cta.talent.description")}
                </p>
              </div>

              <div className="space-y-3">
                <Link href="/auth/signup" className="block w-full">
                  <PodaciumButton
                    variant="gradient"
                    size="lg"
                    glow
                    className="w-full justify-center min-h-[48px] text-base"
                  >
                    <span>{t("about.cta.buttons.signup")}</span>
                    <ArrowUpRight className="w-4 h-4 ms-2" />
                  </PodaciumButton>
                </Link>

                <p className="text-xs text-center text-gray-400">
                  {t("about.cta.alreadyHaveAccount")}{" "}
                  <Link
                    href="/auth/login"
                    className="text-white hover:underline font-semibold"
                  >
                    {t("about.cta.signIn")}
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* Card 2: For Businesses & Institutions */}
          <motion.div
            initial={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }
            }
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
            className="p-8 sm:p-10 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between space-y-8"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                {t("about.cta.business.title")}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {t("about.cta.business.description")}
              </p>
            </div>

            <div className="space-y-3">
              <Link href="/partners" className="block w-full">
                <PodaciumButton
                  variant="outline"
                  size="lg"
                  className="w-full justify-center min-h-[48px] text-base border-white/30 text-white hover:bg-white/10 hover:text-white"
                >
                  <span>{t("about.cta.buttons.partnerWithUs")}</span>
                  <ArrowUpRight className="w-4 h-4 ms-2" />
                </PodaciumButton>
              </Link>

              <p className="text-xs text-center text-gray-400">
                {t("about.cta.business.note")}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Direct Contact Anchors */}
        <div className="pt-12 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Email Anchor */}
          <a
            href="mailto:podacium@podacium.com"
            className="group p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-4"
          >
            <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
              <Mail className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-400 block">
                {t("about.contact.email.subtitle")}
              </span>
              <span className="font-bold text-sm sm:text-base text-white group-hover:text-blue-300 transition-colors truncate block">
                podacium@podacium.com
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </a>

          {/* Location Anchor */}
          <a
            href="https://maps.app.goo.gl/egrbHeMaiptuyMCs7"
            target="_blank"
            rel="noopener noreferrer"
            className="group p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-4"
          >
            <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-400 block">
                {t("about.contact.location.subtitle")}
              </span>
              <span className="font-bold text-sm sm:text-base text-white group-hover:text-emerald-300 transition-colors truncate block">
                {t("about.contact.location.name")}
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          </a>
        </div>
      </div>
    </section>
  );
};
