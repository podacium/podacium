"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  LayoutDashboard,
  ShieldCheck,
  GraduationCap,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ExternalLink,
  MapPin,
  Briefcase,
  CheckCircle2,
  Trash2,
  Network,
  Globe,
  Wallet,
  FileSearch,
  Edit3,
  UserPlus,
  Plus,
  Phone,
  Pin,
  Clock,
} from "lucide-react";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { api, OrganizationResponse } from "@/lib/api";
import { apiClient } from "@/lib/api/client";
import { getEnumLabel } from "@/lib/constants/organizations";
import { formatWilayaLabel } from "@/lib/constants/algeria-wilayas";
import { cn } from "@/lib/utils";

import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumTabs from "@/components/design-system/PodaciumTabs";
import { PodaciumDangerModal } from "@/components/design-system/PodaciumDangerModal";
import { AlgerianKybCard } from "@/components/organizations/AlgerianKybCard";
import { OrganizationMembersTab } from "@/components/organizations/OrganizationMembersTab";
import { OrganizationDatasetsTab } from "@/components/organizations/OrganizationDatasetsTab";
import { OrganizationFormModal } from "@/components/organizations/OrganizationFormModal";
import { MemberManagementModal } from "@/components/organizations/MemberManagementModal";
import { CreateDepartmentModal } from "@/components/organizations/CreateDepartmentModal";
import { AddBranchModal } from "@/components/organizations/AddBranchModal";
import { AllocateSeatPoolModal } from "@/components/organizations/AllocateSeatPoolModal";
import { InternalBulletinCard } from "@/components/organizations/InternalBulletinCard";
import { KeyCorporateContactsCard } from "@/components/organizations/KeyCorporateContactsCard";
import { OrganizationOrgChart } from "@/components/organizations/OrganizationOrgChart";
import { OrganizationTreasuryTab } from "@/components/organizations/OrganizationTreasuryTab";
import { OrganizationAuditTab } from "@/components/organizations/OrganizationAuditTab";
import { OrganizationBrandingTab } from "@/components/organizations/OrganizationBrandingTab";
import PendingInvitations from "@/components/bi/PendingInvitations";

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const { isRTL } = useBidi();
  const { user, isAuthenticated, refreshUser } = useAuth();

  const orgId = useMemo(() => {
    return params?.id ? parseInt(String(params.id), 10) : null;
  }, [params?.id]);

  const [org, setOrg] = useState<OrganizationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isCreateDeptModalOpen, setIsCreateDeptModalOpen] = useState(false);
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [isAllocateSeatModalOpen, setIsAllocateSeatModalOpen] = useState(false);
  const [selectedPoolForAllocation, setSelectedPoolForAllocation] = useState<
    number | null
  >(null);

  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [licensePools, setLicensePools] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const loadOrgDetails = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOrganization(orgId);
      setOrg(data);

      try {
        const [deptsRes, branchesRes, poolsRes, membersRes] =
          await Promise.allSettled([
            apiClient.get(`/api/organizations/${orgId}/departments`),
            apiClient.get(`/api/organizations/${orgId}/branches`),
            apiClient.get(`/api/organizations/${orgId}/edtech/pools`),
            api.getOrganizationMembers(orgId),
          ]);
        if (deptsRes.status === "fulfilled")
          setDepartments((deptsRes.value as any) || []);
        if (branchesRes.status === "fulfilled")
          setBranches((branchesRes.value as any) || []);
        if (poolsRes.status === "fulfilled")
          setLicensePools((poolsRes.value as any) || []);
        if (membersRes.status === "fulfilled")
          setMembers((membersRes.value as any) || []);
      } catch {
        // secondary endpoints optional
      }
    } catch (err: any) {
      console.error("Failed to load organization:", err);
      setError(err?.message || t("organizations.notFound"));
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  useEffect(() => {
    if (isAuthenticated) {
      loadOrgDetails();
    }
  }, [isAuthenticated, loadOrgDetails]);

  const handleSwitchWorkspace = async () => {
    if (!org) return;
    try {
      setIsSwitching(true);
      await api.switchOrganization(org.id);
      await refreshUser();
    } catch (err) {
      console.error("Failed to switch organization:", err);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!org) return;
    try {
      setIsDeleting(true);
      await api.deleteOrganization(org.id);
      await refreshUser();
      router.push("/organizations");
    } catch (err: any) {
      console.error("Failed to delete organization:", err);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pt-24">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 pt-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {t("common.error")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {error || t("organizations.notFound")}
        </p>
        <Link href="/organizations">
          <PodaciumButton
            variant="outline"
            icon={
              <ArrowLeft className={cn("w-4 h-4", isRTL && "rotate-180")} />
            }
          >
            {t("organizations.backToList")}
          </PodaciumButton>
        </Link>
      </div>
    );
  }

  const isCurrentWorkspace = user?.primaryOrganizationId === org.id;
  const isOwner = org.isOwner || org.ownerId === user?.id;
  const isAdminOrOwner =
    isOwner || ["OWNER", "ADMIN"].includes(org.userRole || "");

  const tabsConfig = [
    {
      id: "overview",
      label: t("organizations.tabs.overview"),
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "branding",
      label: t("organizations.tabs.branding"),
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: "kyb",
      label: t("organizations.tabs.kyb"),
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: "members",
      label: t("organizations.tabs.members"),
      icon: <Users className="w-4 h-4" />,
      count: org.memberCount || 1,
    },
    {
      id: "departments",
      label: t("organizations.tabs.departments"),
      icon: <Network className="w-4 h-4" />,
      count: departments.length,
    },
    {
      id: "bulletin",
      label: t("organizations.tabs.bulletin"),
      icon: <Pin className="w-4 h-4" />,
    },
    {
      id: "treasury",
      label: t("organizations.tabs.treasury"),
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      id: "audit",
      label: t("organizations.tabs.audit"),
      icon: <FileSearch className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Workspace Header */}
      <div className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-6">
          <Link
            href="/organizations"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className={cn("w-3.5 h-3.5", isRTL && "rotate-180")} />
            <span>{t("organizations.backToList")}</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl shadow-xs">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">
                    {org.name}
                  </h1>
                  {org.userRole && (
                    <PodaciumBadge
                      variant="outline"
                      className="font-mono text-xs uppercase"
                    >
                      {org.userRole}
                    </PodaciumBadge>
                  )}
                  {isCurrentWorkspace ? (
                    <PodaciumBadge
                      variant="success"
                      className="flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t("organizations.activeWorkspace")}</span>
                    </PodaciumBadge>
                  ) : null}
                </div>

                <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  {org.slug && (
                    <span className="font-mono" dir="ltr">
                      @{org.slug}
                    </span>
                  )}
                  {org.sector && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5" />
                      {getEnumLabel("sector", org.sector, t)}
                    </span>
                  )}
                  {org.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {org.country === "ALGERIA"
                        ? formatWilayaLabel(org.city, locale)
                        : getEnumLabel("city", org.city, t)}
                      {org.country
                        ? `, ${getEnumLabel("country", org.country, t)}`
                        : ""}
                    </span>
                  )}
                  {org.hqAddress && (
                    <span className="flex items-center gap-1 text-foreground/80">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span
                        className="truncate max-w-[200px]"
                        title={org.hqAddress}
                      >
                        {org.hqAddress}
                      </span>
                    </span>
                  )}
                  <span
                    className="flex items-center gap-1 font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded-md text-muted-foreground"
                    dir="ltr"
                    title={t("organizations.timezoneLabel")}
                  >
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>{org.timeZone || "Africa/Algiers"} (UTC+1)</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
              {isAdminOrOwner && (
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                  onClick={() => setIsEditModalOpen(true)}
                >
                  {t("organizations.editProfileAction")}
                </PodaciumButton>
              )}
              {!isCurrentWorkspace && (
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  loading={isSwitching}
                  onClick={handleSwitchWorkspace}
                >
                  {t("organizations.switchToWorkspace")}
                </PodaciumButton>
              )}
              <Link href={`/bi/dashboards?org=${org.id}`}>
                <PodaciumButton
                  variant="primary"
                  size="sm"
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                  iconPosition="right"
                >
                  {t("organizations.openBi")}
                </PodaciumButton>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Tab Enterprise Navigation Spined Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <PodaciumTabs
          tabs={tabsConfig}
          defaultTab="overview"
          onChange={(id) => setActiveTab(id)}
          variant="underline"
        >
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PodaciumCard className="p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {t("organizations.members")}
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {org.memberCount || 1}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("organizations.membersDesc")}
                  </p>
                </PodaciumCard>

                <PodaciumCard className="p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {t("organizations.departments")}
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {departments.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("organizations.departmentsDesc")}
                  </p>
                </PodaciumCard>

                <PodaciumCard className="p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {t("organizations.edtechPools")}
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {licensePools.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("organizations.edtechPoolsDesc")}
                  </p>
                </PodaciumCard>
              </div>

              <InternalBulletinCard
                organization={org}
                canEdit={isAdminOrOwner}
                onUpdated={loadOrgDetails}
              />

              <KeyCorporateContactsCard
                organization={org}
                canEdit={isAdminOrOwner}
                onUpdated={loadOrgDetails}
              />

              <AlgerianKybCard
                rcNumber={(org as any).rcNumber}
                nifNumber={(org as any).nifNumber}
                nisNumber={(org as any).nisNumber}
                articleImposition={(org as any).articleImposition}
                status={(org as any).rcNumber ? "APPROVED" : "NOT_SUBMITTED"}
                onOpenKybModal={() => setActiveTab("kyb")}
              />

              <OrganizationDatasetsTab organization={org} t={t} />
            </div>
          )}

          {/* TAB 2: BRANDING & PUBLIC PRESENCE */}
          {activeTab === "branding" && (
            <div className="space-y-6 pt-6">
              <OrganizationBrandingTab
                organization={org}
                isAdminOrOwner={isAdminOrOwner}
                onUpdated={loadOrgDetails}
              />
            </div>
          )}

          {/* TAB 3: LEGAL & KYB */}
          {activeTab === "kyb" && (
            <div className="space-y-6 pt-6">
              <AlgerianKybCard
                rcNumber={(org as any).rcNumber}
                nifNumber={(org as any).nifNumber}
                nisNumber={(org as any).nisNumber}
                articleImposition={(org as any).articleImposition}
                legalStructure={(org as any).taxRegime || "SARL"}
                status={(org as any).rcNumber ? "APPROVED" : "NOT_SUBMITTED"}
                onOpenKybModal={() => setIsEditModalOpen(true)}
              />

              <PodaciumCard className="p-6">
                <h3 className="text-base font-bold text-foreground mb-1">
                  {t("kyb.sovereignVaultTitle")}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {t("kyb.sovereignVaultDesc")}
                </p>
                <h4 className="text-sm font-bold text-foreground mb-1">
                  {t("kyb.fiscalShieldTitle")}
                </h4>
                <p className="text-xs text-muted-foreground mb-4">
                  {t("kyb.fiscalShieldDesc")}
                </p>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
                  {t("kyb.taxShieldEligible")}
                </div>
              </PodaciumCard>
            </div>
          )}

          {/* TAB 4: TEAM & ROLES */}
          {activeTab === "members" && (
            <div className="space-y-6 pt-6">
              {isAdminOrOwner && (
                <div className="flex justify-end">
                  <PodaciumButton
                    variant="primary"
                    size="sm"
                    icon={<UserPlus className="w-4 h-4" />}
                    onClick={() => setIsMemberModalOpen(true)}
                  >
                    {t("organizations.manageTeamAction")}
                  </PodaciumButton>
                </div>
              )}
              <OrganizationMembersTab
                organization={org}
                departments={departments}
                t={t}
              />
              <PendingInvitations
                organizationId={org.id}
                canManage={isAdminOrOwner}
              />
            </div>
          )}

          {/* TAB 5: DEPARTMENTS & COST CENTERS */}
          {activeTab === "departments" && (
            <div className="space-y-8 pt-6">
              {/* Visual Org Chart & Hierarchy */}
              <OrganizationOrgChart
                organization={org}
                departments={departments}
                branches={branches}
                members={members}
              />

              {/* Section A: Departments & Cost Centers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {t("organizations.costCentersTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("organizations.costCentersDesc")}
                    </p>
                  </div>
                  {isAdminOrOwner && (
                    <PodaciumButton
                      size="sm"
                      variant="primary"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => setIsCreateDeptModalOpen(true)}
                    >
                      {t("organizations.createDepartment")}
                    </PodaciumButton>
                  )}
                </div>

                {departments.length === 0 ? (
                  <PodaciumCard className="py-10 text-center">
                    <Network className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("organizations.noDepartments")}
                    </p>
                    {isAdminOrOwner && (
                      <PodaciumButton
                        size="sm"
                        variant="outline"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => setIsCreateDeptModalOpen(true)}
                      >
                        {t("organizations.createDepartment")}
                      </PodaciumButton>
                    )}
                  </PodaciumCard>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {departments.map((dept) => (
                      <PodaciumCard
                        key={dept.id}
                        className="p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {dept.name}
                            </span>
                            {dept.code && (
                              <PodaciumBadge
                                variant="outline"
                                className="font-mono text-xs"
                              >
                                {dept.code}
                              </PodaciumBadge>
                            )}
                          </div>
                          {dept.slug && (
                            <div
                              className="text-xs font-mono text-muted-foreground mt-1"
                              dir="ltr"
                            >
                              @{dept.slug}
                            </div>
                          )}
                          {dept.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {dept.description}
                            </p>
                          )}
                        </div>
                      </PodaciumCard>
                    ))}
                  </div>
                )}
              </div>

              {/* Section B: Regional Wilaya Branches */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {t("organizations.branchesTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("organizations.addBranchDesc")}
                    </p>
                  </div>
                  {isAdminOrOwner && (
                    <PodaciumButton
                      size="sm"
                      variant="outline"
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      onClick={() => setIsAddBranchModalOpen(true)}
                    >
                      {t("organizations.addBranch")}
                    </PodaciumButton>
                  )}
                </div>

                {branches.length === 0 ? (
                  <PodaciumCard className="py-10 text-center">
                    <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("organizations.noBranches")}
                    </p>
                    {isAdminOrOwner && (
                      <PodaciumButton
                        size="sm"
                        variant="outline"
                        icon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => setIsAddBranchModalOpen(true)}
                      >
                        {t("organizations.addBranch")}
                      </PodaciumButton>
                    )}
                  </PodaciumCard>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branches.map((branch) => (
                      <PodaciumCard
                        key={branch.id}
                        className="p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {branch.name}
                            </span>
                            {branch.isHeadquarters && (
                              <PodaciumBadge
                                variant="success"
                                className="text-xs"
                              >
                                HQ
                              </PodaciumBadge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono">
                              {t("organizations.branchWilaya")}:{" "}
                              {String(branch.wilayaCode).padStart(2, "0")}
                            </span>
                            <span>·</span>
                            <span>{getEnumLabel("city", branch.city, t)}</span>
                          </div>
                          {branch.code && (
                            <div
                              className="text-xs font-mono text-muted-foreground mt-1"
                              dir="ltr"
                            >
                              {branch.code}
                            </div>
                          )}
                          {branch.address && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-2">
                              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">
                                {branch.address}
                              </span>
                            </div>
                          )}
                          {branch.phoneNumber && (
                            <div
                              className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1"
                              dir="ltr"
                            >
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span>{branch.phoneNumber}</span>
                            </div>
                          )}
                        </div>
                      </PodaciumCard>
                    ))}
                  </div>
                )}
              </div>

              {/* Section C: Training Seat Pools */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-0.5">
                      {t("organizations.edtechPoolsTitle")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("organizations.edtechPoolsSubtitle")}
                    </p>
                  </div>
                  {isAdminOrOwner && licensePools.length > 0 && (
                    <PodaciumButton
                      size="sm"
                      variant="primary"
                      icon={<UserPlus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setSelectedPoolForAllocation(null);
                        setIsAllocateSeatModalOpen(true);
                      }}
                    >
                      {t("organizations.allocateSeat")}
                    </PodaciumButton>
                  )}
                </div>

                {licensePools.length === 0 ? (
                  <PodaciumCard className="py-8 text-center">
                    <GraduationCap className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      {t("organizations.noPools")}
                    </p>
                  </PodaciumCard>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {licensePools.map((pool) => {
                      const remaining = Math.max(
                        0,
                        pool.totalSeats - (pool.allocatedSeats || 0),
                      );
                      return (
                        <PodaciumCard
                          key={pool.id}
                          className="p-4 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {pool.moduleId ||
                                  pool.pathId ||
                                  t("organizations.poolNumber").replace(
                                    "{id}",
                                    String(pool.id),
                                  )}
                              </span>
                              <PodaciumBadge
                                variant={
                                  remaining > 0 ? "outline" : "destructive"
                                }
                                className="text-xs"
                              >
                                {remaining > 0
                                  ? t("organizations.availableSeats")
                                      .replace("{available}", String(remaining))
                                      .replace(
                                        "{total}",
                                        String(pool.totalSeats),
                                      )
                                  : t("organizations.allPoolsExhausted")}
                              </PodaciumBadge>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>
                                {t("organizations.totalSeatsLabel").replace(
                                  "{count}",
                                  String(pool.totalSeats),
                                )}
                              </span>
                              <span className="font-semibold text-foreground">
                                {t("organizations.allocatedSeatsLabel").replace(
                                  "{count}",
                                  String(pool.allocatedSeats || 0),
                                )}
                              </span>
                            </div>
                          </div>
                          {isAdminOrOwner && (
                            <div className="pt-3 mt-3 border-t border-border flex justify-end">
                              <PodaciumButton
                                size="sm"
                                variant="outline"
                                disabled={remaining <= 0}
                                icon={<UserPlus className="w-3 h-3" />}
                                onClick={() => {
                                  setSelectedPoolForAllocation(pool.id);
                                  setIsAllocateSeatModalOpen(true);
                                }}
                              >
                                {t("organizations.allocateSeat")}
                              </PodaciumButton>
                            </div>
                          )}
                        </PodaciumCard>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: INTERNAL BULLETIN */}
          {activeTab === "bulletin" && (
            <div className="space-y-6 pt-6">
              <InternalBulletinCard
                organization={org}
                canEdit={isAdminOrOwner}
                onUpdated={loadOrgDetails}
              />
            </div>
          )}

          {/* TAB 6: TREASURY & BILLING */}
          {activeTab === "treasury" && (
            <div className="space-y-6 pt-6">
              <OrganizationTreasuryTab
                organization={org}
                isAdminOrOwner={isAdminOrOwner}
              />
            </div>
          )}

          {/* TAB 7: AUDIT & COMPLIANCE + SETTINGS */}
          {activeTab === "audit" && (
            <div className="space-y-6 pt-6">
              <OrganizationAuditTab
                organization={org}
                isAdminOrOwner={isAdminOrOwner}
              />

              <PodaciumCard className="p-6">
                <h3 className="text-base font-bold text-foreground mb-2">
                  {t("organizations.generalSettings")}
                </h3>
                <div className="space-y-3 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">
                      {t("organizations.workspaceIdLabel")}:
                    </span>{" "}
                    <span className="font-mono" dir="ltr">
                      {org.id}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">
                      {t("organizations.createdDateLabel")}:
                    </span>{" "}
                    {new Date(org.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </PodaciumCard>

              {isAdminOrOwner && (
                <PodaciumCard className="p-6 border-destructive/30 bg-destructive/5">
                  <h3 className="text-base font-bold text-destructive mb-1">
                    {t("organizations.dangerZone")}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t("organizations.dangerZoneDesc")}
                  </p>
                  <PodaciumButton
                    variant="destructive"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    {t("organizations.deleteWorkspace")}
                  </PodaciumButton>
                </PodaciumCard>
              )}
            </div>
          )}
        </PodaciumTabs>
      </div>

      {/* Edit Organization Modal */}
      <OrganizationFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={loadOrgDetails}
        organization={org}
        t={t}
      />

      {/* Member Management Modal */}
      <MemberManagementModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        organization={org}
        t={t}
      />

      {/* Create Department Modal */}
      <CreateDepartmentModal
        isOpen={isCreateDeptModalOpen}
        onClose={() => setIsCreateDeptModalOpen(false)}
        orgId={org.id}
        onSuccess={loadOrgDetails}
      />

      {/* Add Branch Modal */}
      <AddBranchModal
        isOpen={isAddBranchModalOpen}
        onClose={() => setIsAddBranchModalOpen(false)}
        orgId={org.id}
        onSuccess={loadOrgDetails}
      />

      {/* Allocate Seat Pool Modal */}
      <AllocateSeatPoolModal
        isOpen={isAllocateSeatModalOpen}
        onClose={() => {
          setIsAllocateSeatModalOpen(false);
          setSelectedPoolForAllocation(null);
        }}
        orgId={org.id}
        pools={licensePools}
        departments={departments}
        preselectedPoolId={selectedPoolForAllocation}
        onSuccess={loadOrgDetails}
      />

      {/* Danger Modal */}
      {isDeleteDialogOpen && (
        <PodaciumDangerModal
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDeleteOrganization}
          title={t("organizations.deleteConfirmTitle")}
          description={t("organizations.deleteConfirmDesc").replace(
            "{name}",
            org.name,
          )}
          confirmTextExpected={org.name}
          isPending={isDeleting}
        />
      )}
    </div>
  );
}
