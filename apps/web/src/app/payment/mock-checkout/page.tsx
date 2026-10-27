/**
 * Mock Checkout Page
 *
 * Simulates a payment gateway checkout for testing without real payments.
 * Used when PAYMENT_GATEWAY=mock or when testing the payment flow locally.
 */
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Check, X, Loader2, Shield, Building2 } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

function MockCheckoutContent() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const transactionId = searchParams.get("transaction_id");
  const amount = parseInt(searchParams.get("amount") || "0");
  const currency = searchParams.get("currency") || "DZD";
  const purpose = searchParams.get("purpose") || "DEPOSIT";

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"cib" | "edahabia">(
    "edahabia",
  );

  const handlePayment = async (success: boolean) => {
    setIsProcessing(true);

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (success) {
      // Simulate webhook call to backend (in real scenario, gateway would call this)
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/webhook/MOCK`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_type: "PAYMENT_PAID",
              gateway: "MOCK",
              payload: {
                transaction_id: parseInt(transactionId || "0"),
                status: "paid",
                amount: amount,
                currency: currency,
              },
              signature: "mock-signature",
            }),
          },
        );
      } catch (err) {
        console.error("Mock webhook failed (backend may not be running):", err);
      }

      router.push(`/payment/success?checkout_id=MOCK-${transactionId}`);
    } else {
      router.push(
        `/payment/failure?error=cancelled&message=Payment was cancelled by user`,
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center pt-24 pb-8 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex items-center gap-2 text-sm opacity-80 mb-1">
            <Shield className="w-4 h-4" />
            <span>{t("common.mockCheckout.securePayment")}</span>
          </div>
          <h1 className="text-xl font-bold">
            {t("common.mockCheckout.testCheckout")}
          </h1>
        </div>

        {/* Amount Display */}
        <div className="p-6 border-b border-gray-100 dark:border-slate-800">
          <div className="text-center">
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-1">
              {t("common.mockCheckout.amountToPay")}
            </p>
            <p className="text-4xl font-bold text-gray-900 dark:text-slate-100">
              {amount.toLocaleString()}{" "}
              <span className="text-2xl text-gray-500 dark:text-slate-400">
                {currency}
              </span>
            </p>
            <p className="text-sm text-gray-400 mt-2 capitalize">
              {purpose.replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-6 space-y-4">
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
            {t("common.mockCheckout.selectPaymentMethod")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedMethod("edahabia")}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedMethod === "edahabia"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <CreditCard className="w-8 h-8 text-yellow-600" />
                <span className="font-medium text-sm">
                  {t("common.mockCheckout.edahabia")}
                </span>
              </div>
            </button>

            <button
              onClick={() => setSelectedMethod("cib")}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedMethod === "cib"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-sm">
                  {t("common.mockCheckout.cibCard")}
                </span>
              </div>
            </button>
          </div>

          {/* Mock Card Input */}
          <div className="bg-gray-50 dark:bg-slate-900/60 rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">
                {t("common.mockCheckout.cardNumber")}
              </label>
              <input
                type="text"
                defaultValue="4242 4242 4242 4242"
                className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
                readOnly
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">
                  {t("common.mockCheckout.expiry")}
                </label>
                <input
                  type="text"
                  defaultValue="12/28"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
                  readOnly
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-slate-400 block mb-1">
                  {t("common.mockCheckout.cvv")}
                </label>
                <input
                  type="text"
                  defaultValue="123"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-gray-50 dark:bg-slate-900/60 space-y-3">
          <button
            onClick={() => handlePayment(true)}
            disabled={isProcessing}
            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t("common.mockCheckout.processing")}
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                {t("common.mockCheckout.simulateSuccess")}
              </>
            )}
          </button>

          <button
            onClick={() => handlePayment(false)}
            disabled={isProcessing}
            className="w-full py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-600 dark:text-slate-400 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            {t("common.mockCheckout.simulateFailed")}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-slate-800">
          <p>{t("common.mockCheckout.disclaimer")}</p>
          <p className="mt-1">
            {t("common.mockCheckout.transactionId", {
              id: transactionId || "",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MockCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      }
    >
      <MockCheckoutContent />
    </Suspense>
  );
}
