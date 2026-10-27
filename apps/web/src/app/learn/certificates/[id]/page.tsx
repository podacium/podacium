"use client";

import { useParams } from "next/navigation";
import { useBidi } from "@/lib/i18n";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BreadcrumbJsonLd } from "@/components/StructuredData";
import CertificatePage from "./components/page";

export default function CertificateViewPage() {
  const params = useParams();
  const id = params.id as string;
  const { dir } = useBidi();

  return (
    <div dir={dir}>
      <BreadcrumbJsonLd
        items={[{ name: "Learn", url: "/learn" }, { name: "Certificate" }]}
      />
      <Navbar />
      <main className="min-h-screen pt-24">
        <CertificatePage />
      </main>
      <Footer />
    </div>
  );
}
