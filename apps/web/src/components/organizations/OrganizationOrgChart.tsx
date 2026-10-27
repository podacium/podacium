"use client";

import React, { useState, useMemo } from "react";
import {
  Building2,
  Network,
  Users,
  MapPin,
  ChevronDown,
  ChevronRight,
  Crown,
  Briefcase,
  Layers,
  LayoutGrid,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { OrganizationResponse, OrganizationMemberResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";
import { RoleBadge } from "./RoleBadge";

export interface DepartmentNode {
  id: number;
  name: string;
  slug?: string;
  code?: string;
  description?: string;
}

export interface BranchNode {
  id: number;
  name: string;
  code?: string;
  wilayaCode: number;
  city: string;
  address?: string;
  isHeadquarters: boolean;
}

interface OrganizationOrgChartProps {
  organization: OrganizationResponse;
  departments: DepartmentNode[];
  branches: BranchNode[];
  members?: OrganizationMemberResponse[];
  className?: string;
}

export function OrganizationOrgChart({
  organization,
  departments,
  branches,
  members = [],
  className,
}: OrganizationOrgChartProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();

  const [viewMode, setViewMode] = useState<"tree" | "cards">("tree");
  const [collapsedDepts, setCollapsedDepts] = useState<Record<number, boolean>>(
    {},
  );

  const toggleDept = (deptId: number) => {
    setCollapsedDepts((prev) => ({
      ...prev,
      [deptId]: !prev[deptId],
    }));
  };

  // Group members by department
  const { deptMembersMap, unassignedMembers } = useMemo(() => {
    const dMap: Record<number, OrganizationMemberResponse[]> = {};
    const unassigned: OrganizationMemberResponse[] = [];

    departments.forEach((d) => {
      dMap[d.id] = [];
    });

    members.forEach((m) => {
      if (m.departmentId && dMap[m.departmentId]) {
        dMap[m.departmentId].push(m);
      } else {
        unassigned.push(m);
      }
    });

    return { deptMembersMap: dMap, unassignedMembers: unassigned };
  }, [departments, members]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">
            {t("organizations.orgChartTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("organizations.orgChartSubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border self-start sm:self-auto">
          <PodaciumButton
            variant={viewMode === "tree" ? "primary" : "ghost"}
            size="sm"
            icon={<Layers className="w-3.5 h-3.5" />}
            onClick={() => setViewMode("tree")}
            className="text-xs"
          >
            {t("organizations.treeView")}
          </PodaciumButton>
          <PodaciumButton
            variant={viewMode === "cards" ? "primary" : "ghost"}
            size="sm"
            icon={<LayoutGrid className="w-3.5 h-3.5" />}
            onClick={() => setViewMode("cards")}
            className="text-xs"
          >
            {t("organizations.cardsView")}
          </PodaciumButton>
        </div>
      </div>

      {viewMode === "tree" ? (
        /* TREE HIERARCHY VIEW */
        <div className="p-6 rounded-2xl border border-border bg-card/40 backdrop-blur-xs overflow-x-auto">
          <div className="min-w-[680px] flex flex-col items-center">
            {/* LEVEL 1: EXECUTIVE LEADERSHIP / ROOT */}
            <div className="flex flex-col items-center">
              <div className="w-72 p-4 rounded-2xl border-2 border-primary/40 bg-primary/[0.04] shadow-xs text-center relative">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 ring-4 ring-background">
                  <Crown className="w-4 h-4" />
                </div>
                <div className="font-bold text-sm text-foreground">
                  {organization.name}
                </div>
                <div className="text-xs text-primary font-medium mt-0.5">
                  {t("organizations.directionGenerale")}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  {organization.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {organization.city}, {organization.country}
                    </span>
                  )}
                  {organization.timeZone && (
                    <span className="font-mono text-[11px]" dir="ltr">
                      {organization.timeZone}
                    </span>
                  )}
                </div>
              </div>

              {/* Vertical connector down from Root */}
              <div className="w-0.5 h-8 bg-border" />
            </div>

            {/* LEVEL 2: REGIONAL BRANCHES & HEADQUARTERS */}
            {branches.length > 0 && (
              <div className="flex flex-col items-center w-full">
                <div className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider mb-2">
                  {t("organizations.branchesSection")}
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap max-w-4xl">
                  {branches.map((b) => (
                    <div
                      key={b.id}
                      className={cn(
                        "p-2.5 px-3 rounded-xl border text-xs flex items-center gap-2 shadow-2xs",
                        b.isHeadquarters
                          ? "border-primary/50 bg-primary/5 font-semibold text-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{b.name}</span>
                      <PodaciumBadge
                        variant={b.isHeadquarters ? "default" : "outline"}
                        className="text-[10px] px-1.5 py-0 font-mono"
                        dir="ltr"
                      >
                        W{b.wilayaCode.toString().padStart(2, "0")}
                      </PodaciumBadge>
                    </div>
                  ))}
                </div>
                {/* Vertical connector down to Departments */}
                <div className="w-0.5 h-8 bg-border mt-3" />
              </div>
            )}

            {/* LEVEL 3: DEPARTMENTS & UNITS HIERARCHY */}
            <div className="w-full flex flex-col items-center">
              <div className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider mb-4">
                {t("organizations.departmentsSection")}
              </div>

              {departments.length === 0 ? (
                <div className="text-center py-6 px-4 rounded-xl border border-dashed border-border text-xs text-muted-foreground w-72">
                  <Network className="w-5 h-5 mx-auto mb-1 opacity-50" />
                  <span>{t("organizations.noDepartments")}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                  {departments.map((dept) => {
                    const deptMembers = deptMembersMap[dept.id] || [];
                    const isCollapsed = collapsedDepts[dept.id] ?? false;

                    return (
                      <div
                        key={dept.id}
                        className="flex flex-col rounded-2xl border border-border bg-card shadow-2xs overflow-hidden"
                      >
                        {/* Department Card Header */}
                        <div
                          className="p-3.5 bg-muted/40 border-b border-border flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-colors"
                          onClick={() => toggleDept(dept.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                              <Network className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-sm text-foreground">
                                {dept.name}
                              </div>
                              {dept.code && (
                                <div
                                  className="text-[10px] font-mono text-muted-foreground"
                                  dir="ltr"
                                >
                                  {dept.code}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <PodaciumBadge
                              variant="outline"
                              className="text-[10px]"
                            >
                              {deptMembers.length}
                            </PodaciumBadge>
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Department Assigned Members */}
                        {!isCollapsed && (
                          <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                            {deptMembers.length === 0 ? (
                              <div className="py-3 text-center text-xs text-muted-foreground opacity-60">
                                {t("organizations.noMembersAssigned")}
                              </div>
                            ) : (
                              deptMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/50 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <PodaciumAvatar
                                      size="sm"
                                      name={
                                        member.user?.fullName ||
                                        member.user?.email ||
                                        ""
                                      }
                                      alt={member.user?.fullName || ""}
                                    />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-foreground truncate">
                                        {member.user?.fullName ||
                                          member.user?.email}
                                      </div>
                                      <div
                                        className="text-[11px] text-muted-foreground truncate font-mono"
                                        dir="ltr"
                                      >
                                        {member.user?.email}
                                      </div>
                                    </div>
                                  </div>

                                  <RoleBadge
                                    role={member.role || "member"}
                                    t={t}
                                  />
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unassigned Members Group (if any) */}
              {unassignedMembers.length > 0 && (
                <div className="mt-8 w-full max-w-5xl">
                  <div className="p-4 rounded-2xl border border-dashed border-border bg-muted/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                          {t("organizations.unassignedMembers")}
                        </span>
                      </div>
                      <PodaciumBadge variant="outline" className="text-xs">
                        {unassignedMembers.length}
                      </PodaciumBadge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {unassignedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <PodaciumAvatar
                              size="sm"
                              name={
                                member.user?.fullName ||
                                member.user?.email ||
                                ""
                              }
                              alt={member.user?.fullName || ""}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {member.user?.fullName || member.user?.email}
                              </div>
                            </div>
                          </div>
                          <RoleBadge role={member.role || "member"} t={t} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CARDS / DEPARTMENTS GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const deptMembers = deptMembersMap[dept.id] || [];
            return (
              <PodaciumCard
                key={dept.id}
                className="p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="font-bold text-sm text-foreground">
                      {dept.name}
                    </div>
                    {dept.code && (
                      <PodaciumBadge
                        variant="outline"
                        className="font-mono text-xs"
                        dir="ltr"
                      >
                        {dept.code}
                      </PodaciumBadge>
                    )}
                  </div>

                  {dept.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                      {dept.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {t("organizations.membersAssigned").replace(
                        "{count}",
                        String(deptMembers.length),
                      )}
                    </span>
                  </span>
                </div>
              </PodaciumCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OrganizationOrgChart;
