"use client";

import { CheckIcon, PlayIcon } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { PodaciumButton } from "@/components/design-system";
import { PodaciumBorderBeam } from "@/components/velora/PodaciumBorderBeam";
import { PodaciumRetroGrid } from "@/components/velora/PodaciumRetroGrid";
import { PodaciumReveal } from "@/components/velora/PodaciumReveal";
import { PodaciumSparkles } from "@/components/velora/PodaciumSparkles";
import { PodaciumDashboardMockup } from "@/components/landing/PodaciumDashboardMockup";
import { PodaciumPillars } from "@/components/landing/PodaciumPillars";
import { PodaciumTrustStrip } from "@/components/landing/PodaciumTrustStrip";

const BENEFITS = ["noCreditCard", "freeTrial"] as const;

/**
 * Homepage hero.
 *
 * Layout goal: one clear promise, two actions, then proof the product exists.
 * Everything below the headline is a real DOM mockup instead of a screenshot,
 * so the hero has no image on the LCP path, stays sharp at any DPR, and mirrors
 * correctly in RTL without a second asset.
 */
export function PodaciumHero() {
  const t = useTranslations("home");

  const scrollToExplainer = () => {
    document
      .getElementById("explainer-video")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-background pt-28 pb-16 sm:pt-32 lg:pb-24"
    >
      {/* Ambient backdrop — pure CSS, no images */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 start-1/2 h-[32rem] w-[64rem] -translate-x-1/2 rounded-full bg-brand-from/10 blur-3xl dark:bg-brand-from/15" />
        <div className="absolute -top-24 end-0 h-[24rem] w-[24rem] rounded-full bg-brand-to/10 blur-3xl" />
        <PodaciumRetroGrid
          angle={65}
          cell={48}
          opacity={0.14}
          speed={10}
          className="top-auto bottom-0 h-[60%] text-border [mask-image:linear-gradient(to_top,black,transparent)]"
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <PodaciumReveal entrance="fade" duration={400}>
            <PodaciumSparkles
              count={6}
              delay={320}
              loop
              className="inline-flex"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-from/25 bg-brand-from/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
                <span aria-hidden className="size-1.5 rounded-full bg-brand" />
                {t("hero.badge")}
              </span>
            </PodaciumSparkles>
          </PodaciumReveal>

          <h1
            id="hero-heading"
            className="mt-6 text-balance text-[1.95rem] font-extrabold leading-[1.12] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            <span className="block">{t("hero.headline.part1")}</span>
            <span className="block animate-gradient-x bg-[length:200%_auto] bg-gradient-to-r from-brand-from via-brand-via to-brand-to bg-clip-text text-transparent">
              {t("hero.headline.part2")}
            </span>
            <span className="block">{t("hero.headline.part3")}</span>
          </h1>

          <PodaciumReveal entrance="up" duration={450} delay={60}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("hero.subtitle")}
            </p>
          </PodaciumReveal>

          <PodaciumReveal entrance="up" duration={450} delay={120}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PodaciumButton
                href="/learn"
                variant="gradient"
                size="xl"
                glow
                className="w-full font-semibold sm:w-auto"
              >
                {t("hero.cta.primary")}
              </PodaciumButton>
              <PodaciumButton
                variant="outline"
                size="xl"
                icon={<PlayIcon className="size-4" />}
                onClick={scrollToExplainer}
                className="w-full font-semibold sm:w-auto"
              >
                {t("hero.cta.secondary")}
              </PodaciumButton>
            </div>
          </PodaciumReveal>

          <PodaciumReveal entrance="fade" duration={400} delay={180}>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-1.5">
                  <CheckIcon
                    aria-hidden
                    className="size-3.5 text-emerald-500"
                  />
                  {t(`hero.benefits.${benefit}`)}
                </li>
              ))}
            </ul>
          </PodaciumReveal>
        </div>

        <PodaciumPillars className="mt-10" />

        <PodaciumReveal
          entrance="scale"
          duration={600}
          delay={120}
          className="relative mx-auto mt-8 max-w-5xl"
        >
          <div
            aria-hidden
            className="absolute inset-x-6 top-8 -bottom-6 -z-10 rounded-[2.5rem] bg-gradient-to-r from-brand-from/25 via-brand-via/15 to-brand-to/25 blur-2xl"
          />
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/10 dark:shadow-black/40">
            <div
              aria-hidden
              className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-2.5"
            >
              <span className="size-2.5 rounded-full bg-red-400/70" />
              <span className="size-2.5 rounded-full bg-amber-400/70" />
              <span className="size-2.5 rounded-full bg-emerald-400/70" />
              <span
                className="ms-3 truncate text-xs text-muted-foreground"
                dir="ltr"
              >
                www.podacium.com/dashboard
              </span>
            </div>
            <PodaciumDashboardMockup />
            <PodaciumBorderBeam duration={9} />
          </div>
        </PodaciumReveal>

        <PodaciumReveal
          entrance="fade"
          duration={500}
          delay={80}
          className="mx-auto mt-14 max-w-5xl"
        >
          <PodaciumTrustStrip />
        </PodaciumReveal>
      </div>
    </section>
  );
}
