"use client";

import React, { useState } from "react";
import { useTranslations } from "@/lib/i18n";

import PodaciumButton from "@/components/design-system/PodaciumButton";
import type { ButtonProps as DSButtonProps } from "@/components/design-system/PodaciumButton";
import PodaciumCard from "@/components/design-system/PodaciumCard";
import type { CardProps as DSCardProps } from "@/components/design-system/PodaciumCard";
import { PodaciumInput } from "@/components/design-system/PodaciumInput";
import type { InputProps as DSInputProps } from "@/components/design-system/PodaciumInput";

export type ButtonProps = DSButtonProps;
export const Button = PodaciumButton;

export type CardProps = DSCardProps;
export const Card = PodaciumCard;

export interface InputProps extends Omit<DSInputProps, "label"> {
  label: string;
  error?: string;
  tooltip?: string;
  showStrengthIndicator?: boolean;
  passwordValue?: string;
  showMatchIndicator?: boolean;
  comparisonValue?: string;
  showPasswordToggle?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  required,
  tooltip,
  className = "",
  id,
  showStrengthIndicator,
  passwordValue,
  showMatchIndicator,
  comparisonValue,
  showPasswordToggle,
  type: _type,
  ...props
}) => {
  const t = useTranslations("common");
  const [showTooltip, setShowTooltip] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = id || `input-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const isPassword = _type === "password";
  const inputType =
    isPassword && showPasswordToggle
      ? showPassword
        ? "text"
        : "password"
      : _type;

  const passwordToggleBtn =
    isPassword && showPasswordToggle ? (
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors focus:outline-none flex items-center justify-center"
        aria-label={
          showPassword ? t("common.hidePassword") : t("common.showPassword")
        }
        tabIndex={-1}
      >
        {showPassword ? (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        )}
      </button>
    ) : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={generatedId}
          className="block text-sm font-medium text-foreground"
        >
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("showTooltip")}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute z-10 w-64 p-2 text-sm text-foreground bg-background border border-border rounded-lg shadow-lg -top-2 start-6 rtl:start-auto rtl:end-6">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>
      <PodaciumInput
        id={generatedId}
        type={inputType as any}
        error={error}
        className={className}
        required={required}
        rightIcon={passwordToggleBtn || (props as any).rightIcon}
        {...(props as any)}
      />
      {isPassword && showStrengthIndicator && passwordValue !== undefined && (
        <PasswordStrengthIndicator password={passwordValue} />
      )}
      {isPassword && showMatchIndicator && comparisonValue !== undefined && (
        <PasswordMatchIndicator
          value={String(props.value || "")}
          comparisonValue={comparisonValue}
        />
      )}
    </div>
  );
};

export const PasswordStrengthIndicator: React.FC<{ password: string }> = ({
  password,
}) => {
  const { t } = useTranslations("passwordStrength");

  const requirements = [
    { label: t("requirements.length"), met: password.length >= 8 },
    { label: t("requirements.uppercase"), met: /[A-Z]/.test(password) },
    { label: t("requirements.lowercase"), met: /[a-z]/.test(password) },
    { label: t("requirements.digit"), met: /[0-9]/.test(password) },
    {
      label: t("requirements.special"),
      met: /[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]/.test(password),
    },
  ];

  const strengthScore = requirements.filter((req) => req.met).length;

  const getStrengthColor = () => {
    if (strengthScore <= 1) return "bg-destructive";
    if (strengthScore <= 2) return "bg-orange-500";
    if (strengthScore <= 3) return "bg-yellow-500";
    if (strengthScore <= 4) return "bg-primary";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    if (strengthScore === 0) return "";
    if (strengthScore <= 1) return t("veryWeak");
    if (strengthScore <= 2) return t("weak");
    if (strengthScore <= 3) return t("fair");
    if (strengthScore <= 4) return t("good");
    return t("strong");
  };

  if (!password) return null;

  return (
    <div className="space-y-3 mt-3 p-3 bg-secondary rounded-lg border border-border">
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground font-medium uppercase tracking-wider">
          {t("title")}
        </span>
        <span
          className={`font-bold ${strengthScore === 5 ? "text-green-600" : "text-foreground"}`}
        >
          {getStrengthLabel()}
        </span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-slate-800/90 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${getStrengthColor()}`}
          style={{ width: `${(strengthScore / 5) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {requirements.map((req, index) => (
          <div
            key={index}
            className="flex items-center text-[11px] transition-colors duration-200"
          >
            {req.met ? (
              <svg
                className="w-3.5 h-3.5 text-green-500 mr-2 rtl:ml-2 rtl:mr-0 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-input mr-2 rtl:ml-2 rtl:mr-0 flex-shrink-0" />
            )}
            <span
              className={
                req.met
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }
            >
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface CheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  required?: boolean;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  error,
  required = false,
  className = "",
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="flex items-start space-x-3 rtl:space-x-reverse cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-4 h-4 text-primary border-input rounded focus:ring-ring transition-colors group-hover:border-primary"
        />
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors select-none">
          {label} {required && <span className="text-destructive">*</span>}
        </span>
      </label>
      {error && (
        <p className="text-sm text-destructive flex items-center">{error}</p>
      )}
    </div>
  );
};

export const PasswordMatchIndicator: React.FC<{
  value: string;
  comparisonValue: string;
}> = ({ value, comparisonValue }) => {
  const { t } = useTranslations("passwordMatch");
  if (!value || !comparisonValue) return null;

  const isMatching = value === comparisonValue;

  return (
    <div className="flex items-center mt-2 px-3 py-1.5 rounded-md bg-secondary border border-border transition-all duration-300">
      {isMatching ? (
        <svg
          className="w-4 h-4 text-green-500 mr-2 rtl:ml-2 rtl:mr-0 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-destructive mr-2 rtl:ml-2 rtl:mr-0 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      <span
        className={`text-xs font-medium ${isMatching ? "text-green-700" : "text-destructive"}`}
      >
        {isMatching ? t("matching") : t("notMatching")}
      </span>
    </div>
  );
};
