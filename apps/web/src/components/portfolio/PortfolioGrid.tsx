"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Image,
  Video,
  Edit3,
  Trash2,
  Plus,
  Link as LinkIcon,
  FolderOpen,
} from "lucide-react";
import {
  portfolioApi,
  type PortfolioItem,
  type PortfolioLink,
} from "@/lib/api/portfolio";
import { PodaciumButton } from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import PortfolioForm from "./PortfolioForm";

interface PortfolioGridProps {
  userId: number;
  editable?: boolean;
}

const isVideo = (url: string) =>
  /\.(mp4|webm|ogg|mov)$/i.test(url) ||
  url.includes("youtube.com") ||
  url.includes("youtu.be") ||
  url.includes("vimeo.com");

const getFileType = (url: string) => {
  if (isVideo(url)) return "video";
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) return "image";
  return "other";
};

const SkeletonCard = () => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden animate-pulse">
    <div className="aspect-video bg-gray-200 dark:bg-slate-800/90" />
    <div className="p-4 space-y-3">
      <div className="h-5 bg-gray-200 dark:bg-slate-800/90 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-full" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800/90 rounded w-2/3" />
      <div className="flex gap-2">
        <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-full w-16" />
        <div className="h-6 bg-gray-200 dark:bg-slate-800/90 rounded-full w-20" />
      </div>
    </div>
  </div>
);

const MediaPreview = ({ url }: { url: string }) => {
  const type = getFileType(url);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="aspect-video bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
        {type === "video" ? (
          <Video className="w-8 h-8 text-gray-400" />
        ) : (
          <Image className="w-8 h-8 text-gray-400" />
        )}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="aspect-video bg-black">
        <video
          className="w-full h-full object-cover"
          src={url}
          controls
          preload="metadata"
          onError={() => setError(true)}
        >
          <source src={url} />
        </video>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-gray-100 dark:bg-slate-800">
      <img
        className="w-full h-full object-cover"
        src={url}
        alt=""
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
};

export const PortfolioGrid: React.FC<PortfolioGridProps> = ({
  userId,
  editable = false,
}) => {
  const t = useTranslations("hub");
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);

  const fetchItems = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = editable
          ? await portfolioApi.getMyPortfolio(p)
          : await portfolioApi.getUserPortfolio(userId, p);
        setItems(res.items);
        setTotalPages(res.total_pages);
        setPage(res.page);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [userId, editable],
  );

  useEffect(() => {
    fetchItems(1);
  }, [fetchItems]);

  const handleDelete = async (itemId: number) => {
    if (!confirm(t("portfolioGrid.deleteConfirm"))) return;
    try {
      await portfolioApi.delete(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // silently fail
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingItem(null);
    fetchItems(1);
  };

  if (loading) {
    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0 && !showForm) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
          <FolderOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
          {t("portfolioGrid.emptyTitle")}
        </h3>
        <p className="text-gray-500 dark:text-slate-400 mb-6">
          {t("portfolioGrid.emptySubtitle")}
        </p>
        {editable && (
          <PodaciumButton
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowForm(true)}
          >
            {t("portfolioGrid.addItem")}
          </PodaciumButton>
        )}
      </div>
    );
  }

  return (
    <div>
      {showForm || editingItem ? (
        <PortfolioForm
          item={editingItem}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      ) : (
        <>
          {editable && (
            <div className="flex justify-end mb-6">
              <PodaciumButton
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowForm(true)}
              >
                {t("portfolioGrid.addItem")}
              </PodaciumButton>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-lg transition-shadow group"
              >
                {item.mediaUrls.length > 0 && (
                  <MediaPreview url={item.mediaUrls[0]} />
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-slate-100 line-clamp-1">
                      {item.title}
                    </h3>
                    {editable && (
                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                          aria-label={t("portfolioGrid.edit")}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors"
                          aria-label={t("portfolioGrid.delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {item.description && (
                    <p className="text-gray-600 dark:text-slate-400 text-sm mt-2 line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.links && item.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(item.links as PortfolioLink[]).map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:underline"
                        >
                          <LinkIcon className="w-3 h-3" />
                          {link.label || link.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => fetchItems(i + 1)}
                  className={cn(
                    "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                    page === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200",
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PortfolioGrid;
