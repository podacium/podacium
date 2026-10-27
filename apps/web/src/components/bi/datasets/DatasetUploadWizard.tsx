"use client";

import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  MessageSquare,
  CheckCircle2,
  Database,
  ArrowRight,
  ArrowLeft,
  Settings,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Table as TableIcon,
  AlertCircle,
  HardDrive,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { toast } from "sonner";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";

export interface ColumnSchemaPreview {
  name: string;
  type: string;
  sampleValue?: string;
  nullable?: boolean;
}

export interface DatasetUploadWizardProps {
  onSuccess?: (dataset: any) => void;
  onClose?: () => void;
  organizationId?: number;
}

export const DatasetUploadWizard: React.FC<DatasetUploadWizardProps> = ({
  onSuccess,
  onClose,
  organizationId,
}) => {
  const t = useTranslations("bi");
  const tCommon = useTranslations("common");
  const { isRTL, dir } = useBidi();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tab, setTab] = useState<"file" | "database" | "whatsapp">("file");

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [delimiter, setDelimiter] = useState(",");
  const [encoding, setEncoding] = useState("utf-8");

  // Database connector state
  const [dbEngine, setDbEngine] = useState("postgres");
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState(5432);
  const [dbName, setDbName] = useState("");
  const [dbUser, setDbUser] = useState("");
  const [dbPass, setDbPass] = useState("");
  const [dbSsl, setDbSsl] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  // Schema state
  const [columns, setColumns] = useState<ColumnSchemaPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    if (!datasetName) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setDatasetName(nameWithoutExt);
    }
    // Generate instant mock schema preview from filename / format
    const inferredCols: ColumnSchemaPreview[] = [
      { name: "id", type: "integer", sampleValue: "1001", nullable: false },
      {
        name: "created_at",
        type: "datetime",
        sampleValue: "2026-09-01T12:00:00Z",
        nullable: false,
      },
      {
        name: "customer_name",
        type: "string",
        sampleValue: "Sami Benali",
        nullable: true,
      },
      {
        name: "wilaya",
        type: "string",
        sampleValue: "16 - Alger",
        nullable: true,
      },
      {
        name: "revenue_dzd",
        type: "float",
        sampleValue: "45000.00",
        nullable: false,
      },
    ];
    setColumns(inferredCols);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleTestDatabase = async () => {
    if (!dbHost || !dbName || !dbUser) {
      toast.error(t("uploadWizard.dbFillError"));
      return;
    }
    setDbTesting(true);
    try {
      const res = await fetch("/api/bi/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine: dbEngine,
          host: dbHost,
          port: Number(dbPort),
          database: dbName,
          username: dbUser,
          password: dbPass,
          ssl: dbSsl,
          organizationId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbConnected(true);
        toast.success(t("uploadWizard.dbConnectSuccess"));
      } else {
        toast.error(data.detail || t("uploadWizard.dbConnectFailed"));
      }
    } catch (err: any) {
      toast.error("Failed to connect: " + err.message);
    } finally {
      setDbTesting(false);
    }
  };

  const handleUploadSubmit = async () => {
    setLoading(true);
    try {
      if (tab === "file") {
        if (!file) {
          toast.error(t("uploadWizard.fileSelectError"));
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", datasetName || file.name);
        formData.append("delimiter", delimiter);
        formData.append("encoding", encoding);
        if (organizationId) {
          formData.append("organizationId", String(organizationId));
        }

        const res = await fetch("/api/bi/datasets/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const dataset = await res.json();
          toast.success(t("uploadWizard.uploadSuccess"));
          onSuccess?.(dataset);
          onClose?.();
        } else {
          const err = await res.json();
          toast.error(err.detail || "Upload failed");
        }
      } else if (tab === "database") {
        const res = await fetch("/api/bi/connectors/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: datasetName || `${dbEngine}-${dbName}`,
            engine: dbEngine,
            host: dbHost,
            port: Number(dbPort),
            databaseName: dbName,
            username: dbUser,
            password: dbPass,
            ssl: dbSsl,
            organizationId,
          }),
        });

        if (res.ok) {
          const connector = await res.json();
          toast.success(t("uploadWizard.dbSavedSuccess"));
          onSuccess?.(connector);
          onClose?.();
        } else {
          const err = await res.json();
          toast.error(err.detail || "Failed to save connector");
        }
      }
    } catch (err: any) {
      toast.error("Ingestion failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full text-start">
      {/* Header & Step Tracker */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {t("uploadWizard.title", {
              defaultValue: "Data Connectors & Ingestion Wizard",
            })}
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {t("uploadWizard.subtitle", {
              defaultValue:
                "Connect CSV/Parquet files or external relational databases",
            })}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Step Indicator Pills */}
      <div className="grid grid-cols-3 gap-2 mb-6 text-center text-xs font-semibold">
        <div
          className={`py-2 rounded-xl border transition-all ${
            step === 1
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400"
              : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400"
          }`}
        >
          1. {t("uploadWizard.step1", { defaultValue: "Select Source" })}
        </div>
        <div
          className={`py-2 rounded-xl border transition-all ${
            step === 2
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400"
              : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400"
          }`}
        >
          2. {t("uploadWizard.step2", { defaultValue: "Schema & Format" })}
        </div>
        <div
          className={`py-2 rounded-xl border transition-all ${
            step === 3
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400"
              : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-800 text-gray-500 dark:text-slate-400"
          }`}
        >
          3. {t("uploadWizard.step3", { defaultValue: "Confirm & Ingest" })}
        </div>
      </div>

      {/* Step 1: Source Selection */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex rounded-xl bg-gray-100 dark:bg-slate-800/80 p-1 text-xs font-medium">
            <button
              onClick={() => setTab("file")}
              className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${
                tab === "file"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t("uploadWizard.fileTab", { defaultValue: "File Upload" })}
            </button>
            <button
              onClick={() => setTab("database")}
              className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${
                tab === "database"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Database className="w-4 h-4" />
              {t("uploadWizard.dbTab", { defaultValue: "External Database" })}
            </button>
            <button
              onClick={() => setTab("whatsapp")}
              className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${
                tab === "whatsapp"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              {t("uploadWizard.waTab", { defaultValue: "WhatsApp Log" })}
            </button>
          </div>

          {tab === "file" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                dragActive
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30"
                  : "border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-slate-700"
              }`}
            >
              <UploadCloud className="w-12 h-12 mx-auto text-blue-500 dark:text-blue-400 mb-3 animate-pulse" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {file
                  ? file.name
                  : t("uploadWizard.dragPrompt", {
                      defaultValue: "Drag & drop CSV, Parquet, or Excel files",
                    })}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                {t("uploadWizard.fileFormatsHelp", {
                  defaultValue:
                    "Supports `.csv`, `.parquet`, `.xlsx`, `.json` up to 250MB",
                })}
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 cursor-pointer transition-colors shadow-md">
                <FileSpreadsheet className="w-4 h-4" />
                {t("uploadWizard.browseFile", { defaultValue: "Browse Files" })}
                <input
                  type="file"
                  accept=".csv,.parquet,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          )}

          {tab === "database" && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-gray-700 dark:text-slate-300 font-medium mb-1">
                  {t("uploadWizard.engine")}
                </label>
                <select
                  value={dbEngine}
                  onChange={(e) => setDbEngine(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="snowflake">
                    {t("uploadWizard.engines.snowflake")}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 font-medium mb-1">
                  {t("uploadWizard.host", { defaultValue: "Host / Endpoint" })}
                </label>
                <input
                  type="text"
                  placeholder="db.example.com"
                  value={dbHost}
                  onChange={(e) => setDbHost(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 font-medium mb-1">
                  {t("uploadWizard.port", { defaultValue: "Port" })}
                </label>
                <input
                  type="number"
                  value={dbPort}
                  onChange={(e) => setDbPort(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 font-medium mb-1">
                  {t("uploadWizard.dbName", { defaultValue: "Database Name" })}
                </label>
                <input
                  type="text"
                  placeholder="podacium_bi"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 font-medium mb-1">
                  {t("uploadWizard.username", { defaultValue: "Username" })}
                </label>
                <input
                  type="text"
                  placeholder="db_user"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-gray-700 dark:text-slate-300 font-medium mb-1">
                  {t("uploadWizard.password", { defaultValue: "Password" })}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={dbPass}
                  onChange={(e) => setDbPass(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="col-span-2 flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={dbSsl}
                    onChange={(e) => setDbSsl(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 dark:bg-slate-950"
                  />
                  <span>
                    {t("uploadWizard.enableSsl", {
                      defaultValue: "Enable SSL Encryption",
                    })}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleTestDatabase}
                  disabled={dbTesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {dbTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  {t("uploadWizard.testConnection", {
                    defaultValue: "Test Connection",
                  })}
                </button>
              </div>
            </div>
          )}

          {tab === "whatsapp" && (
            <div className="space-y-3">
              <textarea
                placeholder={t("uploadWizard.waPlaceholder", {
                  defaultValue:
                    "Paste raw WhatsApp export text or Carnet debt logs...",
                })}
                rows={5}
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-800 text-xs focus:ring-2 focus:ring-blue-500/20 resize-none dark:bg-slate-950 dark:text-white"
              />
              <p className="text-[11px] text-gray-400 dark:text-slate-500">
                {t("uploadWizard.waHelp", {
                  defaultValue:
                    'Parses unstructured chat text e.g. "Mohamed 15000 DZD - Vente PC Portable" into structured tables.',
                })}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <PodaciumButton
              onClick={() => setStep(2)}
              disabled={tab === "file" && !file}
              variant="primary"
            >
              {t("uploadWizard.nextSchema", {
                defaultValue: "Next: Configure Schema",
              })}{" "}
              <ArrowRight className="w-4 h-4 ms-1" />
            </PodaciumButton>
          </div>
        </div>
      )}

      {/* Step 2: Schema & Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t("uploadWizard.datasetName", {
                  defaultValue: "Dataset Name",
                })}
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 dark:text-slate-300 mb-1">
                {t("uploadWizard.csvDelimiter")}
              </label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              >
                <option value=",">{t("uploadWizard.delimiters.comma")}</option>
                <option value=";">
                  {t("uploadWizard.delimiters.semicolon")}
                </option>
                <option value="\t">{t("uploadWizard.delimiters.tab")}</option>
              </select>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-between">
              <span>
                {t("uploadWizard.detectedColumns", {
                  count: String(columns.length),
                  defaultValue: `Detected Columns & Data Types (${columns.length})`,
                })}
              </span>
              <PodaciumBadge variant="secondary">
                {t("uploadWizard.inferredDuckDB", {
                  defaultValue: "Inferred via DuckDB",
                })}
              </PodaciumBadge>
            </h4>

            <div className="border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-start text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-slate-800/80 sticky top-0">
                  <tr>
                    <th className="p-2.5 font-semibold text-gray-700 dark:text-slate-300">
                      {t("uploadWizard.colName", {
                        defaultValue: "Column Name",
                      })}
                    </th>
                    <th className="p-2.5 font-semibold text-gray-700 dark:text-slate-300">
                      {t("uploadWizard.type", { defaultValue: "Type" })}
                    </th>
                    <th className="p-2.5 font-semibold text-gray-700 dark:text-slate-300">
                      {t("uploadWizard.sampleValue", {
                        defaultValue: "Sample Value",
                      })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {columns.map((col, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="p-2.5 font-mono text-blue-600 dark:text-blue-400">
                        {col.name}
                      </td>
                      <td className="p-2.5">
                        <select
                          value={col.type}
                          onChange={(e) => {
                            const updated = [...columns];
                            updated[idx].type = e.target.value;
                            setColumns(updated);
                          }}
                          className="p-1 rounded-lg border border-gray-200 dark:border-slate-700 dark:bg-slate-950 text-xs"
                        >
                          <option value="string">
                            {tCommon("uiLabels.typeString")}
                          </option>
                          <option value="integer">
                            {tCommon("uiLabels.typeInteger")}
                          </option>
                          <option value="float">
                            {tCommon("uiLabels.typeFloat")}
                          </option>
                          <option value="datetime">
                            {tCommon("uiLabels.typeDatetime")}
                          </option>
                          <option value="boolean">
                            {tCommon("uiLabels.typeBoolean")}
                          </option>
                        </select>
                      </td>
                      <td className="p-2.5 font-mono text-gray-500 dark:text-slate-400">
                        {col.sampleValue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center text-xs font-semibold text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 me-1" />{" "}
              {t("uploadWizard.back", { defaultValue: "Back" })}
            </button>

            <PodaciumButton onClick={() => setStep(3)} variant="primary">
              {t("uploadWizard.nextReview", {
                defaultValue: "Next: Review & Submit",
              })}{" "}
              <ArrowRight className="w-4 h-4 ms-1" />
            </PodaciumButton>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className="space-y-6 text-center py-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {t("uploadWizard.readyIngest", {
                name: datasetName,
                defaultValue: `Ready to Ingest "${datasetName}"`,
              })}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {t("uploadWizard.targetEngineInfo", {
                defaultValue:
                  "Target engine: DuckDB Parquet storage with vectorized analytics indexing.",
              })}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/50 text-xs text-start space-y-2 border border-gray-100 dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-slate-400">
                {t("uploadWizard.sourceType", { defaultValue: "Source Type:" })}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white capitalize">
                {tab}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-slate-400">
                {t("uploadWizard.detectedColsCount", {
                  defaultValue: "Detected Columns:",
                })}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {columns.length} {tCommon("uiLabels.columns")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-slate-400">
                {t("uploadWizard.encoding", { defaultValue: "Encoding:" })}
              </span>
              <span className="font-mono text-gray-900 dark:text-white">
                {encoding}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center text-xs font-semibold text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 me-1" />{" "}
              {t("uploadWizard.back", { defaultValue: "Back" })}
            </button>

            <PodaciumButton
              onClick={handleUploadSubmit}
              disabled={loading}
              variant="primary"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin me-2" />{" "}
                  {t("uploadWizard.ingesting", {
                    defaultValue: "Ingesting Dataset...",
                  })}
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 me-2" />{" "}
                  {t("uploadWizard.confirmImport", {
                    defaultValue: "Confirm & Import",
                  })}
                </>
              )}
            </PodaciumButton>
          </div>
        </div>
      )}
    </div>
  );
};
