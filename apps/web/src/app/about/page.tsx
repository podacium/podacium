// apps/web/src/app/about/page.tsx
"use client";

import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useBidi } from "@/lib/i18n";
import { AboutHero } from "./_components/AboutHero";
import { AboutTrustBar } from "./_components/AboutTrustBar";
import { AboutFlywheel } from "./_components/AboutFlywheel";
import { AboutSecurity } from "./_components/AboutSecurity";
import { AboutTeam } from "./_components/AboutTeam";
import { AboutJourney } from "./_components/AboutJourney";
import { AboutVision } from "./_components/AboutVision";
import { AboutCTA } from "./_components/AboutCTA";

export default function AboutPage() {
  const { dir } = useBidi();

  return (
    <div
      className="min-h-screen bg-background text-foreground selection:bg-primary/15 overflow-x-hidden"
      dir={dir}
    >
      <Navbar />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <AboutHero />
        <AboutTrustBar />
        <AboutFlywheel />
        <AboutSecurity />
        <AboutTeam />
        <AboutJourney />
        <AboutVision />
        <AboutCTA />
      </main>
      <Footer />
    </div>
  );
}
