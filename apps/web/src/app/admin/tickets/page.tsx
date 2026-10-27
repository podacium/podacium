"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api } from "@/lib/api";

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  user_id: number;
  assigned_to_id: number | null;
  created_at: string;
  messages_count: number;
}

interface TicketStats {
  open_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
  total_tickets: number;
  avg_response_time_hours: number;
  avg_csat_score: number;
  sla_breached_count: number;
}

interface TicketMessage {
  id: number;
  body: string;
  is_internal?: boolean;
  created_at: string;
  sender?: {
    full_name?: string;
    role?: string;
  };
}

interface TicketDetail extends Ticket {
  user?: {
    full_name?: string;
    email?: string;
  };
  messages?: TicketMessage[];
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300",
  IN_PROGRESS:
    "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300",
  WAITING_ON_CUSTOMER:
    "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300",
  RESOLVED:
    "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300",
  CLOSED: "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-500 text-white shadow-xs",
  HIGH: "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300",
  NORMAL: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300",
  LOW: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400",
};

function AiEscalationDossierCard({ body }: { body: string }) {
  const t = useTranslations("admin.tickets");
  const [showTranscript, setShowTranscript] = useState(false);

  const categoryMatch = body.match(/Catégorie:\s*([^|\n]+)/i);
  const priorityMatch = body.match(/Priorité:\s*([^\n]+)/i);
  const sentimentMatch = body.match(/Sentiment:\s*([^\n]+)/i);
  const actionMatch = body.match(/Action Recommandée:\s*([^\n]+)/i);
  const pageMatch = body.match(/Page:\s*([^\n]+)/i);
  const browserMatch = body.match(/Navigateur:\s*([^\n]+)/i);

  const transcriptSection =
    body.split("--- TRANSCRIPTION INTÉGRALE ---")[1] || "";
  const conversationTurns = transcriptSection
    .trim()
    .split(/\n\n(?=\[(?:Client|Assistant IA)\])/)
    .filter(Boolean);

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/30 dark:to-slate-900 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-indigo-100 dark:border-indigo-900/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
            IA
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>{t("aiEscalation.title")}</span>
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                {t("aiEscalation.lawBadge")}
              </span>
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {t("aiEscalation.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {priorityMatch && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                priorityMatch[1].trim().toUpperCase() === "URGENT"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              }`}
            >
              {priorityMatch[1].trim()}
            </span>
          )}
          {categoryMatch && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {categoryMatch[1].trim()}
            </span>
          )}
        </div>
      </div>

      {/* Recommended Staff Action Box */}
      {actionMatch && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-0.5">
            {t("aiEscalation.recommendedAction")}
          </p>
          <p className="text-xs text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
            {actionMatch[1].trim()}
          </p>
        </div>
      )}

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        {sentimentMatch && (
          <div className="p-2 rounded bg-slate-100/80 dark:bg-slate-800/60">
            <span className="text-slate-400 font-medium">
              {t("aiEscalation.detectedSentiment")}{" "}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {sentimentMatch[1].trim()}
            </span>
          </div>
        )}
        {pageMatch && (
          <div className="p-2 rounded bg-slate-100/80 dark:bg-slate-800/60 truncate">
            <span className="text-slate-400 font-medium">
              {t("aiEscalation.sourcePage")}{" "}
            </span>
            <span className="font-mono text-slate-700 dark:text-slate-200">
              {pageMatch[1].trim()}
            </span>
          </div>
        )}
        {browserMatch && (
          <div className="col-span-full p-2 rounded bg-slate-100/80 dark:bg-slate-800/60 truncate">
            <span className="text-slate-400 font-medium">
              {t("aiEscalation.environment")}{" "}
            </span>
            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
              {browserMatch[1].trim()}
            </span>
          </div>
        )}
      </div>

      {/* Collapsible Full Transcript */}
      {conversationTurns.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowTranscript((prev) => !prev)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>
              {showTranscript
                ? t("aiEscalation.hideTranscript")
                : t("aiEscalation.viewTranscript")}
            </span>
            <span>({conversationTurns.length} messages)</span>
          </button>

          {showTranscript && (
            <div className="mt-2.5 space-y-2 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200/80 dark:border-slate-800 max-h-60 overflow-y-auto">
              {conversationTurns.map((turn, i) => {
                const isUser = turn.startsWith("[Client]");
                const content = turn.replace(
                  /^\[(Client|Assistant IA)\]\n?/,
                  "",
                );
                return (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                      isUser
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 border border-blue-100 dark:border-blue-900/40"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60"
                    }`}
                  >
                    <span className="block font-bold text-[10px] uppercase text-slate-400 mb-1">
                      {isUser
                        ? t("aiEscalation.client")
                        : t("aiEscalation.aiAssistant")}
                    </span>
                    <p className="whitespace-pre-wrap">{content.trim()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminTicketsPage() {
  const t = useTranslations("admin.tickets");
  const { dir } = useBidi();
  const { user, isAuthenticated } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      params.set("limit", "50");
      const data = (await api.get(`/api/v1/tickets?${params}`)) as {
        tickets?: Ticket[];
      };
      setTickets(data.tickets || []);
    } catch (e) {
      console.error("Failed to fetch tickets:", e);
    }
  }, [statusFilter, priorityFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const data = (await api.get("/api/v1/tickets/stats")) as TicketStats;
      setStats(data);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  const fetchTicketDetail = async (ticketId: number) => {
    try {
      const data = (await api.get(
        `/api/v1/tickets/${ticketId}`,
      )) as TicketDetail;
      setTicketDetail(data);
      setSelectedTicket(ticketId);
    } catch (e) {
      console.error("Failed to fetch ticket detail:", e);
    }
  };

  const updateTicketStatus = async (ticketId: number, newStatus: string) => {
    try {
      await api.patch(`/api/v1/tickets/${ticketId}`, { status: newStatus });
      fetchTickets();
      fetchStats();
    } catch (e) {
      console.error("Failed to update ticket:", e);
    }
  };

  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim() || isSendingReply) return;

    setIsSendingReply(true);
    try {
      await api.post(`/api/v1/tickets/${selectedTicket}/messages`, {
        body: replyText.trim(),
        is_internal: isInternalNote,
      });
      setReplyText("");
      await fetchTicketDetail(selectedTicket);
      await fetchTickets();
    } catch (err) {
      console.error("Failed to post message to ticket:", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      Promise.all([fetchTickets(), fetchStats()]).finally(() =>
        setLoading(false),
      );
    }
  }, [isAuthenticated, fetchTickets, fetchStats]);

  if (
    !isAuthenticated ||
    !user ||
    !["ADMIN", "SUPPORT_AGENT"].includes(user.role || "")
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-500 dark:text-slate-400">
          {t("accessDenied")}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const statCards = [
    { key: "open", value: stats?.open_tickets, color: "text-red-600" },
    {
      key: "inProgress",
      value: stats?.in_progress_tickets,
      color: "text-yellow-600",
    },
    {
      key: "resolved",
      value: stats?.resolved_tickets,
      color: "text-green-600",
    },
    {
      key: "total",
      value: stats?.total_tickets,
      color: "text-gray-600 dark:text-slate-400",
    },
    {
      key: "avgResponse",
      value: stats ? `${stats.avg_response_time_hours}h` : "-",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      key: "csat",
      value: stats ? `${stats.avg_csat_score}/5` : "-",
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      key: "slaBreached",
      value: stats?.sla_breached_count,
      color: "text-red-600",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir={dir}>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent mb-6">
        {t("title")}
      </h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {statCards.map((s) => (
            <div
              key={s.key}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 text-center"
            >
              <p className={`text-2xl font-bold ${s.color}`}>
                {s.value ?? "-"}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                {t(`stats.${s.key}`)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex flex-wrap gap-4 mb-6"
        style={{ flexDirection: dir === "rtl" ? "row-reverse" : "row" }}
      >
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
          aria-label={t("filters.statusLabel")}
        >
          <option value="">{t("filters.allStatuses")}</option>
          {[
            "OPEN",
            "IN_PROGRESS",
            "WAITING_ON_CUSTOMER",
            "RESOLVED",
            "CLOSED",
          ].map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
          aria-label={t("filters.priorityLabel")}
        >
          <option value="">{t("filters.allPriorities")}</option>
          {["URGENT", "HIGH", "NORMAL", "LOW"].map((p) => (
            <option key={p} value={p}>
              {t(`priorities.${p}`)}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            fetchTickets();
            fetchStats();
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
        >
          {t("filters.refresh")}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800 text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/60">
            <tr>
              <th
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase ${dir === "rtl" ? "text-right" : "text-left"}`}
              >
                {t("table.ticket")}
              </th>
              <th
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase ${dir === "rtl" ? "text-right" : "text-left"}`}
              >
                {t("table.subject")}
              </th>
              <th
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase ${dir === "rtl" ? "text-right" : "text-left"}`}
              >
                {t("table.status")}
              </th>
              <th
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase ${dir === "rtl" ? "text-right" : "text-left"}`}
              >
                {t("table.priority")}
              </th>
              <th
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase ${dir === "rtl" ? "text-right" : "text-left"}`}
              >
                {t("table.category")}
              </th>
              <th
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase ${dir === "rtl" ? "text-right" : "text-left"}`}
              >
                {t("table.created")}
              </th>
              <th
                className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase ${dir === "rtl" ? "text-right" : "text-left"}`}
              >
                {t("table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer"
                onClick={() => fetchTicketDetail(ticket.id)}
              >
                <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-slate-400">
                  {ticket.ticket_number.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                  {ticket.subject}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || ""}`}
                  >
                    {t(`statuses.${ticket.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || ""}`}
                  >
                    {t(`priorities.${ticket.priority}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">
                  {ticket.category}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <select
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateTicketStatus(ticket.id, e.target.value)
                    }
                    defaultValue=""
                    className="text-xs border rounded px-2 py-1"
                    aria-label={t("table.changeStatusFor", {
                      number: ticket.ticket_number,
                    })}
                  >
                    <option value="" disabled>
                      {t("table.changeStatus")}
                    </option>
                    {["IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                      <option key={s} value={s}>
                        {t(`statuses.${s}`)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
                >
                  {t("table.noTickets")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTicket && ticketDetail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold">{ticketDetail.subject}</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  #{ticketDetail.ticket_number} &bull;{" "}
                  {ticketDetail.user?.full_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400"
                aria-label={t("detail.close")}
              >
                &times;
              </button>
            </div>
            <div
              className="flex gap-2 mb-4"
              style={{ flexDirection: dir === "rtl" ? "row-reverse" : "row" }}
            >
              <span
                className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[ticketDetail.status]}`}
              >
                {t(`statuses.${ticketDetail.status}`)}
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs ${PRIORITY_COLORS[ticketDetail.priority]}`}
              >
                {t(`priorities.${ticketDetail.priority}`)}
              </span>
            </div>
            <div
              className={`space-y-3 mt-4 ${dir === "rtl" ? "space-x-reverse" : ""}`}
            >
              {ticketDetail.messages?.map((msg: TicketMessage) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${msg.is_internal ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50 dark:bg-slate-900/60"}`}
                >
                  <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                    <span className="font-medium">
                      {msg.sender?.full_name} ({msg.sender?.role})
                    </span>
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  {msg.body?.includes(
                    "--- DOSSIER D'ESCALADE SUPPORT IA ---",
                  ) ? (
                    <AiEscalationDossierCard body={msg.body} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  )}
                  {msg.is_internal && (
                    <span className="text-xs text-yellow-600 font-medium">
                      {t("detail.internalNote")}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Staff Reply / Internal Note Form */}
            <form
              onSubmit={handleSendReply}
              className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
            >
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("detail.replyPrompt")}
              </label>
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={
                  isInternalNote
                    ? t("detail.internalPlaceholder")
                    : t("detail.replyPlaceholder")
                }
                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none"
                required
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>{t("detail.internalNoteCheckbox")}</span>
                </label>

                <button
                  type="submit"
                  disabled={isSendingReply || !replyText.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {isSendingReply ? (
                    <span>{t("detail.sending")}</span>
                  ) : (
                    <span>
                      {isInternalNote
                        ? t("detail.addNote")
                        : t("detail.sendReply")}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
