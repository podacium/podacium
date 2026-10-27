import type { Metadata } from "next";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/StructuredData";

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: "docs", path: "/docs" });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const label = messages?.breadcrumbs?.docs ?? "Documentation";
  const description =
    messages?.meta?.docs?.description ??
    "Developer guides, API references, and architecture specifications for Podacium.";
  const breadcrumbItems = [
    { name: "Podacium", url: "/" },
    { name: label, url: "/docs" },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} inLanguage={locale} />
      <WebPageJsonLd
        name={label}
        description={description}
        url="/docs"
        inLanguage={locale}
        breadcrumbItems={breadcrumbItems}
      />
      {children}
    </>
  );
}
