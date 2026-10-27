import type { Metadata } from "next";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/StructuredData";

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: "privacy", path: "/privacy" });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const label = messages?.breadcrumbs?.privacy ?? "Privacy Policy";
  const description =
    messages?.meta?.privacy?.description ??
    "Podacium SARL privacy policy and personal data protection compliance under Algerian Law 18-07.";
  const breadcrumbItems = [
    { name: "Podacium", url: "/" },
    { name: label, url: "/privacy" },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} inLanguage={locale} />
      <WebPageJsonLd
        name={label}
        description={description}
        url="/privacy"
        inLanguage={locale}
        breadcrumbItems={breadcrumbItems}
      />
      {children}
    </>
  );
}
