"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { toast } from "sonner";
import {
  Inbox,
  Send,
  FileText,
  Star,
  Archive,
  Trash2,
  AlertOctagon,
  RefreshCw,
  Search,
  PenSquare,
  ArrowLeft,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Keyboard,
  X,
  Maximize2,
  Quote,
  Bold,
  Italic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Briefcase,
  LifeBuoy,
  Scale,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useFormatDate } from "@/lib/date-utils";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import { useTranslations } from "@/lib/i18n";
import { useWebSocket } from "@/hooks/useWebSocket";
import { mailApi, MailAccount, MailThread, Mailbox } from "@/lib/api/mail";
import type { DeliverabilityDiagnostics } from "@/lib/api/mail";
import SafeEmailViewer from "./SafeEmailViewer";
import CrmContextDrawer from "./CrmContextDrawer";
import ComposeModal from "./ComposeModal";
import MailCommandPalette from "./MailCommandPalette";
import { plainTextToSafeHtml } from "@/lib/mail-format";

function deliverabilityBadgeVariant(
  status?: string,
): "success" | "warning" | "destructive" | "outline" {
  if (status === "PASS") return "success";
  if (status === "WARNING") return "warning";
  if (status === "FAIL") return "destructive";
  return "outline";
}

function deliverabilityDotClass(status?: string): string {
  if (status === "PASS") return "bg-emerald-500";
  if (status === "WARNING") return "bg-amber-500";
  if (status === "FAIL") return "bg-red-500";
  return "bg-slate-400";
}

export function MailSuiteWorkspace() {
  const t = useTranslations("admin");
  const { formatRelativeTime } = useFormatDate();

  // State
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string>("INBOX");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const [threadsPage, setThreadsPage] = useState(1);
  const [hasMoreThreads, setHasMoreThreads] = useState(false);
  const [isLoadingMoreThreads, setIsLoadingMoreThreads] = useState(false);
  const [filterTab, setFilterTab] = useState<"ALL" | "UNREAD" | "STARRED">(
    "ALL",
  );

  const [threads, setThreads] = useState<MailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<MailThread | null>(null);

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{
    initialTo?: string;
    initialCc?: string;
    initialSubject?: string;
    initialThreadId?: string;
    inReplyTo?: string;
    references?: string[];
    initialBody?: string;
  }>({});
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDeliverabilityModalOpen, setIsDeliverabilityModalOpen] =
    useState(false);
  const [deliverability, setDeliverability] =
    useState<DeliverabilityDiagnostics | null>(null);
  const [deliverabilityError, setDeliverabilityError] = useState<string | null>(
    null,
  );
  const [isLoadingDeliverability, setIsLoadingDeliverability] = useState(false);
  const [isCrmDrawerOpen, setIsCrmDrawerOpen] = useState(false);
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(false);
  const [isEmptyTrashConfirmOpen, setIsEmptyTrashConfirmOpen] = useState(false);
  const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [isPurgingThread, setIsPurgingThread] = useState(false);

  // Load Deliverability Diagnostics
  const fetchDeliverability = useCallback(async () => {
    try {
      setIsLoadingDeliverability(true);
      setDeliverabilityError(null);
      const diag = await mailApi.getDeliverabilityDiagnostics();
      setDeliverability(diag);
    } catch (err) {
      console.warn("Failed to load deliverability diagnostics:", err);
      // Fail closed: keep the previous data (if any) but surface the error so
      // the UI can never imply "PASS" when DNS could not be checked.
      setDeliverabilityError("unavailable");
    } finally {
      setIsLoadingDeliverability(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliverability();
  }, [fetchDeliverability]);

  const deliverabilityChecks = useMemo(() => {
    if (!deliverability) return [];
    const dkimSelectors = Object.entries(
      deliverability.dkim?.selectors || {},
    ).map(([selector, info]) => ({
      selector,
      ...info,
    }));
    return [
      {
        key: "spf",
        label: t("admin.mail.deliverability.spfRecord"),
        status: deliverability.spf?.status,
        detail: deliverability.spf?.policy || "",
        record: deliverability.spf?.record || null,
        warnings: deliverability.spf?.warnings || [],
      },
      {
        key: "dkim",
        label: t("admin.mail.deliverability.dkimSignature"),
        status: deliverability.dkim?.status,
        detail: dkimSelectors
          .map(
            (item) =>
              `${item.selector}: ${
                item.valid ? `${item.key_length_bits}-bit` : "missing"
              }`,
          )
          .join(" · "),
        record:
          dkimSelectors
            .map((item) => item.record)
            .filter(Boolean)
            .join("\n") || null,
        warnings: deliverability.dkim?.warnings || [],
      },
      {
        key: "dmarc",
        label: t("admin.mail.deliverability.dmarcPolicy"),
        status: deliverability.dmarc?.status,
        detail: deliverability.dmarc?.policy
          ? `p=${deliverability.dmarc.policy}${
              deliverability.dmarc.rua
                ? ` · rua=${deliverability.dmarc.rua}`
                : ""
            }`
          : "",
        record: deliverability.dmarc?.record || null,
        warnings: deliverability.dmarc?.warnings || [],
      },
      {
        key: "mx",
        label: t("admin.mail.deliverability.mxRouting"),
        status: deliverability.mx?.status,
        detail: t("admin.mail.deliverability.mxDesc"),
        record:
          (deliverability.mx?.records || [])
            .map((record) => `${record.preference} ${record.host}`)
            .join("\n") || null,
        warnings: deliverability.mx?.warnings || [],
      },
    ];
  }, [deliverability, t]);

  // Restore CRM drawer open preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("podacium_mail_crm_drawer_open");
      if (saved !== null) {
        setIsCrmDrawerOpen(saved === "true");
      }
    } catch {
      // Ignore localStorage errors in restricted environments
    }
  }, []);

  const handleToggleCrmDrawer = () => {
    setIsCrmDrawerOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("podacium_mail_crm_drawer_open", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Message accordion expansion state
  const [expandedMessageIds, setExpandedMessageIds] = useState<
    Record<string, boolean>
  >({});

  const [otherAdmins, setOtherAdmins] = useState<
    Array<{
      admin_id: number;
      admin_name: string;
      admin_email: string;
      status: string;
    }>
  >([]);
  const [quickReplyBody, setQuickReplyBody] = useState("");
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);
  const quickReplyRef = useRef<HTMLTextAreaElement>(null);

  // Mobile navigation state
  const [mobileView, setMobileView] = useState<
    "folders" | "threads" | "detail"
  >("threads");

  // Load Accounts
  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoadingAccounts(true);
      const accs = await mailApi.listAccounts();
      setAccounts(accs);
      if (accs.length > 0) {
        setSelectedAccountId((prev) => prev || accs[0].account_id);
      }
    } catch (err) {
      console.error("Failed to load mail accounts:", err);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Debounce search so each keystroke does not hit the API.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Load Threads for selected account and folder
  const fetchThreads = useCallback(
    async (
      folderOverride?: string,
      selectTargetThreadId?: string,
      silent = false,
    ) => {
      if (!selectedAccountId) return;
      const folderToFetch = folderOverride || selectedFolder;
      try {
        if (!silent) setIsLoadingThreads(true);
        const res = await mailApi.listThreads(
          selectedAccountId,
          folderToFetch,
          debouncedSearchQuery,
          1,
          50,
        );
        setThreads(res.threads || []);
        setThreadsPage(res.page || 1);
        setHasMoreThreads(Boolean(res.has_more));
        if (selectTargetThreadId) {
          setSelectedThreadId(selectTargetThreadId);
        } else if (res.threads.length > 0) {
          // Only auto-select on large screens; never clobber a manual choice.
          setSelectedThreadId((prev) => {
            if (prev) return prev;
            return typeof window !== "undefined" && window.innerWidth >= 1024
              ? res.threads[0].thread_id
              : null;
          });
        }
      } catch (err) {
        console.error("Failed to load threads:", err);
      } finally {
        if (!silent) setIsLoadingThreads(false);
      }
    },
    [selectedAccountId, selectedFolder, debouncedSearchQuery],
  );

  const loadMoreThreads = useCallback(async () => {
    if (!selectedAccountId || isLoadingMoreThreads || !hasMoreThreads) return;
    try {
      setIsLoadingMoreThreads(true);
      const nextPage = threadsPage + 1;
      const res = await mailApi.listThreads(
        selectedAccountId,
        selectedFolder,
        debouncedSearchQuery,
        nextPage,
        50,
      );
      setThreads((prev) => {
        const seen = new Set(prev.map((item) => item.thread_id));
        return [
          ...prev,
          ...(res.threads || []).filter((item) => !seen.has(item.thread_id)),
        ];
      });
      setThreadsPage(nextPage);
      setHasMoreThreads(Boolean(res.has_more));
    } catch (err) {
      console.error("Failed to load more threads:", err);
    } finally {
      setIsLoadingMoreThreads(false);
    }
  }, [
    selectedAccountId,
    selectedFolder,
    debouncedSearchQuery,
    threadsPage,
    hasMoreThreads,
    isLoadingMoreThreads,
  ]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Periodic polling to auto-actualize inbox every 15 seconds silently
  useEffect(() => {
    if (!selectedAccountId) return;
    const interval = setInterval(() => {
      fetchThreads(undefined, undefined, true);
      fetchAccounts();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchThreads, fetchAccounts, selectedAccountId]);

  // Real-time synchronization via WebSocket push bus
  useWebSocket({
    onNotification: useCallback(
      (data: any) => {
        if (
          data?.type === "MAIL_SYNC" ||
          data?.type === "NEW_EMAIL" ||
          data?.action === "mail_sync"
        ) {
          fetchAccounts();
          fetchThreads();
        } else if (data?.type === "mail_presence") {
          if (data.thread_id === selectedThreadId) {
            setOtherAdmins((prev) => {
              const existingIdx = prev.findIndex(
                (a) => a.admin_id === data.admin_id,
              );
              const item = {
                admin_id: data.admin_id,
                admin_name: data.admin_name,
                admin_email: data.admin_email || "",
                status: data.status,
              };
              if (existingIdx >= 0) {
                const copy = [...prev];
                copy[existingIdx] = item;
                return copy;
              }
              return [...prev, item];
            });
          }
        }
      },
      [fetchAccounts, fetchThreads, selectedThreadId],
    ),
  });

  // Load Thread Detail
  const fetchThreadDetail = useCallback(async (threadId: string) => {
    try {
      setIsLoadingDetail(true);
      const thread = await mailApi.getThread(threadId);
      setSelectedThread(thread);

      // Auto-expand the latest message, keep older messages collapsed if multiple
      if (thread.messages && thread.messages.length > 0) {
        const latestId = thread.messages[thread.messages.length - 1].message_id;
        setExpandedMessageIds({ [latestId]: true });
      }

      // Mark as read in local list optimistically
      setThreads((prev) =>
        prev.map((t) =>
          t.thread_id === threadId ? { ...t, is_unread: false } : t,
        ),
      );
    } catch (err) {
      console.error("Failed to load thread detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedThreadId) {
      fetchThreadDetail(selectedThreadId);
    } else {
      setSelectedThread(null);
    }
  }, [selectedThreadId, fetchThreadDetail]);

  // On-demand Sync
  const handleSync = async () => {
    if (!selectedAccountId) return;
    setIsSyncing(true);
    try {
      await mailApi.syncAccount(selectedAccountId);
      toast.success(t("admin.mail.syncSuccess"));
    } catch (err) {
      // A failed sync is not a success: report it instead of masking it.
      console.warn("Manual sync failed:", err);
      toast.error(t("admin.mail.syncFailed"));
    } finally {
      await fetchAccounts();
      await fetchThreads(undefined, undefined, true);
      setIsSyncing(false);
    }
  };

  // Presence heartbeat & collision detector. Drafting state is read through a
  // ref so typing does not tear down/recreate the polling effect.
  const isDraftingRef = useRef(false);
  useEffect(() => {
    isDraftingRef.current = quickReplyBody.trim().length > 0;
  }, [quickReplyBody]);

  useEffect(() => {
    if (!selectedThreadId) {
      setOtherAdmins([]);
      return;
    }

    const pollPresence = async () => {
      try {
        await mailApi.sendPresence(
          selectedThreadId,
          isDraftingRef.current ? "drafting" : "viewing",
        );
        const res = await mailApi.getPresence(selectedThreadId);
        setOtherAdmins(res.active_admins || []);
      } catch {
        /* ignore polling errors */
      }
    };

    pollPresence();
    const interval = setInterval(pollPresence, 10000);
    return () => clearInterval(interval);
  }, [selectedThreadId]);

  // Thread Actions with 10s Undo window
  const handleThreadAction = async (
    action: "archive" | "trash" | "star" | "unstar" | "restore" | "purge",
  ) => {
    if (!selectedThreadId) return;

    try {
      await mailApi.executeThreadAction(selectedThreadId, action);

      if (
        action === "archive" ||
        action === "trash" ||
        action === "restore" ||
        action === "purge"
      ) {
        const removedId = selectedThreadId;
        setThreads((prev) => prev.filter((t) => t.thread_id !== removedId));
        setSelectedThreadId(null);
        setSelectedThread(null);

        if (action === "restore") {
          toast.success(t("admin.mail.actions.restored"));
        } else if (action === "purge") {
          toast.success(t("admin.mail.actions.purged"));
        } else {
          toast(
            action === "archive"
              ? t("admin.mail.actions.archived")
              : t("admin.mail.actions.deleted"),
            {
              description: t("admin.mail.actions.undoHint"),
              action: {
                label: t("admin.mail.actions.undo"),
                onClick: async () => {
                  try {
                    await mailApi.executeThreadAction(removedId, "restore");
                    await fetchThreads();
                  } catch {
                    /* ignore */
                  }
                },
              },
            },
          );
        }
      } else if (action === "star") {
        setSelectedThread((prev) =>
          prev ? { ...prev, is_starred: true } : null,
        );
        setThreads((prev) =>
          prev.map((t) =>
            t.thread_id === selectedThreadId ? { ...t, is_starred: true } : t,
          ),
        );
      } else if (action === "unstar") {
        setSelectedThread((prev) =>
          prev ? { ...prev, is_starred: false } : null,
        );
        setThreads((prev) =>
          prev.map((t) =>
            t.thread_id === selectedThreadId ? { ...t, is_starred: false } : t,
          ),
        );
      }
    } catch (err) {
      console.error(`Failed action ${action}:`, err);
    }
  };

  const handleEmptyTrash = async () => {
    if (!selectedAccountId) return;
    try {
      setIsEmptyingTrash(true);
      const res = await mailApi.emptyTrash(selectedAccountId);
      setThreads([]);
      setSelectedThreadId(null);
      setSelectedThread(null);
      setIsEmptyTrashConfirmOpen(false);
      toast.success(
        t("admin.mail.actions.emptiedTrashCount", {
          count: res.purged_messages ?? 0,
        }),
      );
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to empty trash:", err);
      toast.error(t("admin.mail.actions.emptyTrashError"));
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  const handlePurgeThread = async () => {
    if (!selectedThreadId) return;
    try {
      setIsPurgingThread(true);
      await mailApi.executeThreadAction(selectedThreadId, "purge");
      const removedId = selectedThreadId;
      setThreads((prev) => prev.filter((t) => t.thread_id !== removedId));
      setSelectedThreadId(null);
      setSelectedThread(null);
      setIsPurgeConfirmOpen(false);
      toast.success(t("admin.mail.actions.purged"));
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to permanently delete thread:", err);
      toast.error(t("admin.mail.actions.purgeError"));
    } finally {
      setIsPurgingThread(false);
    }
  };

  const handleSendQuickReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickReplyBody.trim() || !selectedThread || !selectedAccount) return;

    const messages = selectedThread.messages || [];
    const latestMsg = messages[messages.length - 1];
    if (!latestMsg) return;

    // Reply to the last *inbound* message, not to our own outbound copy.
    const accountEmail = selectedAccount.email_address.toLowerCase();
    const inbound = messages.filter(
      (msg) => msg.from_address?.toLowerCase() !== accountEmail,
    );
    const replyTarget = inbound[inbound.length - 1] || latestMsg;

    const references = messages
      .map((msg) => msg.internet_message_id)
      .filter((id): id is string => Boolean(id))
      .slice(-20);

    setIsSendingQuickReply(true);

    try {
      await mailApi.sendEmail({
        account_id: selectedAccount.account_id,
        to_addresses: [replyTarget.from_address],
        subject: /^re:/i.test(selectedThread.subject)
          ? selectedThread.subject
          : `Re: ${selectedThread.subject}`,
        body_text: quickReplyBody,
        body_html: plainTextToSafeHtml(quickReplyBody),
        thread_id: selectedThread.thread_id,
        in_reply_to: replyTarget.internet_message_id || undefined,
        references,
      });
      setQuickReplyBody("");
      toast.success(t("admin.mail.replySent"));
      await fetchThreadDetail(selectedThread.thread_id);
    } catch (err) {
      console.error("Quick reply failed:", err);
      toast.error(t("admin.mail.replyFailed"));
    } finally {
      setIsSendingQuickReply(false);
    }
  };

  const handleQuoteLatestMessage = () => {
    if (!selectedThread?.messages?.length) return;
    const latest = selectedThread.messages[selectedThread.messages.length - 1];
    const quoteText = (latest.body_text || latest.snippet || "")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    setQuickReplyBody((prev) =>
      prev ? `${prev}\n\n${quoteText}\n` : `${quoteText}\n`,
    );
    quickReplyRef.current?.focus();
  };

  // Open the composer with an explicit intent (new / reply / reply-all / forward).
  const openCompose = useCallback(
    (mode: "new" | "reply" | "reply_all" | "forward") => {
      const account = accounts.find((a) => a.account_id === selectedAccountId);
      const messages = selectedThread?.messages || [];
      if (mode === "new" || !selectedThread || !account) {
        setComposeDefaults({});
        setIsComposeOpen(true);
        return;
      }

      const accountEmail = account.email_address.toLowerCase();
      const inbound = messages.filter(
        (msg) => (msg.from_address || "").toLowerCase() !== accountEmail,
      );
      const target =
        inbound[inbound.length - 1] || messages[messages.length - 1];
      const references = messages
        .map((msg) => msg.internet_message_id)
        .filter((id): id is string => Boolean(id))
        .slice(-20);

      const subject = selectedThread.subject || "";
      const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;

      if (mode === "reply") {
        setComposeDefaults({
          initialTo: target?.from_address,
          initialSubject: replySubject,
          initialThreadId: selectedThread.thread_id,
          inReplyTo: target?.internet_message_id || undefined,
          references,
        });
      } else if (mode === "reply_all") {
        const recipients = new Set<string>();
        if (target?.from_address) recipients.add(target.from_address);
        for (const address of target?.to_addresses || []) {
          if (address.toLowerCase() !== accountEmail) recipients.add(address);
        }
        const ccRecipients = (target?.cc_addresses || []).filter(
          (address) => address.toLowerCase() !== accountEmail,
        );
        setComposeDefaults({
          initialTo: [...recipients].join(", "),
          initialCc: ccRecipients.join(", "),
          initialSubject: replySubject,
          initialThreadId: selectedThread.thread_id,
          inReplyTo: target?.internet_message_id || undefined,
          references,
        });
      } else {
        const quoted = target?.body_text || target?.snippet || "";
        setComposeDefaults({
          initialSubject: /^fwd:/i.test(subject) ? subject : `Fwd: ${subject}`,
          initialBody: quoted
            ? `\n\n---------- Forwarded message ----------\n${quoted}`
            : "",
        });
      }
      setIsComposeOpen(true);
    },
    [accounts, selectedAccountId, selectedThread],
  );

  // Command Palette Action Handler
  const handleCommandPaletteAction = (actionKey: string, payload?: any) => {
    switch (actionKey) {
      case "reply":
        quickReplyRef.current?.focus();
        break;
      case "reply_all":
        if (selectedThread?.messages?.length) {
          openCompose("reply_all");
        }
        break;
      case "forward":
        if (selectedThread?.messages?.length) {
          openCompose("forward");
        }
        break;
      case "archive":
        handleThreadAction("archive");
        break;
      case "trash":
        handleThreadAction("trash");
        break;
      case "star":
        if (selectedThread) {
          handleThreadAction(selectedThread.is_starred ? "unstar" : "star");
        }
        break;
      case "goto_folder":
        if (payload) {
          setSelectedFolder(payload);
          setSelectedThreadId(null);
          setMobileView("threads");
        }
        break;
      case "filter_queue":
        if (payload) {
          setSearchQuery(payload);
        }
        break;
      case "check_deliverability":
        setIsDeliverabilityModalOpen(true);
        fetchDeliverability();
        break;
      default:
        break;
    }
  };

  // Global Keyboard Navigation (Superhuman / Vim style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K opens Command Palette anywhere
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Do not intercept if browser modifier keys (Ctrl / Cmd / Alt) are pressed (e.g. Ctrl+R to reload)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "c") {
        e.preventDefault();
        openCompose("new");
      } else if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === "r") {
        e.preventDefault();
        quickReplyRef.current?.focus();
      } else if (e.key === "a") {
        e.preventDefault();
        if (selectedThread?.messages?.length) {
          openCompose("reply_all");
        }
      } else if (e.key === "f") {
        e.preventDefault();
        if (selectedThread?.messages?.length) {
          openCompose("forward");
        }
      } else if (e.key === "Enter" || e.key === "o") {
        if (selectedThreadId) {
          setMobileView("detail");
        }
      } else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setThreads((prev) => {
          if (prev.length === 0) return prev;
          const currentIndex = prev.findIndex(
            (t) => t.thread_id === selectedThreadId,
          );
          const nextIndex = Math.min(currentIndex + 1, prev.length - 1);
          const nextThread = prev[nextIndex];
          if (nextThread) setSelectedThreadId(nextThread.thread_id);
          return prev;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setThreads((prev) => {
          if (prev.length === 0) return prev;
          const currentIndex = prev.findIndex(
            (t) => t.thread_id === selectedThreadId,
          );
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevThread = prev[prevIndex];
          if (prevThread) setSelectedThreadId(prevThread.thread_id);
          return prev;
        });
      } else if (e.key === "e" || e.key === "y") {
        e.preventDefault();
        handleThreadAction("archive");
      } else if (e.key === "#") {
        e.preventDefault();
        handleThreadAction("trash");
      } else if (e.key === "s") {
        e.preventDefault();
        if (selectedThread) {
          handleThreadAction(selectedThread.is_starred ? "unstar" : "star");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedThreadId, selectedThread, openCompose]);

  const selectedAccount = accounts.find(
    (a) => a.account_id === selectedAccountId,
  );

  // Folder Navigation Mapping
  const folderItems = [
    { type: "INBOX", label: t("admin.mail.folders.inbox"), icon: Inbox },
    { type: "SENT", label: t("admin.mail.folders.sent"), icon: Send },
    { type: "DRAFTS", label: t("admin.mail.folders.drafts"), icon: FileText },
    { type: "STARRED", label: t("admin.mail.folders.starred"), icon: Star },
    { type: "ARCHIVE", label: t("admin.mail.folders.archive"), icon: Archive },
    { type: "TRASH", label: t("admin.mail.folders.trash"), icon: Trash2 },
    { type: "SPAM", label: t("admin.mail.folders.spam"), icon: AlertOctagon },
  ];

  const getFolderUnread = (type: string) => {
    if (!selectedAccount) return 0;
    const mb = selectedAccount.mailboxes?.find((m: Mailbox) => m.type === type);
    return mb ? mb.unread_count : 0;
  };

  // Filtered threads based on filterTab
  const visibleThreads = useMemo(() => {
    if (filterTab === "UNREAD") {
      return threads.filter((t) => t.is_unread);
    }
    if (filterTab === "STARRED") {
      return threads.filter((t) => t.is_starred);
    }
    return threads;
  }, [threads, filterTab]);

  // Deterministic avatar gradient color generator
  const getAvatarGradient = (str: string) => {
    const gradients = [
      "from-blue-600 to-indigo-600",
      "from-indigo-600 to-purple-600",
      "from-purple-600 to-pink-600",
      "from-cyan-600 to-blue-600",
      "from-emerald-600 to-teal-600",
      "from-amber-600 to-orange-600",
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  // Detect explicit CRM tags in the subject. Plain words like "contract" or
  // "invoice" produced false positives on ordinary mail.
  const getCrmBadges = (subject: string) => {
    const badges: Array<{
      label: string;
      variant: "default" | "success" | "warning" | "gradient" | "outline";
    }> = [];
    if (/\[CTR-\d+\]/i.test(subject)) {
      badges.push({ label: "Contract", variant: "default" });
    }
    if (/\[TICK-\d+\]/i.test(subject)) {
      badges.push({ label: "Ticket", variant: "gradient" });
    }
    if (/\[DISP-\d+\]/i.test(subject)) {
      badges.push({ label: "Dispute", variant: "warning" });
    }
    if (/\[INV-\d+\]/i.test(subject)) {
      badges.push({ label: "Invoice", variant: "outline" });
    }
    return badges;
  };

  return (
    <div className="flex min-h-[calc(100vh-125px)] h-auto w-full rounded-3xl border border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xs">
      {/* ── PANE 1: Folder & Account Navigation Sidebar ── */}
      <div
        className={`flex flex-col w-full lg:w-64 border-e border-border/60 bg-slate-50/50 dark:bg-slate-950/40 p-4 shrink-0 gap-4 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-140px)] overflow-y-auto ${
          mobileView !== "folders" ? "hidden lg:flex" : "flex"
        } ${isFoldersCollapsed ? "lg:hidden" : ""}`}
      >
        {/* Account Selector Card */}
        <div className="relative">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1.5 block">
            {t("admin.mail.selectAccount")}
          </label>
          {isLoadingAccounts ? (
            <div className="h-10 rounded-xl bg-muted/40 animate-pulse" />
          ) : (
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setSelectedThreadId(null);
                }}
                disabled={accounts.length === 0}
                className="w-full h-10 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-border/80 text-foreground appearance-none pr-8 cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/40 truncate disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {accounts.length === 0 ? (
                  <option value="" disabled>
                    {t("admin.mail.noAccountsConfigured")}
                  </option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc.account_id} value={acc.account_id}>
                      {acc.email_address} ({acc.display_name})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-muted-foreground absolute end-2.5 top-3 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Primary Compose Action */}
        <PodaciumButton
          variant="gradient"
          size="default"
          fullWidth
          className="rounded-2xl gap-2 font-semibold shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
          onClick={() => openCompose("new")}
          icon={<PenSquare className="w-4 h-4" />}
        >
          {t("admin.mail.compose")}
          <kbd className="ms-auto text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/30 hidden sm:inline">
            {t("admin.mail.shortcutComposeKbd")}
          </kbd>
        </PodaciumButton>

        {/* System Folders List */}
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2 py-1">
            {t("admin.mail.mailboxes")}
          </span>
          {folderItems.map((f) => {
            const Icon = f.icon;
            const active = selectedFolder === f.type;
            const unread = getFolderUnread(f.type);

            return (
              <button
                key={f.type}
                type="button"
                onClick={() => {
                  setSelectedFolder(f.type);
                  setSelectedThreadId(null);
                  setMobileView("threads");
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{f.label}</span>
                </div>
                {unread > 0 && (
                  <PodaciumBadge
                    variant={active ? "secondary" : "default"}
                    className="text-[10px] px-1.5 py-0 h-4 min-w-[16px] text-center"
                  >
                    {unread}
                  </PodaciumBadge>
                )}
              </button>
            );
          })}
        </nav>

        {/* Deliverability Status Button */}
        <button
          type="button"
          onClick={() => {
            setIsDeliverabilityModalOpen(true);
            fetchDeliverability();
          }}
          aria-label={t("admin.mail.deliverability.dnsHealth")}
          className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold border transition-all text-start ${
            !deliverability || deliverability.overall_status === "FAIL"
              ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20 hover:bg-slate-500/20"
              : deliverability.overall_status === "WARNING"
                ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/20"
                : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20"
          }`}
          title={t("admin.mail.deliverability.dnsHealthTitle")}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-current shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-[11px] font-bold">
                {deliverability
                  ? `${deliverability.overall_status} (${deliverability.active_protocols_count}/3)`
                  : t("admin.mail.deliverability.unknown")}
              </span>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-normal truncate">
                {t("admin.mail.deliverability.protocols")}
              </span>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-emerald-600/70 shrink-0 rtl:rotate-180" />
        </button>

        {/* Sync & Connection Status Footer */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`w-2 h-2 rounded-full ${
                selectedAccount?.status === "ACTIVE"
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-amber-500"
              }`}
            />
            <span className="truncate max-w-[120px]">
              {selectedAccount?.status === "ACTIVE"
                ? t("admin.mail.serverConnected")
                : t("admin.mail.serverConnecting")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsShortcutsOpen(true)}
              title={t("admin.mail.shortcutsTitle")}
              aria-label={t("admin.mail.shortcutsTitle")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title={t("admin.mail.actions.syncNow")}
              aria-label={t("admin.mail.actions.syncNow")}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── PANE 2: Thread List Pane ── */}
      <div
        className={`flex flex-col w-full lg:w-80 xl:w-96 border-e border-border/60 bg-white/50 dark:bg-slate-900/40 shrink-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-140px)] overflow-y-auto ${
          mobileView === "threads"
            ? "flex"
            : mobileView === "folders"
              ? "hidden lg:flex"
              : "hidden lg:flex"
        }`}
      >
        {/* Search & Triage Toolbar */}
        <div className="p-3 border-b border-border/60 flex flex-col gap-2.5 bg-slate-50/30 dark:bg-slate-950/20">
          <div className="flex items-center gap-2">
            {/* Desktop Folders Toggle */}
            <button
              type="button"
              onClick={() => setIsFoldersCollapsed((prev) => !prev)}
              className="hidden lg:flex p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              title={
                isFoldersCollapsed
                  ? t("admin.mail.expandFolders")
                  : t("admin.mail.collapseFolders")
              }
              aria-label={
                isFoldersCollapsed
                  ? t("admin.mail.expandFolders")
                  : t("admin.mail.collapseFolders")
              }
            >
              {isFoldersCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 rtl:rotate-180" />
              ) : (
                <PanelLeftClose className="w-4 h-4 rtl:rotate-180" />
              )}
            </button>
            <button
              onClick={() => setMobileView("folders")}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary lg:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute start-3 top-3 pointer-events-none" />
              <PodaciumInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("admin.mail.searchPlaceholder")}
                className="ps-8 pe-7 h-9 text-xs bg-white dark:bg-slate-900 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-1.5 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors border border-border/60 hidden sm:flex items-center gap-1 text-[10px] font-mono px-2 shrink-0"
              title={t("admin.mail.deliverability.commandPaletteTitle")}
              aria-label={t("admin.mail.deliverability.commandPaletteAria")}
            >
              <span>⌘K</span>
            </button>
            <button
              type="button"
              onClick={() => handleSync()}
              disabled={isSyncing || isLoadingThreads}
              title={t("admin.mail.actions.syncNow")}
              aria-label={t("admin.mail.actions.syncNow")}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing || isLoadingThreads ? "animate-spin text-primary" : ""}`}
              />
            </button>
          </div>

          {/* Quick Segmented Tabs (All / Unread / Starred) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterTab("ALL")}
              className={`flex-1 py-1 rounded-lg text-center transition-all ${
                filterTab === "ALL"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("admin.mail.filterAll", { count: String(threads.length) })}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("UNREAD")}
              className={`flex-1 py-1 rounded-lg text-center transition-all ${
                filterTab === "UNREAD"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("admin.mail.filterUnread", {
                count: String(threads.filter((t) => t.is_unread).length),
              })}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("STARRED")}
              className={`flex-1 py-1 rounded-lg text-center transition-all ${
                filterTab === "STARRED"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("admin.mail.filterStarred", {
                count: String(threads.filter((t) => t.is_starred).length),
              })}
            </button>
          </div>

          {/* Platform Queues Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() =>
                setSearchQuery((prev) =>
                  prev === "Contract" ? "" : "Contract",
                )
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 border ${
                searchQuery === "Contract"
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold shadow-2xs"
                  : "bg-secondary/40 hover:bg-secondary border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="w-3 h-3 text-blue-500" />
              <span>{t("admin.mail.contractsEscrow")}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setSearchQuery((prev) => (prev === "Ticket" ? "" : "Ticket"))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 border ${
                searchQuery === "Ticket"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "bg-secondary/40 hover:bg-secondary border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <LifeBuoy className="w-3 h-3 text-emerald-500" />
              <span>{t("admin.mail.supportTickets")}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setSearchQuery((prev) => (prev === "Dispute" ? "" : "Dispute"))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 border ${
                searchQuery === "Dispute"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold shadow-2xs"
                  : "bg-secondary/40 hover:bg-secondary border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Scale className="w-3 h-3 text-amber-500" />
              <span>{t("admin.mail.disputesClaims")}</span>
            </button>
          </div>
        </div>

        {/* Trash Banner if in TRASH folder */}
        {selectedFolder === "TRASH" && threads.length > 0 && (
          <div className="mx-3 my-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs text-destructive font-medium min-w-0">
              <Trash2 className="w-4 h-4 shrink-0 text-destructive" />
              <span className="truncate">{t("admin.mail.trashBanner")}</span>
            </div>
            <PodaciumButton
              size="sm"
              variant="destructive"
              className="h-7 text-[11px] px-2.5 rounded-lg shrink-0 font-medium"
              onClick={() => setIsEmptyTrashConfirmOpen(true)}
            >
              {t("admin.mail.actions.emptyTrash")}
            </PodaciumButton>
          </div>
        )}

        {/* Thread Cards List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {isLoadingThreads ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span>{t("admin.mail.loading")}</span>
            </div>
          ) : visibleThreads.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <Inbox className="w-8 h-8 text-muted-foreground/40 mb-1" />
              <p className="text-xs font-semibold text-foreground">
                {t("admin.mail.emptyFolder")}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px]">
                {t("admin.mail.emptyFolderDesc")}
              </p>
            </div>
          ) : (
            visibleThreads.map((thread) => {
              const isSelected = selectedThreadId === thread.thread_id;
              const latestMsg = thread.messages?.[thread.messages.length - 1];
              const sender =
                latestMsg?.from_name || latestMsg?.from_address || "Unknown";
              const crmBadges = getCrmBadges(thread.subject);

              return (
                <div
                  key={thread.thread_id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedThreadId(thread.thread_id);
                      setMobileView("detail");
                    }
                  }}
                  onClick={() => {
                    setSelectedThreadId(thread.thread_id);
                    setMobileView("detail");
                  }}
                  className={`group relative flex flex-col p-3.5 cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    isSelected
                      ? "bg-blue-50/90 dark:bg-blue-950/50 border-s-4 border-primary shadow-xs"
                      : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {/* Top Row: Sender + Timestamp */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      {/* Avatar Initials Badge */}
                      <div
                        className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarGradient(
                          sender,
                        )} text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-2xs`}
                      >
                        {sender.slice(0, 1).toUpperCase()}
                      </div>
                      <span
                        className={`text-xs truncate ${
                          thread.is_unread
                            ? "font-bold text-foreground"
                            : "font-medium text-foreground/85 dark:text-foreground/75"
                        }`}
                      >
                        <bdi>{sender}</bdi>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {thread.is_unread && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {thread.last_message_at
                          ? formatRelativeTime(thread.last_message_at)
                          : ""}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Subject */}
                  <p
                    dir="auto"
                    className={`text-xs truncate mb-1 ${
                      thread.is_unread
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {thread.subject || "(No Subject)"}
                  </p>

                  {/* Bottom Row: Snippet & Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <p
                      dir="auto"
                      className="text-[11px] text-muted-foreground/80 line-clamp-1 truncate flex-1"
                    >
                      {thread.snippet || ""}
                    </p>

                    <div className="flex items-center gap-1 shrink-0">
                      {crmBadges.map((badge, idx) => (
                        <PodaciumBadge
                          key={idx}
                          variant={badge.variant}
                          className="text-[9px] px-1.5 py-0 h-3.5"
                        >
                          {badge.label}
                        </PodaciumBadge>
                      ))}
                      {thread.has_attachments && (
                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                      )}
                      {thread.is_starred && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      )}
                      {thread.message_count > 1 && (
                        <span className="px-1.5 py-0.2 rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground">
                          {thread.message_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {hasMoreThreads && !searchQuery && (
            <div className="p-3">
              <PodaciumButton
                variant="outline"
                size="sm"
                fullWidth
                loading={isLoadingMoreThreads}
                onClick={loadMoreThreads}
              >
                {t("admin.mail.loadMore")}
              </PodaciumButton>
            </div>
          )}
        </div>
      </div>

      {/* ── PANE 3: Thread Detail & CRM Context Pane ── */}
      <div
        className={`flex-1 flex flex-col bg-white/90 dark:bg-slate-900/90 min-w-0 h-auto ${
          mobileView === "detail" ? "flex" : "hidden lg:flex"
        }`}
      >
        {selectedThreadId && selectedThread ? (
          <div className="flex flex-col h-auto min-w-0">
            {/* Thread Action Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/70 dark:from-slate-950/50 dark:via-slate-900 dark:to-slate-950/50">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setMobileView("threads")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground lg:hidden"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h1
                  dir="auto"
                  className="text-sm font-bold text-foreground truncate max-w-md sm:max-w-xl"
                >
                  {selectedThread.subject || "(No Subject)"}
                </h1>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() =>
                    handleThreadAction(
                      selectedThread.is_starred ? "unstar" : "star",
                    )
                  }
                  title={
                    selectedThread.is_starred
                      ? t("admin.mail.actions.unstar")
                      : t("admin.mail.actions.star")
                  }
                  className="p-2 rounded-xl text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                >
                  <Star
                    className={`w-4 h-4 ${
                      selectedThread.is_starred
                        ? "text-amber-500 fill-amber-500"
                        : ""
                    }`}
                  />
                </button>
                {selectedFolder === "TRASH" ? (
                  <>
                    <button
                      onClick={() => handleThreadAction("restore")}
                      title={t("admin.mail.actions.restore")}
                      aria-label={t("admin.mail.actions.restore")}
                      className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsPurgeConfirmOpen(true)}
                      title={t("admin.mail.actions.purge")}
                      aria-label={t("admin.mail.actions.purge")}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleThreadAction("archive")}
                      title={t("admin.mail.actions.archive")}
                      aria-label={t("admin.mail.actions.archive")}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleThreadAction("trash")}
                      title={t("admin.mail.actions.delete")}
                      aria-label={t("admin.mail.actions.delete")}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}

                <div className="w-[1px] h-4 bg-border/60 mx-1 hidden xl:block" />

                {/* CRM Context Drawer Toggle */}
                {(() => {
                  const hasCrmContext = Boolean(
                    selectedThread?.crm_context?.user ||
                    selectedThread?.crm_context?.contract ||
                    selectedThread?.crm_context?.ticket ||
                    selectedThread?.crm_context?.invoice ||
                    selectedThread?.crm_context?.dispute,
                  );

                  return (
                    <button
                      onClick={handleToggleCrmDrawer}
                      title={
                        isCrmDrawerOpen
                          ? t("admin.mail.hideCrmDrawer")
                          : hasCrmContext
                            ? "View linked CRM record (User / Contracts / Tickets)"
                            : t("admin.mail.showCrmDrawer")
                      }
                      className={`p-2 rounded-xl transition-all hidden xl:flex items-center gap-1.5 text-xs font-semibold relative ${
                        isCrmDrawerOpen
                          ? "text-primary bg-primary/10 shadow-2xs"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                      }`}
                    >
                      {isCrmDrawerOpen ? (
                        <PanelRightClose className="w-4 h-4" />
                      ) : (
                        <PanelRightOpen className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-[11px]">CRM</span>
                      {hasCrmContext && (
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse"
                          title={t("admin.mail.crm.linkedRecord")}
                        />
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Collision Warning Banner */}
            {otherAdmins.length > 0 && (
              <div className="flex items-center gap-2 px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium animate-in fade-in duration-200">
                <AlertOctagon className="w-4 h-4 shrink-0 animate-pulse text-amber-600" />
                <span>
                  {otherAdmins.some((a) => a.status === "drafting")
                    ? `${otherAdmins.find((a) => a.status === "drafting")?.admin_name} is currently drafting a reply...`
                    : `${otherAdmins[0].admin_name} is viewing this thread`}
                </span>
              </div>
            )}

            {/* Thread Body & CRM Split View */}
            <div className="flex-1 flex h-auto min-w-0">
              {/* Messages Timeline */}
              <div className="flex-1 p-6 flex flex-col gap-5 h-auto min-w-0">
                {isLoadingDetail ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>{t("admin.mail.loadingMessages")}</span>
                  </div>
                ) : (
                  selectedThread.messages?.map((msg, index) => {
                    const isLatest =
                      index === (selectedThread.messages?.length || 1) - 1;
                    const isExpanded =
                      expandedMessageIds[msg.message_id] ?? isLatest;
                    const isInternal =
                      msg.from_address.endsWith("@podacium.com");

                    return (
                      <div
                        key={msg.message_id || index}
                        className="flex flex-col rounded-2xl border border-border/70 bg-white/95 dark:bg-slate-900/95 shadow-2xs transition-all h-auto"
                      >
                        {/* Message Meta Header (Clickable Accordion) */}
                        <div
                          onClick={() => {
                            if (!isLatest) {
                              setExpandedMessageIds((prev) => ({
                                ...prev,
                                [msg.message_id]: !prev[msg.message_id],
                              }));
                            }
                          }}
                          className={`flex items-start justify-between gap-4 p-4 ${
                            !isLatest
                              ? "cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(
                                msg.from_name || msg.from_address,
                              )} text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0`}
                            >
                              {(msg.from_name || msg.from_address || "P")
                                .slice(0, 1)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground">
                                  {msg.from_name || msg.from_address}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  &lt;{msg.from_address}&gt;
                                </span>
                                {/* Internal vs External Sender Trust Pill */}
                                {isInternal ? (
                                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.2 rounded-full">
                                    <ShieldCheck className="w-3 h-3" />
                                    {t("admin.mail.crm.internal")}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.2 rounded-full">
                                    <ExternalLink className="w-3 h-3" />
                                    {t("admin.mail.crm.external")}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {t("admin.mail.composer.to")}:{" "}
                                {msg.to_addresses?.join(", ")}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {msg.received_at || msg.created_at
                                ? formatRelativeTime(
                                    msg.received_at || msg.created_at,
                                  )
                                : ""}
                            </span>
                            {!isLatest && (
                              <button
                                type="button"
                                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsed Snippet Strip */}
                        {!isExpanded && (
                          <div className="px-4 pb-3 text-xs text-muted-foreground line-clamp-1">
                            {msg.snippet ||
                              "Click to expand message content..."}
                          </div>
                        )}

                        {/* Expanded Full Message Content */}
                        {isExpanded && (
                          <div className="px-4 pb-4 flex flex-col gap-3 pt-1 border-t border-border/30">
                            {/* Sandboxed Safe HTML / Plaintext Viewer */}
                            <SafeEmailViewer
                              htmlContent={msg.body_html}
                              bodyText={msg.body_text}
                              messageId={msg.message_id}
                              senderDisplayName={msg.from_name}
                              senderEmail={msg.from_address}
                            />

                            {/* Attachments Tray */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-3 border-t border-border/40">
                                {msg.attachments.map((att) => (
                                  <a
                                    key={att.attachment_id}
                                    href={`/api/v1/mail/attachments/${att.attachment_id}/download`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-secondary/60 hover:bg-secondary text-xs text-secondary-foreground transition-all hover:scale-[1.01]"
                                  >
                                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                                    <span className="font-semibold truncate max-w-[160px]">
                                      {att.file_name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      ({(att.file_size_bytes / 1024).toFixed(1)}{" "}
                                      KB)
                                    </span>
                                    {(() => {
                                      const scanStatus =
                                        att.scan_status || "unknown";
                                      if (scanStatus === "clean") {
                                        return (
                                          <span className="flex items-center gap-0.5 text-[9px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.2 rounded font-medium">
                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                            {t(
                                              "admin.mail.attachments.scanClean",
                                            )}
                                          </span>
                                        );
                                      }
                                      const label =
                                        scanStatus === "infected" ||
                                        scanStatus === "blocked"
                                          ? t(
                                              "admin.mail.attachments.scanInfected",
                                            )
                                          : scanStatus === "failed"
                                            ? t(
                                                "admin.mail.attachments.scanFailed",
                                              )
                                            : t(
                                                "admin.mail.attachments.scanSkipped",
                                              );
                                      return (
                                        <span
                                          className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                            scanStatus === "infected" ||
                                            scanStatus === "blocked"
                                              ? "text-red-600 bg-red-500/10"
                                              : "text-amber-600 bg-amber-500/10"
                                          }`}
                                        >
                                          <AlertTriangle className="w-2.5 h-2.5" />
                                          {label}
                                        </span>
                                      );
                                    })()}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Elevated Docked Quick Reply Box */}
                <div className="mt-2 p-4 rounded-3xl border border-border/80 bg-white/95 dark:bg-slate-900/95 shadow-md">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {t("admin.mail.actions.reply")}
                      </span>
                      <button
                        type="button"
                        onClick={handleQuoteLatestMessage}
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-secondary transition-colors"
                        title={t("admin.mail.quoteMessage")}
                      >
                        <Quote className="w-3 h-3" />
                        <span>{t("admin.mail.quote")}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCompose("reply")}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-secondary transition-colors"
                        title={t("admin.mail.expandToFullComposer")}
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>{t("admin.mail.fullComposer")}</span>
                      </button>
                      <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                        <kbd className="px-1.5 py-0.5 text-[9px] bg-muted border border-border/80 rounded">
                          {t("admin.mail.shortcutsModal.sendShortcut")}
                        </kbd>
                      </span>
                    </div>
                  </div>

                  <textarea
                    ref={quickReplyRef}
                    value={quickReplyBody}
                    onChange={(e) => setQuickReplyBody(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleSendQuickReply();
                      }
                    }}
                    placeholder={t("admin.mail.composer.placeholder")}
                    rows={3}
                    className="w-full p-3.5 text-xs bg-slate-50/60 dark:bg-slate-950/40 border border-border/60 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 leading-relaxed select-text shadow-2xs text-foreground placeholder:text-muted-foreground"
                  />

                  <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setQuickReplyBody((prev) => `${prev} **bold** `)
                        }
                        className="p-1 rounded hover:text-foreground hover:bg-secondary"
                        title={t("admin.mail.bold")}
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuickReplyBody((prev) => `${prev} *italic* `)
                        }
                        className="p-1 rounded hover:text-foreground hover:bg-secondary"
                        title={t("admin.mail.italic")}
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <PodaciumButton
                      variant="gradient"
                      size="sm"
                      loading={isSendingQuickReply}
                      disabled={!quickReplyBody.trim() || isSendingQuickReply}
                      onClick={() => handleSendQuickReply()}
                      icon={<Send className="w-3.5 h-3.5" />}
                      className="gap-2 shadow-sm shadow-primary/20"
                    >
                      {isSendingQuickReply
                        ? t("admin.mail.actions.sending")
                        : t("admin.mail.actions.send")}
                    </PodaciumButton>
                  </div>
                </div>
              </div>

              {/* CRM Context Drawer (Side Panel on Large Screens) */}
              {isCrmDrawerOpen && (
                <div className="hidden xl:flex w-80 border-s border-border/60 bg-gradient-to-b from-slate-50/50 via-white/50 to-slate-50/50 dark:from-slate-950/30 dark:via-slate-900/30 dark:to-slate-950/30 p-4 flex-col gap-4 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-140px)] overflow-y-auto animate-in slide-in-from-right-4 duration-200">
                  <CrmContextDrawer crmContext={selectedThread.crm_context} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-primary flex items-center justify-center mb-4 shadow-xs">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">
              {t("admin.mail.title")}
            </h2>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed mb-4">
              {t("admin.mail.subtitle")}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-xl border border-border/60">
              <Keyboard className="w-3.5 h-3.5 text-primary" />
              <span>
                {t("admin.mail.shortcutsHintPrefix")}{" "}
                <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-white dark:bg-slate-800 rounded border">
                  {t("admin.mail.shortcutKbd")}
                </kbd>{" "}
                {t("admin.mail.shortcutsHintSuffix")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Compose Email Modal */}
      {selectedAccount && (
        <ComposeModal
          isOpen={isComposeOpen}
          onClose={() => {
            setIsComposeOpen(false);
            setComposeDefaults({});
          }}
          accountId={selectedAccount.account_id}
          initialTo={composeDefaults.initialTo}
          initialCc={composeDefaults.initialCc}
          initialBody={composeDefaults.initialBody}
          initialThreadId={composeDefaults.initialThreadId}
          initialSubject={composeDefaults.initialSubject}
          inReplyTo={composeDefaults.inReplyTo}
          references={composeDefaults.references}
          onSentSuccess={() => {
            setIsComposeOpen(false);
            setComposeDefaults({});
            fetchAccounts();
            if (selectedFolder === "SENT") {
              fetchThreads("SENT");
            } else {
              setSelectedFolder("SENT");
              setSelectedThreadId(null);
            }
          }}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="flex flex-col w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-border/80 shadow-2xl p-6 gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {t("admin.mail.shortcutsModal.title")}
                </h3>
              </div>
              <button
                onClick={() => setIsShortcutsOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.nextEmail")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  j / ↓
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.prevEmail")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  k / ↑
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.openEmail")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  {t("admin.mail.shortcutsModal.enterKey")}
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.compose")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  c
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.archive")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  e / y
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.trash")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  #
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.star")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  s
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-muted-foreground">
                  {t("admin.mail.shortcutsModal.reply")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  r
                </kbd>
              </div>
              <div className="col-span-2 flex items-center justify-between p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/50">
                <span className="font-semibold text-blue-900 dark:text-blue-300">
                  {t("admin.mail.shortcutsModal.send")}
                </span>
                <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 border font-mono">
                  {t("admin.mail.shortcutsModal.sendShortcut")}
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Modal */}
      <PodaciumModal
        isOpen={isEmptyTrashConfirmOpen}
        onClose={() => {
          if (!isEmptyingTrash) setIsEmptyTrashConfirmOpen(false);
        }}
        title={t("admin.mail.actions.emptyTrash")}
        size="sm"
      >
        <div className="flex flex-col gap-4 p-1">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-foreground">
                {t("admin.mail.actions.emptyTrashConfirm")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("admin.mail.actions.emptyTrashWarning")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <PodaciumButton
              variant="outline"
              size="sm"
              disabled={isEmptyingTrash}
              onClick={() => setIsEmptyTrashConfirmOpen(false)}
            >
              {t("common.cancel")}
            </PodaciumButton>
            <PodaciumButton
              variant="destructive"
              size="sm"
              loading={isEmptyingTrash}
              onClick={handleEmptyTrash}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {t("admin.mail.actions.emptyTrash")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumModal>

      {/* Purge Single Thread Confirmation Modal */}
      <PodaciumModal
        isOpen={isPurgeConfirmOpen}
        onClose={() => {
          if (!isPurgingThread) setIsPurgeConfirmOpen(false);
        }}
        title={t("admin.mail.actions.purge")}
        size="sm"
      >
        <div className="flex flex-col gap-4 p-1">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-foreground">
                {t("admin.mail.actions.purgeConfirm")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("admin.mail.actions.purgeWarning")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <PodaciumButton
              variant="outline"
              size="sm"
              disabled={isPurgingThread}
              onClick={() => setIsPurgeConfirmOpen(false)}
            >
              {t("common.cancel")}
            </PodaciumButton>
            <PodaciumButton
              variant="destructive"
              size="sm"
              loading={isPurgingThread}
              onClick={handlePurgeThread}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              {t("admin.mail.actions.purge")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumModal>

      {/* Superhuman Command Palette */}
      <MailCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onAction={handleCommandPaletteAction}
      />

      {/* Deliverability DNS Diagnostics Modal */}
      <PodaciumModal
        isOpen={isDeliverabilityModalOpen}
        onClose={() => setIsDeliverabilityModalOpen(false)}
        title={t("admin.mail.deliverability.modalTitle")}
        size="md"
      >
        <div className="flex flex-col gap-4 p-1">
          {deliverabilityError && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {t("admin.mail.deliverability.loadError")}
            </div>
          )}

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-border/60">
            <div className="flex items-center gap-2.5">
              <ShieldCheck
                className={`w-5 h-5 ${
                  deliverability?.overall_status === "PASS"
                    ? "text-emerald-500"
                    : deliverability?.overall_status === "FAIL"
                      ? "text-red-500"
                      : "text-amber-500"
                }`}
              />
              <div>
                <p className="text-xs font-bold text-foreground">
                  {t("admin.mail.deliverability.domainLabel", {
                    domain: deliverability?.domain || "—",
                  })}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {deliverability?.active_protocols_label ||
                    t("admin.mail.deliverability.loadError")}
                </p>
              </div>
            </div>
            <PodaciumBadge
              variant={deliverabilityBadgeVariant(
                deliverability?.overall_status,
              )}
              className="text-xs px-2.5 py-0.5"
            >
              {deliverability?.overall_status || "UNKNOWN"}
            </PodaciumBadge>
          </div>

          <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
            {deliverabilityChecks.length > 0 ? (
              deliverabilityChecks.map((check) => (
                <div
                  key={check.key}
                  className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-border/80 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${deliverabilityDotClass(
                          check.status,
                        )}`}
                      />
                      {check.label}
                    </span>
                    <PodaciumBadge
                      variant={deliverabilityBadgeVariant(check.status)}
                      className="text-[10px]"
                    >
                      {check.status || "UNKNOWN"}
                    </PodaciumBadge>
                  </div>
                  {check.detail && (
                    <p className="text-muted-foreground text-[11px] break-words">
                      {check.detail}
                    </p>
                  )}
                  {check.record ? (
                    <pre className="font-mono text-[10px] bg-slate-100 dark:bg-slate-950 p-2 rounded-lg overflow-x-auto text-foreground/80 border border-border/50">
                      {check.record}
                    </pre>
                  ) : (
                    <p className="text-[11px] text-red-600 dark:text-red-400">
                      {t("admin.mail.deliverability.noRecord")}
                    </p>
                  )}
                  {check.warnings.length > 0 && (
                    <ul className="list-disc ps-4 text-[11px] text-amber-700 dark:text-amber-300">
                      {check.warnings.map((warning: string) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border/80 bg-white p-4 text-center text-xs text-muted-foreground dark:bg-slate-900">
                {isLoadingDeliverability
                  ? t("admin.mail.deliverability.rescanDns")
                  : t("admin.mail.deliverability.loadError")}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <span className="text-[11px] text-muted-foreground">
              {t("admin.mail.deliverability.protectionNotice")}
            </span>
            <PodaciumButton
              variant="outline"
              size="sm"
              loading={isLoadingDeliverability}
              onClick={fetchDeliverability}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {t("admin.mail.deliverability.rescanDns")}
            </PodaciumButton>
          </div>
        </div>
      </PodaciumModal>
    </div>
  );
}

export default MailSuiteWorkspace;
