"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Calendar, Clock, Users, Search, TrendingUp } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import PageHeader from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/SectionComponents";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations, useBidi } from "@/lib/i18n";
import { liveSessionsApi, type LiveSession } from "@/lib/api/live-sessions";

const ANIMATION_CONFIGS = {
  SPRING: {
    GENTLE: { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 },
    SMOOTH: { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 },
  },
  EASING: {
    ENTER: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    STANDARD: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  STAGGER: { FAST: 0.05, NORMAL: 0.1, SLOW: 0.2 },
} as const;

function SessionCard({ session }: { session: LiveSession }) {
  const { dir } = useBidi();
  const t = useTranslations("live");
  const isLive = session.status === "LIVE";
  const isScheduled = session.status === "SCHEDULED";
  const date = session.scheduledAt
    ? new Date(session.scheduledAt).toLocaleDateString()
    : "";
  const time = session.scheduledAt
    ? new Date(session.scheduledAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Link href={`/live/${session.id}`}>
      <motion.div
        whileHover={{ y: -6, scale: 1.015 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="group relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-purple-400/60 transition-all shadow-sm hover:shadow-[0_20px_60px_-15px_rgba(147,51,234,0.25)]"
      >
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/70 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 z-10" />
        <div className="relative h-44 bg-gradient-to-br from-purple-100 via-indigo-100 to-gray-100 overflow-hidden">
          {session.thumbnailUrl && (
            <img
              src={session.thumbnailUrl}
              alt={session.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-3 start-3 flex flex-wrap gap-1.5">
            {isLive && (
              <PodaciumBadge
                variant="destructive"
                className="shadow-lg shadow-red-500/30"
              >
                <span className="h-1.5 w-1.5 bg-white dark:bg-slate-900 rounded-full animate-pulse me-1" />
                {t("common.live")}
              </PodaciumBadge>
            )}
            {session.type && (
              <PodaciumBadge
                variant="outline"
                className="backdrop-blur bg-white/90 dark:bg-slate-900/90 text-xs font-medium"
              >
                {t("types." + session.type) || session.type}
              </PodaciumBadge>
            )}
            {session.category && (
              <PodaciumBadge
                variant="secondary"
                className="backdrop-blur bg-white/80 dark:bg-slate-900/80"
              >
                {t("categories." + (session.category || "")) ||
                  session.category}
              </PodaciumBadge>
            )}
          </div>
          {session.priceAmount && session.priceAmount > 0 ? (
            <div className="absolute top-3 end-3 px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs rounded-full font-semibold shadow-lg shadow-purple-500/30">
              {session.priceAmount} {t("common.dzd")}
            </div>
          ) : (
            <div className="absolute top-3 end-3 px-2.5 py-1 bg-emerald-600 text-white text-xs rounded-full font-semibold shadow-lg shadow-emerald-500/30">
              {t("common.free")}
            </div>
          )}
        </div>
        <div className="p-5">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 group-hover:text-purple-600 dark:text-purple-400 transition-colors truncate">
            {session.title}
          </h3>
          {session.description && (
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 line-clamp-2">
              {session.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3.5 text-xs text-gray-500 dark:text-slate-400">
            {isScheduled && date && (
              <>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {time}
                </span>
              </>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {session.bookingCount}/
              {session.maxParticipants || t("common.unlimited")}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function LivePage() {
  const { user } = useAuth();
  const t = useTranslations("live");
  const { dir } = useBidi();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [trending, setTrending] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    Promise.all([
      liveSessionsApi.listSessions({ limit: 20 }),
      liveSessionsApi.getTrending(),
    ])
      .then(([list, trend]) => {
        setSessions(list.items);
        setTrending(trend.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    search || category
      ? sessions.filter(
          (s) =>
            (!search || s.title.toLowerCase().includes(search.toLowerCase())) &&
            (!category || s.category === category),
        )
      : sessions;

  const categories = [
    ...new Set(sessions.filter((s) => s.category).map((s) => s.category)),
  ] as string[];

  return (
    <div dir={dir}>
      <PageLayout background="gray">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageHeader
            title={t("listing.title")}
            subtitle={t("listing.subtitle")}
            icon={<TrendingUp className="h-6 w-6" />}
            actions={
              user ? (
                <Link href="/live/create">
                  <PodaciumButton variant="primary" size="sm">
                    {t("listing.createButton")}
                  </PodaciumButton>
                </Link>
              ) : undefined
            }
          />

          <div className="flex gap-4 mb-8">
            <div className="flex-1">
              <PodaciumInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("listing.searchPlaceholder")}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="w-48">
              <PodaciumSelect
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: "", label: t("listing.allCategories") },
                  ...categories.map((c) => ({
                    value: c,
                    label: t("categories." + c) || c,
                  })),
                ]}
              />
            </div>
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: ANIMATION_CONFIGS.STAGGER.NORMAL,
                },
              },
            }}
          >
            {loading ? (
              <LoadingState text={t("common.loading")} />
            ) : (
              <>
                {trending.length > 0 && (
                  <section className="mb-12">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                        {t("listing.trending")}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {trending.slice(0, 3).map((session) => (
                        <motion.div
                          key={session.id}
                          variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: {
                              opacity: 1,
                              y: 0,
                              transition: ANIMATION_CONFIGS.EASING.ENTER,
                            },
                          }}
                        >
                          <SessionCard session={session} />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">
                    {t("listing.allSessions")}
                  </h2>
                  {filtered.length === 0 ? (
                    <EmptyState
                      icon={<Calendar className="h-12 w-12" />}
                      title={t("listing.noSessions")}
                      description={
                        search || category ? t("listing.noResults") : undefined
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filtered.map((session) => (
                        <motion.div
                          key={session.id}
                          variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: {
                              opacity: 1,
                              y: 0,
                              transition: ANIMATION_CONFIGS.EASING.ENTER,
                            },
                          }}
                        >
                          <SessionCard session={session} />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </motion.div>
        </div>
      </PageLayout>
    </div>
  );
}
