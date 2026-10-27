"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations, useBidi } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  Pencil,
  X,
  Save,
  CheckCircle,
  Lock,
  Home,
  ChevronRight,
  User,
} from "lucide-react";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { PodaciumInput } from "@/components/design-system/PodaciumInput";
import { PodaciumSelect } from "@/components/design-system/PodaciumSelect";
import { PodaciumTextarea } from "@/components/design-system/PodaciumTextarea";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileEditModal } from "./ProfileEditModal";
import { ProfileTabsSection } from "./ProfileTabsSection";
import { ViewAsToggle } from "./ViewAsToggle";
import { ProfileQRCodeModal } from "./ProfileQRCodeModal";
import { ProfileCompletionBar } from "./ProfileCompletionBar";
import { PhoneInput } from "./PhoneInput";
import { RoleSelector } from "./RoleSelector";
import { SkillsEditor } from "./SkillsEditor";
import { SocialLinksEditor } from "./SocialLinksEditor";
import { SectionVisibilityModal } from "./SectionVisibilityModal";
import {
  COUNTRIES,
  COUNTRY_CITIES,
  type CountryKey,
} from "@/lib/constants/geo";
import { cn } from "@/lib/utils";

const Footer = lazy(() => import("@/components/Footer"));

export interface ProfileData {
  id: number;
  username?: string;
  full_name: string;
  role: string;
  avatar_url?: string;
  cover_image_url?: string;
  headline?: string;
  tagline?: string;
  pronouns?: string;
  bio?: string;
  country?: string;
  city?: string;
  timezone?: string;
  availability?: string;
  skills: string[];
  is_own_profile: boolean;
  can_message?: boolean;
  average_rating?: number;
  review_count?: number;
  follower_count?: number;
  following_count?: number;
  member_since?: string;
  sections: string[];
  is_verified?: boolean;
  profile_view_count?: number;
  last_active_at?: string;
  social_links?: Record<string, string>;
  email?: string;
  phone?: string;
}

export default function ProfilePageClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { isAuthenticated, user } = useAuth();
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign, marginLeft, flexDirection } = useBidi();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [viewAs, setViewAs] = useState<"public" | "followers" | "self">(
    "public",
  );
  const [showQR, setShowQR] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ProfileData>>({});

  const fetchProfile = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<ProfileData>(
        ENDPOINTS.PROFILES.GET(slug),
      );
      setProfile(data);
      if (data.is_own_profile) {
        setViewAs("self");
      }
      setFollowerCount(data.follower_count || 0);
      if (!data.is_own_profile) {
        try {
          const status = await apiClient.get<{ is_following: boolean }>(
            ENDPOINTS.PROFILES.FOLLOW_STATUS(data.id),
          );
          setIsFollowing(status.is_following);
        } catch {}
      }
    } catch (err: any) {
      setError(err?.detail || t("messages.profileNotFound"));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await apiClient.delete(ENDPOINTS.PROFILES.FOLLOW(profile.id));
        setIsFollowing(false);
        setFollowerCount((p) => Math.max(0, p - 1));
      } else {
        await apiClient.post(ENDPOINTS.PROFILES.FOLLOW(profile.id));
        setIsFollowing(true);
        setFollowerCount((p) => p + 1);
      }
    } catch {}
    setFollowLoading(false);
  };

  const enterEditMode = () => {
    if (!profile) return;
    setEditData({
      full_name: profile.full_name,
      headline: profile.headline,
      tagline: profile.tagline,
      pronouns: profile.pronouns,
      bio: profile.bio,
      country: profile.country,
      city: profile.city,
      availability: profile.availability,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      skills: profile.skills,
      social_links: profile.social_links || {},
    });
    setEditMode(true);
    setSuccessMsg(null);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!profile) return;
    setSaving(true);
    setSuccessMsg(null);
    try {
      const updated = await apiClient.patch<ProfileData>(
        ENDPOINTS.PROFILES.ME,
        editData,
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              skills: updated.skills ?? prev.skills ?? [],
              social_links: updated.social_links ?? prev.social_links ?? {},
            }
          : updated,
      );
      setEditMode(false);
      setEditData({});
      setFollowerCount(updated.follower_count || 0);
      setSuccessMsg(
        t("messages.profileUpdated", {
          links: String(Object.keys(editData.social_links || {}).length),
        }),
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.detail || t("messages.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = useCallback((url: string) => {
    setEditData((prev) => ({ ...prev, avatar_url: url }));
  }, []);

  const handleCoverChange = useCallback((url: string) => {
    setProfile((prev) => (prev ? { ...prev, cover_image_url: url } : prev));
    setEditData((prev) => ({ ...prev, cover_image_url: url }));
  }, []);

  const handleAddSkill = useCallback(async (skill: string) => {
    try {
      await api.addUserSkill({ name: skill });
      setEditData((prev) => ({
        ...prev,
        skills: [...(prev.skills || []), skill],
      }));
    } catch {
      setError(t("messages.skillError"));
    }
  }, []);

  const handleRemoveSkill = useCallback(
    async (skillName: string) => {
      try {
        if (profile?.id) {
          const skills = await api.getUserSkills(profile.id);
          const skill = skills.find((s: any) => s.name === skillName);
          if (skill) await api.deleteUserSkill(skill.id);
        }
        setEditData((prev) => ({
          ...prev,
          skills: (prev.skills || []).filter((s) => s !== skillName),
        }));
      } catch {
        setError(t("messages.skillRemoveError"));
      }
    },
    [profile],
  );

  const handleSocialLinksChange = useCallback(
    (links: Record<string, string>) => {
      setEditData((prev) => ({ ...prev, social_links: links }));
    },
    [],
  );

  const tabs = [
    { id: "overview", label: t("tabs.overview") },
    { id: "learning", label: t("tabs.learning") },
    { id: "freelancing", label: t("tabs.freelancing") },
    { id: "business", label: t("tabs.business") },
    { id: "teaching", label: t("tabs.teaching") },
    { id: "portfolio", label: t("tabs.portfolio") },
    { id: "reviews", label: t("tabs.reviews") },
    { id: "social", label: t("tabs.social") },
  ];

  const displayProfile = useMemo<ProfileData | null>(() => {
    if (!profile) return null;
    if (!profile.is_own_profile || viewAs === "self") {
      return profile;
    }
    return {
      ...profile,
      is_own_profile: false,
      email: viewAs === "public" ? undefined : profile.email,
      phone: viewAs === "public" ? undefined : profile.phone,
    };
  }, [profile, viewAs]);

  const effectiveIsFollowing = useMemo(() => {
    if (profile?.is_own_profile) {
      return viewAs === "followers";
    }
    return isFollowing;
  }, [profile?.is_own_profile, viewAs, isFollowing]);

  const roleBasedTabs = displayProfile
    ? tabs.filter((t) => {
        const r = displayProfile.role?.toLowerCase() || "";
        if (["overview", "portfolio", "reviews", "social"].includes(t.id))
          return true;
        if (t.id === "freelancing" && r !== "freelancer" && r !== "business")
          return false;
        if (t.id === "learning" && r !== "student" && r !== "instructor")
          return false;
        if (t.id === "business" && r !== "business") return false;
        if (t.id === "teaching" && r !== "instructor") return false;
        return true;
      })
    : tabs;

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main
          id="main-content"
          tabIndex={-1}
          className="focus:outline-none pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <div className="animate-pulse space-y-6">
            <div className="h-5 bg-gray-100 dark:bg-slate-800 rounded w-48" />
            <div className="h-56 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
            <div
              className="flex items-center gap-4"
              style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
            >
              <div className="w-28 h-28 rounded-2xl bg-gray-100 dark:bg-slate-800 flex-shrink-0" />
              <div className="space-y-3 flex-1">
                <div className="h-6 bg-gray-100 dark:bg-slate-800 rounded w-64" />
                <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-40" />
                <div className="h-4 bg-gray-100 dark:bg-slate-800 rounded w-80" />
              </div>
            </div>
            <div
              className="flex gap-2"
              style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 w-28 bg-gray-100 dark:bg-slate-800 rounded-lg"
                />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main
          id="main-content"
          tabIndex={-1}
          className="focus:outline-none pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <div className="text-center py-20">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {t("messages.profileNotFound")}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 mb-6">{error}</p>
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium underline underline-offset-2"
            >
              {t("messages.goHome")}
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile || !displayProfile) return null;

  return (
    <div
      dir={dir}
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
    >
      <main
        id="main-content"
        tabIndex={-1}
        className="focus:outline-none pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      >
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span>{t("messages.goHome")}</span>
          </Link>
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {profile.full_name}
          </span>
        </nav>

        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-800/80 rounded-2xl flex items-center gap-2 text-green-800 text-sm"
            >
              <CheckCircle size={18} /> {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-2xl flex items-center gap-2 text-red-800 dark:text-red-200 text-sm"
            >
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editMode && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-2xl flex items-center justify-between"
              style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
            >
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Pencil className="w-5 h-5" />
                <span className="font-medium">{t("buttons.editProfile")}</span>
              </div>
              <div className="flex items-center gap-2">
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={cancelEdit}
                  icon={<X className="w-4 h-4" />}
                >
                  {t("buttons.cancel")}
                </PodaciumButton>
                <PodaciumButton
                  size="sm"
                  onClick={saveEdit}
                  loading={saving}
                  icon={<Save className="w-4 h-4" />}
                >
                  {t("buttons.saveProfile")}
                </PodaciumButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {profile.is_own_profile && viewAs !== "self" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex items-center justify-between text-xs font-medium text-amber-900 dark:text-amber-200"
            style={{ flexDirection: isRTL ? "row-reverse" : "row" }}
          >
            <span>
              {viewAs === "public"
                ? t("viewAs.previewPublicBanner")
                : t("viewAs.previewFollowerBanner")}
            </span>
            <button
              onClick={() => setViewAs("self")}
              className="underline font-bold hover:text-amber-950 dark:hover:text-amber-100"
            >
              {t("viewAs.resetSelf")}
            </button>
          </motion.div>
        )}

        <ProfileHeader
          profile={displayProfile}
          isFollowing={effectiveIsFollowing}
          followerCount={followerCount}
          editMode={editMode}
          editData={editData}
          onEditChange={setEditData}
          followLoading={followLoading}
          onFollow={handleFollow}
          onEditToggle={enterEditMode}
          onShowQR={() => setShowQR(true)}
          onAvatarChange={handleAvatarChange}
          onCoverChange={handleCoverChange}
        />

        {profile.is_own_profile && viewAs === "self" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ProfileCompletionBar />
          </motion.div>
        )}

        {profile.is_own_profile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3"
          >
            <ViewAsToggle value={viewAs} onChange={setViewAs} />
            <PodaciumButton
              variant="outline"
              size="sm"
              onClick={() => setShowPrivacy(true)}
              icon={<Lock className="w-4 h-4" />}
            >
              {t("buttons.privacy")}
            </PodaciumButton>
          </motion.div>
        )}

        <ProfileEditModal
          isOpen={editMode}
          onClose={cancelEdit}
          profile={profile}
          initialEditData={editData}
          saving={saving}
          onSave={async (updatedData) => {
            setEditData(updatedData);
            await saveEdit();
          }}
          onAddSkill={handleAddSkill}
          onRemoveSkill={handleRemoveSkill}
        />

        <ProfileTabsSection
          profile={displayProfile}
          activeTab={activeTab}
          tabs={roleBasedTabs}
          onTabChange={setActiveTab}
          viewAs={viewAs}
        />
      </main>

      {showQR && (
        <ProfileQRCodeModal
          profileUrl={`${window.location.origin}/profile/${slug}`}
          username={profile.username || profile.full_name}
          onClose={() => setShowQR(false)}
        />
      )}

      <SectionVisibilityModal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
