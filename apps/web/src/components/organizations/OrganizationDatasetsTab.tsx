"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Database,
  FileText,
  Calendar,
  User,
  ArrowRight,
  Trash2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

import { api, OrganizationResponse, BiDatasetMetadata } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

interface OrganizationDatasetsTabProps {
  organization: OrganizationResponse;
  t: (key: string) => string;
}

function DatasetDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  count = 1,
  isDeleting,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count?: number;
  isDeleting: boolean;
  t: (key: string) => string;
}) {
  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      title={t("bi.datasets.list.bulkDelete.confirmTitle").replace(
        "{count}",
        String(count),
      )}
      description={t("bi.datasets.modals.delete.subtitle")}
      size="md"
    >
      <div className="space-y-5">
        <p className="text-gray-600 text-sm">
          {t("bi.datasets.list.bulkDelete.confirmMessage").replace(
            "{count}",
            String(count),
          )}
        </p>
        <div className="flex items-center justify-end gap-3">
          <PodaciumButton
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t("bi.datasets.modals.delete.cancel")}
          </PodaciumButton>
          <PodaciumButton
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            loading={isDeleting}
            icon={<Trash2 className="w-4 h-4" />}
          >
            {t("bi.datasets.list.bulkDelete.button").replace(
              "{count}",
              String(count),
            )}
          </PodaciumButton>
        </div>
      </div>
    </PodaciumModal>
  );
}

export function OrganizationDatasetsTab({
  organization,
  t,
}: OrganizationDatasetsTabProps) {
  const locale = useLocale();
  const [datasets, setDatasets] = useState<BiDatasetMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = organization.isOwner || organization.userRole === "ADMIN";

  const loadDatasets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.listDatasets(
        1,
        100,
        undefined,
        undefined,
        organization.id,
      );
      setDatasets(response.datasets || []);
    } catch (err: any) {
      setError(err.message || t("bi.datasets.list.error.generic"));
    } finally {
      setLoading(false);
    }
  }, [organization.id, t]);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(datasets.map((d) => d.dataset_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      await Promise.allSettled(selectedIds.map((id) => api.deleteDataset(id)));
      await loadDatasets();
      setSelectedIds([]);
      setShowDeleteModal(false);
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <p>{t(error)}</p>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
          <Database className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {t("bi.organizations.datasets.empty.title")}
        </h3>
        <p className="text-gray-500 max-w-sm mx-auto">
          {t("bi.organizations.datasets.empty.description")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && datasets.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={
                  datasets.length > 0 && selectedIds.length === datasets.length
                }
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.length > 0
                  ? t("bi.datasets.list.bulk.selected").replace(
                      "{count}",
                      String(selectedIds.length),
                    )
                  : t("bi.datasets.list.bulk.selectAll")}
              </span>
            </label>
          </div>

          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <PodaciumButton
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  {t("bi.datasets.list.bulkDelete.button").replace(
                    "{count}",
                    String(selectedIds.length),
                  )}
                </PodaciumButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datasets.map((dataset) => {
          const isSelected = selectedIds.includes(dataset.dataset_id);
          return (
            <div key={dataset.dataset_id} className="relative group">
              {canManage && (
                <div className="absolute top-4 start-4 z-10">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) =>
                      handleSelect(dataset.dataset_id, e.target.checked)
                    }
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shadow-sm"
                  />
                </div>
              )}
              <Link
                href={`/bi/datasets/${dataset.dataset_id}`}
                className={`block p-5 bg-white border rounded-2xl transition-all duration-300 ${
                  isSelected
                    ? "border-blue-500 shadow-md ring-1 ring-blue-500/20"
                    : "border-gray-100 hover:shadow-lg hover:border-blue-100"
                }`}
              >
                <div
                  className={`flex items-start justify-between mb-4 ${canManage ? "ps-8" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                        {dataset.name}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {dataset.domain}
                      </p>
                    </div>
                  </div>
                  <PodaciumBadge
                    variant={
                      (dataset.status as string) === "VALIDATED" ||
                      dataset.status === "PROCESSED"
                        ? "success"
                        : "default"
                    }
                  >
                    {dataset.status}
                  </PodaciumBadge>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex items-center gap-1.5"
                      title={t("bi.datasets.detail.uploadedBy")}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>
                        {dataset.uploader?.fullName ||
                          t("organizations.unknownUser")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(dataset.created_at).toLocaleDateString(
                          locale,
                        )}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors rtl:rotate-180" />
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <DatasetDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        count={selectedIds.length}
        isDeleting={isDeleting}
        t={t}
      />
    </div>
  );
}
