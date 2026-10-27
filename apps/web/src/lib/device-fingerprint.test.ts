import { describe, it, expect, beforeEach } from "vitest";
import {
  persistFingerprintCookie,
  FINGERPRINT_COOKIE,
} from "./device-fingerprint";

function fingerprintCookies(): string[] {
  return document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${FINGERPRINT_COOKIE}=`));
}

describe("persistFingerprintCookie", () => {
  beforeEach(() => {
    document.cookie = `${FINGERPRINT_COOKIE}=; path=/; max-age=0`;
  });

  it("publishes the device fingerprint on the app origin", () => {
    persistFingerprintCookie("visitor_abc123");

    expect(document.cookie).toContain(`${FINGERPRINT_COOKIE}=visitor_abc123`);
  });

  it("keeps a single cookie across repeated calls", () => {
    persistFingerprintCookie("visitor_abc123");
    persistFingerprintCookie("visitor_abc123");

    expect(fingerprintCookies()).toHaveLength(1);
  });

  it("replaces the cookie when the fingerprint changes", () => {
    persistFingerprintCookie("old_device");
    persistFingerprintCookie("new_device");

    expect(fingerprintCookies()).toEqual([`${FINGERPRINT_COOKIE}=new_device`]);
  });

  it("ignores an empty fingerprint", () => {
    persistFingerprintCookie("");

    expect(fingerprintCookies()).toHaveLength(0);
  });
});
