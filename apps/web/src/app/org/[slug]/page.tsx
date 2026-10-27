"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Briefcase,
  Globe,
  Linkedin,
  Twitter,
  Github,
  Mail,
  Phone,
  Share2,
  FileText,
  Users,
  Star,
  TrendingUp,
  ExternalLink,
  AlertCircle,
  Database,
  FolderGit2,
  ArrowLeft,
  Copy,
  Check,
  MessageSquare,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, PublicOrganizationProfileResponse } from "@/lib/api";
import { getEnumLabel } from "@/lib/constants/organizations";
import { cn } from "@/lib/utils";

import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";
import PodaciumTabs from "@/components/design-system/PodaciumTabs";

export default function OrganizationPublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const { isRTL } = useBidi();

  const slug = useMemo(() => {
    return params?.slug ? String(params.slug) : "";
  }, [params?.slug]);

  const [org, setOrg] = useState<PublicOrganizationProfileResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOrganizationBySlug(slug);
      setOrg(data);
    } catch (err: any) {
      console.error("Failed to load organization profile:", err);
      setError(err?.message || "Failed to load organization profile");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success(t("organizations.publicProfile.profileCopied"));
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div
        className={cn(
          "min-h-[70vh] flex flex-col items-center justify-center p-6 pt-24 text-center",
          isRTL && "font-arabic rtl",
        )}
        data-testid="loading-state"
      >
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          {t("organizations.publicProfile.state.loading")}
        </h2>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div
        className={cn(
          "max-w-3xl mx-auto px-4 pt-28 pb-16 text-center",
          isRTL && "font-arabic rtl",
        )}
        data-testid="not-found-state"
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {t("organizations.publicProfile.state.notFoundTitle")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          {t("organizations.publicProfile.state.notFoundDesc")}
        </p>
        <PodaciumButton
          variant="outline"
          onClick={() => router.push("/organizations")}
          icon={<ArrowLeft className={cn("w-4 h-4", isRTL && "rotate-180")} />}
        >
          {t("organizations.publicProfile.state.backToDirectory")}
        </PodaciumButton>
      </div>
    );
  }

  const brandColor = org.brandAccentColor || "#1B4D3E";
  const legalName = org.kyb?.legalName || org.name;
  const tradeName =
    org.kyb?.tradeName || (org.name !== legalName ? org.name : null);
  const social = org.socialLinks || {};

  const tabsConfig = [
    {
      id: "overview",
      label: t("organizations.publicProfile.tabs.overview"),
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: "caseStudies",
      label: t("organizations.publicProfile.tabs.caseStudies"),
      icon: <TrendingUp className="w-4 h-4" />,
      count: org.caseStudies?.length || 0,
    },
    {
      id: "leadership",
      label: t("organizations.publicProfile.tabs.leadership"),
      icon: <Users className="w-4 h-4" />,
      count: org.leadership?.length || 0,
    },
    {
      id: "reviews",
      label: t("organizations.publicProfile.tabs.reviews"),
      icon: <Star className="w-4 h-4" />,
      count: org.reviewCount || org.companyReviews?.length || 0,
    },
    {
      id: "assets",
      label: t("organizations.publicProfile.tabs.assets"),
      icon: <Database className="w-4 h-4" />,
      count: (org.datasets?.length || 0) + (org.projects?.length || 0),
    },
  ];

  return (
    <div
      className={cn("min-h-screen pb-20", isRTL && "font-arabic rtl")}
      dir={isRTL ? "rtl" : "ltr"}
      data-testid="organization-profile-page"
    >
      {/* ── 1. Corporate Branding Cover Banner ── */}
      <div className="relative w-full h-72 md:h-88 overflow-hidden bg-slate-900">
        {org.coverBannerUrl ? (
          <img
            src={org.coverBannerUrl}
            alt={org.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full opacity-90 transition-all duration-700"
            style={{
              background: `linear-gradient(135deg, ${brandColor} 0%, #0F172A 100%)`,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/40" />
          </div>
        )}

        <div className="absolute top-20 sm:top-24 start-4 end-4 max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/organizations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 backdrop-blur-md text-white text-xs font-medium hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className={cn("w-3.5 h-3.5", isRTL && "rotate-180")} />
            <span>
              {t("organizations.publicProfile.state.backToDirectory")}
            </span>
          </Link>

          <PodaciumButton
            variant="secondary"
            size="sm"
            onClick={handleShare}
            className="bg-black/40 backdrop-blur-md border border-white/20 text-white hover:bg-black/60"
            icon={
              copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )
            }
          >
            {t("organizations.publicProfile.shareProfile")}
          </PodaciumButton>
        </div>
      </div>

      {/* ── 2. Profile Identity Header & Trust Badges ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-20 md:-mt-24 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
            {/* Logo and Core Identity */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              <div
                className="relative p-1 rounded-2xl bg-white dark:bg-slate-900 shadow-xl ring-4 ring-white dark:ring-slate-900"
                style={{ borderColor: brandColor }}
              >
                <PodaciumAvatar
                  name={org.name}
                  alt={org.name}
                  size="xl"
                  className="w-24 h-24 md:w-32 md:h-32 text-2xl md:text-3xl font-bold rounded-xl"
                />
                {org.isKybVerified && (
                  <span
                    className="absolute -bottom-2 -end-2 p-1.5 rounded-full bg-emerald-500 text-white ring-4 ring-white dark:ring-slate-900 shadow-md"
                    title={t("organizations.publicProfile.trustCnrc")}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {legalName}
                  </h1>

                  {tradeName && (
                    <PodaciumBadge
                      variant="outline"
                      className="text-xs font-medium"
                    >
                      {t("organizations.publicProfile.dba")}: {tradeName}
                    </PodaciumBadge>
                  )}

                  {org.isKybVerified && (
                    <PodaciumBadge
                      variant="success"
                      className="gap-1 shadow-sm font-semibold"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t("organizations.publicProfile.kybBadge")}
                    </PodaciumBadge>
                  )}
                </div>

                {org.tagline && (
                  <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-2xl font-medium">
                    {org.tagline}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-500 dark:text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <span>{getEnumLabel("sector", org.sector, t)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>
                      {getEnumLabel("city", org.city, t)},{" "}
                      {getEnumLabel("country", org.country, t)}
                    </span>
                  </span>
                  {org.kybRiskScore !== undefined &&
                    org.kybRiskScore !== null && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Award className="w-4 h-4" />
                        {t("organizations.publicProfile.kybRiskScore", {
                          score: org.kybRiskScore,
                        })}
                      </span>
                    )}
                </div>
              </div>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-wrap items-center gap-2.5">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => {
                  if (social.email) {
                    window.location.href = `mailto:${social.email}`;
                  } else {
                    toast.info(
                      t("organizations.publicProfile.contactOrganization"),
                    );
                  }
                }}
                icon={<Mail className="w-4 h-4" />}
              >
                {t("organizations.publicProfile.contactOrganization")}
              </PodaciumButton>

              <PodaciumButton
                variant="primary"
                size="sm"
                onClick={() => {
                  router.push(`/contracts/new?orgId=${org.id}`);
                }}
                icon={<Briefcase className="w-4 h-4" />}
              >
                {t("organizations.publicProfile.requestQuote")}
              </PodaciumButton>
            </div>
          </div>

          {/* Trust Badges Strip */}
          <div className="flex flex-wrap items-center gap-2.5 py-4">
            <PodaciumBadge
              variant="outline"
              className="gap-1.5 py-1 px-3 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {t("organizations.publicProfile.trustCnrc")}
            </PodaciumBadge>

            <PodaciumBadge
              variant="outline"
              className="gap-1.5 py-1 px-3 border-blue-500/30 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/20"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              {t("organizations.publicProfile.trustAnae")}
            </PodaciumBadge>

            <PodaciumBadge
              variant="outline"
              className="gap-1.5 py-1 px-3 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20"
            >
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              {t("organizations.publicProfile.trustIso")}
            </PodaciumBadge>

            <PodaciumBadge
              variant="gradient"
              className="gap-1.5 py-1 px-3 font-semibold"
            >
              <Building2 className="w-3.5 h-3.5" />
              {t("organizations.publicProfile.trustEnterprise")}
            </PodaciumBadge>
          </div>

          {/* Algerian Article 169 & 224 CIDTA Fiscal Shield Banner */}
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-transparent dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500 text-white shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t("organizations.publicProfile.fiscalShieldTitle")}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl mt-0.5">
                  {t("organizations.publicProfile.fiscalShieldDesc")}
                </p>
              </div>
            </div>
            <PodaciumBadge
              variant="success"
              className="shrink-0 self-start sm:self-center font-bold"
            >
              {t("organizations.publicProfile.fiscalShieldBadge")}
            </PodaciumBadge>
          </div>
        </div>

        {/* ── 3. Tabs Navigation ── */}
        <div className="mb-8">
          <PodaciumTabs
            tabs={tabsConfig}
            defaultTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId)}
            variant="pills"
          />
        </div>

        {/* ── 4. Tab Panels ── */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Rich About & Competencies */}
            <div className="lg:col-span-2 space-y-6">
              <PodaciumCard variant="default" padding="lg">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  {t("organizations.publicProfile.about.overview")}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                  {org.orgProfile?.longDescription ||
                    org.description ||
                    t("organizations.publicProfile.about.title", {
                      name: org.name,
                    })}
                </p>
              </PodaciumCard>

              {org.orgProfile?.mission && (
                <PodaciumCard variant="default" padding="lg">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {t("organizations.publicProfile.about.mission")}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {org.orgProfile.mission}
                  </p>
                </PodaciumCard>
              )}

              {org.orgProfile?.culture && (
                <PodaciumCard variant="default" padding="lg">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {t("organizations.publicProfile.about.culture")}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {org.orgProfile.culture}
                  </p>
                </PodaciumCard>
              )}

              {org.orgProfile?.benefits && (
                <PodaciumCard variant="default" padding="lg">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {t("organizations.publicProfile.about.benefits")}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {org.orgProfile.benefits}
                  </p>
                </PodaciumCard>
              )}

              {/* Specialties & Tech Stack */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <PodaciumCard variant="default" padding="md">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                    {t("organizations.publicProfile.about.specialties")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {org.orgProfile?.specialties &&
                    org.orgProfile.specialties.length > 0 ? (
                      org.orgProfile.specialties.map((spec, idx) => (
                        <PodaciumBadge key={idx} variant="secondary">
                          {spec}
                        </PodaciumBadge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        {org.sector}
                      </span>
                    )}
                  </div>
                </PodaciumCard>

                <PodaciumCard variant="default" padding="md">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                    {t("organizations.publicProfile.about.technologies")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {org.orgProfile?.technologies &&
                    org.orgProfile.technologies.length > 0 ? (
                      org.orgProfile.technologies.map((tech, idx) => (
                        <PodaciumBadge
                          key={idx}
                          variant="outline"
                          className="font-mono text-xs"
                        >
                          {tech}
                        </PodaciumBadge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        {t("organizations.publicProfile.about.enterpriseStack")}
                      </span>
                    )}
                  </div>
                </PodaciumCard>
              </div>
            </div>

            {/* Right Col: Statutory Fiscal Registry & External Channels */}
            <div className="space-y-6">
              {/* Statutory Fiscal Card */}
              <PodaciumCard
                variant="default"
                padding="lg"
                className="border-t-4 border-t-primary"
              >
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t("organizations.publicProfile.fiscalNumbers.title")}
                  </h3>
                </div>

                <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">
                      {t("organizations.publicProfile.fiscalNumbers.rc")}
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {org.rcNumber || org.kyb?.rcNumber || "—"}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">
                      {t("organizations.publicProfile.fiscalNumbers.nif")}
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {org.nifNumber || org.kyb?.nifNumber || "—"}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">
                      {t("organizations.publicProfile.fiscalNumbers.nis")}
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {org.nisNumber || org.kyb?.nisNumber || "—"}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">
                      {t("organizations.publicProfile.fiscalNumbers.article")}
                    </span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {org.articleImposition || "—"}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <span className="text-slate-500">
                      {t("organizations.publicProfile.fiscalNumbers.regime")}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {org.taxRegime || "REEL"}
                    </span>
                  </div>
                </div>
              </PodaciumCard>

              {/* Channels & External Links */}
              <PodaciumCard variant="default" padding="lg">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                  {t("organizations.publicProfile.channels.title")}
                </h3>

                <div className="space-y-3 text-sm">
                  {org.website && (
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2.5">
                        <Globe className="w-4 h-4 text-primary" />
                        <span>
                          {t("organizations.publicProfile.channels.website")}
                        </span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {social.linkedin && (
                    <a
                      href={social.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2.5">
                        <Linkedin className="w-4 h-4 text-[#0077b5]" />
                        <span>
                          {t("organizations.publicProfile.channels.linkedin")}
                        </span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {social.twitter && (
                    <a
                      href={social.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2.5">
                        <Twitter className="w-4 h-4 text-sky-500" />
                        <span>
                          {t("organizations.publicProfile.channels.twitter")}
                        </span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {social.github && (
                    <a
                      href={social.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2.5">
                        <Github className="w-4 h-4 text-slate-800 dark:text-white" />
                        <span>
                          {t("organizations.publicProfile.channels.github")}
                        </span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {social.email && (
                    <a
                      href={`mailto:${social.email}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-emerald-600" />
                        <span>{social.email}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {social.phone && (
                    <a
                      href={`tel:${social.phone}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-slate-700 dark:text-slate-300"
                    >
                      <span className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-indigo-600" />
                        <span>{social.phone}</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}
                </div>
              </PodaciumCard>
            </div>
          </div>
        )}

        {/* ── B2B Case Studies Tab ── */}
        {activeTab === "caseStudies" && (
          <div className="space-y-6" data-testid="case-studies-section">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {t("organizations.publicProfile.caseStudies.title")}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("organizations.publicProfile.caseStudies.subtitle")}
              </p>
            </div>

            {!org.caseStudies || org.caseStudies.length === 0 ? (
              <PodaciumCard
                variant="default"
                padding="lg"
                className="text-center py-12"
              >
                <TrendingUp className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">
                  {t("organizations.publicProfile.caseStudies.empty")}
                </p>
              </PodaciumCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {org.caseStudies.map((study) => {
                  const roi = Array.isArray(study.roiMetrics)
                    ? study.roiMetrics
                    : [];

                  return (
                    <PodaciumCard
                      key={study.id}
                      variant="elevated"
                      padding="lg"
                      hover
                      className="flex flex-col justify-between"
                      data-testid={`case-study-card-${study.id}`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {study.title}
                          </h3>
                          {study.isFeatured && (
                            <PodaciumBadge
                              variant="gradient"
                              className="shrink-0 text-xs font-semibold"
                            >
                              {t(
                                "organizations.publicProfile.caseStudies.featured",
                              )}
                            </PodaciumBadge>
                          )}
                        </div>

                        {study.clientName && (
                          <p className="text-xs font-medium text-primary mb-3">
                            {study.clientName}{" "}
                            {study.industry && `• ${study.industry}`}
                          </p>
                        )}

                        <div className="space-y-3 mb-4 text-xs">
                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {t(
                                "organizations.publicProfile.caseStudies.problem",
                              )}
                              :
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                              {study.problemStatement}
                            </p>
                          </div>

                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {t(
                                "organizations.publicProfile.caseStudies.solution",
                              )}
                              :
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                              {study.solutionSummary}
                            </p>
                          </div>
                        </div>

                        {roi.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 mb-4">
                            {roi.map((metric: any, i: number) => (
                              <div key={i}>
                                <div className="text-base md:text-lg font-black text-emerald-700 dark:text-emerald-300">
                                  {metric.value}
                                </div>
                                <div className="text-[11px] text-emerald-800/80 dark:text-emerald-400">
                                  {metric.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {study.technologies && study.technologies.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                          {study.technologies.map((tech, i) => (
                            <PodaciumBadge
                              key={i}
                              variant="outline"
                              className="text-[10px] font-mono"
                            >
                              {tech}
                            </PodaciumBadge>
                          ))}
                        </div>
                      )}
                    </PodaciumCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Executive Leadership Tab ── */}
        {activeTab === "leadership" && (
          <div className="space-y-6" data-testid="leadership-section">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {t("organizations.publicProfile.leadership.title")}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("organizations.publicProfile.leadership.subtitle")}
              </p>
            </div>

            {!org.leadership || org.leadership.length === 0 ? (
              <PodaciumCard
                variant="default"
                padding="lg"
                className="text-center py-12"
              >
                <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">
                  {t("organizations.publicProfile.leadership.empty")}
                </p>
              </PodaciumCard>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {org.leadership.map((leader) => (
                  <PodaciumCard
                    key={leader.id}
                    variant="default"
                    padding="lg"
                    hover
                    className="flex flex-col items-center text-center"
                    data-testid={`leadership-card-${leader.id}`}
                  >
                    <PodaciumAvatar
                      src={leader.avatarUrl}
                      name={leader.fullName}
                      alt={leader.fullName}
                      size="lg"
                      className="w-20 h-20 text-xl font-bold mb-3 shadow-md"
                    />

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {leader.fullName}
                    </h3>
                    <p className="text-xs font-semibold text-primary mb-3">
                      {leader.roleTitle}
                    </p>

                    {leader.bio && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
                        {leader.bio}
                      </p>
                    )}

                    {leader.linkedinUrl && (
                      <a
                        href={leader.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#0077b5] font-semibold hover:underline mt-auto"
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                        <span>
                          {t(
                            "organizations.publicProfile.leadership.viewLinkedin",
                          )}
                        </span>
                      </a>
                    )}
                  </PodaciumCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Verified Reviews Tab ── */}
        {activeTab === "reviews" && (
          <div className="space-y-6" data-testid="reviews-section">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("organizations.publicProfile.reviews.title")}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("organizations.publicProfile.reviews.subtitle")}
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-5 h-5 fill-amber-400" />
                  <span className="text-xl font-black text-slate-900 dark:text-white">
                    {org.averageRating ? org.averageRating.toFixed(1) : "5.0"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {org.reviewCount || org.companyReviews?.length || 0}{" "}
                  {t("organizations.directory.reviewsCount", {
                    count: org.reviewCount || org.companyReviews?.length || 0,
                  })}
                </div>
              </div>
            </div>

            {!org.companyReviews || org.companyReviews.length === 0 ? (
              <PodaciumCard
                variant="default"
                padding="lg"
                className="text-center py-12"
              >
                <Star className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                <p className="text-sm text-slate-500">
                  {t("organizations.publicProfile.reviews.empty")}
                </p>
              </PodaciumCard>
            ) : (
              <div className="space-y-4">
                {org.companyReviews.map((rev) => {
                  const revTypeKey = rev.reviewerType as
                    "FREELANCER" | "CLIENT" | "CORPORATE_LEARNER";
                  const localizedRevType =
                    revTypeKey === "FREELANCER"
                      ? t(
                          "organizations.publicProfile.reviews.reviewerTypes.FREELANCER",
                        )
                      : revTypeKey === "CLIENT"
                        ? t(
                            "organizations.publicProfile.reviews.reviewerTypes.CLIENT",
                          )
                        : t(
                            "organizations.publicProfile.reviews.reviewerTypes.CORPORATE_LEARNER",
                          );

                  return (
                    <PodaciumCard
                      key={rev.id}
                      variant="default"
                      padding="lg"
                      data-testid={`review-card-${rev.id}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <PodaciumBadge
                            variant="secondary"
                            className="text-xs font-semibold"
                          >
                            {localizedRevType}
                          </PodaciumBadge>
                          {rev.isVerifiedContract && (
                            <PodaciumBadge
                              variant="success"
                              className="gap-1 text-xs"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              {t(
                                "organizations.publicProfile.reviews.verifiedContract",
                              )}
                            </PodaciumBadge>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-amber-500">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-4 h-4",
                                i < Math.round(rev.overallRating)
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-slate-300 dark:text-slate-700",
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {rev.title && (
                        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                          {rev.title}
                        </h4>
                      )}

                      {rev.comment && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                          {rev.comment}
                        </p>
                      )}

                      {/* Dimension Ratings */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                        {rev.scopeClarityRating !== null &&
                          rev.scopeClarityRating !== undefined && (
                            <div>
                              <span className="block text-slate-400">
                                {t(
                                  "organizations.publicProfile.reviews.qualityScore",
                                )}
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {rev.scopeClarityRating.toFixed(1)} / 5.0
                              </span>
                            </div>
                          )}
                        {rev.paymentPromptnessRating !== null &&
                          rev.paymentPromptnessRating !== undefined && (
                            <div>
                              <span className="block text-slate-400">
                                {t(
                                  "organizations.publicProfile.reviews.deadlinesScore",
                                )}
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {rev.paymentPromptnessRating.toFixed(1)} / 5.0
                              </span>
                            </div>
                          )}
                        {rev.communicationRating !== null &&
                          rev.communicationRating !== undefined && (
                            <div>
                              <span className="block text-slate-400">
                                {t(
                                  "organizations.publicProfile.reviews.communicationScore",
                                )}
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {rev.communicationRating.toFixed(1)} / 5.0
                              </span>
                            </div>
                          )}
                        <div>
                          <span className="block text-slate-400">
                            {t(
                              "organizations.publicProfile.reviews.valueScore",
                            )}
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {rev.overallRating.toFixed(1)} / 5.0
                          </span>
                        </div>
                      </div>
                    </PodaciumCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Public Datasets & Projects Tab ── */}
        {activeTab === "assets" && (
          <div className="space-y-8" data-testid="assets-section">
            {/* Datasets */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t("organizations.publicProfile.assets.datasetsTitle")}
                </h3>
              </div>

              {!org.datasets || org.datasets.length === 0 ? (
                <PodaciumCard
                  variant="default"
                  padding="md"
                  className="text-center py-8"
                >
                  <p className="text-xs text-slate-500">
                    {t("organizations.publicProfile.assets.noDatasets")}
                  </p>
                </PodaciumCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {org.datasets.map((ds) => (
                    <PodaciumCard
                      key={ds.id}
                      variant="default"
                      padding="md"
                      hover
                    >
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                        {ds.name}
                      </h4>
                      {ds.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                          {ds.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <PodaciumBadge variant="secondary">
                          {t("organizations.publicProfile.assets.rowsCount", {
                            count: ds.rowsCount || 0,
                          })}
                        </PodaciumBadge>
                        <PodaciumButton
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                        >
                          {t("organizations.openBi")}
                        </PodaciumButton>
                      </div>
                    </PodaciumCard>
                  ))}
                </div>
              )}
            </div>

            {/* Projects */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FolderGit2 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t("organizations.publicProfile.assets.projectsTitle")}
                </h3>
              </div>

              {!org.projects || org.projects.length === 0 ? (
                <PodaciumCard
                  variant="default"
                  padding="md"
                  className="text-center py-8"
                >
                  <p className="text-xs text-slate-500">
                    {t("organizations.publicProfile.assets.noProjects")}
                  </p>
                </PodaciumCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {org.projects.map((proj) => (
                    <PodaciumCard
                      key={proj.id}
                      variant="default"
                      padding="md"
                      hover
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {proj.title}
                        </h4>
                        {proj.status && (
                          <PodaciumBadge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {proj.status}
                          </PodaciumBadge>
                        )}
                      </div>
                      {proj.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          {proj.description}
                        </p>
                      )}
                      {proj.category && (
                        <span className="text-[11px] text-primary font-medium">
                          {proj.category}
                        </span>
                      )}
                    </PodaciumCard>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
