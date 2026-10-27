"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  FileText,
  Copy,
  Check,
  RotateCw,
  Loader2,
  Table,
  FileCode2,
  Film,
  Music,
  Archive,
  Search,
  Folder,
  File as GenericFileIcon,
  WrapText,
  Presentation,
  Palette,
  ShieldAlert,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Grid,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";
import { MessageAttachment } from "./types";
import { formatFileSize, getFileCategory } from "./FileAttachmentCard";
import { useTranslations } from "@/lib/i18n";
import { cn, resolveFileUrl } from "@/lib/utils";

interface FilePreviewModalProps {
  isOpen: boolean;
  attachment: MessageAttachment | null;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SheetJS returns untyped cell values
type CellValue = any;

interface ZipEntryInfo {
  name: string;
  uncompressedSize: number;
  compressedSize: number;
  isDirectory: boolean;
}

interface DocxSection {
  type: "h1" | "h2" | "h3" | "p" | "list";
  text: string;
}

interface PptxSlide {
  slideNumber: number;
  title: string;
  bullets: string[];
}

// Minimal, secure ZIP parser using browser ArrayBuffer and DecompressionStream
async function parseZipEntries(buffer: ArrayBuffer): Promise<{
  entries: ZipEntryInfo[];
  readFile: (name: string) => Promise<Uint8Array | null>;
}> {
  const dataView = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const entries: (ZipEntryInfo & { localHeaderOffset: number })[] = [];

  let offset = 0;
  const decoder = new TextDecoder();

  while (offset + 30 <= buffer.byteLength) {
    const sig = dataView.getUint32(offset, true);
    if (sig === 0x04034b50) {
      // Local file header
      const compressedSize = dataView.getUint32(offset + 18, true);
      const uncompressedSize = dataView.getUint32(offset + 22, true);
      const nameLen = dataView.getUint16(offset + 26, true);
      const extraLen = dataView.getUint16(offset + 28, true);

      const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
      const name = decoder.decode(nameBytes);
      const isDirectory = name.endsWith("/") || name.endsWith("\\");

      entries.push({
        name,
        compressedSize,
        uncompressedSize,
        isDirectory,
        localHeaderOffset: offset,
      });

      if (compressedSize > 0) {
        offset += 30 + nameLen + extraLen + compressedSize;
      } else {
        offset += 30 + nameLen + extraLen;
      }
    } else {
      offset += 1;
    }
  }

  const readFile = async (targetName: string): Promise<Uint8Array | null> => {
    const entry = entries.find(
      (e) => e.name === targetName || e.name === targetName.replace(/^\//, ""),
    );
    if (!entry) return null;

    const hOffset = entry.localHeaderOffset;
    const compressionMethod = dataView.getUint16(hOffset + 8, true);
    const compressedSize = dataView.getUint32(hOffset + 18, true);
    const nameLen = dataView.getUint16(hOffset + 26, true);
    const extraLen = dataView.getUint16(hOffset + 28, true);
    const dataStart = hOffset + 30 + nameLen + extraLen;
    const compressedData = bytes.subarray(
      dataStart,
      dataStart + compressedSize,
    );

    if (compressionMethod === 0) {
      return compressedData;
    } else if (compressionMethod === 8) {
      // Deflate
      try {
        if (typeof DecompressionStream !== "undefined") {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          writer.write(compressedData);
          writer.close();
          const response = new Response(ds.readable);
          const decompressedBuffer = await response.arrayBuffer();
          return new Uint8Array(decompressedBuffer);
        }
      } catch (err) {
        console.warn("DecompressionStream error:", err);
      }
    }
    return null;
  };

  return { entries, readFile };
}

// DOCX parser extracting text & basic structure from word/document.xml
async function parseDocxContent(buffer: ArrayBuffer): Promise<DocxSection[]> {
  const { readFile } = await parseZipEntries(buffer);
  const docXmlBytes = await readFile("word/document.xml");
  if (!docXmlBytes) return [];

  const xmlText = new TextDecoder().decode(docXmlBytes);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "application/xml");

  const sections: DocxSection[] = [];
  const paragraphs = xmlDoc.getElementsByTagName("w:p");

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const styleElem = p.querySelector("w\\:pStyle, pStyle");
    const styleVal =
      styleElem?.getAttribute("w:val") || styleElem?.getAttribute("val") || "";

    const textNodes = p.querySelectorAll("w\\:t, t");
    let text = "";
    textNodes.forEach((node) => {
      text += node.textContent || "";
    });

    text = text.trim();
    if (!text) continue;

    if (styleVal.toLowerCase().includes("heading1") || styleVal === "1") {
      sections.push({ type: "h1", text });
    } else if (
      styleVal.toLowerCase().includes("heading2") ||
      styleVal === "2"
    ) {
      sections.push({ type: "h2", text });
    } else if (
      styleVal.toLowerCase().includes("heading3") ||
      styleVal === "3"
    ) {
      sections.push({ type: "h3", text });
    } else if (
      styleVal.toLowerCase().includes("list") ||
      p.querySelector("w\\:numPr, numPr")
    ) {
      sections.push({ type: "list", text });
    } else {
      sections.push({ type: "p", text });
    }
  }

  return sections;
}

// PPTX parser extracting slide titles & bullet points from ppt/slides/slide*.xml
async function parsePptxSlides(buffer: ArrayBuffer): Promise<PptxSlide[]> {
  const { entries, readFile } = await parseZipEntries(buffer);
  const slideEntries = entries
    .filter((e) => /ppt\/slides\/slide\d+\.xml/i.test(e.name))
    .sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
      const numB = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
      return numA - numB;
    });

  if (slideEntries.length === 0) return [];

  const slides: PptxSlide[] = [];
  const parser = new DOMParser();

  for (let idx = 0; idx < slideEntries.length; idx++) {
    const entry = slideEntries[idx];
    const slideBytes = await readFile(entry.name);
    if (!slideBytes) continue;

    const xmlText = new TextDecoder().decode(slideBytes);
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const paragraphs = xmlDoc.getElementsByTagName("a:p");

    let slideTitle = "";
    const bullets: string[] = [];

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const p = paragraphs[pIdx];
      const textNodes = p.querySelectorAll("a\\:t, t");
      let lineText = "";
      textNodes.forEach((node) => {
        lineText += node.textContent || "";
      });
      lineText = lineText.trim();
      if (!lineText) continue;

      if (!slideTitle) {
        slideTitle = lineText;
      } else {
        bullets.push(lineText);
      }
    }

    slides.push({
      slideNumber: idx + 1,
      title: slideTitle || `Slide ${idx + 1}`,
      bullets,
    });
  }

  return slides;
}

// Secure React Markdown Renderer without innerHTML
function RenderedMarkdownView({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-3 p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800"
          >
            <code>{codeBlockBuffer.join("\n")}</code>
          </pre>,
        );
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-6 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2"
        >
          {line.replace(/^#\s+/, "")}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2"
        >
          {line.replace(/^##\s+/, "")}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2"
        >
          {line.replace(/^###\s+/, "")}
        </h3>,
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="ps-4 border-s-4 border-blue-500 my-3 text-slate-600 dark:text-slate-400 italic bg-blue-50/50 dark:bg-blue-950/20 py-2 rounded-e-lg"
        >
          {line.replace(/^>\s+/, "")}
        </blockquote>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li
          key={i}
          className="ms-6 list-disc text-slate-700 dark:text-slate-300 my-1 text-sm"
        >
          {line.replace(/^[-*]\s+/, "")}
        </li>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p
          key={i}
          className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed my-1.5"
        >
          {line}
        </p>,
      );
    }
  }

  return <div className="space-y-1">{elements}</div>;
}

export function FilePreviewModal({
  isOpen,
  attachment,
  onClose,
}: FilePreviewModalProps) {
  const t = useTranslations("messaging");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);
  const [wrapText, setWrapText] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFormattedMarkdown, setShowFormattedMarkdown] = useState(true);
  const [checkeredBg, setCheckeredBg] = useState(false);

  // Content states
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Text / Code
  const [textContent, setTextContent] = useState<string | null>(null);

  // Spreadsheet state
  const [sheets, setSheets] = useState<{ [name: string]: CellValue[][] }>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");

  // Archive / ZIP state
  const [zipEntries, setZipEntries] = useState<ZipEntryInfo[]>([]);

  // DOCX state
  const [docxSections, setDocxSections] = useState<DocxSection[]>([]);

  // PPTX Presentation state
  const [pptxSlides, setPptxSlides] = useState<PptxSlide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Audio player state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  const fileNameLower = attachment?.fileName?.toLowerCase() || "";
  const isXlsx =
    fileNameLower.endsWith(".xlsx") ||
    fileNameLower.endsWith(".xls") ||
    fileNameLower.endsWith(".csv") ||
    fileNameLower.endsWith(".tsv") ||
    fileNameLower.endsWith(".ods");
  const isDocx = fileNameLower.endsWith(".docx");
  const isPptx = fileNameLower.endsWith(".pptx");
  const isZip =
    fileNameLower.endsWith(".zip") ||
    fileNameLower.endsWith(".tar") ||
    fileNameLower.endsWith(".tar.gz");
  const isMarkdown =
    fileNameLower.endsWith(".md") || fileNameLower.endsWith(".markdown");

  const category = useMemo(() => {
    if (!attachment) return "other";
    if (isXlsx) return "sheet";
    if (isDocx) return "document";
    if (isPptx) return "presentation";
    if (isZip) return "archive";
    return getFileCategory(attachment.fileName, attachment.fileType);
  }, [attachment, isXlsx, isDocx, isPptx, isZip]);

  const isText =
    category === "code" ||
    (category === "document" &&
      !isDocx &&
      !fileNameLower.endsWith(".pdf") &&
      !fileNameLower.endsWith(".doc"));

  // Reset state and load file contents
  useEffect(() => {
    if (!isOpen || !attachment) return;

    setZoom(1);
    setRotation(0);
    setCopied(false);
    setSearchQuery("");
    setTextContent(null);
    setSheets({});
    setSheetNames([]);
    setActiveSheet("");
    setZipEntries([]);
    setDocxSections([]);
    setPptxSlides([]);
    setActiveSlideIndex(0);
    setLoadError(null);
    setIsPlayingAudio(false);

    const fileUrl = resolveFileUrl(attachment.fileUrl);

    // 1. Spreadsheet handling (.xlsx, .xls, .csv, .tsv, .ods)
    if (isXlsx || category === "sheet") {
      setLoading(true);
      fetch(fileUrl, { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load spreadsheet");
          return res.arrayBuffer();
        })
        .then(async (buffer) => {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "array" });
          const parsedSheets: { [name: string]: CellValue[][] } = {};
          workbook.SheetNames.forEach((name) => {
            const worksheet = workbook.Sheets[name];
            parsedSheets[name] = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              defval: "",
            });
          });
          setSheets(parsedSheets);
          setSheetNames(workbook.SheetNames);
          if (workbook.SheetNames.length > 0) {
            setActiveSheet(workbook.SheetNames[0]);
          }
        })
        .catch((err) => {
          console.error("Spreadsheet parse error:", err);
          setLoadError(err.message || "Could not parse spreadsheet");
        })
        .finally(() => setLoading(false));
      return;
    }

    // 2. Word document handling (.docx)
    if (isDocx) {
      setLoading(true);
      fetch(fileUrl, { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load document");
          return res.arrayBuffer();
        })
        .then((buffer) => parseDocxContent(buffer))
        .then((sections) => {
          if (sections.length === 0) {
            throw new Error("No readable text found in document");
          }
          setDocxSections(sections);
        })
        .catch((err) => {
          console.warn("DOCX parse error, attempting fallback:", err);
          setLoadError(err.message || "Could not parse document");
        })
        .finally(() => setLoading(false));
      return;
    }

    // 3. PowerPoint presentation handling (.pptx)
    if (isPptx) {
      setLoading(true);
      fetch(fileUrl, { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load presentation");
          return res.arrayBuffer();
        })
        .then((buffer) => parsePptxSlides(buffer))
        .then((slides) => {
          if (slides.length === 0) {
            throw new Error("No readable slides found in presentation");
          }
          setPptxSlides(slides);
          setActiveSlideIndex(0);
        })
        .catch((err) => {
          console.warn("PPTX parse error:", err);
          setLoadError(err.message || "Could not parse presentation slides");
        })
        .finally(() => setLoading(false));
      return;
    }

    // 4. ZIP Archive handling (.zip)
    if (isZip) {
      setLoading(true);
      fetch(fileUrl, { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load archive");
          return res.arrayBuffer();
        })
        .then((buffer) => parseZipEntries(buffer))
        .then(({ entries }) => {
          setZipEntries(entries);
        })
        .catch((err) => {
          console.error("ZIP parse error:", err);
          setLoadError(err.message || "Could not read archive");
        })
        .finally(() => setLoading(false));
      return;
    }

    // 5. Code & Text & Markdown handling
    if (
      (category === "code" || isText || category === "document") &&
      !isDocx &&
      !fileNameLower.endsWith(".pdf")
    ) {
      setLoading(true);
      fetch(fileUrl, { credentials: "include" })
        .then((res) => (res.ok ? res.text() : Promise.reject(res)))
        .then((text) => {
          setTextContent(text.slice(0, 250000)); // Up to 250k chars
        })
        .catch(() => {
          setTextContent(null);
        })
        .finally(() => setLoading(false));
    }
  }, [
    isOpen,
    attachment,
    category,
    isXlsx,
    isDocx,
    isPptx,
    isZip,
    fileNameLower,
    isText,
  ]);

  // Handle Escape and Navigation keys
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (category === "presentation" && pptxSlides.length > 0) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          setActiveSlideIndex((prev) =>
            Math.min(prev + 1, pptxSlides.length - 1),
          );
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          setActiveSlideIndex((prev) => Math.max(prev - 1, 0));
        }
      }
    },
    [onClose, category, pptxSlides],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Filter spreadsheet rows
  const currentSheetRows = useMemo(() => {
    const rawRows = sheets[activeSheet] || [];
    if (!searchQuery.trim()) return rawRows;
    const q = searchQuery.toLowerCase();
    return rawRows.filter((row, idx) => {
      if (idx === 0) return true; // Keep header
      return row.some((cell) => String(cell).toLowerCase().includes(q));
    });
  }, [sheets, activeSheet, searchQuery]);

  // Filter ZIP entries
  const filteredZipEntries = useMemo(() => {
    if (!searchQuery.trim()) return zipEntries;
    const q = searchQuery.toLowerCase();
    return zipEntries.filter((e) => e.name.toLowerCase().includes(q));
  }, [zipEntries, searchQuery]);

  if (!isOpen || !attachment) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = resolveFileUrl(attachment.fileUrl);
    link.download = attachment.fileName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(resolveFileUrl(attachment.fileUrl));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTextContent = () => {
    let textToCopy = "";
    if (textContent) {
      textToCopy = textContent;
    } else if (docxSections.length > 0) {
      textToCopy = docxSections.map((s) => s.text).join("\n\n");
    } else if (pptxSlides.length > 0) {
      textToCopy = pptxSlides
        .map(
          (s) =>
            `# Slide ${s.slideNumber}: ${s.title}\n${s.bullets.join("\n")}`,
        )
        .join("\n\n");
    } else if (sheets[activeSheet]) {
      textToCopy = sheets[activeSheet].map((row) => row.join("\t")).join("\n");
    }
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "pdf":
        return t("attachments.pdf");
      case "sheet":
        return t("attachments.sheet");
      case "document":
        return t("attachments.document");
      case "presentation":
        return t("attachments.presentation");
      case "archive":
        return t("attachments.archive");
      case "code":
        return t("attachments.code");
      case "video":
        return t("attachments.video");
      case "audio":
        return t("attachments.audio");
      case "image":
        return t("attachments.image");
      case "design":
        return t("attachments.design");
      case "binary":
        return t("attachments.binary");
      default:
        return t("attachments.other");
    }
  };

  const renderFallbackIcon = () => {
    switch (category) {
      case "presentation":
        return <Presentation className="w-10 h-10 text-amber-500" />;
      case "design":
        return <Palette className="w-10 h-10 text-pink-500" />;
      case "binary":
        return <ShieldAlert className="w-10 h-10 text-rose-500" />;
      case "archive":
        return <Archive className="w-10 h-10 text-teal-500" />;
      case "audio":
        return <Music className="w-10 h-10 text-violet-500" />;
      case "video":
        return <Film className="w-10 h-10 text-purple-500" />;
      case "image":
        return <ImageIcon className="w-10 h-10 text-sky-500" />;
      default:
        return <GenericFileIcon className="w-10 h-10 text-slate-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={attachment.fileName}
    >
      <div
        className="relative w-full max-w-5xl h-[88vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex-shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0 me-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 shadow-xs">
              {renderFallbackIcon()}
            </div>
            <div className="min-w-0">
              <bdi
                dir="auto"
                className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate block leading-tight"
                title={attachment.fileName}
              >
                {attachment.fileName}
              </bdi>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <bdi dir="ltr">{formatFileSize(attachment.fileSize)}</bdi>
                <span>•</span>
                <span className="capitalize">{getCategoryLabel(category)}</span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Search Input for Sheets, Code, Zip, Docx */}
            {(isXlsx || isZip || isDocx || category === "code" || isText) && (
              <div className="relative hidden md:flex items-center me-2">
                <Search className="w-3.5 h-3.5 absolute start-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    isXlsx
                      ? t("attachments.searchTable")
                      : isDocx
                        ? t("attachments.searchDocument")
                        : t("attachments.searchCode")
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-8 pe-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44 transition-all"
                />
              </div>
            )}

            {/* Markdown view toggle */}
            {isMarkdown && (
              <button
                type="button"
                onClick={() => setShowFormattedMarkdown((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer",
                  showFormattedMarkdown
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
                )}
                title={
                  showFormattedMarkdown
                    ? t("attachments.rawView")
                    : t("attachments.markdownView")
                }
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {showFormattedMarkdown
                    ? t("attachments.markdownView")
                    : t("attachments.rawView")}
                </span>
              </button>
            )}

            {/* Word wrap toggle for code and text */}
            {(category === "code" || isText || textContent !== null) &&
              !showFormattedMarkdown && (
                <button
                  type="button"
                  onClick={() => setWrapText((w) => !w)}
                  className={cn(
                    "p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer",
                    wrapText &&
                      "bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400",
                  )}
                  title={t("attachments.wordWrap")}
                >
                  <WrapText className="w-4 h-4" />
                </button>
              )}

            {/* Copy Content Button (Code, Text, Docx, Spreadsheet, Presentation) */}
            {(textContent ||
              docxSections.length > 0 ||
              pptxSlides.length > 0 ||
              (isXlsx && sheets[activeSheet])) && (
              <button
                type="button"
                onClick={handleCopyTextContent}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={t("attachments.copyContent")}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Controls for Image */}
            {category === "image" && (
              <>
                <button
                  type="button"
                  onClick={() => setCheckeredBg((v) => !v)}
                  className={cn(
                    "p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer",
                    checkeredBg &&
                      "bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-blue-400",
                  )}
                  title={t("attachments.checkeredBg")}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(prev + 0.25, 3))}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t("attachments.zoomIn")}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t("attachments.zoomOut")}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title={t("attachments.rotate")}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </>
            )}

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={t("attachments.copyLink")}
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Open in New Tab */}
            <a
              href={resolveFileUrl(attachment.fileUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={t("attachments.openInNewTab")}
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Download */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs"
              title={t("attachments.downloadFile")}
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors cursor-pointer ms-1"
              title={t("attachments.closeModal")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Area */}
        <div className="flex-1 bg-slate-100/60 dark:bg-slate-950/60 p-4 sm:p-6 overflow-hidden flex items-center justify-center relative">
          {/* Loading Indicator */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 animate-in fade-in">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium">{t("attachments.loading")}</p>
            </div>
          )}

          {/* Load Error Fallback */}
          {!loading && loadError && (
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-rose-200 dark:border-rose-900/50 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">
                {attachment.fileName}
              </h3>
              <p className="text-xs text-rose-500 dark:text-rose-400 mb-6 font-mono">
                {loadError}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t("attachments.downloadFile")}</span>
              </button>
            </div>
          )}

          {/* 1. Spreadsheets (.xlsx, .xls, .csv, .tsv, .ods) */}
          {!loading && !loadError && (isXlsx || category === "sheet") && (
            <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              {/* Sheet Tab Bar */}
              {sheetNames.length > 1 && (
                <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 overflow-x-auto flex-shrink-0">
                  {sheetNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveSheet(name)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer",
                        activeSheet === name
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800",
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}

              {/* Sheet Table Grid */}
              <div className="flex-1 overflow-auto p-2">
                {currentSheetRows.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    {t("attachments.noDataInSheet")}
                  </div>
                ) : (
                  <table className="w-full text-xs text-start border-collapse">
                    <tbody>
                      {currentSheetRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={cn(
                            rIdx === 0
                              ? "bg-slate-100 dark:bg-slate-800 font-bold sticky top-0 z-10"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/60",
                          )}
                        >
                          <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-slate-400 text-center font-mono w-10 select-none bg-slate-50 dark:bg-slate-850">
                            {rIdx + 1}
                          </td>
                          {row.map((cell: any, cIdx: number) => (
                            <td
                              key={cIdx}
                              className="p-2 border-r border-slate-100 dark:border-slate-800 max-w-xs truncate text-slate-700 dark:text-slate-200"
                              title={String(cell ?? "")}
                            >
                              {String(cell ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 2. Word Documents (.docx) */}
          {!loading && !loadError && isDocx && (
            <div className="w-full h-full overflow-y-auto p-4 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl mx-auto">
              <div className="space-y-4 max-w-3xl mx-auto">
                {docxSections.map((sec, i) => {
                  if (sec.type === "h1") {
                    return (
                      <h1
                        key={i}
                        className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-6 mb-2 border-b border-slate-200 dark:border-slate-800 pb-2"
                      >
                        {sec.text}
                      </h1>
                    );
                  }
                  if (sec.type === "h2") {
                    return (
                      <h2
                        key={i}
                        className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2"
                      >
                        {sec.text}
                      </h2>
                    );
                  }
                  if (sec.type === "h3") {
                    return (
                      <h3
                        key={i}
                        className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-1"
                      >
                        {sec.text}
                      </h3>
                    );
                  }
                  if (sec.type === "list") {
                    return (
                      <li
                        key={i}
                        className="ms-6 list-disc text-slate-700 dark:text-slate-300 my-1 text-sm"
                      >
                        {sec.text}
                      </li>
                    );
                  }
                  return (
                    <p
                      key={i}
                      className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed my-2"
                    >
                      {sec.text}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Presentations (.pptx slide deck viewer) */}
          {!loading && !loadError && isPptx && pptxSlides.length > 0 && (
            <div className="w-full h-full flex flex-col bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
              {/* Slide Screen Canvas */}
              <div className="flex-1 p-6 sm:p-10 flex items-center justify-center overflow-y-auto">
                <div className="w-full max-w-3xl aspect-[16/9] bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 p-8 sm:p-12 shadow-2xl flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="absolute top-4 end-6 text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-full border border-amber-800/60">
                    {t("attachments.slideCount", {
                      current: activeSlideIndex + 1,
                      total: pptxSlides.length,
                    })}
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-100 mb-6 border-b border-slate-700 pb-3">
                      {pptxSlides[activeSlideIndex]?.title}
                    </h2>
                    <ul className="space-y-3">
                      {pptxSlides[activeSlideIndex]?.bullets.map(
                        (bullet, bIdx) => (
                          <li
                            key={bIdx}
                            className="flex items-start gap-3 text-sm sm:text-base text-slate-300"
                          >
                            <span className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                            <span>{bullet}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div className="text-xs text-slate-500 flex justify-between items-center border-t border-slate-800 pt-3 mt-4">
                    <span>{attachment.fileName}</span>
                    <span>{t("attachments.presentationPreview")}</span>
                  </div>
                </div>
              </div>

              {/* Slide Navigation Bar */}
              <div className="flex items-center justify-between px-6 py-3 bg-slate-950 border-t border-slate-800">
                <button
                  type="button"
                  disabled={activeSlideIndex === 0}
                  onClick={() =>
                    setActiveSlideIndex((prev) => Math.max(prev - 1, 0))
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t("attachments.prevSlide")}</span>
                </button>

                <div className="flex items-center gap-1.5 overflow-x-auto max-w-md px-2">
                  {pptxSlides.map((slide, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setActiveSlideIndex(sIdx)}
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center",
                        activeSlideIndex === sIdx
                          ? "bg-amber-500 text-slate-950 shadow-md scale-105"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-400",
                      )}
                    >
                      {sIdx + 1}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={activeSlideIndex === pptxSlides.length - 1}
                  onClick={() =>
                    setActiveSlideIndex((prev) =>
                      Math.min(prev + 1, pptxSlides.length - 1),
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>{t("attachments.nextSlide")}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 4. ZIP Archive Inspection (.zip) */}
          {!loading && !loadError && isZip && (
            <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>{t("attachments.archiveContents")}</span>
                <span>
                  {filteredZipEntries.length} {t("attachments.items")}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                {filteredZipEntries.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    {t("attachments.noFilesInArchive")}
                  </div>
                ) : (
                  filteredZipEntries.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.isDirectory ? (
                          <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        ) : (
                          <GenericFileIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        )}
                        <bdi
                          dir="auto"
                          className="truncate text-slate-700 dark:text-slate-200 font-medium"
                        >
                          {item.name}
                        </bdi>
                      </div>
                      {!item.isDirectory && (
                        <bdi dir="ltr" className="text-slate-400 flex-shrink-0">
                          {formatFileSize(item.uncompressedSize)}
                        </bdi>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. PDF Viewer */}
          {!loading &&
            !loadError &&
            category === "pdf" &&
            attachment.fileUrl && (
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 bg-white">
                <iframe
                  src={`${resolveFileUrl(attachment.fileUrl)}#toolbar=1`}
                  title={attachment.fileName}
                  className="w-full h-full border-none"
                />
              </div>
            )}

          {/* 6. Image Viewer (JPG, PNG, GIF, WEBP, SVG, BMP, AVIF, ICO) */}
          {!loading && !loadError && category === "image" && (
            <div
              className={cn(
                "w-full h-full flex items-center justify-center overflow-hidden rounded-2xl transition-colors",
                checkeredBg
                  ? "bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[size:20px_20px] dark:bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%),linear-gradient(-45deg,#1e293b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1e293b_75%),linear-gradient(-45deg,transparent_75%,#1e293b_75%)]"
                  : "bg-transparent",
              )}
            >
              <img
                src={resolveFileUrl(attachment.fileUrl)}
                alt={attachment.fileName}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-xl transition-transform duration-150 select-none"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            </div>
          )}

          {/* 7. Video Player */}
          {!loading && !loadError && category === "video" && (
            <div className="w-full max-w-4xl max-h-full flex items-center justify-center">
              <video
                src={resolveFileUrl(attachment.fileUrl)}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[75vh] rounded-2xl shadow-2xl bg-black"
              >
                {t("attachments.videoNotSupported")}
              </video>
            </div>
          )}

          {/* 8. Audio Player */}
          {!loading && !loadError && category === "audio" && (
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in-95">
              <div className="w-20 h-20 rounded-3xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
                <Music className="w-10 h-10" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 truncate">
                {attachment.fileName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                {formatFileSize(attachment.fileSize)}
              </p>

              {/* Waveform Visualization Bars */}
              <div className="flex items-center justify-center gap-1.5 h-12 mb-6 px-4">
                {[40, 65, 80, 50, 95, 70, 85, 30, 60, 90, 75, 45, 85, 60].map(
                  (h, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1.5 rounded-full bg-violet-500/70 transition-all duration-300",
                        isPlayingAudio && "animate-pulse",
                      )}
                      style={{ height: `${h}%` }}
                    />
                  ),
                )}
              </div>

              <audio
                src={resolveFileUrl(attachment.fileUrl)}
                controls
                className="w-full mb-2"
                autoPlay
                onPlay={() => setIsPlayingAudio(true)}
                onPause={() => setIsPlayingAudio(false)}
              />
            </div>
          )}

          {/* 9. Code & Text & Markdown Viewer */}
          {!loading &&
            !loadError &&
            (category === "code" ||
              textContent !== null ||
              (category === "document" &&
                !isDocx &&
                !fileNameLower.endsWith(".pdf"))) && (
              <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs select-text">
                {textContent !== null ? (
                  isMarkdown && showFormattedMarkdown ? (
                    <div className="flex-1 overflow-y-auto p-6 sm:p-10 font-sans bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      <div className="max-w-3xl mx-auto">
                        <RenderedMarkdownView content={textContent} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto p-4 flex">
                      {/* Line numbers */}
                      <div className="pe-4 border-r border-slate-800 text-slate-600 select-none text-end font-mono">
                        {textContent.split("\n").map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                      {/* Code body */}
                      <pre
                        className={cn(
                          "ps-4 flex-1 overflow-x-auto leading-relaxed font-mono",
                          wrapText
                            ? "whitespace-pre-wrap break-words"
                            : "whitespace-pre",
                        )}
                      >
                        <code>{textContent}</code>
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <FileCode2 className="w-12 h-12 text-amber-500 mb-3" />
                    <p className="font-semibold text-slate-200 text-sm">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs mt-1 text-slate-400">
                      {t("attachments.cannotPreviewInline")}
                    </p>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {t("attachments.downloadToView")}
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* 10. Dedicated Card: Presentation Fallback (.ppt, .key, .odp) */}
          {!loading && !loadError && category === "presentation" && !isPptx && (
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-amber-200 dark:border-amber-900/40 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
                <Presentation className="w-8 h-8 text-amber-500" />
              </div>
              <bdi className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 truncate block">
                {attachment.fileName}
              </bdi>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                {formatFileSize(attachment.fileSize)} •{" "}
                {t("attachments.presentation")}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900/30">
                {t("attachments.presentationPreview")}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t("attachments.downloadFile")}</span>
              </button>
            </div>
          )}

          {/* 11. Dedicated Card: Design & Vector Assets (.psd, .ai, .eps, .sketch, .fig) */}
          {!loading && !loadError && category === "design" && (
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-pink-200 dark:border-pink-900/40 text-center">
              <div className="w-16 h-16 rounded-2xl bg-pink-50 dark:bg-pink-950/40 flex items-center justify-center mx-auto mb-4">
                <Palette className="w-8 h-8 text-pink-500" />
              </div>
              <bdi className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 truncate block">
                {attachment.fileName}
              </bdi>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {formatFileSize(attachment.fileSize)} •{" "}
                {t("attachments.design")}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 bg-pink-50 dark:bg-pink-950/30 p-3.5 rounded-xl border border-pink-200 dark:border-pink-900/30">
                {t("attachments.designNotice")}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{t("attachments.downloadFile")}</span>
              </button>
            </div>
          )}

          {/* 12. Dedicated Card: Executables & Binaries (.exe, .dmg, .apk, .deb, .iso, .bin) */}
          {!loading && !loadError && category === "binary" && (
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-rose-200 dark:border-rose-900/40 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
              </div>
              <bdi className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 truncate block">
                {attachment.fileName}
              </bdi>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {formatFileSize(attachment.fileSize)} •{" "}
                {t("attachments.binary")}
              </p>
              <div className="text-xs text-rose-700 dark:text-rose-300 mb-6 bg-rose-50 dark:bg-rose-950/30 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/30 text-start">
                <p className="font-bold mb-1">
                  {t("attachments.securityNotice")}
                </p>
                <p>{t("attachments.executableWarning")}</p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{t("attachments.downloadFile")}</span>
              </button>
            </div>
          )}

          {/* 13. Dedicated Card: Non-ZIP Archives (.rar, .7z, .tar, .gz, .bz2) */}
          {!loading && !loadError && category === "archive" && !isZip && (
            <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-teal-200 dark:border-teal-900/40 text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center mx-auto mb-4">
                <Archive className="w-8 h-8 text-teal-600" />
              </div>
              <bdi className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 truncate block">
                {attachment.fileName}
              </bdi>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {formatFileSize(attachment.fileSize)} •{" "}
                {t("attachments.archive")}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 bg-teal-50 dark:bg-teal-950/30 p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/30">
                {t("attachments.nonZipNotice")}
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>{t("attachments.downloadFile")}</span>
              </button>
            </div>
          )}

          {/* 14. Universal Generic / Fallback */}
          {!loading &&
            !loadError &&
            !isXlsx &&
            !isDocx &&
            !isPptx &&
            !isZip &&
            category !== "sheet" &&
            category !== "pdf" &&
            category !== "image" &&
            category !== "video" &&
            category !== "audio" &&
            category !== "code" &&
            category !== "presentation" &&
            category !== "design" &&
            category !== "binary" &&
            category !== "archive" &&
            textContent === null &&
            !isText && (
              <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 shadow-xs">
                  {renderFallbackIcon()}
                </div>
                <bdi
                  dir="auto"
                  className="font-bold text-slate-900 dark:text-slate-100 text-base mb-1 truncate block"
                >
                  {attachment.fileName}
                </bdi>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6">
                  <bdi dir="ltr">{formatFileSize(attachment.fileSize)}</bdi>
                  <span>•</span>
                  <span>{getCategoryLabel(category)}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                  {t("attachments.cannotPreviewBrowser")}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t("attachments.downloadFile")}</span>
                  </button>
                  <a
                    href={resolveFileUrl(attachment.fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                    title={t("attachments.openInNewTab")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;
