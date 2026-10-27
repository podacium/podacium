"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Briefcase,
  Building2,
  GraduationCap,
  Image,
  Star,
  Users,
  Award,
  BarChart3,
  TrendingUp,
  Clock,
  MessageSquare,
  MapPin,
  ExternalLink,
  CheckCircle,
  Activity,
  Zap,
  Database,
  UserCheck,
  Lightbulb,
  FileText,
  Search,
  List,
  Grid,
  Plus,
  X,
  User,
  Link2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import {
  SectionCard,
  StatCard,
  EmptyState,
  ProgressBar,
} from "@/components/SectionComponents";
import { cn } from "@/lib/utils";
import { useTranslations, useBidi } from "@/lib/i18n";
import { ReputationScoreCard } from "./ReputationScoreCard";
import { apiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { portfolioApi } from "@/lib/api/portfolio";
import UniversalImage from "@/components/UniversalImage";
import type { PortfolioItem, PortfolioListResponse } from "@/lib/api/portfolio";
import type { ProfileData } from "./ProfilePageClient";

interface TabContentProps {
  profile: ProfileData;
}

function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl"
        />
      ))}
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const t = useTranslations("profile");
  return (
    <div className="p-6 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl text-center">
      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-red-600 dark:text-red-400 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-red-700 dark:text-red-300 underline underline-offset-2 hover:text-red-800"
        >
          {t("messages.tryAgain")}
        </button>
      )}
    </div>
  );
}

export function OverviewTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      dir={dir}
    >
      <SectionCard title={t("sections.profileInfo")} className="mb-6">
        {profile.bio ? (
          <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
            {profile.bio}
          </p>
        ) : (
          <p className="text-gray-400 italic">{t("fields.noBio")}</p>
        )}
      </SectionCard>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6" dir={dir}>
        <StatCard
          value={profile.average_rating?.toFixed(1) || "-"}
          label={t("header.rating")}
          icon={<Star className="w-5 h-5" />}
          delay={0}
          color="orange"
        />
        <StatCard
          value={profile.follower_count || 0}
          label={t("header.followers")}
          icon={<Users className="w-5 h-5" />}
          color="purple"
          delay={0.1}
        />
        <StatCard
          value={profile.review_count || 0}
          label={t("header.reviews")}
          icon={<MessageSquare className="w-5 h-5" />}
          color="green"
          delay={0.2}
        />
        {profile.profile_view_count !== undefined && (
          <StatCard
            value={profile.profile_view_count}
            label={t("header.profileViews")}
            icon={<BarChart3 className="w-5 h-5" />}
            color="orange"
            delay={0.3}
          />
        )}
      </div>

      {Array.isArray(profile.skills) && profile.skills.length > 0 && (
        <SectionCard title={t("sections.skillsOverview")} className="mb-6">
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((skill, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-900/50"
              >
                {skill}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {profile.social_links && Object.keys(profile.social_links).length > 0 && (
        <SectionCard title={t("tabs.social")} className="mb-6">
          <div className="flex flex-wrap gap-3">
            {Object.entries(profile.social_links).map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-slate-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg text-sm text-gray-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border border-gray-200 dark:border-slate-800"
              >
                <Link2 className="w-3.5 h-3.5" />
                {platform}
                <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t("sections.recentActivity")}>
        {profile.last_active_at ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
            <Clock className="w-4 h-4" />
            {t("header.lastActive")}{" "}
            {new Date(profile.last_active_at).toLocaleDateString()}
          </div>
        ) : (
          <p className="text-gray-400 italic">{t("messages.noActivity")}</p>
        )}
      </SectionCard>
    </motion.div>
  );
}

interface SkillWithCount {
  name: string;
  count: number;
}

interface Certificate {
  id: number;
  title: string;
  issuer: string;
  issuedAt: string;
  url?: string;
}

interface Badge {
  id: number;
  name: string;
  icon: string;
  earnedAt: string;
}

export function LearningTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  const [skills, setSkills] = useState<SkillWithCount[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [skillsData, certsData, badgesData] = await Promise.allSettled([
        apiClient
          .get<SkillWithCount[]>(ENDPOINTS.PROFILES.SKILLS(profile.id))
          .catch(() => []),
        apiClient
          .get<Certificate[]>(ENDPOINTS.PROFILES.CERTIFICATES(profile.id))
          .catch(() => []),
        apiClient
          .get<Badge[]>(ENDPOINTS.PROFILES.BADGES(profile.id))
          .catch(() => []),
      ]);
      if (skillsData.status === "fulfilled") setSkills(skillsData.value);
      if (certsData.status === "fulfilled") setCertificates(certsData.value);
      if (badgesData.status === "fulfilled") setBadges(badgesData.value);
    } catch {
      setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.id]);

  if (loading) return <LoadingSkeleton count={3} />;
  if (error) return <ErrorCard message={error} onRetry={fetchData} />;

  const hasData =
    skills.length > 0 || certificates.length > 0 || badges.length > 0;

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        dir={dir}
      >
        <SectionCard title={t("sections.learningJourney")} className="mb-6">
          <EmptyState
            icon={<BookOpen className="w-10 h-10" />}
            title={t("emptyStates.learning.title")}
            description={t("emptyStates.learning.description")}
          />
        </SectionCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={dir}
    >
      {skills.length > 0 && (
        <SectionCard
          title={t("fields.skillsCount", {
            count: String(skills.length),
            max: "50",
          })}
          className="mb-6"
        >
          <div className="flex flex-wrap gap-2">
            {skills.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-900/50"
              >
                {s.name}
                {s.count > 0 && (
                  <span className="text-xs bg-blue-200 dark:bg-blue-800/80 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full">
                    {s.count}
                  </span>
                )}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {certificates.length > 0 && (
        <SectionCard title={t("sections.certifications")} className="mb-6">
          <div className="space-y-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 rounded-2xl border border-amber-300/60 dark:border-amber-700 shadow-xs hover:border-amber-400/80 transition-all"
                style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded-2xl border border-amber-300/80 dark:border-amber-700 shadow-xs">
                    <Award className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-base">
                      {cert.title}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                      {cert.issuer} &middot;{" "}
                      {new Date(cert.issuedAt).toLocaleDateString()}
                    </p>
                    <span className="inline-block mt-1 font-mono text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 dark:bg-amber-900/50 px-2 py-0.5 rounded-md">
                      {`#POD-CERT-${cert.id}84`}
                    </span>
                  </div>
                </div>
                {cert.url && (
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-100 rounded-xl text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    {t("buttons.viewCertificate")}{" "}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {badges.length > 0 && (
        <SectionCard title={t("sections.certifications")}>
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 rounded-xl border border-amber-200 dark:border-amber-800/80"
              >
                <span className="text-lg">{b.icon}</span>
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {b.name}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {new Date(b.earnedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

interface FreelancerProfile {
  tier: string;
  hourlyRate: number;
  languages: string[];
  completedProjects: number;
  totalEarnings: number;
  averageRating: number;
  skills: string[];
}

interface FreelancerService {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
}

export function FreelancingTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  const [freelancer, setFreelancer] = useState<FreelancerProfile | null>(null);
  const [services, setServices] = useState<FreelancerService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [freelancerData, servicesData] = await Promise.allSettled([
        apiClient
          .get<FreelancerProfile>(ENDPOINTS.PROFILES.FREELANCER(profile.id))
          .catch(() => null),
        apiClient
          .get<FreelancerService[]>(
            ENDPOINTS.PROFILES.FREELANCER_SERVICES(profile.id),
          )
          .catch(() => []),
      ]);
      if (freelancerData.status === "fulfilled")
        setFreelancer(freelancerData.value);
      if (servicesData.status === "fulfilled") setServices(servicesData.value);
    } catch {
      setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.id]);

  if (loading) return <LoadingSkeleton count={2} />;
  if (error) return <ErrorCard message={error} onRetry={fetchData} />;

  if (!freelancer && services.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        dir={dir}
      >
        <SectionCard title={t("sections.projectsWork")} className="mb-6">
          <EmptyState
            icon={<Briefcase className="w-10 h-10" />}
            title={t("emptyStates.projects.title")}
            description={t("emptyStates.projects.description")}
          />
        </SectionCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={dir}
    >
      {freelancer && (
        <div className="mb-6">
          <ReputationScoreCard
            freelancerName={
              profile.full_name || profile.username || "Freelancer"
            }
            tier={
              freelancer.totalEarnings && freelancer.totalEarnings > 500000
                ? "TIER_3_ANAE"
                : "TIER_2_BIOMETRIC"
            }
            weightedRating={freelancer.averageRating || 5.0}
            totalReviews={freelancer.completedProjects || 0}
            clientDiversityScore={92}
            onTimeDeliveryRate={98}
            completedContractsCount={freelancer.completedProjects || 0}
            anaeCardVerified={true}
          />
        </div>
      )}

      {freelancer && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            value={freelancer.completedProjects || 0}
            label={t("header.projects")}
            icon={<Briefcase className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            value={
              freelancer.totalEarnings
                ? `${freelancer.totalEarnings} ${t("messages.currency")}`
                : "0"
            }
            label={t("header.earnings")}
            icon={<BarChart3 className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            value={freelancer.averageRating?.toFixed(1) || "-"}
            label={t("header.courseRating")}
            icon={<Star className="w-5 h-5" />}
            color="orange"
          />
          <StatCard
            value={
              freelancer.hourlyRate
                ? `${freelancer.hourlyRate} ${t("messages.currency")}/hr`
                : "-"
            }
            label={t("header.hourlyRate")}
            icon={<Clock className="w-5 h-5" />}
            color="purple"
          />
        </div>
      )}

      {services.length > 0 && (
        <SectionCard title={t("sections.projectsWork")} className="mb-6">
          <div className="space-y-3">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800"
              >
                <div
                  className="flex items-start justify-between"
                  style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
                >
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-slate-100">
                      {svc.title}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                      {svc.description}
                    </p>
                    {svc.category && (
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full">
                        {svc.category}
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    {svc.price} {t("messages.currency")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

interface BusinessProfile {
  companyRole: string;
  industry: string;
  expertise: string[];
}

interface Dataset {
  id: number;
  name: string;
  description: string;
  rowCount: number;
  status: string;
}

interface MlModel {
  id: number;
  name: string;
  type: string;
  metrics: Record<string, number>;
}

export function BusinessTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [models, setModels] = useState<MlModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bizData, dsData, mlData] = await Promise.allSettled([
        apiClient
          .get<BusinessProfile>(ENDPOINTS.PROFILES.BUSINESS(profile.id))
          .catch(() => null),
        apiClient
          .get<Dataset[]>(ENDPOINTS.PROFILES.BUSINESS_DATASETS(profile.id))
          .catch(() => []),
        apiClient
          .get<MlModel[]>(ENDPOINTS.PROFILES.BUSINESS_ML_MODELS(profile.id))
          .catch(() => []),
      ]);
      if (bizData.status === "fulfilled") setBusiness(bizData.value);
      if (dsData.status === "fulfilled") setDatasets(dsData.value);
      if (mlData.status === "fulfilled") setModels(mlData.value);
    } catch {
      setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.id]);

  if (loading) return <LoadingSkeleton count={2} />;
  if (error) return <ErrorCard message={error} onRetry={fetchData} />;

  const hasData = business || datasets.length > 0 || models.length > 0;

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        dir={dir}
      >
        <SectionCard title={t("tabs.business")} className="mb-6">
          <EmptyState
            icon={<Building2 className="w-10 h-10" />}
            title={t("tabs.business")}
            description={t("emptyStates.business.description")}
          />
        </SectionCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={dir}
      className="space-y-6"
    >
      {business && (
        <SectionCard title={t("tabs.business")} className="mb-6">
          <div className="space-y-2">
            {business.companyRole && (
              <p className="text-sm text-gray-700 dark:text-slate-300 font-medium">
                <strong>{t("fields.role")}:</strong> {business.companyRole}
              </p>
            )}
            {business.industry && (
              <p className="text-sm text-gray-700 dark:text-slate-300 font-medium">
                <strong>{t("fields.industry")}:</strong> {business.industry}
              </p>
            )}
            {business.expertise?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {business.expertise.map((exp, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-semibold border border-blue-100 dark:border-blue-900/50"
                  >
                    {exp}
                  </span>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {datasets.length > 0 && (
        <div className="p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white rounded-3xl shadow-2xl border border-white/10 dark:border-slate-800/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold text-white">
                {t("sections.datasets")}
              </h3>
            </div>
            <span className="text-xs font-mono bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/30">
              ENGINE_READY
            </span>
          </div>
          <div className="space-y-3">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-blue-400/40 transition-colors"
                style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
              >
                <div>
                  <p className="font-semibold text-white text-sm">{ds.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("messages.rows", { count: String(ds.rowCount) })}{" "}
                    &middot;{" "}
                    <span className="text-emerald-400">{ds.status}</span>
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg">
                  #{ds.id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {models.length > 0 && (
        <div className="p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-gray-950 text-white rounded-3xl shadow-2xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-white">
                {t("header.mlModels")}
              </h3>
            </div>
            <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full border border-purple-500/30">
              DEPLOYS_ACTIVE
            </span>
          </div>
          <div className="space-y-3">
            {models.map((m) => (
              <div
                key={m.id}
                className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-purple-400/40 transition-colors"
              >
                <div
                  className="flex items-center justify-between"
                  style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
                >
                  <p className="font-semibold text-white text-sm">{m.name}</p>
                  <span className="text-xs font-mono px-2.5 py-0.5 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">
                    {m.type}
                  </span>
                </div>
                {m.metrics && Object.keys(m.metrics).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(m.metrics).map(([k, v]) => (
                      <span
                        key={k}
                        className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md"
                      >
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface InstructorProfile {
  credentials: string[];
  experience: string;
  publications: string[];
  totalStudents: number;
  totalCourses: number;
  averageRating: number;
}

export function TeachingTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<InstructorProfile>(
        ENDPOINTS.PROFILES.INSTRUCTOR(profile.id),
      );
      setInstructor(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // No instructor profile set up yet — show EmptyState
        setInstructor(null);
      } else {
        setError(t("messages.loadError"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.id]);

  if (loading) return <LoadingSkeleton count={2} />;
  if (error) return <ErrorCard message={error} onRetry={fetchData} />;

  if (!instructor) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        dir={dir}
      >
        <SectionCard title={t("tabs.teaching")} className="mb-6">
          <EmptyState
            icon={<GraduationCap className="w-10 h-10" />}
            title={t("tabs.teaching")}
            description={t("emptyStates.teaching.description")}
          />
        </SectionCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={dir}
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          value={instructor.totalCourses || 0}
          label={t("header.courses")}
          icon={<BookOpen className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          value={instructor.totalStudents || 0}
          label={t("header.students")}
          icon={<Users className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          value={instructor.averageRating?.toFixed(1) || "-"}
          label={t("header.courseRating")}
          icon={<Star className="w-5 h-5" />}
          color="orange"
        />
      </div>

      {instructor.credentials?.length > 0 && (
        <SectionCard title={t("sections.credentials")} className="mb-6">
          <ul className="space-y-2">
            {instructor.credentials.map((c, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300"
              >
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {instructor.experience && (
        <SectionCard title={t("sections.experience")} className="mb-6">
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
            {instructor.experience}
          </p>
        </SectionCard>
      )}

      {instructor.publications?.length > 0 && (
        <SectionCard title={t("sections.publications")} className="mb-6">
          <ul className="space-y-2">
            {instructor.publications.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300"
              >
                <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                {p}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </motion.div>
  );
}

export function PortfolioTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await portfolioApi.getUserPortfolio(profile.id);
      setItems(data.items || []);
    } catch {
      setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.id]);

  if (loading) return <LoadingSkeleton count={2} />;
  if (error) return <ErrorCard message={error} onRetry={fetchData} />;

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        dir={dir}
      >
        <SectionCard title={t("tabs.portfolio")} className="mb-6">
          <EmptyState
            icon={<Image className="w-10 h-10" />}
            title={t("emptyStates.projects.title")}
            description={t("emptyStates.projects.description")}
          />
        </SectionCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={dir}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {item.mediaUrls?.[0] && (
              <div className="aspect-video bg-gray-100 dark:bg-slate-800 relative overflow-hidden">
                <UniversalImage
                  src={item.mediaUrls[0]}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-1.05 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
              {item.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {item.links && item.links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {item.links.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
                    >
                      {link.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  reviewerName: string;
  createdAt: string;
}

interface ReviewsResponse {
  reviews: Review[];
  averageRating: number;
  totalCount: number;
  ratingDistribution: Record<number, number>;
}

export function ReviewsTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ReviewsResponse>(
        ENDPOINTS.PROFILES.REVIEWS(profile.id),
      );
      setReviewsData(data);
    } catch {
      setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.id]);

  if (loading) return <LoadingSkeleton count={2} />;
  if (error) return <ErrorCard message={error} onRetry={fetchData} />;

  if (!reviewsData || reviewsData.totalCount === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        dir={dir}
      >
        <SectionCard title={t("tabs.reviews")} className="mb-6">
          <EmptyState
            icon={<Star className="w-10 h-10" />}
            title={t("tabs.reviews")}
            description={t("emptyStates.reviews.description")}
          />
        </SectionCard>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={dir}
    >
      <div
        className="flex items-center gap-6 mb-6 p-6 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl"
        style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
      >
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-900 dark:text-slate-100">
            {reviewsData.averageRating?.toFixed(1) ?? "-"}
          </div>
          <div className="flex items-center gap-0.5 mt-1 justify-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={cn(
                  "w-4 h-4",
                  i <= Math.round(reviewsData.averageRating)
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-200",
                )}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {reviewsData.totalCount} {t("tabs.reviews")}
          </p>
        </div>
        {reviewsData.ratingDistribution && (
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviewsData.ratingDistribution[star] || 0;
              const pct =
                reviewsData.totalCount > 0
                  ? (count / reviewsData.totalCount) * 100
                  : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-8 text-gray-500 dark:text-slate-400 text-right">
                    {star}
                  </span>
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-gray-400 text-xs">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reviewsData.reviews.length > 0 && (
        <SectionCard title={t("tabs.reviews")}>
          <div className="space-y-4">
            {reviewsData.reviews.map((review) => (
              <div
                key={review.id}
                className="p-4 bg-gray-50 dark:bg-slate-900/60 rounded-xl border border-gray-100 dark:border-slate-800"
              >
                <div
                  className="flex items-center justify-between mb-2"
                  style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
                >
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    {review.reviewerName}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-3.5 h-3.5",
                          i <= review.rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-200",
                        )}
                      />
                    ))}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    {review.comment}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

interface FollowUser {
  id: number;
  fullName: string;
  username: string;
  avatarUrl?: string;
  followedAt: string;
}

interface FollowersResponse {
  followers: FollowUser[];
  total: number;
}

interface FollowingResponse {
  following: FollowUser[];
  total: number;
}

export function SocialTab({ profile }: TabContentProps) {
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, flexDirection } = useBidi();
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followersTotal, setFollowersTotal] = useState(
    profile.follower_count || 0,
  );
  const [followingTotal, setFollowingTotal] = useState(
    profile.following_count || 0,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [followersData, followingData] = await Promise.allSettled([
        apiClient
          .get<FollowersResponse>(ENDPOINTS.PROFILES.FOLLOWERS(profile.id))
          .catch(() => null),
        apiClient
          .get<FollowingResponse>(ENDPOINTS.PROFILES.FOLLOWING(profile.id))
          .catch(() => null),
      ]);
      if (followersData.status === "fulfilled" && followersData.value) {
        setFollowers(followersData.value.followers || []);
        setFollowersTotal(followersData.value.total);
      }
      if (followingData.status === "fulfilled" && followingData.value) {
        setFollowing(followingData.value.following || []);
        setFollowingTotal(followingData.value.total);
      }
    } catch {
      setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile.id]);

  if (loading) return <LoadingSkeleton count={2} />;
  if (error) return <ErrorCard message={error} onRetry={fetchData} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={dir}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard
          title={t("header.followers")}
          description={`${followersTotal} ${t("header.followers")}`}
        >
          {followers.length > 0 ? (
            <div className="space-y-3">
              {followers.map((f) => (
                <Link
                  key={f.id}
                  href={`/profile/${f.username || f.id}`}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors -mx-2"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {f.fullName?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {f.fullName}
                    </p>
                    {f.username && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        @{f.username}
                      </p>
                    )}
                  </div>
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="w-10 h-10" />}
              title={t("header.followers")}
              description={t("emptyStates.followers.description")}
            />
          )}
        </SectionCard>
        <SectionCard
          title={t("header.following")}
          description={`${followingTotal} ${t("header.following")}`}
        >
          {following.length > 0 ? (
            <div className="space-y-3">
              {following.map((f) => (
                <Link
                  key={f.id}
                  href={`/profile/${f.username || f.id}`}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors -mx-2"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {f.fullName?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                      {f.fullName}
                    </p>
                    {f.username && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        @{f.username}
                      </p>
                    )}
                  </div>
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="w-10 h-10" />}
              title={t("header.following")}
              description={t("emptyStates.following.description")}
            />
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
}
