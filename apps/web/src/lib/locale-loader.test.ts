import { describe, it, expect } from "vitest";
import { loadMessages } from "./locale-loader";

describe("locale-loader loadMessages", () => {
  it("loads auth messages into both root and auth namespaces", async () => {
    const messages = await loadMessages("en");

    // Root level mappings
    expect(messages.magicLink).toBeDefined();
    expect(messages.magicLink.card.title).toBe("Passwordless Sign-In");
    expect(messages.magicLink.form.emailLabel).toBe("Email Address");

    // auth.* namespace mappings
    expect(messages.auth).toBeDefined();
    expect(messages.auth.magicLink).toBeDefined();
    expect(messages.auth.magicLink.card.title).toBe("Passwordless Sign-In");
    expect(messages.auth.verifyEmail).toBeDefined();
    expect(messages.auth.resetPassword).toBeDefined();

    // Preserves common.json auth keys (like signIn/signOut)
    expect(messages.auth.signIn).toBeDefined();
    expect(messages.auth.signOut).toBeDefined();
  });
});
