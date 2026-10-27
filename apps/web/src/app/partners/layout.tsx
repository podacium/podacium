import type { Metadata } from "next";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { getLocale, loadMessages } from "@/lib/locale-loader";
import { BreadcrumbJsonLd, WebPageJsonLd } from "@/components/StructuredData";

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({ key: "partners", path: "/partners" });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await loadMessages(locale);
  const label = messages?.breadcrumbs?.partners ?? "Partner Network";
  const description =
    messages?.meta?.partners?.description ??
    "Collaborate with Podacium as an educational institution, enterprise client, or technology provider.";
  const breadcrumbItems = [
    { name: "Podacium", url: "/" },
    { name: label, url: "/partners" },
  ];

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} inLanguage={locale} />
      <WebPageJsonLd
        name={label}
        description={description}
        url="/partners"
        inLanguage={locale}
        breadcrumbItems={breadcrumbItems}
      />
      {children}
    </>
  );
}
