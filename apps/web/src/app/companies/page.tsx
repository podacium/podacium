"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  MapPin,
  ShieldCheck,
  Star,
  Users,
  LayoutGrid,
  List,
  ChevronRight,
  Filter,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, PublicOrganizationSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import {
  ALGERIAN_58_WILAYAS,
  findWilayaByCodeOrName,
  formatWilayaLabel,
} from "@/lib/constants/algeria-wilayas";
import { SECTORS } from "@/lib/constants/organizations";

const COMPANY_SIZE_BRACKETS = [
  "MICRO_1_10",
  "SMALL_11_50",
  "MID_51_200",
  "LARGE_201_500",
  "ENTERPRISE_500_PLUS",
] as const;

export default function CompaniesDirectoryPage() {
  const t = useTranslations();
  const { isRTL } = useBidi();

  const [companies, setCompanies] = useState<PublicOrganizationSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedWilaya, setSelectedWilaya] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [kybOnly, setKybOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchDirectory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: {
        sector?: string;
        city?: string;
        companySizeBracket?: string;
        search?: string;
        limit?: number;
      } = {
        limit: 100,
      };

      if (selectedSector) params.sector = selectedSector;
      if (selectedSize) params.companySizeBracket = selectedSize;

      if (selectedWilaya) {
        const matched = ALGERIAN_58_WILAYAS.find(
          (w) => w.code === selectedWilaya,
        );
        if (matched?.cityEnum) {
          params.city = matched.cityEnum;
        }
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.getPublicOrganizationDirectory(params);
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setCompanies(list);
    } catch (err: any) {
      console.error("Failed to load company directory:", err);
      setError(err?.message || "Failed to load company directory");
    } finally {
      setLoading(false);
    }
  }, [selectedSector, selectedWilaya, selectedSize, searchQuery]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  // Client-side filtering ensures snappy real-time responsiveness
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = company.name?.toLowerCase().includes(q);
        const taglineMatch = company.tagline?.toLowerCase().includes(q);
        const sectorMatch = company.sector?.toLowerCase().includes(q);
        const cityMatch = company.city?.toLowerCase().includes(q);
        if (!nameMatch && !taglineMatch && !sectorMatch && !cityMatch) {
          return false;
        }
      }

      // 2. Wilaya filter
      if (selectedWilaya) {
        const wilaya = ALGERIAN_58_WILAYAS.find(
          (w) => w.code === selectedWilaya,
        );
        if (wilaya) {
          const companyCityClean = (company.city || "").trim().toLowerCase();
          const matchesEnum =
            wilaya.cityEnum &&
            wilaya.cityEnum.toLowerCase() === companyCityClean;
          const matchesCode =
            wilaya.code === companyCityClean ||
            companyCityClean.startsWith(wilaya.code);
          const matchesNameFr = companyCityClean.includes(
            wilaya.nameFr.toLowerCase(),
          );
          const matchesNameAr = companyCityClean.includes(wilaya.nameAr);

          if (
            !matchesEnum &&
            !matchesCode &&
            !matchesNameFr &&
            !matchesNameAr
          ) {
            return false;
          }
        }
      }

      // 3. Sector filter
      if (selectedSector && company.sector !== selectedSector) {
        return false;
      }

      // 4. Size bracket filter
      if (selectedSize && company.companySizeBracket !== selectedSize) {
        return false;
      }

      // 5. KYB Verified filter
      if (
        kybOnly &&
        !(company.isKybVerified || company.kybStatus === "APPROVED")
      ) {
        return false;
      }

      return true;
    });
  }, [
    companies,
    searchQuery,
    selectedWilaya,
    selectedSector,
    selectedSize,
    kybOnly,
  ]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(selectedWilaya) ||
    Boolean(selectedSector) ||
    Boolean(selectedSize) ||
    kybOnly;

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedWilaya("");
    setSelectedSector("");
    setSelectedSize("");
    setKybOnly(false);
  };

  const wilayaOptions = useMemo(() => {
    return [
      {
        value: "",
        label: t("organizations.directory.allWilayas"),
      },
      ...ALGERIAN_58_WILAYAS.map((w) => ({
        value: w.code,
        label: `${w.code} - ${isRTL ? w.nameAr : w.nameFr}`,
      })),
    ];
  }, [t, isRTL]);

  const sectorOptions = useMemo(() => {
    return [
      {
        value: "",
        label: t("organizations.directory.allSectors"),
      },
      ...SECTORS.map((s) => ({
        value: s,
        label: t(`organizations.directory.sectors.${s}`),
      })),
    ];
  }, [t]);

  const sizeOptions = useMemo(() => {
    return [
      {
        value: "",
        label: t("organizations.directory.allSizes"),
      },
      ...COMPANY_SIZE_BRACKETS.map((b) => ({
        value: b,
        label: t(`organizations.directory.sizes.${b}`),
      })),
    ];
  }, [t]);

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground pb-20",
        isRTL && "font-arabic",
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header / Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-card/80 to-background/50 backdrop-blur-md">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-10 sm:pb-14 relative z-10">
          <nav
            aria-label={t("organizations.directory.breadcrumbAriaLabel")}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-4"
          >
            <Link href="/" className="hover:text-foreground transition-colors">
              {t("common.nav.home")}
            </Link>
            <ChevronRight
              className={cn("w-3.5 h-3.5", isRTL && "rotate-180")}
            />
            <span className="text-foreground">
              {t("organizations.directory.title")}
            </span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-3xl">
              <PodaciumBadge
                variant="gradient"
                className="mb-3 px-3 py-1 text-xs gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("organizations.directory.badge")}</span>
              </PodaciumBadge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                {t("organizations.directory.title")}
              </h1>
              <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
                {t("organizations.directory.subtitle")}
              </p>
            </div>

            {/* Quick Metrics Badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-card/60 border border-border/80 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground shadow-sm">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>{t("organizations.directory.allWilayas")}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/60 border border-border/80 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t("organizations.directory.allSectors")}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/60 border border-border/80 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t("organizations.directory.verifiedBadge")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content & Filters */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Controls Container */}
        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 mb-8 shadow-sm backdrop-blur-sm space-y-4">
          {/* Top row: Search and View Mode toggles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <PodaciumInput
                type="search"
                role="searchbox"
                aria-label={t("organizations.directory.searchPlaceholder")}
                placeholder={t("organizations.directory.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-muted-foreground" />}
                className="w-full bg-background/90"
              />
            </div>

            {/* View Mode Toggle */}
            <div
              className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg self-end sm:self-auto border border-border/50"
              role="group"
              aria-label={t("organizations.directory.viewLayoutToggle")}
            >
              <PodaciumButton
                type="button"
                variant={viewMode === "grid" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-label={t("organizations.directory.gridView")}
                className="h-8 px-2.5 gap-1.5"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">
                  {t("organizations.directory.gridView")}
                </span>
              </PodaciumButton>
              <PodaciumButton
                type="button"
                variant={viewMode === "list" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                aria-label={t("organizations.directory.listView")}
                className="h-8 px-2.5 gap-1.5"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">
                  {t("organizations.directory.listView")}
                </span>
              </PodaciumButton>
            </div>
          </div>

          {/* Filter dropdowns row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/40">
            {/* Wilaya Filter */}
            <div>
              <PodaciumSelect
                label={t("organizations.directory.filterWilaya")}
                options={wilayaOptions}
                value={selectedWilaya}
                onChange={(e) => setSelectedWilaya(e.target.value)}
                className="bg-background/90 text-sm"
                aria-label={t("organizations.directory.filterWilaya")}
              />
            </div>

            {/* Sector Filter */}
            <div>
              <PodaciumSelect
                label={t("organizations.directory.filterSector")}
                options={sectorOptions}
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="bg-background/90 text-sm"
                aria-label={t("organizations.directory.filterSector")}
              />
            </div>

            {/* Size Bracket Filter */}
            <div>
              <PodaciumSelect
                label={t("organizations.directory.filterSize")}
                options={sizeOptions}
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                className="bg-background/90 text-sm"
                aria-label={t("organizations.directory.filterSize")}
              />
            </div>

            {/* KYB Verified Only toggle + Reset button */}
            <div className="flex flex-col justify-end space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground invisible sm:block">
                &nbsp;
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setKybOnly((prev) => !prev)}
                  className={cn(
                    "flex-1 inline-flex items-center justify-center gap-2 h-10 px-3 rounded-lg border text-xs font-semibold transition-all select-none",
                    kybOnly
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                      : "border-border bg-background/80 hover:bg-muted text-muted-foreground",
                  )}
                  aria-pressed={kybOnly}
                >
                  <ShieldCheck
                    className={cn(
                      "w-4 h-4",
                      kybOnly ? "text-emerald-500" : "text-muted-foreground",
                    )}
                  />
                  <span>{t("organizations.directory.kybVerifiedOnly")}</span>
                </button>

                {hasActiveFilters && (
                  <PodaciumButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    title={t("organizations.directory.resetFilters")}
                    className="h-10 px-2.5 text-muted-foreground hover:text-foreground"
                    aria-label={t("organizations.directory.resetFilters")}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </PodaciumButton>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results Bar */}
        <div className="flex items-center justify-between mb-6 px-1">
          <p className="text-sm font-medium text-muted-foreground">
            {t("organizations.directory.companiesFound", {
              count: filteredCompanies.length,
            })}
          </p>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t("organizations.directory.resetFilters")}</span>
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div
            className={cn(
              "grid gap-6",
              viewMode === "grid"
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1",
            )}
            data-testid="directory-loading"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card/40 border border-border/60 rounded-xl p-5 animate-pulse space-y-4"
              >
                <div className="h-28 bg-muted/60 rounded-lg" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted/60 rounded w-1/3" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 bg-muted/50 rounded w-full" />
                  <div className="h-3 bg-muted/50 rounded w-4/5" />
                </div>
                <div className="h-9 bg-muted/70 rounded-lg w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6 text-center my-8">
            <p className="text-sm text-destructive font-semibold mb-3">
              {error}
            </p>
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={fetchDirectory}
            >
              {t("common.retry")}
            </PodaciumButton>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredCompanies.length === 0 && (
          <div className="bg-card/30 border border-dashed border-border/80 rounded-2xl p-12 text-center my-8 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {t("organizations.directory.noCompaniesFound")}
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("organizations.directory.noCompaniesDesc")}
            </p>
            {hasActiveFilters && (
              <div className="mt-5">
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t("organizations.directory.resetFilters")}</span>
                </PodaciumButton>
              </div>
            )}
          </div>
        )}

        {/* Company Cards List / Grid */}
        {!loading && !error && filteredCompanies.length > 0 && (
          <div
            className={cn(
              "grid gap-6",
              viewMode === "grid"
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1",
            )}
            data-testid="company-cards-container"
          >
            {filteredCompanies.map((company) => (
              <CompanyCard
                key={company.id}
                company={company}
                viewMode={viewMode}
                isRTL={isRTL}
                t={t}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface CompanyCardProps {
  company: PublicOrganizationSummary;
  viewMode: "grid" | "list";
  isRTL: boolean;
  t: (key: string, vars?: any, fallback?: string) => string;
}

function CompanyCard({ company, viewMode, isRTL, t }: CompanyCardProps) {
  const isVerified = Boolean(
    company.isKybVerified || company.kybStatus === "APPROVED",
  );

  // Tagline truncated to < 160 characters
  const rawTagline = company.tagline || "";
  const displayTagline =
    rawTagline.length > 160 ? `${rawTagline.slice(0, 157)}...` : rawTagline;

  // Format Wilaya
  const wilayaLabel = formatWilayaLabel(company.city, isRTL);

  // Fallback initial letters for company avatar
  const initials = (company.name || "CO")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const brandColor = company.brandAccentColor || "#1B4D3E";

  const rawSectorTranslated = t(`organizations.directory.sectors.${company.sector}`);
  const sectorLabel =
    rawSectorTranslated &&
    rawSectorTranslated !== `organizations.directory.sectors.${company.sector}`
      ? rawSectorTranslated
      : t(
          `directory.sectors.${company.sector}`,
          undefined,
          company.sector
            ? String(company.sector).replace(/_/g, " ")
            : "Enterprise",
        );

  const rawSizeTranslated = company.companySizeBracket
    ? t(`organizations.directory.sizes.${company.companySizeBracket}`)
    : "";
  const sizeLabel = company.companySizeBracket
    ? rawSizeTranslated &&
      rawSizeTranslated !==
        `organizations.directory.sizes.${company.companySizeBracket}`
      ? rawSizeTranslated
      : t(
          `directory.sizes.${company.companySizeBracket}`,
          undefined,
          company.companySizeBracket.replace(/_/g, " "),
        )
    : null;

  const showcaseUrl = `/org/${company.slug || company.id}`;

  if (viewMode === "list") {
    return (
      <PodaciumCard
        hover
        padding="none"
        className="overflow-hidden border border-border/80 bg-card/60 backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-md"
        data-testid={`company-card-${company.id}`}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center p-4 sm:p-5 gap-4 sm:gap-6">
          {/* Logo / Avatar */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-border/80 shadow-inner flex items-center justify-center font-bold text-lg text-white overflow-hidden"
              style={{ backgroundColor: brandColor }}
              aria-hidden="true"
            >
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={t("common.uiLabels.companyLogoAlt", {
                    name: company.name,
                  })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                <Link
                  href={showcaseUrl}
                  className="hover:text-primary transition-colors"
                >
                  {company.name}
                </Link>
              </h2>

              {/* KYB Badge */}
              {isVerified ? (
                <PodaciumBadge
                  variant="success"
                  className="gap-1 text-[11px] font-semibold px-2 py-0.5"
                  title={t("organizations.directory.verifiedTooltip")}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("organizations.directory.verifiedBadge")}</span>
                </PodaciumBadge>
              ) : (
                <PodaciumBadge
                  variant="outline"
                  className="text-[11px] font-medium text-muted-foreground px-2 py-0.5"
                >
                  <span>{t("organizations.directory.unverifiedBadge")}</span>
                </PodaciumBadge>
              )}
            </div>

            {/* Tagline */}
            {displayTagline && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {displayTagline}
              </p>
            )}

            {/* Metadata Chips */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                {sectorLabel}
              </span>

              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                {wilayaLabel}
              </span>

              {sizeLabel && (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-500" />
                  {sizeLabel}
                </span>
              )}

              {/* Rating */}
              <div className="inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-foreground">
                  {company.averageRating > 0
                    ? company.averageRating.toFixed(1)
                    : "—"}
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {company.reviewCount > 0
                    ? `(${company.reviewCount})`
                    : t("organizations.directory.noReviews")}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex-shrink-0 sm:self-center pt-2 sm:pt-0">
            <PodaciumButton
              href={showcaseUrl}
              variant="primary"
              size="sm"
              className="w-full sm:w-auto gap-1.5"
            >
              <span>{t("organizations.directory.viewShowcase")}</span>
              <ChevronRight
                className={cn("w-3.5 h-3.5", isRTL && "rotate-180")}
              />
            </PodaciumButton>
          </div>
        </div>
      </PodaciumCard>
    );
  }

  // Grid View Mode
  return (
    <PodaciumCard
      hover
      padding="none"
      className="flex flex-col h-full overflow-hidden border border-border/80 bg-card/60 backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-lg"
      data-testid={`company-card-${company.id}`}
    >
      {/* Cover Banner Preview */}
      <div
        className="relative h-28 w-full overflow-hidden border-b border-border/50"
        style={{
          background: company.coverBannerUrl
            ? `url(${company.coverBannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${brandColor} 0%, #0F172A 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

        {/* Sector badge positioned at top start */}
        <div className="absolute top-2.5 start-2.5 z-10">
          <PodaciumBadge
            variant="secondary"
            className="text-[10px] uppercase tracking-wider font-bold bg-background/85 backdrop-blur-md border border-white/10"
          >
            {sectorLabel}
          </PodaciumBadge>
        </div>

        {/* KYB Badge positioned at top end */}
        <div className="absolute top-2.5 end-2.5 z-10">
          {isVerified ? (
            <PodaciumBadge
              variant="success"
              className="gap-1 text-[11px] font-semibold bg-emerald-950/90 text-emerald-300 border-emerald-500/30 backdrop-blur-md px-2 py-0.5"
              title={t("organizations.directory.verifiedTooltip")}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t("organizations.directory.verifiedBadge")}</span>
            </PodaciumBadge>
          ) : (
            <PodaciumBadge
              variant="outline"
              className="text-[10px] font-medium bg-black/40 text-slate-300 border-white/20 backdrop-blur-md px-2 py-0.5"
            >
              <span>{t("organizations.directory.unverifiedBadge")}</span>
            </PodaciumBadge>
          )}
        </div>
      </div>

      {/* Body Container */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Avatar floating over banner */}
          <div className="-mt-11 mb-3 relative z-10">
            <div
              className="w-14 h-14 rounded-xl border-2 border-background shadow-md flex items-center justify-center font-bold text-lg text-white overflow-hidden"
              style={{ backgroundColor: brandColor }}
              aria-hidden="true"
            >
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={t("common.uiLabels.companyLogoAlt", {
                    name: company.name,
                  })}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>

          {/* Company Name */}
          <h2 className="text-lg font-bold text-foreground leading-snug line-clamp-1">
            <Link
              href={showcaseUrl}
              className="hover:text-primary transition-colors"
            >
              {company.name}
            </Link>
          </h2>

          {/* City / Wilaya */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
            <span className="truncate">{wilayaLabel}</span>
          </div>

          {/* Tagline */}
          <p className="mt-2.5 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
            {displayTagline || (
              <span className="italic opacity-60">
                {t("organizations.directory.noTagline")}
              </span>
            )}
          </p>
        </div>

        {/* Footer info: Rating, Size, Button */}
        <div className="space-y-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {/* Rating Stars & Count */}
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-bold text-foreground">
                {company.averageRating > 0
                  ? company.averageRating.toFixed(1)
                  : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {company.reviewCount > 0
                  ? `(${company.reviewCount})`
                  : t("organizations.directory.noReviews")}
              </span>
            </div>

            {/* Size Bracket */}
            {sizeLabel && (
              <div className="flex items-center gap-1 text-[11px] font-medium bg-muted/60 px-2 py-0.5 rounded">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{sizeLabel}</span>
              </div>
            )}
          </div>

          {/* View Showcase CTA */}
          <PodaciumButton
            href={showcaseUrl}
            variant="outline"
            size="sm"
            fullWidth
            className="gap-1.5 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all font-semibold"
          >
            <span>{t("organizations.directory.viewShowcase")}</span>
            <ChevronRight
              className={cn("w-3.5 h-3.5", isRTL && "rotate-180")}
            />
          </PodaciumButton>
        </div>
      </div>
    </PodaciumCard>
  );
}
