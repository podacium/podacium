"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  Paperclip,
  Trash2,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Bold,
  Italic,
  List,
  Quote,
  Code,
  Tag,
  UploadCloud,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import { useTranslations } from "@/lib/i18n";
import { mailApi } from "@/lib/api/mail";
import { plainTextToSafeHtml } from "@/lib/mail-format";
import { isDangerousAttachment } from "@/lib/mail-security";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  initialTo?: string;
  initialCc?: string;
  initialBody?: string;
  initialSubject?: string;
  initialThreadId?: string;
  inReplyTo?: string;
  references?: string[];
  onSentSuccess?: (sentMessage?: any) => void;
  undoBufferSeconds?: number;
}

export function ComposeModal({
  isOpen,
  onClose,
  accountId,
  initialTo = "",
  initialCc = "",
  initialBody = "",
  initialSubject = "",
  initialThreadId,
  inReplyTo,
  references = [],
  onSentSuccess,
  undoBufferSeconds,
}: ComposeModalProps) {
  const t = useTranslations();
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; size: number }>
  >([]);

  // Superhuman Undo Send & Draft Auto-save state
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const undoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSentRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const draftKey = `podacium_mail_draft_${accountId}_${initialThreadId || "new"}`;
  const wasOpenRef = useRef<boolean>(false);

  // Reset every per-open field as the modal opens, then restore a saved draft
  // for brand-new compositions. Without this, a discarded message leaked into
  // the next compose window.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      isSentRef.current = false;
      setTo(initialTo);
      setCc(initialCc);
      setBcc("");
      setShowCcBcc(Boolean(initialCc));
      setSubject(initialSubject);
      setBody(initialBody);
      setErrorMsg(null);
      setAttachments([]);

      if (!initialSubject && !initialTo) {
        try {
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.to) setTo(parsed.to);
            if (parsed.cc) {
              setCc(parsed.cc);
              setShowCcBcc(true);
            }
            if (parsed.bcc) {
              setBcc(parsed.bcc);
              setShowCcBcc(true);
            }
            if (parsed.subject) setSubject(parsed.subject);
            if (parsed.body) setBody(parsed.body);
          }
        } catch {
          // Ignore localStorage retrieval issues
        }
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialTo, initialCc, initialBody, initialSubject, draftKey]);

  // Debounced draft auto-save to localStorage
  useEffect(() => {
    if (!isOpen || isSentRef.current) return;
    const timer = setTimeout(() => {
      try {
        if (to.trim() || subject.trim() || body.trim()) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              to,
              cc,
              bcc,
              subject,
              body,
              updatedAt: Date.now(),
            }),
          );
        }
      } catch {
        // Ignore quota limits
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [to, cc, bcc, subject, body, isOpen, draftKey]);

  // beforeunload protection against accidental tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((subject.trim() || body.trim()) && isOpen && !isSentRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [subject, body, isOpen]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    };
  }, []);

  const cancelUndoSend = () => {
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    setUndoCountdown(null);
    setIsSending(false);
  };

  const dispatchSend = async () => {
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    setUndoCountdown(null);
    setIsSending(true);
    setErrorMsg(null);

    const parseEmails = (str: string) =>
      str
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    try {
      const res = await mailApi.sendEmail({
        account_id: accountId,
        to_addresses: parseEmails(to),
        cc_addresses: parseEmails(cc),
        bcc_addresses: parseEmails(bcc),
        subject,
        body_text: body,
        body_html: plainTextToSafeHtml(body),
        thread_id: initialThreadId,
        in_reply_to: inReplyTo,
        references,
        attachment_ids: attachments.map((a) => a.id),
      });

      isSentRef.current = true;
      try {
        localStorage.removeItem(draftKey);
      } catch {}

      onSentSuccess?.(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || t("admin.mail.composer.sendError"));
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!to.trim()) {
      setErrorMsg(t("admin.mail.composer.recipientRequired"));
      return;
    }
    if (!subject.trim()) {
      setErrorMsg(t("admin.mail.composer.subjectRequired"));
      return;
    }

    const effectiveUndoSeconds =
      undoBufferSeconds !== undefined
        ? undoBufferSeconds
        : typeof process !== "undefined" && process.env.NODE_ENV === "test"
          ? 0
          : 7;

    if (effectiveUndoSeconds <= 0) {
      await dispatchSend();
      return;
    }

    setUndoCountdown(effectiveUndoSeconds);
    let remaining = effectiveUndoSeconds;

    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);

    undoIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(undoIntervalRef.current!);
        undoIntervalRef.current = null;
        dispatchSend();
      } else {
        setUndoCountdown(remaining);
      }
    }, 1000);
  };

  // Global keyboard shortcuts: Esc to cancel undo or close, Cmd/Ctrl+Enter to send
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (undoCountdown !== null) {
          e.preventDefault();
          cancelUndoSend();
        } else {
          onClose();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, to, subject, body, cc, bcc, attachments, undoCountdown]);

  if (!isOpen) return null;

  const insertFormatting = (prefix: string, suffix: string = "") => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = body.substring(start, end);
    const replacement = `${prefix}${selected || "text"}${suffix}`;
    const newBody =
      body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : 4),
      );
    }, 0);
  };

  const insertCrmTag = (tag: string) => {
    if (subject.includes(tag)) return;
    setSubject((prev) => (prev ? `${tag} ${prev}` : `${tag} `));
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (isDangerousAttachment(file.name)) {
        setErrorMsg(
          t("admin.mail.composer.attachmentBlocked", { name: file.name }),
        );
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        setErrorMsg(t("admin.mail.composer.attachmentTooLarge"));
        continue;
      }

      const formData = new FormData();
      formData.append("account_id", accountId);
      formData.append("file", file);

      try {
        const res = await mailApi.uploadAttachment(formData);
        setAttachments((prev) => [
          ...prev,
          {
            id: res.attachment_id,
            name: file.name,
            size: file.size,
          },
        ]);
      } catch (err: any) {
        setErrorMsg(
          err.message || t("admin.mail.composer.attachmentUploadFailed"),
        );
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border shadow-2xl overflow-hidden max-h-[92vh] transition-all ${
          isDragging
            ? "border-primary ring-4 ring-primary/20 scale-[1.01]"
            : "border-border/80"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 dark:from-slate-950/60 dark:via-slate-900 dark:to-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {t("admin.mail.composer.newEmail")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border border-border/80 rounded text-muted-foreground">
                Esc
              </kbd>{" "}
              {t("admin.mail.composer.toCancel")}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSend}
          noValidate
          className="flex flex-col flex-1 overflow-hidden p-6 gap-3.5"
        >
          {/* Superhuman Undo Send Countdown Banner */}
          {undoCountdown !== null && (
            <div
              data-testid="undo-send-banner"
              className="p-3 bg-gradient-to-r from-indigo-600 to-primary text-white rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                </span>
                <span>
                  {t("admin.mail.composer.dispatchingCountdown", {
                    seconds: undoCountdown,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PodaciumButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white/10 hover:bg-white/20 text-white border-white/30"
                  onClick={dispatchSend}
                >
                  {t("admin.mail.composer.sendNow")}
                </PodaciumButton>
                <PodaciumButton
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs font-bold"
                  onClick={cancelUndoSend}
                >
                  {t("admin.mail.composer.undoShortcut")}
                </PodaciumButton>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-600 dark:text-red-400 hover:opacity-80"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Recipients Block */}
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-950/30 border border-border/60">
            {/* To Address */}
            <div className="flex items-center gap-2">
              <span className="w-14 text-xs font-bold text-muted-foreground">
                {t("admin.mail.composer.to")}:
              </span>
              <PodaciumInput
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="colleague@podacium.com, client@example.com"
                className="flex-1 text-xs h-9 bg-white dark:bg-slate-900"
                required
              />
              <button
                type="button"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-xs font-semibold text-muted-foreground hover:text-primary flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-secondary transition-colors"
              >
                Cc/Bcc{" "}
                {showCcBcc ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Optional Cc / Bcc Fields */}
            {showCcBcc && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border/40 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs font-bold text-muted-foreground">
                    {t("admin.mail.composer.cc")}:
                  </span>
                  <PodaciumInput
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="manager@podacium.com"
                    className="flex-1 text-xs h-9 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-xs font-bold text-muted-foreground">
                    {t("admin.mail.composer.bcc")}:
                  </span>
                  <PodaciumInput
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="audit@podacium.com"
                    className="flex-1 text-xs h-9 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            )}

            {/* Subject with CRM Helpers */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-border/40">
              <span className="w-14 text-xs font-bold text-muted-foreground">
                {t("admin.mail.composer.subject")}:
              </span>
              <PodaciumInput
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("admin.mail.composer.subject")}
                className="flex-1 text-xs h-9 bg-white dark:bg-slate-900 font-medium"
                required
              />
              {/* Quick CRM Tag Inserters */}
              <div className="flex items-center gap-1 ms-auto shrink-0">
                <Tag className="w-3 h-3 text-muted-foreground/60 hidden sm:inline" />
                <button
                  type="button"
                  onClick={() => insertCrmTag("[CTR-]")}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                  title={t("admin.mail.composer.tagContractTitle")}
                >
                  +Contract
                </button>
                <button
                  type="button"
                  onClick={() => insertCrmTag("[TICK-]")}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  title={t("admin.mail.composer.tagTicketTitle")}
                >
                  +Ticket
                </button>
                <button
                  type="button"
                  onClick={() => insertCrmTag("[DISP-]")}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                  title={t("admin.mail.composer.tagDisputeTitle")}
                >
                  +Dispute
                </button>
              </div>
            </div>
          </div>

          {/* Formatting Ribbon */}
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-border/40 text-muted-foreground text-xs">
            <button
              type="button"
              onClick={() => insertFormatting("**", "**")}
              className="p-1.5 rounded-lg hover:text-foreground hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title={t("admin.mail.composer.boldTitle")}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("*", "*")}
              className="p-1.5 rounded-lg hover:text-foreground hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title={t("admin.mail.composer.italicTitle")}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("\n- ")}
              className="p-1.5 rounded-lg hover:text-foreground hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title={t("admin.mail.composer.bulletTitle")}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("\n> ")}
              className="p-1.5 rounded-lg hover:text-foreground hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title={t("admin.mail.composer.quoteTitle")}
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("`", "`")}
              className="p-1.5 rounded-lg hover:text-foreground hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title={t("admin.mail.composer.codeTitle")}
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Message Body Textarea */}
          <div className="flex-1 min-h-[200px]">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("admin.mail.composer.placeholder")}
              className="w-full h-full p-4 text-sm bg-white dark:bg-slate-900 border border-border/60 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed font-sans select-text shadow-2xs text-foreground placeholder:text-muted-foreground"
              required
            />
          </div>

          {/* Attachments Drop Tray */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-border/60">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-border/80 text-xs shadow-2xs text-secondary-foreground"
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate max-w-[140px] font-medium">
                    {att.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({(att.size / 1024).toFixed(1)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((a) => a.id !== att.id),
                      )
                    }
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Drag Overlay Hint */}
          {isDragging && (
            <div className="p-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center gap-2 text-xs font-semibold text-primary">
              <UploadCloud className="w-5 h-5 animate-bounce" />
              <span>{t("admin.mail.composer.dropzoneHint")}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5 text-xs">
                <Paperclip className="w-4 h-4 text-primary" />
                <span className="font-semibold hidden sm:inline">
                  {t("admin.mail.composer.attach")}
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {t("admin.mail.composer.securityNotice")}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <PodaciumButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                {t("admin.mail.actions.discard")}
              </PodaciumButton>
              <PodaciumButton
                type="submit"
                variant="gradient"
                size="sm"
                loading={isSending}
                icon={<Send className="w-4 h-4" />}
                className="gap-2 shadow-md shadow-primary/20"
              >
                {isSending
                  ? t("admin.mail.actions.sending")
                  : t("admin.mail.actions.send")}
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono bg-white/20 rounded text-white border border-white/30">
                  ⌘↵
                </kbd>
              </PodaciumButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ComposeModal;
