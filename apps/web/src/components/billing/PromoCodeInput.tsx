import React, { useState } from "react";
import { motion } from "framer-motion";
import { Tag, CheckCircle, XCircle, Loader2 } from "lucide-react";
import PodaciumInput from "../design-system/PodaciumInput";
import PodaciumButton from "../design-system/PodaciumButton";
import { useTranslations } from "../../lib/i18n";

interface PromoCodeResult {
  valid: boolean;
  code: string;
  original_amount?: number;
  discounted_amount?: number;
  discount_type?: string;
  discount_value?: number;
  description?: string | null;
}

interface PromoCodeInputProps {
  amount: number;
  onApply: (
    code: string,
    discountedAmount: number,
    originalAmount: number,
  ) => void;
  onRemove: () => void;
  locale?: string;
}

export default function PromoCodeInput({
  amount,
  onApply,
  onRemove,
}: PromoCodeInputProps) {
  const t = useTranslations();
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [result, setResult] = useState<PromoCodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const { default: api } = await import("../../lib/api");
      const response = await api.post<PromoCodeResult>(
        "/api/v1/billing/payments/validate-promo",
        {
          code: code.trim(),
          expected_amount: amount,
        },
      );

      if (response) {
        setAppliedCode(code.trim());
        setResult(response);
        onApply(
          code.trim(),
          response.discounted_amount || amount,
          response.original_amount || amount,
        );
      }
    } catch (err: any) {
      const detail =
        err?.detail || err?.message || t("billing.promocode.invalidCode");
      setError(
        typeof detail === "string"
          ? detail
          : detail?.message || t("billing.promocode.invalidCode"),
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode("");
    setAppliedCode(null);
    setResult(null);
    setError(null);
    onRemove();
  };

  if (appliedCode && result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800/80"
      >
        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 truncate">
            {appliedCode}
          </p>
          {result.description && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {result.description}
            </p>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="p-1 hover:bg-emerald-100 dark:bg-emerald-900/50 rounded-lg transition-colors"
        >
          <XCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <PodaciumInput
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
            placeholder={t("billing.promocode.placeholder")}
            leftIcon={<Tag className="w-4 h-4" />}
          />
        </div>
        <PodaciumButton
          variant="primary"
          size="sm"
          onClick={handleValidate}
          disabled={loading || !code.trim()}
          loading={loading}
        >
          {t("billing.promocode.apply")}
        </PodaciumButton>
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs font-bold text-red-500 dark:text-red-400 flex items-center gap-1"
        >
          <XCircle className="w-3 h-3" /> {error}
        </motion.p>
      )}
    </div>
  );
}
