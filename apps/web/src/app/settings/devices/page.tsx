"use client";

import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { motion } from "framer-motion";
import { Shield, Home, ChevronRight } from "lucide-react";
import DevicesManager from "@/components/DevicesManager";

export default function DevicesPage() {
  const { t } = useTranslations("settings-devices");
  const { dir } = useBidi();

  return (
    <div dir={dir}>
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
        <Link
          href="/"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
        >
          <Home className="w-4 h-4" />
          <span>{t("page.breadcrumbHome")}</span>
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <Link
          href="/settings"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {t("page.breadcrumbSettings")}
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <span className="text-gray-900 dark:text-slate-100 font-medium">
          {t("page.title")}
        </span>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          {t("page.title")}
        </h1>
        <p className="text-base text-gray-500 dark:text-slate-400 mt-1">
          {t("page.subtitle")}
        </p>
      </motion.div>

      <DevicesManager />
    </div>
  );
}
