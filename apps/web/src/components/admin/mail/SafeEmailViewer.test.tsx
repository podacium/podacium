import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SafeEmailViewer } from "./SafeEmailViewer";

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "admin.mail.security.deceptiveLinkTitle":
      "Security Alert: Deceptive Link Detected",
    "admin.mail.security.openLinkAnyway": "Open Link Anyway",
  };
  const translator = (key: string, _vars?: any, fallback?: string) => {
    return dictionary[key] || fallback || key;
  };
  return {
    useTranslations: () => translator,
    useLocale: () => "en",
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

describe("SafeEmailViewer Component", () => {
  it("renders plain text message cleanly when no HTML is provided", () => {
    render(
      <SafeEmailViewer
        bodyText="This is a confidential corporate email."
        messageId="msg-101"
      />,
    );

    expect(
      screen.getByText("This is a confidential corporate email."),
    ).toBeInTheDocument();
  });

  it("renders full-length email paper cleanly when htmlContent is provided", () => {
    render(
      <SafeEmailViewer
        htmlContent="<p>Welcome to Podacium Webmail</p>"
        messageId="msg-102"
      />,
    );

    const viewer = screen.getByTestId("safe-email-viewer");
    expect(viewer).toBeInTheDocument();
    expect(screen.getByText("Welcome to Podacium Webmail")).toBeInTheDocument();
  });

  it("shows image blocker banner when blocked images are present and unblocks on click", () => {
    render(
      <SafeEmailViewer
        htmlContent='<p>Test</p><img data-original-src="https://tracker.com/pixel.png" />'
        messageId="msg-103"
      />,
    );

    expect(
      screen.getByText("admin.mail.security.imagesBlocked"),
    ).toBeInTheDocument();
    const loadBtn = screen.getByText("admin.mail.actions.loadRemoteImages");
    expect(loadBtn).toBeInTheDocument();

    fireEvent.click(loadBtn);
    expect(
      screen.queryByText("admin.mail.security.imagesBlocked"),
    ).not.toBeInTheDocument();
  });

  it("neutralizes stored XSS: strips script tags and inline event handlers [CRITICAL-MAIL-01]", () => {
    const { container } = render(
      <SafeEmailViewer
        htmlContent='<div>Safe Content<script>window.pwned = true;</script><img src="x" onerror="window.pwned = true;" /><svg onload="window.pwned = true;"></svg></div>'
        messageId="msg-xss-1"
      />,
    );

    const emailPaper = container.querySelector(".podacium-email-paper");
    // Script tag must be completely stripped
    expect(emailPaper?.querySelector("script")).toBeNull();
    // SVG and dangerous event handlers must be stripped from email paper
    expect(emailPaper?.querySelector("svg")).toBeNull();
    const img = emailPaper?.querySelector("img");
    if (img) {
      expect(img.getAttribute("onerror")).toBeNull();
    }
    expect(screen.getByText("Safe Content")).toBeInTheDocument();
  });

  it("strips dangerous javascript: URIs in anchor tags [CRITICAL-MAIL-01]", () => {
    const { container } = render(
      <SafeEmailViewer
        htmlContent='<a href="javascript:alert(1)">Click Me</a>'
        messageId="msg-xss-2"
      />,
    );

    const anchor = container.querySelector("a");
    expect(anchor).toBeInTheDocument();
    expect(anchor?.getAttribute("href")).toBeNull();
  });

  it("neutralizes CID quote-breakout XSS [CRITICAL-MAIL-01]", () => {
    const { container } = render(
      <SafeEmailViewer
        htmlContent={`<img src='cid:evil" onerror=alert(1)' />`}
        messageId="msg-cid-xss"
      />,
    );

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("onerror")).toBeNull();
  });

  it("sets dir='rtl' when Arabic content is detected", () => {
    render(
      <SafeEmailViewer
        htmlContent="<p>مرحبًا بك في منصة بوداسيوم للبريد الإلكتروني</p>"
        messageId="msg-rtl-1"
      />,
    );

    const viewer = screen.getByTestId("safe-email-viewer");
    expect(viewer).toHaveAttribute("dir", "rtl");
  });

  it("displays security alert banner when sender impersonates Podacium brand", () => {
    render(
      <SafeEmailViewer
        htmlContent="<p>Please update your credentials immediately.</p>"
        messageId="msg-phish-1"
        senderDisplayName="Podacium Security Admin"
        senderEmail="attacker@scam-mail.org"
      />,
    );

    const alert = screen.getByTestId("sender-spoofing-alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Suspected impersonation");
  });

  it("intercepts deceptive mismatched link and opens security warning modal", () => {
    render(
      <SafeEmailViewer
        htmlContent='<p>Click here: <a href="https://malicious-login.xyz">https://podacium.com/login</a></p>'
        messageId="msg-phish-2"
      />,
    );

    const link = screen.getByText("https://podacium.com/login");
    expect(link).toBeInTheDocument();

    fireEvent.click(link);

    expect(
      screen.getByText("Security Alert: Deceptive Link Detected"),
    ).toBeInTheDocument();
    expect(screen.getByText("https://malicious-login.xyz")).toBeInTheDocument();
    expect(screen.getByText("Open Link Anyway")).toBeInTheDocument();
  });
});
