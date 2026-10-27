import { apiClient } from "./client";
import {
  PaymentGateway,
  PaymentPurpose,
  SubscriptionPlan,
  SubscriptionStatus,
} from "./types";

// =============================================================================
// PAYMENT TYPES
// =============================================================================

export interface PaymentInitiateRequest {
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  gateway: PaymentGateway;
  success_url: string;
  failure_url: string;
  user_id?: number;
  organization_id?: number;
  contract_id?: number;
  subscription_id?: number;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  id: number;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  status: string;
  gateway: PaymentGateway;
  checkoutUrl?: string;
  providerReference?: string;
  createdAt: string;
}

export interface TransactionResponse {
  id: number;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  status: string;
  gateway?: PaymentGateway;
  createdAt: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface WalletResponse {
  id: number;
  userId?: number;
  organizationId?: number;
  podaPoints: number;
  currency: string;
  isActive: boolean;
  lastTopUpAt?: string;
  createdAt: string;
}

export interface WalletTransactionResponse {
  id: number;
  walletId: number;
  amount: number;
  previousBalance: number;
  newBalance: number;
  type: string;
  purpose: string;
  description?: string;
  createdAt: string;
}

export interface SubscriptionResponse {
  id: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  amount: number;
  billingCycle: string;
  currency: string;
  startedAt: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
}

export interface PodaPointsBalanceResponse {
  poda_points: number;
}

export interface PodaPointsPurchaseResponse {
  checkout_url: string;
  transaction_id: number;
  poda_points: number;
}

export interface FeatureSpendResponse {
  feature: string;
  price: number;
  remaining_balance: number;
  purchase_id?: number;
  quantity?: number;
  /** Ledger row that recorded the debit; the grant is keyed to this id. */
  wallet_transaction_id?: number;
  transaction_id?: number;
}

export interface AdminWalletSummaryResponse {
  currency: string;
  wallet_count: number;
  total_poda_points: number;
  held_in_escrow_points: number;
  pending_payouts_points: number;
  pending_payout_count: number;
  available_poda_points: number;
}

export interface FeatureListing {
  key: string;
  price: number;
  type?: string;
}

export interface ActiveFeature {
  type: string;
  feature_key?: string;
  reference_id?: string;
  label?: string;
  expires_at?: string | null;
}

export interface CheckProjectPostResponse {
  allowed: boolean;
  source?: string;
  remaining?: number;
}

// =============================================================================
// PAYMENTS API METHODS
// =============================================================================

export const paymentsApi = {
  // Payments
  initiatePayment(data: PaymentInitiateRequest) {
    return apiClient.post<PaymentResponse>("/api/payments/initiate", data);
  },

  getPayment(transactionId: number) {
    return apiClient.get<PaymentResponse>(`/api/payments/${transactionId}`);
  },

  getTransactions(params?: {
    page?: number;
    limit?: number;
    purpose?: string;
  }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              (typeof v !== "string" || (v !== "undefined" && v !== "null")),
          ),
        )
      : {};
    const query = cleanParams
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(cleanParams).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<TransactionResponse[]>(
      `/api/v1/payments/user/transactions${query}`,
    );
  },

  createCheckout(data: any) {
    return apiClient.post<{ checkout_url: string }>(
      "/api/payments/create-checkout",
      data,
    );
  },

  // Wallet / PodaPoints
  getWallet() {
    return apiClient.get<WalletResponse>("/api/v1/wallets/me");
  },

  getPodaPointsBalance() {
    return apiClient.get<PodaPointsBalanceResponse>(
      "/api/v1/wallets/me/balance",
    );
  },

  getWalletTransactions(params?: { page?: number; limit?: number }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([, v]) =>
              v !== undefined &&
              v !== null &&
              !(
                typeof v === "string" &&
                (v === "" || v === "undefined" || v === "null")
              ),
          ),
        )
      : {};
    const query = cleanParams
      ? "?" +
        new URLSearchParams(
          Object.fromEntries(
            Object.entries(cleanParams).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : "";
    return apiClient.get<WalletTransactionResponse[]>(
      `/api/v1/wallets/me/transactions${query}`,
    );
  },

  purchasePodaPoints(amount: number) {
    return apiClient.post<PodaPointsPurchaseResponse>(
      "/api/v1/wallets/poda-points/purchase",
      { amount },
    );
  },

  spendPoints(featureKey: string, referenceId?: string) {
    return apiClient.post<FeatureSpendResponse>(
      "/api/v1/wallets/poda-points/spend",
      {
        feature_key: featureKey,
        reference_id: referenceId,
      },
    );
  },

  // Admin wallet oversight (RBAC: finance:wallets:read)
  getAdminWalletSummary() {
    return apiClient.get<AdminWalletSummaryResponse>(
      "/api/v1/wallets/admin/summary",
    );
  },

  // Features
  getFeatures() {
    return apiClient.get<{ features: FeatureListing[] }>("/api/v1/features");
  },

  purchaseFeature(featureKey: string, referenceId?: string, quantity?: number) {
    return apiClient.post<FeatureSpendResponse>("/api/v1/features/purchase", {
      feature_key: featureKey,
      reference_id: referenceId,
      quantity: quantity || 1,
    });
  },

  checkProjectPost() {
    return apiClient.get<CheckProjectPostResponse>(
      "/api/v1/features/check/project-post",
    );
  },

  getActiveFeatures() {
    return apiClient.get<{ active_features: ActiveFeature[] }>(
      "/api/v1/features/my-purchases",
    );
  },

  // Subscriptions
  getSubscriptions() {
    return apiClient.get<SubscriptionResponse[]>(
      "/api/v1/billing/subscriptions/my",
    );
  },

  getBillingOverview() {
    return apiClient.get<any>("/api/v1/billing/subscriptions/overview");
  },

  getPlans() {
    return apiClient.get<any[]>("/api/v1/billing/subscriptions/plans");
  },

  cancelSubscription(subscriptionId: number) {
    return apiClient.post<void>("/api/v1/billing/subscriptions/cancel", {
      subscription_id: subscriptionId,
      immediate: false,
    });
  },

  changePlan(plan: string, billing_cycle?: string) {
    return apiClient.post<any>("/api/v1/billing/subscriptions/change-plan", {
      new_plan: plan,
      billing_cycle,
    });
  },

  // Invoices
  async downloadInvoice(transactionId: number): Promise<string | null> {
    try {
      const res = await apiClient.get<{ url: string }>(
        `/api/v1/billing/payments/invoices/${transactionId}/download`,
      );
      return res?.url || null;
    } catch {
      return null;
    }
  },

  // Refund info
  getRefundInfo(transactionId: number) {
    return apiClient.get<{
      eligible: boolean;
      reason: string | null;
      pro_rata_max_amount: number;
      pro_rata_method: string;
      original_amount: number;
      currency: string;
      purpose: string;
      has_existing_refund: boolean;
      existing_refund_status: string | null;
      refunds_this_month: number;
      max_refunds_per_month: number;
      window_days: number;
      created_at: string | null;
      time_remaining_days: number;
    }>(`/api/payments/${transactionId}/refund-info`);
  },

  // Refunds
  requestRefund(transactionId: number, reason: string, amount?: number) {
    const params = new URLSearchParams();
    params.append("reason", reason);
    if (amount !== undefined) {
      params.append("amount", amount.toString());
    }
    return apiClient.post<{
      status: string;
      refund_id: number;
      original_transaction_id: number;
      refund_amount: number;
      pro_rata_max_amount: number;
      is_partial: boolean;
    }>(`/api/payments/${transactionId}/refund?${params.toString()}`);
  },

  cancelPayment(transactionId: number) {
    return apiClient.post<{ status: string; transaction_id: number }>(
      `/api/payments/${transactionId}/cancel`,
    );
  },
};
