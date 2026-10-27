"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumSpotlightCard from "@/components/design-system/PodaciumSpotlightCard";

const Button = PodaciumButton;

const ActivationSection: React.FC = React.memo(() => {
  const t = useTranslations("home");
  const { isRTL } = useBidi();
  const isArabic = isRTL;

  return (
    <section className="py-32 bg-white dark:bg-slate-900 relative overflow-hidden">
      {/* Background Mesh Gradient */}
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-100 dark:bg-blue-950/60 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <PodaciumSpotlightCard
            tone="brand"
            strength={14}
            contentClassName="p-8 sm:p-10 md:p-16 text-center"
            className="shadow-[0_30px_70px_-15px_rgba(79,70,229,0.35)]"
          >
            <h2
              className={`text-3xl md:text-4xl lg:text-5xl font-black text-white mb-6 tracking-tight leading-tight ${isArabic ? "font-arabic" : ""}`}
            >
              {t("combined.pricingCard.cta.title")}
            </h2>
            <p className="text-white/85 text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
              {t("combined.pricingCard.description")}
            </p>

            <div
              className={`flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-4 max-w-md sm:max-w-none mx-auto ${isRTL ? "sm:flex-row-reverse" : ""}`}
            >
              <Button
                variant="secondary"
                size="xl"
                href="/learn"
                className="w-full sm:w-auto min-w-[200px] font-bold bg-white text-blue-700 hover:bg-white/90"
              >
                <span className={isArabic ? "font-arabic" : ""}>
                  {t("activation.cta.module")}
                </span>
                <ArrowRight
                  className={`ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform ${isRTL ? "rotate-180 group-hover:-translate-x-1 ml-0 mr-2" : ""}`}
                />
              </Button>
              <Button
                variant="outline"
                size="xl"
                href="/about"
                className="w-full sm:w-auto min-w-[200px] font-bold border-white/40 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:text-white"
              >
                <span className={isArabic ? "font-arabic" : ""}>
                  {t("activation.cta.docs")}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="xl"
                href="/waitlist"
                className="w-full sm:w-auto min-w-[200px] font-bold bg-white text-blue-700 hover:bg-white/90"
              >
                <span className={isArabic ? "font-arabic" : ""}>
                  {t("activation.cta.joinWaitlist")}
                </span>
                <ArrowRight
                  className={`ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform ${isRTL ? "rotate-180 group-hover:-translate-x-1 ml-0 mr-2" : ""}`}
                />
              </Button>
            </div>

            <div
              className={`mt-14 flex flex-wrap justify-center gap-x-8 gap-y-4 text-white/90 text-xs font-bold tracking-wide uppercase ${isRTL ? "flex-row-reverse" : ""}`}
            >
              {[
                {
                  text: t("activation.benefits.noCard"),
                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
                },
                {
                  text: t("activation.benefits.market"),
                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
                },
                {
                  text: t("activation.benefits.infra"),
                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
                },
              ].map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className={`flex items-center gap-2.5 bg-white/10 border border-white/25 px-4 py-2 rounded-full ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                >
                  {benefit.icon}
                  <span
                    className={
                      isArabic ? "font-arabic tracking-normal text-xs" : ""
                    }
                  >
                    {benefit.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </PodaciumSpotlightCard>
        </motion.div>
      </div>
    </section>
  );
});

ActivationSection.displayName = "ActivationSection";

export default ActivationSection;
