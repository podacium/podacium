/**
 * apps/web/src/app/hub/contracts/[id]/milestones/page.tsx
 *
 * Milestones page starter.
 *
 * IMPORTANT: Update api imports & function names to match your api.ts.
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";

/* TODO: adjust path & API names */
import api from "@/lib/api";

const fetcher = async (key: string, arg?: any) => {
  if (key === "auth") return api.getAuthenticatedUser?.();
  if (key === "contract" && arg) return api.getContractById?.(arg);
  if (key === "milestones" && arg) return api.getContractMilestones?.(arg);
  return null;
};

export default function ContractMilestonesPage({
  params,
}: {
  params: { id: string };
}) {
  const t = useTranslations("contracts.milestones");
  const contractId = parseInt(params.id, 10);
  const router = useRouter();
  const { data: auth } = useSWR(["auth"], fetcher);
  const { data: contract } = useSWR(
    auth ? ["contract", contractId] : null,
    (_key: string, cid: number) => fetcher("contract", cid),
  );
  const { data: milestones, mutate } = useSWR(
    contract ? ["milestones", contractId] : null,
    (_key: string, cid: number) => fetcher("milestones", cid),
  );

  useEffect(() => {
    if (!auth || !contract) return;
    const allowed =
      auth.id === contract.clientId || auth.id === contract.freelancerId;
    if (!allowed) router.push("/hub/projects");
  }, [auth, contract, router]);

  const markMilestoneDone = useCallback(
    async (milestoneId: number) => {
      try {
        await api.markMilestoneSubmitted?.(contractId, milestoneId);
        mutate();
      } catch (err) {
        console.error(err);
      }
    },
    [contractId, mutate],
  );

  const approveMilestone = useCallback(
    async (milestoneId: number) => {
      try {
        await api.approveMilestone?.(contractId, milestoneId);
        mutate();
      } catch (err) {
        console.error(err);
      }
    },
    [contractId, mutate],
  );

  if (!auth || !contract)
    return <div className="p-6 pt-24 max-w-4xl mx-auto">{t("loading")}</div>;

  return (
    <div className="px-6 pt-24 sm:pt-28 pb-12 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {t("contractHeader", { id: contractId })}
        </p>
      </header>

      <div className="space-y-4">
        {!milestones || milestones.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-slate-400">
            {t("noMilestones")}
          </div>
        ) : (
          milestones.map((ms: any) => (
            <div
              key={ms.id}
              className="bg-white dark:bg-slate-900 shadow rounded-lg p-4 flex items-start justify-between"
            >
              <div>
                <h3 className="font-medium">{ms.title}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {ms.description}
                </p>
                <p className="text-xs text-gray-400">
                  {t("due", {
                    date: ms.dueDate
                      ? new Date(ms.dueDate).toLocaleDateString()
                      : "—",
                  })}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm">
                  {t("status")} <strong>{ms.status}</strong>
                </p>

                {auth.id === contract.freelancerId &&
                  ms.status === "PENDING" && (
                    <button
                      className="px-3 py-1 rounded bg-blue-600 text-white"
                      onClick={() => markMilestoneDone(ms.id)}
                    >
                      {t("markSubmitted")}
                    </button>
                  )}

                {auth.id === contract.clientId && ms.status === "SUBMITTED" && (
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1 rounded bg-green-600 text-white"
                      onClick={() => approveMilestone(ms.id)}
                    >
                      {t("approve")}
                    </button>
                    <button className="px-3 py-1 rounded bg-red-600 text-white">
                      {t("reject")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
