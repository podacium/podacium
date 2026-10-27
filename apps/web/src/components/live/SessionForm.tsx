"use client";

import React, { useState, useRef } from "react";
import { useTranslations } from "@/lib/i18n";
import { X, Upload, Plus, Trash2, Loader2 } from "lucide-react";
import PodaciumInput from "@/components/design-system/PodaciumInput";
import PodaciumTextarea from "@/components/design-system/PodaciumTextarea";
import PodaciumSelect from "@/components/design-system/PodaciumSelect";
import PodaciumSwitch from "@/components/design-system/PodaciumSwitch";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import { SectionCard } from "@/components/SectionComponents";
import { uploadFileWithProgress } from "@/lib/api/uploader";

export interface SessionFormData {
  title: string;
  description: string;
  category: string;
  tags: string[];
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  scheduledAt: string;
  scheduledTime: string;
  timezone: string;
  durationMinutes: string;
  maxParticipants: number;
  priceAmount: string;
  currency: string;
  earlyBirdPrice: string;
  earlyBirdDeadline: string;
  language: string;
  thumbnailUrl: string;
  agenda: string;
  materials: { label: string; url: string }[];
  recording: boolean;
  allowChat: boolean;
  allowQa: "direct" | "moderated" | "disabled";
  allowScreenShare: boolean;
}

interface Props {
  initialData?: Partial<SessionFormData>;
  onSubmit: (data: SessionFormData) => Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
}

const TIMEZONES = [
  "Africa/Algiers",
  "Africa/Casablanca",
  "Africa/Tunis",
  "Africa/Cairo",
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "UTC",
];

const CATEGORIES = [
  "Web Development",
  "Mobile Development",
  "Data Science & AI",
  "UI/UX Design",
  "Digital Marketing",
  "Business & Entrepreneurship",
  "Languages",
  "Finance & Accounting",
  "Personal Development",
  "Other",
];

export function SessionForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitLabel,
  submittingLabel,
}: Props) {
  const t = useTranslations("live");
  const [form, setForm] = useState<SessionFormData>({
    title: "",
    description: "",
    category: "",
    tags: [],
    visibility: "PUBLIC",
    scheduledAt: "",
    scheduledTime: "12:00",
    timezone: "Africa/Algiers",
    durationMinutes: "60",
    maxParticipants: 100,
    priceAmount: "",
    currency: "DZD",
    earlyBirdPrice: "",
    earlyBirdDeadline: "",
    language: "",
    thumbnailUrl: "",
    agenda: "",
    materials: [],
    recording: true,
    allowChat: true,
    allowQa: "direct",
    allowScreenShare: false,
    ...initialData,
  });
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    initialData?.thumbnailUrl || null,
  );

  const updateField = <K extends keyof SessionFormData>(
    key: K,
    value: SessionFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || form.tags.length >= 10 || form.tags.includes(tag)) return;
    updateField("tags", [...form.tags, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateField(
      "tags",
      form.tags.filter((t) => t !== tag),
    );
  };

  const addMaterial = () => {
    updateField("materials", [...form.materials, { label: "", url: "" }]);
  };

  const updateMaterial = (
    index: number,
    field: "label" | "url",
    value: string,
  ) => {
    const updated = form.materials.map((m, i) =>
      i === index ? { ...m, [field]: value } : m,
    );
    updateField("materials", updated);
  };

  const removeMaterial = (index: number) => {
    updateField(
      "materials",
      form.materials.filter((_, i) => i !== index),
    );
  };

  const handleThumbnailFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError(t("create.form.validation.fileSizeLimit"));
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setThumbnailPreview(localUrl);
    setUploadingThumbnail(true);
    setUploadProgress(0);
    try {
      const res = await uploadFileWithProgress(file, "courses", {
        onProgress: (percent) => setUploadProgress(percent),
      });
      setThumbnailPreview(res.url);
      updateField("thumbnailUrl", res.url);
    } catch (err: any) {
      setError(err?.message || t("create.form.validation.bannerUploadFailed"));
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleThumbnailDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleThumbnailFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (uploadingThumbnail) {
      setError(t("create.form.validation.bannerUploadPending"));
      return;
    }

    if (!form.title.trim()) {
      setError(t("create.form.validation.titleRequired"));
      return;
    }
    if (!form.scheduledAt) {
      setError(t("create.form.validation.dateRequired"));
      return;
    }

    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err.message || t("create.form.validation.generic"));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <SectionCard title={t("create.section.basicInfo")}>
        <div className="space-y-6">
          <PodaciumInput
            label={t("create.form.title")}
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder={t("create.form.titlePlaceholder")}
            maxLength={200}
            required
          />
          <PodaciumTextarea
            label={t("create.form.description")}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder={t("create.form.descriptionPlaceholder")}
            rows={4}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PodaciumSelect
              label={t("create.form.category")}
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              placeholder={t("create.form.categoryPlaceholder")}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <PodaciumSelect
              label={t("create.form.language")}
              value={form.language}
              onChange={(e) => updateField("language", e.target.value)}
              placeholder={t("create.form.languagePlaceholder")}
              options={[
                { value: "ar", label: t("create.form.languageOptions.ar") },
                { value: "fr", label: t("create.form.languageOptions.fr") },
                { value: "en", label: t("create.form.languageOptions.en") },
                {
                  value: "multi",
                  label: t("create.form.languageOptions.multi"),
                },
              ]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t("create.form.tags")}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-purple-900 dark:text-purple-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <PodaciumInput
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder={t("create.form.tagsPlaceholder")}
                inputSize="sm"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <PodaciumButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={addTag}
                disabled={!tagInput.trim() || form.tags.length >= 10}
              >
                <Plus className="h-4 w-4" />
              </PodaciumButton>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {t("create.form.tagsHint")}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("create.section.schedule")}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PodaciumInput
              label={t("create.form.date")}
              type="date"
              value={form.scheduledAt}
              onChange={(e) => updateField("scheduledAt", e.target.value)}
              required
            />
            <PodaciumInput
              label={t("create.form.time")}
              type="time"
              value={form.scheduledTime}
              onChange={(e) => updateField("scheduledTime", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PodaciumInput
              label={t("create.form.duration")}
              type="number"
              value={form.durationMinutes}
              onChange={(e) => updateField("durationMinutes", e.target.value)}
              placeholder={t("create.form.durationPlaceholder")}
              min={1}
            />
            <PodaciumSelect
              label={t("create.form.timezone")}
              value={form.timezone}
              onChange={(e) => updateField("timezone", e.target.value)}
              placeholder={t("create.form.timezonePlaceholder")}
              options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("create.section.pricing")}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PodaciumInput
              label={t("create.form.price")}
              type="number"
              value={form.priceAmount}
              onChange={(e) => updateField("priceAmount", e.target.value)}
              placeholder={t("create.form.pricePlaceholder")}
              min={0}
            />
            <PodaciumInput
              label={t("create.form.maxParticipants")}
              type="number"
              value={String(form.maxParticipants)}
              onChange={(e) =>
                updateField("maxParticipants", parseInt(e.target.value) || 0)
              }
              min={1}
            />
          </div>
          <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
              {t("create.form.earlyBird")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PodaciumInput
                label={t("create.form.earlyBirdPrice")}
                type="number"
                value={form.earlyBirdPrice}
                onChange={(e) => updateField("earlyBirdPrice", e.target.value)}
                placeholder={t("create.form.earlyBirdPricePlaceholder")}
                min={0}
              />
              <PodaciumInput
                label={t("create.form.earlyBirdDeadline")}
                type="date"
                value={form.earlyBirdDeadline}
                onChange={(e) =>
                  updateField("earlyBirdDeadline", e.target.value)
                }
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {t("create.form.earlyBirdHint")}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("create.section.content")}>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {t("create.form.thumbnail")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PodaciumInput
                value={form.thumbnailUrl}
                onChange={(e) => {
                  updateField("thumbnailUrl", e.target.value);
                  setThumbnailPreview(e.target.value || null);
                }}
                placeholder={t("create.form.thumbnailUrlPlaceholder")}
              />
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleThumbnailDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition-colors"
              >
                <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {t("create.form.thumbnailDragDrop")}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleThumbnailFile(file);
                  }}
                />
              </div>
            </div>
            {thumbnailPreview && (
              <div className="mt-3 relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800">
                <p className="text-xs text-gray-400 mb-1">
                  {t("create.form.thumbnailPreview")}
                </p>
                <div className="relative">
                  <img
                    src={thumbnailPreview}
                    alt={t("create.form.thumbnailPreview")}
                    className="w-full max-h-48 object-cover rounded-lg"
                  />
                  {uploadingThumbnail && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
                      <span className="text-xs font-medium">
                        {t("create.form.thumbnailUploading", {
                          progress: uploadProgress,
                        })}
                      </span>
                      <div className="w-48 bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {t("create.form.thumbnailHint")}
            </p>
          </div>

          <PodaciumTextarea
            label={t("create.form.agenda")}
            value={form.agenda}
            onChange={(e) => updateField("agenda", e.target.value)}
            placeholder={t("create.form.agendaPlaceholder")}
            rows={3}
          />
          <p className="text-xs text-gray-400 -mt-4">
            {t("create.form.agendaHint")}
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {t("create.form.materials")}
              </label>
              <PodaciumButton
                type="button"
                size="sm"
                variant="secondary"
                onClick={addMaterial}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="ms-1">{t("create.form.materialsAdd")}</span>
              </PodaciumButton>
            </div>
            <div className="space-y-2">
              {form.materials.map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <PodaciumInput
                      value={m.label}
                      onChange={(e) =>
                        updateMaterial(i, "label", e.target.value)
                      }
                      placeholder={t("create.form.materialLabelPlaceholder")}
                      inputSize="sm"
                    />
                    <PodaciumInput
                      value={m.url}
                      onChange={(e) => updateMaterial(i, "url", e.target.value)}
                      placeholder={t("create.form.materialUrlPlaceholder")}
                      inputSize="sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMaterial(i)}
                    className="p-2 text-gray-400 hover:text-red-500 dark:text-red-400 mt-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {t("create.form.materialsHint")}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("create.section.settings")}>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {t("create.form.recording")}
              </span>
              <p className="text-xs text-gray-400">
                {t("create.form.recordingHint")}
              </p>
            </div>
            <PodaciumSwitch
              checked={form.recording}
              onChange={(v) => updateField("recording", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {t("create.form.allowChat")}
              </span>
              <p className="text-xs text-gray-400">
                {t("create.form.allowChatHint")}
              </p>
            </div>
            <PodaciumSwitch
              checked={form.allowChat}
              onChange={(v) => updateField("allowChat", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {t("create.form.allowQa")}
              </span>
            </div>
            <PodaciumSelect
              value={form.allowQa}
              onChange={(e) => updateField("allowQa", e.target.value as any)}
              options={[
                { value: "direct", label: t("create.form.qaDirect") },
                { value: "moderated", label: t("create.form.qaModerated") },
                { value: "disabled", label: t("create.form.qaDisabled") },
              ]}
              selectSize="sm"
              className="w-48"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {t("create.form.allowScreenShare")}
              </span>
              <p className="text-xs text-gray-400">
                {t("create.form.allowScreenShareHint")}
              </p>
            </div>
            <PodaciumSwitch
              checked={form.allowScreenShare}
              onChange={(v) => updateField("allowScreenShare", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {t("create.form.visibility")}
              </span>
            </div>
            <PodaciumSelect
              value={form.visibility}
              onChange={(e) => updateField("visibility", e.target.value as any)}
              options={[
                { value: "PUBLIC", label: t("create.form.public") },
                { value: "UNLISTED", label: t("create.form.unlisted") },
                { value: "PRIVATE", label: t("create.form.private") },
              ]}
              selectSize="sm"
              className="w-40"
            />
          </div>
        </div>
      </SectionCard>

      <PodaciumButton
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isSubmitting}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </PodaciumButton>
    </form>
  );
}
