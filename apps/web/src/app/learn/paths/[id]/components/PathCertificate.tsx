"use client";

import { useState } from "react";
import { Award, Download, Loader2, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface PathCertificateProps {
  isCompleted: boolean;
  pathId: string;
  isRtl?: boolean;
  t: (key: string) => string;
}

export default function PathCertificate({
  isCompleted,
  pathId,
  isRtl,
  t,
}: PathCertificateProps) {
  const [generating, setGenerating] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { educationApi } = await import("@/lib/api/education");
      const result = await educationApi.generatePathCertificate(pathId);
      setCertificateUrl(result.certificateId || result.id);
    } catch {
      /* silent */
    } finally {
      setGenerating(false);
    }
  };

  if (!isCompleted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      id="certificate"
      className="p-6 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl border border-amber-200 dark:border-amber-800/80 dark:border-amber-800/80 shadow-sm"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg flex-shrink-0">
          <Award className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-1">
            {t("path.resources.certificate.congratulations")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
            {t("path.resources.certificate.description")}
          </p>
          {certificateUrl ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={`/learn/certificates/${certificateUrl}`}
                target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-all shadow-sm"
              >
                <Award className="w-4 h-4" />
                {t("path.resources.certificate.view")}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/verify/${certificateUrl}`,
                  );
                  toast.success(t("path.resources.certificate.linkCopied"));
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 font-semibold border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all shadow-sm cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                {t("path.resources.certificate.copyLink")}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {t("path.resources.certificate.generate")}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
