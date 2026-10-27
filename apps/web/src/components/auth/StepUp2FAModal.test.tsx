import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StepUp2FAModal } from "./StepUp2FAModal";

vi.mock("@/lib/i18n", () => {
  const t = (k: string) => k;
  return {
    useTranslations: () => Object.assign(t, { t }),
    useBidi: () => ({ isRTL: false, dir: "ltr" }),
  };
});

describe("StepUp2FAModal", () => {
  it("renders 6-digit OTP slots when open", () => {
    const { container } = render(
      <StepUp2FAModal
        isOpen={true}
        onClose={vi.fn()}
        onVerifySuccess={vi.fn()}
      />,
    );
    expect(screen.getByText("robustness.auth_2fa.title")).toBeInTheDocument();
    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');
    expect(slots).toHaveLength(6);
    expect(screen.getByTestId("step-up-otp-input")).toBeInTheDocument();
  });
});
