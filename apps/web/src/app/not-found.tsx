"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, ArrowLeft, Home } from "lucide-react";
import { useTranslations, useLocale, useTextDirection } from "@/lib/i18n";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  const t = useTranslations();
  const locale = useLocale();
  const dir = useTextDirection();

  const title = t("notFound.title");
  const description = t("notFound.description");
  const goHomeLabel = t("notFound.goHome");
  const goBackLabel = t("notFound.goBack");

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary relative overflow-hidden flex flex-col"
      dir={dir}
    >
      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-blue-100/60 to-cyan-100/40 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] bg-gradient-to-tr from-purple-100/40 to-pink-100/30 rounded-full blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.6, 0.4] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
      </div>

      {/* Navbar */}
      <div className="relative z-20">
        <Navbar />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Brand icon */}
          <div className="flex justify-center mb-8">
            <motion.div
              className="w-14 h-14 bg-gradient-to-br from-primary to-cyan-400 rounded-xl flex items-center justify-center shadow-lg"
              animate={{ rotate: [0, 4, -4, 0], scale: [1, 1.04, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <BookOpen className="w-7 h-7 text-primary-foreground" />
            </motion.div>
          </div>

          {/* Card */}
          <div className="bg-background rounded-2xl shadow-xl border border-border p-8 text-center">
            {/* 404 number */}
            <motion.p
              className="text-7xl font-bold bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent mb-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
            >
              404
            </motion.p>

            {/* Heading */}
            <h1 className="text-xl font-semibold text-foreground mb-3">
              {title}
            </h1>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              {description}
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-cyan-500 px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Home className="h-4 w-4" />
                {goHomeLabel}
              </Link>

              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {goBackLabel}
              </button>
            </div>
          </div>

          {/* Footer link */}
          <p className="mt-8 text-center text-xs text-muted-foreground/70">
            {t("notFound.tagline")}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
