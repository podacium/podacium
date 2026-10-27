"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  UserPlus,
  Trash2,
  Loader2,
  Users,
  AlertCircle,
  Check,
} from "lucide-react";
import {
  api,
  OrganizationResponse,
  OrganizationMemberResponse,
} from "@/lib/api";
import { RoleBadge } from "./RoleBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumDangerModal from "@/components/design-system/PodaciumDangerModal";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: OrganizationResponse | null;
  t: any;
}

export function MemberManagementModal({
  isOpen,
  onClose,
  organization,
  t,
}: MemberManagementModalProps) {
  const [members, setMembers] = useState<OrganizationMemberResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState({ email: "", role: "MEMBER" });
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [memberToRemove, setMemberToRemove] =
    useState<OrganizationMemberResponse | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!organization) return;
    try {
      setLoading(true);
      const data = await api.getOrganizationMembers(organization.id);
      setMembers(data || []);
    } catch (err: any) {
      setError(err.message || t("bi.organizations.members.error.generic"));
    } finally {
      setLoading(false);
    }
  }, [organization, t]);

  useEffect(() => {
    if (isOpen && organization) {
      loadMembers();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, organization, loadMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.inviteMember(
        organization.id,
        inviteData.email,
        inviteData.role,
      );
      setSuccess(t("bi.organizations.members.invite.success"));
      setInviteData({ email: "", role: "MEMBER" });
      loadMembers();
    } catch (err: any) {
      setError(
        err.message || t("bi.organizations.members.invite.error.generic"),
      );
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!organization || !memberToRemove) return;
    try {
      setIsRemoving(true);
      setError(null);
      await api.removeMember(organization.id, memberToRemove.id);
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      setSuccess(t("bi.organizations.members.remove.success"));
      setMemberToRemove(null);
    } catch (err: any) {
      setError(err.message || t("bi.organizations.members.remove.error"));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleUpdateRole = async (memberId: number, newRole: string) => {
    if (!organization) return;
    try {
      setUpdatingRole(true);
      setError(null);
      await api.updateMemberRole(organization.id, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, role: newRole as any } : m,
        ),
      );
      setEditingMemberId(null);
      setSuccess(t("bi.organizations.members.updateRole.success"));
    } catch (err: any) {
      setError(err.message || t("bi.organizations.members.updateRole.error"));
    } finally {
      setUpdatingRole(false);
    }
  };

  if (!isOpen || !organization) return null;

  const roleOptions = [
    { value: "MEMBER", label: t("bi.organizations.roles.member") },
    { value: "ADMIN", label: t("bi.organizations.roles.admin") },
  ];

  return (
    <>
      <PodaciumModal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={t("bi.organizations.members.title")}
        description={organization.name}
      >
        <div className="space-y-6">
          {(error || success) && (
            <div
              className={`p-4 rounded-xl flex items-start gap-3 border ${
                error
                  ? "bg-destructive/10 border-destructive/20 text-destructive"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {error ? (
                <AlertCircle className="w-5 h-5 shrink-0" />
              ) : (
                <Check className="w-5 h-5 shrink-0" />
              )}
              <p className="text-sm">{error || success}</p>
            </div>
          )}

          {organization.isOwner && (
            <div className="bg-muted/40 rounded-2xl p-4 border border-border">
              <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                {t("bi.organizations.members.invite.title")}
              </h4>
              <form
                onSubmit={handleInvite}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="flex-1">
                  <PodaciumInput
                    type="email"
                    value={inviteData.email}
                    onChange={(e) =>
                      setInviteData({ ...inviteData, email: e.target.value })
                    }
                    placeholder={t(
                      "bi.organizations.members.invite.email.placeholder",
                    )}
                    required
                  />
                </div>
                <div className="w-full sm:w-44">
                  <PodaciumSelect
                    options={roleOptions}
                    value={inviteData.role}
                    onChange={(e) =>
                      setInviteData({ ...inviteData, role: e.target.value })
                    }
                  />
                </div>
                <PodaciumButton
                  type="submit"
                  variant="primary"
                  loading={inviting}
                  icon={<Check className="w-4 h-4" />}
                >
                  {t("bi.organizations.members.invite.submit")}
                </PodaciumButton>
              </form>
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {t("bi.organizations.members.title")}
              </h4>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t("bi.organizations.members.noMembers")}
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <PodaciumAvatar
                        name={
                          member.user?.fullName || member.user?.email || "?"
                        }
                        alt={member.user?.email || "Member"}
                        src={member.user?.profilePictureUrl}
                        size="md"
                      />
                      <div>
                        <div className="font-medium text-foreground text-sm flex items-center gap-2 flex-wrap">
                          <span className="truncate max-w-[180px] sm:max-w-none">
                            {member.user?.email}
                          </span>
                          {member.userId === organization.ownerId && (
                            <PodaciumBadge
                              variant="default"
                              className="text-[10px]"
                            >
                              {t("bi.organizations.roles.owner")}
                            </PodaciumBadge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editingMemberId === member.id ? (
                        <div className="flex items-center gap-2">
                          <PodaciumSelect
                            selectSize="sm"
                            value={member.role || "MEMBER"}
                            disabled={updatingRole}
                            options={[
                              ...roleOptions,
                              ...(member.role === "OWNER"
                                ? [
                                    {
                                      value: "OWNER",
                                      label: t("bi.organizations.roles.owner"),
                                    },
                                  ]
                                : []),
                            ]}
                            onChange={(e) =>
                              handleUpdateRole(member.id, e.target.value)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => setEditingMemberId(null)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            onClick={() =>
                              organization.isOwner &&
                              member.userId !== organization.ownerId &&
                              setEditingMemberId(member.id)
                            }
                            className={
                              organization.isOwner &&
                              member.userId !== organization.ownerId
                                ? "cursor-pointer hover:opacity-80"
                                : ""
                            }
                          >
                            <RoleBadge role={member.role || "MEMBER"} t={t} />
                          </div>

                          {organization.isOwner &&
                            member.userId !== organization.ownerId && (
                              <PodaciumButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setMemberToRemove(member)}
                                className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                                title={t(
                                  "bi.organizations.members.remove.title",
                                )}
                                icon={<Trash2 className="w-4 h-4" />}
                              />
                            )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {organization.invitations &&
              organization.invitations.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    {t("bi.organizations.invitations.title")}
                  </h4>
                  <div className="space-y-2">
                    {organization.invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <PodaciumAvatar
                            name={invitation.email}
                            alt={invitation.email}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {invitation.email}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {t("bi.organizations.members.pending")} •{" "}
                              {t(
                                `bi.organizations.roles.${invitation.role.toLowerCase()}`,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      </PodaciumModal>

      {memberToRemove && (
        <PodaciumDangerModal
          isOpen={Boolean(memberToRemove)}
          onClose={() => setMemberToRemove(null)}
          onConfirm={handleConfirmRemove}
          title={t("bi.organizations.members.remove.title")}
          description={t("bi.organizations.members.remove.message").replace(
            "{name}",
            memberToRemove.user?.email || "",
          )}
          confirmTextExpected={
            memberToRemove.user?.email ||
            t("bi.organizations.members.remove.confirm")
          }
          actionLabel={t("bi.organizations.members.remove.confirm")}
          isPending={isRemoving}
        />
      )}
    </>
  );
}
