import type { Metadata } from "next";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import { PAGE_METADATA } from "@/lib/metadata.config";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/StructuredData";

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({
    key: "bi",
    path: "/bi",
    keywords: PAGE_METADATA.bi?.keywords,
  });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const label = messages?.breadcrumbs?.bi ?? "Business Intelligence";
  const description =
    messages?.meta?.bi?.description ??
    "Enterprise data analytics, interactive dashboards, and business intelligence.";
  const breadcrumbItems = [
    { name: "Podacium", url: "/" },
    { name: label, url: "/bi" },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} inLanguage={locale} />
      <WebPageJsonLd
        name={label}
        description={description}
        url="/bi"
        inLanguage={locale}
        breadcrumbItems={breadcrumbItems}
      />
      {children}
    </>
  );
}
