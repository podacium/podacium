"use client";

import React, { useState } from "react";
import { useTranslations, useLocale } from "@/lib/i18n";
import { PodaciumCheckbox } from "@/components/design-system";
import { PodaciumCard } from "@/components/design-system/PodaciumCard";
import { PodaciumButton } from "@/components/design-system/PodaciumButton";
import { PodaciumTabs } from "@/components/design-system/PodaciumTabs";

const tabs = [
  { id: "basic", label: "Basic" },
  { id: "states", label: "States" },
  { id: "variants", label: "Variants" },
  { id: "sizes", label: "Sizes" },
  { id: "rtl", label: "RTL" },
] as const satisfies Array<{ id: string; label: string }>;

export default function PodaciumCheckboxDemo() {
  const t = useTranslations("component.checkbox");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [checked, setChecked] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);
  const [disabledChecked, setDisabledChecked] = useState(true);
  const [errorChecked, setErrorChecked] = useState(false);
  const [error, setError] = useState("");
  const [variant, setVariant] = useState<"default" | "outline" | "soft">(
    "default",
  );
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");
  const [labelPosition, setLabelPosition] = useState<"left" | "right">("right");
  const [activeTab, setActiveTab] = useState("basic");

  const handleErrorChange = (value: boolean) => {
    setErrorChecked(value);
    if (value) {
      setError("");
    } else {
      setError(t("errorRequired"));
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("demoTitle")}</h2>
        <p className="text-muted-foreground mt-2">{t("demoDescription")}</p>
      </div>

      <PodaciumTabs
        tabs={tabs}
        defaultTab="basic"
        onChange={setActiveTab}
        className="w-full"
      >
        {(activeTab) => {
          if (activeTab === "basic") {
            return (
              <div className="space-y-6 p-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t("basicCheckboxes")}
                  </h3>
                  <div className="space-y-3">
                    <PodaciumCheckbox
                      label={t("acceptTerms")}
                      checked={checked}
                      onCheckedChange={setChecked}
                    />
                    <PodaciumCheckbox
                      label={t("subscribeNewsletter")}
                      description={t("newsletterDescription")}
                      checked={checked}
                      onCheckedChange={setChecked}
                    />
                    <PodaciumCheckbox
                      label={t("enableNotifications")}
                      description={t("notificationsDescription")}
                      checked={!checked}
                      onCheckedChange={setChecked}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t("labelPositions")}
                  </h3>
                  <div className="space-y-3">
                    <PodaciumCheckbox
                      label={t("labelRight")}
                      labelPosition="right"
                      checked={checked}
                      onCheckedChange={setChecked}
                    />
                    <PodaciumCheckbox
                      label={t("labelLeft")}
                      labelPosition="left"
                      checked={checked}
                      onCheckedChange={setChecked}
                    />
                  </div>
                </div>
              </div>
            );
          }

          if (activeTab === "states") {
            return (
              <div className="space-y-6 p-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t("interactiveStates")}
                  </h3>
                  <div className="space-y-3">
                    <PodaciumCheckbox
                      label={t("unchecked")}
                      checked={false}
                      onCheckedChange={setChecked}
                    />
                    <PodaciumCheckbox
                      label={t("checked")}
                      checked={true}
                      onCheckedChange={setChecked}
                    />
                    <PodaciumCheckbox
                      label={t("indeterminate")}
                      indeterminate={true}
                      onCheckedChange={setChecked}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    {t("disabledState")}
                  </h3>
                  <div className="space-y-3">
                    <PodaciumCheckbox
                      label={t("disabledUnchecked")}
                      disabled
                      checked={false}
                    />
                    <PodaciumCheckbox
                      label={t("disabledChecked")}
                      disabled
                      checked={true}
                    />
                    <PodaciumCheckbox
                      label={t("disabledIndeterminate")}
                      disabled
                      indeterminate
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t("errorState")}</h3>
                  <PodaciumCheckbox
                    label={t("requiredField")}
                    required
                    checked={errorChecked}
                    onCheckedChange={handleErrorChange}
                    error={error}
                  />
                </div>
              </div>
            );
          }

          if (activeTab === "variants") {
            return (
              <div className="space-y-6 p-4">
                <h3 className="text-lg font-semibold">
                  {t("variantExamples")}
                </h3>
                <div className="space-y-3">
                  {(["default", "outline", "soft"] as const).map((v) => (
                    <div
                      key={v}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <PodaciumCheckbox
                        label={t(
                          `variant${v.charAt(0).toUpperCase() + v.slice(1)}`,
                        )}
                        variant={v}
                        checked={variant === v}
                        onCheckedChange={() => setVariant(v)}
                      />
                      <PodaciumCheckbox
                        label={t("checked")}
                        variant={v}
                        checked
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (activeTab === "sizes") {
            return (
              <div className="space-y-6 p-4">
                <h3 className="text-lg font-semibold">{t("sizeExamples")}</h3>
                <div className="space-y-4">
                  {(["sm", "md", "lg"] as const).map((s) => (
                    <div key={s} className="flex items-center gap-4">
                      <PodaciumCheckbox
                        label={t(`size${s.toUpperCase()}`)}
                        size={s}
                        checked={size === s}
                        onCheckedChange={() => setSize(s)}
                      />
                      <PodaciumCheckbox label={t("checked")} size={s} checked />
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (activeTab === "rtl") {
            return (
              <div className="space-y-6 p-4">
                <h3 className="text-lg font-semibold">{t("rtlSupport")}</h3>
                <p className="text-muted-foreground">
                  {isRTL
                    ? t("rtlActive")
                    : t("rtlInactive", { currentLocale: locale.toUpperCase() })}
                </p>
                <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
                  <PodaciumCheckbox
                    label={t("rtlLabel")}
                    checked={checked}
                    onCheckedChange={setChecked}
                  />
                  <PodaciumCheckbox
                    label={t("rtlLabelWithDesc")}
                    description={t("rtlDescription")}
                    checked={checked}
                    onCheckedChange={setChecked}
                  />
                  <PodaciumCheckbox
                    label={t("rtlLabelLeft")}
                    labelPosition="left"
                    checked={checked}
                    onCheckedChange={setChecked}
                  />
                </div>
              </div>
            );
          }

          return null;
        }}
      </PodaciumTabs>

      <PodaciumCard variant="outline" className="p-4">
        <h3 className="text-lg font-semibold mb-4">{t("formExample")}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert(t("formSubmitted"));
          }}
          className="space-y-4"
        >
          <PodaciumCheckbox
            label={t("formAcceptTerms")}
            required
            checked={checked}
            onCheckedChange={setChecked}
            error={!checked ? t("formTermsRequired") : undefined}
          />
          <PodaciumCheckbox
            label={t("formSubscribe")}
            description={t("formSubscribeDesc")}
            checked={checked}
            onCheckedChange={setChecked}
          />
          <PodaciumCheckbox
            label={t("formEnableUpdates")}
            checked={checked}
            onCheckedChange={setChecked}
          />
          <PodaciumButton type="submit" className="w-full">
            {t("formSubmit")}
          </PodaciumButton>
        </form>
      </PodaciumCard>
    </div>
  );
}
