import React, { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Star,
  Zap,
  Award,
  BadgeCheck,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  FolderOpen,
} from "lucide-react";
import {
  paymentsApi,
  FeatureListing,
  ActiveFeature,
} from "../../lib/api/payments";
import { useTranslations, useLocale, useBidi } from "../../lib/i18n";
import api from "../../lib/api";

interface FeatureStoreProps {
  walletPodaPoints: number;
  onSuccess?: () => void;
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  project_post: <Sparkles className="w-7 h-7" />,
  featured_project_7d: <Star className="w-7 h-7" />,
  freelancer_boost: <Zap className="w-7 h-7" />,
  freelancer_featured_7d: <Award className="w-7 h-7" />,
  skill_passport: <BadgeCheck className="w-7 h-7" />,
};

const FEATURE_GRADIENTS: Record<string, string> = {
  project_post: "from-blue-500 to-cyan-500",
  featured_project_7d: "from-amber-500 to-orange-500",
  freelancer_boost: "from-purple-500 to-pink-500",
  freelancer_featured_7d: "from-emerald-500 to-teal-500",
  skill_passport: "from-indigo-500 to-violet-500",
};

const FEATURE_LABELS: Record<string, string> = {
  project_post: "features.projectPost",
  featured_project_7d: "features.featuredProject",
  freelancer_boost: "features.freelancerBoost",
  freelancer_featured_7d: "features.featuredFreelancer",
  skill_passport: "features.skillPassport",
};

const FEATURE_DESCS: Record<string, string> = {
  project_post: "features.projectPostDesc",
  featured_project_7d: "features.featuredProjectDesc",
  freelancer_boost: "features.freelancerBoostDesc",
  freelancer_featured_7d: "features.featuredFreelancerDesc",
  skill_passport: "features.skillPassportDesc",
};

export default function FeatureStore({
  walletPodaPoints,
  onSuccess,
}: FeatureStoreProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { dir } = useBidi();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<FeatureListing | null>(
    null,
  );

  const { data: featuresData, mutate: mutateFeatures } = useSWR(
    "features-list",
    () => paymentsApi.getFeatures(),
  );
  const { data: activeData, mutate: mutateActive } = useSWR(
    "features-active",
    () => paymentsApi.getActiveFeatures(),
  );

  const features = featuresData?.features || [];
  const activeFeatures = activeData?.active_features || [];
  const activeFeatureKeys = new Set(
    activeFeatures.map((a) => a.feature_key || a.type),
  );

  const handlePurchase = async (feature: FeatureListing) => {
    if (purchasing) return;

    if (feature.key === "featured_project_7d") {
      setPendingFeature(feature);
      setLoadingProjects(true);
      setShowProjectPicker(true);
      try {
        const res = await api.getMyProjects({ limit: 50, status: "all" });
        setProjects(res?.projects || []);
      } catch {
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
      return;
    }

    setPurchasing(feature.key);
    setError(null);
    setSuccessKey(null);

    try {
      const qty =
        feature.key === "project_post" ? quantities[feature.key] || 1 : 1;
      await paymentsApi.purchaseFeature(feature.key, undefined, qty);
      setQuantities((prev) => ({ ...prev, [feature.key]: 1 }));
      setSuccessKey(feature.key);
      mutateActive();
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccessKey(null), 3000);
    } catch (err: any) {
      setError(
        t(err?.message) ||
          err?.message ||
          t("common.errors.podaPoints.spend_failed"),
      );
    } finally {
      setPurchasing(null);
    }
  };

  const confirmProjectPick = async (projectId: string) => {
    if (!pendingFeature) return;
    setShowProjectPicker(false);
    setPendingFeature(null);
    setPurchasing("featured_project_7d");
    setError(null);
    setSuccessKey(null);

    try {
      await paymentsApi.purchaseFeature("featured_project_7d", projectId);
      setSuccessKey("featured_project_7d");
      mutateActive();
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccessKey(null), 3000);
    } catch (err: any) {
      setError(
        t(err?.message) ||
          err?.message ||
          t("common.errors.podaPoints.spend_failed"),
      );
    } finally {
      setPurchasing(null);
    }
  };

  if (!features.length) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
        <p className="text-gray-500 dark:text-slate-400 font-medium">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {activeFeatures.length > 0 && (
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-gray-900 dark:text-slate-100">
              {t("billing.features.activeFeatures")}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeFeatures.map((af: ActiveFeature) => (
              <div
                key={`${af.feature_key || af.type}-${af.reference_id || ""}`}
                className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 dark:bg-emerald-950/60 rounded-2xl border border-emerald-100 dark:border-emerald-900/50"
              >
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                  {FEATURE_ICONS[af.feature_key || af.type] || (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-slate-100 text-sm truncate">
                    {t(
                      `billing.${FEATURE_LABELS[af.feature_key || af.type] || af.type}`,
                    )}
                  </p>
                  {af.expires_at && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {t("billing.features.expires")}:{" "}
                      {new Date(af.expires_at).toLocaleDateString(locale)}
                    </p>
                  )}
                </div>
                <div className="px-2.5 py-1 bg-emerald-200/50 dark:bg-emerald-800/80 text-emerald-800 dark:text-emerald-200 text-[10px] font-black uppercase tracking-wider rounded-full">
                  {t("billing.features.active")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-xl p-8 md:p-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-slate-100">
            {t("billing.features.title")}
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 font-medium mb-8">
          {t("billing.features.subtitle")}
        </p>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-3 border border-red-100 dark:border-red-900/50"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature: FeatureListing, idx: number) => {
            const isActive = activeFeatureKeys.has(feature.key);
            const isPurchasing = purchasing === feature.key;
            const isSuccess = successKey === feature.key;
            const effectivePrice =
              feature.key === "project_post"
                ? feature.price * (quantities[feature.key] || 1)
                : feature.price;
            const canAfford = walletPodaPoints >= effectivePrice;
            const gradient =
              FEATURE_GRADIENTS[feature.key] || "from-blue-500 to-indigo-500";

            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 p-6 flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
                  isActive
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-gray-100 dark:border-slate-800 hover:border-gray-200"
                }`}
              >
                {isActive && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg">
                    {t("billing.features.active")}
                  </div>
                )}

                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-4 shadow-lg`}
                >
                  {FEATURE_ICONS[feature.key] || (
                    <Sparkles className="w-6 h-6" />
                  )}
                </div>

                <h4 className="font-bold text-gray-900 dark:text-slate-100 mb-1">
                  {t(`billing.${FEATURE_LABELS[feature.key] || feature.key}`)}
                </h4>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 flex-1">
                  {t(`billing.${FEATURE_DESCS[feature.key] || feature.key}`)}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 dark:border-slate-800/60">
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <span className="text-2xl font-black text-gray-900 dark:text-slate-100">
                      {feature.key === "project_post"
                        ? (
                            feature.price * (quantities[feature.key] || 1)
                          ).toLocaleString()
                        : feature.price.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-gray-400 uppercase">
                      {t("common.uiLabels.pts")}
                    </span>
                  </div>

                  <AnimatePresence mode="wait">
                    {isSuccess ? (
                      <motion.div
                        key="success"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <motion.button
                        key="button"
                        onClick={() => handlePurchase(feature)}
                        disabled={isPurchasing || isActive || !canAfford}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isActive
                            ? "bg-emerald-100 text-emerald-600"
                            : canAfford
                              ? "bg-gray-900 text-white hover:bg-black shadow-md hover:shadow-lg"
                              : "bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {isPurchasing ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : isActive ? (
                          t("billing.features.active")
                        ) : (
                          t("billing.features.purchase")
                        )}
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {feature.key === "project_post" && !isActive && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-slate-800/60">
                    <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                      {t("billing.features.quantity")}
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [feature.key]: Math.max(
                              1,
                              (prev[feature.key] || 1) - 1,
                            ),
                          }))
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 text-sm font-bold transition-colors"
                        disabled={isPurchasing}
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-slate-100">
                        {quantities[feature.key] || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQuantities((prev) => ({
                            ...prev,
                            [feature.key]: Math.min(
                              10,
                              (prev[feature.key] || 1) + 1,
                            ),
                          }))
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 text-sm font-bold transition-colors"
                        disabled={isPurchasing}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Project Picker Modal for featured_project_7d */}
      <AnimatePresence>
        {showProjectPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowProjectPicker(false);
              setPendingFeature(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 w-full max-w-lg max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-50 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400">
                    <Star className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-slate-100">
                    {t("billing.features.selectProject")}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowProjectPicker(false);
                    setPendingFeature(null);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingProjects ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <FolderOpen className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-slate-400 font-medium">
                      {t("billing.features.noProjects")}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {t("billing.features.createProjectHint")}
                    </p>
                  </div>
                ) : (
                  projects.map((project: any) => (
                    <button
                      key={project.id}
                      onClick={() => confirmProjectPick(String(project.id))}
                      className="w-full text-start p-4 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:bg-amber-950/40 dark:bg-amber-950/60 transition-all group"
                    >
                      <div className="font-bold text-gray-900 dark:text-slate-100 group-hover:text-amber-700 dark:text-amber-300 transition-colors">
                        {project.title}
                      </div>
                      {project.description && (
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          {project.status || "DRAFT"}
                        </span>
                        {project.budget && (
                          <span className="text-xs text-gray-400" dir="ltr">
                            {project.budget.toLocaleString()} DZD
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-gray-50 dark:border-slate-800/60">
                <p className="text-xs text-gray-400 text-center">
                  {t("billing.features.featuredProjectCost")}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
