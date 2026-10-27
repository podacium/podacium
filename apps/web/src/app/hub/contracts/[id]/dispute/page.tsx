/**
 * apps/web/src/app/hub/contracts/[id]/dispute/page.tsx
 *
 * Dispute submission / view page.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "@/lib/i18n";

import api, { DisputeReason, DisputeStatus } from "@/lib/api";

const fetcher = async (key: string, arg?: any) => {
  if (key === "auth") return api.getAuthenticatedUser();
  if (key === "contract" && arg) return api.getContractById(arg);
  if (key === "disputes" && arg) return api.disputes.getList(arg);
  return null;
};

export default function ContractDisputePage({
  params,
}: {
  params: { id: string };
}) {
  const t = useTranslations("contracts.dispute");
  const { id: contractId } = params;
  const router = useRouter();
  const { data: auth, error: authError } = useSWR(["auth"], fetcher);
  const { data: contract, error: contractError } = useSWR(
    auth ? ["contract", parseInt(contractId)] : null,
    (_key: string, cid: number) => fetcher("contract", cid),
  );
  const { data: disputes, mutate } = useSWR(
    contract ? ["disputes", parseInt(contractId)] : null,
    (_key: string, cid: number) => fetcher("disputes", cid),
  );

  const [reason, setReason] = useState<DisputeReason | "">("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authError || contractError) {
      toast.error(t("loadError"));
      router.push("/hub/contracts");
    }
  }, [authError, contractError, router, t]);

  useEffect(() => {
    if (!auth || !contract) return;
    const allowed =
      auth.id === contract.clientId || auth.id === contract.freelancerId;
    if (!allowed) {
      toast.error(t("accessDenied"));
      router.push("/hub/contracts");
    }
  }, [auth, contract, router, t]);

  const submitDispute = useCallback(async () => {
    if (!reason || !details.trim()) {
      toast.error(t("provideReasonAndDetails"));
      return;
    }

    if (details.length < 10) {
      toast.error(t("descriptionMinLength"));
      return;
    }

    try {
      setSubmitting(true);
      await api.disputes.create(parseInt(contractId), {
        reason: reason as DisputeReason,
        description: details,
      });
      toast.success(t("submitSuccess"));
      setReason("");
      setDetails("");
      mutate();
    } catch (err: any) {
      console.error("submit dispute error", err);
      toast.error(err.response?.data?.detail || t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }, [contractId, reason, details, mutate, t]);

  if (!auth || !contract)
    return <div className="p-6 pt-24 max-w-4xl mx-auto">{t("loading")}</div>;

  return (
    <div className="px-6 pt-24 sm:pt-28 pb-12 space-y-6 max-w-4xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {t("title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {t("contractHeader", { id: contractId, title: contract.title })}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium"
        >
          {t("backToContract")}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                {t("openDisputes")}
              </h3>
            </div>
            <div className="p-6">
              {!disputes || disputes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 dark:bg-emerald-950/40 text-green-600 mb-3">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {t("noDisputes")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {disputes.map((d: any) => (
                    <div
                      key={d.id}
                      className="border border-gray-200 dark:border-slate-800 rounded-lg p-4 hover:border-red-200 dark:border-red-800/80 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2 py-1 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-bold rounded-full uppercase tracking-wider">
                          {d.reason.replace("_", " ")}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            d.status === DisputeStatus.OPEN
                              ? "bg-yellow-100 text-yellow-800"
                              : d.status === DisputeStatus.RESOLVED
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200"
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                        {t("createdBy")}{" "}
                        {d.creatorId === auth.id ? t("you") : t("otherParty")} —{" "}
                        {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                      <p className="text-gray-700 dark:text-slate-300 text-sm whitespace-pre-wrap">
                        {d.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="bg-white dark:bg-slate-900 shadow-sm border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                {t("reportIssue")}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t("reasonLabel")}
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as DisputeReason)}
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t("selectReason")}</option>
                  <option value={DisputeReason.NON_DELIVERY}>
                    {t("reasons.nonDelivery")}
                  </option>
                  <option value={DisputeReason.POOR_QUALITY}>
                    {t("reasons.poorQuality")}
                  </option>
                  <option value={DisputeReason.INCOMPLETE_REQUIREMENTS}>
                    {t("reasons.incompleteRequirements")}
                  </option>
                  <option value={DisputeReason.OTHER}>
                    {t("reasons.other")}
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  {t("detailsLabel")}
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={t("detailsPlaceholder")}
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={6}
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={submitDispute}
                  disabled={submitting || !reason || details.length < 10}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {submitting ? t("submitting") : t("submitDispute")}
                </button>
                <p className="mt-2 text-[10px] text-gray-400 text-center">
                  {t("notice")}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
