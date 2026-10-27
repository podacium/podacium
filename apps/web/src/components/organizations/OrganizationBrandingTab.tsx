"use client";

import React, { useState, useEffect } from "react";
import {
  Globe,
  Image,
  Palette,
  Share2,
  Check,
  AlertCircle,
  Building2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { api, OrganizationResponse } from "@/lib/api";

import PodaciumCard from "@/components/design-system/PodaciumCard";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

export interface OrganizationBrandingTabProps {
  organization: OrganizationResponse;
  isAdminOrOwner?: boolean;
  onUpdated?: () => void;
}

export function OrganizationBrandingTab({
  organization,
  isAdminOrOwner = true,
  onUpdated,
}: OrganizationBrandingTabProps) {
  const t = useTranslations();

  // Form states
  const socialLinksObj =
    typeof organization.socialLinks === "object"
      ? organization.socialLinks || {}
      : {};

  const [avatarUrl, setAvatarUrl] = useState<string>(
    socialLinksObj?.avatarUrl || socialLinksObj?.logoUrl || "",
  );
  const [coverBannerUrl, setCoverBannerUrl] = useState<string>(
    organization.coverBannerUrl || "",
  );
  const [tagline, setTagline] = useState<string>(organization.tagline || "");
  const [brandAccentColor, setBrandAccentColor] = useState<string>(
    organization.brandAccentColor || "#1B4D3E",
  );
  const [linkedin, setLinkedin] = useState<string>(
    socialLinksObj?.linkedin || "",
  );
  const [xTwitter, setXTwitter] = useState<string>(
    socialLinksObj?.x || socialLinksObj?.twitter || "",
  );
  const [github, setGithub] = useState<string>(socialLinksObj?.github || "");
  const [facebook, setFacebook] = useState<string>(
    socialLinksObj?.facebook || "",
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sl =
      typeof organization.socialLinks === "object"
        ? organization.socialLinks || {}
        : {};
    setAvatarUrl(sl?.avatarUrl || sl?.logoUrl || "");
    setCoverBannerUrl(organization.coverBannerUrl || "");
    setTagline(organization.tagline || "");
    setBrandAccentColor(organization.brandAccentColor || "#1B4D3E");
    setLinkedin(sl?.linkedin || "");
    setXTwitter(sl?.x || sl?.twitter || "");
    setGithub(sl?.github || "");
    setFacebook(sl?.facebook || "");
  }, [organization]);

  const taglineLength = tagline.length;
  const isTaglineTooLong = taglineLength > 160;

  const handleColorChange = (hex: string) => {
    // Validate hex
    if (/^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
      setBrandAccentColor(hex);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrOwner) return;

    if (isTaglineTooLong) {
      setError(t("organizations.branding.taglineTooLong"));
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const updatedSocialLinks = {
        ...socialLinksObj,
        avatarUrl: avatarUrl.trim() || undefined,
        logoUrl: avatarUrl.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        x: xTwitter.trim() || undefined,
        twitter: xTwitter.trim() || undefined,
        github: github.trim() || undefined,
        facebook: facebook.trim() || undefined,
      };

      const payload = {
        tagline: tagline.trim() || undefined,
        brandAccentColor: brandAccentColor || "#1B4D3E",
        coverBannerUrl: coverBannerUrl.trim() || undefined,
        socialLinks: updatedSocialLinks,
      };

      await api.updateOrganization(organization.id, payload);
      toast.success(t("organizations.branding.brandingSavedSuccess"));
      onUpdated?.();
    } catch (err: any) {
      console.error("Failed to save branding:", err);
      setError(err?.message || t("organizations.branding.brandingSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pt-4" data-testid="organization-branding-tab">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-foreground">
          {t("organizations.branding.formTitle")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("organizations.branding.formSubtitle")}
        </p>
      </div>

      {/* Live Brand Preview Card */}
      <PodaciumCard className="overflow-hidden border border-border/80">
        <div
          className="h-28 w-full bg-muted/60 relative overflow-hidden"
          style={{
            backgroundColor: brandAccentColor
              ? `${brandAccentColor}20`
              : undefined,
            backgroundImage: coverBannerUrl
              ? `url(${coverBannerUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
          <div className="absolute top-3 end-3 flex items-center gap-1.5">
            <PodaciumBadge
              variant="outline"
              className="text-[10px] bg-background/80 backdrop-blur-xs font-mono"
            >
              <Eye className="w-3 h-3 me-1 inline-block" />
              {t("organizations.branding.livePreviewBadge")}
            </PodaciumBadge>
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 mb-4">
            <div className="flex items-end gap-3.5">
              <div
                className="w-20 h-20 rounded-2xl border-2 border-background bg-card text-foreground flex items-center justify-center overflow-hidden shadow-md shrink-0"
                style={{
                  borderColor: brandAccentColor || "#1B4D3E",
                }}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={organization.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground opacity-60" />
                )}
              </div>

              <div>
                <h4 className="text-xl font-bold text-foreground">
                  {organization.name}
                </h4>
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  {tagline || t("organizations.branding.taglinePlaceholder")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4 h-4 rounded-full border border-border shadow-xs"
                style={{ backgroundColor: brandAccentColor }}
              />
              <span className="font-mono text-xs text-muted-foreground font-semibold">
                {brandAccentColor}
              </span>
            </div>
          </div>
        </div>
      </PodaciumCard>

      {/* Editing Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <PodaciumCard className="p-6 space-y-5">
          {/* Tagline */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                {t("organizations.branding.tagline")}
              </label>
              <span
                className={cn(
                  "text-[11px] font-mono",
                  isTaglineTooLong
                    ? "text-destructive font-bold"
                    : "text-muted-foreground",
                )}
              >
                {t("organizations.branding.taglineCharCount").replace(
                  "{count}",
                  String(taglineLength),
                )}
              </span>
            </div>

            <input
              type="text"
              maxLength={160}
              value={tagline}
              disabled={!isAdminOrOwner}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={t("organizations.branding.taglinePlaceholder")}
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
            />
          </div>

          {/* Logo & Banner URLs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t("organizations.branding.avatarUrl")}</span>
              </label>
              <input
                type="url"
                value={avatarUrl}
                disabled={!isAdminOrOwner}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder={t("organizations.branding.avatarUrlPlaceholder")}
                className="w-full h-10 px-3.5 text-xs font-mono rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t("organizations.branding.coverBannerUrl")}</span>
              </label>
              <input
                type="url"
                value={coverBannerUrl}
                disabled={!isAdminOrOwner}
                onChange={(e) => setCoverBannerUrl(e.target.value)}
                placeholder={t("organizations.branding.coverBannerPlaceholder")}
                className="w-full h-10 px-3.5 text-xs font-mono rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Brand Accent Color */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t("organizations.branding.brandAccentColor")}</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                {t("organizations.branding.brandAccentColorDesc")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-border shadow-xs shrink-0 cursor-pointer">
                <input
                  type="color"
                  value={
                    brandAccentColor.startsWith("#")
                      ? brandAccentColor
                      : "#1B4D3E"
                  }
                  disabled={!isAdminOrOwner}
                  onChange={(e) => setBrandAccentColor(e.target.value)}
                  className="absolute -inset-2 w-14 h-14 cursor-pointer opacity-0"
                />
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: brandAccentColor }}
                />
              </div>

              <input
                type="text"
                value={brandAccentColor}
                disabled={!isAdminOrOwner}
                onChange={(e) => handleColorChange(e.target.value)}
                placeholder="#1B4D3E"
                maxLength={7}
                className="w-36 h-10 px-3 text-xs font-mono font-bold rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary uppercase"
              />

              {/* Sample palette pills */}
              <div className="flex items-center gap-1.5 ms-2 overflow-x-auto">
                {[
                  "#1B4D3E",
                  "#2563EB",
                  "#7C3AED",
                  "#D97706",
                  "#DC2626",
                  "#0F172A",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={!isAdminOrOwner}
                    onClick={() => setBrandAccentColor(c)}
                    className={cn(
                      "w-6 h-6 rounded-full border border-border/80 transition-transform hover:scale-110",
                      brandAccentColor === c &&
                        "ring-2 ring-primary ring-offset-2",
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Social Profiles */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              <span>{t("organizations.branding.socialLinksTitle")}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t("organizations.branding.linkedin")}
                </label>
                <input
                  type="url"
                  value={linkedin}
                  disabled={!isAdminOrOwner}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder={t("organizations.branding.linkedinPlaceholder")}
                  className="w-full h-9 mt-1 px-3 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t("organizations.branding.xTwitter")}
                </label>
                <input
                  type="url"
                  value={xTwitter}
                  disabled={!isAdminOrOwner}
                  onChange={(e) => setXTwitter(e.target.value)}
                  placeholder={t("organizations.branding.xTwitterPlaceholder")}
                  className="w-full h-9 mt-1 px-3 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t("organizations.branding.github")}
                </label>
                <input
                  type="url"
                  value={github}
                  disabled={!isAdminOrOwner}
                  onChange={(e) => setGithub(e.target.value)}
                  placeholder={t("organizations.branding.githubPlaceholder")}
                  className="w-full h-9 mt-1 px-3 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {t("organizations.branding.facebook")}
                </label>
                <input
                  type="url"
                  value={facebook}
                  disabled={!isAdminOrOwner}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder={t("organizations.branding.facebookPlaceholder")}
                  className="w-full h-9 mt-1 px-3 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive pt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isAdminOrOwner && (
            <div className="pt-3 border-t border-border flex justify-end">
              <PodaciumButton
                type="submit"
                variant="primary"
                glow
                loading={isSaving}
                icon={<Check className="w-4 h-4" />}
                data-testid="save-branding-btn"
              >
                {isSaving
                  ? t("organizations.branding.savingBranding")
                  : t("organizations.branding.saveBranding")}
              </PodaciumButton>
            </div>
          )}
        </PodaciumCard>
      </form>
    </div>
  );
}

export default OrganizationBrandingTab;
