"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Wallet,
  Zap,
  ArrowUpRight,
  Clock,
  CheckCircle,
  Star,
  Sparkles,
  Plus,
} from "lucide-react";

import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import {
  SectionCard,
  StatCard,
  EmptyState,
  LoadingState,
} from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import {
  paymentsApi,
  type WalletResponse,
  type WalletTransactionResponse,
} from "@/lib/api/payments";

const ANIMATION = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export default function PodasPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const tCommon = useTranslations("common");
  const { dir } = useBidi();

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }

    Promise.all([
      paymentsApi.getWallet().catch(() => null),
      paymentsApi.getWalletTransactions({ limit: 20 }).catch(() => []),
    ])
      .then(([wallet, txns]) => {
        setWallet(wallet);
        setTransactions(Array.isArray(txns) ? txns : []);
      })
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading) return null;
  if (!user) return null;

  const points = wallet?.podaPoints || 0;

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <PageHeader
            title={t("payout.title")}
            subtitle={t("payout.subtitle")}
            icon={<Sparkles className="h-6 w-6" />}
          />

          {loading ? (
            <LoadingState text={t("common.loading")} />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ANIMATION}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label={t("payout.totalEarned")}
                  value={wallet ? `${points.toLocaleString()} pts` : "—"}
                  icon={<Star className="h-5 w-5" />}
                  color="purple"
                />
                <StatCard
                  label={t("payout.pendingPayout")}
                  value={t("payout.noPending")}
                  icon={<Clock className="h-5 w-5" />}
                  color="green"
                />
                <StatCard
                  label={t("payout.platformFee")}
                  value={t("payout.noCommission")}
                  icon={<Zap className="h-5 w-5" />}
                  color="blue"
                />
              </div>

              {wallet && (
                <SectionCard>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {t("payout.title")}
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                          {points.toLocaleString()} {tCommon("uiLabels.pts")}
                        </p>
                      </div>
                      <PodaciumButton
                        variant="primary"
                        icon={<Plus className="h-5 w-5" />}
                        onClick={() => router.push("/billing")}
                      >
                        {t("payout.topUp")}
                      </PodaciumButton>
                    </div>
                    {points === 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 rounded-lg px-3 py-2">
                        <Clock className="h-4 w-4" />
                        <span>{t("payout.noPoints")}</span>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}

              <SectionCard title={t("payout.transactionHistory")}>
                {transactions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    {t("payout.noEarnings")}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between py-3 px-6"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              (tx.amount || 0) >= 0
                                ? "bg-purple-50"
                                : "bg-gray-50 dark:bg-slate-900/60"
                            }`}
                          >
                            {(tx.amount || 0) >= 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-gray-400 rotate-180" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                              {tx.description || tx.purpose || tx.type}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold ${
                            (tx.amount || 0) >= 0
                              ? "text-purple-600"
                              : "text-red-500"
                          }`}
                        >
                          {(tx.amount || 0) >= 0 ? "+" : ""}
                          {(tx.amount || 0).toLocaleString()}{" "}
                          {tCommon("uiLabels.pts")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </motion.div>
          )}
        </div>
      </PageLayout>
    </div>
  );
}
