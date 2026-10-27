"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslations } from "@/lib/i18n";

export default function UnauthorizedPage() {
  const t = useTranslations("admin");
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-900/60">
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4 py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-slate-800"
        >
          {/* Header Graphic */}
          <div className="h-32 bg-gradient-to-br from-red-500 to-orange-600 relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
            <motion.div
              initial={{ scale: 0.5, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.2,
              }}
              className="bg-white/15 border border-white/25 p-4 rounded-2xl backdrop-blur-sm"
            >
              <ShieldAlert className="w-12 h-12 text-white" />
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-8 text-center sm:p-12">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-4 tracking-tight">
              {t("common.accessDenied")}
            </h1>
            <p className="text-gray-600 dark:text-slate-400 text-lg mb-8 leading-relaxed">
              {t("common.accessDeniedMessage")}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.back()}
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-slate-700 shadow-sm text-base font-medium rounded-xl text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                <ArrowLeft className="w-5 h-5 mr-2 ml-2" />
                {t("common.back")}
              </button>

              <button
                onClick={() => router.push("/")}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                <Home className="w-5 h-5 mr-2 ml-2" />
                {t("common.returnHome")}
              </button>
            </div>
          </div>

          {/* Decorative bottom bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200"></div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
