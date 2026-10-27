"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Award,
  QrCode,
  Download,
  Share2,
  ShieldCheck,
  Lock,
  Linkedin,
  Check,
  Loader2,
  Link2,
  ShoppingCart,
} from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n";
import api, { apiHelpers } from "@/lib/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import WalletPaymentModal from "@/components/billing/WalletPaymentModal";

interface CertificateGeneratorProps {
  courseId: string;
  overallProgress: number;
  isRtl: boolean;
  userName?: string;
  moduleTitle?: string;
  completedAt?: string;
  certificateId?: string;
  verificationUrl?: string;
  onWalletBalance?: number;
}

export const CertificateGenerator: React.FC<CertificateGeneratorProps> = ({
  courseId,
  overallProgress,
  isRtl,
  userName = "Student Name",
  moduleTitle = "Course Completion",
  completedAt,
  certificateId: certIdProp,
  verificationUrl: verificationUrlProp,
  onWalletBalance = 0,
}) => {
  const t = useTranslations();
  const locale = useLocale();
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [certPurchaseFailed, setCertPurchaseFailed] = useState(false);
  const [isPurchasingCert, setIsPurchasingCert] = useState(false);
  const [showCertWalletModal, setShowCertWalletModal] = useState(false);
  // Resolved cert ID — prefers the prop (fast/cached), falls back to API fetch
  const [resolvedCertId, setResolvedCertId] = useState<string | null>(
    certIdProp ?? null,
  );
  const [resolvedVerifUrl, setResolvedVerifUrl] = useState<string | null>(
    verificationUrlProp ?? null,
  );
  const PASS_THRESHOLD = 100;
  const isCompleted = overallProgress >= PASS_THRESHOLD;
  const hasCert = !!resolvedCertId;

  // When the component mounts (or certIdProp changes), resolve the real cert ID.
  // The enrollment prop may be stale if the cert was generated after the page loaded.
  useEffect(() => {
    if (certIdProp) {
      setResolvedCertId(certIdProp);
      return;
    }
    if (!isCompleted || !courseId) return;

    // Course is done but no certId in prop — ask the API (idempotent: returns existing cert)
    apiHelpers.education
      .generateCertificate(courseId)
      .then((data: any) => {
        const id = data?.certificateId ?? data?.id ?? null;
        if (id) {
          setResolvedCertId(id);
          setResolvedVerifUrl(data?.verificationUrl ?? null);
          setCertPurchaseFailed(false);
        } else {
          setCertPurchaseFailed(true);
        }
      })
      .catch(() => {
        setCertPurchaseFailed(true);
      });
  }, [isCompleted, courseId, certIdProp]);

  const handlePurchaseCertificate = async (skipWallet?: boolean) => {
    setIsPurchasingCert(true);
    try {
      const origin = window.location.origin;
      const response = await api.purchaseCertificate({
        module_id: courseId,
        success_url: `${origin}/learn/courses/${courseId}?cert_purchased=true`,
        failure_url: `${origin}/learn/courses/${courseId}?cert_failed=true`,
        skip_wallet: skipWallet ?? false,
      });
      if (response?.data?.paid_with_wallet) {
        try {
          const certData =
            await apiHelpers.education.generateCertificate(courseId);
          const id = certData?.certificateId ?? certData?.id ?? null;
          if (id) {
            setResolvedCertId(id);
            setResolvedVerifUrl(certData?.verificationUrl ?? null);
            setCertPurchaseFailed(false);
          } else {
            setCertPurchaseFailed(true);
          }
        } catch {
          setCertPurchaseFailed(true);
        }
        return;
      }
      if (response?.data?.checkout_url) {
        window.location.href = response.data.checkout_url;
        return;
      }
    } catch {
      // silently ignore — retry available
    } finally {
      setIsPurchasingCert(false);
      setShowCertWalletModal(false);
    }
  };

  // Use resolved values derived from prop or live API fetch
  const certificateId = resolvedCertId;
  const verificationUrl = resolvedVerifUrl;

  const localeDate = (date: string | Date) => {
    const localeMap: Record<string, string> = {
      en: "en-US",
      fr: "fr-FR",
      ar: "ar-DZ",
      kab: "fr-FR",
    };
    return new Date(date).toLocaleDateString(localeMap[locale] || "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  const formattedDate = completedAt
    ? localeDate(completedAt)
    : localeDate(new Date());

  // Escape HTML to prevent XSS when injecting user-controlled values into innerHTML
  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Helper function to convert oklch to rgb
  const oklchToRgb = (oklchStr: string): string => {
    // If it's already rgb/rgba/hex, return as-is
    if (oklchStr.startsWith("rgb") || oklchStr.startsWith("#")) {
      return oklchStr;
    }
    // Fallback colors for common oklch values used in Tailwind
    if (oklchStr.includes("gray") || oklchStr.includes("slate")) {
      return "#6b7280";
    }
    if (oklchStr.includes("blue")) {
      return "#3b82f6";
    }
    if (oklchStr.includes("red")) {
      return "#ef4444";
    }
    if (oklchStr.includes("green")) {
      return "#22c55e";
    }
    if (oklchStr.includes("white")) {
      return "#ffffff";
    }
    if (oklchStr.includes("black")) {
      return "#000000";
    }
    // Default fallback
    return "#000000";
  };

  // Download certificate as PDF
  const handleDownload = async () => {
    if (!certificateRef.current) return;

    setIsGenerating(true);
    try {
      // Create a wrapper div with explicit styles
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
                position: absolute;
                left: -9999px;
                top: -9999px;
                width: 1123px;
                height: 794px;
                background: #ffffff;
                padding: 40px;
                box-sizing: border-box;
            `;

      // Build certificate HTML with inline styles (no Tailwind classes).
      // userName and moduleTitle are user-supplied — escaped via escapeHtml to prevent XSS.
      wrapper.innerHTML = `
                <div style="
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
                    border: 12px double #cbd5e1;
                    padding: 60px;
                    box-sizing: border-box;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    font-family: 'Georgia', 'Times New Roman', serif;
                    box-shadow: inset 0 0 60px rgba(37, 99, 235, 0.05);
                ">
                    <!-- Decorative Corner Elements -->
                    <div style="
                        position: absolute;
                        top: 20px;
                        left: 20px;
                        width: 80px;
                        height: 80px;
                        border-top: 3px solid #2563eb;
                        border-left: 3px solid #2563eb;
                        opacity: 0.4;
                    "></div>
                    <div style="
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        width: 80px;
                        height: 80px;
                        border-top: 3px solid #2563eb;
                        border-right: 3px solid #2563eb;
                        opacity: 0.4;
                    "></div>
                    <div style="
                        position: absolute;
                        bottom: 20px;
                        left: 20px;
                        width: 80px;
                        height: 80px;
                        border-bottom: 3px solid #2563eb;
                        border-left: 3px solid #2563eb;
                        opacity: 0.4;
                    "></div>
                    <div style="
                        position: absolute;
                        bottom: 20px;
                        right: 20px;
                        width: 80px;
                        height: 80px;
                        border-bottom: 3px solid #2563eb;
                        border-right: 3px solid #2563eb;
                        opacity: 0.4;
                    "></div>
                    
                    <!-- Background Watermark -->
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 400px;
                        height: 400px;
                        background: radial-gradient(circle, rgba(37, 99, 235, 0.03) 0%, transparent 70%);
                        border-radius: 50%;
                        pointer-events: none;
                    "></div>
                    
                    <!-- Header -->
                    <div style="
                        position: absolute;
                        top: 40px;
                        ${isRtl ? "right: 40px;" : "left: 40px;"}
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        z-index: 10;
                    ">
                        <div style="
                            width: 48px;
                            height: 48px;
                            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                            border-radius: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
                        ">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="8" r="6"/>
                                <path d="M8.21 13.89L7 22l5-3 5 3-1.21-8.11"/>
                            </svg>
                        </div>
                        <div style="text-align: left;">
                            <span style="
                                font-size: 14px;
                                font-weight: 700;
                                color: #64748b;
                                letter-spacing: 0.15em;
                                text-transform: uppercase;
                                font-family: system-ui, -apple-system, sans-serif;
                            ">Podacium</span>
                            <span style="
                                display: block;
                                font-size: 20px;
                                font-weight: 900;
                                color: #1e3a8a;
                                letter-spacing: -0.02em;
                                font-family: system-ui, -apple-system, sans-serif;
                            ">LEARNING</span>
                        </div>
                    </div>
                    
                    <!-- Main Content -->
                    <div style="max-width: 650px; position: relative; z-index: 5;">
                        <!-- Certificate Title Badge -->
                        <div style="
                            display: inline-block;
                            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                            border: 1px solid #bfdbfe;
                            border-radius: 50px;
                            padding: 10px 32px;
                            margin-bottom: 32px;
                        ">
                            <p style="
                                color: #2563eb;
                                font-weight: 800;
                                text-transform: uppercase;
                                letter-spacing: 0.25em;
                                font-size: 13px;
                                margin: 0;
                                font-family: system-ui, -apple-system, sans-serif;
                            ">${t("course.certificate.header")}</p>
                        </div>
                        
                        <p style="
                            color: #94a3b8;
                            font-style: italic;
                            font-size: 22px;
                            margin-bottom: 28px;
                            font-family: Georgia, serif;
                        ">${t("course.certificate.certifiedThat")}</p>
                        
                        <h2 style="
                            font-size: 52px;
                            color: #0f172a;
                            border-bottom: 3px solid #e2e8f0;
                            padding-bottom: 20px;
                            margin-bottom: 28px;
                            font-family: Georgia, serif;
                            font-weight: 400;
                            letter-spacing: -0.01em;
                        ">${escapeHtml(userName)}</h2>
                        
                        <p style="
                            color: #475569;
                            font-size: 20px;
                            margin-bottom: 28px;
                            line-height: 1.7;
                            font-family: Georgia, serif;
                        ">${t("course.certificate.completionDescription")}</p>
                        
                        <h3 style="
                            font-size: 32px;
                            color: #1e40af;
                            font-style: italic;
                            margin-bottom: 56px;
                            font-weight: 600;
                            font-family: Georgia, serif;
                            text-shadow: 0 2px 4px rgba(30, 64, 175, 0.1);
                        ">${escapeHtml(moduleTitle)}</h3>
                        
                        <!-- Date and Instructor -->
                        <div style="
                            display: flex;
                            justify-content: center;
                            gap: 100px;
                            margin-top: 40px;
                        ">
                            <div style="text-align: center; min-width: 160px;">
                                <div style="
                                    height: 2px;
                                    background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
                                    margin-bottom: 12px;
                                "></div>
                                <p style="
                                    font-size: 11px;
                                    color: #94a3b8;
                                    text-transform: uppercase;
                                    letter-spacing: 0.15em;
                                    font-weight: 700;
                                    margin-bottom: 8px;
                                    font-family: system-ui, -apple-system, sans-serif;
                                ">${t("course.certificate.dateIssued")}</p>
                                <p style="
                                    font-size: 20px;
                                    color: #1e293b;
                                    font-family: Georgia, serif;
                                    font-weight: 500;
                                ">${formattedDate}</p>
                            </div>
                            <div style="text-align: center; min-width: 160px;">
                                <div style="
                                    height: 2px;
                                    background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
                                    margin-bottom: 12px;
                                "></div>
                                <p style="
                                    font-size: 11px;
                                    color: #94a3b8;
                                    text-transform: uppercase;
                                    letter-spacing: 0.15em;
                                    font-weight: 700;
                                    margin-bottom: 8px;
                                    font-family: system-ui, -apple-system, sans-serif;
                                ">${t("course.certificate.instructor")}</p>
                                <p style="
                                    font-size: 20px;
                                    color: #1e293b;
                                    font-family: Georgia, serif;
                                    font-weight: 500;
                                ">Podacium Expert Team</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- QR Code Section -->
                    <div style="
                        position: absolute;
                        bottom: 40px;
                        ${isRtl ? "left: 40px;" : "right: 40px;"}
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        z-index: 10;
                    ">
                        <div style="
                            padding: 12px;
                            background: white;
                            border: 2px solid #e2e8f0;
                            border-radius: 12px;
                            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                        ">
                            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1"/>
                                <rect x="14" y="3" width="7" height="7" rx="1"/>
                                <rect x="14" y="14" width="7" height="7" rx="1"/>
                                <rect x="3" y="14" width="7" height="7" rx="1"/>
                            </svg>
                        </div>
                        <div style="text-align: ${isRtl ? "right" : "left"};">
                            <p style="
                                font-size: 10px;
                                color: #94a3b8;
                                text-transform: uppercase;
                                font-weight: 700;
                                letter-spacing: 0.05em;
                                margin-bottom: 4px;
                                font-family: system-ui, -apple-system, sans-serif;
                            ">${t("course.certificate.verificationId")}</p>
                            <p style="
                                font-size: 13px;
                                color: #475569;
                                font-family: 'Courier New', monospace;
                                font-weight: 600;
                                letter-spacing: 0.05em;
                            ">${certificateId ? certificateId.slice(0, 12).toUpperCase() : ""}</p>
                        </div>
                    </div>
                    
                    <!-- Official Seal -->
                    <div style="
                        position: absolute;
                        bottom: 40px;
                        ${isRtl ? "right: 40px;" : "left: 40px;"}
                        width: 80px;
                        height: 80px;
                        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                        border-radius: 50%;
                        border: 3px solid #93c5fd;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0.6;
                        z-index: 10;
                    ">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 12l2 2 4-4"/>
                            <circle cx="12" cy="12" r="10"/>
                        </svg>
                    </div>
                </div>
            `;

      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      document.body.removeChild(wrapper);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;

      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio,
      );
      pdf.save(`podacium-certificate-${certificateId || "download"}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      console.error("PDF generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Get base URL from environment or window location
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_BASE_URL || "https://podacium.com";
  };

  // Build verification URL using certificateId from backend
  const getVerificationUrl = () => {
    if (verificationUrl) return verificationUrl;
    const baseUrl = getBaseUrl();
    const certId = certificateId || "";
    return `${baseUrl}/verify/${certId}`;
  };

  // Share on LinkedIn — only when we have a real cert ID
  const handleShareLinkedIn = () => {
    if (!certificateId) return;
    const shareUrl = getVerificationUrl();
    if (!shareUrl.includes("/verify/") || shareUrl.endsWith("/verify/")) return;
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, "_blank", "width=600,height=400");
  };

  // Copy verification link with navigator.share fallback
  const handleCopyLink = async () => {
    const link = getVerificationUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: t("course.certificate.shareLinkedIn"),
          url: link,
        });
        return;
      }
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Copy error:", err);
    }
  };

  return (
    <div className="space-y-6">
      {!isCompleted ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-slate-800 text-center relative overflow-hidden group">
          <div className="relative z-10">
            <div className="w-24 h-24 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors">
              <Lock className="w-10 h-10 text-gray-300 group-hover:text-blue-200 transition-colors" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
              {t("course.certificate.lockedTitle")}
            </h2>
            <p className="text-gray-500 dark:text-slate-400 max-w-md mx-auto mb-8">
              {t("course.certificate.lockedDescription")}
            </p>
            <div className="flex items-center justify-center gap-4 text-sm font-bold">
              <span className="text-blue-600 dark:text-blue-400">
                {overallProgress}%
              </span>
              <div className="w-48 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  className="bg-blue-600 h-full"
                />
              </div>
              <span className="text-gray-400">100%</span>
            </div>
          </div>
          <Award className="absolute -bottom-10 -right-10 w-64 h-64 text-gray-50 opacity-5" />
        </div>
      ) : hasCert ? (
        <div className="space-y-8">
          <div
            ref={certificateRef}
            className="aspect-[1.414/1] bg-white dark:bg-slate-900 border-8 border-double border-gray-200 dark:border-slate-800 p-12 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center"
          >
            <div className={`absolute top-8 ${isRtl ? "right-8" : "left-8"}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-black tracking-tighter text-blue-900 dark:text-blue-100">
                  PODACIUM
                </span>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              <h4 className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-[0.3em] text-sm">
                {t("course.certificate.header")}
              </h4>
              <p className="text-gray-400 italic font-serif">
                {t("course.certificate.certifiedThat")}
              </p>
              <h2 className="text-4xl font-serif text-gray-900 dark:text-slate-100 border-b-2 border-gray-100 dark:border-slate-800 pb-2">
                {userName}
              </h2>
              <p className="text-gray-600 dark:text-slate-400 max-w-lg">
                {t("course.certificate.completionDescription")}
              </p>
              <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100 italic">
                {moduleTitle}
              </h3>
              <div className="pt-8 grid grid-cols-2 gap-20">
                <div className="text-center">
                  <div className="h-0.5 bg-gray-200 dark:bg-slate-800/90 mb-2" />
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                    {t("course.certificate.dateIssued")}
                  </p>
                  <p className="font-serif text-gray-800 dark:text-slate-200">
                    {formattedDate}
                  </p>
                </div>
                <div className="text-center">
                  <div className="h-0.5 bg-gray-200 dark:bg-slate-800/90 mb-2" />
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                    {t("course.certificate.instructor")}
                  </p>
                  <p className="font-serif text-gray-800 dark:text-slate-200">
                    {t("course.certificate.expertTeam")}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`absolute bottom-8 ${isRtl ? "left-8" : "right-8"} flex items-center gap-4`}
            >
              <div className="p-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm rounded-lg">
                <QrCode className="w-12 h-12 text-gray-800 dark:text-slate-200" />
              </div>
              <div className={isRtl ? "text-right" : "text-left"}>
                <p className="text-[10px] text-gray-400 font-bold uppercase">
                  {t("course.certificate.verificationId")}
                </p>
                <p className="text-xs font-mono text-gray-600 dark:text-slate-400">
                  {certificateId
                    ? certificateId.slice(0, 12).toUpperCase()
                    : ""}
                </p>
              </div>
            </div>

            <div
              className={`absolute -bottom-12 ${isRtl ? "-right-12" : "-left-12"} w-48 h-48 bg-blue-50 dark:bg-slate-900/60 dark:bg-blue-950/60 rounded-full border border-blue-100 dark:border-blue-900/50 dark:border-blue-900/50`}
            />
            <ShieldCheck
              className={`absolute bottom-12 ${isRtl ? "right-12" : "left-12"} w-16 h-16 text-blue-100`}
            />
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isGenerating
                ? t("course.certificate.processing")
                : t("course.certificate.downloadPdf")}
            </button>
            <button
              onClick={handleShareLinkedIn}
              className="flex items-center gap-2 px-8 py-3 bg-[#0077b5] text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-[#006396] transition-all"
            >
              <Linkedin className="w-5 h-5" />
              {t("course.certificate.shareLinkedIn")}
            </button>
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${
                linkCopied
                  ? "bg-green-500 text-white shadow-green-200"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-indigo-200"
              }`}
            >
              {linkCopied ? (
                <Check className="w-5 h-5" />
              ) : (
                <Link2 className="w-5 h-5" />
              )}
              {linkCopied
                ? t("course.certificate.linkCopied")
                : t("course.certificate.verifyLink")}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 shadow-sm border border-amber-100 dark:border-amber-900/50 text-center relative overflow-hidden group">
          <div className="relative z-10">
            <div className="w-24 h-24 bg-amber-50 dark:bg-amber-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
              <Award className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("course.certificate.purchaseTitle")}
            </h2>
            <p className="text-gray-500 dark:text-slate-400 max-w-md mx-auto mb-8">
              {t("course.certificate.purchaseDescription")}
            </p>
            <button
              onClick={() => setShowCertWalletModal(true)}
              disabled={isPurchasingCert}
              className="inline-flex items-center gap-2 px-8 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all disabled:opacity-50"
            >
              {isPurchasingCert ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShoppingCart className="w-5 h-5" />
              )}
              {t("course.certificate.purchaseButton")}
            </button>
          </div>
          <Award className="absolute -bottom-10 -right-10 w-64 h-64 text-amber-50 opacity-30" />
        </div>
      )}
      <WalletPaymentModal
        isOpen={showCertWalletModal}
        onClose={() => setShowCertWalletModal(false)}
        amount={1500}
        walletBalance={onWalletBalance}
        onPayWithWallet={() => handlePurchaseCertificate(false)}
        onPayWithCard={() => handlePurchaseCertificate(true)}
        processing={isPurchasingCert}
      />
    </div>
  );
};
