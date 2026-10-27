import { describe, it, expect } from "vitest";
import {
  auditDomainSecurity,
  auditSenderSecurity,
  auditLinkSecurity,
  isDangerousAttachment,
} from "./mail-security";

describe("Mail Security & Anti-Spoofing Engine", () => {
  describe("auditDomainSecurity", () => {
    it("detects Punycode domains (xn--)", () => {
      const result = auditDomainSecurity("xn--pple-43d.com");
      expect(result.isPunycode).toBe(true);
    });

    it("detects Cyrillic homograph lookalike characters", () => {
      // "pоdacium.com" where 'о' is Cyrillic \u043e instead of Latin 'o'
      const homographDomain = "p\u043edacium.com";
      const result = auditDomainSecurity(homographDomain);
      expect(result.isHomograph).toBe(true);
      expect(result.normalized).toBe("podacium.com");
    });

    it("passes legitimate Latin domains", () => {
      const result = auditDomainSecurity("podacium.com");
      expect(result.isPunycode).toBe(false);
      expect(result.isHomograph).toBe(false);
      expect(result.normalized).toBe("podacium.com");
    });
  });

  describe("auditSenderSecurity", () => {
    it("flags brand impersonation when sender claims Podacium but email is from external domain", () => {
      const audit = auditSenderSecurity(
        "Podacium Security Team",
        "attacker@free-email-service.com",
      );
      expect(audit.isSuspicious).toBe(true);
      expect(audit.isImpersonatingBrand).toBe(true);
      expect(audit.warningMessage).toContain("Suspected impersonation");
    });

    it("does not flag legitimate internal Podacium sender", () => {
      const audit = auditSenderSecurity(
        "Podacium Support",
        "support@podacium.com",
      );
      expect(audit.isSuspicious).toBe(false);
      expect(audit.isImpersonatingBrand).toBe(false);
    });

    it("flags homograph spoofing targeting podacium", () => {
      // p\u043edacium.com (Cyrillic o)
      const audit = auditSenderSecurity(
        "Security Alert",
        "security@p\u043edacium.com",
      );
      expect(audit.isSuspicious).toBe(true);
      expect(audit.isHomograph).toBe(true);
      expect(audit.warningMessage).toContain("homograph spoofing");
    });
  });

  describe("auditLinkSecurity", () => {
    it("detects deceptive link mismatch when visible text differs from destination href", () => {
      const audit = auditLinkSecurity(
        "https://podacium.com/security/login",
        "https://evil-phishing-portal.ru/login",
      );
      expect(audit.isMismatched).toBe(true);
      expect(audit.displayedUrl).toBe("https://podacium.com/security/login");
      expect(audit.actualUrl).toBe("https://evil-phishing-portal.ru/login");
      expect(audit.warningMessage).toContain("Deceptive Link Warning");
    });

    it("passes matching link text and href", () => {
      const audit = auditLinkSecurity(
        "https://podacium.com/docs",
        "https://podacium.com/docs",
      );
      expect(audit.isMismatched).toBe(false);
    });

    it("passes arbitrary anchor label text like 'Click Here'", () => {
      const audit = auditLinkSecurity(
        "Click Here to View Document",
        "https://podacium.com/docs",
      );
      expect(audit.isMismatched).toBe(false);
    });
  });

  describe("isDangerousAttachment", () => {
    it("blocks executable and script extensions", () => {
      expect(isDangerousAttachment("payload.exe")).toBe(true);
      expect(isDangerousAttachment("script.bat")).toBe(true);
      expect(isDangerousAttachment("exploit.ps1")).toBe(true);
      expect(isDangerousAttachment("malware.vbs")).toBe(true);
      expect(isDangerousAttachment("document.pdf.exe")).toBe(true);
    });

    it("permits safe document and media extensions", () => {
      expect(isDangerousAttachment("report.pdf")).toBe(false);
      expect(isDangerousAttachment("spreadsheet.xlsx")).toBe(false);
      expect(isDangerousAttachment("diagram.png")).toBe(false);
    });
  });
});
