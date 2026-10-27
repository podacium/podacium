// apps/web/src/app/about/_components/AboutTeamModal.tsx
"use client";

import React from "react";
import Image from "next/image";
import { GraduationCap, Award, Linkedin, ArrowUpRight } from "lucide-react";
import { PodaciumModal } from "@/components/design-system/PodaciumModal";
import { PodaciumBadge } from "@/components/design-system/PodaciumBadge";
import { useTranslations, useBidi } from "@/lib/i18n";
import type { FounderProfile } from "../types";

interface AboutTeamModalProps {
  founder: FounderProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AboutTeamModal: React.FC<AboutTeamModalProps> = ({
  founder,
  isOpen,
  onClose,
}) => {
  const t = useTranslations();
  const { dir } = useBidi();

  if (!founder) return null;

  return (
    <PodaciumModal
      isOpen={isOpen}
      onClose={onClose}
      title={founder.name}
      description={founder.role}
      size="lg"
      className="p-0 overflow-hidden"
    >
      <div
        className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto"
        dir={dir}
      >
        {/* Header Summary */}
        <div className="flex items-center gap-4">
          {founder.photoUrl ? (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-md border-2 border-white dark:border-slate-800 ring-1 ring-border/80 relative bg-muted flex-shrink-0">
              <Image
                src={founder.photoUrl}
                alt={founder.name}
                width={96}
                height={96}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ) : (
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-md flex-shrink-0 ${founder.avatarGradient}`}
            >
              {founder.avatarInitials}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {founder.name}
            </h3>
            <p className="text-sm font-medium text-primary">{founder.role}</p>
            <PodaciumBadge variant="secondary" className="mt-1 text-xs">
              {t("about.team.labels.hseAlum")}
            </PodaciumBadge>
          </div>
        </div>

        {/* Bio Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("about.team.labels.profile")}
          </h4>
          <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-xl border border-border/60">
            {founder.bio}
          </p>
        </div>

        {/* Education Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("about.team.labels.education")}
            </h4>
          </div>
          <ul className="space-y-2">
            {founder.parcours.education.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Highlights Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("about.team.labels.highlights")}
            </h4>
          </div>
          <ul className="space-y-2.5">
            {founder.parcours.highlights.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Links */}
        {founder.linkedinUrl && (
          <div className="pt-4 border-t border-border flex justify-end">
            <a
              href={founder.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] dark:text-[#70B5F9] border border-[#0A66C2]/20 transition-all hover:scale-105 shadow-sm"
            >
              <Linkedin className="w-3.5 h-3.5 fill-current" />
              <span>{t("about.team.labels.connectLinkedIn")}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </PodaciumModal>
  );
};
