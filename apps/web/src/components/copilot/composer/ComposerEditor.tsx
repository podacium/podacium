"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Send,
  AtSign,
  BookOpen,
  FileText,
  Flag,
  BarChart3,
  LifeBuoy,
  X,
} from "lucide-react";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations } from "@/lib/i18n";

export interface AttachedEntity {
  type: "course" | "contract" | "milestone" | "chart" | "ticket";
  id: string;
  label: string;
  meta?: Record<string, any>;
}

export interface EntitySuggestion {
  type: AttachedEntity["type"];
  id: string;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEFAULT_SUGGESTIONS: EntitySuggestion[] = [
  {
    type: "course",
    id: "course:42",
    label: "@course:42",
    detail: "Next.js 15 & Tailwind Architecture",
    icon: BookOpen,
  },
  {
    type: "contract",
    id: "contract:104",
    label: "@contract:104",
    detail: "Escrow Fixed-Price Milestone #3",
    icon: FileText,
  },
  {
    type: "milestone",
    id: "milestone:3",
    label: "@milestone:3",
    detail: "Deliverable Review & Approval",
    icon: Flag,
  },
  {
    type: "chart",
    id: "chart:revenue",
    label: "@chart:revenue",
    detail: "Live DZD Revenue Widget",
    icon: BarChart3,
  },
  {
    type: "ticket",
    id: "ticket:89",
    label: "@ticket:89",
    detail: "EDAHABIA Billing Support",
    icon: LifeBuoy,
  },
];

export interface ComposerEditorProps {
  onSend: (message: string, entities: AttachedEntity[]) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ComposerEditor({
  onSend,
  placeholder = "Ask Podacium Copilot... (Type '@' to reference courses, contracts, charts)",
  disabled = false,
  className,
}: ComposerEditorProps) {
  const t = useTranslations();
  const [message, setMessage] = useState<string>("");
  const [attachedEntities, setAttachedEntities] = useState<AttachedEntity[]>(
    [],
  );
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const [mentionQuery, setMentionQuery] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  // Filter entity suggestions based on query typed after @
  const filteredSuggestions = DEFAULT_SUGGESTIONS.filter((s) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return (
      s.label.toLowerCase().includes(q) ||
      s.detail.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q)
    );
  });

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    // Check for '@' symbol trigger at cursor position
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      // Only open if there is no space after @
      if (!query.includes(" ")) {
        setMentionQuery(query);
        setShowMentionMenu(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowMentionMenu(false);
  };

  const handleSelectEntity = useCallback(
    (suggestion: EntitySuggestion) => {
      // Add to attachedEntities if not already present
      if (!attachedEntities.some((e) => e.id === suggestion.id)) {
        setAttachedEntities((prev) => [
          ...prev,
          {
            type: suggestion.type,
            id: suggestion.id,
            label: suggestion.label,
          },
        ]);
      }

      // Replace the '@query' in text with clean space
      if (textareaRef.current) {
        const cursorPos = textareaRef.current.selectionStart ?? message.length;
        const textBeforeCursor = message.slice(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");
        const textAfterCursor = message.slice(cursorPos);

        const newText =
          message.slice(0, lastAtIndex) +
          suggestion.label +
          " " +
          textAfterCursor;
        setMessage(newText);
      }

      setShowMentionMenu(false);
      setMentionQuery("");
      textareaRef.current?.focus();
    },
    [attachedEntities, message],
  );

  const removeEntity = (id: string) => {
    setAttachedEntities((prev) => prev.filter((e) => e.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) =>
            (prev - 1 + filteredSuggestions.length) %
            filteredSuggestions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectEntity(filteredSuggestions[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed && attachedEntities.length === 0) return;
    if (disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSend(trimmed, attachedEntities);
      setMessage("");
      setAttachedEntities([]);
      setShowMentionMenu(false);
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div
      data-testid="copilot-composer"
      className={cn(
        "relative rounded-xl border border-border bg-card p-2 shadow-xs transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10",
        className,
      )}
    >
      {/* Attached Entity Pills */}
      {attachedEntities.length > 0 && (
        <div
          data-testid="attached-entities-bar"
          className="flex flex-wrap items-center gap-1.5 pb-2 px-1 border-b border-border/40 mb-2"
        >
          {attachedEntities.map((entity) => (
            <PodaciumBadge
              key={entity.id}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono bg-primary/10 text-primary border-primary/20"
            >
              <AtSign className="h-3 w-3" />
              <span>{entity.label}</span>
              <button
                type="button"
                onClick={() => removeEntity(entity.id)}
                aria-label={t("copilot.composer.removeEntityAria", {
                  label: entity.label,
                })}
                className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 text-primary"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </PodaciumBadge>
          ))}
        </div>
      )}

      {/* Mention Suggestions Popover */}
      {showMentionMenu && filteredSuggestions.length > 0 && (
        <div
          ref={mentionDropdownRef}
          data-testid="mention-dropdown"
          className="absolute bottom-full mb-2 left-2 z-50 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden p-1"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
            {t("copilot.composer.contextEntities")}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredSuggestions.map((suggestion, idx) => {
              const Icon = suggestion.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={suggestion.id}
                  type="button"
                  data-testid={`mention-option-${suggestion.type}`}
                  onClick={() => handleSelectEntity(suggestion)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-accent text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">
                      {suggestion.label}
                    </div>
                    <div
                      className={cn(
                        "text-[10px] truncate",
                        isSelected
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {suggestion.detail}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area & Controls */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          data-testid="composer-textarea"
          value={message}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          rows={2}
          className="w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
        />

        <div className="flex items-center gap-1 shrink-0 pb-0.5">
          <button
            type="button"
            data-testid="trigger-mention-btn"
            onClick={() => {
              setShowMentionMenu(true);
              setMentionQuery("");
              textareaRef.current?.focus();
            }}
            title={t("copilot.composer.attachContextTitle")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <AtSign className="h-4 w-4" />
          </button>

          <PodaciumButton
            data-testid="composer-send-btn"
            variant="primary"
            size="sm"
            loading={isSubmitting}
            disabled={
              disabled ||
              (!message.trim() && attachedEntities.length === 0) ||
              isSubmitting
            }
            onClick={handleSubmit}
            className="h-8 px-3"
          >
            <Send className="h-3.5 w-3.5" />
          </PodaciumButton>
        </div>
      </div>
    </div>
  );
}

export default ComposerEditor;
