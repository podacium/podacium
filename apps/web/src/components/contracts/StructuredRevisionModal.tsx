"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckSquare,
  Square,
  FileCode2,
  Palette,
  ShieldAlert,
  ListChecks,
  BookOpen,
  Send,
  X,
} from "lucide-react";
import {
  PodaciumModal,
  PodaciumButton,
  PodaciumCard,
  PodaciumBadge,
} from "@/components/design-system";
import { useTranslations } from "@/lib/i18n";

export interface RevisionCriterionConfig {
  id: string;
  labelKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const REVISION_CRITERIA_CONFIG: RevisionCriterionConfig[] = [
  {
    id: "CODE_QUALITY",
    labelKey: "contracts.detail.revisions.criteria.codeQuality",
    descKey: "contracts.detail.revisions.criteria.codeQualityDesc",
    icon: FileCode2,
  },
  {
    id: "DESIGN_CONFORMITY",
    labelKey: "contracts.detail.revisions.criteria.designConformity",
    descKey: "contracts.detail.revisions.criteria.designConformityDesc",
    icon: Palette,
  },
  {
    id: "SECURITY_PERFORMANCE",
    labelKey: "contracts.detail.revisions.criteria.securityPerformance",
    descKey: "contracts.detail.revisions.criteria.securityPerformanceDesc",
    icon: ShieldAlert,
  },
  {
    id: "MISSING_REQUIREMENTS",
    labelKey: "contracts.detail.revisions.criteria.missingRequirements",
    descKey: "contracts.detail.revisions.criteria.missingRequirementsDesc",
    icon: ListChecks,
  },
  {
    id: "DOCUMENTATION",
    labelKey: "contracts.detail.revisions.criteria.documentation",
    descKey: "contracts.detail.revisions.criteria.documentationDesc",
    icon: BookOpen,
  },
];

export interface StructuredRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneId: number;
  milestoneTitle: string;
  associatedPinCount?: number;
  onSubmitRevision: (data: {
    selectedCriteria: string[];
    detailedNotes: Record<string, string>;
    generalComment: string;
  }) => Promise<void>;
}

export const StructuredRevisionModal: React.FC<
  StructuredRevisionModalProps
> = ({
  isOpen,
  onClose,
  milestoneId,
  milestoneTitle,
  associatedPinCount = 0,
  onSubmitRevision,
}) => {
  const t = useTranslations();
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [detailedNotes, setDetailedNotes] = useState<Record<string, string>>(
    {},
  );
  const [generalComment, setGeneralComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCriterion = (criterionId: string) => {
    setSelectedCriteria((prev) =>
      prev.includes(criterionId)
        ? prev.filter((id) => id !== criterionId)
        : [...prev, criterionId],
    );
  };

  const updateNote = (criterionId: string, note: string) => {
    setDetailedNotes((prev) => ({ ...prev, [criterionId]: note }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCriteria.length === 0) {
      setError(t("contracts.detail.revisions.errorSelectCriterion"));
      return;
    }

    // Check that selected criteria have feedback
    for (const crit of selectedCriteria) {
      if (!detailedNotes[crit] || detailedNotes[crit].trim().length < 10) {
        const found = REVISION_CRITERIA_CONFIG.find((c) => c.id === crit);
        const criterionLabel = found ? t(found.labelKey) : crit;
        setError(
          t("contracts.detail.revisions.errorMinCharacters", {
            criterion: criterionLabel,
          }),
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmitRevision({
        selectedCriteria,
        detailedNotes,
        generalComment,
      });
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          "Une erreur est survenue lors de l'envoi de la demande de révision.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("contracts.detail.revisions.modalTitle")}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 leading-relaxed">
          <p className="font-semibold text-blue-950">
            {t("contracts.detail.revisions.milestoneHeader", {
              milestoneId,
              milestoneTitle,
            })}
          </p>
          <p className="mt-1">{t("contracts.detail.revisions.description")}</p>
          {associatedPinCount > 0 && (
            <p className="mt-1.5 font-medium text-indigo-700">
              {t("contracts.detail.revisions.pinsAttached", {
                count: associatedPinCount,
              })}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Criteria checklist */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("contracts.detail.revisions.criteriaLabel")}
          </label>
          <div className="grid gap-2">
            {REVISION_CRITERIA_CONFIG.map((criterion) => {
              const Icon = criterion.icon;
              const isSelected = selectedCriteria.includes(criterion.id);

              return (
                <div
                  key={criterion.id}
                  onClick={() => toggleCriterion(criterion.id)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                      : "border-border hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-primary">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          {t(criterion.labelKey)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t(criterion.descKey)}
                      </p>

                      {/* Detailed note input if selected */}
                      {isSelected && (
                        <div
                          className="mt-3 pt-2 border-t border-primary/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="block text-[10px] font-semibold text-primary uppercase">
                            {t(
                              "contracts.detail.revisions.expectedDetailsLabel",
                            )}
                          </label>
                          <textarea
                            rows={2}
                            value={detailedNotes[criterion.id] || ""}
                            onChange={(e) =>
                              updateNote(criterion.id, e.target.value)
                            }
                            placeholder={t(
                              "contracts.detail.revisions.detailsPlaceholder",
                            )}
                            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-foreground placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* General comments */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("contracts.detail.revisions.generalCommentLabel")}
          </label>
          <textarea
            rows={3}
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            placeholder={t(
              "contracts.detail.revisions.generalCommentPlaceholder",
            )}
            className="mt-1.5 w-full rounded-xl border border-border bg-white p-3 text-xs text-foreground placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Modal actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <PodaciumButton
            variant="ghost"
            size="sm"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("contracts.detail.revisions.cancel")}
          </PodaciumButton>
          <PodaciumButton
            variant="gradient"
            size="sm"
            type="submit"
            disabled={isSubmitting || selectedCriteria.length === 0}
          >
            <Send className="h-3.5 w-3.5 me-1.5" />
            {isSubmitting
              ? t("contracts.detail.revisions.submitting")
              : t("contracts.detail.revisions.submit")}
          </PodaciumButton>
        </div>
      </form>
    </PodaciumModal>
  );
};

export default StructuredRevisionModal;
