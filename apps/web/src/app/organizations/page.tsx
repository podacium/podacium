"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Plus,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Briefcase,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { api, OrganizationResponse } from "@/lib/api";
import { getEnumLabel } from "@/lib/constants/organizations";
import { formatWilayaLabel } from "@/lib/constants/algeria-wilayas";
import { cn } from "@/lib/utils";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import { EnterpriseOrgOnboardingModal } from "@/components/organizations/EnterpriseOrgOnboardingModal";

export default function OrganizationsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { isRTL } = useBidi();
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [organizations, setOrganizations] = useState<OrganizationResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOrganizations();
      const orgList = Array.isArray(res) ? res : res?.organizations || [];
      setOrganizations(orgList);
    } catch (err: any) {
      console.error("Failed to load organizations:", err);
      setError(err?.message || "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrganizations();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAuthenticated, authLoading, fetchOrganizations]);

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return organizations;
    const q = searchQuery.toLowerCase();
    return organizations.filter(
      (o) =>
        o.name?.toLowerCase().includes(q) ||
        o.slug?.toLowerCase().includes(q) ||
        o.sector?.toLowerCase().includes(q) ||
        getEnumLabel("sector", o.sector || "", t).toLowerCase().includes(q) ||
        o.city?.toLowerCase().includes(q) ||
        formatWilayaLabel(o.city || "", locale).toLowerCase().includes(q),
    );
  }, [organizations, searchQuery, t, locale]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header Container */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Link
                  href="/"
                  className="hover:text-foreground transition-colors"
                >
                  {t("nav.home")}
                </Link>
                <ChevronRight
                  className={cn("w-3.5 h-3.5", isRTL && "rotate-180")}
                />
                <span className="text-foreground">{t("nav.workspaces")}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {t("organizations.title")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
                {t("organizations.subtitle")}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <PodaciumButton
                variant="gradient"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setIsOnboardingModalOpen(true)}
              >
                {t("organizations.newOrganization")}
              </PodaciumButton>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <PodaciumCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {organizations.length}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {t("organizations.totalWorkspaces")}
                  </div>
                </div>
              </div>
            </PodaciumCard>

            <PodaciumCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {organizations.filter((o) => (o as any).rcNumber).length}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {t("organizations.registeredEntities")}
                  </div>
                </div>
              </div>
            </PodaciumCard>

            <PodaciumCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {organizations.reduce(
                      (sum, o) => sum + (o.memberCount || 1),
                      0,
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {t("organizations.totalTeamSeats")}
                  </div>
                </div>
              </div>
            </PodaciumCard>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="w-full sm:w-96">
            <PodaciumInput
              placeholder={t("organizations.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-muted-foreground" />}
            />
          </div>
          <div className="text-xs text-muted-foreground self-end sm:self-auto">
            {filteredOrgs.length} {t("organizations.countLabel")}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 rounded-xl border border-border bg-card/50 animate-pulse p-6"
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredOrgs.length === 0 && (
          <PodaciumCard className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {t("organizations.noOrgsTitle")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              {searchQuery
                ? t("organizations.noSearchMatch")
                : t("organizations.getStartedPrompt")}
            </p>
            <PodaciumButton
              variant="gradient"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsOnboardingModalOpen(true)}
            >
              {t("organizations.createWorkspaceAction")}
            </PodaciumButton>
          </PodaciumCard>
        )}

        {/* Organizations Grid */}
        {!loading && !error && filteredOrgs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrgs.map((org) => {
              const isOwner = org.isOwner || org.ownerId === user?.id;

              return (
                <PodaciumCard
                  key={org.id}
                  className="flex flex-col justify-between hover:shadow-md transition-shadow group"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-foreground line-clamp-1">
                            {org.name}
                          </h3>
                          {org.slug && (
                            <span className="text-xs font-mono text-muted-foreground">
                              @{org.slug}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {org.userRole && (
                          <PodaciumBadge
                            variant="outline"
                            className="font-mono text-[10px] uppercase"
                          >
                            {org.userRole}
                          </PodaciumBadge>
                        )}
                        {isOwner && (
                          <PodaciumBadge
                            variant="default"
                            className="text-[10px]"
                          >
                            {t("roles.owner")}
                          </PodaciumBadge>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1.5 py-2 text-xs text-muted-foreground border-y border-border/60 my-3">
                      {org.sector && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-3.5 h-3.5 shrink-0" />
                          <span>{getEnumLabel("sector", org.sector, t)}</span>
                        </div>
                      )}
                      {org.city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {org.country === "ALGERIA"
                              ? formatWilayaLabel(org.city, locale)
                              : getEnumLabel("city", org.city, t)}
                            {org.country
                              ? `, ${getEnumLabel("country", org.country, t)}`
                              : ""}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {org.memberCount || 1}{" "}
                          {t("organizations.membersCount")}
                        </span>
                      </div>
                    </div>

                    {/* Statutory Fiscal Quick Status */}
                    <div className="text-[11px] font-mono text-muted-foreground pb-2">
                      {(org as any).rcNumber ? (
                        <span
                          className="text-emerald-600 font-medium"
                          dir="ltr"
                        >
                          {t("organizations.rcPrefix")} {(org as any).rcNumber}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/80 italic">
                          {t("kyb.notSubmitted")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(org.createdAt).toLocaleDateString()}
                    </span>

                    <Link href={`/organizations/${org.id}`}>
                      <PodaciumButton
                        variant="outline"
                        size="sm"
                        icon={<ExternalLink className="w-3.5 h-3.5" />}
                        iconPosition="right"
                      >
                        {t("organizations.openWorkspace")}
                      </PodaciumButton>
                    </Link>
                  </div>
                </PodaciumCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Stage-0 Onboarding Modal */}
      <EnterpriseOrgOnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onSuccess={() => fetchOrganizations()}
      />
    </div>
  );
}
