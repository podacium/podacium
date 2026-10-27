"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Send,
  Mail,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
} from "lucide-react";

import PageLayout from "@/components/PageLayout";
import { SectionCard } from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi } from "@/lib/api/live-sessions";

export default function TransferTicketPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return null;
  if (!user) {
    router.push(`/auth/login?redirect=/live/transfer/${bookingId}`);
    return null;
  }

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      setError(t("transfer.invalidEmail"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await liveSessionsApi.transferBooking(Number(bookingId), trimmed);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || t("transfer.failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <main className="max-w-lg mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <Link
              href="/live/bookings"
              className="inline-flex items-center gap-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" />
              <span className="text-sm font-medium">{t("common.back")}</span>
            </Link>

            {sent ? (
              <SectionCard>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="p-10 text-center"
                >
                  <div className="w-20 h-20 bg-green-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("transfer.success")}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
                    {email}
                  </p>
                  <Link href="/live/bookings">
                    <PodaciumButton variant="outline">
                      {t("bookings.title")}
                    </PodaciumButton>
                  </Link>
                </motion.div>
              </SectionCard>
            ) : (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("transfer.title")}
                  </h1>
                  <p className="text-gray-500 dark:text-slate-400">
                    {t("transfer.description")}
                  </p>
                </div>

                <SectionCard>
                  <div className="p-6 space-y-6">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">
                          {t("transfer.title")}
                        </p>
                        <p>{t("transfer.tooLate")}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                        {t("transfer.recipientEmail")}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("transfer.recipientEmailPlaceholder")}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1.5"
                      >
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </motion.p>
                    )}

                    <PodaciumButton
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={handleSend}
                      disabled={sending || !email.trim()}
                      loading={sending}
                      icon={<Send className="h-5 w-5" />}
                    >
                      {sending
                        ? t("transfer.sending")
                        : t("transfer.sendTransfer")}
                    </PodaciumButton>

                    <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {t("transfer.tooLate")}
                    </p>
                  </div>
                </SectionCard>
              </>
            )}
          </motion.div>
        </main>
      </PageLayout>
    </div>
  );
}
