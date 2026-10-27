"use client";

import React, { useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Award,
  Download,
  Share2,
  Link2,
  CheckCircle,
  ShieldCheck,
  Lock,
  QrCode,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Linkedin,
  ExternalLink,
  FileText,
} from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Certificate data interface
interface CertificateData {
  id: string;
  userName: string;
  userEmail?: string;
  completedTitle: string;
  completedType: "module" | "path";
  issuedAt: string;
  verificationUrl: string;
  qrCodeUrl: string;
  fileUrl: string;
  metadata?: {
    moduleTitle?: string;
    pathTitle?: string;
    moduleDescription?: string;
    pathDescription?: string;
    moduleLevel?: string;
    pathLevel?: string;
    completedAt?: string;
    userName?: string;
    skills?: string[];
  };
}

// Toast notification component
const Toast = ({
  message,
  type,
  onClose,
  isRtl,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
  isRtl: boolean;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor =
    type === "success"
      ? "bg-green-500"
      : type === "error"
        ? "bg-red-500"
        : "bg-blue-500";
  const Icon =
    type === "success" ? CheckCircle : type === "error" ? AlertCircle : Check;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={`fixed bottom-8 end-8 z-50 ${bgColor} text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{message}</span>
    </motion.div>
  );
};

export default function CertificatePage() {
  const params = useParams();
  const certificateId = params.id as string;
  const certificateRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("learn.certificate");
  const tc = useTranslations("common");
  const locale = useLocale();
  const isRtl = locale === "ar";

  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Get base URL for verification links
  const getBaseUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_BASE_URL;
  };

  // Fetch certificate data from API
  useEffect(() => {
    const fetchCertificate = async () => {
      try {
        // SECURITY (P0): never read an access token from localStorage.
        // Auth is handled by HTTP-only cookies via the shared API client
        // (credentials: 'include' + CSRF + retry handling).
        const { apiClient } = await import("@/lib/api/client");
        const data = await apiClient.get<any>(
          `/api/education/certificates/${certificateId}`,
        );

        if (!data) {
          throw new Error("Failed to fetch certificate");
        }

        // Build verification URL dynamically
        const baseUrl = getBaseUrl();
        const verificationUrl = `${baseUrl}/verify/${data.id}`;

        setCertificate({
          ...data,
          verificationUrl: data.verificationUrl || verificationUrl,
          qrCodeUrl: data.qrCodeUrl || "",
        });
      } catch (err) {
        console.error("Error fetching certificate:", err);
        setError(tc("error"));
        showToast(tc("error"), "error");
      } finally {
        setLoading(false);
      }
    };

    fetchCertificate();
  }, [certificateId, tc]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  // Download certificate as PDF
  const handleDownloadPDF = async () => {
    if (!certificateRef.current) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

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
      pdf.save(`podacium-certificate-${certificateId}.pdf`);

      showToast(t("downloadSuccess"), "success");
    } catch (err) {
      console.error("PDF generation error:", err);
      showToast(t("downloadError"), "error");
    } finally {
      setDownloading(false);
    }
  };

  // Share on LinkedIn
  const handleLinkedInShare = () => {
    if (!certificate) return;

    setSharing(true);
    try {
      const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(certificate.verificationUrl)}`;
      window.open(shareUrl, "_blank", "width=600,height=400");
      showToast(t("shareSuccess"), "success");
    } catch (err) {
      showToast(t("shareError"), "error");
    } finally {
      setSharing(false);
    }
  };

  // Copy verification link
  const handleCopyLink = async () => {
    if (!certificate) return;

    try {
      await navigator.clipboard.writeText(certificate.verificationUrl);
      setCopied(true);
      showToast(t("linkCopied"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast(t("copyError"), "error");
    }
  };

  // Format date based on locale
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString(
      locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US",
      options,
    );
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gray-50 dark:bg-slate-900/60 flex items-center justify-center"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
          <p className="text-gray-600 dark:text-slate-400 font-medium">
            {tc("loading")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div
        className="min-h-screen bg-gray-50 dark:bg-slate-900/60 flex items-center justify-center"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {t("notFound")}
          </h2>
          <p className="text-gray-600 dark:text-slate-400">
            {t("notFoundDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 pt-24 sm:pt-28 pb-12 px-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Award className="w-4 h-4" />
            {t("title")}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            {certificate.completedTitle}
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            {t("issuedTo")}{" "}
            <span className="font-semibold text-gray-900 dark:text-slate-100">
              {certificate.userName}
            </span>
          </p>
        </motion.div>

        {/* Certificate Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <div
            ref={certificateRef}
            className="bg-white dark:bg-slate-900 rounded-none shadow-2xl overflow-hidden relative"
            style={{ aspectRatio: "1.414/1" }}
          >
            {/* Certificate Border */}
            <div className="absolute inset-4 border-4 border-double border-blue-900/20 pointer-events-none" />

            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 20% 50%, #2563eb 0%, transparent 50%),
                                                  radial-gradient(circle at 80% 80%, #1e40af 0%, transparent 50%)`,
                }}
              />
            </div>

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center p-12 text-center">
              {/* Header */}
              <div className="absolute top-8 start-8 flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Award className="w-7 h-7 text-white" />
                </div>
                <div className="text-start">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                    {t("issuer")}
                  </p>
                  <p className="text-sm font-black text-blue-900 dark:text-blue-100 tracking-tight">
                    LEARNING
                  </p>
                </div>
              </div>

              {/* Main Content */}
              <div className="space-y-6 max-w-2xl">
                <p className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-[0.3em] text-sm">
                  {t("header")}
                </p>

                <p className="text-gray-400 italic font-serif text-lg">
                  {t("certifiedThat")}
                </p>

                <h2 className="text-4xl md:text-5xl font-serif text-gray-900 dark:text-slate-100 border-b-2 border-gray-200 dark:border-slate-800 pb-4 inline-block">
                  {certificate.userName}
                </h2>

                <p className="text-gray-600 dark:text-slate-400 text-lg max-w-xl mx-auto">
                  {t("completionDescription")}
                </p>

                <h3 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100 italic">
                  {certificate.completedTitle}
                </h3>

                {/* Skills Tags */}
                {certificate.metadata?.skills &&
                  certificate.metadata.skills.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 pt-4">
                      {certificate.metadata.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-sm rounded-full font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              {/* Footer Info */}
              <div className="absolute bottom-12 left-0 right-0 px-12">
                <div className="flex justify-between items-end">
                  {/* Date */}
                  <div className="text-center">
                    <div className="h-0.5 bg-gray-300 w-32 mb-2 mx-auto" />
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                      {t("dateIssued")}
                    </p>
                    <p className="font-serif text-gray-800 dark:text-slate-200 text-lg">
                      {formatDate(certificate.issuedAt)}
                    </p>
                  </div>

                  {/* Signature */}
                  <div className="text-center">
                    <div className="h-0.5 bg-gray-300 w-32 mb-2 mx-auto" />
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
                      {t("instructor")}
                    </p>
                    <p className="font-serif text-gray-800 dark:text-slate-200 text-lg">
                      {t("expertTeam")}
                    </p>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="absolute bottom-8 end-8 flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 shadow-lg rounded-lg">
                  <img
                    src={certificate.qrCodeUrl}
                    alt={t("qrCodeAlt")}
                    className="w-16 h-16"
                  />
                </div>
                <div className="text-start">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">
                    {t("verificationId")}
                  </p>
                  <p className="text-xs font-mono text-gray-600 dark:text-slate-400">
                    {certificate.id.slice(0, 12).toUpperCase()}
                  </p>
                </div>
              </div>

              {/* Seals */}
              <div className="absolute -bottom-16 start-[-4rem] w-64 h-64 bg-blue-50 dark:bg-slate-900/60 dark:bg-blue-950/60 rounded-full border border-blue-100 dark:border-blue-900/50" />
              <ShieldCheck className="absolute bottom-16 start-16 w-20 h-20 text-blue-100" />
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4"
        >
          {/* Download PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            {downloading ? tc("processing") : t("downloadPdf")}
          </button>

          {/* Share on LinkedIn */}
          <button
            onClick={handleLinkedInShare}
            disabled={sharing}
            className="flex items-center gap-2 px-8 py-4 bg-[#0077b5] text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-[#006396] hover:shadow-xl transition-all disabled:opacity-50"
          >
            <Linkedin className="w-5 h-5" />
            {t("shareLinkedIn")}
          </button>

          {/* Copy Verification Link */}
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg transition-all ${
              copied
                ? "bg-green-500 text-white shadow-green-200"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-indigo-200"
            }`}
          >
            {copied ? (
              <Check className="w-5 h-5" />
            ) : (
              <Link2 className="w-5 h-5" />
            )}
            {copied ? t("linkCopied") : t("verifyLink")}
          </button>
        </motion.div>

        {/* Verification Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-emerald-950/60 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
                {t("verificationTitle")}
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                {t("verificationDescription")}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <code className="bg-gray-100 dark:bg-slate-800 px-4 py-2 rounded-lg text-sm font-mono text-gray-700 dark:text-slate-300 break-all">
                  {certificate.verificationUrl}
                </code>
                <a
                  href={certificate.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("verifyOnline")}
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Certificate Details */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800"
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            {t("certificateDetails")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                {t("certificateId")}
              </p>
              <p className="font-mono text-gray-900 dark:text-slate-100">
                {certificate.id}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                {t("issueDate")}
              </p>
              <p className="text-gray-900 dark:text-slate-100">
                {formatDate(certificate.issuedAt)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                {t("certificateType")}
              </p>
              <p className="text-gray-900 dark:text-slate-100 capitalize">
                {certificate.completedType === "module"
                  ? t("moduleType")
                  : t("pathType")}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                {t("status")}
              </p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-green-700 font-medium">{t("valid")}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          isRtl={isRtl}
        />
      )}
    </div>
  );
}
