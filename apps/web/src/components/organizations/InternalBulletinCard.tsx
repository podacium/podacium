"use client";

import React, { useState, useMemo } from "react";
import {
  Pin,
  Megaphone,
  BookOpen,
  GraduationCap,
  ShieldAlert,
  Link as LinkIcon,
  Plus,
  Edit3,
  Trash2,
  ExternalLink,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, OrganizationResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumTextarea from "@/components/design-system/PodaciumTextarea";
import PodaciumSwitch from "@/components/design-system/PodaciumSwitch";

export interface BulletinNotice {
  id: string;
  title: string;
  content: string;
  category: "ANNOUNCEMENT" | "WIKI" | "ONBOARDING" | "POLICY" | "LINK";
  pinned: boolean;
  link?: string;
  author?: string;
  createdAt: string;
}

interface InternalBulletinCardProps {
  organization: OrganizationResponse;
  canEdit: boolean;
  onUpdated?: () => void;
  className?: string;
}

/**
 * Lightweight safe Markdown/rich-text renderer for notices
 */
function MarkdownPreview({ content }: { content: string }) {
  const elements = useMemo(() => {
    if (!content) return null;
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Heading 1
      if (trimmed.startsWith("# ")) {
        return (
          <h4
            key={idx}
            className="text-base font-bold text-foreground mt-2 mb-1"
          >
            {trimmed.replace("# ", "")}
          </h4>
        );
      }
      // Heading 2
      if (trimmed.startsWith("## ")) {
        return (
          <h5
            key={idx}
            className="text-sm font-semibold text-foreground mt-1.5 mb-0.5"
          >
            {trimmed.replace("## ", "")}
          </h5>
        );
      }
      // Bullet list item
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const bulletText = trimmed.substring(2);
        return (
          <li
            key={idx}
            className="ms-4 list-disc text-xs text-muted-foreground my-0.5"
          >
            {renderInlineMarkdown(bulletText)}
          </li>
        );
      }
      // Blockquote
      if (trimmed.startsWith("> ")) {
        return (
          <div
            key={idx}
            className="border-s-2 border-primary/40 ps-3 my-1 italic text-xs text-muted-foreground"
          >
            {renderInlineMarkdown(trimmed.substring(2))}
          </div>
        );
      }

      // Standard paragraph
      return (
        <p
          key={idx}
          className="text-xs text-muted-foreground my-1 leading-relaxed"
        >
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  }, [content]);

  return <div className="space-y-0.5">{elements}</div>;
}

/**
 * Handles inline formatting: [link](url), **bold**, *italic*, `code`
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex to match links [label](url), **bold**, *italic*, `code`
  const linkRegex = /\[(.*?)\]\((.*?)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(parseFormatting(text.substring(lastIndex, match.index)));
    }
    const label = match[1];
    const url = match[2];
    parts.push(
      <a
        key={`link-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
      >
        <span>{label}</span>
        <ExternalLink className="w-3 h-3 inline" />
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(parseFormatting(text.substring(lastIndex)));
  }

  return parts.length > 0 ? parts : text;
}

function parseFormatting(text: string): React.ReactNode {
  // Bold **text**
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((bPart, bIdx) => {
    if (bPart.startsWith("**") && bPart.endsWith("**")) {
      return (
        <strong key={`b-${bIdx}`} className="font-semibold text-foreground">
          {bPart.slice(2, -2)}
        </strong>
      );
    }
    // Inline code `code`
    const codeParts = bPart.split(/(`.*?`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith("`") && cPart.endsWith("`")) {
        return (
          <code
            key={`c-${cIdx}`}
            className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground"
          >
            {cPart.slice(1, -1)}
          </code>
        );
      }
      return cPart;
    });
  });
}

export function InternalBulletinCard({
  organization,
  canEdit,
  onUpdated,
  className,
}: InternalBulletinCardProps) {
  const t = useTranslations();
  const { isRTL } = useBidi();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<BulletinNotice | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<BulletinNotice["category"]>("ANNOUNCEMENT");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [pinned, setPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse notices from organization.internalBulletin
  const notices: BulletinNotice[] = useMemo(() => {
    if (!organization.internalBulletin) {
      return [];
    }
    try {
      const parsed = JSON.parse(organization.internalBulletin);
      if (Array.isArray(parsed)) {
        // Sort: pinned notices first, then newest
        return parsed.sort((a: BulletinNotice, b: BulletinNotice) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
      return [];
    } catch {
      // If it's a raw markdown string, wrap it as a single announcement
      return [
        {
          id: "legacy-markdown-1",
          title: t("organizations.bulletinTitle"),
          content: organization.internalBulletin,
          category: "ANNOUNCEMENT",
          pinned: true,
          createdAt: organization.updatedAt || new Date().toISOString(),
        },
      ];
    }
  }, [organization.internalBulletin, organization.updatedAt, t]);

  const handleOpenAddModal = () => {
    setEditingNotice(null);
    setTitle("");
    setCategory("ANNOUNCEMENT");
    setContent("");
    setLink("");
    setPinned(false);
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (notice: BulletinNotice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setCategory(notice.category);
    setContent(notice.content);
    setLink(notice.link || "");
    setPinned(notice.pinned);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      let updatedNotices: BulletinNotice[];
      if (editingNotice) {
        updatedNotices = notices.map((n) =>
          n.id === editingNotice.id
            ? {
                ...n,
                title: title.trim(),
                category,
                content: content.trim(),
                link: link.trim() || undefined,
                pinned,
              }
            : n,
        );
      } else {
        const newNotice: BulletinNotice = {
          id: `notice-${Date.now()}`,
          title: title.trim(),
          category,
          content: content.trim(),
          link: link.trim() || undefined,
          pinned,
          createdAt: new Date().toISOString(),
        };
        updatedNotices = [newNotice, ...notices];
      }

      await api.updateOrganization(organization.id, {
        internalBulletin: JSON.stringify(updatedNotices),
      });

      setIsModalOpen(false);
      onUpdated?.();
    } catch (err: any) {
      console.error("Failed to save notice:", err);
      setError(err?.message || t("organizations.bulletinSaveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      setIsSubmitting(true);
      const filtered = notices.filter((n) => n.id !== id);
      await api.updateOrganization(organization.id, {
        internalBulletin: JSON.stringify(filtered),
      });
      onUpdated?.();
    } catch (err: any) {
      console.error("Failed to delete notice:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryBadge = (cat: BulletinNotice["category"]) => {
    switch (cat) {
      case "ANNOUNCEMENT":
        return (
          <PodaciumBadge
            variant="default"
            className="flex items-center gap-1 text-[11px]"
          >
            <Megaphone className="w-3 h-3" />
            <span>{t("organizations.categoryAnnouncement")}</span>
          </PodaciumBadge>
        );
      case "WIKI":
        return (
          <PodaciumBadge
            variant="outline"
            className="flex items-center gap-1 text-[11px]"
          >
            <BookOpen className="w-3 h-3" />
            <span>{t("organizations.categoryWiki")}</span>
          </PodaciumBadge>
        );
      case "ONBOARDING":
        return (
          <PodaciumBadge
            variant="success"
            className="flex items-center gap-1 text-[11px]"
          >
            <GraduationCap className="w-3 h-3" />
            <span>{t("organizations.categoryOnboarding")}</span>
          </PodaciumBadge>
        );
      case "POLICY":
        return (
          <PodaciumBadge
            variant="warning"
            className="flex items-center gap-1 text-[11px]"
          >
            <ShieldAlert className="w-3 h-3" />
            <span>{t("organizations.categoryPolicy")}</span>
          </PodaciumBadge>
        );
      case "LINK":
        return (
          <PodaciumBadge
            variant="secondary"
            className="flex items-center gap-1 text-[11px]"
          >
            <LinkIcon className="w-3 h-3" />
            <span>{t("organizations.categoryLink")}</span>
          </PodaciumBadge>
        );
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Pin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t("organizations.bulletinTitle")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("organizations.bulletinDesc")}
              </p>
            </div>
          </div>
        </div>

        {canEdit && (
          <PodaciumButton
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenAddModal}
          >
            {t("organizations.postNotice")}
          </PodaciumButton>
        )}
      </div>

      {/* Notices Pin-board */}
      {notices.length === 0 ? (
        <PodaciumCard className="py-12 px-4 text-center">
          <Pin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <h4 className="text-sm font-semibold text-foreground">
            {t("organizations.bulletinEmpty")}
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            {canEdit
              ? t("organizations.bulletinEmptyAdmin")
              : t("organizations.bulletinDesc")}
          </p>
          {canEdit && (
            <div className="mt-4">
              <PodaciumButton
                variant="outline"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleOpenAddModal}
              >
                {t("organizations.postNotice")}
              </PodaciumButton>
            </div>
          )}
        </PodaciumCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notices.map((notice) => (
            <PodaciumCard
              key={notice.id}
              className={cn(
                "p-5 flex flex-col justify-between transition-all",
                notice.pinned
                  ? "border-primary/40 bg-primary/[0.02] shadow-xs ring-1 ring-primary/10"
                  : "border-border",
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getCategoryBadge(notice.category)}
                    {notice.pinned && (
                      <PodaciumBadge
                        variant="warning"
                        className="flex items-center gap-1 text-[11px]"
                      >
                        <Pin className="w-3 h-3 rotate-45" />
                        <span>{t("organizations.pinnedBadge")}</span>
                      </PodaciumBadge>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-80 hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(notice)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={t("organizations.editNotice")}
                        aria-label={t("organizations.editNotice")}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title={t("organizations.deleteNotice")}
                        aria-label={t("organizations.deleteNotice")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-bold text-foreground mb-2">
                  {notice.title}
                </h4>

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownPreview content={notice.content} />
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Calendar className="w-3 h-3 opacity-70" />
                  <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
                </div>

                {notice.link && (
                  <a
                    href={notice.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    <span>{t("organizations.categoryLink")}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </PodaciumCard>
          ))}
        </div>
      )}

      {/* Notice Form Modal */}
      {isModalOpen && (
        <PodaciumModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={
            editingNotice
              ? t("organizations.editNotice")
              : t("organizations.postNotice")
          }
          size="lg"
        >
          <form onSubmit={handleSaveNotice} className="space-y-4 py-2">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                {error}
              </div>
            )}

            <div>
              <PodaciumInput
                label={t("organizations.noticeTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("organizations.noticeTitle")}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <PodaciumSelect
                  label={t("organizations.noticeCategory")}
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as BulletinNotice["category"])
                  }
                  options={[
                    {
                      value: "ANNOUNCEMENT",
                      label: t("organizations.categoryAnnouncement"),
                    },
                    {
                      value: "WIKI",
                      label: t("organizations.categoryWiki"),
                    },
                    {
                      value: "ONBOARDING",
                      label: t("organizations.categoryOnboarding"),
                    },
                    {
                      value: "POLICY",
                      label: t("organizations.categoryPolicy"),
                    },
                    {
                      value: "LINK",
                      label: t("organizations.categoryLink"),
                    },
                  ]}
                />
              </div>

              <div>
                <PodaciumInput
                  label={t("organizations.noticeLink")}
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://wiki.internal/onboarding"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <PodaciumTextarea
                label={t("organizations.noticeContent")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("organizations.noticeContent")}
                rows={6}
                required
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
              <span className="text-xs font-medium text-foreground">
                {t("organizations.noticePinned")}
              </span>
              <PodaciumSwitch checked={pinned} onChange={setPinned} />
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
              <PodaciumButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                {t("organizations.cancel")}
              </PodaciumButton>
              <PodaciumButton
                type="submit"
                variant="primary"
                size="sm"
                loading={isSubmitting}
              >
                {t("organizations.saveBulletin")}
              </PodaciumButton>
            </div>
          </form>
        </PodaciumModal>
      )}
    </div>
  );
}

export default InternalBulletinCard;
