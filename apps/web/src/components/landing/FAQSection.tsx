"use client";

import React, { useMemo } from "react";
import { useTranslations } from "@/lib/i18n";
import FAQAccordion, { normalizeFaqItems } from "@/components/FAQAccordion";

export const FAQSectionComponent: React.FC = React.memo(() => {
  const { t, raw } = useTranslations("home");

  const categories = useMemo(
    () => [
      { id: "general", label: t("faq.categories.general") },
      { id: "billing", label: t("faq.categories.billing") },
      { id: "technical", label: t("faq.categories.technical") },
      { id: "accounts", label: t("faq.categories.accounts") },
    ],
    [t],
  );

  const allItems = useMemo(() => {
    const rawQuestions = raw("faq.questions");
    return normalizeFaqItems(rawQuestions);
  }, [raw]);

  return (
    <FAQAccordion
      items={allItems}
      categories={categories}
      title={t("faq.title")}
      subtitle={t("faq.description")}
      multiOpen
      searchable
      allLabel={t("faq.categories.all")}
      cta={{
        title: t("faq.contact.title"),
        description: t("faq.contact.description"),
        buttonText: t("faq.contact.button"),
        buttonLink: "/contact",
      }}
    />
  );
});

FAQSectionComponent.displayName = "FAQSection";

export default FAQSectionComponent;
