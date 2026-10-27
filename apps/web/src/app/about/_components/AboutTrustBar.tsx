// apps/web/src/app/about/_components/AboutTrustBar.tsx
"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GraduationCap, Award, CreditCard, ShieldCheck } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import type { TrustPartner } from "../types";

export const AboutTrustBar: React.FC = () => {
  const t = useTranslations();
  const { dir } = useBidi();
  const shouldReduceMotion = useReducedMotion();

  const trustPartners: (TrustPartner & { icon: React.ReactNode })[] = [
    {
      id: "hse",
      name: t("about.trust.items.0.name"),
      badge: t("about.trust.items.0.badge"),
      description: t("about.trust.items.0.description"),
      category: "academic",
      icon: (
        <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      ),
    },
    {
      id: "decree",
      name: t("about.trust.items.1.name"),
      badge: t("about.trust.items.1.badge"),
      description: t("about.trust.items.1.description"),
      category: "framework",
      icon: <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
    },
    {
      id: "payments",
      name: t("about.trust.items.2.name"),
      badge: t("about.trust.items.2.badge"),
      description: t("about.trust.items.2.description"),
      category: "payment",
      icon: (
        <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
      ),
    },
    {
      id: "privacy",
      name: t("about.trust.items.3.name"),
      badge: t("about.trust.items.3.badge"),
      description: t("about.trust.items.3.description"),
      category: "compliance",
      icon: (
        <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
      ),
    },
  ];

  return (
    <section
      className="py-8 bg-muted/40 dark:bg-slate-900/40 backdrop-blur-md border-y border-border"
      dir={dir}
      aria-label={t("about.trust.badge")}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("about.trust.badge")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {trustPartners.map((partner, index) => (
            <motion.div
              key={partner.id}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }
              }
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="group relative flex items-start gap-3.5 p-4 rounded-xl bg-card border border-border/80 shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-300"
            >
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-muted group-hover:scale-105 transition-transform duration-200">
                {partner.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-sm text-foreground truncate">
                    {partner.name}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {partner.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {partner.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
