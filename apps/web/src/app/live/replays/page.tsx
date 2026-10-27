"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Play,
  Clock,
  Calendar,
  Eye,
  EyeOff,
  Search,
  ChevronRight,
} from "lucide-react";

import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import {
  SectionCard,
  EmptyState,
  LoadingState,
} from "@/components/SectionComponents";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumAvatar from "@/components/design-system/PodaciumAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi, type LiveSession } from "@/lib/api/live-sessions";

interface ReplayEntry {
  session: LiveSession;
  source: "booking" | "own";
}

export default function ReplaysPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("live");
  const { dir } = useBidi();

  const [entries, setEntries] = useState<ReplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const load = async () => {
      try {
        const [sessionsRes, bookingsRes] = await Promise.all([
          liveSessionsApi.getMySessions().catch(() => ({ items: [] })),
          liveSessionsApi
            .getMyBookings({ limit: 100 })
            .catch(() => ({ items: [] })),
        ]);

        const seen = new Set<string>();
        const result: ReplayEntry[] = [];

        const addIfValid = (
          session: LiveSession,
          source: "booking" | "own",
        ) => {
          if (seen.has(session.id)) return;
          if (session.status !== "ENDED") return;
          if (!session.hasRecording) return;
          seen.add(session.id);
          result.push({ session, source });
        };

        sessionsRes.items.forEach((s) => addIfValid(s, "own"));
        bookingsRes.items.forEach((b) => {
          if (b.session) addIfValid(b.session, "booking");
        });

        result.sort((a, b) => {
          const da = a.session.endedAt
            ? new Date(a.session.endedAt).getTime()
            : 0;
          const db = b.session.endedAt
            ? new Date(b.session.endedAt).getTime()
            : 0;
          return db - da;
        });

        setEntries(result);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, authLoading]);

  const handleWatch = async (sessionId: string) => {
    setWatching(sessionId);
    try {
      const { url } = await liveSessionsApi.getReplayToken(sessionId);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
    } finally {
      setWatching(null);
    }
  };

  const filtered = entries.filter(
    (e) =>
      !search || e.session.title.toLowerCase().includes(search.toLowerCase()),
  );

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <PageHeader
            title={t("replays.title")}
            subtitle={t("replays.subtitle")}
            icon={<Eye className="h-6 w-6" />}
          />

          {loading ? (
            <LoadingState text={t("common.loading")} />
          ) : entries.length > 0 ? (
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("replays.searchPlaceholder")}
                  className="w-full ps-9 pe-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          ) : null}

          {filtered.length === 0 && !loading ? (
            <EmptyState
              icon={<EyeOff className="h-12 w-12" />}
              title={t("replays.empty")}
            />
          ) : (
            <div className="space-y-4">
              {filtered.map((entry) => {
                const session = entry.session;
                const dateStr = session.endedAt
                  ? new Date(session.endedAt).toLocaleDateString()
                  : "";

                return (
                  <SectionCard key={session.id}>
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-16 bg-gradient-to-br from-purple-900/40 to-gray-800 rounded-lg overflow-hidden flex-shrink-0 relative">
                          {session.thumbnailUrl && (
                            <img
                              src={session.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="h-6 w-6 text-white/70" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/live/${session.id}`}
                                className="font-semibold text-gray-900 dark:text-slate-100 hover:text-purple-600 dark:text-purple-400 transition-colors"
                              >
                                {session.title}
                              </Link>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-slate-400">
                                {dateStr && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {dateStr}
                                  </span>
                                )}
                                {session.durationMinutes && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {t("replays.duration", {
                                      n: String(session.durationMinutes),
                                    })}
                                  </span>
                                )}
                                {entry.source === "booking" &&
                                  session.owner && (
                                    <span className="flex items-center gap-1">
                                      <span>
                                        {t("replays.hostedBy", {
                                          name:
                                            session.owner.name ||
                                            t("common.host"),
                                        })}
                                      </span>
                                    </span>
                                  )}
                              </div>
                            </div>
                            <PodaciumButton
                              variant="primary"
                              size="sm"
                              onClick={() => handleWatch(session.id)}
                              disabled={watching === session.id}
                              loading={watching === session.id}
                              icon={<Play className="h-4 w-4" />}
                            >
                              {t("replays.watch")}
                            </PodaciumButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                );
              })}
            </div>
          )}
        </div>
      </PageLayout>
    </div>
  );
}
