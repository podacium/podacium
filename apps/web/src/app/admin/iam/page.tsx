"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  PodaciumButton,
  PodaciumCard,
  PodaciumBadge,
  PodaciumInput,
  PodaciumSelect,
  PodaciumModal,
  PodaciumConfirmDialog,
} from "@/components/design-system";
import {
  Shield,
  UserCheck,
  UserX,
  UserPlus,
  KeyRound,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
  Mail,
  Copy,
  Check,
  Lock,
  Sparkles,
  Send,
} from "lucide-react";
import { toast } from "sonner";

interface SubAdmin {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  department: string;
  title: string;
  clearanceLevel: number;
  isActive: boolean;
  roles: string[];
  lastAdminLoginAt?: string | null;
  createdAt: string;
}

interface RoleSummary {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  hierarchyRank: number;
  permissions: string[];
}

interface RoleAssignmentDetail {
  roleSlug: string;
  roleName: string;
  hierarchyRank: number;
  assignedAt: string;
  expiresAt?: string | null;
}

interface SubAdminDetail {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  department: string;
  title: string;
  clearanceLevel: number;
  isActive: boolean;
  mfaEnforced: boolean;
  lastAdminLoginAt?: string | null;
  createdAt: string;
  roleAssignments: RoleAssignmentDetail[];
  effectivePermissions: string[];
}

interface ProvisionResponse {
  success: boolean;
  userId: number;
  adminProfileId: number;
  email: string;
  fullName: string;
  department: string;
  roleSlug: string;
  clearanceLevel: number;
  deliveryMethod: string;
  tempPassword?: string | null;
  inviteUrl?: string | null;
  message: string;
}

interface UserLookupInfo {
  id: number;
  fullName: string;
  email: string;
  username?: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  hasAdminProfile: boolean;
  department?: string | null;
  title?: string | null;
  clearanceLevel?: number | null;
  roles: string[];
}

const departmentBadges: Record<
  string,
  {
    departmentId: string;
    variant:
      | "default"
      | "secondary"
      | "outline"
      | "success"
      | "warning"
      | "destructive";
  }
> = {
  SUPER_ADMIN: { departmentId: "SUPER_ADMIN", variant: "destructive" },
  EXECUTIVE: { departmentId: "EXECUTIVE", variant: "destructive" },
  SECURITY_AND_OPERATIONS: {
    departmentId: "SECURITY_AND_OPERATIONS",
    variant: "destructive",
  },
  LEGAL_COMPLIANCE: { departmentId: "LEGAL_COMPLIANCE", variant: "warning" },
  COMPLIANCE_AND_KYC: {
    departmentId: "COMPLIANCE_AND_KYC",
    variant: "warning",
  },
  FINANCE_BILLING: { departmentId: "FINANCE_BILLING", variant: "success" },
  FINANCE_AND_PAYMENTS: {
    departmentId: "FINANCE_AND_PAYMENTS",
    variant: "success",
  },
  TRUST_SAFETY: { departmentId: "TRUST_SAFETY", variant: "default" },
  CONTENT_MODERATION: {
    departmentId: "CONTENT_MODERATION",
    variant: "default",
  },
  REGIONAL_WILAYA_OPS: {
    departmentId: "REGIONAL_WILAYA_OPS",
    variant: "secondary",
  },
  ACADEMICS: { departmentId: "ACADEMICS", variant: "secondary" },
  CUSTOMER_SUPPORT: { departmentId: "CUSTOMER_SUPPORT", variant: "outline" },
};

const departmentOptions = [
  "CUSTOMER_SUPPORT",
  "TRUST_SAFETY",
  "CONTENT_MODERATION",
  "ACADEMICS",
  "REGIONAL_WILAYA_OPS",
  "FINANCE_AND_PAYMENTS",
  "FINANCE_BILLING",
  "COMPLIANCE_AND_KYC",
  "LEGAL_COMPLIANCE",
  "SECURITY_AND_OPERATIONS",
  "EXECUTIVE",
  "SUPER_ADMIN",
];

export default function AdminIamPage() {
  const t = useTranslations("admin");
  const { dir } = useBidi();
  const { hasPermission } = useAdminAuth();

  const [subadmins, setSubadmins] = useState<SubAdmin[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Assign Role Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleSlug, setAssignRoleSlug] = useState("");
  const [assignDepartment, setAssignDepartment] = useState("CUSTOMER_SUPPORT");
  const [assignTitle, setAssignTitle] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);
  const [lookupUser, setLookupUser] = useState<UserLookupInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedSubAdmin, setSelectedSubAdmin] =
    useState<SubAdminDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Provision Sub-Admin Modal state
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [provisionFullName, setProvisionFullName] = useState("");
  const [provisionEmail, setProvisionEmail] = useState("");
  const [provisionPhoneNumber, setProvisionPhoneNumber] = useState("");
  const [provisionDepartment, setProvisionDepartment] =
    useState("CUSTOMER_SUPPORT");
  const [provisionRoleSlug, setProvisionRoleSlug] = useState("");
  const [provisionTitle, setProvisionTitle] = useState("");
  const [provisionClearanceLevel, setProvisionClearanceLevel] =
    useState<number>(4);
  const [provisionMfaEnforced, setProvisionMfaEnforced] =
    useState<boolean>(true);
  const [provisionDeliveryMethod, setProvisionDeliveryMethod] = useState<
    "INVITE_LINK" | "TEMPORARY_CREDENTIAL"
  >("INVITE_LINK");
  const [submittingProvision, setSubmittingProvision] = useState(false);

  // One-Time Credential Modal state
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [credentialData, setCredentialData] = useState<{
    tempPassword?: string | null;
    inviteUrl?: string | null;
    email?: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edit Profile Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editDepartment, setEditDepartment] = useState("CUSTOMER_SUPPORT");
  const [editTitle, setEditTitle] = useState("");
  const [editClearanceLevel, setEditClearanceLevel] = useState<number>(4);
  const [editMfaEnforced, setEditMfaEnforced] = useState<boolean>(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // PodaciumConfirmDialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    variant?: "danger" | "warning" | "info";
    hazardBanner?: string;
    typeToConfirm?: string;
    isLoading?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
  });

  const fetchSubAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (departmentFilter) params.set("department", departmentFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await api.get<{ subadmins: SubAdmin[]; total: number }>(
        `/admin/iam/subadmins?${params.toString()}`,
      );
      setSubadmins(res.subadmins || []);
      setTotal(res.total || 0);
    } catch (e: unknown) {
      console.error("Failed to load sub-admins:", e);
      toast.error(
        (e as { message?: string })?.message || t("admin.iam.assignError"),
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, departmentFilter, searchQuery, t]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.get<RoleSummary[]>("/admin/iam/roles");
      setRoles(res || []);
      if (res && res.length > 0 && !provisionRoleSlug) {
        setProvisionRoleSlug(res[0].slug);
      }
    } catch (e) {
      console.error("Failed to load roles:", e);
    }
  }, [provisionRoleSlug]);

  useEffect(() => {
    fetchSubAdmins();
  }, [fetchSubAdmins]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (!assignModalOpen) {
      setLookupUser(null);
      setLookupError(null);
      setLookupLoading(false);
      return;
    }

    const trimmed = assignUserId.trim();
    const parsedId = parseInt(trimmed, 10);

    if (!trimmed || isNaN(parsedId) || parsedId <= 0) {
      setLookupUser(null);
      setLookupError(null);
      setLookupLoading(false);
      return;
    }

    setLookupLoading(true);
    setLookupError(null);

    const timer = setTimeout(async () => {
      try {
        const data = await api.get<UserLookupInfo>(
          `/admin/iam/users/${parsedId}/lookup`,
        );
        setLookupUser(data);
        setLookupError(null);
        if (data.department) {
          setAssignDepartment(data.department);
        }
        if (data.title) {
          setAssignTitle(data.title);
        }
      } catch (err: unknown) {
        setLookupUser(null);
        setLookupError(
          (err as { message?: string })?.message || t("admin.iam.userNotFound"),
        );
      } finally {
        setLookupLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [assignUserId, assignModalOpen, t]);

  const handleOpenDetail = async (userId: number) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await api.get<SubAdminDetail>(
        `/admin/iam/subadmins/${userId}`,
      );
      setSelectedSubAdmin(res);
    } catch (e: unknown) {
      toast.error(
        (e as { message?: string })?.message ||
          t("admin.iam.defaultDetailsTitle"),
      );
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId || !assignRoleSlug) {
      toast.error(t("admin.iam.requireUserIdRole"));
      return;
    }

    setSubmittingAssign(true);
    try {
      await api.post("/admin/iam/roles/assign", {
        targetUserId: parseInt(assignUserId, 10),
        roleSlug: assignRoleSlug,
        department: assignDepartment,
        title: assignTitle || undefined,
      });
      toast.success(t("admin.iam.assignSuccess"));
      setAssignModalOpen(false);
      setAssignUserId("");
      setAssignRoleSlug("");
      setAssignTitle("");
      setLookupUser(null);
      setLookupError(null);
      fetchSubAdmins();
    } catch (e: unknown) {
      toast.error(
        (e as { message?: string })?.message || t("admin.iam.assignError"),
      );
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleProvisionSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisionEmail || !provisionFullName || !provisionRoleSlug) {
      toast.error(t("admin.iam.requireUserIdRole"));
      return;
    }

    setSubmittingProvision(true);
    try {
      const res = await api.post<ProvisionResponse>(
        "/admin/iam/subadmins/provision",
        {
          email: provisionEmail,
          fullName: provisionFullName,
          phoneNumber: provisionPhoneNumber || undefined,
          department: provisionDepartment,
          roleSlug: provisionRoleSlug,
          title: provisionTitle || undefined,
          clearanceLevel: provisionClearanceLevel,
          mfaEnforced: provisionMfaEnforced,
          deliveryMethod: provisionDeliveryMethod,
        },
      );

      toast.success(t("admin.iam.provisionSuccess"));
      setProvisionModalOpen(false);

      // Open credential display modal
      setCredentialData({
        tempPassword: res.tempPassword,
        inviteUrl: res.inviteUrl
          ? `${window.location.origin}${res.inviteUrl}`
          : null,
        email: res.email,
      });
      setCredentialModalOpen(true);

      // Reset form
      setProvisionFullName("");
      setProvisionEmail("");
      setProvisionPhoneNumber("");
      setProvisionTitle("");
      fetchSubAdmins();
    } catch (e: unknown) {
      toast.error(
        (e as { message?: string })?.message || t("admin.iam.provisionError"),
      );
    } finally {
      setSubmittingProvision(false);
    }
  };

  const handleOpenEditModal = (staff: SubAdmin | SubAdminDetail) => {
    setEditUserId(staff.userId);
    setEditFullName(staff.fullName);
    setEditPhoneNumber("");
    setEditDepartment(staff.department);
    setEditTitle(staff.title);
    setEditClearanceLevel(staff.clearanceLevel);
    setEditMfaEnforced(
      "mfaEnforced" in staff ? (staff.mfaEnforced as boolean) : true,
    );
    setEditModalOpen(true);
  };

  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId) return;

    setSubmittingEdit(true);
    try {
      await api.put(`/admin/iam/subadmins/${editUserId}/profile`, {
        fullName: editFullName,
        phoneNumber: editPhoneNumber || undefined,
        department: editDepartment,
        title: editTitle,
        clearanceLevel: editClearanceLevel,
        mfaEnforced: editMfaEnforced,
      });

      toast.success(t("admin.iam.editProfileSuccess"));
      setEditModalOpen(false);
      fetchSubAdmins();
      if (selectedSubAdmin && selectedSubAdmin.userId === editUserId) {
        handleOpenDetail(editUserId);
      }
    } catch (e: unknown) {
      toast.error(
        (e as { message?: string })?.message || t("admin.iam.editProfileError"),
      );
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeProvisionSubAdmin = (staff: SubAdmin | SubAdminDetail) => {
    setConfirmDialog({
      isOpen: true,
      title: t("admin.iam.deprovisionTitle", "De-provision Administrator"),
      description: t("admin.iam.confirmDeprovision", { name: staff.fullName }),
      variant: "danger",
      confirmText: t("admin.iam.confirmDeprovisionBtn", "De-provision Account"),
      hazardBanner: t(
        "admin.iam.deprovisionHazard",
        "Warning: This action permanently removes administrative credentials, revokes active sessions, and deletes the admin profile.",
      ),
      typeToConfirm: "DEPROVISION",
      onConfirm: async () => {
        try {
          await api.delete(`/admin/iam/subadmins/${staff.userId}`);
          toast.success(t("admin.iam.deprovisionSuccess"));
          if (detailModalOpen && selectedSubAdmin?.userId === staff.userId) {
            setDetailModalOpen(false);
          }
          fetchSubAdmins();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (e: unknown) {
          toast.error(
            (e as { message?: string })?.message ||
              t("admin.iam.deprovisionError"),
          );
        }
      },
    });
  };

  const handleReissueInvite = async (userId: number) => {
    try {
      const res = await api.post<{ inviteUrl: string; email: string }>(
        `/admin/iam/subadmins/${userId}/invite`,
        {},
      );
      toast.success(t("admin.iam.reissueInviteSuccess"));
      setCredentialData({
        inviteUrl: `${window.location.origin}${res.inviteUrl}`,
        email: res.email,
      });
      setCredentialModalOpen(true);
    } catch (e: unknown) {
      toast.error(
        (e as { message?: string })?.message ||
          t("admin.iam.reissueInviteError"),
      );
    }
  };

  const handleGenerateTempPassword = (staff: SubAdmin | SubAdminDetail) => {
    setConfirmDialog({
      isOpen: true,
      title: t("admin.iam.tempPasswordTitle", "Generate Temporary Password"),
      description: t("admin.iam.confirmGenerateTempPassword", {
        name: staff.fullName,
      }),
      variant: "warning",
      confirmText: t(
        "admin.iam.confirmGeneratePasswordBtn",
        "Generate & Issue",
      ),
      hazardBanner: t(
        "admin.iam.tempPasswordHazard",
        "The administrator will be required to change this password immediately upon their next login.",
      ),
      onConfirm: async () => {
        try {
          const res = await api.post<{ tempPassword: string; email: string }>(
            `/admin/iam/subadmins/${staff.userId}/temp-password`,
            {},
          );
          toast.success(t("admin.iam.tempPasswordSuccess"));
          setCredentialData({
            tempPassword: res.tempPassword,
            email: res.email,
          });
          setCredentialModalOpen(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (e: unknown) {
          toast.error(
            (e as { message?: string })?.message ||
              t("admin.iam.tempPasswordError"),
          );
        }
      },
    });
  };

  const handleCopyText = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    toast.success(t("admin.iam.copiedCredential"));
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRevokeRole = (targetUserId: number, roleSlug: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t("admin.iam.revokeRoleTitle", "Revoke Role Assignment"),
      description: t("admin.iam.confirmRevokeRole", { role: roleSlug }),
      variant: "danger",
      confirmText: t("admin.iam.confirmRevokeRoleBtn", "Revoke Role"),
      onConfirm: async () => {
        try {
          await api.post("/admin/iam/roles/revoke", {
            targetUserId,
            roleSlug,
          });
          toast.success(t("admin.iam.revokeSuccess"));
          if (selectedSubAdmin) {
            handleOpenDetail(targetUserId);
          }
          fetchSubAdmins();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (e: unknown) {
          toast.error(
            (e as { message?: string })?.message || t("admin.iam.revokeError"),
          );
        }
      },
    });
  };

  const handleToggleStatus = (userId: number, currentActive: boolean) => {
    const actionLabel = currentActive
      ? t("admin.iam.deactivateStaff")
      : t("admin.iam.activateStaff");

    setConfirmDialog({
      isOpen: true,
      title: currentActive
        ? t("admin.iam.deactivateTitle", "Suspend Administrator")
        : t("admin.iam.activateTitle", "Reactivate Administrator"),
      description: t("admin.iam.confirmToggleStatus", { action: actionLabel }),
      variant: currentActive ? "danger" : "info",
      confirmText: actionLabel,
      onConfirm: async () => {
        try {
          await api.put(`/admin/iam/subadmins/${userId}/status`, {
            isActive: !currentActive,
          });
          toast.success(t("admin.iam.statusSuccess", { action: actionLabel }));
          fetchSubAdmins();
          if (selectedSubAdmin && selectedSubAdmin.userId === userId) {
            setSelectedSubAdmin({
              ...selectedSubAdmin,
              isActive: !currentActive,
            });
          }
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (e: unknown) {
          toast.error(
            (e as { message?: string })?.message ||
              t("admin.iam.statusError", { action: actionLabel }),
          );
        }
      },
    });
  };

  const handleRevokeSessions = (userId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: t("admin.iam.revokeSessionsTitle", "Revoke All Active Sessions"),
      description: t("admin.iam.confirmRevokeSessions"),
      variant: "warning",
      confirmText: t(
        "admin.iam.confirmRevokeSessionsBtn",
        "Terminate Sessions",
      ),
      hazardBanner: t(
        "admin.iam.revokeSessionsHazard",
        "The administrator will be immediately signed out from all desktop and mobile sessions.",
      ),
      onConfirm: async () => {
        try {
          await api.post("/admin/iam/sessions/revoke", {
            targetUserId: userId,
          });
          toast.success(t("admin.iam.revokeSessionsSuccess"));
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (e: unknown) {
          toast.error(
            (e as { message?: string })?.message ||
              t("admin.iam.revokeSessionsError"),
          );
        }
      },
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-blue-600" />
            {t("admin.iam.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.iam.subtitle")}
          </p>
        </div>

        {hasPermission("iam:roles:assign") && (
          <div className="flex items-center gap-2">
            <PodaciumButton
              variant="outline"
              onClick={() => setAssignModalOpen(true)}
              className="flex items-center gap-2 text-xs"
            >
              <Shield size={14} />
              {t("admin.iam.assignButton")}
            </PodaciumButton>

            <PodaciumButton
              variant="primary"
              onClick={() => setProvisionModalOpen(true)}
              className="flex items-center gap-2 text-xs shadow-md shadow-blue-500/10"
            >
              <UserPlus size={15} />
              {t("admin.iam.provisionButton")}
            </PodaciumButton>
          </div>
        )}
      </div>

      {/* Filters */}
      <PodaciumCard className="p-4 bg-white dark:bg-slate-900/60">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-gray-400" />
            <PodaciumInput
              placeholder={t("admin.iam.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="ps-9"
            />
          </div>

          <div>
            <PodaciumSelect
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "", label: t("admin.iam.departments.all") },
                ...departmentOptions.map((dept) => ({
                  value: dept,
                  label: t(`admin.iam.departments.${dept}`) || dept,
                })),
              ]}
            />
          </div>

          <div className="flex items-center justify-end">
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={fetchSubAdmins}
              className="flex items-center gap-1 text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {t("admin.common.refresh")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumCard>

      {/* Table */}
      <PodaciumCard className="overflow-hidden p-0 border border-gray-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="text-xs uppercase bg-gray-50 dark:bg-slate-900/80 text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5 text-start font-semibold">
                  {t("admin.iam.administrator")}
                </th>
                <th className="px-5 py-3.5 text-start font-semibold">
                  {t("admin.iam.deptAndTitle")}
                </th>
                <th className="px-5 py-3.5 text-start font-semibold">
                  {t("admin.iam.clearanceRank")}
                </th>
                <th className="px-5 py-3.5 text-start font-semibold">
                  {t("admin.iam.assignedRoles")}
                </th>
                <th className="px-5 py-3.5 text-start font-semibold">
                  {t("admin.common.status")}
                </th>
                <th className="px-5 py-3.5 text-end font-semibold">
                  {t("admin.common.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    {t("admin.iam.loadingStaff")}
                  </td>
                </tr>
              ) : subadmins.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    {t("admin.iam.noStaff")}
                  </td>
                </tr>
              ) : (
                subadmins.map((staff) => {
                  const dept = departmentBadges[staff.department] || {
                    departmentId: staff.department,
                    variant: "outline" as const,
                  };

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900 dark:text-slate-100">
                          {staff.fullName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {staff.email} •{" "}
                          {t("admin.iam.idLabel", { id: staff.userId })}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <PodaciumBadge
                          variant={dept.variant}
                          className="text-[11px] mb-1"
                        >
                          {t(`admin.iam.departments.${dept.departmentId}`) ||
                            staff.department}
                        </PodaciumBadge>
                        <div className="text-xs text-gray-600 dark:text-slate-300">
                          {staff.title}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                          <Shield
                            size={14}
                            className={
                              staff.clearanceLevel >= 8
                                ? "text-rose-500"
                                : staff.clearanceLevel >= 5
                                  ? "text-amber-500"
                                  : "text-blue-500"
                            }
                          />
                          {t("admin.iam.rankLevel", {
                            level: staff.clearanceLevel,
                          })}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {staff.roles.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {staff.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 size={14} /> {t("admin.iam.active")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                            <AlertTriangle size={14} />{" "}
                            {t("admin.iam.suspended")}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <PodaciumButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(staff.userId)}
                            className="text-xs p-1.5 text-gray-600 dark:text-slate-300"
                            title={t("admin.iam.inspectLineage")}
                          >
                            <Eye size={15} />
                          </PodaciumButton>

                          {hasPermission("iam:roles:assign") && (
                            <>
                              <PodaciumButton
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditModal(staff)}
                                className="text-xs p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                title={t("admin.iam.editStaff")}
                              >
                                <Edit3 size={15} />
                              </PodaciumButton>

                              <PodaciumButton
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleReissueInvite(staff.userId)
                                }
                                className="text-xs p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title={t("admin.iam.reissueInvite")}
                              >
                                <Send size={15} />
                              </PodaciumButton>

                              <PodaciumButton
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleGenerateTempPassword(staff)
                                }
                                className="text-xs p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                title={t("admin.iam.generateTempPassword")}
                              >
                                <KeyRound size={15} />
                              </PodaciumButton>
                            </>
                          )}

                          {hasPermission("iam:subadmins:deactivate") && (
                            <PodaciumButton
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleToggleStatus(staff.userId, staff.isActive)
                              }
                              className={`text-xs p-1.5 ${
                                staff.isActive
                                  ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              }`}
                              title={
                                staff.isActive
                                  ? t("admin.iam.deactivateStaff")
                                  : t("admin.iam.activateStaff")
                              }
                            >
                              {staff.isActive ? (
                                <UserX size={15} />
                              ) : (
                                <UserCheck size={15} />
                              )}
                            </PodaciumButton>
                          )}

                          {hasPermission("iam:roles:assign") && (
                            <PodaciumButton
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeProvisionSubAdmin(staff)}
                              className="text-xs p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title={t("admin.iam.deprovision")}
                            >
                              <Trash2 size={15} />
                            </PodaciumButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40">
            <div className="text-xs text-gray-500">
              {t("admin.iam.showingStaff", {
                start: (page - 1) * pageSize + 1,
                end: Math.min(page * pageSize, total),
                total,
              })}
            </div>
            <div className="flex items-center gap-2">
              <PodaciumButton
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={14} />
              </PodaciumButton>
              <span className="text-xs text-gray-700 dark:text-slate-300">
                {t("admin.common.pageOf", { page, totalPages })}
              </span>
              <PodaciumButton
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={14} />
              </PodaciumButton>
            </div>
          </div>
        )}
      </PodaciumCard>

      {/* Provision Sub-Admin Wizard Modal */}
      <PodaciumModal
        isOpen={provisionModalOpen}
        onClose={() => setProvisionModalOpen(false)}
        title={t("admin.iam.provisionModalTitle")}
      >
        <form onSubmit={handleProvisionSubAdmin} className="space-y-4 pt-2">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t("admin.iam.provisionSubtitle")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.fullName")}
              </label>
              <PodaciumInput
                placeholder={t("admin.iam.fullNamePlaceholder")}
                value={provisionFullName}
                onChange={(e) => setProvisionFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.email")}
              </label>
              <PodaciumInput
                type="email"
                placeholder={t("admin.iam.emailPlaceholder")}
                value={provisionEmail}
                onChange={(e) => setProvisionEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.department")}
              </label>
              <PodaciumSelect
                value={provisionDepartment}
                onChange={(e) => setProvisionDepartment(e.target.value)}
                options={departmentOptions.map((dept) => ({
                  value: dept,
                  label: t(`admin.iam.departments.${dept}`) || dept,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.role")}
              </label>
              <PodaciumSelect
                value={provisionRoleSlug}
                onChange={(e) => {
                  setProvisionRoleSlug(e.target.value);
                  const selRole = roles.find((r) => r.slug === e.target.value);
                  if (selRole) {
                    setProvisionClearanceLevel(
                      Math.min(selRole.hierarchyRank, 10),
                    );
                  }
                }}
                options={[
                  { value: "", label: t("admin.iam.selectRole") },
                  ...roles.map((r) => ({
                    value: r.slug,
                    label: `${r.name} (${t("admin.iam.rankLevel", { level: r.hierarchyRank })})`,
                  })),
                ]}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.position")}
              </label>
              <PodaciumInput
                placeholder={t("admin.iam.positionPlaceholder")}
                value={provisionTitle}
                onChange={(e) => setProvisionTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.phoneNumber")}
              </label>
              <PodaciumInput
                placeholder={t("admin.iam.phoneNumberPlaceholder")}
                value={provisionPhoneNumber}
                onChange={(e) => setProvisionPhoneNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  {t("admin.iam.clearanceLevelLabel")}
                </label>
                <p className="text-[11px] text-gray-500">
                  {t("admin.iam.rankLevel", {
                    level: provisionClearanceLevel,
                  })}
                </p>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={provisionClearanceLevel}
                onChange={(e) =>
                  setProvisionClearanceLevel(parseInt(e.target.value, 10))
                }
                className="w-32 accent-blue-600"
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  {t("admin.iam.mfaEnforcedLabel")}
                </label>
                <p className="text-[11px] text-gray-500">
                  {t("admin.iam.mfaEnforcedHint")}
                </p>
              </div>
              <input
                type="checkbox"
                checked={provisionMfaEnforced}
                onChange={(e) => setProvisionMfaEnforced(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
              {t("admin.iam.deliveryMethodLabel")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  provisionDeliveryMethod === "INVITE_LINK"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-600"
                    : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="INVITE_LINK"
                    checked={provisionDeliveryMethod === "INVITE_LINK"}
                    onChange={() => setProvisionDeliveryMethod("INVITE_LINK")}
                    className="text-blue-600"
                  />
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1">
                    <Mail size={13} className="text-blue-600" />
                    {t("admin.iam.deliveryInviteLink")}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 ps-5">
                  {t("admin.iam.deliveryInviteDesc")}
                </p>
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  provisionDeliveryMethod === "TEMPORARY_CREDENTIAL"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-600"
                    : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="TEMPORARY_CREDENTIAL"
                    checked={provisionDeliveryMethod === "TEMPORARY_CREDENTIAL"}
                    onChange={() =>
                      setProvisionDeliveryMethod("TEMPORARY_CREDENTIAL")
                    }
                    className="text-blue-600"
                  />
                  <span className="text-xs font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1">
                    <KeyRound size={13} className="text-amber-600" />
                    {t("admin.iam.deliveryTempPassword")}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5 ps-5">
                  {t("admin.iam.deliveryTempDesc")}
                </p>
              </label>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-800">
            <PodaciumButton
              type="button"
              variant="outline"
              onClick={() => setProvisionModalOpen(false)}
            >
              {t("admin.common.cancel")}
            </PodaciumButton>
            <PodaciumButton type="submit" disabled={submittingProvision}>
              {submittingProvision
                ? t("admin.iam.provisioning")
                : t("admin.iam.confirmProvision")}
            </PodaciumButton>
          </div>
        </form>
      </PodaciumModal>

      {/* One-Time Credential Modal */}
      <PodaciumModal
        isOpen={credentialModalOpen}
        onClose={() => setCredentialModalOpen(false)}
        title={t("admin.iam.credentialModalTitle")}
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-gray-600 dark:text-slate-400">
            {t("admin.iam.credentialModalSubtitle")}
          </p>

          {credentialData?.tempPassword && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.tempPasswordLabel")}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 select-all">
                  {credentialData.tempPassword}
                </div>
                <PodaciumButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleCopyText(credentialData.tempPassword || "", "pwd")
                  }
                  className="flex items-center gap-1 text-xs"
                >
                  {copiedKey === "pwd" ? (
                    <Check size={14} className="text-emerald-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                  {t("admin.iam.copyCredential")}
                </PodaciumButton>
              </div>
            </div>
          )}

          {credentialData?.inviteUrl && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.inviteUrlLabel")}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-blue-600 dark:text-blue-400 break-all select-all">
                  {credentialData.inviteUrl}
                </div>
                <PodaciumButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleCopyText(credentialData.inviteUrl || "", "url")
                  }
                  className="flex items-center gap-1 text-xs"
                >
                  {copiedKey === "url" ? (
                    <Check size={14} className="text-emerald-600" />
                  ) : (
                    <Copy size={14} />
                  )}
                  {t("admin.iam.copyCredential")}
                </PodaciumButton>
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
            <Shield size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {t("admin.iam.credentialSecurityNotice")}
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <PodaciumButton
              type="button"
              variant="primary"
              onClick={() => setCredentialModalOpen(false)}
            >
              {t("admin.iam.close")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumModal>

      {/* Edit Staff Profile Modal */}
      <PodaciumModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={t("admin.iam.editProfileTitle")}
      >
        <form onSubmit={handleSaveEditProfile} className="space-y-4 pt-2">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t("admin.iam.editProfileSubtitle")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.fullName")}
              </label>
              <PodaciumInput
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.phoneNumber")}
              </label>
              <PodaciumInput
                value={editPhoneNumber}
                onChange={(e) => setEditPhoneNumber(e.target.value)}
                placeholder={t("admin.iam.phoneNumberPlaceholder")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.department")}
              </label>
              <PodaciumSelect
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
                options={departmentOptions.map((dept) => ({
                  value: dept,
                  label: t(`admin.iam.departments.${dept}`) || dept,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                {t("admin.iam.position")}
              </label>
              <PodaciumInput
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t("admin.iam.positionPlaceholder")}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  {t("admin.iam.clearanceLevelLabel")}
                </label>
                <p className="text-[11px] text-gray-500">
                  {t("admin.iam.rankLevel", { level: editClearanceLevel })}
                </p>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={editClearanceLevel}
                onChange={(e) =>
                  setEditClearanceLevel(parseInt(e.target.value, 10))
                }
                className="w-32 accent-blue-600"
              />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  {t("admin.iam.mfaEnforcedLabel")}
                </label>
                <p className="text-[11px] text-gray-500">
                  {t("admin.iam.mfaEnforcedHint")}
                </p>
              </div>
              <input
                type="checkbox"
                checked={editMfaEnforced}
                onChange={(e) => setEditMfaEnforced(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-gray-100 dark:border-slate-800">
            <PodaciumButton
              type="button"
              variant="outline"
              onClick={() => setEditModalOpen(false)}
            >
              {t("admin.common.cancel")}
            </PodaciumButton>
            <PodaciumButton type="submit" disabled={submittingEdit}>
              {submittingEdit
                ? t("admin.iam.saving")
                : t("admin.iam.saveChanges")}
            </PodaciumButton>
          </div>
        </form>
      </PodaciumModal>

      {/* Assign Role Modal */}
      <PodaciumModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setLookupUser(null);
          setLookupError(null);
        }}
        title={t("admin.iam.assignModalTitle")}
      >
        <form onSubmit={handleAssignRole} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t("admin.iam.targetUserId")}
            </label>
            <div className="relative">
              <PodaciumInput
                type="number"
                placeholder={t("admin.iam.targetUserIdPlaceholder")}
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                required
              />
              {lookupLoading && (
                <div className="absolute end-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-primary font-medium pointer-events-none">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                </div>
              )}
            </div>
          </div>

          {/* User Lookup Preview Card */}
          {lookupUser && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0 overflow-hidden">
                    {lookupUser.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={lookupUser.avatarUrl}
                        alt={lookupUser.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      lookupUser.fullName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">
                        {lookupUser.fullName}
                      </span>
                      <PodaciumBadge
                        variant={
                          lookupUser.isActive ? "success" : "destructive"
                        }
                      >
                        {lookupUser.isActive
                          ? t("admin.iam.active")
                          : t("admin.iam.inactive")}
                      </PodaciumBadge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {lookupUser.email}
                      {lookupUser.phoneNumber && ` • ${lookupUser.phoneNumber}`}
                    </p>
                  </div>
                </div>
                <PodaciumBadge variant="outline" className="shrink-0">
                  {lookupUser.role}
                </PodaciumBadge>
              </div>

              {lookupUser.hasAdminProfile ? (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("admin.iam.clearancePrefix")}
                  </span>
                  <PodaciumBadge variant="secondary">
                    L{lookupUser.clearanceLevel ?? 4}
                  </PodaciumBadge>
                  {lookupUser.department && (
                    <PodaciumBadge variant="default">
                      {t(`admin.iam.departments.${lookupUser.department}`) ||
                        lookupUser.department}
                    </PodaciumBadge>
                  )}
                  {lookupUser.roles.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-slate-500 dark:text-slate-400">
                        {t("admin.iam.rolesPrefix")}
                      </span>
                      {lookupUser.roles.map((r) => (
                        <PodaciumBadge
                          key={r}
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {r}
                        </PodaciumBadge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{t("admin.iam.standardUserNotice")}</span>
                </div>
              )}
            </div>
          )}

          {lookupError && !lookupLoading && assignUserId.trim() && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{lookupError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t("admin.iam.department")}
            </label>
            <PodaciumSelect
              value={assignDepartment}
              onChange={(e) => setAssignDepartment(e.target.value)}
              options={departmentOptions.map((dept) => ({
                value: dept,
                label: t(`admin.iam.departments.${dept}`) || dept,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t("admin.iam.role")}
            </label>
            <PodaciumSelect
              value={assignRoleSlug}
              onChange={(e) => setAssignRoleSlug(e.target.value)}
              options={[
                { value: "", label: t("admin.iam.selectRole") },
                ...roles.map((r) => ({
                  value: r.slug,
                  label: `${r.name} (${t("admin.iam.rankLevel", { level: r.hierarchyRank })})`,
                })),
              ]}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              {t("admin.iam.position")}
            </label>
            <PodaciumInput
              placeholder={t("admin.iam.positionPlaceholder")}
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
            />
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <PodaciumButton
              type="button"
              variant="outline"
              onClick={() => setAssignModalOpen(false)}
            >
              {t("admin.common.cancel")}
            </PodaciumButton>
            <PodaciumButton type="submit" disabled={submittingAssign}>
              {submittingAssign
                ? t("admin.iam.assigning")
                : t("admin.iam.confirmAssignment")}
            </PodaciumButton>
          </div>
        </form>
      </PodaciumModal>

      {/* Sub-Admin Detail Modal */}
      <PodaciumModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={
          selectedSubAdmin
            ? t("admin.iam.detailsTitle", {
                name: selectedSubAdmin.fullName,
              })
            : t("admin.iam.defaultDetailsTitle")
        }
      >
        {loadingDetail || !selectedSubAdmin ? (
          <div className="py-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
            {t("admin.iam.loadingProfile")}
          </div>
        ) : (
          <div className="space-y-5 pt-2 max-h-[75vh] overflow-y-auto">
            {/* User Overview */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                  {selectedSubAdmin.fullName}
                </h4>
                <p className="text-xs text-gray-500">
                  {selectedSubAdmin.email} •{" "}
                  {t("admin.iam.idLabel", { id: selectedSubAdmin.userId })}
                </p>
                <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
                  <strong>{t("admin.iam.position")}:</strong>{" "}
                  {selectedSubAdmin.title} (
                  {t(`admin.iam.departments.${selectedSubAdmin.department}`) ||
                    selectedSubAdmin.department}
                  )
                </p>
              </div>
              <div className="text-end">
                <PodaciumBadge
                  variant={
                    selectedSubAdmin.clearanceLevel >= 8
                      ? "destructive"
                      : "default"
                  }
                  className="font-mono text-xs"
                >
                  {t("admin.iam.clearanceLevelMax", {
                    level: selectedSubAdmin.clearanceLevel,
                  })}
                </PodaciumBadge>
                <div className="mt-2 flex items-center gap-1.5 justify-end">
                  {hasPermission("iam:roles:assign") && (
                    <PodaciumButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleOpenEditModal(selectedSubAdmin);
                      }}
                      className="text-xs flex items-center gap-1"
                    >
                      <Edit3 size={12} />
                      {t("admin.iam.editStaff")}
                    </PodaciumButton>
                  )}
                  <PodaciumButton
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleRevokeSessions(selectedSubAdmin.userId)
                    }
                    className="text-xs flex items-center gap-1 text-rose-600 border-rose-300"
                  >
                    <LogOut size={12} />
                    {t("admin.iam.revokeAllSessions")}
                  </PodaciumButton>
                </div>
              </div>
            </div>

            {/* Assigned Roles */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                {t("admin.iam.assignedRolesCount", {
                  count: selectedSubAdmin.roleAssignments.length,
                })}
              </h5>
              <div className="space-y-2">
                {selectedSubAdmin.roleAssignments.map((ra) => (
                  <div
                    key={ra.roleSlug}
                    className="p-3 rounded-lg border border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950"
                  >
                    <div>
                      <div className="font-semibold text-xs text-gray-900 dark:text-slate-100">
                        {ra.roleName}{" "}
                        <span className="font-mono text-gray-400">
                          ({ra.roleSlug})
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {t("admin.iam.hierarchyRankAssigned", {
                          rank: ra.hierarchyRank,
                          date: new Date(ra.assignedAt).toLocaleDateString(),
                        })}
                      </div>
                    </div>
                    {hasPermission("iam:roles:assign") && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRevokeRole(selectedSubAdmin.userId, ra.roleSlug)
                        }
                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title={t("admin.iam.revokeRole")}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Effective Permissions Matrix */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                {t("admin.iam.effectivePermissionsCount", {
                  count: selectedSubAdmin.effectivePermissions.length,
                })}
              </h5>
              <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 max-h-48 overflow-y-auto">
                {selectedSubAdmin.effectivePermissions.includes("*") ? (
                  <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 font-mono text-xs font-bold">
                    {t("admin.iam.wildcardAccess")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {selectedSubAdmin.effectivePermissions.map((perm) => (
                      <div
                        key={perm}
                        className="px-2 py-1 bg-white dark:bg-slate-950 rounded border border-gray-200 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300"
                      >
                        {perm}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </PodaciumModal>

      {/* Action Confirmation Dialog */}
      <PodaciumConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        variant={confirmDialog.variant}
        hazardBanner={confirmDialog.hazardBanner}
        typeToConfirm={confirmDialog.typeToConfirm}
        isLoading={confirmDialog.isLoading}
      />
    </div>
  );
}
