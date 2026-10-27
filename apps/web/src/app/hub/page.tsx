"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Users,
  Banknote,
  TrendingUp,
  TrendingDown,
  Equal,
  Award,
  Clock,
  CheckCircle,
  Plus,
  ChevronRight,
  Target,
  BarChart3,
  MessageSquare,
  FileText,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Shield,
  Rocket,
  Sparkles,
  ArrowUpRight,
  HelpCircle,
  Phone,
  Code,
  Palette,
  Megaphone,
  Database,
  ShieldCheck,
  Layers,
  Cpu,
  Cloud,
  UserX,
  XCircle,
  Mail,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole, UserProfileResponse } from "@/lib/api";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useFormatDate } from "@/lib/date-utils";
import { PublicFreelanceCatalog } from "@/components/hub/dashboard/PublicCatalog";
import { VerificationGate } from "@/components/hub/dashboard/VerificationGate";
import { AuthenticatedDashboard } from "@/components/hub/dashboard/AuthenticatedDashboard";

export default function FreelanceHubPage() {
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const router = useRouter();
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  const getDefaultTab = useMemo(() => {
    if (!user) return "client";
    const isFreelancer =
      user.role === UserRole.FREELANCER || user.role === UserRole.INSTRUCTOR;
    const isClient =
      user.role === UserRole.BUSINESS || user.role === UserRole.ADMIN;
    if (isFreelancer && !isClient) return "freelancer";
    return "client";
  }, [user]);

  const [activeTab, setActiveTab] = useState<"freelancer" | "client">(
    getDefaultTab,
  );

  const handleTabChange = useCallback((tab: "freelancer" | "client") => {
    setActiveTab(tab);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
          <div className="text-center space-y-8">
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg max-w-2xl mx-auto"></div>
              <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg max-w-3xl mx-auto"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-slate-800/50 shadow-sm p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl"></div>
                      <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800/90 rounded-lg"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
                      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded-lg w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <PublicFreelanceCatalog />
        </main>
        <Footer />
      </div>
    );
  }

  if (user.role === UserRole.STUDENT || !user.phoneVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100">
        <Navbar />
        <main id="main-content" tabIndex={-1} className="focus:outline-none">
          <VerificationGate user={user} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={dir}
    >
      <Navbar />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <section className="relative pt-28 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-hidden">
          <div className="absolute inset-0 bg-grid-blue-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
          <div className="relative max-w-8xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="text-center space-y-6"
            >
              <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-semibold mb-4 shadow-lg">
                <Sparkles className="w-4 h-4 mr-2" />
                {t("hub.hero.welcomeBack", {
                  name:
                    user.fullName?.split(" ")[0] || t("hub.hero.freelancer"),
                })}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
                {t("hub.hero.findNext")}{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {activeTab === "freelancer"
                    ? t("hub.hero.project")
                    : t("hub.hero.freelancer")}
                </span>
              </h1>

              <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                {activeTab === "freelancer"
                  ? t("hub.hero.freelancerDescription")
                  : t("hub.hero.clientDescription")}
              </p>

              <div className="inline-flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-xl p-1 border border-gray-200/50 dark:border-slate-800/50 shadow-lg">
                <button
                  onClick={() => handleTabChange("freelancer")}
                  className={`group flex items-center space-x-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-300 ${
                    activeTab === "freelancer"
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:bg-slate-800/50"
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>{t("hub.roles.asFreelancer")}</span>
                  {user.role === UserRole.FREELANCER && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        activeTab === "freelancer"
                          ? "bg-white/20 text-white"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {t("hub.roles.primary")}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange("client")}
                  className={`group flex items-center space-x-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-300 ${
                    activeTab === "client"
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md"
                      : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:bg-slate-800/50"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>{t("hub.roles.asClient")}</span>
                  {user.role === UserRole.BUSINESS && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        activeTab === "client"
                          ? "bg-white/20 text-white"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {t("hub.roles.primary")}
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        <AuthenticatedDashboard
          user={user}
          activeTab={activeTab}
          handleTabChange={handleTabChange}
        />
      </main>

      <Footer />
    </div>
  );
}
