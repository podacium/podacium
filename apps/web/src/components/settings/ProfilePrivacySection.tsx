"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/lib/i18n";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import {
  User,
  Edit3,
  Eye,
  EyeOff,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle,
  Target,
  Tag,
  MessageSquare,
  Image,
  MapPin,
  Link2,
  Calendar,
  Clock,
  Users,
  Award,
  Zap,
  Activity,
  History,
  Loader2,
  Shield,
} from "lucide-react";

interface SectionVisibility {
  bio_visibility: string;
  headline_visibility: string;
  tagline_visibility: string;
  pronouns_visibility: string;
  cover_image_visibility: string;
  location_visibility: string;
  social_links_visibility: string;
  availability_visibility: string;
  timezone_visibility: string;
  profile_view_count_visibility: string;
  last_active_visibility: string;
  followers_visibility: string;
  following_visibility: string;
  badges_visibility: string;
  skills_visibility: string;
  activity_feed_visibility: string;
  username_history_visibility: string;
}

const VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "public",
    icon: Globe,
    desc: "Visible to everyone",
  },
  {
    value: "followers",
    label: "followers",
    icon: Users,
    desc: "Visible to your followers only",
  },
  {
    value: "connections",
    label: "connections",
    icon: User,
    desc: "Visible to your connections only",
  },
  {
    value: "private",
    label: "private",
    icon: Lock,
    desc: "Visible only to you",
  },
] as const;

const SECTIONS = [
  {
    key: "bio_visibility",
    labelKey: "sections.bio",
    icon: Edit3,
    descKey: "sections.bioDesc",
  },
  {
    key: "headline_visibility",
    labelKey: "sections.headline",
    icon: Target,
    descKey: "sections.headlineDesc",
  },
  {
    key: "tagline_visibility",
    labelKey: "sections.tagline",
    icon: Tag,
    descKey: "sections.taglineDesc",
  },
  {
    key: "pronouns_visibility",
    labelKey: "sections.pronouns",
    icon: MessageSquare,
    descKey: "sections.pronounsDesc",
  },
  {
    key: "cover_image_visibility",
    labelKey: "sections.coverImage",
    icon: Image,
    descKey: "sections.coverImageDesc",
  },
  {
    key: "location_visibility",
    labelKey: "sections.location",
    icon: MapPin,
    descKey: "sections.locationDesc",
  },
  {
    key: "social_links_visibility",
    labelKey: "sections.socialLinks",
    icon: Link2,
    descKey: "sections.socialLinksDesc",
  },
  {
    key: "availability_visibility",
    labelKey: "sections.availability",
    icon: Calendar,
    descKey: "sections.availabilityDesc",
  },
  {
    key: "timezone_visibility",
    labelKey: "sections.timezone",
    icon: Clock,
    descKey: "sections.timezoneDesc",
  },
  {
    key: "profile_view_count_visibility",
    labelKey: "sections.profileViews",
    icon: Eye,
    descKey: "sections.profileViewsDesc",
  },
  {
    key: "last_active_visibility",
    labelKey: "sections.lastActive",
    icon: Activity,
    descKey: "sections.lastActiveDesc",
  },
  {
    key: "followers_visibility",
    labelKey: "sections.followers",
    icon: Users,
    descKey: "sections.followersDesc",
  },
  {
    key: "following_visibility",
    labelKey: "sections.following",
    icon: User,
    descKey: "sections.followingDesc",
  },
  {
    key: "badges_visibility",
    labelKey: "sections.badges",
    icon: Award,
    descKey: "sections.badgesDesc",
  },
  {
    key: "skills_visibility",
    labelKey: "sections.skills",
    icon: Zap,
    descKey: "sections.skillsDesc",
  },
  {
    key: "activity_feed_visibility",
    labelKey: "sections.activityFeed",
    icon: Activity,
    descKey: "sections.activityFeedDesc",
  },
  {
    key: "username_history_visibility",
    labelKey: "sections.usernameHistory",
    icon: History,
    descKey: "sections.usernameHistoryDesc",
  },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function VisibilitySelect({
  value,
  onChange,
  disabled,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full md:w-48 rounded-lg border-2 px-4 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        disabled
          ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-slate-800"
          : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      }`}
    >
      {VISIBILITY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {t(`settings.privacy.visibility.${opt.label}`)}
        </option>
      ))}
    </select>
  );
}

export default function ProfilePrivacySection() {
  const t = useTranslations("settings");
  const tPrivacy = useTranslations("settings.privacy");
  const [visibilities, setVisibilities] = useState<SectionVisibility>({
    bio_visibility: "public",
    headline_visibility: "public",
    tagline_visibility: "public",
    pronouns_visibility: "public",
    cover_image_visibility: "public",
    location_visibility: "public",
    social_links_visibility: "public",
    availability_visibility: "public",
    timezone_visibility: "public",
    profile_view_count_visibility: "public",
    last_active_visibility: "public",
    followers_visibility: "public",
    following_visibility: "public",
    badges_visibility: "public",
    skills_visibility: "public",
    activity_feed_visibility: "public",
    username_history_visibility: "public",
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVisibilities = useCallback(async () => {
    try {
      const res = await api.get<SectionVisibility>(
        "/profiles/me/privacy/sections",
      );
      setVisibilities(res);
      setLoaded(true);
    } catch (err) {
      console.error("Failed to fetch section visibilities:", err);
      setError(tPrivacy("sections.loadError"));
      setLoaded(true);
    }
  }, [tPrivacy]);

  useEffect(() => {
    fetchVisibilities();
  }, [fetchVisibilities]);

  const handleChange = async (key: SectionKey, value: string) => {
    setSaving(key);
    setVisibilities((prev) => ({ ...prev, [key]: value }));
    try {
      await api.patch("/profiles/me/privacy/sections", { [key]: value });
      setSaving(null);
    } catch (err) {
      console.error("Failed to update visibility:", err);
      setError(tPrivacy("sections.saveError"));
      setVisibilities((prev) => ({ ...prev, [key]: visibilities[key] }));
      setSaving(null);
    }
  };

  if (!loaded) {
    return (
      <div
        className="space-y-6"
        role="status"
        aria-label={tPrivacy("sections.loading")}
      >
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="animate-pulse"
          >
            <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-1/2" />
          </motion.div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-200 font-medium">
            {error}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {tPrivacy("sections.title")}
          </h4>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            {tPrivacy("sections.description")}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-4 border border-gray-200 dark:border-slate-800">
        <div className="grid grid-cols-12 gap-2 px-2 py-2 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-800 mb-2 hidden md:grid">
          <div className="col-span-5">{tPrivacy("sections.section")}</div>
          <div className="col-span-4">{tPrivacy("sections.visibility")}</div>
          <div className="col-span-3">{tPrivacy("sections.description")}</div>
        </div>

        <div
          className="space-y-2"
          role="list"
          aria-label={tPrivacy("sections.listLabel")}
        >
          {SECTIONS.map(({ key, labelKey, icon: Icon, descKey }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center p-3 rounded-lg bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 hover:border-gray-200 transition-colors"
              role="listitem"
            >
              <div className="flex items-center space-x-3 md:col-span-5 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center">
                  <Icon
                    className="h-4 w-4 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0">
                  <span className="font-medium text-gray-900 dark:text-slate-100 block truncate">
                    {tPrivacy(labelKey)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-slate-400 block truncate">
                    {tPrivacy(descKey)}
                  </span>
                </div>
              </div>

              <div className="md:col-span-4 w-full md:w-auto">
                <VisibilitySelect
                  value={visibilities[key]}
                  onChange={(v) => handleChange(key, v)}
                  disabled={saving === key}
                  t={t}
                />
                {saving === key && (
                  <div className="flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm mt-1">
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    {tPrivacy("sections.saving")}
                  </div>
                )}
              </div>

              <div className="md:col-span-3 md:hidden text-sm text-gray-500 dark:text-slate-400 italic">
                {tPrivacy(`sections.visibilityOptions.${visibilities[key]}`)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-slate-800">
        <p className="text-sm text-gray-500 dark:text-slate-400 flex items-center space-x-1">
          <Shield className="h-4 w-4" />
          <span>{tPrivacy("sections.footerNote")}</span>
        </p>
      </div>
    </div>
  );
}
