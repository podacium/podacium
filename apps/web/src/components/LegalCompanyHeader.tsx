import React from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertCircle,
  MapPin,
  Mail,
  Phone,
  Globe,
  Clock,
  Building,
  Fingerprint,
  FileText,
  UserCheck,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import HighlightCard from "./LegalHighlightCard";

interface LegalCompanyHeaderProps {
  pageNamespace?: "terms" | "privacy" | "cookies" | "refund";
  mainIcon?: React.ReactNode;
}

const LegalCompanyHeader: React.FC<LegalCompanyHeaderProps> = ({
  pageNamespace: _pageNamespace,
  mainIcon = <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
}) => {
  const t = useTranslations("legal");
  const direction = t.dir;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-12"
      dir={direction}
    >
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-800/80 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-8 md:p-10">
        {/* Decorative accent */}
        <div className="absolute inset-0 opacity-5">
          <div
            className={`absolute top-0 start-0 w-80 h-80 bg-blue-400 rounded-full blur-3xl`}
          />
        </div>

        <div className="relative z-10">
          {/* Header with Logo */}
          <div
            className={`flex items-center gap-4 mb-6 pb-6 border-b border-blue-200 dark:border-blue-800/80`}
          >
            {mainIcon && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className={`p-3 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex-shrink-0 rtl:-scale-x-100`}
              >
                {mainIcon}
              </motion.div>
            )}
            <div className={`flex-1 text-start`}>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-slate-100">
                {t("company.name")}
              </h2>
              <p className="text-gray-600 dark:text-slate-400 text-sm mt-1">
                {t("company.registeredCompany")}
              </p>
            </div>
          </div>

          {/* Language Notice */}
          <div className="mb-6">
            <HighlightCard
              icon={<AlertCircle className="w-5 h-5" />}
              title={t("cards.languageNotice.title")}
              description={t("cards.languageNotice.description")}
              color="yellow"
              dir={direction}
            />
          </div>

          {/* Company Registration Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <Building className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-start">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  RC
                </p>
                <p className="text-sm text-gray-800 dark:text-slate-200 font-medium">
                  {t("company.rc")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <Fingerprint className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-start">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  NIF
                </p>
                <p className="text-sm text-gray-800 dark:text-slate-200 font-medium">
                  {t("company.nif")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="text-start">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  NI
                </p>
                <p className="text-sm text-gray-800 dark:text-slate-200 font-medium">
                  {t("company.ni")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-start">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  {t("contact.capital.title")}
                </p>
                <p className="text-sm text-gray-800 dark:text-slate-200 font-medium">
                  {t("company.capital")}
                </p>
              </div>
            </div>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Address */}
            <div className={`flex items-start gap-3`}>
              <MapPin
                className={`w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0`}
              />
              <div className={`flex-1 text-start`}>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  {t("contact.address.title")}
                </p>
                <p className="text-gray-800 dark:text-slate-200 font-medium">
                  {t("company.fullAddress")}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className={`flex items-start gap-3`}>
              <Mail className={`w-5 h-5 text-green-600 mt-0.5 flex-shrink-0`} />
              <div className={`flex-1 text-start`}>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  {t("contact.email.title")}
                </p>
                <p className="text-gray-800 dark:text-slate-200 font-medium break-all">
                  {t.forceLTR(t("company.email"))}
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className={`flex items-start gap-3`}>
              <Phone
                className={`w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0 rtl:-rotate-90`}
              />
              <div className={`flex-1 text-start`}>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  {t("contact.phone.title")}
                </p>
                <p className="text-gray-800 dark:text-slate-200 font-medium">
                  {t.forceLTR(t("company.phone"))}
                </p>
              </div>
            </div>

            {/* Website */}
            <div className={`flex items-start gap-3`}>
              <Globe
                className={`w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0`}
              />
              <div className={`flex-1 text-start`}>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  {t("contact.website.title")}
                </p>
                <p className="text-gray-800 dark:text-slate-200 font-medium">
                  {t.forceLTR(t("company.website"))}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                  {t.forceLTR(t("company.websiteAlt1"))} ·{" "}
                  {t.forceLTR(t("company.websiteAlt2"))}
                </p>
              </div>
            </div>
          </div>

          {/* DPO Information */}
          {t.raw("company.dpoEmail") && (
            <div className="mb-6 p-4 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-green-100 dark:border-emerald-900/50">
              <div className="flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-start">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    {t("company.dpo")}
                  </p>
                  <p className="text-gray-800 dark:text-slate-200 font-medium break-all">
                    {t.forceLTR(t("company.dpoEmail"))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Metadata Footer */}
          <div
            className={`flex items-center gap-4 pt-6 border-t border-blue-200 dark:border-blue-800/80 flex-wrap`}
          >
            <div className={`flex-1 text-start min-w-[120px]`}>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wide">
                {t("effectiveDate")}
              </p>
              <p className="text-gray-900 dark:text-slate-100 font-semibold whitespace-nowrap">
                {t("dates.effectiveDate")}
              </p>
            </div>
            <div className="hidden md:block w-px h-12 bg-blue-200 dark:bg-blue-800/80 opacity-50" />
            <div className={`flex-1 text-start min-w-[120px]`}>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wide">
                {t("lastUpdated")}
              </p>
              <p className="text-gray-900 dark:text-slate-100 font-semibold whitespace-nowrap">
                {t("dates.lastUpdated")}
              </p>
            </div>
            <div className="hidden md:block w-px h-12 bg-blue-200 dark:bg-blue-800/80 opacity-50" />
            <div className={`flex-1 text-start min-w-[120px]`}>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wide">
                {t("version")}
              </p>
              <p className="text-gray-900 dark:text-slate-100 font-semibold whitespace-nowrap">
                {t("dates.version")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LegalCompanyHeader;
