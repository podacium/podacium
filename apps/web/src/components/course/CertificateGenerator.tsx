// components/course/CertificateGenerator.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  Printer,
  Share2,
  ExternalLink,
  Award,
  GraduationCap,
  Calendar,
  Hash,
  Copy,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { ModuleResponse, UserProfileResponse, apiHelpers } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

interface CertificateGeneratorProps {
  course: ModuleResponse;
  user: UserProfileResponse | null;
  progress: number;
  completedAt: string;
}

const CertificateGenerator: React.FC<CertificateGeneratorProps> = ({
  course,
  user,
  progress,
  completedAt,
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState<{
    id: string;
    issuedAt: string;
  } | null>(null);
  const t = useTranslations();

  useEffect(() => {
    const fetchCert = async () => {
      try {
        setLoading(true);
        const data = await apiHelpers.education.generateCertificate(course.id);
        if (data) {
          // Use data.certificateId (UUID string) — NOT data.id (integer PK)
          const certUuid = data.certificateId ?? data.id;
          setCertData({ id: certUuid, issuedAt: data.issuedAt });
        }
      } catch (err) {
        console.error("Error getting certificate:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCert();
  }, [course.id]);

  const certificateId = certData?.id ?? null;
  const verificationUrl =
    certificateId && typeof window !== "undefined"
      ? `${window.location.origin}/verify/${certificateId}`
      : null;
  const displayDate = certData?.issuedAt || completedAt;

  const handleDownloadPDF = async () => {
    setDownloading(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Background gradient (light amber)
      pdf.setFillColor(254, 243, 199);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      // Top and bottom borders
      pdf.setFillColor(251, 191, 36);
      pdf.rect(0, 0, pageWidth, 2, "F");
      pdf.rect(0, pageHeight - 2, pageWidth, 2, "F");

      // Side accent lines
      pdf.setFillColor(251, 146, 60);
      pdf.rect(0, 2, 1.5, pageHeight - 4, "F");
      pdf.rect(pageWidth - 1.5, 2, 1.5, pageHeight - 4, "F");

      let yPosition = margin + 10;

      // Award emoji/icon area
      pdf.setFontSize(24);
      pdf.setTextColor(180, 83, 9);
      pdf.text("🏆", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;

      // Title
      pdf.setFontSize(22);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      const titleText = t("compcourse.certificate.title");
      pdf.text(titleText, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 6;

      // Subtitle
      pdf.setFontSize(11);
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      const subtitleText = t("compcourse.certificate.type");
      pdf.text(subtitleText, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      // "Presented to" text
      pdf.setFontSize(10);
      const presentedText = t("compcourse.certificate.presentedTo");
      pdf.text(presentedText, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 6;

      // Student name
      pdf.setFontSize(20);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      const studentName = user?.fullName || "Student";
      pdf.text(studentName, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 8;

      // "For completing" text
      pdf.setFontSize(10);
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      const completingText = t("compcourse.certificate.forCompleting");
      pdf.text(completingText, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 5;

      // Course title
      pdf.setFontSize(14);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      const splitCourseTitle = pdf.splitTextToSize(
        course.title,
        pageWidth - margin * 2,
      );
      pdf.text(splitCourseTitle, pageWidth / 2, yPosition, { align: "center" });
      yPosition += splitCourseTitle.length * 5 + 6;

      // Grade
      pdf.setFontSize(11);
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      const gradeLabel = t("compcourse.certificate.withGrade");
      pdf.text(`${gradeLabel}: `, pageWidth / 2 - 20, yPosition);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text(`${progress}%`, pageWidth / 2 + 20, yPosition);
      yPosition += 8;

      // Course details in three columns
      const colX = [margin + 5, pageWidth / 2 - 5, pageWidth - margin - 35];
      const detailsY = yPosition;

      // Duration
      pdf.setFontSize(9);
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(120, 120, 120);
      const durationLabel = t("compcourse.certificate.duration");
      pdf.text(durationLabel, colX[0], detailsY);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      const duration = course.durationMinutes
        ? `${Math.floor(course.durationMinutes / 60)}h ${course.durationMinutes % 60}m`
        : "N/A";
      pdf.text(duration, colX[0], detailsY + 4);

      // Completion date
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(120, 120, 120);
      const dateLabel = t("compcourse.certificate.completionDate");
      pdf.text(dateLabel, colX[1], detailsY);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text(formatDate(displayDate), colX[1], detailsY + 4);

      // Certificate ID
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(120, 120, 120);
      const certIdLabel = t("compcourse.certificate.certificateId");
      pdf.text(certIdLabel, colX[2], detailsY);
      pdf.setFontSize(8);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text(certificateId ?? "", colX[2], detailsY + 4);

      yPosition = detailsY + 12;

      // Separator line
      pdf.setDrawColor(251, 191, 36);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 6;

      // Signature section
      const sigX = [margin + 10, pageWidth - margin - 35];

      // Instructor signature area
      pdf.setFontSize(8);
      pdf.setDrawColor(251, 191, 36);
      pdf.setLineWidth(0.3);
      pdf.line(sigX[0], yPosition + 8, sigX[0] + 25, yPosition + 8);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      const instructorName = course.instructor?.fullName || "Instructor";
      pdf.text(instructorName, sigX[0] + 12.5, yPosition + 10, {
        align: "center",
      });
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(7);
      const instructorLabel = t("compcourse.certificate.instructor");
      pdf.text(instructorLabel, sigX[0] + 12.5, yPosition + 13, {
        align: "center",
      });

      // Organization signature area
      pdf.setFontSize(8);
      pdf.line(sigX[1], yPosition + 8, sigX[1] + 25, yPosition + 8);
      pdf.setFont("Helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text("Podacium LMS", sigX[1] + 12.5, yPosition + 10, {
        align: "center",
      });
      pdf.setFont("Helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(7);
      const authorityLabel = t("compcourse.certificate.issuingAuthority");
      pdf.text(authorityLabel, sigX[1] + 12.5, yPosition + 13, {
        align: "center",
      });

      // Verification section at bottom
      if (verificationUrl) {
        pdf.setFontSize(8);
        pdf.setFont("Helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        const verificationLabel = t("compcourse.certificate.verification");
        const verificationText = `${verificationLabel}: ${verificationUrl}`;
        pdf.text(verificationText, margin, pageHeight - 8);
      }

      // Add metadata
      pdf.setProperties({
        title: `Certificate of Completion - ${course.title}`,
        subject: "Course Completion Certificate",
        author: "Podacium LMS",
        keywords: ["certificate", "course", "completion", course.title].join(
          ", ",
        ),
        creator: "Podacium LMS Certificate Generator",
      });

      // Download
      pdf.save(`${course.title.replace(/\s+/g, "_")}_Certificate.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(t("compcourse.certificate.generateError"));
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share && verificationUrl) {
      try {
        await navigator.share({
          title: `Certificate of Completion - ${course.title}`,
          text: `I just completed "${course.title}" on Podacium!`,
          url: verificationUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      if (!verificationUrl) return;
      await navigator.clipboard.writeText(verificationUrl);
      setCopying(true);
      setShowCopied(true);

      setTimeout(() => {
        setShowCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "...";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/60 rounded-2xl border border-amber-200 dark:border-amber-800/80 p-12 text-center">
        <HelpCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 animate-pulse mx-auto mb-4" />
        <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100">
          {t("compcourse.certificate.generating")}
        </h3>
        <p className="text-amber-700 dark:text-amber-300">
          {t("compcourse.certificate.generatingDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Certificate Preview */}
      <div className="relative">
        <div
          ref={certificateRef}
          className="rounded-2xl border-4 border-[#FCD34D] p-8 shadow-2xl"
          style={{
            background:
              "linear-gradient(to bottom right, rgb(254,243,199), white, rgb(254,243,199))",
            fontFamily:
              "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif, 'Arial Unicode MS'",
            direction: "ltr",
            unicodeBidi: "embed",
          }}
        >
          {/* Certificate design */}
          <div
            className="absolute top-0 left-0 right-0 h-2"
            style={{
              background:
                "linear-gradient(to right, rgb(251,191,36), rgb(251,146,60), rgb(251,191,36))",
            }}
          ></div>
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400"></div>

          {/* Decorative elements */}
          <div className="absolute top-4 left-4 w-16 h-16 border-4 border-amber-200 dark:border-amber-800/80 rounded-full opacity-50"></div>
          <div className="absolute top-4 right-4 w-16 h-16 border-4 border-amber-200 dark:border-amber-800/80 rounded-full opacity-50"></div>
          <div className="absolute bottom-4 left-4 w-16 h-16 border-4 border-amber-200 dark:border-amber-800/80 rounded-full opacity-50"></div>
          <div className="absolute bottom-4 right-4 w-16 h-16 border-4 border-amber-200 dark:border-amber-800/80 rounded-full opacity-50"></div>

          {/* Certificate content */}
          <div className="text-center relative z-10">
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full mb-4">
                <Award className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {t("compcourse.certificate.title")}
              </h3>
              <div className="text-gray-600 dark:text-slate-400">
                {t("compcourse.certificate.type")}
              </div>
            </div>

            {/* Body */}
            <div className="mb-8">
              <div className="text-gray-600 dark:text-slate-400 mb-4">
                {t("compcourse.certificate.presentedTo")}
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                {user?.fullName || "Student"}
              </h2>

              <div className="text-gray-600 dark:text-slate-400 mb-4">
                {t("compcourse.certificate.forCompleting")}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">
                {course.title}
              </h3>

              <div className="text-gray-600 dark:text-slate-400 mb-6">
                {t("compcourse.certificate.withGrade")}{" "}
                <span className="font-bold text-gray-900 dark:text-slate-100">
                  {progress}%
                </span>
              </div>

              {/* Course details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="text-center">
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                    {t("compcourse.certificate.duration")}
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-slate-100">
                    {course.durationMinutes
                      ? `${Math.floor(course.durationMinutes / 60)}h ${course.durationMinutes % 60}m`
                      : "N/A"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                    {t("compcourse.certificate.completionDate")}
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-slate-100">
                    {formatDate(displayDate)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-1">
                    {t("compcourse.certificate.certificateId")}
                  </div>
                  <div className="font-mono text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {certificateId}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-amber-200 dark:border-amber-800/80 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="h-16 border-b border-amber-200 dark:border-amber-800/80 mb-4"></div>
                  <div className="font-semibold text-gray-900 dark:text-slate-100">
                    {course.instructor?.fullName || "Course Instructor"}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("compcourse.certificate.instructor")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="h-16 border-b border-amber-200 dark:border-amber-800/80 mb-4 flex items-center justify-center">
                    <GraduationCap className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-slate-100">
                    {t("compcourse.certificate.title")}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400">
                    {t("compcourse.certificate.issuingAuthority")}
                  </div>
                </div>
              </div>
            </div>

            {/* Verification info */}
            <div
              className="mt-8 p-4 rounded-lg"
              style={{
                background:
                  "linear-gradient(to right, rgb(254,243,199), rgb(255,237,213))",
              }}
            >
              <div className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                {t("compcourse.certificate.verification")}
              </div>
              <div className="flex items-center justify-between">
                <div className="font-mono text-sm text-gray-900 dark:text-slate-100 truncate mr-2">
                  {verificationUrl ?? (
                    <span className="text-amber-500 dark:text-amber-400 italic">
                      {t("compcourse.certificate.generating")}&hellip;
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCopyLink}
                  disabled={!verificationUrl}
                  className="p-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 rounded-lg hover:bg-amber-100 dark:bg-amber-900/50 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {showCopied ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="group relative flex-1 min-w-[200px] py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center justify-center">
            {downloading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                {t("compcourse.certificate.actions.downloadPdf")}
              </>
            )}
          </div>
        </button>

        <button
          onClick={handlePrint}
          className="group relative flex-1 min-w-[200px] py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all duration-300"
        >
          <div className="flex items-center justify-center">
            <Printer className="w-5 h-5 mr-2" />
            {t("compcourse.certificate.actions.printCertificate")}
          </div>
        </button>

        <button
          onClick={handleShare}
          className="group relative flex-1 min-w-[200px] py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
        >
          <div className="flex items-center justify-center">
            <Share2 className="w-5 h-5 mr-2" />
            {t("compcourse.certificate.actions.shareAchievement")}
          </div>
        </button>
      </div>

      {/* Certificate details */}
      <div className="bg-gradient-to-br from-gray-100 to-blue-100 rounded-xl border border-gray-200 dark:border-slate-800 p-6">
        <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">
          {t("compcourse.certificate.aboutCertificate")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
              {t("compcourse.certificate.certificateDetails")}
            </h5>
            <ul className="space-y-2">
              <li className="flex items-center text-sm text-gray-600 dark:text-slate-400">
                <Hash className="w-4 h-4 mr-2 text-gray-400" />
                <span className="font-mono">{certificateId}</span>
              </li>
              <li className="flex items-center text-sm text-gray-600 dark:text-slate-400">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                {t("compcourse.certificate.issuedOn")} {formatDate(displayDate)}
              </li>
              <li className="flex items-center text-sm text-gray-600 dark:text-slate-400">
                <Award className="w-4 h-4 mr-2 text-gray-400" />
                {t("compcourse.certificate.validIndefinitely")}
              </li>
            </ul>
          </div>
          <div>
            <h5 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
              {t("compcourse.certificate.verification")}
            </h5>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
              {t("compcourse.certificate.verificationDescription")}
            </p>
            <button
              onClick={() =>
                verificationUrl && window.open(verificationUrl, "_blank")
              }
              disabled={!verificationUrl}
              className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              {t("compcourse.certificate.verifyOnline")}
            </button>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .certificate-container,
          .certificate-container * {
            visibility: visible;
          }
          .certificate-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            border: none;
            box-shadow: none;
          }
          .certificate-actions,
          .certificate-details {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CertificateGenerator;
