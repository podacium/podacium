"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import {
  ShieldCheck,
  Image as ImageIcon,
  Sun,
  Moon,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "next-themes";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import { useTranslations } from "@/lib/i18n";
import {
  auditLinkSecurity,
  auditSenderSecurity,
  LinkSecurityAudit,
} from "@/lib/mail-security";

interface SafeEmailViewerProps {
  htmlContent?: string | null;
  bodyText?: string | null;
  messageId: string;
  senderDisplayName?: string | null;
  senderEmail?: string | null;
}

// Ensure DOMPurify instance is properly initialized across Browser, JSDOM, and SSR environments
function getPurifier() {
  if (typeof window !== "undefined") {
    if (typeof DOMPurify.sanitize === "function") {
      return DOMPurify;
    }
    if (typeof (DOMPurify as any) === "function") {
      return (DOMPurify as any)(window);
    }
  }
  return null;
}

export function SafeEmailViewer({
  htmlContent,
  bodyText,
  messageId,
  senderDisplayName,
  senderEmail,
}: SafeEmailViewerProps) {
  const t = useTranslations();
  const { resolvedTheme } = useTheme();
  const isAppDark = resolvedTheme === "dark";

  const [interceptionLink, setInterceptionLink] =
    useState<LinkSecurityAudit | null>(null);

  // Sender authenticity and homograph spoofing audit
  const senderAudit = useMemo(() => {
    return auditSenderSecurity(senderDisplayName, senderEmail);
  }, [senderDisplayName, senderEmail]);

  // Rich HTML emails (e.g. GitHub CI/CD, newsletters) are authored with light paper contrast in mind
  const isRichEmail = useMemo(() => {
    return Boolean(
      htmlContent && /<(table|img|svg|hr|style|div class)/i.test(htmlContent),
    );
  }, [htmlContent]);

  // Allow manual toggle for emails that require light or dark paper contrast
  const [overrideTheme, setOverrideTheme] = useState<"dark" | "light" | null>(
    null,
  );
  const isDark =
    overrideTheme !== null
      ? overrideTheme === "dark"
      : isRichEmail
        ? false
        : isAppDark;

  const [loadRemoteImages, setLoadRemoteImages] = useState(false);
  const [hasBlockedImages, setHasBlockedImages] = useState(false);

  // Automatically detect Arabic script for BiDi / RTL text direction
  const isRTL = useMemo(() => {
    const sample = (htmlContent || bodyText || "").slice(0, 1000);
    return /[\u0600-\u06FF\u0750-\u077F]/.test(sample);
  }, [htmlContent, bodyText]);

  // Detect whether remote images or blocked images exist in the incoming email
  useEffect(() => {
    if (!htmlContent) {
      setHasBlockedImages(false);
      return;
    }
    const hasDataOriginal = htmlContent.includes("data-original-src");
    const hasRemoteSrc = /<img[^>]+src=["'](https?:|\/\/)/i.test(htmlContent);
    setHasBlockedImages(hasDataOriginal || hasRemoteSrc);
  }, [htmlContent]);

  // Safely prepare HTML with strict DOMPurify sanitization and proxy routing
  const sanitizedHtml = useMemo(() => {
    if (!htmlContent) return "";

    let content = htmlContent;

    // Resolve any CID references safely using encoded messageId and CID
    if (messageId && content.includes("cid:")) {
      content = content.replace(/src=["']cid:([^"']+)["']/gi, (_, rawCid) => {
        const cleanCid = rawCid.replace(/^<|>$/g, "");
        return `src="/api/v1/mail/messages/${encodeURIComponent(messageId)}/attachments/cid/${encodeURIComponent(cleanCid)}"`;
      });
    }

    // Remote images handling: unblock or block
    if (loadRemoteImages) {
      // Replace data-original-src with proxy or original src
      content = content.replace(/data-original-src="([^"]+)"/gi, 'src="$1"');
    } else {
      // Block any raw remote http/https src into data-original-src to eliminate tracking pixels
      content = content.replace(
        /<img([^>]+)src=["']((https?:|\/\/)[^"']+)["']([^>]*)>/gi,
        "<img$1src=\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' fill='none' stroke='%2394a3b8' stroke-width='2' viewBox='0 0 24 24'><rect width='18' height='18' x='3' y='3' rx='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>\" data-original-src=\"$2\"$4>",
      );
    }

    const purifier = getPurifier();
    if (!purifier) {
      return content;
    }

    // Strict DOMPurify sanitization per [CRITICAL-MAIL-01]
    const clean = purifier.sanitize(content, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: [
        "p",
        "br",
        "b",
        "i",
        "em",
        "strong",
        "a",
        "div",
        "span",
        "ul",
        "ol",
        "li",
        "table",
        "thead",
        "tbody",
        "tr",
        "td",
        "th",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "code",
        "pre",
        "hr",
        "img",
        "bdi",
        "bdo",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "class",
        "style",
        "target",
        "rel",
        "width",
        "height",
        "align",
        "valign",
        "border",
        "cellpadding",
        "cellspacing",
        "dir",
        "data-original-src",
      ],
      FORBID_TAGS: [
        "script",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "base",
        "svg",
        "math",
      ],
      FORBID_ATTR: [
        "onerror",
        "onload",
        "onclick",
        "onmouseover",
        "formaction",
        "action",
      ],
      ADD_ATTR: ["target", "rel"],
    });

    return clean;
  }, [htmlContent, loadRemoteImages, messageId]);

  // Safe link interceptor: inspects for deceptive link mismatches and opens safely
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (anchor) {
        const href = anchor.getAttribute("href") || "";
        const text = anchor.innerText || anchor.textContent || "";
        e.preventDefault();
        e.stopPropagation();

        if (/^(https?:)/i.test(href)) {
          const audit = auditLinkSecurity(text, href);
          if (audit.isMismatched) {
            setInterceptionLink(audit);
            return;
          }
          window.open(href, "_blank", "noopener,noreferrer");
        } else if (/^mailto:/i.test(href)) {
          window.location.href = href;
        }
      }
    },
    [],
  );

  if (!htmlContent && bodyText) {
    return (
      <div className="flex flex-col gap-2.5 w-full">
        {senderAudit.isSuspicious && (
          <div
            data-testid="sender-spoofing-alert"
            className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-900 dark:text-rose-200"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">
                {t("admin.mail.security.alertPrefix")}{" "}
              </span>
              <span>{senderAudit.warningMessage}</span>
            </div>
          </div>
        )}
        <div
          dir={isRTL ? "rtl" : "ltr"}
          className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 border border-border/80 text-sm whitespace-pre-wrap font-sans text-foreground leading-relaxed select-text shadow-2xs"
        >
          {bodyText}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Sender Spoofing & Phishing Alert Banner */}
      {senderAudit.isSuspicious && (
        <div
          data-testid="sender-spoofing-alert"
          className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-900 dark:text-rose-200"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">
              {t("admin.mail.security.alertPrefix")}{" "}
            </span>
            <span>{senderAudit.warningMessage}</span>
          </div>
        </div>
      )}

      {/* Controls ribbon: images blocker & paper theme contrast switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {hasBlockedImages && !loadRemoteImages ? (
          <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{t("admin.mail.security.imagesBlocked")}</span>
            </div>
            <PodaciumButton
              variant="outline"
              size="sm"
              className="h-7 text-xs border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/15"
              onClick={() => setLoadRemoteImages(true)}
              icon={<ImageIcon className="w-3.5 h-3.5" />}
            >
              {t("admin.mail.actions.loadRemoteImages")}
            </PodaciumButton>
          </div>
        ) : (
          <div />
        )}

        {htmlContent && (
          <PodaciumButton
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1.5 ms-auto"
            onClick={() => setOverrideTheme(isDark ? "light" : "dark")}
            icon={
              isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
              )
            }
          >
            {isDark
              ? t("admin.mail.viewer.lightPaper")
              : t("admin.mail.viewer.darkPaper")}
          </PodaciumButton>
        )}
      </div>

      {/* Full-length email paper container: naturally expands to 100% of the email's height */}
      <div
        data-testid="safe-email-viewer"
        role="region"
        aria-label={t("admin.mail.emailContent")}
        dir={isRTL ? "rtl" : "ltr"}
        className={`relative w-full rounded-2xl border border-border/80 shadow-xs transition-colors overflow-x-auto ${
          isDark
            ? "bg-slate-900 text-slate-100 dark-paper"
            : "bg-white text-slate-900 light-paper"
        }`}
        style={{ height: "auto", maxHeight: "none", overflowY: "visible" }}
      >
        <style>{`
          .podacium-email-paper {
            width: 100%;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 24px;
            font-family: ${isRTL ? "'Baloo Bhaijaan 2', 'Cairo', 'DejaVu Sans', 'Segoe UI', Tahoma, Arial, sans-serif" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"};
            font-size: 14px;
            line-height: 1.6;
            word-break: break-word;
            overflow-wrap: break-word;
            display: flow-root;
            direction: ${isRTL ? "rtl" : "ltr"};
            text-align: ${isRTL ? "right" : "left"};
          }
          .podacium-email-paper table {
            max-width: 100%;
            height: auto !important;
            max-height: none !important;
            border-collapse: collapse;
          }
          .podacium-email-paper tr,
          .podacium-email-paper td,
          .podacium-email-paper th,
          .podacium-email-paper tbody,
          .podacium-email-paper div {
            height: auto !important;
            max-height: none !important;
          }
          .podacium-email-paper img,
          .podacium-email-paper svg {
            max-width: 100%;
            height: auto;
            vertical-align: middle;
          }
          .podacium-email-paper a {
            color: ${isDark ? "#60a5fa" : "#2563eb"};
            text-decoration: underline;
            cursor: pointer;
          }
          .podacium-email-paper blockquote {
            border-inline-start: 3px solid ${isDark ? "#334155" : "#cbd5e1"};
            margin: 1em 0;
            padding-inline-start: 12px;
            color: ${isDark ? "#94a3b8" : "#64748b"};
          }
          .podacium-email-paper pre,
          .podacium-email-paper code {
            background-color: ${isDark ? "#1e293b" : "#f1f5f9"};
            color: ${isDark ? "#e2e8f0" : "#0f172a"};
            border-radius: 4px;
            padding: 2px 4px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            white-space: pre-wrap;
            word-break: break-word;
          }
        `}</style>

        <div
          className="podacium-email-paper select-text"
          style={{ height: "auto", maxHeight: "none", overflow: "visible" }}
          onClick={handleContainerClick}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </div>

      {interceptionLink && (
        <PodaciumModal
          isOpen={Boolean(interceptionLink)}
          onClose={() => setInterceptionLink(null)}
          title={t("admin.mail.security.deceptiveLinkTitle")}
          description={t("admin.mail.security.deceptiveLinkDesc")}
          size="md"
        >
          <div className="flex flex-col gap-4 py-2">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>{interceptionLink.warningMessage}</div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="text-muted-foreground">
                {t("admin.mail.security.displayedText")}
              </div>
              <div className="p-2 rounded bg-muted/40 font-mono text-foreground break-all select-all">
                {interceptionLink.displayedUrl}
              </div>
              <div className="text-muted-foreground pt-1">
                {t("admin.mail.security.actualDestination")}
              </div>
              <div className="p-2 rounded bg-muted/40 font-mono text-rose-600 dark:text-rose-400 break-all select-all">
                {interceptionLink.actualUrl}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={() => setInterceptionLink(null)}
              >
                {t("common.cancel")}
              </PodaciumButton>
              <PodaciumButton
                variant="destructive"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => {
                  window.open(
                    interceptionLink.actualUrl,
                    "_blank",
                    "noopener,noreferrer",
                  );
                  setInterceptionLink(null);
                }}
              >
                {t("admin.mail.security.openLinkAnyway")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>
      )}
    </div>
  );
}

export default SafeEmailViewer;
