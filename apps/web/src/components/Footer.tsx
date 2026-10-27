"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations, useBidi } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Twitter,
  Linkedin,
  Github,
  ArrowUpRight,
  Sparkles,
  Mail,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import LanguageSwitcher from "./LanguageSwitcher";
import PodaciumLogo from "@/components/logo/podacium white png.png";

/* ---------- Types ---------- */

interface FooterLink {
  label: string;
  href: string;
  badge?: "new" | "popular" | "beta";
}

interface LinkCluster {
  heading: string;
  links: FooterLink[];
}

type NewsletterStatus = "idle" | "loading" | "success" | "error";

/* ---------- Mini icons ---------- */

function YouTubeMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/* ---------- Static data ---------- */

const SOCIALS = [
  {
    id: "Twitter",
    href: "https://twitter.com/podacium",
    icon: Twitter,
    hover:
      "hover:bg-[#1DA1F2]/20 hover:text-[#1DA1F2] hover:border-[#1DA1F2]/40",
  },
  {
    id: "LinkedIn",
    href: "https://linkedin.com/company/podacium",
    icon: Linkedin,
    hover:
      "hover:bg-[#0A66C2]/20 hover:text-[#0A66C2] hover:border-[#0A66C2]/40",
  },
  {
    id: "GitHub",
    href: "https://github.com/podacium",
    icon: Github,
    hover: "hover:bg-gray-600/30 hover:text-white hover:border-gray-500/40",
  },
  {
    id: "YouTube",
    href: "https://youtube.com/@PodaciumDZ",
    icon: YouTubeMark,
    hover:
      "hover:bg-[#FF0000]/20 hover:text-[#FF0000] hover:border-[#FF0000]/40",
  },
] as const;

const TRUST = ["footer.trust.law1807", "footer.trust.enterprise"] as const;

const COMMERCE_REG = {
  rc: "RC 24 B 1234567",
  nif: "NIF 001234567890123",
  ai: "AI 1234567",
  nis: "NIS 0123456789",
} as const;

/* ---------- Component ---------- */

const Footer: React.FC = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<NewsletterStatus>("idle");
  const [message, setMessage] = useState("");
  const t = useTranslations();
  const { dir, isRTL } = useBidi();
  const year = new Date().getFullYear();

  const clusters = useMemo<LinkCluster[]>(
    () => [
      {
        heading: "footer.sections.productSuite.title",
        links: [
          {
            label: "footer.sections.productSuite.learnPlatform",
            href: "/learn",
            badge: "popular",
          },
          {
            label: "footer.sections.productSuite.biAnalytics",
            href: "/bi",
            badge: "new",
          },
          { label: "footer.sections.productSuite.talentHub", href: "/hub" },
        ],
      },
      {
        heading: "footer.sections.companyInfo.title",
        links: [
          { label: "footer.sections.companyInfo.about", href: "/about" },
          { label: "footer.sections.companyInfo.partners", href: "/partners" },
          {
            label: "footer.sections.companyInfo.waitlist",
            href: "/waitlist",
            badge: "new",
          },
        ],
      },
      {
        heading: "footer.sections.userSupport.title",
        links: [
          { label: "footer.sections.userSupport.documentation", href: "/docs" },
          { label: "footer.sections.userSupport.helpCenter", href: "/help" },
          {
            label: "footer.sections.userSupport.contactSupport",
            href: "/contact",
          },
        ],
      },
    ],
    [],
  );

  const handleNewsletterSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;

      setStatus("loading");
      setMessage("");

      try {
        const locale =
          document.cookie
            .split("; ")
            .find((c) => c.startsWith("locale="))
            ?.split("=")[1] || "en";

        const res = await fetch("/api/v1/newsletter/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed, locale }),
        });

        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage(t("footer.newsletterSuccess"));
          setEmail("");
        } else {
          setStatus("error");
          setMessage(data.detail || t("footer.newsletterError"));
        }
      } catch {
        setStatus("error");
        setMessage(t("footer.newsletterError"));
      }
    },
    [email, t],
  );

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* ---- Render ---- */

  const stagger = 0.05;

  return (
    <motion.footer
      dir={dir}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-b from-gray-900 to-gray-950 text-white relative overflow-hidden print:hidden pb-16 md:pb-0 pb-safe"
      role="contentinfo"
    >
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* MAIN GRID */}
          <div className="py-14 lg:py-16">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-0">
              {/* LEFT: BRAND */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="lg:w-5/12 lg:pr-10 space-y-6"
              >
                <div className="space-y-4">
                  <Image
                    src={PodaciumLogo}
                    alt={t("common.podaciumLogo")}
                    width={180}
                    height={36}
                    quality={85}
                    sizes="(max-width: 768px) 140px, 180px"
                  />

                  <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
                    {t("footer.description")}
                  </p>
                </div>

                {/* Socials */}
                <nav aria-label={t("footer.socialMedia")}>
                  <div className="flex flex-wrap gap-2.5">
                    {SOCIALS.map((s) => {
                      const Icon = s.icon;
                      return (
                        <a
                          key={s.id}
                          href={s.href}
                          className={cn(
                            "group w-9 h-9 rounded-xl flex items-center justify-center",
                            "bg-gray-800/40 border border-gray-700/30",
                            "text-gray-400",
                            "transition-all duration-200",
                            "hover:scale-110 active:scale-95",
                            s.hover,
                          )}
                          aria-label={t("common.followUsOn", {
                            platform: (s as any).name || s.id,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                        </a>
                      );
                    })}
                  </div>
                </nav>

                {/* Bottom row content moved here: trust + lang + legal + copyright */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {TRUST.map((k) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <svg
                          className="w-3 h-3 text-emerald-400 shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                          {t(k)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] leading-4 tracking-wide text-gray-500 dark:text-slate-400">
                    <span className="bg-gray-800/30 px-1.5 py-0.5 rounded">
                      {COMMERCE_REG.rc}
                    </span>
                    <span className="bg-gray-800/30 px-1.5 py-0.5 rounded">
                      {COMMERCE_REG.nif}
                    </span>
                    <span className="bg-gray-800/30 px-1.5 py-0.5 rounded">
                      {COMMERCE_REG.ai}
                    </span>
                    <span className="bg-gray-800/30 px-1.5 py-0.5 rounded">
                      {COMMERCE_REG.nis}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <LanguageSwitcher variant="footer" />
                    <span
                      className="text-gray-600 dark:text-slate-400 select-none"
                      aria-hidden="true"
                    >
                      |
                    </span>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                      <Link
                        href="/privacy"
                        className="hover:text-white transition-colors"
                        prefetch={false}
                      >
                        {t("footer.links.privacy")}
                      </Link>
                      <span
                        className="select-none text-gray-600 dark:text-slate-400"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <Link
                        href="/terms"
                        className="hover:text-white transition-colors"
                        prefetch={false}
                      >
                        {t("footer.links.terms")}
                      </Link>
                      <span
                        className="select-none text-gray-600 dark:text-slate-400"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <Link
                        href="/refund"
                        className="hover:text-white transition-colors"
                        prefetch={false}
                      >
                        {t("footer.links.refund")}
                      </Link>
                      <span
                        className="select-none text-gray-600 dark:text-slate-400"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <Link
                        href="/cookies"
                        className="hover:text-white transition-colors"
                        prefetch={false}
                      >
                        {t("footer.links.cookies")}
                      </Link>
                    </div>
                    <span
                      className="text-gray-600 dark:text-slate-400 select-none hidden sm:inline"
                      aria-hidden="true"
                    >
                      |
                    </span>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {t("footer.copyright", { year: String(year) })}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT: NEWSLETTER + LINK CLUSTERS */}
              <div className="lg:w-7/12 lg:pl-10 space-y-8">
                {/* Newsletter - full width row */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0 }}
                  className="w-full"
                >
                  <form
                    onSubmit={handleNewsletterSubmit}
                    aria-label={t("footer.newsletterSignup")}
                  >
                    <h3 className="text-xs font-semibold tracking-wider text-gray-500 dark:text-slate-400 uppercase mb-3">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        {t("footer.newsletterTitle")}
                      </span>
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Mail
                          className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400 pointer-events-none",
                            isRTL ? "right-3" : "left-3",
                          )}
                        />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (status !== "idle") setStatus("idle");
                          }}
                          placeholder={t("footer.newsletterPlaceholder")}
                          className={cn(
                            "w-full h-10 rounded-xl border bg-gray-800/40 text-sm text-white placeholder:text-gray-500 dark:text-slate-400",
                            "border-gray-700/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30",
                            "outline-none transition-all duration-200",
                            isRTL ? "pr-10 pl-3" : "pl-10 pr-3",
                            status === "error" && "border-red-500/50",
                            status === "success" && "border-emerald-500/50",
                          )}
                          disabled={status === "loading"}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className={cn(
                          "h-10 px-6 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shrink-0",
                          "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500",
                          "text-white shadow-md hover:shadow-lg active:scale-95",
                          status === "loading" &&
                            "opacity-70 cursor-not-allowed",
                        )}
                      >
                        {status === "loading" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-1">
                            {t("footer.newsletterCta")}{" "}
                            <ArrowUpRight className="w-4 h-4" />
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Status message */}
                    {(status === "success" || status === "error") && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "text-xs mt-2 flex items-center gap-1.5",
                          status === "success"
                            ? "text-emerald-400"
                            : "text-red-400",
                        )}
                      >
                        {status === "success" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {message}
                      </motion.p>
                    )}
                  </form>
                </motion.div>

                {/* Link clusters */}
                <nav aria-label={t("footer.footerNavigation")}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                    {clusters.map((cluster, ci) => (
                      <motion.div
                        key={cluster.heading}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: ci * stagger }}
                      >
                        <h3 className="text-xs font-semibold tracking-wider text-gray-500 dark:text-slate-400 uppercase mb-3">
                          {t(cluster.heading)}
                        </h3>
                        <ul className="space-y-2.5">
                          {cluster.links.map((link) => (
                            <li key={link.href}>
                              <Link
                                href={link.href}
                                className={cn(
                                  "group inline-flex items-center gap-2 text-sm text-gray-400",
                                  "hover:text-white transition-colors duration-150",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded",
                                )}
                                prefetch={false}
                              >
                                <span>{t(link.label)}</span>
                                {link.badge && (
                                  <PodaciumBadge
                                    variant="default"
                                    className="bg-gray-800 text-gray-400 border-gray-700 font-medium text-[10px] px-1.5 py-0 h-4 leading-none"
                                  >
                                    {t(`footer.badges.${link.badge}`)}
                                  </PodaciumBadge>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ))}
                  </div>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
