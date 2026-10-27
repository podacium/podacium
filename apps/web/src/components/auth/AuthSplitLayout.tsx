"use client";

import React from "react";
import { motion } from "framer-motion";
import { useTranslations } from "@/lib/i18n";
import Footer from "../Footer";
import { premiumStagger } from "@/lib/animation-presets";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  heroTitle?: string;
  heroSubtitle?: string;
  heroFeatures?: { text: string; icon?: React.ReactNode }[];
  sideContent?: React.ReactNode;
  image?: string; // Optional background image for the side panel
  centerContent?: boolean; // Optional: center the form vertically
}

const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  children,
  heroTitle,
  heroSubtitle,
  heroFeatures,
  sideContent,
  centerContent = false,
}) => {
  const { i18n } = useTranslations("common");
  const isRtl = i18n.language === "ar";

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-slate-900/60 flex flex-col"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <main className="flex-grow min-h-screen flex flex-col lg:flex-row">
        {/* Form Side - Desktop: Left (LTR) / Right (RTL) | Mobile: Top */}
        <div
          className={`relative w-full lg:w-1/2 flex flex-col ${centerContent ? "justify-center" : "justify-start"} px-4 sm:px-6 lg:px-12 xl:px-24 pt-32 pb-24 bg-white dark:bg-slate-900 order-1 overflow-hidden ${isRtl ? "lg:order-1" : "lg:order-0"}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0"
          >
            <div className="aurora-blob w-72 h-72 -top-20 -right-20 bg-blue-50 dark:bg-blue-950/60 animate-aurora-slow" />
            <div className="aurora-blob w-64 h-64 bottom-0 -left-24 bg-indigo-50 dark:bg-indigo-950/60 animate-aurora" />
          </div>
          <div className="relative w-full max-w-sm mx-auto lg:max-w-md">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={premiumStagger}
            >
              {children}
            </motion.div>
          </div>
        </div>

        {/* Hero/Side Panel - Desktop: Right (LTR) / Left (RTL) | Mobile: Bottom (Hidden or Minimized) */}
        <div
          className={`hidden lg:flex w-full lg:w-1/2 bg-slate-950 relative overflow-hidden order-0 sticky top-0 h-screen max-h-screen ${isRtl ? "lg:order-0" : "lg:order-1"}`}
        >
          {/* Ambient aurora */}
          <div className="absolute inset-0">
            <div className="aurora-blob w-[34rem] h-[34rem] -top-32 -left-24 bg-indigo-600/30 animate-aurora-slow" />
            <div className="aurora-blob w-[30rem] h-[30rem] bottom-0 -right-20 bg-purple-600/25 animate-aurora" />
            <div className="aurora-blob w-[24rem] h-[24rem] top-1/2 left-1/2 bg-blue-600/20 animate-aurora-slow" />
          </div>
          <div className="absolute inset-0 bg-grid-white/[0.05] [mask-image:linear-gradient(0deg,transparent,black)]"></div>

          {/* Content */}
          <div className="relative z-10 w-full flex flex-col justify-center px-12 xl:px-24 text-white">
            {sideContent ? (
              sideContent
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {heroTitle && (
                  <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-6">
                    {heroTitle}
                  </h1>
                )}

                {heroSubtitle && (
                  <p className="text-lg text-slate-300 leading-relaxed mb-10 max-w-lg">
                    {heroSubtitle}
                  </p>
                )}

                {heroFeatures && heroFeatures.length > 0 && (
                  <div className="space-y-4">
                    {heroFeatures.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                        className="flex items-center space-x-3 rtl:space-x-reverse"
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/15">
                          {feature.icon || (
                            <svg
                              className="w-5 h-5 text-blue-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className="text-slate-200 font-medium">
                          {feature.text}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AuthSplitLayout;
