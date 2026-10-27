"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ShieldCheck,
  UserX,
  Phone,
  Mail,
  XCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  UserCheck,
} from "lucide-react";
import { useTranslations, useTextDirection } from "@/lib/i18n";
import { UserRole, UserProfileResponse } from "@/lib/api";

interface VerificationGateProps {
  user: UserProfileResponse;
}

export const VerificationGate: React.FC<VerificationGateProps> = ({ user }) => {
  const t = useTranslations();
  const direction = useTextDirection();

  const calculateProfileScore = () => {
    const formData = {
      skills: user.skills || [],
      socialLinks: (user as any).socialLinks || {},
    };
    const fields = [
      user.fullName,
      user.bio,
      user.country,
      user.city,
      user.profilePictureUrl,
      formData.skills.length > 0,
      user.role,
      formData.socialLinks && Object.keys(formData.socialLinks).length > 0,
    ];
    const completedFields = fields.filter((field) => {
      if (field === null || field === undefined) return false;
      if (typeof field === "boolean") return field;
      return Boolean(field);
    }).length;
    return Math.round((completedFields / fields.length) * 100);
  };

  const getProfileScoreIcon = (score: number) => {
    if (score < 70)
      return (
        <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
      );
    if (score >= 70 && score < 95)
      return (
        <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
      );
    return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 dark:text-slate-100"
      dir={direction}
    >
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-8xl mx-auto">
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-semibold mb-4">
              <ShieldCheck className="w-4 h-4 mr-2" />
              {t("hub.verification.verificationRequired")}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-slate-100">
              {user.role === UserRole.STUDENT
                ? t("hub.verification.studentRestriction")
                : t("hub.verification.completeProfileTitle")}
            </h1>
            <p className="text-xl text-gray-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {user.role === UserRole.STUDENT
                ? t("hub.verification.studentRestrictionDesc")
                : t("hub.verification.completeProfileDesc")}
            </p>

            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-200 dark:border-blue-800/80 shadow-md">
                <div className="flex-shrink-0">
                  <div className="relative w-16 h-16">
                    <svg
                      className="transform -rotate-90 w-16 h-16"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="6"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={
                          calculateProfileScore() < 30
                            ? "#ef4444"
                            : calculateProfileScore() < 70
                              ? "#f59e0b"
                              : "#10b981"
                        }
                        strokeWidth="6"
                        strokeDasharray={`${(calculateProfileScore() / 100) * 282.6} 282.6`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        {calculateProfileScore()}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900 dark:text-slate-100 text-base">
                    {t("hub.profile.completenessScore")}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                    {calculateProfileScore() < 30
                      ? t("hub.profile.scoreIncomplete")
                      : calculateProfileScore() < 70
                        ? t("hub.profile.scoreInProgress")
                        : t("hub.profile.scoreComplete")}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {user.role === UserRole.STUDENT && (
              <div
                className={`bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-6 border border-red-200 dark:border-red-800/80 ${direction === "rtl" ? "text-right" : ""}`}
              >
                <div
                  className={`flex ${direction === "rtl" ? "flex-row-reverse space-x-reverse" : ""} items-center space-x-3 mb-4`}
                >
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                    <UserX className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                    {t("hub.verification.roleRequirement")}
                  </h3>
                </div>
                <p
                  className={`ml-3 mr-3 text-gray-600 dark:text-slate-400 text-sm mb-4 leading-relaxed ${direction === "rtl" ? "text-right" : ""}`}
                >
                  {t("hub.verification.roleRequirementDesc")}
                </p>
                <Link
                  href="/profile/me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`ml-3 mr-3 inline-flex items-center w-full ${direction === "rtl" ? "flex-row-reverse justify-end" : "justify-start"} text-red-600 dark:text-red-400 hover:text-red-700 font-semibold text-sm`}
                >
                  {t("hub.buttons.updateRole")}
                  <ArrowUpRight
                    className={`w-4 h-4 ${direction === "rtl" ? "mr-2 rotate-180" : "ml-2"}`}
                  />
                </Link>
              </div>
            )}

            {!user.phoneVerified && (
              <div
                className={`bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 rounded-2xl p-6 border border-amber-200 dark:border-amber-800/80 ${direction === "rtl" ? "text-right" : ""}`}
              >
                <div
                  className={`flex ${direction === "rtl" ? "flex-row-reverse space-x-reverse" : ""} items-center space-x-3 mb-4`}
                >
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                    <Phone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                    {t("hub.verification.phoneVerification")}
                  </h3>
                </div>
                <p
                  className={`ml-3 mr-3 text-gray-600 dark:text-slate-400 text-sm mb-3 leading-relaxed ${direction === "rtl" ? "text-right" : ""}`}
                >
                  {t("hub.verification.phoneManualNotice")}
                </p>
                <a
                  href={`mailto:podacium@podacium.com?subject=${encodeURIComponent(t("hub.verification.phoneEmailSubject"))}&body=${encodeURIComponent(t("hub.verification.phoneEmailBody", { email: user.email || "" }))}`}
                  className={`ml-3 mr-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 text-amber-900 dark:text-amber-100 text-sm font-medium rounded-lg transition-colors`}
                >
                  <Mail className="w-4 h-4" />
                  {t("hub.verification.contactAdmin")}
                </a>
              </div>
            )}

            {calculateProfileScore() < 100 && (
              <div
                className={`bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-2xl p-6 border border-purple-200 dark:border-purple-800/80 ${direction === "rtl" ? "text-right" : ""}`}
              >
                <div
                  className={`flex ${direction === "rtl" ? "flex-row-reverse space-x-reverse" : ""} items-center space-x-3 mb-4`}
                >
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <UserCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                    {t("hub.verification.profileCompletion")}
                  </h3>
                </div>
                <p
                  className={`ml-3 mr-3 text-gray-600 dark:text-slate-400 text-sm mb-4 leading-relaxed ${direction === "rtl" ? "text-right" : ""}`}
                >
                  {t("hub.verification.profileCompletionDesc")}
                </p>
                <Link
                  href="/profile/me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`ml-3 mr-3 inline-flex items-center w-full ${direction === "rtl" ? "flex-row-reverse justify-end" : "justify-start"} text-purple-600 dark:text-purple-400 hover:text-purple-700 font-semibold text-sm`}
                >
                  {t("hub.buttons.completeProfile")}
                  <ArrowUpRight
                    className={`w-4 h-4 ${direction === "rtl" ? "mr-2 rotate-180" : "ml-2"}`}
                  />
                </Link>
              </div>
            )}
          </div>

          <div
            className={`max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-sm ${direction === "rtl" ? "text-right" : ""}`}
          >
            <h3
              className={`font-bold text-gray-900 dark:text-slate-100 text-lg mb-4 ${direction === "rtl" ? "text-right" : ""}`}
            >
              {t("hub.verification.accessRequirements")}
            </h3>
            <ul
              className={`space-y-3 ${direction === "rtl" ? "text-right" : ""}`}
            >
              <li
                className={`flex items-start ${direction === "rtl" ? "flex-row-reverse" : ""} space-x-2`}
              >
                <span
                  className={`ml-6 mr-6 text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right flex-1" : ""}`}
                >
                  {t("hub.verification.requirement1")}
                </span>
                {user.role === UserRole.STUDENT ? (
                  <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
              </li>
              <li
                className={`flex items-start ${direction === "rtl" ? "flex-row-reverse" : ""} space-x-2`}
              >
                <span
                  className={`ml-6 mr-6 text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right flex-1" : ""}`}
                >
                  {t("hub.verification.requirement2")}
                </span>
                {!user.phoneVerified ? (
                  <XCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
              </li>
              <li
                className={`flex items-start ${direction === "rtl" ? "flex-row-reverse" : ""} space-x-2`}
              >
                <span
                  className={`ml-6 mr-6 text-gray-700 dark:text-slate-300 ${direction === "rtl" ? "text-right flex-1" : ""}`}
                >
                  {t("hub.verification.requirement3")}
                </span>
                {getProfileScoreIcon(calculateProfileScore())}
              </li>
            </ul>
          </div>

          <div className="text-center">
            <div
              className={`inline-flex ${direction === "rtl" ? "space-x-reverse" : ""} space-x-4 pt-8`}
            >
              <Link
                href="/profile/me"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
              >
                {t("hub.buttons.getStarted")}
              </Link>
              <Link
                href="/hub/projects"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-all duration-300"
              >
                {t("hub.buttons.browseProjects")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
