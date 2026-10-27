"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Edit3, BarChart2, Check, X, Loader2 } from "lucide-react";
import { api, BiDatasetMetadata } from "@/lib/api";
import {
  DATA_TYPES,
  SEMANTIC_TYPES,
  getSqlTypeLabel,
  getSemanticTypeLabel,
} from "./types";

function resolveColumnMeta(
  col: any,
  dataset?: BiDatasetMetadata,
  sampleData?: Record<string, unknown>[],
) {
  const colName = typeof col === "string" ? col : col?.name || String(col);
  const colMeta =
    typeof col === "object" ? col : dataset?.column_metadata?.[colName] || {};

  let dataType = colMeta.type || colMeta.data_type || colMeta.native_type;
  let semanticType = colMeta.semantic_type;

  const lowerName = colName.toLowerCase().trim();

  const isGenericSemantic =
    !semanticType ||
    ["STRING", "TEXT", "VARCHAR", "GENERIC", "UNSPECIFIED", "NUMERIC"].includes(
      String(semanticType).toUpperCase(),
    );

  const isGenericDataType =
    !dataType ||
    ["VARCHAR", "TEXT", "STRING"].includes(String(dataType).toUpperCase());

  // Force Age/Âge/العمر -> AGE semantic type and INTEGER data type
  if (
    lowerName === "age" ||
    lowerName.includes("age") ||
    lowerName.includes("âge") ||
    lowerName.includes("العمر")
  ) {
    if (isGenericSemantic || semanticType === "NUMERIC") semanticType = "AGE";
    if (isGenericDataType) dataType = "INTEGER";
  }

  // Force Sexe/Gender -> GENDER semantic type
  if (
    lowerName.includes("gender") ||
    lowerName.includes("sex") ||
    lowerName.includes("sexe") ||
    lowerName.includes("jins") ||
    lowerName.includes("جنس")
  ) {
    semanticType = "GENDER";
  }

  // Force Fumeur / Antecedents / Maladie -> STATUS semantic type
  if (
    lowerName.includes("fumeur") ||
    lowerName.includes("smoker") ||
    lowerName.includes("tabac") ||
    lowerName.includes("تدخين") ||
    lowerName.includes("antecedent") ||
    lowerName.includes("maladie") ||
    lowerName.includes("disease")
  ) {
    if (isGenericSemantic) semanticType = "STATUS";
  }

  // Force Date/Year -> DATETIME or YEAR
  if (
    lowerName === "date" ||
    lowerName.includes("date") ||
    lowerName.includes("timestamp") ||
    lowerName.includes("created_at")
  ) {
    if (isGenericSemantic || semanticType === "NUMERIC")
      semanticType = "DATETIME";
    if (isGenericDataType) dataType = "DATE";
  } else if (
    lowerName === "year" ||
    lowerName === "annee" ||
    lowerName === "yr"
  ) {
    if (isGenericSemantic || semanticType === "NUMERIC") semanticType = "YEAR";
    if (isGenericDataType) dataType = "INTEGER";
  }

  // Force Country -> COUNTRY
  if (
    lowerName.includes("country") ||
    lowerName.includes("pays") ||
    lowerName.includes("nation") ||
    lowerName.includes("دولة") ||
    lowerName.includes("بلد")
  ) {
    semanticType = "COUNTRY";
  }

  // Force Macroeconomic Currency Metrics
  if (
    lowerName === "gdp" ||
    lowerName.includes("gdp") ||
    lowerName.includes("pib") ||
    lowerName.includes("export") ||
    lowerName.includes("import") ||
    lowerName.includes("gfcf") ||
    lowerName.includes("fbcg") ||
    lowerName === "g"
  ) {
    if (isGenericSemantic || semanticType === "NUMERIC")
      semanticType = "CURRENCY";
  }

  // Force Macroeconomic Rate & Percentage Metrics
  if (
    lowerName === "inf" ||
    lowerName.includes("inflation") ||
    lowerName.includes("unemployment") ||
    lowerName.includes("chomage") ||
    lowerName.includes("exch") ||
    lowerName.includes("exchange")
  ) {
    if (isGenericSemantic || semanticType === "NUMERIC")
      semanticType = "PERCENTAGE";
  }

  if (isGenericDataType) {
    if (sampleData && sampleData.length > 0) {
      const sampleVals = sampleData
        .map((r) => r[colName])
        .filter(
          (v) => v !== null && v !== undefined && String(v).trim() !== "",
        );
      if (sampleVals.length > 0) {
        const isAllNumeric = sampleVals.every((v) => !isNaN(Number(v)));
        const isAllInt =
          isAllNumeric && sampleVals.every((v) => Number.isInteger(Number(v)));
        if (isAllInt) {
          dataType = "INTEGER";
        } else if (isAllNumeric) {
          dataType = "FLOAT";
        } else {
          const isDate = sampleVals.some(
            (v) =>
              typeof v === "string" &&
              !isNaN(Date.parse(v)) &&
              (v.includes("-") || v.includes("/")),
          );
          if (isDate) dataType = "TIMESTAMP";
        }
      }
    }
  }

  if (!dataType) dataType = "VARCHAR";

  if (isGenericSemantic) {
    if (
      lowerName.includes("gender") ||
      lowerName.includes("sex") ||
      lowerName.includes("sexe") ||
      lowerName.includes("jins") ||
      lowerName.includes("جنس")
    ) {
      semanticType = "GENDER";
    } else if (
      lowerName.includes("age") ||
      lowerName.includes("âge") ||
      lowerName.includes("العمر")
    ) {
      semanticType = "AGE";
    } else if (
      lowerName.includes("fumeur") ||
      lowerName.includes("smoker") ||
      lowerName.includes("tabac") ||
      lowerName.includes("تدخين") ||
      lowerName.includes("antecedent") ||
      lowerName.includes("maladie") ||
      lowerName.includes("disease")
    ) {
      semanticType = "STATUS";
    } else if (
      lowerName.includes("commune") ||
      lowerName.includes("baladiya") ||
      lowerName.includes("بلدية")
    ) {
      semanticType = "COMMUNE";
    } else if (
      lowerName.includes("wilaya") ||
      lowerName.includes("province_dz")
    ) {
      semanticType = "ALGERIAN_WILAYA";
    } else if (lowerName.includes("latitude") || lowerName === "lat") {
      semanticType = "LATITUDE";
    } else if (
      lowerName.includes("longitude") ||
      lowerName === "lon" ||
      lowerName === "lng"
    ) {
      semanticType = "LONGITUDE";
    } else if (lowerName.includes("mac") || lowerName.includes("mac_address")) {
      semanticType = "MAC_ADDRESS";
    } else if (
      lowerName.includes("card_number") ||
      lowerName.includes("credit_card") ||
      lowerName.includes("pan")
    ) {
      semanticType = "CREDIT_CARD";
    } else if (
      lowerName.includes("duration") ||
      lowerName.includes("duree") ||
      lowerName.includes("time_spent") ||
      lowerName.includes("elapsed")
    ) {
      semanticType = "DURATION";
    } else if (
      dataType === "INTEGER" ||
      dataType === "FLOAT" ||
      dataType === "DOUBLE" ||
      dataType === "BIGINT" ||
      dataType === "NUMERIC"
    ) {
      if (lowerName.includes("age")) semanticType = "AGE";
      else if (
        lowerName === "gdp" ||
        lowerName.includes("gdp") ||
        lowerName.includes("pib") ||
        lowerName.includes("export") ||
        lowerName.includes("import") ||
        lowerName.includes("gfcf") ||
        lowerName.includes("fbcg") ||
        lowerName === "g" ||
        lowerName.includes("price") ||
        lowerName.includes("cost") ||
        lowerName.includes("amount") ||
        lowerName.includes("gain") ||
        lowerName.includes("loss") ||
        lowerName.includes("income") ||
        lowerName.includes("salary") ||
        lowerName.includes("revenue") ||
        lowerName.includes("budget")
      )
        semanticType = "CURRENCY";
      else if (
        lowerName === "inf" ||
        lowerName.includes("inflation") ||
        lowerName.includes("unemployment") ||
        lowerName.includes("chomage") ||
        lowerName.includes("exch") ||
        lowerName.includes("exchange") ||
        lowerName.includes("rate") ||
        lowerName.includes("ratio") ||
        lowerName.includes("pct") ||
        lowerName.includes("percentage")
      )
        semanticType = "PERCENTAGE";
      else if (
        lowerName.includes("num") ||
        lowerName.includes("count") ||
        lowerName.includes("fnlwgt") ||
        lowerName.includes("hours") ||
        lowerName.includes("activite") ||
        lowerName.includes("frequence") ||
        lowerName.includes("bp") ||
        lowerName.includes("pressure") ||
        lowerName.includes("tension")
      )
        semanticType = "QUANTITY";
      else semanticType = "NUMERIC";
    } else if (
      dataType === "TIMESTAMP" ||
      dataType === "DATE" ||
      lowerName.includes("created_at") ||
      lowerName.includes("updated_at") ||
      lowerName.includes("timestamp") ||
      lowerName.includes("date") ||
      lowerName.includes("dob")
    ) {
      semanticType = "DATETIME";
    } else if (lowerName.includes("email") || lowerName.includes("courriel")) {
      semanticType = "EMAIL";
    } else if (
      lowerName.includes("phone") ||
      lowerName.includes("tel") ||
      lowerName.includes("mobile")
    ) {
      semanticType = "PHONE";
    } else if (
      lowerName.includes("url") ||
      lowerName.includes("website") ||
      lowerName.includes("link")
    ) {
      semanticType = "URL";
    } else if (
      lowerName.includes("zip") ||
      lowerName.includes("postal_code") ||
      lowerName.includes("code_postal")
    ) {
      semanticType = "POSTAL_CODE";
    } else if (lowerName.includes("country") || lowerName.includes("pays")) {
      semanticType = "COUNTRY";
    } else if (lowerName.includes("city") || lowerName.includes("ville")) {
      semanticType = "CITY";
    } else if (
      lowerName.endsWith("_id") ||
      lowerName === "id" ||
      lowerName.endsWith("_uuid") ||
      lowerName.endsWith("_code")
    ) {
      semanticType = "IDENTIFIER";
    } else {
      semanticType = "STRING";
    }
  }

  return {
    colName,
    dataType: dataType.toUpperCase(),
    semanticType: semanticType.toUpperCase(),
  };
}

export function SchemaDictionaryTab({
  dataset,
  datasetId,
  columns: columnsProp,
  sampleData: sampleDataProp,
  t,
  onOpenProfiler,
  onUpdateColumnType,
  onInspectColumn,
  onSchemaUpdated,
}: {
  dataset?: BiDatasetMetadata;
  datasetId?: string;
  columns?: string[] | any[];
  sampleData?: Record<string, unknown>[];
  t: (key: string, params?: any) => string;
  onOpenProfiler?: (columnName: string) => void;
  onUpdateColumnType?: (
    columnName: string,
    newType: string,
    newSemanticType?: string,
  ) => Promise<void>;
  onInspectColumn?: (colName: string) => void;
  onSchemaUpdated?: () => void;
}) {
  const currentDatasetId =
    datasetId || dataset?.dataset_id || dataset?.id || "";
  const rawColumns = columnsProp || dataset?.columns || [];

  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editDataType, setEditDataType] = useState<string>("");
  const [editSemanticType, setEditSemanticType] = useState<string>("");
  const [savingColumn, setSavingColumn] = useState(false);

  const handleInspect = (colName: string) => {
    if (onOpenProfiler) onOpenProfiler(colName);
    else if (onInspectColumn) onInspectColumn(colName);
  };

  const handleSaveColumnType = async (columnName: string) => {
    setSavingColumn(true);
    try {
      if (onUpdateColumnType) {
        await onUpdateColumnType(columnName, editDataType, editSemanticType);
      } else {
        await api.bi.updateColumnType(
          currentDatasetId,
          columnName,
          editDataType,
          editSemanticType,
        );
        toast.success(
          t("bi.datasets.detail.schema.columnUpdated", { column: columnName }),
        );
        if (onSchemaUpdated) onSchemaUpdated();
      }
      setEditingColumn(null);
    } catch (err: any) {
      console.error("Failed to update column type:", err);
      toast.error(err.message || "Échec de mise à jour");
    } finally {
      setSavingColumn(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/80 backdrop-blur-xl space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t("bi.datasets.detail.tabs.schema.title")}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("bi.datasets.detail.tabs.schema.subtitle")}
          </p>
        </div>
        <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/30">
          {t("bi.datasets.detail.tabs.schema.columnsCountFormatted", {
            count: rawColumns.length,
          })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800/60">
        <table className="w-full text-start text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono">
            <tr>
              <th className="p-3.5 text-start border-b border-slate-200/80 dark:border-slate-800">
                {t("bi.datasets.detail.tabs.schema.colName")}
              </th>
              <th className="p-3.5 text-start border-b border-slate-200/80 dark:border-slate-800">
                {t("bi.datasets.detail.tabs.schema.sqlType")}
              </th>
              <th className="p-3.5 text-start border-b border-slate-200/80 dark:border-slate-800">
                {t("bi.datasets.detail.tabs.schema.semanticDomain")}
              </th>
              <th className="p-3.5 text-end border-b border-slate-200/80 dark:border-slate-800">
                {t("bi.datasets.detail.tabs.schema.statProfile")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/50 bg-white dark:bg-slate-900/40">
            {rawColumns.map((col: any, idx: number) => {
              const { colName, dataType, semanticType } = resolveColumnMeta(
                col,
                dataset,
                sampleDataProp,
              );
              const isEditing = editingColumn === colName;

              return (
                <tr
                  key={idx}
                  className="hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-colors"
                >
                  <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {colName}
                  </td>

                  <td className="p-3.5">
                    {isEditing ? (
                      <select
                        value={editDataType}
                        onChange={(e) => setEditDataType(e.target.value)}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-indigo-500 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                      >
                        {DATA_TYPES.map((dt) => (
                          <option key={dt.id} value={dt.id}>
                            {getSqlTypeLabel(dt.id, t)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-xs border border-slate-200 dark:border-slate-700 font-bold">
                        {dataType}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5">
                    {isEditing ? (
                      <select
                        value={editSemanticType}
                        onChange={(e) => setEditSemanticType(e.target.value)}
                        className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-purple-500 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                      >
                        {SEMANTIC_TYPES.map((st) => (
                          <option key={st.id} value={st.id}>
                            {getSemanticTypeLabel(st.id, t)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 font-mono text-xs font-bold border border-purple-200 dark:border-purple-500/30 uppercase">
                        {semanticType}
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 text-end">
                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveColumnType(colName)}
                            disabled={savingColumn}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-sm"
                            title={t("bi.datasets.detail.hero.editModal.save")}
                          >
                            {savingColumn ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingColumn(null)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title={t(
                              "bi.datasets.detail.hero.editModal.cancel",
                            )}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingColumn(colName);
                              setEditDataType(dataType);
                              setEditSemanticType(semanticType);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-indigo-600/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 font-bold"
                          >
                            <Edit3 className="w-3.5 h-3.5" />{" "}
                            {t("bi.datasets.detail.tabs.schema.edit")}
                          </button>
                          <button
                            onClick={() => handleInspect(colName)}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition-colors flex items-center gap-1.5 font-bold"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />{" "}
                            {t("bi.datasets.detail.tabs.schema.inspect")}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
