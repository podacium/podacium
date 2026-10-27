import type { Metadata } from "next";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/StructuredData";

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: "terms", path: "/terms" });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const label = messages?.breadcrumbs?.terms ?? "Terms of Service";
  const description =
    messages?.meta?.terms?.description ??
    "Terms of service, user agreements, and contractual obligations for Podacium users and clients.";
  const breadcrumbItems = [
    { name: "Podacium", url: "/" },
    { name: label, url: "/terms" },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} inLanguage={locale} />
      <WebPageJsonLd
        name={label}
        description={description}
        url="/terms"
        inLanguage={locale}
        breadcrumbItems={breadcrumbItems}
      />
      {children}
    </>
  );
}
