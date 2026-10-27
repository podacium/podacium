"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/lib/i18n";
import { api, OrganizationResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

interface WorkspaceSwitcherProps {
  onOpenCreateModal?: () => void;
  className?: string;
}

export function WorkspaceSwitcher({
  onOpenCreateModal,
  className,
}: WorkspaceSwitcherProps) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [organizations, setOrganizations] = useState<OrganizationResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;

    async function fetchUserOrgs() {
      try {
        setLoading(true);
        const res = await api.getOrganizations();
        if (isMounted) {
          const orgList = Array.isArray(res) ? res : res?.organizations || [];
          setOrganizations(orgList);
        }
      } catch (err) {
        console.error(
          "Failed to load organizations for workspace switcher",
          err,
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchUserOrgs();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.primaryOrganizationId]);

  const activeOrg = useMemo(() => {
    if (!organizations.length && user?.primaryOrganization) {
      return user.primaryOrganization as OrganizationResponse;
    }
    if (user?.primaryOrganizationId) {
      return (
        organizations.find((o) => o.id === user.primaryOrganizationId) ||
        organizations[0] ||
        null
      );
    }
    return organizations[0] || null;
  }, [organizations, user?.primaryOrganizationId, user?.primaryOrganization]);

  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return organizations;
    const q = searchQuery.toLowerCase();
    return organizations.filter(
      (o) =>
        o.name?.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q),
    );
  }, [organizations, searchQuery]);

  const handleSelectOrg = async (orgId: number) => {
    if (orgId === activeOrg?.id) {
      setIsOpen(false);
      return;
    }
    try {
      setSwitchingId(orgId);
      await api.switchOrganization(orgId);
      await refreshUser();
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to switch workspace", err);
    } finally {
      setSwitchingId(null);
    }
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className={cn("relative inline-block text-start shrink-0", className)}
      data-testid="workspace-switcher"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          "flex items-center gap-1.5 2xl:gap-2 px-2.5 2xl:px-3 py-1.5 h-10 rounded-xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-xs font-medium text-foreground shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap",
          isOpen &&
            "ring-2 ring-indigo-500 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900",
        )}
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <span className="truncate max-w-[110px] 2xl:max-w-[150px] font-semibold text-slate-800 dark:text-slate-100">
          {activeOrg ? activeOrg.name : t("nav.selectWorkspace")}
        </span>
        {activeOrg?.userRole && (
          <PodaciumBadge
            variant="outline"
            className="hidden 2xl:inline-flex uppercase text-[10px] px-1.5 py-0 h-4 font-mono font-medium shrink-0"
          >
            {activeOrg.userRole}
          </PodaciumBadge>
        )}
        <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground ms-0.5 shrink-0" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 mt-2 w-72 end-0 rounded-2xl border border-gray-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl p-2 text-slate-900 dark:text-slate-100 shadow-2xl animate-in fade-in-0 zoom-in-95"
        >
          <div className="px-2.5 py-2 border-b border-gray-100 dark:border-slate-800 mb-1.5">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t("nav.workspaces")}
            </div>
            {organizations.length > 3 && (
              <div className="relative flex items-center mt-1.5">
                <Search className="w-3.5 h-3.5 absolute start-2.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("common.search.placeholder")}
                  className="w-full ps-8 pe-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 text-foreground"
                />
              </div>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {loading && organizations.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="py-3 px-2 text-center text-xs text-muted-foreground">
                {t("organizations.noOrganizationsFound")}
              </div>
            ) : (
              filteredOrgs.map((org) => {
                const isActive = activeOrg?.id === org.id;
                const isPending = switchingId === org.id;

                return (
                  <button
                    key={org.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    disabled={isPending}
                    onClick={() => handleSelectOrg(org.id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs text-start transition-colors hover:bg-indigo-50/80 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200",
                      isActive &&
                        "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold",
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100/80 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="truncate font-semibold">{org.name}</div>
                        {org.sector && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {org.sector}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {org.userRole && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                          {org.userRole}
                        </span>
                      )}
                      {isActive && (
                        <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-800 mt-1.5 pt-1.5 space-y-0.5">
            {onOpenCreateModal ? (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateModal();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("organizations.createOrganization")}</span>
              </button>
            ) : (
              <Link
                href="/organizations"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("organizations.manageOrganizations")}</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceSwitcher;
