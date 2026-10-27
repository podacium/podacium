"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Link as LinkIcon } from "lucide-react";
import {
  portfolioApi,
  type PortfolioItem,
  type PortfolioLink,
} from "@/lib/api/portfolio";
import {
  PodaciumButton,
  PodaciumInput,
  PodaciumTextarea,
} from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";

interface PortfolioFormProps {
  item?: PortfolioItem | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface LinkEntry {
  url: string;
  label: string;
}

const emptyLink = (): LinkEntry => ({ url: "", label: "" });

const PortfolioForm: React.FC<PortfolioFormProps> = ({
  item,
  onSuccess,
  onCancel,
}) => {
  const t = useTranslations("hub");
  const isEditing = !!item;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [mediaUrlsInput, setMediaUrlsInput] = useState("");
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || "");
      setTagsInput(item.tags.join(", "));
      setMediaUrlsInput(item.mediaUrls.join(", "));
      setLinks(
        item.links && Array.isArray(item.links)
          ? (item.links as PortfolioLink[]).map((l) => ({
              url: l.url,
              label: l.label,
            }))
          : [],
      );
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("portfolioForm.titleLabel"));
      return;
    }

    setSubmitting(true);
    setError("");

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const mediaUrls = mediaUrlsInput
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    const validLinks = links.filter((l) => l.url.trim());

    try {
      if (isEditing && item) {
        await portfolioApi.update(item.id, {
          title,
          description: description || undefined,
          tags,
          media_urls: mediaUrls,
          links: validLinks,
        });
      } else {
        await portfolioApi.create({
          title,
          description: description || undefined,
          tags,
          media_urls: mediaUrls,
          links: validLinks,
        });
      }
      onSuccess();
    } catch {
      setError(t("portfolioForm.saveError"));
    } finally {
      setSubmitting(false);
    }
  };

  const addLink = () => setLinks((prev) => [...prev, emptyLink()]);

  const updateLink = (index: number, field: keyof LinkEntry, value: string) => {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
        {isEditing ? t("portfolioForm.editTitle") : t("portfolioForm.newTitle")}
      </h2>

      <PodaciumInput
        label={t("portfolioForm.titleLabel")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("portfolioForm.titlePlaceholder")}
        error={error || undefined}
      />

      <PodaciumTextarea
        label={t("portfolioForm.descLabel")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("portfolioForm.descPlaceholder")}
        rows={4}
      />

      <PodaciumInput
        label={t("portfolioForm.tagsLabel")}
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder={t("portfolioForm.tagsPlaceholder")}
        hint={t("portfolioForm.tagsHint")}
      />

      <PodaciumInput
        label={t("portfolioForm.mediaUrlsLabel")}
        value={mediaUrlsInput}
        onChange={(e) => setMediaUrlsInput(e.target.value)}
        placeholder={t("portfolioForm.mediaUrlsPlaceholder")}
        hint={t("portfolioForm.mediaUrlsHint")}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
          {t("portfolioForm.links")}
        </label>
        {links.map((link, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-2">
              <input
                type="url"
                value={link.url}
                onChange={(e) => updateLink(i, "url", e.target.value)}
                placeholder={t("portfolioForm.urlPlaceholder")}
                className="flex w-full rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <input
                type="text"
                value={link.label}
                onChange={(e) => updateLink(i, "label", e.target.value)}
                placeholder={t("portfolioForm.labelPlaceholder")}
                className="flex w-full rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => removeLink(i)}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors mt-1"
              aria-label={t("portfolioForm.removeLink")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <PodaciumButton
          type="button"
          variant="outline"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={addLink}
        >
          {t("portfolioForm.addLink")}
        </PodaciumButton>
      </div>

      <div className="flex gap-3 pt-4">
        <PodaciumButton type="submit" variant="primary" loading={submitting}>
          {isEditing
            ? t("portfolioForm.saveChanges")
            : t("portfolioForm.createItem")}
        </PodaciumButton>
        <PodaciumButton type="button" variant="outline" onClick={onCancel}>
          {t("portfolioForm.cancel")}
        </PodaciumButton>
      </div>
    </form>
  );
};

export default PortfolioForm;
