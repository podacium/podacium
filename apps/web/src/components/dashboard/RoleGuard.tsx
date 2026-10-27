"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/lib/i18n";
import { DashboardTabs } from "./DashboardTabs";

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const t = useTranslations("common");
  const userRole = (user?.role || "STUDENT").toUpperCase();

  if (loading) {
    return null;
  }

  const isAllowed = allowedRoles.includes(userRole) || userRole === "ADMIN";

  if (!isAllowed) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardTabs />
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-slate-800/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {t("auth.roleGuard.accessRestricted")}
          </h2>
          <p className="text-gray-600 dark:text-slate-400 max-w-md mx-auto mb-6">
            {t("auth.roleGuard.reservedFor", {
              roles: allowedRoles.join(" / "),
              currentRole: userRole,
            })}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t("auth.roleGuard.returnToOverview")}</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default RoleGuard;
