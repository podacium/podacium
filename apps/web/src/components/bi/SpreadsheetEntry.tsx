"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Clipboard,
  Grid3X3,
  X,
  PenLine,
  Download,
  ArrowUpFromLine,
  LayoutTemplate,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  Search,
  Filter,
} from "lucide-react";
import { useTranslations, useBidi } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────────────────── */

interface CellPos {
  row: number;
  col: number;
}

interface Column {
  id: string;
  name: string;
}

type Row = Record<string, string>; // col.id → value

interface SpreadsheetEntryProps {
  onDatasetCreated?: (datasetId: string) => void;
  onDataReady?: (data: any[]) => void;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

let _id = 0;
const uid = () => `c${++_id}_${Date.now()}`;

const alphaLabel = (n: number) => {
  let s = "";
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
};

const makeCol = (index: number): Column => ({
  id: uid(),
  name: alphaLabel(index),
});

const INITIAL_COLS = 6;
const INITIAL_ROWS = 20;

/* ─── BI Templates ───────────────────────────────────────────────── */

interface BITemplate {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  columns: string[];
  sampleData?: string[][];
}

const BI_TEMPLATES: BITemplate[] = [
  {
    id: "retail_sales",
    name: "Retail Sales",
    icon: "🏪",
    category: "retail",
    description: "Daily sales and POS tracking for stores",
    columns: [
      "Date",
      "Receipt ID",
      "Item",
      "SKU",
      "Quantity",
      "Unit Price",
      "Total",
      "Payment Method",
    ],
    sampleData: [
      [
        "2024-05-01",
        "RCPT-1001",
        "Wireless Mouse",
        "WM-01",
        "2",
        "2500",
        "5000",
        "Card",
      ],
      [
        "2024-05-01",
        "RCPT-1002",
        "Mechanical Keyboard",
        "MK-02",
        "1",
        "12000",
        "12000",
        "Cash",
      ],
      [
        "2024-05-01",
        "RCPT-1003",
        "USB-C Cable",
        "CBL-05",
        "3",
        "800",
        "2400",
        "Cash",
      ],
    ],
  },
  {
    id: "restaurant_orders",
    name: "Restaurant Orders",
    icon: "🍽️",
    category: "food",
    description: "Track tables, orders, and daily revenue",
    columns: [
      "Date",
      "Time",
      "Table No",
      "Order Items",
      "Waiter",
      "Total Amount",
      "Payment Method",
      "Status",
    ],
    sampleData: [
      [
        "2024-05-01",
        "13:45",
        "Table 4",
        "2x Burger, 1x Fries, 2x Cola",
        "Ahmed",
        "3400",
        "Cash",
        "Completed",
      ],
      [
        "2024-05-01",
        "14:10",
        "Table 7",
        "1x Pizza Margherita, 1x Water",
        "Karim",
        "1500",
        "Card",
        "Completed",
      ],
    ],
  },
  {
    id: "ecommerce_orders",
    name: "E-commerce Orders",
    icon: "🛒",
    category: "ecommerce",
    description: "Online store order fulfillment",
    columns: [
      "Order Date",
      "Order ID",
      "Customer Name",
      "Product",
      "Quantity",
      "Total Amount",
      "Shipping Status",
      "Tracking No",
    ],
    sampleData: [
      [
        "2024-05-01",
        "ORD-5091",
        "Yasmine B.",
        "Skincare Bundle",
        "1",
        "6500",
        "Shipped",
        "TRK-99210",
      ],
      [
        "2024-05-02",
        "ORD-5092",
        "Omar T.",
        "Vitamin C Serum",
        "2",
        "4000",
        "Processing",
        "",
      ],
    ],
  },
  {
    id: "services",
    name: "Services & Consulting",
    icon: "💼",
    category: "services",
    description: "Track client hours and billing",
    columns: [
      "Date",
      "Client",
      "Service Provided",
      "Hours",
      "Hourly Rate",
      "Total Billed",
      "Invoice Status",
    ],
    sampleData: [
      ["2024-05-01", "TechCorp DZ", "IT Audit", "4", "5000", "20000", "Sent"],
      [
        "2024-05-03",
        "MegaMart",
        "Network Setup",
        "10",
        "4500",
        "45000",
        "Paid",
      ],
    ],
  },
  {
    id: "financial",
    name: "Financial Ledger",
    icon: "💰",
    category: "finance",
    description: "General accounting, income, and expenses",
    columns: [
      "Date",
      "Description",
      "Category",
      "Type",
      "Amount (DZD)",
      "Reference",
    ],
    sampleData: [
      [
        "2024-05-01",
        "Office Rent - May",
        "Rent",
        "Expense",
        "85000",
        "INV-0501",
      ],
      [
        "2024-05-05",
        "Client Payment (Services)",
        "Sales",
        "Income",
        "120000",
        "TR-0992",
      ],
    ],
  },
  {
    id: "inventory",
    name: "Inventory Tracker",
    icon: "📦",
    category: "inventory",
    description: "Warehouse stock levels and movement",
    columns: [
      "Product Name",
      "SKU",
      "Category",
      "Current Stock",
      "Reorder Level",
      "Unit Cost",
      "Supplier",
    ],
    sampleData: [
      [
        "Office Chair",
        "FURN-01",
        "Furniture",
        "45",
        "10",
        "15000",
        "DZ Supply Co",
      ],
      ["Desk Lamp", "ELEC-12", "Electronics", "8", "15", "2500", "Electro DZ"],
    ],
  },
  {
    id: "sales_pipeline",
    name: "Sales Pipeline",
    icon: "📈",
    category: "sales",
    description: "B2B deals and CRM tracking",
    columns: [
      "Date",
      "Lead Name",
      "Company",
      "Value",
      "Probability (%)",
      "Status",
      "Next Follow-up",
    ],
    sampleData: [
      [
        "2024-05-01",
        "Sarah K.",
        "Alpha Tech",
        "450000",
        "80",
        "Negotiation",
        "2024-05-10",
      ],
      [
        "2024-05-02",
        "Mehdi R.",
        "BuildIt DZ",
        "1200000",
        "30",
        "Initial Contact",
        "2024-05-05",
      ],
    ],
  },
  {
    id: "hr_payroll",
    name: "Employee Payroll",
    icon: "👥",
    category: "hr",
    description: "Monthly staff compensation",
    columns: [
      "Employee Name",
      "Department",
      "Base Salary",
      "Bonus",
      "Deductions",
      "Net Pay",
      "Payment Date",
    ],
    sampleData: [
      [
        "Amine Bouzid",
        "Engineering",
        "120000",
        "15000",
        "0",
        "135000",
        "2024-04-30",
      ],
      [
        "Lina Mansour",
        "Marketing",
        "90000",
        "5000",
        "2000",
        "93000",
        "2024-04-30",
      ],
    ],
  },
  {
    id: "logistics",
    name: "Logistics & Delivery",
    icon: "🚚",
    category: "logistics",
    description: "Fleet and shipment tracking",
    columns: [
      "Date",
      "Tracking ID",
      "Driver Name",
      "Vehicle",
      "Destination",
      "Delivery Status",
      "Notes",
    ],
    sampleData: [
      [
        "2024-05-01",
        "DLV-441",
        "Hassan",
        "Van A",
        "Oran Center",
        "Delivered",
        "Signed by receiver",
      ],
      [
        "2024-05-01",
        "DLV-442",
        "Farid",
        "Truck 2",
        "Tlemcen",
        "In Transit",
        "Expected by 16:00",
      ],
    ],
  },
  {
    id: "expense_claims",
    name: "Expense Claims",
    icon: "🧾",
    category: "finance",
    description: "Employee reimbursements",
    columns: [
      "Date",
      "Employee",
      "Expense Type",
      "Amount",
      "Receipt Attached",
      "Approval Status",
    ],
    sampleData: [
      ["2024-05-02", "Yacine D.", "Travel", "15000", "Yes", "Approved"],
      ["2024-05-03", "Meriem T.", "Meals", "3500", "Yes", "Pending"],
    ],
  },
  {
    id: "customer_feedback",
    name: "Customer Feedback",
    icon: "⭐",
    category: "customer",
    description: "NPS and satisfaction scores",
    columns: [
      "Date",
      "Customer",
      "Product/Service",
      "Rating (1-5)",
      "Feedback Comments",
      "Follow-up Needed",
    ],
    sampleData: [
      [
        "2024-05-01",
        "Reda M.",
        "Premium Plan",
        "5",
        "Excellent support team!",
        "No",
      ],
      [
        "2024-05-02",
        "Khadija B.",
        "Standard Plan",
        "2",
        "Platform is too slow recently.",
        "Yes",
      ],
    ],
  },
  {
    id: "marketing_campaigns",
    name: "Marketing Campaigns",
    icon: "📢",
    category: "marketing",
    description: "Ad spend and lead generation",
    columns: [
      "Campaign Name",
      "Platform",
      "Start Date",
      "End Date",
      "Budget",
      "Spend to Date",
      "Leads Generated",
    ],
    sampleData: [
      [
        "Spring Sale 24",
        "Facebook Ads",
        "2024-04-01",
        "2024-04-30",
        "50000",
        "48500",
        "320",
      ],
      [
        "B2B Outreach",
        "LinkedIn",
        "2024-05-01",
        "2024-05-31",
        "80000",
        "15000",
        "45",
      ],
    ],
  },
];
/* ─── SideBtn Component ───────────────────────────────────────────── */

const SideBtn = ({
  onClick,
  icon: Icon,
  label,
  hint,
  color = "gray",
  disabled = false,
  kbd,
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  hint?: string;
  color?: "gray" | "blue" | "violet" | "amber" | "red" | "emerald";
  disabled?: boolean;
  kbd?: string;
}) => {
  const colors: Record<string, string> = {
    gray: "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800",
    blue: "text-blue-700 hover:bg-blue-50",
    violet: "text-violet-700 hover:bg-violet-50",
    amber: "text-amber-700 hover:bg-amber-50",
    red: "text-red-600 hover:bg-red-50",
    emerald: "text-emerald-700 hover:bg-emerald-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-start text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${colors[color]}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1">{label}</span>
      {kbd && (
        <kbd
          className="hidden lg:inline text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono"
          dir="ltr"
        >
          {kbd}
        </kbd>
      )}
    </button>
  );
};

/* ─── Component ──────────────────────────────────────────────────── */

export default function SpreadsheetEntry({
  onDatasetCreated,
  onDataReady,
}: SpreadsheetEntryProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const { isRTL } = useBidi();

  const [columns, setColumns] = useState<Column[]>(() =>
    Array.from({ length: INITIAL_COLS }, (_, i) => makeCol(i)),
  );
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => ({})),
  );

  const [activeCell, setActiveCell] = useState<CellPos | null>(null);
  const [editingCell, setEditingCell] = useState<CellPos | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [headerEditValue, setHeaderEditValue] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [showTemplates, setShowTemplates] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  // Undo/Redo
  const [history, setHistory] = useState<{ cols: Column[]; rows: Row[] }[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  const gridRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLInputElement>(null);

  // Push initial snapshot
  useEffect(() => {
    if (history.length === 0) {
      const snap = {
        cols: JSON.parse(JSON.stringify(columns)),
        rows: JSON.parse(JSON.stringify(rows)),
      };
      setHistory([snap]);
      setHistIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── History ─────────────────────────────────────────────────────── */

  const pushSnap = useCallback(
    (newCols: Column[], newRows: Row[]) => {
      const snap = {
        cols: JSON.parse(JSON.stringify(newCols)),
        rows: JSON.parse(JSON.stringify(newRows)),
      };
      setHistory((h) => [...h.slice(0, histIdx + 1), snap]);
      setHistIdx((i) => i + 1);
    },
    [histIdx],
  );

  const undo = useCallback(() => {
    if (histIdx <= 0) return;
    const s = history[histIdx - 1];
    setColumns(JSON.parse(JSON.stringify(s.cols)));
    setRows(JSON.parse(JSON.stringify(s.rows)));
    setHistIdx((i) => i - 1);
  }, [history, histIdx]);

  const redo = useCallback(() => {
    if (histIdx >= history.length - 1) return;
    const s = history[histIdx + 1];
    setColumns(JSON.parse(JSON.stringify(s.cols)));
    setRows(JSON.parse(JSON.stringify(s.rows)));
    setHistIdx((i) => i + 1);
  }, [history, histIdx]);

  /* ── Data mutations (with history) ──────────────────────────────── */

  const apply = useCallback(
    (newCols: Column[], newRows: Row[]) => {
      setColumns(newCols);
      setRows(newRows);
      pushSnap(newCols, newRows);
    },
    [pushSnap],
  );

  const setCellVal = useCallback(
    (r: number, colId: string, val: string) => {
      const nr = rows.map((row, i) =>
        i === r ? { ...row, [colId]: val } : row,
      );
      apply(columns, nr);
    },
    [rows, columns, apply],
  );

  /* ── Column management ──────────────────────────────────────────── */

  const addColumn = useCallback(() => {
    const nc = [...columns, makeCol(columns.length)];
    apply(nc, rows);
  }, [columns, rows, apply]);

  const removeColumn = useCallback(
    (idx: number) => {
      if (columns.length <= 1) return;
      const colId = columns[idx].id;
      const nc = columns.filter((_, i) => i !== idx);
      const nr = rows.map((r) => {
        const copy = { ...r };
        delete copy[colId];
        return copy;
      });
      apply(nc, nr);
    },
    [columns, rows, apply],
  );

  const renameColumn = useCallback(
    (idx: number, name: string) => {
      const nc = columns.map((c, i) =>
        i === idx ? { ...c, name: name || alphaLabel(idx) } : c,
      );
      apply(nc, rows);
    },
    [columns, rows, apply],
  );

  /* ── Row management ─────────────────────────────────────────────── */

  const addRows = useCallback(
    (count = 10) => {
      apply(columns, [...rows, ...Array.from({ length: count }, () => ({}))]);
    },
    [columns, rows, apply],
  );

  const deleteSelected = useCallback(() => {
    if (selectedRows.size === 0) return;
    let nr = rows.filter((_, i) => !selectedRows.has(i));
    if (nr.length === 0) nr = [{}];
    setSelectedRows(new Set());
    apply(columns, nr);
  }, [rows, columns, selectedRows, apply]);

  const clearAll = useCallback(() => {
    const nc = Array.from({ length: INITIAL_COLS }, (_, i) => makeCol(i));
    const nr = Array.from({ length: INITIAL_ROWS }, () => ({}));
    setSelectedRows(new Set());
    setActiveCell(null);
    apply(nc, nr);
  }, [apply]);

  /* ── First row → headers ────────────────────────────────────────── */

  const promoteFirstRow = useCallback(() => {
    if (rows.length === 0) return;
    const firstRow = rows[0];
    const nc = columns.map((col, i) => {
      const val = (firstRow[col.id] || "").trim();
      return { ...col, name: val || col.name };
    });
    const nr = rows.slice(1);
    if (nr.length === 0) nr.push({});
    apply(nc, nr);
    toast.success(t("bi.datasets.manual.firstRowPromoted"));
  }, [rows, columns, apply, t]);

  /* ── Load BI template ───────────────────────────────────────────── */

  const loadTemplate = useCallback(
    (tpl: BITemplate) => {
      const nc = tpl.columns.map((name) => ({ id: uid(), name }));
      const nr: Row[] = [];
      if (tpl.sampleData && tpl.sampleData.length > 0) {
        tpl.sampleData.forEach((rowVals) => {
          const row: Row = {};
          rowVals.forEach((val, i) => {
            if (nc[i]) row[nc[i].id] = val;
          });
          nr.push(row);
        });
      }
      while (nr.length < INITIAL_ROWS) nr.push({});
      apply(nc, nr);
      setShowTemplates(false);
      toast.success(
        t("bi.datasets.spreadsheet.templateLoaded", { name: tpl.name }),
      );
    },
    [apply, t],
  );

  /* ── Export CSV ──────────────────────────────────────────────────── */

  const exportCSV = useCallback(() => {
    const header = columns
      .map((c) => `"${c.name.replace(/"/g, '""')}"`)
      .join(",");
    const body = rows
      .filter((r) => columns.some((c) => (r[c.id] || "").trim()))
      .map((r) =>
        columns
          .map((c) => `"${(r[c.id] || "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const csv = header + "\n" + body;
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `podacium_data_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("bi.datasets.manual.csvExported"));
  }, [columns, rows, t]);

  /* ── Auto-detect column types ────────────────────────────────────── */

  const autoDetectTypes = useCallback(() => {
    const filled = rows.filter((r) =>
      columns.some((c) => (r[c.id] || "").trim()),
    );
    if (filled.length === 0) {
      toast.error(t("bi.datasets.manual.noDataAnalyze"));
      return;
    }

    const report: string[] = [];
    columns.forEach((col) => {
      const vals = filled.map((r) => (r[col.id] || "").trim()).filter(Boolean);
      if (vals.length === 0) {
        report.push(`${col.name}: Empty`);
        return;
      }
      const numCount = vals.filter(
        (v) => !isNaN(Number(v.replace(/[, ]/g, ""))),
      ).length;
      const dateCount = vals.filter(
        (v) => !isNaN(Date.parse(v)) && v.length >= 6,
      ).length;
      const pct = (n: number) => Math.round((n / vals.length) * 100);

      if (pct(numCount) >= 80) report.push(`${col.name}: Number`);
      else if (pct(dateCount) >= 80) report.push(`${col.name}: Date`);
      else report.push(`${col.name}: Text`);
    });

    toast.info(
      t("bi.datasets.spreadsheet.detectedTypes", {
        types: report.join(" · "),
      }),
      { duration: 5000 },
    );
  }, [columns, rows, t]);

  /* ── Validate columns ────────────────────────────────────────────── */

  const validateColumns = useCallback(() => {
    const issues: string[] = [];
    const filled = rows.filter((r) =>
      columns.some((c) => (r[c.id] || "").trim()),
    );

    // Check for default column names with data
    columns.forEach((col) => {
      const hasData = filled.some((r) => (r[col.id] || "").trim());
      if (hasData && /^[A-Z]{1,2}$/.test(col.name)) {
        issues.push(`Column ${col.name} has data but no proper name`);
      }
    });

    // Check for empty columns
    columns.forEach((col) => {
      const hasData = rows.some((r) => (r[col.id] || "").trim());
      if (!hasData) issues.push(`"${col.name}" is completely empty`);
    });

    if (issues.length === 0) {
      toast.success(t("bi.datasets.manual.allColumnsValidated"));
    } else {
      toast.warning(issues.join(" · "), { duration: 5000 });
    }
  }, [columns, rows, t]);

  /* ── Close menus on outside click ───────────────────────────────── */

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowMoreMenu(false);
      if (
        templateRef.current &&
        !templateRef.current.contains(e.target as Node)
      )
        setShowTemplates(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Cell editing ───────────────────────────────────────────────── */

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    setCellVal(editingCell.row, columns[editingCell.col].id, editValue);
    setEditingCell(null);
    setEditValue("");
  }, [editingCell, editValue, columns, setCellVal]);

  const startEdit = useCallback(
    (row: number, col: number) => {
      setEditingCell({ row, col });
      setEditValue(rows[row][columns[col].id] || "");
      setTimeout(() => editRef.current?.focus(), 0);
    },
    [rows, columns],
  );

  /* ── Keyboard ───────────────────────────────────────────────────── */

  const move = useCallback(
    (dr: number, dc: number) => {
      setActiveCell((p) => {
        if (!p) return { row: 0, col: 0 };
        return {
          row: Math.max(0, Math.min(rows.length - 1, p.row + dr)),
          col: Math.max(0, Math.min(columns.length - 1, p.col + dc)),
        };
      });
    },
    [rows.length, columns.length],
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "h" && e.shiftKey) {
        e.preventDefault();
        promoteFirstRow();
        return;
      }

      if (editingCell) {
        if (e.key === "Escape") {
          setEditingCell(null);
          setEditValue("");
          e.preventDefault();
          return;
        }
        if (e.key === "Tab") {
          commitEdit();
          move(0, e.shiftKey ? -1 : 1);
          e.preventDefault();
          return;
        }
        if (e.key === "Enter") {
          commitEdit();
          move(1, 0);
          e.preventDefault();
          return;
        }
        return;
      }

      if (!activeCell) return;
      switch (e.key) {
        case "ArrowUp":
          move(-1, 0);
          e.preventDefault();
          break;
        case "ArrowDown":
          move(1, 0);
          e.preventDefault();
          break;
        case "ArrowLeft":
          move(0, -1);
          e.preventDefault();
          break;
        case "ArrowRight":
          move(0, 1);
          e.preventDefault();
          break;
        case "Tab":
          move(0, e.shiftKey ? -1 : 1);
          e.preventDefault();
          break;
        case "Enter":
        case "F2":
          startEdit(activeCell.row, activeCell.col);
          e.preventDefault();
          break;
        case "Delete":
        case "Backspace":
          setCellVal(activeCell.row, columns[activeCell.col].id, "");
          e.preventDefault();
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            setEditingCell(activeCell);
            setEditValue(e.key);
            setTimeout(() => editRef.current?.focus(), 0);
            e.preventDefault();
          }
      }
    },
    [
      activeCell,
      editingCell,
      commitEdit,
      move,
      startEdit,
      setCellVal,
      columns,
      undo,
      redo,
      promoteFirstRow,
    ],
  );

  /* ── Paste ──────────────────────────────────────────────────────── */

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (editingCell) return;
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (!text.trim()) return;

      const lines = text.split("\n").filter((l) => l.trim());
      const parsed = lines.map((l) => l.split("\t"));
      const sr = activeCell?.row ?? 0;
      const sc = activeCell?.col ?? 0;

      const maxPasteCols = Math.max(...parsed.map((r) => r.length));
      const nc = [...columns];
      while (nc.length < sc + maxPasteCols) nc.push(makeCol(nc.length));

      const nr = [...rows];
      while (nr.length < sr + parsed.length) nr.push({});

      for (let r = 0; r < parsed.length; r++) {
        for (let c = 0; c < parsed[r].length; c++) {
          const colId = nc[sc + c]?.id;
          if (colId)
            nr[sr + r] = { ...nr[sr + r], [colId]: parsed[r][c].trim() };
        }
      }

      apply(nc, nr);
      toast.success(
        t("bi.datasets.manual.pasteResult", { count: String(parsed.length) }),
      );
    },
    [activeCell, columns, rows, editingCell, apply, t],
  );

  /* ── Submit ─────────────────────────────────────────────────────── */

  const filledRows = useMemo(
    () => rows.filter((r) => columns.some((c) => (r[c.id] || "").trim())),
    [rows, columns],
  );

  const handleSubmit = useCallback(async () => {
    if (!filledRows.length) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const colNames = columns.map((c) => c.name);
      const data = filledRows.map((r) => {
        const obj: Record<string, string> = {};
        columns.forEach((c) => {
          if ((r[c.id] || "").trim()) obj[c.name] = r[c.id];
        });
        return obj;
      });

      if (!onDataReady) {
        setError(t("bi.datasets.quickEntry.errors.handlerNotConfigured"));
        setIsSubmitting(false);
        return;
      }

      onDataReady(data);
      setIsSubmitting(false);
    } catch (err) {
      console.error("Failed to prepare data:", err);
      setError(t("bi.datasets.spreadsheet.errors.prepareFailed"));
      setIsSubmitting(false);
    }
  }, [filledRows, columns, onDataReady, t]);

  /* ── Saved state ────────────────────────────────────────────────── */

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

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div
      className="flex flex-col md:flex-row gap-4"
      style={{ minHeight: "800px" }}
    >
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="w-full md:w-72 shrink-0 flex flex-col gap-1 overflow-y-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-2 shadow-sm">
        {/* Structure group */}
        <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {t("bi.datasets.manual.sidebar.structure")}
        </p>
        <SideBtn
          onClick={() => addRows(10)}
          icon={Plus}
          label={t("bi.datasets.manual.sidebar.addRows")}
          color="gray"
        />
        <SideBtn
          onClick={addColumn}
          icon={Plus}
          label={t("bi.datasets.manual.sidebar.addColumn")}
          color="blue"
        />
        {selectedRows.size > 0 && (
          <SideBtn
            onClick={deleteSelected}
            icon={Trash2}
            label={`${t("bi.datasets.manual.sidebar.deleteRows")} (${selectedRows.size})`}
            color="red"
          />
        )}
        <SideBtn
          onClick={promoteFirstRow}
          icon={ArrowUpFromLine}
          label={t("bi.datasets.manual.sidebar.firstRowHeaders")}
          hint={t("bi.datasets.manual.sidebar.firstRowHeadersHint")}
          color="violet"
          kbd="Ctrl+Shift+H"
        />

        <div className="border-t border-gray-100 dark:border-slate-800 my-1.5 mx-3" />

        {/* Data tools group */}
        <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {t("bi.datasets.manual.sidebar.data")}
        </p>
        {/* Templates Modal Trigger */}
        <SideBtn
          onClick={() => {
            setShowTemplates(true);
            setShowMoreMenu(false);
          }}
          icon={LayoutTemplate}
          label={t("bi.datasets.manual.sidebar.templates")}
          hint={t("bi.datasets.manual.sidebar.templatesHint")}
          color="amber"
        />
        <SideBtn
          onClick={autoDetectTypes}
          icon={Sparkles}
          label={t("bi.datasets.manual.sidebar.detectTypes")}
          hint={t("bi.datasets.manual.sidebar.detectTypesHint")}
          color="emerald"
        />
        <SideBtn
          onClick={validateColumns}
          icon={ShieldCheck}
          label={t("bi.datasets.manual.sidebar.validateCols")}
          hint={t("bi.datasets.manual.sidebar.validateColsHint")}
          color="blue"
        />

        <div className="border-t border-gray-100 dark:border-slate-800 my-1.5 mx-3" />

        {/* I/O group */}
        <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {t("bi.datasets.manual.sidebar.io")}
        </p>
        <SideBtn
          onClick={exportCSV}
          icon={Download}
          label={t("bi.datasets.manual.sidebar.exportCsv")}
          hint={t("bi.datasets.manual.sidebar.exportCsvHint")}
          color="gray"
        />

        <div className="border-t border-gray-100 dark:border-slate-800 my-1.5 mx-3" />

        {/* Cleanup group */}
        <p className="px-3 pt-1 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {t("bi.datasets.manual.sidebar.cleanup")}
        </p>
        <SideBtn
          onClick={() => setShowClearConfirm(true)}
          icon={Trash2}
          label={t("bi.datasets.manual.clearAll")}
          hint={t("bi.datasets.manual.sidebar.clearAllHint")}
          color="red"
        />

        {/* Spacer + stats */}
        <div className="flex-1" />
        <div className="px-3 py-2 text-[10px] text-gray-400 space-y-0.5 border-t border-gray-100 dark:border-slate-800 mt-2">
          <p>
            {filledRows.length} / {rows.length}{" "}
            {t("bi.datasets.manual.rowCount", { count: "" }).trim()}
          </p>
          <p>
            {columns.length} {t("common.uiLabels.cols")}
          </p>
          <p className="flex items-center gap-1">
            <Clipboard className="w-3 h-3" /> Ctrl+V
          </p>
        </div>
      </aside>

      {/* ── Main grid area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 gap-3">
        {/* Top bar: undo/redo + hint */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={histIdx <= 0}
              aria-label={t("bi.datasets.manual.undo")}
              title={`${t("bi.datasets.manual.undo")} (Ctrl+Z)`}
              className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={histIdx >= history.length - 1}
              aria-label={t("bi.datasets.manual.redo")}
              title={`${t("bi.datasets.manual.redo")} (Ctrl+Y)`}
              className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 rounded-lg text-xs text-blue-600 dark:text-blue-400 font-medium">
            <Grid3X3 className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">
              {t("bi.datasets.manual.sheetHint")}
            </span>
          </div>
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className="flex-1 overflow-auto rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm focus:outline-none bg-white dark:bg-slate-900"
          tabIndex={0}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          style={{ maxHeight: "65vh" }}
        >
          <table
            className="w-full text-sm border-collapse"
            style={{ minWidth: `${columns.length * 140 + 80}px` }}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 dark:bg-slate-800">
                <th className="w-8 px-1 py-2 border-r border-b border-gray-200 dark:border-slate-800 text-center sticky left-0 bg-gray-100 dark:bg-slate-800 z-30">
                  <input
                    type="checkbox"
                    checked={
                      selectedRows.size === rows.length && rows.length > 0
                    }
                    onChange={(e) =>
                      setSelectedRows(
                        e.target.checked
                          ? new Set(rows.map((_, i) => i))
                          : new Set(),
                      )
                    }
                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-700"
                  />
                </th>
                <th className="w-10 px-1 py-2 border-r border-b border-gray-200 dark:border-slate-800 text-center text-[10px] font-bold text-gray-400 sticky left-8 bg-gray-100 dark:bg-slate-800 z-30">
                  #
                </th>
                {columns.map((col, ci) => (
                  <th
                    key={col.id}
                    className="px-1 py-1 border-r border-b border-gray-200 dark:border-slate-800 text-start group min-w-[120px]"
                  >
                    {editingHeader === ci ? (
                      <input
                        ref={headerRef}
                        value={headerEditValue}
                        onChange={(e) => setHeaderEditValue(e.target.value)}
                        onBlur={() => {
                          renameColumn(ci, headerEditValue);
                          setEditingHeader(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renameColumn(ci, headerEditValue);
                            setEditingHeader(null);
                          }
                          if (e.key === "Escape") setEditingHeader(null);
                          e.stopPropagation();
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-blue-400 rounded px-1.5 py-0.5 text-xs font-bold outline-none"
                      />
                    ) : (
                      <div className="flex items-center justify-between px-1.5 py-0.5">
                        <span
                          className="text-xs font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wide cursor-pointer truncate"
                          onClick={() => {
                            if (editingHeader === ci) return;
                            setEditingHeader(ci);
                            setHeaderEditValue(col.name);
                            setTimeout(() => headerRef.current?.focus(), 0);
                          }}
                          onDoubleClick={() => {
                            setEditingHeader(ci);
                            setHeaderEditValue(col.name);
                            setTimeout(() => headerRef.current?.focus(), 0);
                          }}
                        >
                          {col.name}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingHeader(ci);
                              setHeaderEditValue(col.name);
                              setTimeout(() => headerRef.current?.focus(), 0);
                            }}
                            aria-label={t("bi.datasets.manual.editHeader")}
                            className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                          </button>
                          {columns.length > 1 && (
                            <button
                              onClick={() => removeColumn(ci)}
                              aria-label={t("bi.datasets.manual.removeColumn")}
                              className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center text-gray-400 hover:text-red-500 dark:text-red-400"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </th>
                ))}
                <th className="w-8 px-1 py-2 border-b border-gray-200 dark:border-slate-800">
                  <button
                    onClick={addColumn}
                    aria-label={t("bi.datasets.manual.sidebar.addColumn")}
                    className="p-1 min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={
                    selectedRows.has(ri) ? "bg-blue-50 dark:bg-blue-950/60" : ""
                  }
                >
                  <td className="w-8 px-1 py-1 border-r border-b border-gray-200 dark:border-slate-800 text-center sticky left-0 bg-white dark:bg-slate-900 z-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(ri)}
                      onChange={(e) => {
                        const s = new Set(selectedRows);
                        e.target.checked ? s.add(ri) : s.delete(ri);
                        setSelectedRows(s);
                      }}
                      className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 cursor-pointer"
                    />
                  </td>
                  <td className="w-10 px-1 py-1 border-r border-b border-gray-200 dark:border-slate-800 text-center text-[10px] font-bold text-gray-300 sticky left-8 bg-white dark:bg-slate-900 z-10">
                    {ri + 1}
                  </td>
                  {columns.map((col, ci) => {
                    const isActive =
                      activeCell?.row === ri && activeCell?.col === ci;
                    const isEditing =
                      editingCell?.row === ri && editingCell?.col === ci;
                    const val = row[col.id] || "";
                    const cls = `relative px-2 py-1.5 text-sm border-r border-b border-gray-200 dark:border-slate-800 cursor-cell transition-colors min-w-[120px]
                      ${isActive ? "ring-2 ring-blue-500 ring-inset z-10" : ""}
                      ${ri % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-gray-50/50 dark:bg-slate-800/60"} hover:bg-blue-50/50 dark:hover:bg-blue-950/40`;

                    if (isEditing) {
                      return (
                        <td key={col.id} className={cls}>
                          <input
                            ref={editRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setEditingCell(null);
                                setEditValue("");
                                e.stopPropagation();
                              }
                              if (e.key === "Tab") {
                                commitEdit();
                                move(0, e.shiftKey ? -1 : 1);
                                e.preventDefault();
                                e.stopPropagation();
                              }
                              if (e.key === "Enter") {
                                commitEdit();
                                move(1, 0);
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            dir="auto"
                            className="w-full bg-transparent outline-none text-sm"
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col.id}
                        className={cls}
                        onClick={() => {
                          if (
                            activeCell?.row === ri &&
                            activeCell?.col === ci
                          ) {
                            startEdit(ri, ci);
                          } else {
                            setActiveCell({ row: ri, col: ci });
                          }
                        }}
                        onDoubleClick={() => startEdit(ri, ci)}
                      >
                        <div className="truncate min-h-[20px]" dir="auto">
                          {val}
                        </div>
                      </td>
                    );
                  })}
                  <td className="w-8 border-b border-gray-200 dark:border-slate-800" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => addRows(20)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t("bi.datasets.manual.add20Rows")}
          </button>
          <motion.button
            onClick={handleSubmit}
            disabled={isSubmitting || filledRows.length === 0}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSubmitting
              ? t("bi.datasets.manual.submitting")
              : onDataReady
                ? t("bi.datasets.upload.actions.next")
                : t("bi.datasets.manual.submit")}
            {filledRows.length > 0 && (
              <span className="ml-1 text-xs opacity-80">
                ({filledRows.length})
              </span>
            )}
          </motion.button>
        </div>

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

      <AnimatePresence>
        {showTemplates && (
          <TemplateSelectionModal
            isOpen={showTemplates}
            onClose={() => setShowTemplates(false)}
            onSelect={loadTemplate}
            templates={BI_TEMPLATES}
            t={t}
            isRTL={isRTL}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearConfirm && (
          <ClearConfirmationModal
            isOpen={showClearConfirm}
            onClose={() => setShowClearConfirm(false)}
            onConfirm={() => {
              clearAll();
              setShowClearConfirm(false);
            }}
            t={t}
            isRTL={isRTL}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Template Selection Modal ─────────────────────────────────────── */

function TemplateSelectionModal({
  isOpen,
  onClose,
  onSelect,
  templates,
  t,
  isRTL,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tpl: BITemplate) => void;
  templates: BITemplate[];
  t: any;
  isRTL: boolean;
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = [
    "all",
    "retail",
    "food",
    "ecommerce",
    "services",
    "finance",
    "inventory",
    "sales",
    "hr",
    "logistics",
    "customer",
    "marketing",
  ];

  const filteredTemplates = templates.filter((tpl) => {
    const translatedName =
      t(`bi.datasets.manual.templates.items.${tpl.id}.name`) || tpl.name;
    const translatedDesc =
      t(`bi.datasets.manual.templates.items.${tpl.id}.description`) ||
      tpl.description;
    const matchesSearch =
      translatedName.toLowerCase().includes(search.toLowerCase()) ||
      translatedDesc.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || tpl.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/60">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {t("bi.datasets.manual.templates.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("bi.datasets.manual.templates.close")}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-900">
          <div className="relative flex-1">
            <Search
              className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400`}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("bi.datasets.manual.templates.searchPlaceholder")}
              className={`w-full bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl py-2 ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow`}
            />
          </div>
          <div className="relative min-w-[200px]">
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className={`w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl py-2 px-4 ${isRTL ? "pl-10 pr-4" : "pl-4 pr-10"} text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none`}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "all"
                    ? t("bi.datasets.manual.templates.categoryFilter")
                    : t(`bi.datasets.manual.templates.categories.${cat}`) ||
                      cat}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none`}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-slate-800/60">
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((tpl: any) => {
                const name =
                  t(`bi.datasets.manual.templates.items.${tpl.id}.name`) ||
                  tpl.name;
                const desc =
                  t(
                    `bi.datasets.manual.templates.items.${tpl.id}.description`,
                  ) || tpl.description;
                const preview = t(
                  `bi.datasets.manual.templates.items.${tpl.id}.preview`,
                );
                const catName =
                  t(
                    `bi.datasets.manual.templates.categories.${tpl.category}`,
                  ) || tpl.category;

                return (
                  <button
                    key={tpl.id}
                    onClick={() => onSelect(tpl)}
                    type="button"
                    className="group flex flex-col text-start bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:border-blue-700 hover:ring-1 hover:ring-blue-300 rounded-xl p-5 transition-all shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex items-start justify-between w-full mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center text-xl shadow-inner border border-blue-100 dark:border-blue-900/50 dark:border-blue-900/50">
                          {tpl.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100 group-hover:text-blue-700 dark:text-blue-300 transition-colors">
                            {name}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50 mt-1">
                            {catName}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 mb-4 flex-1 leading-relaxed">
                      {desc}
                    </p>
                    <div className="w-full mt-auto pt-3 border-t border-gray-50 dark:border-slate-800/60">
                      <p className="text-[10px] font-mono text-gray-400 truncate bg-gray-50 dark:bg-slate-900/60 px-2 py-1.5 rounded border border-gray-100 dark:border-slate-800">
                        {preview}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Search className="w-8 h-8 mb-3 opacity-50" />
              <p>{t("bi.datasets.manual.templates.noTemplates")}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Clear Confirmation Modal ─────────────────────────────────────── */

function ClearConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  t,
  isRTL,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: any;
  isRTL: boolean;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 overflow-hidden"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-950/60 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-100 dark:border-red-900/50 shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {t("bi.datasets.manual.clearAll")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-8 leading-relaxed">
            {t("bi.datasets.manual.clearAllConfirm")}
          </p>

          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-gray-50 dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              {t("bi.datasets.manual.templates.cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {t("bi.datasets.manual.clearAll")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
