"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  AlertCircle,
  Clock,
  User,
  Tag,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Video,
  FileText,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ModuleDetail {
  id: string;
  title: string;
  description: string | null;
  fullDescription: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  estimatedEffort: string | null;
  level: string | null;
  skills: string[];
  tags: string[];
  price: { amount: number; currency: string } | null;
  featured: boolean;
  instructor: { id: number; fullName: string } | null;
  enrollmentCount: number;
  lessons: {
    id: string;
    title: string;
    order: number;
    type: string;
    durationMinutes: number | null;
    hasVideo: boolean;
    hasQuiz: boolean;
  }[];
}

interface Instructor {
  id: number;
  fullName: string | null;
  email: string;
}

export default function EditCoursePage() {
  const t = useTranslations();
  const { dir } = useBidi();
  const router = useRouter();
  const params = useParams();
  const moduleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [lessons, setLessons] = useState<ModuleDetail["lessons"]>([]);
  const [reordering, setReordering] = useState(false);

  const [formData, setFormData] = useState({
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
    const fetchData = async () => {
      try {
        // Fetch module details
        const moduleData = await api.get<ModuleDetail>(
          ENDPOINTS.ADMIN.MODULE(moduleId),
        );
        setLessons(
          (moduleData.lessons || []).sort((a, b) => a.order - b.order),
        );
        setFormData({
          title: moduleData.title,
          description: moduleData.description || "",
          full_description: moduleData.fullDescription || "",
          thumbnail_url: moduleData.thumbnailUrl || "",
          duration_minutes: moduleData.durationMinutes?.toString() || "",
          estimated_effort: moduleData.estimatedEffort || "",
          level: moduleData.level || "Beginner",
          instructor_id: moduleData.instructor?.id?.toString() || "",
          skills: moduleData.skills || [],
          tags: moduleData.tags || [],
          price_amount: moduleData.price?.amount?.toString() || "",
          price_currency: moduleData.price?.currency || "DZD",
          featured: moduleData.featured,
        });

        // Fetch instructors
        const instructorsRes = await api.get<any>(
          `${ENDPOINTS.ADMIN.USERS}?role=INSTRUCTOR&page_size=100`,
        );
        setInstructors(instructorsRes.users || []);
      } catch (err) {
        console.error("Failed to load module", err);
        setError(t("admin.courses.edit.errors.notFound"));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [moduleId]);

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

  const moveLesson = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lessons.length) return;
    const updated = [...lessons];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reordered = updated.map((l, i) => ({ ...l, order: i + 1 }));
    setLessons(reordered);

    setReordering(true);
    try {
      await api.put(ENDPOINTS.ADMIN.MODULE_LESSONS_REORDER(moduleId), {
        lessons: reordered.map((l) => ({ lessonId: l.id, order: l.order })),
      });
    } catch (err) {
      console.error("Reorder failed", err);
    } finally {
      setReordering(false);
    }
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm(t("admin.lessons.confirmDelete"))) return;
    try {
      await api.delete(ENDPOINTS.ADMIN.LESSON(lessonId));
      setLessons(lessons.filter((l) => l.id !== lessonId));
      toast.success(t("admin.lessons.lessonDeleted"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete lesson");
      setError(err?.message || "Failed to delete lesson");
    }
  };

  const handleSave = async () => {
    setError(null);

    if (!formData.title.trim()) {
      setError(t("admin.courses.edit.errors.titleRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
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

      await api.put(ENDPOINTS.ADMIN.MODULE(moduleId), payload);
      toast.success(t("admin.courses.courseUpdated"));
      router.push("/admin/courses");
    } catch (err: any) {
      console.error("Failed to update module", err);
      setError(err?.message || t("admin.courses.edit.errors.failed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

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
            {t("admin.courses.edit.title")}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {t("admin.courses.edit.subtitle")}
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
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
              {t("admin.courses.edit.basicInfo")}
            </h3>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.edit.titleField")}{" "}
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
                  placeholder={t("admin.courses.edit.titlePlaceholder")}
                  className={`w-full ${dir === "rtl" ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm`}
                />
              </div>
            </div>

            {/* Short Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.edit.shortDescription")}
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t(
                  "admin.courses.edit.shortDescriptionPlaceholder",
                )}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
              />
            </div>

            {/* Full Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.edit.fullDescription")}
              </label>
              <textarea
                value={formData.full_description}
                onChange={(e) =>
                  setFormData({ ...formData, full_description: e.target.value })
                }
                placeholder={t("admin.courses.edit.fullDescriptionPlaceholder")}
                rows={6}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm resize-none"
              />
            </div>
          </div>

          {/* Media Section */}
          <div className="pb-6 border-b border-gray-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {t("admin.courses.edit.media")}
            </h3>

            {/* Thumbnail URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.edit.thumbnailUrl")}
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
              {t("admin.courses.edit.details")}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.courses.edit.duration")}
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
              </div>

              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.courses.edit.level")}
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
                  {t("admin.courses.edit.effort")}
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
                  placeholder={t("admin.courses.edit.effortPlaceholder")}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                />
              </div>

              {/* Instructor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  {t("admin.courses.edit.instructor")}
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
                      {t("admin.courses.edit.selectInstructor")}
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
              {t("admin.courses.edit.skillsAndTags")}
            </h3>

            {/* Skills */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                {t("admin.courses.edit.skills")}
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
                    placeholder={t("admin.courses.edit.skillPlaceholder")}
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
                {t("admin.courses.edit.tags")}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addTag())
                  }
                  placeholder={t("admin.courses.edit.tagPlaceholder")}
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
              {t("admin.courses.edit.pricing")}
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
                {t("admin.courses.edit.featured")}
              </span>
            </div>
          </div>
        </div>

        {/* Lessons Section */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {t("admin.courses.lessons")} ({lessons.length})
            </h3>
            <Link
              href={`/admin/lessons/new?module=${moduleId}`}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus size={14} /> {t("admin.lessons.createLesson")}
            </Link>
          </div>

          {lessons.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {t("admin.lessons.noLessons")}
            </p>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  {/* Order controls */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveLesson(index, "up")}
                      disabled={index === 0 || reordering}
                      className="p-0.5 rounded hover:bg-gray-200 dark:bg-slate-800/90 disabled:opacity-20"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLesson(index, "down")}
                      disabled={index === lessons.length - 1 || reordering}
                      className="p-0.5 rounded hover:bg-gray-200 dark:bg-slate-800/90 disabled:opacity-20"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Order number */}
                  <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 flex items-center justify-center text-xs font-medium">
                    {lesson.order}
                  </span>

                  {/* Type icon */}
                  {lesson.hasVideo ? (
                    <Video
                      size={14}
                      className="text-blue-500 dark:text-blue-400"
                    />
                  ) : lesson.hasQuiz ? (
                    <HelpCircle size={14} className="text-purple-500" />
                  ) : (
                    <FileText size={14} className="text-gray-400" />
                  )}

                  {/* Title */}
                  <span className="flex-1 text-sm text-gray-800 dark:text-slate-200 truncate">
                    {lesson.title}
                  </span>

                  {/* Duration */}
                  {lesson.durationMinutes && (
                    <span className="text-xs text-gray-400">
                      {lesson.durationMinutes}m
                    </span>
                  )}

                  {/* Actions */}
                  <Link
                    href={`/admin/lessons/${lesson.id}/edit`}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                  >
                    <ExternalLink size={14} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteLesson(lesson.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 text-red-500 dark:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {t("admin.courses.edit.save")}
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
