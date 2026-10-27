/**
 * Device fingerprint publication.
 *
 * The backend binds the `podacium_session` JWT to the device (the `fpt` claim
 * is a sha256 of the `X-Fingerprint` header). Page navigations never carry
 * that header, so the Edge middleware reads the same value from a cookie on
 * the app origin.
 *
 * Keep this module dependency-free: it is imported by the API client and by
 * the fingerprint hook, both of which must stay cheap to load.
 */

export const FINGERPRINT_COOKIE = "x-fingerprint";

const FINGERPRINT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Write the fingerprint to the app-origin cookie the Edge middleware reads.
 * No-ops when the value is unchanged so it can be called on every resolution.
 */
export function persistFingerprintCookie(fingerprint: string): void {
  if (typeof document === "undefined" || !fingerprint) return;
  try {
    const encoded = encodeURIComponent(fingerprint);
    const alreadySet = document.cookie
      .split(";")
      .some((entry) => entry.trim() === `${FINGERPRINT_COOKIE}=${encoded}`);
    if (alreadySet) return;

    const secure =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${FINGERPRINT_COOKIE}=${encoded}; path=/; max-age=${FINGERPRINT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {
    // Cookies unavailable (private mode, sandboxed iframe). The middleware
    // degrades to an unverified session instead of rejecting the request.
  }
}
