"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  Plus,
  Calendar,
  ArrowRight,
  X,
  Grid3X3,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { formatDZD } from "@/lib/formatDZD";
import SpreadsheetEntry from "./SpreadsheetEntry";

interface ParsedRecord {
  date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  currency: string;
  source: string;
  quantity?: number;
}

interface QuickEntryProps {
  onDatasetCreated?: (datasetId: string) => void;
  onDataReady?: (data: any[]) => void;
}

// ─── WhatsApp Tab ───────────────────────────────────────────────────

function WhatsAppTab({ onDatasetCreated, onDataReady }: QuickEntryProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const [rawText, setRawText] = useState("");
  const [parsedRecords, setParsedRecords] = useState<ParsedRecord[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleParse = useCallback(async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    setError(null);
    setParsedRecords([]);

    try {
      const res = await fetch("/api/bi/datasets/parse-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ raw_text: rawText }),
      });

      const data = await res.json();
      if (data.success && data.records?.length > 0) {
        setParsedRecords(data.records);
      } else {
        setError(t("bi.datasets.whatsapp.result.none"));
      }
    } catch {
      setError(t("bi.datasets.quickEntry.errors.parseFailed"));
    } finally {
      setIsParsing(false);
    }
  }, [rawText, t]);

  const handleSave = useCallback(async () => {
    if (!parsedRecords.length) return;

    if (!onDataReady) {
      setError(t("bi.datasets.quickEntry.errors.handlerNotConfigured"));
      return;
    }

    onDataReady(parsedRecords);
  }, [parsedRecords, onDataReady, t]);

  const categoryColors: Record<string, string> = {
    vente: "bg-emerald-100 text-emerald-700",
    revenu: "bg-blue-100 text-blue-700",
    achat: "bg-orange-100 text-orange-700",
    depense: "bg-red-100 text-red-700",
    facture: "bg-amber-100 text-amber-700",
    stock: "bg-purple-100 text-purple-700",
    autre: "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300",
  };

  if (saved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          {t("bi.datasets.upload.success.title")}
        </h3>
        <p className="text-gray-600 dark:text-slate-400">
          {t("bi.datasets.upload.success.message")}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Input Area */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
          <MessageCircle className="w-4 h-4 inline-block mr-1.5 text-green-600" />
          {t("bi.datasets.whatsapp.title")}
        </label>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
          {t("bi.datasets.whatsapp.subtitle")}
        </p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={t("bi.datasets.whatsapp.placeholder")}
          rows={8}
          dir="auto"
          className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none font-mono text-sm"
        />
        <motion.button
          onClick={handleParse}
          disabled={!rawText.trim() || isParsing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isParsing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
          {isParsing
            ? t("bi.datasets.whatsapp.parsing")
            : t("bi.datasets.whatsapp.parse")}
        </motion.button>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl"
        >
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">
            {error}
          </span>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {parsedRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                {t("bi.datasets.whatsapp.result.title")}
                <span className="ml-2 text-sm font-normal text-emerald-600 dark:text-emerald-400">
                  {t("bi.datasets.whatsapp.result.found", {
                    count: String(parsedRecords.length),
                  })}
                </span>
              </h3>
              <motion.button
                onClick={handleSave}
                disabled={isSaving}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : onDataReady ? (
                  <ArrowRight className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving
                  ? t("bi.datasets.whatsapp.result.saving")
                  : onDataReady
                    ? t("bi.datasets.upload.actions.next")
                    : t("bi.datasets.whatsapp.result.save")}
              </motion.button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-slate-900/60">
                  <tr>
                    <th className="px-3 py-2.5 text-start font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">
                      {t("bi.datasets.whatsapp.columns.date")}
                    </th>
                    <th className="px-3 py-2.5 text-start font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">
                      {t("bi.datasets.whatsapp.columns.description")}
                    </th>
                    <th className="px-3 py-2.5 text-start font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">
                      {t("bi.datasets.whatsapp.columns.category")}
                    </th>
                    <th className="px-3 py-2.5 text-start font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">
                      {t("bi.datasets.whatsapp.columns.type")}
                    </th>
                    <th className="px-3 py-2.5 text-end font-semibold text-gray-500 dark:text-slate-400 text-xs uppercase">
                      {t("bi.datasets.whatsapp.columns.amount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRecords.map((record, i) => (
                    <tr
                      key={i}
                      className="border-t border-gray-100 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-3 py-2.5 text-gray-700 dark:text-slate-300 whitespace-nowrap">
                        {record.date}
                      </td>
                      <td
                        className="px-3 py-2.5 text-gray-900 dark:text-slate-100 max-w-[200px] truncate"
                        dir="auto"
                      >
                        {record.description}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold ${categoryColors[record.category] || categoryColors.autre}`}
                        >
                          {record.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-xs font-semibold ${record.type === "revenu" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {record.type === "revenu" ? "↑" : "↓"} {record.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-end font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap">
                        {formatDZD(record.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Manual Entry Tab ───────────────────────────────────────────────

interface ManualRow {
  date: string;
  description: string;
  category: string;
  type: string;
  amount: string;
}

function ManualEntryTab({ onDatasetCreated, onDataReady }: QuickEntryProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const [mode, setMode] = useState<"sheet" | "form">("sheet");
  const [rows, setRows] = useState<ManualRow[]>([
    {
      date: new Date().toISOString().split("T")[0],
      description: "",
      category: "vente",
      type: "revenu",
      amount: "",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addRow = () => {
    setRows([
      ...rows,
      {
        date: new Date().toISOString().split("T")[0],
        description: "",
        category: "vente",
        type: "revenu",
        amount: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof ManualRow, value: string) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    // Auto-set type based on category
    if (field === "category") {
      updated[index].type = ["vente", "revenu"].includes(value)
        ? "revenu"
        : "depense";
    }
    setRows(updated);
  };

  const handleSubmit = useCallback(async () => {
    const validRows = rows.filter(
      (r) => r.description.trim() && parseFloat(r.amount) > 0,
    );
    if (!validRows.length) return;

    if (!onDataReady) {
      setError(t("bi.datasets.quickEntry.errors.handlerNotConfigured"));
      return;
    }

    onDataReady(
      validRows.map((r) => ({
        date: r.date,
        description: r.description,
        category: r.category,
        type: r.type,
        amount: parseFloat(r.amount),
      })),
    );
  }, [rows, onDataReady]);

  const categories = [
    { value: "vente", label: t("bi.datasets.manual.categories.vente") },
    { value: "achat", label: t("bi.datasets.manual.categories.achat") },
    { value: "depense", label: t("bi.datasets.manual.categories.depense") },
    { value: "revenu", label: t("bi.datasets.manual.categories.revenu") },
    { value: "facture", label: t("bi.datasets.manual.categories.facture") },
    { value: "stock", label: t("bi.datasets.manual.categories.stock") },
    { value: "autre", label: t("bi.datasets.manual.categories.autre") },
  ];

  if (saved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          {t("bi.datasets.upload.success.title")}
        </h3>
        <p className="text-gray-600 dark:text-slate-400">
          {t("bi.datasets.upload.success.message")}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {t("bi.datasets.manual.title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("bi.datasets.manual.subtitle")}
          </p>
        </div>
        <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl p-0.5">
          <button
            onClick={() => setMode("sheet")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === "sheet"
                ? "bg-white dark:bg-slate-900 text-blue-700 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white dark:text-slate-300"
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            {t("bi.datasets.manual.modeSheet")}
          </button>
          <button
            onClick={() => setMode("form")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === "form"
                ? "bg-white dark:bg-slate-900 text-blue-700 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white dark:text-slate-300"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {t("bi.datasets.manual.modeForm")}
          </button>
        </div>
      </div>

      {/* Spreadsheet mode */}
      {mode === "sheet" && (
        <SpreadsheetEntry
          onDatasetCreated={onDatasetCreated}
          onDataReady={onDataReady}
        />
      )}

      {/* Form mode (original) */}
      {mode === "form" && (
        <>
          <div className="space-y-3">
            {rows.map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:items-center p-3.5 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-200 dark:border-slate-800 relative"
              >
                <div className="w-full sm:col-span-3 md:col-span-2">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(i, "date", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="w-full sm:col-span-4 md:col-span-3">
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) =>
                      updateRow(i, "description", e.target.value)
                    }
                    placeholder={t(
                      "bi.datasets.manual.fields.descriptionPlaceholder",
                    )}
                    dir="auto"
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="w-full sm:col-span-2">
                  <select
                    value={row.category}
                    onChange={(e) => updateRow(i, "category", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:col-span-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => updateRow(i, "amount", e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pe-8"
                    />
                    <span className="absolute end-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">
                      {t("bi.datasets.manual.currency")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end sm:col-span-1 gap-2 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/50 dark:border-slate-800/50">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-lg ${row.type === "revenu" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"}`}
                  >
                    {row.type === "revenu" ? "↑" : "↓"}
                  </span>
                  <button
                    onClick={() => removeRow(i)}
                    aria-label={t("bi.datasets.manual.removeRow")}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-500 dark:text-red-400 transition-colors"
                    disabled={rows.length === 1}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <motion.button
              onClick={addRow}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-200 transition-all text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t("bi.datasets.manual.addRow")}
            </motion.button>

            <motion.button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !rows.some(
                  (r) => r.description.trim() && parseFloat(r.amount) > 0,
                )
              }
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : onDataReady ? (
                <ArrowRight className="w-5 h-5" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isSubmitting
                ? t("bi.datasets.manual.submitting")
                : onDataReady
                  ? t("bi.datasets.upload.actions.next")
                  : t("bi.datasets.manual.submit")}
            </motion.button>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl"
        >
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">
            {error}
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ─── Export ─────────────────────────────────────────────────────────

export { WhatsAppTab, ManualEntryTab };
export type { QuickEntryProps };
