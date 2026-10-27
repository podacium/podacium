"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import {
  Building2,
  User,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

interface InvitationDetails {
  id: number;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organization: { id: number; name: string; description: string | null };
  inviter: { id: number; fullName: string | null; email: string };
}

export default function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("bi.organizations.members.accept");
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "accept" | "decline" | null
  >(null);
  const [success, setSuccess] = useState<"accepted" | "declined" | null>(null);

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) return;

      try {
        setLoading(true);
        const data = await api.getInvitationByToken(token);
        setInvitation(data);
      } catch (err: any) {
        if (err.message?.includes("not found") || err.status === 404) {
          setError("notFound");
        } else if (err.message?.includes("expired") || err.status === 400) {
          setError("expired");
        } else if (err.message?.includes("already been used")) {
          setError("alreadyUsed");
        } else {
          setError("notFound");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  // Auto-action if query param present and authenticated
  useEffect(() => {
    const action = searchParams.get("action");
    if (action && isAuthenticated && invitation && !actionLoading && !success) {
      if (action === "accept") {
        handleAccept();
      } else if (action === "decline") {
        handleDecline();
      }
    }
  }, [searchParams, isAuthenticated, invitation]);

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push(
        `/auth/login?redirect=/bi/organizations/invitations/${token}?action=accept`,
      );
      return;
    }

    setActionLoading("accept");
    try {
      await api.acceptInvitation(token);
      setSuccess("accepted");
      // Redirect to organization after short delay
      setTimeout(() => {
        router.push(`/bi/organizations/${invitation?.organization.id}`);
      }, 2000);
    } catch (err: any) {
      if (err.message?.includes("already a member")) {
        setError("alreadyMember");
      } else {
        setError("notFound");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    if (!isAuthenticated) {
      router.push(
        `/auth/login?redirect=/bi/organizations/invitations/${token}?action=decline`,
      );
      return;
    }

    setActionLoading("decline");
    try {
      await api.declineInvitation(token);
      setSuccess("declined");
    } catch {
      setError("notFound");
    } finally {
      setActionLoading(null);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center pt-24 pb-8 px-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-400">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center pt-24 pb-8 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {t(error as any)}
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mb-6">
            {t(`${error}Hint` as any)}
          </p>
          <Link
            href="/bi/organizations"
            className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            {t("goToOrganizations")}
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center pt-24 pb-8 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
            {success === "accepted" ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <XCircle className="w-8 h-8 text-orange-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {success === "accepted"
              ? t("success", { orgName: invitation?.organization.name || "" })
              : t("declined")}
          </h1>
          {success === "accepted" && (
            <p className="text-gray-600 dark:text-slate-400 mb-6">
              {t("successRedirect")}
            </p>
          )}
          {success === "declined" && (
            <Link
              href="/bi/organizations"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors mt-4"
            >
              {t("goToOrganizations")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Invitation details
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center pt-24 pb-8 px-4">
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-10 text-center text-white">
          <div className="w-16 h-16 bg-white/15 border border-white/25 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">
            {t("title", { orgName: invitation?.organization.name || "" })}
          </h1>
          <p className="text-indigo-100 mt-2">{t("subtitle")}</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Organization Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
              {invitation?.organization.name}
            </h2>
            {invitation?.organization.description && (
              <p className="text-gray-600 dark:text-slate-400 text-sm">
                {invitation.organization.description}
              </p>
            )}
          </div>

          {/* Inviter */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("invitedBy", {
                  inviterName:
                    invitation?.inviter.fullName ||
                    invitation?.inviter.email ||
                    "",
                })}
              </p>
            </div>
          </div>

          {/* Role */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {t("role", {
                  role: t(
                    `bi.organizations.roles.${invitation?.role.toLowerCase()}`,
                  ),
                })}
              </p>
            </div>
          </div>

          {/* Login prompt if not authenticated */}
          {!isAuthenticated && (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 mb-6">
              <p className="text-amber-800 dark:text-amber-200 text-sm">
                {t("loginRequired")}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleAccept}
              disabled={actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {actionLoading === "accept" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("accepting")}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {t("acceptButton")}
                </>
              )}
            </button>
            <button
              onClick={handleDecline}
              disabled={actionLoading !== null}
              className="px-6 py-3 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-50"
            >
              {actionLoading === "decline" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t("declineButton")
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
