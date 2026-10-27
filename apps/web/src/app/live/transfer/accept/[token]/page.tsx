"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Ticket, AlertCircle } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import { SectionCard } from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi } from "@/lib/api/live-sessions";

export default function AcceptTransferPage() {
  const { token } = useParams<{ token: string }>();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [accepting, setAccepting] = useState(false);
  const [resolved, setResolved] = useState<"accepted" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return null;
  if (!user) {
    router.push(`/auth/login?redirect=/live/transfer/accept/${token}`);
    return null;
  }

  const handleAccept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      await liveSessionsApi.acceptTransfer(token);
      setResolved("accepted");
    } catch (err) {
      setResolved("failed");
      setError(err instanceof Error ? err.message : t("transfer.error"));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <main className="max-w-lg mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <SectionCard>
              {resolved === "accepted" ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-10 text-center"
                >
                  <div className="w-20 h-20 bg-green-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("transfer.accepted")}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {t("transfer.acceptDescription", { name: "", session: "" })}
                  </p>
                </motion.div>
              ) : resolved === "failed" ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-10 text-center"
                >
                  <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <XCircle className="h-10 w-10 text-gray-600 dark:text-slate-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("transfer.error")}
                  </h2>
                  {error && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center justify-center gap-1.5 mt-2">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                  )}
                  <div className="mt-6">
                    <PodaciumButton
                      variant="outline"
                      onClick={() => router.push("/live/bookings")}
                    >
                      {t("common.back")}
                    </PodaciumButton>
                  </div>
                </motion.div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Ticket className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>

                  <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                    {t("transfer.acceptTitle")}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">
                    {t("transfer.acceptDescription", {
                      name: t("common.user"),
                      session: "",
                    })}
                  </p>

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400 flex items-center justify-center gap-1.5 mb-4">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                  )}

                  <div className="flex gap-3 justify-center">
                    <PodaciumButton
                      variant="primary"
                      size="lg"
                      onClick={handleAccept}
                      disabled={accepting}
                      loading={accepting}
                      icon={<CheckCircle className="h-5 w-5" />}
                    >
                      {accepting ? t("common.loading") : t("transfer.accept")}
                    </PodaciumButton>
                  </div>
                </div>
              )}
            </SectionCard>
          </motion.div>
        </main>
      </PageLayout>
    </div>
  );
}
