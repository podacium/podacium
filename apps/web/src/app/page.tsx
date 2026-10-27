import React, { Suspense } from "react";
import { PodaciumHero } from "@/components/landing";
import VideoExplainer from "@/components/landing/VideoExplainer";
import EducationLayer from "@/components/landing/EducationLayer";
import FreelancingLayer from "@/components/landing/FreelancingLayer";
import BILayer from "@/components/landing/BILayer";
import ActivationSection from "@/components/landing/ActivationSection";
import FAQSectionComponent from "@/components/landing/FAQSection";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/StructuredData";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export async function generateMetadata() {
  return generateI18nMetadata({ key: "home", path: "/" });
}

export default async function HomePage() {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const name =
    messages?.meta?.home?.title ?? messages?.meta?.title ?? "Podacium";
  const description =
    messages?.meta?.home?.description ?? messages?.meta?.description ?? "";
  const breadcrumbItems = [{ name: "Podacium", url: "/" }];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} inLanguage={locale} />
      <WebPageJsonLd
        name={name}
        description={description}
        url="/"
        inLanguage={locale}
        breadcrumbItems={breadcrumbItems}
      />

      <div className="relative min-h-screen bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="aurora-blob w-[36rem] h-[36rem] -top-48 -left-48 bg-blue-50 dark:bg-slate-900/60 dark:bg-blue-950/60 animate-aurora-slow" />
          <div className="aurora-blob w-[32rem] h-[32rem] top-[30%] -right-48 bg-indigo-50 dark:bg-slate-900/80 dark:bg-indigo-950/60 animate-aurora" />
          <div className="aurora-blob w-[28rem] h-[28rem] bottom-0 left-1/3 bg-purple-50 dark:bg-slate-900/80 dark:bg-purple-950/60 animate-aurora-slow" />
        </div>
        <div className="relative">
          <Suspense fallback={<div className="h-20 w-full" aria-hidden />}>
            <Navbar />
          </Suspense>

          <main id="main-content" tabIndex={-1} className="focus:outline-none">
            <PodaciumHero />
            <VideoExplainer />
            <EducationLayer />
            <FreelancingLayer />
            <BILayer />
            <ActivationSection />
            <FAQSectionComponent />
          </main>

          <Suspense fallback={<footer className="h-64 bg-gray-900" />}>
            <Footer />
          </Suspense>
        </div>
      </div>
    </>
  );
}
