"use client";

import React from "react";
import { DeveloperPortal } from "@/components/developer/DeveloperPortal";

export default function DeveloperPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pt-24 sm:pt-28 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <DeveloperPortal />
    </main>
  );
}
