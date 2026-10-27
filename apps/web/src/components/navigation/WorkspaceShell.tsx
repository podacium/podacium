"use client";

import React, { useState, useEffect } from "react";
import { WorkspaceSidebar, type SidebarState } from "./WorkspaceSidebar";
import { MobileNavDrawer } from "./MobileNavDrawer";
import type { NavSection } from "@/lib/navigation/chrome";
import {
  WORKSPACE_SECTIONS,
  ADMIN_SECTIONS,
  STUDIO_SECTIONS,
  ACCOUNT_SECTIONS,
  getWorkspaceSectionsForRole,
} from "@/lib/navigation/sections";
import { useOptionalAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  GraduationCap,
  Briefcase,
  Building2,
  Shield,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkspaceShellProps {
  sidebarState?: SidebarState;
  sections?: readonly NavSection[];
  preset?: "workspace" | "admin" | "studio" | "account";
  labelKey?: string;
  title?: string;
  subtitle?: string;
  titleKey?: string;
  subtitleKey?: string;
  headerIcon?: React.ElementType;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  canSee?: (permissions?: readonly string[]) => boolean;
  hideSidebar?: boolean;
  children: React.ReactNode;
}

export function WorkspaceShell({
  sidebarState = "expanded",
  sections,
  preset = "workspace",
  labelKey = "nav.workspace",
  title,
  subtitle,
  titleKey,
  subtitleKey,
  headerIcon,
  header,
  footer,
  canSee,
  hideSidebar = false,
  children,
}: WorkspaceShellProps) {
  const auth = useOptionalAuth();
  const role = auth?.user?.role?.toUpperCase();

  const resolvedSections =
    sections ??
    (preset === "admin"
      ? ADMIN_SECTIONS
      : preset === "studio"
        ? STUDIO_SECTIONS
        : preset === "account"
          ? ACCOUNT_SECTIONS
          : getWorkspaceSectionsForRole(role));

  const resolvedTitleKey =
    titleKey ??
    (preset === "admin"
      ? "nav.workspaceTitles.admin"
      : preset === "studio"
        ? "nav.workspaceTitles.instructor"
        : preset === "account"
          ? "nav.workspaceTitles.account"
          : role === "INSTRUCTOR"
            ? "nav.workspaceTitles.instructor"
            : role === "FREELANCER"
              ? "nav.workspaceTitles.freelancer"
              : role === "BUSINESS"
                ? "nav.workspaceTitles.business"
                : role === "ADMIN" || role === "MODERATOR"
                  ? "nav.workspaceTitles.admin"
                  : "nav.workspaceTitles.student");

  const resolvedSubtitleKey =
    subtitleKey ??
    (preset === "admin"
      ? "nav.workspaceTitles.adminDesc"
      : preset === "studio"
        ? "nav.workspaceTitles.instructorDesc"
        : preset === "account"
          ? "nav.workspaceTitles.accountDesc"
          : role === "INSTRUCTOR"
            ? "nav.workspaceTitles.instructorDesc"
            : role === "FREELANCER"
              ? "nav.workspaceTitles.freelancerDesc"
              : role === "BUSINESS"
                ? "nav.workspaceTitles.businessDesc"
                : role === "ADMIN" || role === "MODERATOR"
                  ? "nav.workspaceTitles.adminDesc"
                  : "nav.workspaceTitles.studentDesc");

  const resolvedHeaderIcon =
    headerIcon ??
    (preset === "admin"
      ? Shield
      : preset === "studio"
        ? GraduationCap
        : preset === "account"
          ? Settings
          : role === "INSTRUCTOR"
            ? GraduationCap
            : role === "FREELANCER"
              ? Briefcase
              : role === "BUSINESS"
                ? Building2
                : role === "ADMIN" || role === "MODERATOR"
                  ? Shield
                  : BookOpen);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const handleOpenDrawer = () => setIsDrawerOpen(true);
    const handleToggleDrawer = () => setIsDrawerOpen((prev) => !prev);

    window.addEventListener("open-workspace-drawer", handleOpenDrawer);
    window.addEventListener("toggle-workspace-drawer", handleToggleDrawer);

    return () => {
      window.removeEventListener("open-workspace-drawer", handleOpenDrawer);
      window.removeEventListener("toggle-workspace-drawer", handleToggleDrawer);
    };
  }, []);

  return (
    <div
      data-sidebar={sidebarState}
      data-testid="workspace-shell"
      className={cn(
        "flex min-h-screen bg-background text-foreground transition-colors duration-200 pt-[calc(var(--chrome-offset)+1.25rem)] pb-(--floating-bottom)",
        hideSidebar ? "px-3 sm:px-5 lg:px-6" : "px-4 sm:px-6 lg:px-8",
      )}
    >
      {/* Desktop Persistent Floating Rail (>= 1024px) */}
      {!hideSidebar && (
        <WorkspaceSidebar
          id="workspace-sidebar"
          labelKey={labelKey}
          title={title}
          subtitle={subtitle}
          titleKey={resolvedTitleKey}
          subtitleKey={resolvedSubtitleKey}
          headerIcon={resolvedHeaderIcon}
          sections={resolvedSections}
          initialState={sidebarState}
          header={header}
          footer={footer}
          canSee={canSee}
          role={role}
          variant="rail"
          className="me-6 shrink-0"
        />
      )}

      {/* Mobile / Tablet / Overlay Drawer */}
      <MobileNavDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        labelledBy="workspace-sidebar"
        allowDesktop={hideSidebar}
      >
        <WorkspaceSidebar
          id="workspace-sidebar-drawer"
          labelKey={labelKey}
          title={title}
          subtitle={subtitle}
          titleKey={resolvedTitleKey}
          subtitleKey={resolvedSubtitleKey}
          headerIcon={resolvedHeaderIcon}
          sections={resolvedSections}
          initialState="expanded"
          header={header}
          footer={footer}
          canSee={canSee}
          role={role}
          variant="drawer"
          onNavigate={() => setIsDrawerOpen(false)}
        />
      </MobileNavDrawer>

      {/* Workspace Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 focus:outline-none"
      >
        {children}
      </main>
    </div>
  );
}

export default WorkspaceShell;
