import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Organization Profile | Podacium",
  description:
    "Verified Algerian enterprise profile, case studies, leadership, and public intelligence.",
};

export default function OrgProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      {children}
    </div>
  );
}
