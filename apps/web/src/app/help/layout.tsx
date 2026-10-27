import type { Metadata } from "next";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/StructuredData";

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: "help", path: "/help" });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const label = messages?.breadcrumbs?.help ?? "Help Center";
  const description =
    messages?.meta?.help?.description ??
    "Find answers, tutorials, and support guides for courses, freelancing, and BI tools on Podacium.";
  const breadcrumbItems = [
    { name: "Podacium", url: "/" },
    { name: label, url: "/help" },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} inLanguage={locale} />
      <WebPageJsonLd
        name={label}
        description={description}
        url="/help"
        inLanguage={locale}
        breadcrumbItems={breadcrumbItems}
      />
      {children}
    </>
  );
}
