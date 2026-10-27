"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
  lazy,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Home,
  ChevronRight as ChevronRightIcon,
  Database,
  ArrowLeft,
  ArrowRight,
  Settings,
  Eye,
  ChevronDown,
  Table,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AuthRequiredModal } from "@/components/AuthRequiredModal";
import { OrgRequiredModal } from "@/components/bi/OrgRequiredModal";
import { api, BiDatasetResponse } from "@/lib/api";
import { WhatsAppTab, ManualEntryTab } from "@/components/bi/QuickEntry";

// Lazy load heavy components
const Navbar = lazy(() => import("@/components/Navbar"));
const Footer = lazy(() => import("@/components/Footer"));

// ===========================================================================
// TYPES
// ===========================================================================

type UploadStep = "select" | "configure" | "review" | "complete";

interface FilePreview {
  name: string;
  size: number;
  type: string;
  columns?: string[];
  estimatedRows?: number;
  sampleData?: Record<string, string>[];
}

interface FormData {
  name: string;
  description: string;
  domain: string;
  autoProcess: boolean;
  validateData: boolean;
  detectTypes: boolean;
}

// ===========================================================================
// UTILITIES
// ===========================================================================

function formatFileSize(bytes: number, t: (key: string) => string): string {
  if (bytes < 1024) return `${bytes} ${t("bi.common.bytes")}`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} ${t("bi.common.kb")}`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("bi.common.mb")}`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${t("bi.common.gb")}`;
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function isValidFormat(file: File): boolean {
  const validExtensions = ["csv", "json", "xlsx", "xls"];
  return validExtensions.includes(getFileExtension(file.name));
}

function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 5);
  if (lines.length === 0) return ",";
  const delimiters = [",", ";", "\t", "|"];
  let bestDelimiter = ",";
  let maxCount = 0;

  for (const d of delimiters) {
    const counts = lines.map((line) => line.split(d).length);
    const firstCount = counts[0] || 0;
    const isConsistent =
      firstCount > 1 && counts.every((c) => c === firstCount);
    if (isConsistent && firstCount > maxCount) {
      maxCount = firstCount;
      bestDelimiter = d;
    }
  }
  if (maxCount === 0) {
    // Fallback: pick delimiter with highest total occurrences in header
    for (const d of delimiters) {
      const count = (lines[0]?.split(d).length || 1) - 1;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }
  }
  return bestDelimiter;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

async function parseCSVPreview(
  file: File,
): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length === 0) {
        resolve({ columns: [], rows: [] });
        return;
      }
      const delimiter = detectDelimiter(lines.slice(0, 5).join("\n"));
      const headers = parseCSVLine(lines[0] || "", delimiter);
      const rows = lines.slice(1, 6).map((line) => {
        const values = parseCSVLine(line, delimiter);
        const row: Record<string, string> = {};
        headers.forEach((header, i) => {
          row[header] = values[i] || "";
        });
        return row;
      });
      resolve({ columns: headers, rows });
    };
    reader.readAsText(file.slice(0, 20000), "UTF-8");
  });
}

async function parseJSONPreview(
  file: File,
): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const data = Array.isArray(json) ? json : [json];
        const columns = Object.keys(data[0] || {});
        const rows = data.slice(0, 5).map((item) => {
          const row: Record<string, string> = {};
          columns.forEach((col) => {
            row[col] = String(item[col] || "");
          });
          return row;
        });
        resolve({ columns, rows });
      } catch {
        resolve({ columns: [], rows: [] });
      }
    };
    reader.readAsText(file.slice(0, 50000));
  });
}

async function parseExcelPreview(
  file: File,
): Promise<{ columns: string[]; rows: Record<string, string>[] }> {
  return new Promise(async (resolve) => {
    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          });

          if (!jsonData || jsonData.length === 0) {
            resolve({ columns: [], rows: [] });
            return;
          }

          const headers = (jsonData[0] as string[]).map((h) =>
            h ? String(h).trim() : "",
          );
          const rows = jsonData.slice(1, 6).map((row: any) => {
            const rowData: Record<string, string> = {};
            headers.forEach((header, index) => {
              rowData[header] = row[index] ? String(row[index]) : "";
            });
            return rowData;
          });

          resolve({ columns: headers, rows });
        } catch (err) {
          console.error("Excel parse error:", err);
          resolve({ columns: [], rows: [] });
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Failed to load xlsx:", err);
      resolve({ columns: [], rows: [] });
    }
  });
}

function estimateRowCount(size: number, extension: string): number {
  const avgBytesPerRow =
    extension === "json"
      ? 500
      : extension === "xlsx" || extension === "xls"
        ? 200
        : 100;
  return Math.floor(size / avgBytesPerRow);
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================

function Breadcrumb({ t, dir }: { t: (key: string) => string; dir: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
      <Link
        href="/"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
      >
        <Home className="w-4 h-4" />
        <span>{t("bi.datasets.nav.breadcrumb.home")}</span>
      </Link>
      <ChevronRightIcon
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/bi"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("bi.datasets.nav.breadcrumb.bi")}
      </Link>
      <ChevronRightIcon
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <Link
        href="/bi/datasets"
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {t("bi.datasets.nav.breadcrumb.datasets")}
      </Link>
      <ChevronRightIcon
        className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
      />
      <span className="text-gray-900 dark:text-slate-100 font-medium">
        {t("bi.datasets.nav.breadcrumb.upload")}
      </span>
    </nav>
  );
}

function StepIndicator({
  currentStep,
  steps,
  t,
}: {
  currentStep: UploadStep;
  steps: UploadStep[];
  t: (key: string) => string;
}) {
  const stepLabels: Record<UploadStep, string> = {
    select: t("bi.datasets.upload.steps.select"),
    configure: t("bi.datasets.upload.steps.configure"),
    review: t("bi.datasets.upload.steps.review"),
    complete: t("bi.datasets.upload.steps.complete"),
  };
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl transition-all ${
                isActive
                  ? "bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm ring-2 ring-blue-500/20"
                  : isCompleted
                    ? "bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 shadow-xs"
                    : "bg-gray-50/80 dark:bg-slate-800/50 border border-gray-200/80 dark:border-slate-800 text-gray-500 dark:text-slate-400"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : isCompleted
                      ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs"
                      : "bg-gray-200/80 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </span>
              <span
                className={`text-sm hidden sm:block ${
                  isActive
                    ? "font-bold text-blue-700 dark:text-blue-300"
                    : isCompleted
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "font-medium text-gray-600 dark:text-slate-400"
                }`}
              >
                {stepLabels[step]}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-0.5 mx-2 rounded-full transition-colors ${
                  index < currentIndex
                    ? "bg-emerald-500 dark:bg-emerald-400 shadow-xs"
                    : "bg-gray-200 dark:bg-slate-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileDropzone({
  onFileSelect,
  selectedFile,
  isUploading,
  error,
  t,
}: {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  isUploading: boolean;
  error: string | null;
  t: (key: string) => string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && isValidFormat(file)) onFileSelect(file);
    },
    [onFileSelect],
  );
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFileSelect(null);
    },
    [onFileSelect],
  );

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    if (ext === "csv")
      return (
        <FileSpreadsheet className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
      );
    if (ext === "json")
      return (
        <FileJson className="w-12 h-12 text-amber-600 dark:text-amber-400" />
      );
    if (ext === "xlsx" || ext === "xls")
      return <Table className="w-12 h-12 text-blue-600 dark:text-blue-400" />;
    return <FileText className="w-12 h-12 text-gray-500 dark:text-slate-400" />;
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
      <motion.div
        onClick={!selectedFile ? () => inputRef.current?.click() : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-blue-400 bg-blue-50 dark:bg-blue-950/60"
            : selectedFile
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800/80"
              : error
                ? "border-red-400 bg-red-50 dark:bg-red-950/40 dark:border-red-800/80"
                : "border-gray-300 dark:border-slate-700 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/60"
        }`}
        whileHover={{ scale: selectedFile ? 1 : 1.01 }}
        whileTap={{ scale: selectedFile ? 1 : 0.99 }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
              {t("bi.datasets.upload.dropzone.uploading")}
            </p>
            <div className="w-64 h-2 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                initial={{ width: "0%" }}
                animate={{ width: "70%" }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center">
            {getFileIcon(selectedFile.name)}
            <p className="text-lg font-medium text-gray-900 dark:text-slate-100 mt-4 mb-1">
              {selectedFile.name}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {formatFileSize(selectedFile.size, t)}
            </p>
            <button
              onClick={handleRemove}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />{" "}
              {t("bi.datasets.upload.dropzone.remove")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6">
              <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
              {t("bi.datasets.upload.dropzone.title")}
            </p>
            <p className="text-gray-500 dark:text-slate-400 mb-4">
              {t("bi.datasets.upload.dropzone.subtitle")}
            </p>
            <p className="text-sm text-gray-400 mb-2">
              {t("bi.datasets.upload.dropzone.formats")}
            </p>
            <p className="text-xs text-gray-400">
              {t("bi.datasets.upload.dropzone.maxSize")}
            </p>
          </div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-4 left-4 right-4 flex items-center gap-2 p-3 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800/80 rounded-lg"
          >
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {error}
            </span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

function ConfigurationForm({
  formData,
  onChange,
  t,
}: {
  formData: FormData;
  onChange: (data: Partial<FormData>) => void;
  t: (key: string) => string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const domains = [
    { value: "finance", label: t("bi.datasets.list.domains.finance") },
    { value: "marketing", label: t("bi.datasets.list.domains.marketing") },
    { value: "sales", label: t("bi.datasets.list.domains.sales") },
    { value: "operations", label: t("bi.datasets.list.domains.operations") },
    { value: "hr", label: t("bi.datasets.list.domains.hr") },
    { value: "customer", label: t("bi.datasets.list.domains.customer") },
    { value: "product", label: t("bi.datasets.list.domains.product") },
    { value: "other", label: t("bi.datasets.list.domains.other") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
          {t("bi.datasets.upload.form.name.label")}{" "}
          <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t("bi.datasets.upload.form.name.placeholder")}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
          {t("bi.datasets.upload.form.name.hint")}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
          {t("bi.datasets.upload.form.description.label")}
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t("bi.datasets.upload.form.description.placeholder")}
          rows={3}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-slate-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
          {t("bi.datasets.upload.form.description.hint")}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
          {t("bi.datasets.upload.form.domain.label")}
        </label>
        <select
          value={formData.domain}
          onChange={(e) => onChange({ domain: e.target.value })}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          <option value="">
            {t("bi.datasets.upload.form.domain.placeholder")}
          </option>
          {domains.map((domain) => (
            <option key={domain.value} value={domain.value}>
              {domain.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">
          {t("bi.datasets.upload.form.domain.hint")}
        </p>
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
          {t("bi.datasets.upload.form.advanced.title")}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
        </button>
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.autoProcess}
                    onChange={(e) =>
                      onChange({ autoProcess: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-gray-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {t("bi.datasets.upload.form.advanced.autoProcess")}
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.validateData}
                    onChange={(e) =>
                      onChange({ validateData: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-gray-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {t("bi.datasets.upload.form.advanced.validateData")}
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.detectTypes}
                    onChange={(e) =>
                      onChange({ detectTypes: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-gray-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {t("bi.datasets.upload.form.advanced.detectTypes")}
                  </span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReviewStep({
  file,
  preview,
  formData,
  t,
}: {
  file: File | null;
  preview: FilePreview;
  formData: FormData;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          {t("bi.datasets.upload.preview.title")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t("bi.datasets.upload.preview.fileName")}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
              {file ? file.name : formData.name || "Dataset"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t("bi.datasets.upload.preview.fileSize")}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {file ? formatFileSize(file.size, t) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t("bi.datasets.upload.preview.estimatedRows")}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
              ~{preview.estimatedRows?.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {t("bi.datasets.upload.preview.columns")}
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {preview.columns?.length || 0}
            </p>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          {t("bi.datasets.upload.preview.datasetConfiguration")}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-slate-800">
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {t("bi.datasets.upload.form.name.label")}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {formData.name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-slate-800">
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {t("bi.datasets.upload.form.description.label")}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-slate-100 text-right max-w-[60%] truncate">
              {formData.description || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600 dark:text-slate-400">
              {t("bi.datasets.upload.form.domain.label")}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-slate-100 capitalize">
              {formData.domain || "—"}
            </span>
          </div>
        </div>
      </div>
      {preview.sampleData && preview.sampleData.length > 0 && (
        <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 overflow-hidden">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
            {t("bi.datasets.upload.preview.sampleData")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-800">
                  {preview.columns?.map((col, i) => (
                    <th
                      key={i}
                      className="px-3 py-2 text-start text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sampleData.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 dark:border-slate-800"
                  >
                    {preview.columns?.map((col, j) => (
                      <td
                        key={j}
                        className="px-3 py-2 text-gray-700 dark:text-slate-300 truncate max-w-[200px]"
                      >
                        {row[col] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessStep({
  datasetName,
  onUploadAnother,
  onViewDataset,
  t,
}: {
  datasetName: string;
  onUploadAnother: () => void;
  onViewDataset: () => void;
  t: (key: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12"
    >
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
        {t("bi.datasets.upload.success.title")}
      </h2>
      <p className="text-gray-600 dark:text-slate-400 mb-2">
        {t("bi.datasets.upload.success.message")}
      </p>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">
        {t("bi.datasets.upload.success.processing")}
      </p>
      <div className="bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 max-w-md mx-auto mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center">
            <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-start">
            <p className="font-medium text-gray-900 dark:text-slate-100">
              {datasetName}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t("bi.datasets.upload.dropzone.processing")}
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
        {t("bi.datasets.upload.success.whatNext")}
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <motion.button
          onClick={onUploadAnother}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          <Upload className="w-5 h-5" />
          {t("bi.datasets.upload.actions.uploadAnother")}
        </motion.button>
        <motion.button
          onClick={onViewDataset}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
        >
          <Eye className="w-5 h-5" />
          {t("bi.datasets.upload.actions.viewDataset")}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ===========================================================================
// MAIN PAGE
// ===========================================================================

function UploadPageContent() {
  const router = useRouter();
  const t = useTranslations();
  const { dir } = useBidi();
  const { user } = useAuth();
  const {
    isAuthenticated,
    loading: authGuardLoading,
    showAuthModal,
    handleLogin,
    handleSignup,
    handleClose,
  } = useAuthGuard({ redirectTo: "/auth/login", showModal: true });
  const searchParams = useSearchParams();
  const initialTab =
    (searchParams.get("tab") as "file" | "whatsapp" | "manual") || "file";

  const [currentStep, setCurrentStep] = useState<UploadStep>("select");
  const steps: UploadStep[] = ["select", "configure", "review", "complete"];
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    domain: "",
    autoProcess: true,
    validateData: true,
    detectTypes: true,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [uploadedDatasetId, setUploadedDatasetId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"file" | "whatsapp" | "manual">(
    initialTab,
  );
  const [jsonPayload, setJsonPayload] = useState<any[] | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setFilePreview(null);
      return;
    }
    const parseFile = async () => {
      const extension = getFileExtension(selectedFile.name);
      let columns: string[] = [],
        sampleData: Record<string, string>[] = [];
      try {
        if (extension === "csv") {
          const result = await parseCSVPreview(selectedFile);
          columns = result.columns;
          sampleData = result.rows;
        } else if (extension === "json") {
          const result = await parseJSONPreview(selectedFile);
          columns = result.columns;
          sampleData = result.rows;
        } else if (extension === "xlsx" || extension === "xls") {
          const result = await parseExcelPreview(selectedFile);
          columns = result.columns;
          sampleData = result.rows;
        }
      } catch (err) {
        console.error("Failed to parse file:", err);
      }
      setFilePreview({
        name: selectedFile.name,
        size: selectedFile.size,
        type: extension,
        columns,
        estimatedRows: estimateRowCount(selectedFile.size, extension),
        sampleData,
      });
      if (!formData.name) {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
        setFormData((prev) => ({ ...prev, name: baseName }));
      }
    };
    parseFile();
  }, [selectedFile, formData.name]);

  const handleFileSelect = useCallback(
    (file: File | null) => {
      if (file && !isValidFormat(file)) {
        setUploadError(t("bi.datasets.upload.errors.invalidFormat"));
        return;
      }
      if (file && file.size > 100 * 1024 * 1024) {
        setUploadError(t("bi.datasets.upload.errors.fileTooLarge"));
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    },
    [t],
  );

  const handleNext = useCallback(async () => {
    if (currentStep === "select") {
      if (!selectedFile) {
        setUploadError(t("bi.datasets.upload.errors.noFile"));
        return;
      }
      setCurrentStep("configure");
    } else if (currentStep === "configure") {
      if (!formData.name.trim()) return;
      setCurrentStep("review");
    } else if (currentStep === "review") {
      try {
        // Determine organization ID with fallbacks
        const orgId =
          user?.primaryOrganization?.id ||
          user?.ownedOrganization?.id ||
          user?.memberships?.[0]?.organization?.id;

        if (!orgId) {
          setShowOrgModal(true);
          return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);
        if (selectedFile) {
          const response = (await api.uploadDataset(
            selectedFile,
            formData.name,
            formData.description || undefined,
            formData.domain || undefined,
            orgId,
            (percent) => setUploadProgress(percent),
          )) as any;
          if (response.success) {
            setUploadedDatasetId(response.dataset.dataset_id);
            setCurrentStep("complete");
          } else {
            setUploadError(
              response.message || t("bi.datasets.upload.errors.uploadFailed"),
            );
          }
        } else if (jsonPayload) {
          const res = await fetch("/api/bi/datasets/ingest-json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: formData.name,
              description: formData.description || undefined,
              domain: formData.domain || undefined,
              organization_id: orgId,
              records: jsonPayload,
            }),
          });
          const response = await res.json();
          if (response.success) {
            setUploadedDatasetId(response.dataset.dataset_id);
            setCurrentStep("complete");
          } else {
            setUploadError(
              response.message || t("bi.datasets.upload.errors.uploadFailed"),
            );
          }
        }
      } catch (err) {
        console.error("Upload failed:", err);
        setUploadError(t("bi.datasets.upload.errors.uploadFailed"));
      } finally {
        setIsUploading(false);
      }
    }
  }, [currentStep, selectedFile, jsonPayload, formData, t, user]);

  const handleBack = useCallback(() => {
    if (currentStep === "configure") setCurrentStep("select");
    else if (currentStep === "review") setCurrentStep("configure");
  }, [currentStep]);
  const handleUploadAnother = useCallback(() => {
    setSelectedFile(null);
    setJsonPayload(null);
    setFilePreview(null);
    setFormData({
      name: "",
      description: "",
      domain: "",
      autoProcess: true,
      validateData: true,
      detectTypes: true,
    });
    setUploadedDatasetId(null);
    setCurrentStep("select");
  }, []);
  const handleViewDataset = useCallback(() => {
    if (uploadedDatasetId) router.push(`/bi/datasets/${uploadedDatasetId}`);
  }, [router, uploadedDatasetId]);
  const handleQuickEntryCreated = useCallback(
    (datasetId: string) => {
      router.push(`/bi/datasets/${datasetId}`);
    },
    [router],
  );

  const handleDataReady = useCallback(
    (data: any[]) => {
      setJsonPayload(data);
      setFilePreview({
        name:
          activeTab === "whatsapp"
            ? t("bi.datasets.upload.tabs.whatsappData")
            : t("bi.datasets.upload.tabs.manualData"),
        size: JSON.stringify(data).length,
        type: "application/json",
        columns: Object.keys(data[0] || {}),
        estimatedRows: data.length,
        sampleData: data.slice(0, 5),
      });
      const dateStr = new Date().toLocaleDateString();
      setFormData((prev) => ({
        ...prev,
        name:
          activeTab === "whatsapp"
            ? t("bi.datasets.upload.tabs.whatsappImport", { date: dateStr })
            : t("bi.datasets.upload.tabs.manualImport", { date: dateStr }),
      }));
      setCurrentStep("configure");
    },
    [activeTab, t],
  );

  const canProceed = useMemo(() => {
    if (currentStep === "select") return !!selectedFile || !!jsonPayload;
    if (currentStep === "configure") return !!formData.name.trim();
    return true;
  }, [currentStep, selectedFile, jsonPayload, formData.name]);

  if (authGuardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      dir={dir}
    >
      <Suspense
        fallback={
          <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800"></div>
        }
      >
        <Navbar />
      </Suspense>
      {/* Auth Required Modal */}
      <AuthRequiredModal
        isOpen={showAuthModal}
        onClose={handleClose}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
      <OrgRequiredModal
        isOpen={showOrgModal}
        onClose={() => setShowOrgModal(false)}
      />

      <main
        className={`pt-32 pb-16 px-4 sm:px-6 lg:px-8 mx-auto transition-all duration-500 ease-out ${activeTab === "manual" ? "max-w-[1400px]" : "max-w-4xl"}`}
      >
        <Breadcrumb t={t} dir={dir} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {t("bi.datasets.upload.title")}
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            {t("bi.datasets.upload.subtitle")}
          </p>
        </motion.div>

        <StepIndicator currentStep={currentStep} steps={steps} t={t} />

        {/* Tabs */}
        {currentStep === "select" && (
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-8 mx-auto max-w-md">
            <button
              onClick={() => setActiveTab("file")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === "file" ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300"}`}
            >
              {t("bi.datasets.upload.tabs.file")}
            </button>
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === "whatsapp" ? "bg-white dark:bg-slate-900 text-green-600 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300"}`}
            >
              {t("bi.datasets.upload.tabs.whatsapp")}
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${activeTab === "manual" ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300"}`}
            >
              {t("bi.datasets.upload.tabs.manual")}
            </button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-slate-800/50 rounded-2xl p-6 sm:p-8 shadow-sm"
        >
          <AnimatePresence mode="wait">
            {/* File Upload - Select Step */}
            {currentStep === "select" && activeTab === "file" && (
              <motion.div
                key="file-select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <FileDropzone
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  isUploading={false}
                  error={uploadError}
                  t={t}
                />
              </motion.div>
            )}

            {/* WhatsApp - Select Step */}
            {currentStep === "select" && activeTab === "whatsapp" && (
              <motion.div
                key="whatsapp-select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <WhatsAppTab onDataReady={handleDataReady} />
              </motion.div>
            )}

            {/* Manual Entry - Select Step */}
            {currentStep === "select" && activeTab === "manual" && (
              <motion.div
                key="manual-select"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ManualEntryTab onDataReady={handleDataReady} />
              </motion.div>
            )}

            {/* Configure Step */}
            {currentStep === "configure" && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ConfigurationForm
                  formData={formData}
                  onChange={(data) =>
                    setFormData((prev) => ({ ...prev, ...data }))
                  }
                  t={t}
                />
              </motion.div>
            )}

            {/* Review Step */}
            {currentStep === "review" &&
              (selectedFile || jsonPayload) &&
              filePreview && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <ReviewStep
                    file={selectedFile}
                    preview={filePreview}
                    formData={formData}
                    t={t}
                  />
                  {isUploading && selectedFile && (
                    <div
                      className="mt-6 space-y-2"
                      role="progressbar"
                      aria-valuenow={uploadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t("bi.datasets.upload.dropzone.uploading")}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-gray-700 dark:text-slate-300 font-medium">
                          <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                          {t("bi.datasets.upload.dropzone.uploading")}
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {uploadProgress}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 dark:bg-slate-800/90 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                          initial={{ width: "0%" }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ ease: "easeOut", duration: 0.2 }}
                        />
                      </div>
                    </div>
                  )}
                  {uploadError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl"
                    >
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <span className="text-sm text-red-700 dark:text-red-300">
                        {uploadError}
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )}

            {/* Complete Step */}
            {currentStep === "complete" && uploadedDatasetId && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <SuccessStep
                  datasetName={formData.name}
                  onUploadAnother={handleUploadAnother}
                  onViewDataset={handleViewDataset}
                  t={t}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons - hide on complete */}
          {currentStep !== "complete" && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-slate-800">
              <div>
                {currentStep !== "select" && (
                  <motion.button
                    onClick={handleBack}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isUploading}
                    className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t("bi.datasets.upload.actions.back")}
                  </motion.button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/bi/datasets"
                  className="px-4 py-2 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 transition-colors"
                >
                  {t("bi.datasets.upload.actions.cancel")}
                </Link>
                <motion.button
                  onClick={handleNext}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!canProceed || isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t("bi.datasets.upload.dropzone.uploading")}
                    </>
                  ) : currentStep === "review" ? (
                    <>
                      <Upload className="w-5 h-5" />
                      {t("bi.datasets.upload.actions.upload")}
                    </>
                  ) : (
                    <>
                      {t("bi.datasets.upload.actions.next")}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <Suspense
        fallback={<div className="h-64 bg-gray-50 dark:bg-slate-900/60"></div>}
      >
        <Footer />
      </Suspense>
    </div>
  );
}

export default function UploadDatasetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}
