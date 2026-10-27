/**
 * Email Security & Anti-Spoofing Engine for Podacium Webmail.
 *
 * Implements:
 * 1. Homograph / Punycode domain attack detection.
 * 2. Display name impersonation detection (e.g., "Podacium Admin" from evil.com).
 * 3. Mismatched link / anchor text phishing detection.
 * 4. Dangerous client-side attachment extension blocking.
 */

// Cyrillic and Greek lookalikes commonly used in IDN homograph attacks
const CONFUSABLE_LOOKALIKES: Record<string, string> = {
  "\u0430": "a", // cyrillic small letter a
  "\u0441": "c", // cyrillic small letter es
  "\u0435": "e", // cyrillic small letter ie
  "\u0456": "i", // cyrillic small letter byelorussian-ukrainian i
  "\u0458": "j", // cyrillic small letter je
  "\u043e": "o", // cyrillic small letter o
  "\u0440": "p", // cyrillic small letter er
  "\u0455": "s", // cyrillic small letter dze
  "\u0443": "y", // cyrillic small letter u
  "\u0445": "x", // cyrillic small letter ha
  "\u03bf": "o", // greek small letter omicron
  "\u03c1": "p", // greek small letter rho
};

export const DANGEROUS_ATTACHMENT_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".vbs",
  ".vbe",
  ".js",
  ".jse",
  ".wsf",
  ".wsh",
  ".scr",
  ".pif",
  ".com",
  ".hta",
  ".cpl",
  ".msc",
  ".jar",
  ".msi",
  ".msp",
  ".reg",
  ".ps1",
  ".ps2",
  ".dll",
  ".sys",
  ".drv",
  ".apk",
  ".iso",
  ".img",
  ".py",
  ".php",
]);

export interface SenderSecurityAudit {
  isSuspicious: boolean;
  isPunycode: boolean;
  isHomograph: boolean;
  isImpersonatingBrand: boolean;
  warningMessage?: string;
}

export interface LinkSecurityAudit {
  isMismatched: boolean;
  displayedUrl?: string;
  actualUrl: string;
  warningMessage?: string;
}

/**
 * Checks if a domain uses Punycode (xn--) or contains confusable Unicode characters
 * attempting to impersonate podacium.com or other domains.
 */
export function auditDomainSecurity(domain: string): {
  isPunycode: boolean;
  isHomograph: boolean;
  normalized: string;
} {
  const lowerDomain = domain.toLowerCase().trim();
  const isPunycode = lowerDomain.includes("xn--");

  let normalized = "";
  let hasConfusable = false;

  for (const char of lowerDomain) {
    if (CONFUSABLE_LOOKALIKES[char]) {
      normalized += CONFUSABLE_LOOKALIKES[char];
      hasConfusable = true;
    } else {
      normalized += char;
    }
  }

  return {
    isPunycode,
    isHomograph: hasConfusable,
    normalized,
  };
}

/**
 * Checks if a sender's display name or email address attempts to impersonate
 * Podacium internal support/admin staff or uses homograph lookalikes.
 */
export function auditSenderSecurity(
  displayName?: string | null,
  fromEmail?: string | null,
): SenderSecurityAudit {
  if (!fromEmail) {
    return {
      isSuspicious: false,
      isPunycode: false,
      isHomograph: false,
      isImpersonatingBrand: false,
    };
  }

  const emailClean = fromEmail.toLowerCase().trim();
  const domain = emailClean.split("@")[1] || "";
  const nameClean = (displayName || "").toLowerCase().trim();

  const domainAudit = auditDomainSecurity(domain);

  // Check if display name claims to be official Podacium, Admin, Security, Support, or Billing
  const brandKeywords = [
    "podacium",
    "admin",
    "security",
    "support",
    "billing",
    "admissions",
    "helpdesk",
  ];
  const claimsBrandInName = brandKeywords.some((kw) => nameClean.includes(kw));
  const isOfficialDomain =
    domain === "podacium.com" || domain.endsWith(".podacium.com");

  const isImpersonatingBrand = claimsBrandInName && !isOfficialDomain;
  const isHomographAttack =
    domainAudit.isHomograph && domainAudit.normalized.includes("podacium");

  const isSuspicious =
    domainAudit.isPunycode || domainAudit.isHomograph || isImpersonatingBrand;

  let warningMessage: string | undefined;
  if (isHomographAttack) {
    warningMessage = `Warning: The sender domain "${domain}" appears to be an IDN homograph spoofing podacium.com!`;
  } else if (isImpersonatingBrand) {
    warningMessage = `Suspected impersonation: Sender claims to be "${displayName}" but sent from non-official domain "${domain}".`;
  } else if (domainAudit.isPunycode) {
    warningMessage = `Caution: Sender uses an encoded internationalized domain name (${domain}).`;
  }

  return {
    isSuspicious,
    isPunycode: domainAudit.isPunycode,
    isHomograph: domainAudit.isHomograph,
    isImpersonatingBrand,
    warningMessage,
  };
}

/**
 * Inspects anchor tags to detect if the visible anchor text looks like a URL
 * that points to a different domain than the actual href destination.
 */
export function auditLinkSecurity(
  anchorText: string,
  href: string,
): LinkSecurityAudit {
  const cleanHref = (href || "").trim();
  const cleanText = (anchorText || "").trim();

  // Try parsing href
  let hrefHost = "";
  try {
    const parsedHref = new URL(cleanHref, "https://podacium.com");
    hrefHost = parsedHref.hostname.toLowerCase();
  } catch {
    return { isMismatched: false, actualUrl: cleanHref };
  }

  // Check if text looks like a URL (starts with http://, https://, or www.)
  const looksLikeUrl = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i.test(
    cleanText,
  );

  if (looksLikeUrl) {
    try {
      const textWithProto = cleanText.startsWith("http")
        ? cleanText
        : `https://${cleanText}`;
      const parsedText = new URL(textWithProto);
      const textHost = parsedText.hostname.toLowerCase();

      // If hosts differ, flag as phishing mismatch
      if (textHost !== hrefHost && !hrefHost.endsWith(`.${textHost}`)) {
        return {
          isMismatched: true,
          displayedUrl: cleanText,
          actualUrl: cleanHref,
          warningMessage: `Deceptive Link Warning: The link text says "${textHost}", but it actually leads to "${hrefHost}".`,
        };
      }
    } catch {
      // Not a valid URL in text
    }
  }

  return {
    isMismatched: false,
    actualUrl: cleanHref,
  };
}

/**
 * Checks if a filename has a dangerous executable extension.
 */
export function isDangerousAttachment(filename: string): boolean {
  const clean = filename.trim().toLowerCase().replace(/\.+$/, "");
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return false;
  const ext = clean.slice(lastDot);
  return DANGEROUS_ATTACHMENT_EXTENSIONS.has(ext);
}
