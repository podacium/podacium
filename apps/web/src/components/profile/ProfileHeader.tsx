"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Globe,
  Clock,
  Calendar,
  ShieldCheck,
  QrCode,
  Pencil,
  MessageSquare,
  Camera,
  Loader2,
  Upload,
  ImagePlus,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  X,
  Sparkles,
  Award,
  Star,
  CheckCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTranslations, useBidi, useLocale } from "@/lib/i18n";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import UniversalImage from "@/components/UniversalImage";
import type { ProfileData } from "./ProfilePageClient";

interface ProfileHeaderProps {
  profile: ProfileData;
  isFollowing: boolean;
  followerCount: number;
  editMode: boolean;
  editData: Partial<ProfileData>;
  followLoading: boolean;
  onEditChange: (data: Partial<ProfileData>) => void;
  onFollow: () => void;
  onEditToggle: () => void;
  onShowQR: () => void;
  onAvatarChange?: (url: string) => void;
  onCoverChange?: (url: string) => void;
}

const roleColors: Record<string, string> = {
  instructor:
    "bg-gradient-to-r from-purple-500/15 via-indigo-500/15 to-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/80 dark:border-purple-800/60 shadow-xs",
  student:
    "bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/60 shadow-xs",
  freelancer:
    "bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/60 shadow-xs",
  business:
    "bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-800/60 shadow-xs",
};

export function ProfileHeader({
  profile,
  isFollowing,
  followerCount,
  editMode,
  editData,
  followLoading,
  onEditChange,
  onFollow,
  onEditToggle,
  onShowQR,
  onAvatarChange,
  onCoverChange,
}: ProfileHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreview, setCropPreview] = useState("");
  const [zoom, setZoom] = useState(1);
  const [cropUploading, setCropUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations("profile");
  const { dir, isRTL, textAlign } = useBidi();
  const locale = useLocale();

  const handleInitiateMessage = useCallback(() => {
    if (!user) {
      router.push(`/auth/login/?redirect=/hub/messages?user=${profile.id}`);
      return;
    }
    router.push(`/hub/messages?user=${profile.id}`);
  }, [user, profile.id, router]);

  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 400], [0, 80]);

  const roleKey = profile.role?.toLowerCase() || "";

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setCropUploading(true);
      try {
        const { uploadFileWithProgress } = await import("@/lib/api/uploader");
        const result = await uploadFileWithProgress(file, "avatars");
        onAvatarChange?.(result.url);
        setShowCropModal(false);
        setCropFile(null);
        setCropPreview("");
        setZoom(1);
      } catch (e) {
        console.error("Avatar upload failed:", e);
      } finally {
        setCropUploading(false);
      }
    },
    [onAvatarChange],
  );

  const handleCropFileSelect = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setCropFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setCropPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleCoverUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setCoverUploading(true);
      try {
        const { uploadFileWithProgress } = await import("@/lib/api/uploader");
        const result = await uploadFileWithProgress(file, "avatars");
        onCoverChange?.(result.url);
      } catch (e) {
        console.error("Cover upload failed:", e);
      } finally {
        setCoverUploading(false);
      }
    },
    [onCoverChange],
  );

  const handleCoverFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleCoverUpload(file);
      e.target.value = "";
    },
    [handleCoverUpload],
  );

  const openCropModal = () => {
    setShowCropModal(true);
    setCropPreview("");
    setZoom(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 relative"
      dir={dir}
    >
      {/* AURORA GLOW BACKGROUND */}
      <div className="absolute -top-10 -left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-10 -right-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* COVER BANNER */}
      <div
        ref={fileInputRef as any}
        className="relative h-48 sm:h-72 rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 shadow-[0_25px_60px_-15px_rgba(79,70,229,0.25)] border border-white/40 dark:border-slate-800/80"
      >
        {/* Grid light texture */}
        <div className="absolute inset-0 grid-light opacity-35 pointer-events-none" />

        {profile.cover_image_url && (
          <motion.div
            className="absolute inset-0 w-full h-full"
            style={{ y: parallaxY, scale: 1.05 }}
          >
            <UniversalImage
              src={profile.cover_image_url}
              alt={t("buttons.changeCover")}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </motion.div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />

        {/* Floating Top Control Bar */}
        <div
          className={cn(
            "absolute top-4 sm:top-6 flex flex-wrap items-center gap-2.5 z-10 px-4",
            isRTL ? "left-0" : "right-0",
          )}
        >
          {editMode && (
            <>
              <input
                ref={coverFileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleCoverFileSelect}
              />
              <button
                type="button"
                onClick={() => coverFileInputRef.current?.click()}
                disabled={coverUploading}
                aria-label={t("buttons.changeCover")}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900/85 backdrop-blur-md rounded-2xl text-xs font-bold text-gray-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 shadow-lg border border-white/80 dark:border-slate-800/80 transition-all hover:scale-105"
              >
                {coverUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                ) : (
                  <ImagePlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
                <span>{t("buttons.changeCover")}</span>
              </button>
            </>
          )}
          {profile.is_own_profile && (
            <button
              type="button"
              onClick={onEditToggle}
              aria-label={t("buttons.editProfile")}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900/85 backdrop-blur-md rounded-2xl text-xs font-bold text-gray-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 shadow-lg border border-white/80 dark:border-slate-800/80 transition-all hover:scale-105"
            >
              <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{t("buttons.editProfile")}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onShowQR}
            aria-label={t("buttons.share")}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900/85 backdrop-blur-md rounded-2xl text-xs font-bold text-gray-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 shadow-lg border border-white/80 dark:border-slate-800/80 transition-all hover:scale-105"
          >
            <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>{t("buttons.share")}</span>
          </button>
        </div>
      </div>

      {/* AVATAR + HEADER INFO ROW */}
      <div className="relative -mt-20 sm:-mt-24 px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="flex items-end gap-5 sm:gap-7">
            {/* AVATAR CONTAINER */}
            <div className="relative group w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[2rem] overflow-hidden border-4 border-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] bg-white dark:bg-slate-900 relative">
                {profile.avatar_url ? (
                  <UniversalImage
                    src={profile.avatar_url}
                    alt={t("fields.fullName")}
                    fill
                    className="object-cover group-hover:scale-1.05 transition-transform duration-300"
                    sizes="160px"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-black bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 text-white">
                    {profile.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Online Pulse Dot */}
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 ring-4 ring-white dark:ring-slate-900 rounded-full flex items-center justify-center shadow-md">
                <span className="w-2.5 h-2.5 bg-white dark:bg-slate-900 rounded-full animate-ping opacity-75" />
              </div>

              {(profile.is_own_profile || editMode) && (
                <button
                  type="button"
                  onClick={openCropModal}
                  aria-label={t("buttons.saveAvatar")}
                  className={cn(
                    "absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-[2rem] transition-all duration-300 cursor-pointer",
                    !editMode && "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <div className="text-white">
                    {cropUploading ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : (
                      <Camera className="w-7 h-7" />
                    )}
                  </div>
                </button>
              )}
            </div>

            {/* MAIN NAME & TITLE (Desktop/Tablet) */}
            <div className="mb-2 hidden sm:block">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                  {profile.full_name}
                </h1>
                {profile.is_verified && (
                  <div
                    className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800/80 shadow-sm"
                    title={t("header.verifiedProfessional")}
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                )}
                {profile.pronouns && (
                  <span className="text-xs font-bold text-gray-600 dark:text-slate-400 bg-gray-100/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-200/60 dark:border-slate-800/80">
                    {profile.pronouns}
                  </span>
                )}
              </div>
              {profile.headline && (
                <p className="text-base font-semibold text-gray-600 dark:text-slate-400 mt-1">
                  {profile.headline}
                </p>
              )}
            </div>
          </div>

          {/* FOLLOW / MESSAGE ACTIONS */}
          <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
            {!profile.is_own_profile && (
              <>
                <button
                  type="button"
                  onClick={onFollow}
                  disabled={followLoading}
                  className={cn(
                    "flex-1 sm:flex-initial px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105",
                    isFollowing
                      ? "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 hover:bg-gray-200 border border-gray-300 dark:border-slate-700"
                      : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-blue-500/30 hover:shadow-indigo-500/40",
                  )}
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  <span>
                    {isFollowing ? t("header.following") : t("header.follow")}
                  </span>
                </button>
                {profile.can_message && (
                  <button
                    type="button"
                    onClick={handleInitiateMessage}
                    className="flex-1 sm:flex-initial px-5 py-3 bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl text-sm font-bold text-gray-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2 shadow-sm hover:scale-105 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{t("header.message")}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* MOBILE NAME & TITLE */}
        <div className="mt-4 sm:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
              {profile.full_name}
            </h1>
            {profile.is_verified && (
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          {profile.headline && (
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 mt-1">
              {profile.headline}
            </p>
          )}
          {profile.username && (
            <p className="text-xs text-gray-400 mt-0.5">@{profile.username}</p>
          )}
        </div>

        {/* META DETAILS ROW WITH FROSTED GLASS BADGES */}
        <div className="flex flex-wrap items-center gap-2.5 mt-5 text-xs font-semibold text-gray-700 dark:text-slate-300">
          <span
            className={cn(
              "px-3.5 py-1.5 rounded-2xl text-xs font-bold border backdrop-blur-md shadow-xs",
              roleColors[roleKey] ||
                "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border-gray-200 dark:border-slate-800",
            )}
          >
            {t(`roles.${roleKey}` as any)}
          </span>
          {profile.country && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-slate-800/80 shadow-xs">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              {(() => {
                const cTrans = t(`geo.countries.${profile.country}` as any);
                const countryDisplay =
                  cTrans &&
                  cTrans !== `geo.countries.${profile.country}` &&
                  cTrans !== `profile.geo.countries.${profile.country}`
                    ? cTrans
                    : profile.country;
                if (!profile.city) return countryDisplay;
                const cityTrans = t(`geo.cities.${profile.city}` as any);
                const cityDisplay =
                  cityTrans &&
                  cityTrans !== `geo.cities.${profile.city}` &&
                  cityTrans !== `profile.geo.cities.${profile.city}`
                    ? cityTrans
                    : profile.city;
                return `${countryDisplay}, ${cityDisplay}`;
              })()}
            </span>
          )}
          {profile.timezone && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-slate-800/80 shadow-xs">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {profile.timezone}
            </span>
          )}
          {profile.availability && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-slate-800/80 shadow-xs">
              <Globe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              {profile.availability}
            </span>
          )}
          {profile.member_since && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-200/60 dark:border-slate-800/80 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {t("header.joined")}{" "}
              {new Date(profile.member_since).toLocaleDateString(
                locale || "en",
              )}
            </span>
          )}
        </div>

        {/* STATS COUNT DASHBOARD CARD */}
        <div className="flex items-center gap-6 sm:gap-8 mt-5 py-3.5 px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-slate-800/80 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] max-w-fit">
          <div className="text-xs">
            <span className="font-black text-gray-900 dark:text-slate-100 text-base me-1">
              {followerCount}
            </span>
            <span className="text-gray-500 dark:text-slate-400 font-medium">
              {t("header.followers")}
            </span>
          </div>
          <div className="h-5 w-[1px] bg-gray-200 dark:bg-slate-800/90" />
          <div className="text-xs">
            <span className="font-black text-gray-900 dark:text-slate-100 text-base me-1">
              {profile.following_count || 0}
            </span>
            <span className="text-gray-500 dark:text-slate-400 font-medium">
              {t("header.following")}
            </span>
          </div>
          {profile.average_rating !== undefined &&
            profile.average_rating > 0 && (
              <>
                <div className="h-5 w-[1px] bg-gray-200 dark:bg-slate-800/90" />
                <div className="text-xs flex items-center gap-1">
                  <span className="font-black text-gray-900 dark:text-slate-100 text-base">
                    {profile.average_rating.toFixed(1)}
                  </span>
                  <span className="text-amber-500 dark:text-amber-400 text-sm">
                    ★
                  </span>
                </div>
              </>
            )}
        </div>
      </div>

      {/* BIO CARD */}
      <div className="mt-6 px-4 sm:px-8">
        {profile.bio && (
          <div className="p-6 bg-white dark:bg-slate-900/85 backdrop-blur-xl rounded-3xl border border-white/80 dark:border-slate-800/80 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.04)]">
            <p
              className={cn(
                "text-sm text-gray-700 dark:text-slate-300 leading-relaxed font-normal",
                !bioExpanded && "line-clamp-3",
              )}
              style={{ textAlign: textAlign("left") }}
              dir="auto"
            >
              {profile.bio}
            </p>
            {profile.bio.length > 150 && (
              <button
                type="button"
                onClick={() => setBioExpanded(!bioExpanded)}
                className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
              >
                {bioExpanded ? (
                  <>
                    {t("header.showLess")}{" "}
                    <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                  </>
                ) : (
                  <>
                    {t("header.showMore")}{" "}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* AVATAR CROP MODAL */}
      <PodaciumModal
        isOpen={showCropModal}
        onClose={() => {
          setShowCropModal(false);
          setCropFile(null);
          setCropPreview("");
          setZoom(1);
        }}
        title={t("avatar.cropTitle")}
        size="sm"
      >
        {!cropPreview ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleCropFileSelect(e.dataTransfer.files);
            }}
            onClick={() => cropFileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:bg-slate-900/60 dark:bg-blue-950/60 transition-all"
          >
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">
              {t("avatar.dragDrop")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("avatar.orClickToBrowse")}
            </p>
            <input
              ref={cropFileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => handleCropFileSelect(e.target.files)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
              <img
                src={cropPreview}
                alt={t("header.cropPreview")}
                className="w-full h-full object-cover transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>

            <div className="flex items-center gap-3 px-1">
              <ZoomOut className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <ZoomIn className="w-4 h-4 text-gray-500 dark:text-slate-400 flex-shrink-0" />
            </div>

            <div className="flex items-center gap-2">
              <PodaciumButton
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setCropPreview("");
                  setZoom(1);
                }}
              >
                <X className="w-4 h-4" /> {t("buttons.cancel")}
              </PodaciumButton>
              <PodaciumButton
                size="sm"
                className="flex-1"
                loading={cropUploading}
                disabled={!cropFile}
                onClick={() => cropFile && handleAvatarUpload(cropFile)}
              >
                <Camera className="w-4 h-4" /> {t("buttons.saveAvatar")}
              </PodaciumButton>
            </div>
          </div>
        )}
      </PodaciumModal>
    </motion.div>
  );
}
