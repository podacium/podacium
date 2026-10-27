import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import {
  Input,
  PasswordStrengthIndicator,
  PasswordMatchIndicator,
} from "./AuthComponents";

// Mock i18n
vi.mock("@/lib/i18n", () => {
  const t = (key: string, _params?: any, fallback?: string) => {
    if (key === "common.showPassword") return "Show password";
    if (key === "common.hidePassword") return "Hide password";
    return fallback || key;
  };
  return {
    useTranslations: () => Object.assign(t, { t }),
  };
});

describe("AuthComponents Input", () => {
  it("renders password toggle button when showPasswordToggle is true", () => {
    render(<Input label="Password" type="password" showPasswordToggle />);

    const toggleBtn = screen.getByRole("button", { name: /show password/i });
    expect(toggleBtn).toBeInTheDocument();

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(input.className).toContain("pe-10");

    // Click toggle button to show password
    fireEvent.click(toggleBtn);
    expect(input.type).toBe("text");
    expect(
      screen.getByRole("button", { name: /hide password/i }),
    ).toBeInTheDocument();

    // Click toggle button again to hide password
    fireEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input.type).toBe("password");
  });

  it("renders password strength indicator when enabled", () => {
    render(
      <Input
        label="Password"
        type="password"
        showStrengthIndicator
        passwordValue="Secret123!"
      />,
    );

    expect(screen.getByText(/title/i)).toBeInTheDocument();
  });

  it("renders password match indicator when enabled", () => {
    render(
      <Input
        label="Confirm Password"
        type="password"
        value="Secret123!"
        showMatchIndicator
        comparisonValue="Secret123!"
      />,
    );

    expect(screen.getByText(/matching/i)).toBeInTheDocument();
  });
});
