import { describe, it, expect } from "vitest";
import { resolveNotificationRoute } from "./notificationRoutes";

describe("resolveNotificationRoute", () => {
  it("returns /notifications on null or empty input", () => {
    expect(resolveNotificationRoute(null)).toBe("/notifications");
    expect(resolveNotificationRoute(undefined)).toBe("/notifications");
    expect(resolveNotificationRoute({})).toBe("/notifications");
  });

  it("repairs legacy /freelance/projects URLs to /hub/projects", () => {
    expect(
      resolveNotificationRoute({
        action_url: "/freelance/projects/42/proposals",
      }),
    ).toBe("/hub/projects/42/proposals");
  });

  it("repairs legacy /freelance/contracts URLs to /hub/contracts", () => {
    expect(resolveNotificationRoute({ url: "/freelance/contracts/99" })).toBe(
      "/hub/contracts/99",
    );
  });

  it("repairs legacy /courses URLs to /learn/courses", () => {
    expect(resolveNotificationRoute({ target: "/courses/intro-to-ai" })).toBe(
      "/learn/courses/intro-to-ai",
    );
  });

  it("resolves live session payloads accurately", () => {
    expect(
      resolveNotificationRoute({
        entity_type: "live_session",
        entity_id: "123",
      }),
    ).toBe("/live/123");
    expect(resolveNotificationRoute({ session_id: 123 })).toBe("/live/123");
  });

  it("resolves security, KYC, and settings routes accurately", () => {
    expect(resolveNotificationRoute({ entity_type: "security" })).toBe(
      "/settings/security",
    );
    expect(resolveNotificationRoute({ entity_type: "kyc" })).toBe(
      "/settings/verification",
    );
    expect(resolveNotificationRoute({ entity_type: "organization" })).toBe(
      "/settings/organization",
    );
  });

  it("resolves financial and support routes accurately", () => {
    expect(resolveNotificationRoute({ entity_type: "payout" })).toBe(
      "/wallet/payouts",
    );
    expect(resolveNotificationRoute({ ticket_id: 77 })).toBe("/hub/support/77");
    expect(resolveNotificationRoute({ dispute_id: 12 })).toBe(
      "/hub/disputes/12",
    );
  });
});
