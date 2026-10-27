"use client";

import { Users, Crown, Shield } from "lucide-react";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";

export function getRoleBadgeConfig(role: string) {
  switch (role?.toUpperCase()) {
    case "OWNER":
      return {
        variant: "default" as const,
        icon: Crown,
      };
    case "ADMIN":
      return {
        variant: "secondary" as const,
        icon: Shield,
      };
    default:
      return {
        variant: "outline" as const,
        icon: Users,
      };
  }
}

interface RoleBadgeProps {
  role: string;
  t: (key: string) => string;
}

export function RoleBadge({ role, t }: RoleBadgeProps) {
  const config = getRoleBadgeConfig(role);
  const Icon = config.icon;
  return (
    <PodaciumBadge
      variant={config.variant}
      className="inline-flex items-center gap-1.5"
    >
      <Icon className="w-3 h-3" />
      <span>
        {t(`bi.organizations.roles.${role?.toLowerCase() || "member"}`)}
      </span>
    </PodaciumBadge>
  );
}
