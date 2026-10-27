"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  AlertCircle,
  Shield,
  Mail,
  Calendar,
  Users,
  Search,
  Network,
  RotateCcw,
} from "lucide-react";
import {
  api,
  OrganizationResponse,
  OrganizationMemberResponse,
} from "@/lib/api";
import { apiClient } from "@/lib/api/client";
import { RoleBadge } from "./RoleBadge";
import { useLocale } from "@/lib/i18n";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface DepartmentItem {
  id: number;
  name: string;
  code?: string;
}

interface OrganizationMembersTabProps {
  organization: OrganizationResponse;
  departments?: DepartmentItem[];
  t: (key: string) => string;
}

export function OrganizationMembersTab({
  organization,
  departments: initialDepartments,
  t,
}: OrganizationMembersTabProps) {
  const locale = useLocale();
  const [members, setMembers] = useState<OrganizationMemberResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>(
    initialDepartments || [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const [membersData, deptsData] = await Promise.allSettled([
          api.getOrganizationMembers(organization.id),
          !initialDepartments
            ? apiClient.get<DepartmentItem[]>(
                `/api/organizations/${organization.id}/departments`,
              )
            : Promise.resolve(initialDepartments),
        ]);

        if (mounted) {
          if (membersData.status === "fulfilled") {
            setMembers(membersData.value || []);
          } else {
            setError(t("bi.organizations.members.error.generic"));
          }

          if (deptsData.status === "fulfilled" && deptsData.value) {
            setDepartments((deptsData.value as any) || []);
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || t("bi.organizations.members.error.generic"));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [organization.id, initialDepartments, t]);

  // Department mapping lookup
  const deptMap = useMemo(() => {
    const map = new Map<number, DepartmentItem>();
    departments.forEach((d) => map.set(d.id, d));
    return map;
  }, [departments]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      // Search query filter (matches name, email, or role)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullName = (member.user?.fullName || "").toLowerCase();
        const email = (member.user?.email || "").toLowerCase();
        const role = (member.role || "").toLowerCase();
        if (
          !fullName.includes(query) &&
          !email.includes(query) &&
          !role.includes(query)
        ) {
          return false;
        }
      }

      // Role filter
      if (roleFilter !== "ALL") {
        const memberRole = (member.role || "").toUpperCase();
        if (
          roleFilter === "OWNER" &&
          member.userId !== organization.ownerId &&
          memberRole !== "OWNER"
        ) {
          return false;
        }
        if (roleFilter !== "OWNER" && memberRole !== roleFilter) {
          return false;
        }
      }

      // Department filter
      if (departmentFilter !== "ALL") {
        const targetDeptId = parseInt(departmentFilter, 10);
        if (member.departmentId !== targetDeptId) {
          return false;
        }
      }

      return true;
    });
  }, [
    members,
    searchQuery,
    roleFilter,
    departmentFilter,
    organization.ownerId,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    roleFilter !== "ALL" ||
    departmentFilter !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setRoleFilter("ALL");
    setDepartmentFilter("ALL");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
        <p className="text-sm">{t("bi.organizations.members.loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 rounded-2xl border border-destructive/20 flex items-center gap-4 text-destructive">
        <AlertCircle className="w-6 h-6 shrink-0" />
        <div>
          <h4 className="font-bold">
            {t("bi.organizations.members.error.title")}
          </h4>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl bg-card border border-dashed border-border">
        <div className="w-16 h-16 bg-muted rounded-2xl shadow-xs flex items-center justify-center mx-auto mb-4 text-muted-foreground">
          <Users className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">
          {t("bi.organizations.members.noMembers")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("bi.organizations.members.invite.subtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <PodaciumCard className="p-4 border-border bg-card">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search input */}
          <div className="sm:col-span-6">
            <PodaciumInput
              placeholder={t("organizations.searchMembersPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-muted-foreground" />}
            />
          </div>

          {/* Role select filter */}
          <div className="sm:col-span-3">
            <PodaciumSelect
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: "ALL", label: t("organizations.allRoles") },
                { value: "OWNER", label: t("roles.owner") },
                { value: "ADMIN", label: t("roles.admin") },
                { value: "MEMBER", label: t("roles.member") },
              ]}
            />
          </div>

          {/* Department select filter */}
          <div className="sm:col-span-3">
            <PodaciumSelect
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              options={[
                { value: "ALL", label: t("organizations.allDepartments") },
                ...departments.map((d) => ({
                  value: String(d.id),
                  label: d.name,
                })),
              ]}
            />
          </div>
        </div>

        {/* Filter count & reset */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("organizations.membersCountFound").replace(
              "{count}",
              String(filteredMembers.length),
            )}
          </span>

          {hasActiveFilters && (
            <PodaciumButton
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3 h-3" />}
              onClick={handleResetFilters}
              className="text-xs h-7 px-2"
            >
              {t("organizations.clearFilters")}
            </PodaciumButton>
          )}
        </div>
      </PodaciumCard>

      {/* Filtered Members Grid */}
      {filteredMembers.length === 0 ? (
        <PodaciumCard className="py-12 px-4 text-center border-dashed border-border">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-semibold text-foreground">
            {t("organizations.noMembersFound")}
          </h4>
          <div className="mt-3">
            <PodaciumButton
              variant="outline"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleResetFilters}
            >
              {t("organizations.clearFilters")}
            </PodaciumButton>
          </div>
        </PodaciumCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const memberDept = member.departmentId
              ? deptMap.get(member.departmentId)
              : member.department;

            return (
              <PodaciumCard
                key={member.id}
                variant="default"
                padding="md"
                hover
                className="group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <PodaciumAvatar
                        alt={member.user?.fullName || member.user?.email || ""}
                        name={member.user?.fullName || member.user?.email || ""}
                        size="lg"
                      />
                      <div>
                        <div className="font-semibold text-sm text-foreground">
                          {member.user?.fullName || member.user?.email}
                        </div>
                        <div className="mt-1">
                          <RoleBadge role={member.role || "member"} t={t} />
                        </div>
                      </div>
                    </div>

                    {member.userId === organization.ownerId && (
                      <PodaciumBadge
                        variant="warning"
                        className="gap-1 text-xs"
                      >
                        <Shield className="w-3 h-3" />
                        <span>{t("bi.organizations.roles.owner")}</span>
                      </PodaciumBadge>
                    )}
                  </div>

                  {/* Assigned Department Badge */}
                  {memberDept && (
                    <div className="mb-3">
                      <PodaciumBadge
                        variant="outline"
                        className="flex items-center gap-1 text-[11px] w-fit"
                      >
                        <Network className="w-3 h-3" />
                        <span>{memberDept.name}</span>
                        {memberDept.code && (
                          <span className="opacity-70 font-mono" dir="ltr">
                            ({memberDept.code})
                          </span>
                        )}
                      </PodaciumBadge>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-3 border-t border-border">
                  <div className="flex items-center gap-2.5 text-muted-foreground overflow-hidden">
                    <div className="p-1.5 bg-muted rounded-lg shrink-0">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <span
                      className="text-xs font-mono truncate"
                      title={member.user?.email}
                      dir="ltr"
                    >
                      {member.user?.email}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <div className="p-1.5 bg-muted rounded-lg shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs">
                      {t("bi.organizations.members.joined")}:{" "}
                      {new Date(member.createdAt).toLocaleDateString(locale)}
                    </span>
                  </div>
                </div>
              </PodaciumCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default OrganizationMembersTab;
