import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  PodaciumOTPInput,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
  REGEXP_ONLY_DIGITS,
} from "./PodaciumOTPInput";

describe("PodaciumOTPInput", () => {
  it("renders 6 slots with a separator by default", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <PodaciumOTPInput value="123" onChange={handleChange} />,
    );

    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');
    expect(slots).toHaveLength(6);
    expect(slots[0]).toHaveTextContent("1");
    expect(slots[1]).toHaveTextContent("2");
    expect(slots[2]).toHaveTextContent("3");
    expect(slots[3]).toHaveTextContent("");
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("filters non-digits and triggers onComplete when all 6 digits are entered", () => {
    const handleChange = vi.fn();
    const handleComplete = vi.fn();
    render(
      <PodaciumOTPInput
        value=""
        onChange={handleChange}
        onComplete={handleComplete}
        data-testid="otp-field"
      />,
    );

    const input = screen.getByTestId("otp-field");
    fireEvent.change(input, { target: { value: "12a34b56" } });
    expect(handleChange).toHaveBeenCalledWith("123456");
    expect(handleComplete).toHaveBeenCalledWith("123456");
  });

  it("supports composable InputOTP / InputOTPGroup / InputOTPSlot / InputOTPSeparator primitives", () => {
    const { container } = render(
      <InputOTP
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        defaultValue="987654"
        aria-label="One-time password"
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>,
    );

    const slots = container.querySelectorAll('[data-slot="input-otp-slot"]');
    expect(slots).toHaveLength(6);
    expect(slots[0]).toHaveTextContent("9");
    expect(slots[5]).toHaveTextContent("4");
  });
});
