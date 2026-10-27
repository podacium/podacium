"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ENDPOINTS } from "@/lib/api";
import { useTranslations, useBidi } from "@/lib/i18n";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Loader2,
  BookOpen,
  Clock,
  Tag,
  Plus,
  X,
  Star,
  ImageIcon,
  Home,
  ChevronRight,
  CreditCard,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { SectionCard } from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";

type FieldErrors = Partial<Record<string, string>>;

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

export default function CreateModulePage() {
  const t = useTranslations("learn.instructor.create");
  const { dir } = useBidi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditing = Boolean(editId);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [skillInput, setSkillInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);

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
    if (isEditing && editId) {
      setLoading(true);
      api
        .get<any>(`/api/education/modules/${editId}`)
        .catch(() => api.get<any>(`/api/admin/modules/${editId}`))
        .then((res) => {
          const rawPrice = res.price;
          const priceVal =
            typeof rawPrice === "number"
              ? rawPrice.toString()
              : rawPrice?.amount != null
                ? rawPrice.amount.toString()
                : rawPrice?.original != null
                  ? rawPrice.original.toString()
                  : rawPrice?.dzd != null
                    ? rawPrice.dzd.toString()
                    : "";
          const priceCurr =
            typeof rawPrice === "object" && rawPrice?.currency
              ? rawPrice.currency
              : "DZD";

          setFormData({
            id: res.id || "",
            title: res.title || "",
            description: res.description || "",
            full_description: res.fullDescription || res.full_description || "",
            thumbnail_url: res.thumbnailUrl || res.thumbnail_url || "",
            duration_minutes:
              res.durationMinutes?.toString() ||
              res.duration_minutes?.toString() ||
              "",
            estimated_effort: res.estimatedEffort || res.estimated_effort || "",
            level: res.level || "Beginner",
            instructor_id:
              res.instructorId?.toString() ||
              res.instructor_id?.toString() ||
              "",
            skills: res.skills || [],
            tags: res.tags || [],
            price_amount: priceVal,
            price_currency: priceCurr,
            featured: res.featured || false,
          });
        })
        .catch(() => toast.error(t("loadFail")))
        .finally(() => setLoading(false));
    }
  }, [isEditing, editId]);

  const addSkill = () => {
    const parts = skillInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (!formData.skills.includes(part)) {
        formData.skills.push(part);
      }
    }
    setFormData({ ...formData, skills: [...formData.skills] });
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((s) => s !== skill),
    });
  };

  const addTag = () => {
    const parts = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (!formData.tags.includes(part)) {
        formData.tags.push(part);
      }
    }
    setFormData({ ...formData, tags: [...formData.tags] });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tg) => tg !== tag),
    });
  };

  const handleTitleChange = (newTitle: string) => {
    setFormData((prev) => {
      const next = { ...prev, title: newTitle };
      if (!isEditing && !isSlugCustomized) {
        next.id = slugify(newTitle);
      }
      return next;
    });
    clearError("title");
    if (!isSlugCustomized) clearError("id");
  };

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    let finalId = formData.id.trim();
    if (!finalId && formData.title.trim()) {
      finalId = `${slugify(formData.title)}-${Math.random().toString(36).substring(2, 6)}`;
      setFormData((prev) => ({ ...prev, id: finalId }));
    }
    if (!finalId) errs.id = t("errors.requiredId");
    if (!formData.title.trim()) errs.title = t("errors.requiredTitle");
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setLoading(true);
    try {
      const priceNum = parseFloat(formData.price_amount) || 0;
      const payload: any = {
        id: formData.id.trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        full_description: formData.full_description.trim() || null,
        duration_minutes: formData.duration_minutes
          ? parseInt(formData.duration_minutes)
          : null,
        estimated_effort: formData.estimated_effort.trim() || null,
        level: formData.level,
        instructor_id: formData.instructor_id
          ? parseInt(formData.instructor_id)
          : null,
        thumbnail_url: formData.thumbnail_url.trim() || null,
        thumbnailUrl: formData.thumbnail_url.trim() || null,
        skills: formData.skills,
        tags: formData.tags,
        featured: formData.featured,
        price: {
          amount: priceNum,
          currency: formData.price_currency || "DZD",
          dzd: priceNum,
        },
      };

      if (isEditing) {
        await api.put(ENDPOINTS.EDUCATION.UPDATE_MODULE(editId!), payload);
        toast.success(t("saveSuccess"));
        router.push("/learn/manage");
      } else {
        await api.post(ENDPOINTS.EDUCATION.CREATE_MODULE, payload);
        toast.success(t("createSuccess"), {
          description: t("createSuccessHint"),
        });
        router.push("/learn/manage");
      }
    } catch (err: any) {
      const msg = err?.message || (isEditing ? t("saveFail") : t("createFail"));
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string, isTextarea = false) => {
    const base =
      "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm";
    if (isTextarea)
      return `${base} resize-none ${errors[field] ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 dark:bg-red-950/60" : "border-gray-200 dark:border-slate-800"}`;
    return `${base} ${errors[field] ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 dark:bg-red-950/60" : "border-gray-200 dark:border-slate-800"}`;
  };

  const clearError = (field: string) => {
    if (errors[field])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
  };

  if (isEditing && loading) {
    return (
      <div className="py-20 flex justify-center" dir={dir}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16" dir={dir}>
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
        <Link
          href="/"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
        >
          <Home className="w-4 h-4" />
          <span>{t("breadcrumb.home")}</span>
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <Link
          href="/learn"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {t("breadcrumb.learn")}
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <Link
          href="/learn/manage"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {t("breadcrumb.modules")}
        </Link>
        <ChevronRight
          className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
        />
        <span className="text-gray-900 dark:text-slate-100 font-medium">
          {isEditing ? t("editModule") : t("newModule")}
        </span>
      </nav>

      <motion.div
        initial={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href="/learn/manage"
          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={20} className={dir === "rtl" ? "rotate-180" : ""} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {isEditing ? t("editModule") : t("newModule")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {isEditing ? t("editModuleSubtitle") : t("newModuleSubtitle")}
          </p>
        </div>
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        noValidate
      >
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <SectionCard
          title={t("basicInfo")}
          icon={
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t("titleField")}{" "}
                <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t("titlePlaceholder")}
                className={inputClass("title")}
                required
                maxLength={200}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  {t("courseId")}{" "}
                  <span className="text-gray-400 text-xs font-normal">
                    {t("courseIdHint")}
                  </span>
                </label>
                {!isEditing && isSlugCustomized && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSlugCustomized(false);
                      setFormData((prev) => ({
                        ...prev,
                        id: slugify(prev.title),
                      }));
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t("resetToTitle")}
                  </button>
                )}
              </div>
              <div className="flex rounded-xl shadow-xs overflow-hidden border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                <span className="inline-flex items-center px-3 text-xs text-gray-400 bg-gray-100/70 dark:bg-slate-800/70 select-none border-r border-gray-200 dark:border-slate-800">
                  /learn/courses/
                </span>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => {
                    setIsSlugCustomized(true);
                    setFormData({
                      ...formData,
                      id: slugify(e.target.value),
                    });
                    clearError("id");
                  }}
                  placeholder="course-url-slug"
                  disabled={isEditing}
                  className="flex-1 px-3 py-2.5 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-hidden disabled:opacity-60"
                />
              </div>
              <p
                className={`mt-1 text-xs ${errors.id ? "text-red-500 dark:text-red-400" : "text-gray-400"}`}
              >
                {errors.id || "The unique URL identifier for this course."}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t("shortDescription")}
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("shortDescriptionPlaceholder")}
                className={inputClass("description")}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-gray-400">
                {formData.description.length}/500
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t("fullDescription")}
              </label>
              <textarea
                value={formData.full_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    full_description: e.target.value,
                  })
                }
                placeholder={t("fullDescriptionPlaceholder")}
                rows={6}
                className={inputClass("full_description", true)}
                maxLength={5000}
              />
              <p className="mt-1 text-xs text-gray-400">
                {formData.full_description.length}/5000
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="mt-6">
          <SectionCard
            title={t("media")}
            icon={
              <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            }
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t("thumbnailUrl")}
              </label>
              <input
                type="url"
                value={formData.thumbnail_url}
                onChange={(e) =>
                  setFormData({ ...formData, thumbnail_url: e.target.value })
                }
                placeholder={t("thumbnailPlaceholder")}
                className={inputClass("thumbnail_url")}
              />
              <p className="mt-1 text-xs text-gray-400">{t("thumbnailHint")}</p>
            </div>
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard
            title={t("details")}
            icon={
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("duration")}
                </label>
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
                  placeholder={t("durationPlaceholder")}
                  className={inputClass("duration_minutes")}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {t("durationHint")}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("level")}
                </label>
                <select
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({ ...formData, level: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                >
                  <option value="Beginner">{t("levelBeginner")}</option>
                  <option value="Intermediate">{t("levelIntermediate")}</option>
                  <option value="Advanced">{t("levelAdvanced")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("effort")}
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
                  placeholder={t("effortPlaceholder")}
                  className={inputClass("estimated_effort")}
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard
            title={t("skillsAndTags")}
            icon={<Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("skills")}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder={t("skillPlaceholder")}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                    title={t("addSkill")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {formData.skills.length === 0 && (
                  <p className="text-xs text-gray-400 mb-2">{t("skillHint")}</p>
                )}
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
                        title={t("remove")}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("tags")}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder={t("tagPlaceholder")}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
                    title={t("addTag")}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {formData.tags.length === 0 && (
                  <p className="text-xs text-gray-400 mb-2">{t("tagHint")}</p>
                )}
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
                        title={t("remove")}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard
            title={t("pricing")}
            icon={
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            }
          >
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("price")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.price_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, price_amount: e.target.value })
                  }
                  placeholder={t("pricePlaceholder")}
                  className={inputClass("price_amount")}
                />
                <p className="mt-1 text-xs text-gray-400">{t("priceHint")}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  {t("currency")}
                </label>
                <select
                  value={formData.price_currency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_currency: e.target.value,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-sm"
                >
                  <option value="DZD">DZD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, featured: !formData.featured })
                }
                className={`w-12 h-6 rounded-full transition-colors ${formData.featured ? "bg-amber-500" : "bg-gray-200 dark:bg-slate-800/90"}`}
                role="switch"
                aria-checked={formData.featured}
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
                  {t("featured")}
                </span>
              </div>
              <p className="text-xs text-gray-400 ml-2">{t("featuredHint")}</p>
            </div>
          </SectionCard>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <PodaciumButton
            type="submit"
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isEditing ? t("save") : t("create")}
          </PodaciumButton>
          <Link href="/learn/manage">
            <PodaciumButton variant="outline" type="button">
              {t("cancel")}
            </PodaciumButton>
          </Link>
        </div>
      </motion.form>
    </div>
  );
}
