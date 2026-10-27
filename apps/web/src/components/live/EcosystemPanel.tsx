"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Loader2, Sparkles, UserRound } from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n";
import {
  liveSessionsApi,
  type LiveEcosystemContext,
} from "@/lib/api/live-sessions";
import PodaciumProgressRing from "@/components/design-system/PodaciumProgressRing";

interface Props {
  sessionId: string;
  userId: number | null;
}

export function EcosystemPanel({ sessionId, userId }: Props) {
  const t = useTranslations("live");
  const locale = useLocale();
  const [data, setData] = useState<LiveEcosystemContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    liveSessionsApi
      .getLiveContext(sessionId, userId, locale)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, userId, locale]);

  if (!userId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6 text-slate-400">
        <Sparkles className="h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-400">
          {t("room.ecosystem.selectParticipant")}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2
          className="h-6 w-6 text-purple-400 animate-spin"
          data-testid="ecosystem-loading"
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
        <p className="text-sm text-red-400" data-testid="ecosystem-error">
          {t("room.ecosystem.error")}
        </p>
      </div>
    );
  }

  const health = data.health;
  const score = health.available
    ? Math.max(0, Math.min(100, Math.round(health.score)))
    : null;
  const ringVariant =
    score === null
      ? "default"
      : score >= 80
        ? "success"
        : score >= 50
          ? "warning"
          : "info";
  const verifiedSkills = data.skillPassport.skills;

  return (
    <motion.div
      className="h-full overflow-y-auto p-4 space-y-5 bg-slate-950 text-slate-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Profile header */}
      <div className="flex items-center gap-3">
        {data.profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.profile.avatarUrl}
            alt={data.profile.fullName}
            className="w-10 h-10 rounded-full object-cover border border-white/10"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-purple-900/50 border border-purple-500/30 flex items-center justify-center shrink-0">
            <UserRound className="h-5 w-5 text-purple-400" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {data.profile.fullName}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {data.profile.headline || data.profile.username || ""}
          </p>
        </div>
      </div>

      {/* Business Health Score */}
      <section data-testid="ecosystem-health">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          {t("room.ecosystem.healthScore")}
        </h3>
        {score !== null ? (
          <div className="flex items-center gap-4 bg-slate-900/90 rounded-xl border border-white/10 p-4">
            <PodaciumProgressRing
              progress={score}
              size={72}
              strokeWidth={6}
              variant={ringVariant}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{health.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {t("room.ecosystem.healthStatus", { score: String(score) })}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/60 rounded-xl border border-white/10 p-4 text-sm text-slate-400">
            {t("room.ecosystem.noHealthData")}
          </div>
        )}
      </section>

      {/* Skill Passport */}
      <section data-testid="ecosystem-passport">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          {t("room.ecosystem.skillPassport")}
        </h3>
        <div className="bg-slate-900/90 rounded-xl border border-white/10 p-4 space-y-3">
          {verifiedSkills.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("room.ecosystem.noSkills")}
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {verifiedSkills.map((skill, index) => (
                <motion.div
                  key={skill.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {skill.verified ? (
                      <BadgeCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                    )}
                    <span className="text-sm text-slate-200 truncate">
                      {skill.name}
                    </span>
                  </span>
                  {skill.endorsements > 0 && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {t("room.ecosystem.endorsements", {
                        count: String(skill.endorsements),
                      })}
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>
    </motion.div>
  );
}
