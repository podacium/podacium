"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Headphones,
  FileSpreadsheet,
  Users2,
  Mail,
  Phone,
  Copy,
  Check,
  Edit3,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, OrganizationResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";

export interface CorporateContact {
  key: "admin" | "it" | "daf" | "hr";
  titleKey: string;
  name: string;
  email: string;
  phone?: string;
  roleBadge: string;
}

interface KeyCorporateContactsCardProps {
  organization: OrganizationResponse;
  canEdit: boolean;
  onUpdated?: () => void;
  className?: string;
}

export function KeyCorporateContactsCard({
  organization,
  canEdit,
  onUpdated,
  className,
}: KeyCorporateContactsCardProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");

  const [itName, setItName] = useState("");
  const [itEmail, setItEmail] = useState("");
  const [itPhone, setItPhone] = useState("");

  const [dafName, setDafName] = useState("");
  const [dafEmail, setDafEmail] = useState("");
  const [dafPhone, setDafPhone] = useState("");

  const [hrName, setHrName] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [hrPhone, setHrPhone] = useState("");

  // Parse existing keyContacts
  const contacts: CorporateContact[] = useMemo(() => {
    const raw = organization.keyContacts;
    const parsed =
      typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};

    const slugDomain = organization.slug
      ? `${organization.slug}.dz`
      : "podacium.dz";

    return [
      {
        key: "admin",
        titleKey: "organizations.adminContact",
        name: parsed.admin?.name || organization.name + " Admin",
        email: parsed.admin?.email || `admin@${slugDomain}`,
        phone: parsed.admin?.phone || undefined,
        roleBadge: "OWNER / ADMIN",
      },
      {
        key: "daf",
        titleKey: "organizations.dafContact",
        name: parsed.daf?.name || "DAF / Direction Financière",
        email: parsed.daf?.email || `compta@${slugDomain}`,
        phone: parsed.daf?.phone || undefined,
        roleBadge: "DAF / BILLING",
      },
      {
        key: "it",
        titleKey: "organizations.itContact",
        name: parsed.it?.name || "Support IT & Systèmes",
        email: parsed.it?.email || `helpdesk@${slugDomain}`,
        phone: parsed.it?.phone || undefined,
        roleBadge: "IT HELPDESK",
      },
      {
        key: "hr",
        titleKey: "organizations.hrContact",
        name: parsed.hr?.name || "Ressources Humaines",
        email: parsed.hr?.email || `rh@${slugDomain}`,
        phone: parsed.hr?.phone || undefined,
        roleBadge: "PEOPLE & HR",
      },
    ];
  }, [organization]);

  const handleOpenEdit = () => {
    const cMap = contacts.reduce(
      (acc, c) => ({ ...acc, [c.key]: c }),
      {} as any,
    );
    setAdminName(cMap.admin?.name || "");
    setAdminEmail(cMap.admin?.email || "");
    setAdminPhone(cMap.admin?.phone || "");

    setDafName(cMap.daf?.name || "");
    setDafEmail(cMap.daf?.email || "");
    setDafPhone(cMap.daf?.phone || "");

    setItName(cMap.it?.name || "");
    setItEmail(cMap.it?.email || "");
    setItPhone(cMap.it?.phone || "");

    setHrName(cMap.hr?.name || "");
    setHrEmail(cMap.hr?.email || "");
    setHrPhone(cMap.hr?.phone || "");

    setError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveContacts = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        admin: {
          name: adminName.trim(),
          email: adminEmail.trim(),
          phone: adminPhone.trim(),
        },
        daf: {
          name: dafName.trim(),
          email: dafEmail.trim(),
          phone: dafPhone.trim(),
        },
        it: {
          name: itName.trim(),
          email: itEmail.trim(),
          phone: itPhone.trim(),
        },
        hr: {
          name: hrName.trim(),
          email: hrEmail.trim(),
          phone: hrPhone.trim(),
        },
      };

      await api.updateOrganization(organization.id, {
        keyContacts: payload,
      });

      setIsEditModalOpen(false);
      onUpdated?.();
    } catch (err: any) {
      console.error("Failed to update key contacts:", err);
      setError(err?.message || t("organizations.contactsSaveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyEmailToClipboard = (email: string, key: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(email);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const getContactIcon = (key: CorporateContact["key"]) => {
    switch (key) {
      case "admin":
        return <ShieldCheck className="w-4 h-4 text-primary" />;
      case "daf":
        return (
          <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        );
      case "it":
        return (
          <Headphones className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        );
      case "hr":
        return (
          <Users2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        );
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">
            {t("organizations.contactsTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("organizations.contactsSubtitle")}
          </p>
        </div>

        {canEdit && (
          <PodaciumButton
            variant="outline"
            size="sm"
            icon={<Edit3 className="w-3.5 h-3.5" />}
            onClick={handleOpenEdit}
          >
            {t("organizations.editContacts")}
          </PodaciumButton>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {contacts.map((contact) => (
          <PodaciumCard
            key={contact.key}
            className="p-4 flex flex-col justify-between border-border hover:shadow-xs transition-shadow"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="p-2 rounded-lg bg-muted text-foreground">
                  {getContactIcon(contact.key)}
                </div>
                <PodaciumBadge
                  variant="outline"
                  className="font-mono text-[10px] tracking-wide"
                >
                  {contact.roleBadge}
                </PodaciumBadge>
              </div>

              <div className="text-xs font-medium text-muted-foreground">
                {t(contact.titleKey)}
              </div>
              <h4 className="text-sm font-bold text-foreground mt-0.5 truncate">
                {contact.name}
              </h4>
            </div>

            <div className="pt-3 mt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between gap-1 text-xs">
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors truncate font-mono text-[11px]"
                  dir="ltr"
                  title={contact.email}
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    copyEmailToClipboard(contact.email, contact.key)
                  }
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  title={t("organizations.copyEmail")}
                  aria-label={t("organizations.copyEmail")}
                >
                  {copiedKey === contact.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {contact.phone && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <a
                    href={`tel:${contact.phone}`}
                    className="hover:underline font-mono text-[11px]"
                    dir="ltr"
                  >
                    {contact.phone}
                  </a>
                </div>
              )}
            </div>
          </PodaciumCard>
        ))}
      </div>

      {/* Edit Contacts Modal */}
      {isEditModalOpen && (
        <PodaciumModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={t("organizations.editContacts")}
          size="lg"
        >
          <form onSubmit={handleSaveContacts} className="space-y-4 py-2">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                {error}
              </div>
            )}

            {/* Admin */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="font-semibold text-xs text-foreground uppercase tracking-wider">
                {t("organizations.adminContact")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PodaciumInput
                  label={t("organizations.contactName")}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder={t("organizations.contactName")}
                />
                <PodaciumInput
                  label={t("organizations.contactEmail")}
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder={t("organizations.contactEmail")}
                  dir="ltr"
                />
              </div>
            </div>

            {/* DAF / Fiscal */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="font-semibold text-xs text-foreground uppercase tracking-wider">
                {t("organizations.dafContact")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PodaciumInput
                  label={t("organizations.contactName")}
                  value={dafName}
                  onChange={(e) => setDafName(e.target.value)}
                  placeholder={t("organizations.contactName")}
                />
                <PodaciumInput
                  label={t("organizations.contactEmail")}
                  value={dafEmail}
                  onChange={(e) => setDafEmail(e.target.value)}
                  placeholder={t("organizations.contactEmail")}
                  dir="ltr"
                />
              </div>
            </div>

            {/* IT Helpdesk */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="font-semibold text-xs text-foreground uppercase tracking-wider">
                {t("organizations.itContact")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PodaciumInput
                  label={t("organizations.contactName")}
                  value={itName}
                  onChange={(e) => setItName(e.target.value)}
                  placeholder={t("organizations.contactName")}
                />
                <PodaciumInput
                  label={t("organizations.contactEmail")}
                  value={itEmail}
                  onChange={(e) => setItEmail(e.target.value)}
                  placeholder={t("organizations.contactEmail")}
                  dir="ltr"
                />
              </div>
            </div>

            {/* HR */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="font-semibold text-xs text-foreground uppercase tracking-wider">
                {t("organizations.hrContact")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PodaciumInput
                  label={t("organizations.contactName")}
                  value={hrName}
                  onChange={(e) => setHrName(e.target.value)}
                  placeholder={t("organizations.contactName")}
                />
                <PodaciumInput
                  label={t("organizations.contactEmail")}
                  value={hrEmail}
                  onChange={(e) => setHrEmail(e.target.value)}
                  placeholder={t("organizations.contactEmail")}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
              <PodaciumButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
              >
                {t("organizations.cancel")}
              </PodaciumButton>
              <PodaciumButton
                type="submit"
                variant="primary"
                size="sm"
                loading={isSubmitting}
              >
                {t("organizations.saveContacts")}
              </PodaciumButton>
            </div>
          </form>
        </PodaciumModal>
      )}
    </div>
  );
}

export default KeyCorporateContactsCard;
