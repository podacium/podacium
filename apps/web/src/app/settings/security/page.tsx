"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useBidi } from "@/lib/i18n";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Shield,
  Smartphone,
  Mail,
  Key,
  Lock,
  ChevronRight,
  Home,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Copy,
  Download,
  Loader2,
  Eye,
  EyeOff,
  QrCode,
  Info,
} from "lucide-react";
import { authApi } from "@/lib/api/auth";
import api from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import {
  SectionCard,
  StatCard,
  EmptyState,
  LoadingState,
} from "@/components/SectionComponents";
import PodaciumButton from "@/components/design-system/PodaciumButton";
import PodaciumBadge from "@/components/design-system/PodaciumBadge";
import PodaciumModal from "@/components/design-system/PodaciumModal";
import { PodaciumOTPInput } from "@/components/design-system/PodaciumOTPInput";

type MfaMethod = { method: string; enabled: boolean; label: string };

export default function SecuritySettingsPage() {
  const { t } = useTranslations("settings-security");
  const tCommon = useTranslations("common");
  const { dir } = useBidi();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<MfaMethod[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // TOTP state
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpSetupMode, setTotpSetupMode] = useState(false);
  const [showTotpSecret, setShowTotpSecret] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Generate QR code client-side (no third-party leak)
  useEffect(() => {
    if (!totpUri) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(totpUri, {
      width: 200,
      margin: 2,
      color: { dark: "#1e3a5f" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [totpUri]);

  // Email OTP state
  const [emailCode, setEmailCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSetupMode, setEmailSetupMode] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);

  // WebAuthn state
  const [webauthnBusy, setWebauthnBusy] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(true);

  // Backup codes state
  const [backupRemaining, setBackupRemaining] = useState(0);
  const [backupBusy, setBackupBusy] = useState(false);

  // Disable modal
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableBusy, setDisableBusy] = useState(false);

  // General Security Preferences state
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [deviceManagement, setDeviceManagement] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30m");
  const [savingSecPrefs, setSavingSecPrefs] = useState(false);

  // Regenerate confirmation modal
  const [showRegenModal, setShowRegenModal] = useState(false);

  // Platform authenticator and mobile QR modal
  const [hasPlatformAuth, setHasPlatformAuth] = useState<boolean | null>(null);
  const [showMobilePasskeyModal, setShowMobilePasskeyModal] = useState(false);
  const [mobilePageQr, setMobilePageQr] = useState<string>("");

  const fetchStatus = useCallback(async () => {
    try {
      const status = await authApi.getMfaStatus();
      setMfaEnabled(status.enabled);
      setMethods(status.methods || []);
    } catch {}
    try {
      const bc = await authApi.getBackupCodes();
      setBackupRemaining(bc.remaining);
    } catch {}
    try {
      const secRes: any = await api.get("/api/v1/settings/security");
      if (secRes) {
        if (typeof secRes.login_alerts === "boolean")
          setLoginAlerts(secRes.login_alerts);
        if (typeof secRes.device_management === "boolean")
          setDeviceManagement(secRes.device_management);
        if (secRes.session_timeout) setSessionTimeout(secRes.session_timeout);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Check WebAuthn browser and platform authenticator support
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.PublicKeyCredential) {
        setWebauthnSupported(true);
        if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            .then((available) => setHasPlatformAuth(available))
            .catch(() => setHasPlatformAuth(false));
        } else {
          setHasPlatformAuth(false);
        }
      } else {
        setWebauthnSupported(false);
        setHasPlatformAuth(false);
      }
      const url = window.location.href;
      QRCode.toDataURL(url, { width: 220, margin: 2 })
        .then(setMobilePageQr)
        .catch(() => {});
    }
  }, []);

  // ─── TOTP Handlers ─────────────────────────────────────────────────────
  const handleTotpSetup = async () => {
    setTotpBusy(true);
    try {
      const res = await authApi.setupTotp();
      setTotpSecret(res.secret);
      setTotpUri(res.provisioning_uri);
      setTotpSetupMode(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        toast.error(t("settings-security.toast.invalidCode"));
      } else {
        toast.error(t("settings-security.errors.generic"));
      }
    } finally {
      setTotpBusy(false);
    }
  };

  const handleTotpVerify = async () => {
    if (!totpCode) {
      toast.error(t("settings-security.errors.codeRequired"));
      return;
    }
    setTotpBusy(true);
    try {
      const res = await authApi.verifyTotp(totpCode, totpSecret);
      toast.success(t("settings-security.page.totp.success"));
      if (res.backup_codes?.length) {
        setBackupCodes(res.backup_codes);
        setShowBackupCodes(true);
      }
      setTotpSetupMode(false);
      setTotpCode("");
      fetchStatus();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        toast.error(t("settings-security.toast.invalidCode"));
      } else {
        toast.error(t("settings-security.errors.generic"));
      }
    } finally {
      setTotpBusy(false);
    }
  };

  // ─── Email OTP Handlers ────────────────────────────────────────────────
  const handleEmailSend = async () => {
    setEmailBusy(true);
    try {
      await authApi.sendEmailOtp();
      toast.success(t("settings-security.toast.emailOtpSent"));
      setEmailCodeSent(true);
    } catch (e: any) {
      if (e instanceof ApiError) {
        toast.error(e.message || t("settings-security.errors.generic"));
      } else {
        toast.error(t("settings-security.errors.generic"));
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleEmailVerify = async () => {
    if (!emailCode) {
      toast.error(t("settings-security.errors.codeRequired"));
      return;
    }
    setEmailBusy(true);
    try {
      const res = await authApi.verifyEmailOtp(emailCode);
      toast.success(t("settings-security.page.email.success"));
      if (res.backup_codes?.length) {
        setBackupCodes(res.backup_codes);
        setShowBackupCodes(true);
      }
      setEmailSetupMode(false);
      setEmailCode("");
      setEmailCodeSent(false);
      fetchStatus();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        toast.error(t("settings-security.toast.invalidCode"));
      } else {
        toast.error(t("settings-security.errors.generic"));
      }
    } finally {
      setEmailBusy(false);
    }
  };

  // ─── WebAuthn Handlers ─────────────────────────────────────────────────
  const handleWebAuthnRegister = async () => {
    if (!webauthnSupported) {
      toast.error(t("settings-security.page.webauthn.notSupported"));
      return;
    }
    setWebauthnBusy(true);
    try {
      const begin = await authApi.webauthnRegisterBegin();
      if (!begin?.options) throw new Error("No options returned");

      const base64urlToBuffer = (base64url: string): ArrayBuffer => {
        const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
        const pad = base64.length % 4;
        const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      };

      const rawOptions = begin.options;
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        ...rawOptions,
        challenge:
          typeof rawOptions.challenge === "string"
            ? base64urlToBuffer(rawOptions.challenge)
            : rawOptions.challenge,
        user: {
          ...rawOptions.user,
          id:
            typeof rawOptions.user?.id === "string"
              ? base64urlToBuffer(rawOptions.user.id)
              : rawOptions.user?.id,
        },
        excludeCredentials: rawOptions.excludeCredentials?.map((cred: any) => ({
          ...cred,
          id:
            typeof cred.id === "string" ? base64urlToBuffer(cred.id) : cred.id,
        })),
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      });
      if (!credential) throw new Error("Registration cancelled");

      const cred = credential as any;
      const bufToBase64url = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++)
          binary += String.fromCharCode(bytes[i]);
        return btoa(binary)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      };

      const response = {
        id: cred.id,
        rawId: bufToBase64url(cred.rawId),
        type: cred.type,
        response: {
          clientDataJSON: bufToBase64url(cred.response.clientDataJSON),
          attestationObject: bufToBase64url(cred.response.attestationObject),
          transports: cred.response.getTransports?.() || [],
        },
      };
      await authApi.webauthnRegisterComplete(response);
      toast.success(t("settings-security.page.webauthn.success"));
      fetchStatus();
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "AbortError") {
        toast.error(t("settings-security.page.webauthn.cancelled"));
      } else if (
        e?.message?.includes("Not supported") ||
        e?.message?.includes("not a secure context")
      ) {
        toast.error(t("settings-security.page.webauthn.notSupported"));
      } else if (e instanceof ApiError) {
        toast.error(e.message || t("settings-security.toast.passkeyFailed"));
      } else {
        toast.error(t("settings-security.toast.passkeyFailed"));
      }
    } finally {
      setWebauthnBusy(false);
    }
  };

  // ─── Backup Codes Handlers ─────────────────────────────────────────────
  const handleRegenerateBackupCodes = async () => {
    setShowRegenModal(true);
  };

  const handleConfirmRegenBackupCodes = async () => {
    setShowRegenModal(false);
    setBackupBusy(true);
    try {
      const res = await authApi.regenerateBackupCodes();
      setBackupCodes(res.codes);
      setShowBackupCodes(true);
      toast.success(t("settings-security.toast.backupCodesGenerated"));
      fetchStatus();
    } catch {
      toast.error(t("settings-security.errors.generic"));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success(t("settings-security.toast.backupCodesCopied"));
  };

  const handleDownloadCodes = () => {
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "podacium-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Save Security Preferences ─────────────────────────
  const handleSaveSecPrefs = async (
    newAlerts?: boolean,
    newDevices?: boolean,
    newTimeout?: string,
  ) => {
    const alerts = newAlerts ?? loginAlerts;
    const devices = newDevices ?? deviceManagement;
    const timeout = newTimeout ?? sessionTimeout;
    setSavingSecPrefs(true);
    try {
      await api.put("/api/v1/settings/security", {
        login_alerts: alerts,
        device_management: devices,
        session_timeout: timeout,
      });
      toast.success(t("settings-security.page.securityPrefsSaved"));
    } catch {
      toast.error(t("settings-security.errors.generic"));
    } finally {
      setSavingSecPrefs(false);
    }
  };

  // ─── Disable MFA ───────────────────────────────────────────────────────
  const handleDisableMfa = async () => {
    if (!disablePassword) return;
    setDisableBusy(true);
    try {
      await authApi.disableMfa(disablePassword);
      toast.success(t("settings-security.toast.disabled"));
      setShowDisableModal(false);
      setDisablePassword("");
      fetchStatus();
    } catch {
      toast.error(t("settings-security.errors.invalidPassword"));
    } finally {
      setDisableBusy(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
        dir={dir}
      >
        <main className="pb-16 px-4">
          <LoadingState />
        </main>
      </div>
    );
  }

  const isTotpEnabled = methods.some((m) => m.method === "totp" && m.enabled);
  const isEmailEnabled = methods.some((m) => m.method === "email" && m.enabled);
  const isWebAuthnEnabled = methods.some(
    (m) => m.method === "webauthn" && m.enabled,
  );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      dir={dir}
    >
      <div className="pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span>{t("settings-security.page.home")}</span>
          </Link>
          <ChevronRight
            className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <Link
            href="/settings"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t("settings-security.page.settings")}
          </Link>
          <ChevronRight
            className={`w-4 h-4 ${dir === "rtl" ? "rotate-180" : ""}`}
          />
          <span className="text-gray-900 dark:text-slate-100 font-medium">
            {t("settings-security.page.title")}
          </span>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            {t("settings-security.page.title")}
          </h1>
          <p className="text-base text-gray-500 dark:text-slate-400 mt-1">
            {t("settings-security.page.subtitle")}
          </p>
        </motion.div>

        {/* MFA Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-8 p-5 rounded-2xl border flex items-start gap-4 ${
            mfaEnabled
              ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/80"
              : "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/80"
          }`}
        >
          <div
            className={`p-2 rounded-xl ${mfaEnabled ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-amber-100 dark:bg-amber-900/50"}`}
          >
            {mfaEnabled ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h3
              className={`font-semibold ${mfaEnabled ? "text-emerald-800 dark:text-emerald-200" : "text-amber-800 dark:text-amber-200"}`}
            >
              {mfaEnabled
                ? t("settings-security.page.statusEnabled")
                : t("settings-security.page.statusDisabled")}
            </h3>
            <p
              className={`text-sm mt-0.5 ${mfaEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
            >
              {mfaEnabled
                ? `${methods.length} ${t("settings-security.page.activeMethods")}`
                : t("settings-security.page.mfaDesc")}
            </p>
          </div>
        </motion.div>

        {/* MFA Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* TOTP Card */}
          <SectionCard
            title={t("settings-security.page.totp.title")}
            icon={
              <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            }
          >
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {t("settings-security.page.totp.desc")}
            </p>
            {isTotpEnabled ? (
              <div className="space-y-3">
                <PodaciumBadge variant="success">
                  {t("settings-security.page.totp.enabled")}
                </PodaciumBadge>
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisableModal(true)}
                  className="flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {t("settings-security.page.totp.disable")}
                </PodaciumButton>
              </div>
            ) : totpSetupMode ? (
              <div className="space-y-4">
                {totpUri && (
                  <div className="flex justify-center">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={t("settings-security.page.totp.qrCodeAlt")}
                        className="w-48 h-48"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                )}
                {totpSecret && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowTotpSecret((p) => !p)}
                      className="w-full flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white dark:text-slate-400 transition-colors py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    >
                      {showTotpSecret ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      {showTotpSecret
                        ? t("settings-security.page.totp.hideKey")
                        : t("settings-security.page.totp.revealKey")}
                    </button>
                    {showTotpSecret && (
                      <p
                        className="text-xs text-gray-400 text-center break-all font-mono bg-gray-50 dark:bg-slate-900/60 p-2 rounded-lg"
                        onClick={() => {
                          navigator.clipboard.writeText(totpSecret);
                          toast.success(
                            t("settings-security.page.totp.copied"),
                          );
                        }}
                        title={t("settings-security.page.totp.clickToCopy")}
                      >
                        {t("settings-security.page.totp.orEnterKey")}{" "}
                        {totpSecret}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <PodaciumOTPInput
                    value={totpCode}
                    onChange={setTotpCode}
                    disabled={totpBusy}
                    aria-label={t(
                      "settings-security.page.totp.codePlaceholder",
                    )}
                  />
                  <PodaciumButton
                    onClick={handleTotpVerify}
                    disabled={totpBusy || totpCode.length < 6}
                    className="flex items-center gap-1.5"
                  >
                    {totpBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {t("settings-security.page.totp.verify")}
                  </PodaciumButton>
                </div>
              </div>
            ) : (
              <PodaciumButton
                onClick={handleTotpSetup}
                disabled={totpBusy}
                className="flex items-center gap-1.5"
              >
                {totpBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {t("settings-security.page.totp.setup")}
              </PodaciumButton>
            )}
          </SectionCard>

          {/* Email OTP Card */}
          <SectionCard
            title={t("settings-security.page.email.title")}
            icon={<Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          >
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {t("settings-security.page.email.desc")}
            </p>
            {isEmailEnabled ? (
              <div className="space-y-3">
                <PodaciumBadge variant="success">
                  {t("settings-security.page.email.enabled")}
                </PodaciumBadge>
              </div>
            ) : emailSetupMode ? (
              <div className="space-y-3">
                {emailCodeSent ? (
                  <>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {t("settings-security.page.email.codeSent")}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <PodaciumOTPInput
                        value={emailCode}
                        onChange={setEmailCode}
                        disabled={emailBusy}
                        aria-label={t("settings-security.page.email.enterCode")}
                      />
                      <PodaciumButton
                        onClick={handleEmailVerify}
                        disabled={emailBusy || emailCode.length < 6}
                        className="flex items-center gap-1.5"
                      >
                        {emailBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {t("settings-security.page.email.verify")}
                      </PodaciumButton>
                    </div>
                  </>
                ) : (
                  <PodaciumButton
                    onClick={handleEmailSend}
                    disabled={emailBusy}
                    className="flex items-center gap-1.5"
                  >
                    {emailBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    {t("settings-security.page.email.sendCode")}
                  </PodaciumButton>
                )}
              </div>
            ) : (
              <PodaciumButton
                onClick={() => setEmailSetupMode(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {t("settings-security.page.email.setup")}
              </PodaciumButton>
            )}
          </SectionCard>

          {/* WebAuthn / Passkey Card */}
          <SectionCard
            title={t("settings-security.page.webauthn.title")}
            icon={<Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          >
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">
              {t("settings-security.page.webauthn.desc")}
            </p>

            {hasPlatformAuth === false && !isWebAuthnEnabled && (
              <div className="mb-4 p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl space-y-2">
                <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {t("settings-security.page.webauthn.noPlatformBiometrics")}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <PodaciumButton
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMobilePasskeyModal(true)}
                    className="flex items-center gap-1.5 text-xs py-1 h-auto"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {t("settings-security.page.webauthn.openOnMobile")}
                  </PodaciumButton>
                </div>
              </div>
            )}

            {!webauthnSupported ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t("settings-security.page.webauthn.notSupported")}
              </p>
            ) : isWebAuthnEnabled ? (
              <div className="space-y-3">
                <PodaciumBadge variant="success">
                  {t("settings-security.page.webauthn.enabled")}
                </PodaciumBadge>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <PodaciumButton
                  onClick={handleWebAuthnRegister}
                  disabled={webauthnBusy}
                  className="flex items-center gap-1.5"
                >
                  {webauthnBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t("settings-security.page.webauthn.setup")}
                </PodaciumButton>
                <PodaciumButton
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMobilePasskeyModal(true)}
                  className="flex items-center gap-1.5"
                >
                  <Smartphone className="w-4 h-4" />
                  {t("settings-security.page.webauthn.openOnMobile")}
                </PodaciumButton>
              </div>
            )}
          </SectionCard>

          {/* Backup Codes Card */}
          <SectionCard
            title={t("settings-security.page.backupCodes.title")}
            icon={<Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
          >
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {t("settings-security.page.backupCodes.desc")}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                {t("settings-security.page.backupCodes.remaining", {
                  count: String(backupRemaining),
                })}
              </span>
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={handleRegenerateBackupCodes}
                disabled={backupBusy}
                className="flex items-center gap-1.5"
              >
                {backupBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5" />
                )}
                {backupRemaining > 0
                  ? t("settings-security.page.backupCodes.regenerate")
                  : t("settings-security.page.backupCodes.generate")}
              </PodaciumButton>
            </div>
          </SectionCard>

          {/* General Security Preferences Card */}
          <SectionCard
            title={t("settings-security.page.generalPrefs.title")}
            icon={
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            }
          >
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              {t("settings-security.page.generalPrefs.desc")}
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {t("settings-security.page.generalPrefs.loginAlerts")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("settings-security.page.generalPrefs.loginAlertsDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={loginAlerts}
                  onChange={(e) => {
                    setLoginAlerts(e.target.checked);
                    handleSaveSecPrefs(e.target.checked, undefined, undefined);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {t("settings-security.page.generalPrefs.deviceMgmt")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t("settings-security.page.generalPrefs.deviceMgmtDesc")}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={deviceManagement}
                  onChange={(e) => {
                    setDeviceManagement(e.target.checked);
                    handleSaveSecPrefs(undefined, e.target.checked, undefined);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                <label className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  {t("settings-security.page.generalPrefs.sessionTimeout")}
                </label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => {
                    setSessionTimeout(e.target.value);
                    handleSaveSecPrefs(undefined, undefined, e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30 outline-none"
                >
                  <option value="15m">{tCommon("uiLabels.min15")}</option>
                  <option value="30m">{tCommon("uiLabels.min30")}</option>
                  <option value="1h">{tCommon("uiLabels.hour1")}</option>
                  <option value="8h">{tCommon("uiLabels.hours8")}</option>
                  <option value="24h">{tCommon("uiLabels.hours24")}</option>
                </select>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Backup Codes Display Modal */}
        <PodaciumModal
          isOpen={showBackupCodes}
          onClose={() => setShowBackupCodes(false)}
          title={t("settings-security.page.backupCodes.title")}
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{t("settings-security.page.backupCodes.saveWarning")}</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {backupCodes.map((code, i) => (
                <div
                  key={i}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-slate-900/60 rounded-lg text-center font-mono text-lg tracking-widest border border-gray-200 dark:border-slate-800"
                >
                  {code}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={handleCopyCodes}
                className="flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {t("settings-security.page.backupCodes.copy")}
              </PodaciumButton>
              <PodaciumButton
                variant="outline"
                size="sm"
                onClick={handleDownloadCodes}
                className="flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {t("settings-security.page.backupCodes.download")}
              </PodaciumButton>
              <PodaciumButton
                size="sm"
                onClick={() => setShowBackupCodes(false)}
              >
                {t("settings-security.page.disable.cancel")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>

        {/* Disable MFA Modal */}
        <PodaciumModal
          isOpen={showDisableModal}
          onClose={() => setShowDisableModal(false)}
          title={t("settings-security.page.disable.title")}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/60 rounded-xl text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{t("settings-security.page.disable.confirm")}</span>
            </div>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder={t(
                "settings-security.page.disable.passwordPlaceholder",
              )}
              aria-label={t(
                "settings-security.page.disable.passwordPlaceholder",
              )}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-red-500/20 outline-none"
            />
            <div className="flex justify-end gap-2">
              <PodaciumButton
                variant="outline"
                onClick={() => setShowDisableModal(false)}
              >
                {t("settings-security.page.disable.cancel")}
              </PodaciumButton>
              <PodaciumButton
                variant="destructive"
                onClick={handleDisableMfa}
                disabled={disableBusy || !disablePassword}
                className="flex items-center gap-1.5"
              >
                {disableBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {t("settings-security.page.disable.submit")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>

        {/* Regenerate Backup Codes Confirmation Modal */}
        <PodaciumModal
          isOpen={showRegenModal}
          onClose={() => setShowRegenModal(false)}
          title={t("settings-security.page.backupCodes.title")}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>
                {t("settings-security.page.backupCodes.regenerateConfirm")}
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <PodaciumButton
                variant="outline"
                onClick={() => setShowRegenModal(false)}
              >
                {t("settings-security.page.disable.cancel")}
              </PodaciumButton>
              <PodaciumButton
                variant="destructive"
                onClick={handleConfirmRegenBackupCodes}
                disabled={backupBusy}
                className="flex items-center gap-1.5"
              >
                {backupBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                {t("settings-security.page.backupCodes.regenerate")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>

        {/* Mobile Setup Quick QR Modal */}
        <PodaciumModal
          isOpen={showMobilePasskeyModal}
          onClose={() => setShowMobilePasskeyModal(false)}
          title={t("settings-security.page.webauthn.openOnMobile")}
          size="sm"
        >
          <div className="space-y-4 text-center">
            <p className="text-xs text-gray-600 dark:text-slate-300 text-start">
              {t("settings-security.page.webauthn.mobileQrPrompt")}
            </p>
            {mobilePageQr ? (
              <div className="flex justify-center p-3 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <img
                  src={mobilePageQr}
                  alt={t("settings-security.page.totp.qrCodeAlt")}
                  className="w-48 h-48 rounded-xl"
                />
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            )}
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-800/40 text-start">
              {t("settings-security.page.webauthn.bluetoothNotice")}
            </p>
            <div className="flex justify-end">
              <PodaciumButton
                size="sm"
                onClick={() => setShowMobilePasskeyModal(false)}
              >
                {t("settings-security.page.disable.cancel")}
              </PodaciumButton>
            </div>
          </div>
        </PodaciumModal>
      </div>
    </div>
  );
}
