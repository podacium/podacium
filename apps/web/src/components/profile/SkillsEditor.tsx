"use client";

import { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

interface SkillsEditorProps {
  skills: string[];
  onAdd: (skill: string) => Promise<void>;
  onRemove: (skillName: string) => Promise<void>;
  isEditing: boolean;
  maxSkills?: number;
}

export function SkillsEditor({
  skills,
  onAdd,
  onRemove,
  isEditing,
  maxSkills = 50,
}: SkillsEditorProps) {
  const t = useTranslations("profile");
  const [newSkill, setNewSkill] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!newSkill.trim() || skills.length >= maxSkills) return;
    setAdding(true);
    try {
      await onAdd(newSkill.trim());
      setNewSkill("");
    } finally {
      setAdding(false);
    }
  }, [newSkill, skills.length, maxSkills, onAdd]);

  return (
    <div>
      {isEditing && (
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder={t("fields.addNewSkill")}
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newSkill.trim()}
            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {skills.slice(0, 15).map((skill, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-900/50"
          >
            {skill}
            {isEditing && (
              <button
                onClick={() => onRemove(skill)}
                className="text-red-400 hover:text-red-600 dark:text-red-400"
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {skills.length > 15 && (
          <span className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-full text-sm border border-gray-200 dark:border-slate-800">
            {t("fields.moreSkills", { count: String(skills.length - 15) })}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
          <span>{t("fields.skills")}</span>
          <span className="font-medium">
            {skills.length}/{maxSkills}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (skills.length / maxSkills) * 100)}%`,
            }}
          />
        </div>
      </div>
      {skills.length === 0 && !isEditing && (
        <p className="text-sm text-gray-400 italic">
          {t("emptyStates.skills.description")}
        </p>
      )}
    </div>
  );
}
