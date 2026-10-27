"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useBidi } from "@/lib/i18n";
import { api, ENDPOINTS } from "@/lib/api";
import { motion } from "framer-motion";
import {
  BookOpen,
  ArrowLeft,
  Save,
  Loader2,
  Star,
  Image as ImageIcon,
  DollarSign,
  FileText,
  AlertCircle,
  Clock,
  User,
  Tag,
  Plus,
  X,
} from "lucide-react";

interface Instructor {
  id: number;
  fullName: string | null;
  email: string;
}

export default function NewCoursePage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const [formData, setFormData] = useState({
    id: "",
    title: "",
    description: "",
    full_description: "",
    thumbnail_url: "",
    duration_minutes: "",
    estimated_effort: "",
    level: "Beginner",
    instructor_id: "",
    skills: [] as string[],
    tags: [] as string[],
    price_amount: "",
    price_currency: "DZD",
    featured: false,
  });

  useEffect(() => {
    // Fetch instructors (users with INSTRUCTOR role)
    const fetchInstructors = async () => {
      try {
        const res = await api.get<any>(
          `${ENDPOINTS.ADMIN.USERS}?role=INSTRUCTOR&page_size=100`,
        );
        setInstructors(res.users || []);
      } catch (err) {
        console.error("Failed to fetch instructors", err);
      }
    };
    fetchInstructors();
  }, []);

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skill),
    });
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.id.trim() || !formData.title.trim()) {
      setError(t("admin.courses.new.errors.required"));
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        id: formData.id.trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        full_description: formData.full_description.trim() || null,
        thumbnail_url: formData.thumbnail_url.trim() || null,
        duration_minutes: formData.duration_minutes
          ? parseInt(formData.duration_minutes)
          : null,
        estimated_effort: formData.estimated_effort.trim() || null,
        level: formData.level,
        instructor_id: formData.instructor_id
          ? parseInt(formData.instructor_id)
          : null,
        skills: formData.skills,
        tags: formData.tags,
        featured: formData.featured,
      };

      if (formData.price_amount) {
        payload.price = {
          amount: parseInt(formData.price_amount),
          currency: formData.price_currency,
        };
      }

      await api.post(ENDPOINTS.ADMIN.MODULES, payload);
      router.push("/admin/courses");
    } catch (err: any) {
      console.error("Failed to create course", err);
      setError(err?.message || t("admin.courses.new.errors.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href="/admin/courses"
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={20} className={dir === "rtl" ? "rotate-180" : ""} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            {t("admin.courses.new.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.courses.new.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="max-w-3xl"
      >
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 space-y-6">
          {/* Basic Info Section */}
          <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {t("admin.courses.new.basicInfo")}
            </h3>

            {/* Course ID */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.new.courseId")}{" "}
                <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) =>
                  setFormData({ ...formData, id: e.target.value })
                }
                placeholder={t("admin.courses.new.courseIdPlaceholder")}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                {t("admin.courses.new.courseIdHint")}
              </p>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.new.titleField")}{" "}
                <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <div className="relative">
                <BookOpen
                  size={18}
                  className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                />
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder={t("admin.courses.new.titlePlaceholder")}
                  className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                />
              </div>
            </div>

            {/* Short Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.new.shortDescription")}
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("admin.courses.new.shortDescriptionPlaceholder")}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
              />
            </div>

            {/* Full Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.new.fullDescription")}
              </label>
              <textarea
                value={formData.full_description}
                onChange={(e) =>
                  setFormData({ ...formData, full_description: e.target.value })
                }
                placeholder={t("admin.courses.new.fullDescriptionPlaceholder")}
                rows={6}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
              />
            </div>
          </div>

          {/* Media Section */}
          <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {t("admin.courses.new.media")}
            </h3>

            {/* Thumbnail URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.new.thumbnailUrl")}
              </label>
              <div className="relative">
                <ImageIcon
                  size={18}
                  className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                />
                <input
                  type="url"
                  value={formData.thumbnail_url}
                  onChange={(e) =>
                    setFormData({ ...formData, thumbnail_url: e.target.value })
                  }
                  placeholder="https://example.com/thumbnail.jpg"
                  className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                />
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {t("admin.courses.new.details")}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.courses.new.duration")}
                </label>
                <div className="relative">
                  <Clock
                    size={18}
                    className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                  />
                  <input
                    type="number"
                    min="0"
                    value={formData.duration_minutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration_minutes: e.target.value,
                      })
                    }
                    placeholder="120"
                    className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {t("admin.courses.new.durationHint")}
                </p>
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.courses.new.level")}
                </label>
                <select
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({ ...formData, level: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                >
                  <option value="Beginner">
                    {t("admin.courses.levels.beginner")}
                  </option>
                  <option value="Intermediate">
                    {t("admin.courses.levels.intermediate")}
                  </option>
                  <option value="Advanced">
                    {t("admin.courses.levels.advanced")}
                  </option>
                </select>
              </div>

              {/* Estimated Effort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.courses.new.effort")}
                </label>
                <input
                  type="text"
                  value={formData.estimated_effort}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimated_effort: e.target.value,
                    })
                  }
                  placeholder={t("admin.courses.new.effortPlaceholder")}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
              </div>

              {/* Instructor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.courses.new.instructor")}
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                  />
                  <select
                    value={formData.instructor_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        instructor_id: e.target.value,
                      })
                    }
                    className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm appearance-none`}
                  >
                    <option value="">
                      {t("admin.courses.new.selectInstructor")}
                    </option>
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.fullName || inst.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Skills & Tags Section */}
          <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {t("admin.courses.new.skillsAndTags")}
            </h3>

            {/* Skills */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.new.skills")}
              </label>
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <Tag
                    size={18}
                    className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                  />
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addSkill())
                    }
                    placeholder={t("admin.courses.new.skillPlaceholder")}
                    className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                  />
                </div>
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="hover:text-blue-900 dark:text-blue-100"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.new.tags")}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addTag())
                  }
                  placeholder={t("admin.courses.new.tagPlaceholder")}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-gray-900 dark:hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {t("admin.courses.new.pricing")}
            </h3>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <DollarSign
                  size={18}
                  className={`absolute top-3 ${dir === "rtl" ? "right-3" : "left-3"} text-gray-400`}
                />
                <input
                  type="number"
                  min="0"
                  value={formData.price_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, price_amount: e.target.value })
                  }
                  placeholder="0"
                  className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                />
              </div>
              <select
                value={formData.price_currency}
                onChange={(e) =>
                  setFormData({ ...formData, price_currency: e.target.value })
                }
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
              >
                <option value="DZD">DZD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Featured Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, featured: !formData.featured })
              }
              className={`w-12 h-6 rounded-full transition-colors ${formData.featured ? "bg-amber-500" : "bg-gray-200 dark:bg-slate-800/90"}`}
            >
              <div
                className={`w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-sm transition-transform ${formData.featured ? (dir === "rtl" ? "-translate-x-6" : "translate-x-6") : "translate-x-0.5"}`}
              />
            </button>
            <div className="flex items-center gap-2">
              <Star
                size={16}
                className={
                  formData.featured
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-gray-400"
                }
              />
              <span className="text-sm text-gray-700 dark:text-slate-300">
                {t("admin.courses.new.featured")}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t("admin.courses.new.create")}
          </button>
          <Link
            href="/admin/courses"
            className="px-6 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl font-medium text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
          >
            {t("admin.common.cancel")}
          </Link>
        </div>
      </motion.form>
    </div>
  );
}
