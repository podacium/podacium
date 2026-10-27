"use client";

import React, { useEffect } from "react";
import { Command } from "cmdk";
import {
  Inbox,
  Send,
  Trash2,
  Archive,
  Star,
  Mail,
  Reply,
  Forward,
  Briefcase,
  Scale,
  LifeBuoy,
  FileText,
  ShieldCheck,
  Search,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface MailCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (actionKey: string, payload?: any) => void;
}

export function MailCommandPalette({
  isOpen,
  onClose,
  onAction,
}: MailCommandPaletteProps) {
  const t = useTranslations();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelect = (actionKey: string, payload?: any) => {
    onAction(actionKey, payload);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.mail.commandPalette.ariaLabel")}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/40 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="w-full" loop>
          <div className="flex items-center border-b border-border/60 px-4 py-3 gap-2.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Command.Input
              autoFocus
              placeholder={t("admin.mail.commandPalette.placeholder")}
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground text-foreground"
            />
            <kbd className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground border border-border">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="p-4 text-center text-xs text-muted-foreground">
              {t("admin.mail.commandPalette.empty")}
            </Command.Empty>

            <Command.Group
              heading={t("admin.mail.commandPalette.triageHotkeys")}
              className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 tracking-wider"
            >
              <Command.Item
                onSelect={() => handleSelect("reply")}
                className="flex items-center justify-between p-2 rounded-xl text-xs text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Reply className="w-3.5 h-3.5 text-blue-500" />{" "}
                  {t("admin.mail.commandPalette.replyThread")}
                </span>
                <kbd className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                  R
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect("reply_all")}
                className="flex items-center justify-between p-2 rounded-xl text-xs text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Reply className="w-3.5 h-3.5 text-indigo-500" />{" "}
                  {t("admin.mail.commandPalette.replyAll")}
                </span>
                <kbd className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                  A
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect("forward")}
                className="flex items-center justify-between p-2 rounded-xl text-xs text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Forward className="w-3.5 h-3.5 text-indigo-500" />{" "}
                  {t("admin.mail.commandPalette.forwardThread")}
                </span>
                <kbd className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                  F
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect("archive")}
                className="flex items-center justify-between p-2 rounded-xl text-xs text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Archive className="w-3.5 h-3.5 text-slate-500" />{" "}
                  {t("admin.mail.commandPalette.archiveThread")}
                </span>
                <kbd className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                  E
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect("trash")}
                className="flex items-center justify-between p-2 rounded-xl text-xs text-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />{" "}
                  {t("admin.mail.commandPalette.moveToTrash")}
                </span>
                <kbd className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                  #
                </kbd>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect("star")}
                className="flex items-center justify-between p-2 rounded-xl text-xs text-foreground hover:bg-amber-500/10 hover:text-amber-600 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Star className="w-3.5 h-3.5 text-amber-500" />{" "}
                  {t("admin.mail.commandPalette.toggleStar")}
                </span>
                <kbd className="font-mono text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                  S
                </kbd>
              </Command.Item>
            </Command.Group>

            <Command.Group
              heading={t("admin.mail.commandPalette.foldersMailboxes")}
              className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 mt-2 tracking-wider"
            >
              <Command.Item
                onSelect={() => handleSelect("goto_folder", "INBOX")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-secondary cursor-pointer"
              >
                <Inbox className="w-3.5 h-3.5 text-blue-500" />{" "}
                {t("admin.mail.commandPalette.jumpInbox")}
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("goto_folder", "SENT")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-secondary cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-500" />{" "}
                {t("admin.mail.commandPalette.jumpSent")}
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("goto_folder", "DRAFTS")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-secondary cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-amber-500" />{" "}
                {t("admin.mail.commandPalette.jumpDrafts")}
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("goto_folder", "ARCHIVE")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-secondary cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-slate-500" />{" "}
                {t("admin.mail.commandPalette.jumpArchive")}
              </Command.Item>
            </Command.Group>

            <Command.Group
              heading={t("admin.mail.commandPalette.platformQueues")}
              className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 mt-2 tracking-wider"
            >
              <Command.Item
                onSelect={() => handleSelect("filter_queue", "Contract")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-blue-500/10 hover:text-blue-600 cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />{" "}
                {t("admin.mail.commandPalette.filterContracts")}
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("filter_queue", "Dispute")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-amber-500/10 hover:text-amber-600 cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-amber-500" />{" "}
                {t("admin.mail.commandPalette.filterDisputes")}
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("filter_queue", "Ticket")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 cursor-pointer"
              >
                <LifeBuoy className="w-3.5 h-3.5 text-emerald-500" />{" "}
                {t("admin.mail.commandPalette.filterTickets")}
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("check_deliverability")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs text-foreground hover:bg-primary/10 hover:text-primary cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />{" "}
                {t("admin.mail.commandPalette.checkDeliverability")}
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

export default MailCommandPalette;
