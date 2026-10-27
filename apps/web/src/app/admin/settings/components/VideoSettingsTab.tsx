"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  ShieldCheck,
  Zap,
  Key,
  RefreshCw,
  Sparkles,
  Layers,
  Film,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import { VideoProviderConfigModal } from "./VideoProviderConfigModal";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";

interface ProviderItem {
  id: string;
  name: string;
  tagline: string;
  costPerTb: string;
  badgeColor: string;
  category: "free" | "paid";
}

const PAID_PROVIDERS: ProviderItem[] = [
  {
    id: "bunny",
    name: "Bunny Stream",
    tagline:
      "Ultra-low bandwidth cost ($0.005/GB), instant HLS encoding & tokenized security",
    costPerTb: "$5.00 / mo (93% savings)",
    badgeColor: "border-orange-500/40 text-orange-400 bg-orange-500/10",
    category: "paid",
  },
  {
    id: "cloudflare",
    name: "Cloudflare Stream",
    tagline:
      "RS256 signed JWT tokens, global edge computing & sub-second start times",
    costPerTb: "$15.00 / mo",
    badgeColor: "border-blue-500/40 text-blue-400 bg-blue-500/10",
    category: "paid",
  },
  {
    id: "aws",
    name: "AWS MediaConvert + CloudFront",
    tagline: "High scalability, global S3 distribution, CMAF DRM packaging",
    costPerTb: "$78.20 / mo",
    badgeColor: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    category: "paid",
  },
];

const FREE_PROVIDERS: ProviderItem[] = [
  {
    id: "youtube",
    name: "YouTube Unlisted",
    tagline:
      "100% free hosting & CDN streaming for teaser preview lessons and free courses",
    costPerTb: "$0.00 / mo (Free)",
    badgeColor: "border-red-500/40 text-red-400 bg-red-500/10",
    category: "free",
  },
  {
    id: "dailymotion",
    name: "Dailymotion Private",
    tagline:
      "Zero infrastructure cost iframe embedding with custom player controls",
    costPerTb: "$0.00 / mo (Free)",
    badgeColor: "border-sky-500/40 text-sky-400 bg-sky-500/10",
    category: "free",
  },
  {
    id: "vimeo",
    name: "Vimeo Unlisted / Pro",
    tagline:
      "High-definition unlisted video playback with customizable embed player",
    costPerTb: "$0.00 / mo (Free/Account)",
    badgeColor: "border-teal-500/40 text-teal-400 bg-teal-500/10",
    category: "free",
  },
  {
    id: "local",
    name: "Local Storage (Dev/Self-hosted)",
    tagline: "Serve directly from server disk without 3rd-party dependencies",
    costPerTb: "Local disk",
    badgeColor: "border-gray-500/40 text-gray-400 bg-gray-500/10",
    category: "free",
  },
];

export const VideoSettingsTab: React.FC = () => {
  const t = useTranslations("admin");
  const [freeProvider, setFreeProvider] = useState<string>("youtube");
  const [paidProvider, setPaidProvider] = useState<string>("bunny");
  const [modalProvider, setModalProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<
    Record<string, { status: string; latencyMs: number }>
  >({});

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/v1/admin/settings/video");
        if (res.ok) {
          const data = await res.json();
          if (data.free_provider) setFreeProvider(data.free_provider);
          if (data.paid_provider) setPaidProvider(data.paid_provider);
        }
      } catch (err) {
        console.error("Failed to load video settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleTestConnection = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const start = Date.now();
      const res = await fetch("/api/v1/admin/settings/video/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      const latency = Date.now() - start;
      if (res.ok) {
        setPingResult((prev) => ({
          ...prev,
          [providerId]: { status: "Connected", latencyMs: latency },
        }));
        toast.success(
          t("settings.video.connected", {
            provider: providerId,
            latency: latency.toString(),
          }),
        );
      } else {
        setPingResult((prev) => ({
          ...prev,
          [providerId]: { status: "Failed", latencyMs: latency },
        }));
        toast.error(
          t("settings.video.connectionFailed", { provider: providerId }),
        );
      }
    } catch {
      setPingResult((prev) => ({
        ...prev,
        [providerId]: { status: "Error", latencyMs: 0 },
      }));
      toast.error(
        t("settings.video.connectionError", { provider: providerId }),
      );
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSwitchFreeProvider = async (providerId: string) => {
    setFreeProvider(providerId);
    try {
      const res = await fetch("/api/v1/admin/settings/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          free_provider: providerId,
          paid_provider: paidProvider,
          settings: {},
        }),
      });
      if (res.ok) {
        toast.success(
          t("settings.video.freeProviderSet", {
            provider: providerId.toUpperCase(),
          }),
        );
      }
    } catch (e) {
      console.error("Failed to switch free provider", e);
      toast.error(t("settings.video.errors.freeProviderUpdateFailed"));
    }
  };

  const handleSwitchPaidProvider = async (providerId: string) => {
    setPaidProvider(providerId);
    try {
      const res = await fetch("/api/v1/admin/settings/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paid_provider: providerId,
          free_provider: freeProvider,
          active_provider: providerId,
          settings: {},
        }),
      });
      if (res.ok) {
        toast.success(
          t("settings.video.paidProviderSet", {
            provider: providerId.toUpperCase(),
          }),
        );
      }
    } catch (e) {
      console.error("Failed to switch paid provider", e);
      toast.error(t("settings.video.errors.paidProviderUpdateFailed"));
    }
  };

  const renderProviderCard = (
    p: ProviderItem,
    isSelected: boolean,
    onSelect: () => void,
  ) => {
    const ping = pingResult[p.id];

    return (
      <PodaciumCard
        key={p.id}
        className={`p-5 relative transition-all border ${
          isSelected
            ? "border-blue-500 shadow-lg shadow-blue-500/10 bg-slate-900/90 ring-1 ring-blue-500/30"
            : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
        }`}
      >
        <div className="flex justify-between items-start mb-3">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${p.badgeColor}`}
          >
            {p.name}
          </span>
          {isSelected && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />{" "}
              {t("settings.video.selected")}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {t(`settings.video.${p.id}.desc`)}
        </p>

        <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-3 mt-2">
          <span className="text-slate-400">
            {t("settings.video.estimatedCost")}:{" "}
            <strong className="text-slate-200">{p.costPerTb}</strong>
          </span>
          {ping && (
            <span
              className={`font-mono text-[11px] ${ping.status === "Connected" ? "text-emerald-400" : "text-rose-400"}`}
            >
              ● {ping.status} ({ping.latencyMs}ms)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          <PodaciumButton
            type="button"
            variant={isSelected ? "secondary" : "outline"}
            onClick={onSelect}
            className="flex-1 text-xs py-1.5"
          >
            {isSelected
              ? t("settings.video.activeForThisTier")
              : t("settings.video.selectProvider")}
          </PodaciumButton>

          <PodaciumButton
            type="button"
            variant="outline"
            onClick={() => setModalProvider(p.id)}
            className="text-xs py-1.5 px-3 flex items-center gap-1 text-slate-300 hover:text-white"
          >
            <Key className="w-3.5 h-3.5" /> {t("settings.video.config")}
          </PodaciumButton>

          <PodaciumButton
            type="button"
            variant="outline"
            onClick={() => handleTestConnection(p.id)}
            disabled={testingProvider === p.id}
            className="text-xs py-1.5 px-3 text-slate-300"
          >
            {testingProvider === p.id ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            )}
          </PodaciumButton>
        </div>
      </PodaciumCard>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            {t("settings.video.smartInfrastructureTitle")}
          </h2>
          <p className="text-sm text-slate-400">
            {t("settings.video.smartInfrastructureDesc")}
          </p>
        </div>
      </div>

      {/* Smart Dispatching Architecture Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/20 shadow-md">
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 mb-1">
              {t("settings.video.twoTierBannerTitle")}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t("settings.video.twoTierBannerDesc")}
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <Film className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>
                  <strong className="text-slate-100">
                    {t("settings.video.twoTierFreeTier")}
                  </strong>{" "}
                  <span className="text-red-400 font-mono font-semibold uppercase">
                    {freeProvider}
                  </span>{" "}
                  ($0/GB)
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <Layers className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span>
                  <strong className="text-slate-100">
                    {t("settings.video.twoTierPaidTier")}
                  </strong>{" "}
                  <span className="text-orange-400 font-mono font-semibold uppercase">
                    {paidProvider}
                  </span>{" "}
                  {t("settings.video.hlsTokenized")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Paid / Enrolled Provider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              {t("settings.video.paidSectionTitle")}
            </h3>
            <p className="text-xs text-slate-400">
              {t("settings.video.paidSectionDesc")}
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 uppercase">
            {t("settings.video.active")}: {paidProvider}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PAID_PROVIDERS.map((p) =>
            renderProviderCard(p, paidProvider === p.id, () =>
              handleSwitchPaidProvider(p.id),
            ),
          )}
        </div>
      </div>

      {/* Section 2: Free / Teaser Provider */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Film className="w-4 h-4 text-emerald-400" />
              {t("settings.video.freeSectionTitle")}
            </h3>
            <p className="text-xs text-slate-400">
              {t("settings.video.freeSectionDesc")}
            </p>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
            {t("settings.video.active")}: {freeProvider}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FREE_PROVIDERS.map((p) =>
            renderProviderCard(p, freeProvider === p.id, () =>
              handleSwitchFreeProvider(p.id),
            ),
          )}
        </div>
      </div>

      {modalProvider && (
        <VideoProviderConfigModal
          providerId={modalProvider}
          onClose={() => setModalProvider(null)}
        />
      )}
    </div>
  );
};
