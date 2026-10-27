import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PodaciumReveal } from "./PodaciumReveal";

describe("PodaciumReveal", () => {
  it("renders children with the requested entrance and stagger", () => {
    render(
      <PodaciumReveal entrance="scale" delay={120} distance={32}>
        <p>Hero copy</p>
      </PodaciumReveal>,
    );

    const text = screen.getByText("Hero copy");
    const wrapper = text.parentElement as HTMLElement;

    expect(wrapper).toHaveClass("podacium-reveal");
    expect(wrapper).toHaveAttribute("data-entrance", "scale");
    expect(wrapper.style.getPropertyValue("--reveal-delay")).toBe("120ms");
    expect(wrapper.style.getPropertyValue("--reveal-distance")).toBe("32px");
  });

  it("can render as a semantic element", () => {
    render(
      <PodaciumReveal as="section" entrance="fade" className="mt-4">
        <span>Section</span>
      </PodaciumReveal>,
    );

    const wrapper = screen.getByText("Section").parentElement as HTMLElement;
    expect(wrapper.tagName).toBe("SECTION");
    expect(wrapper).toHaveClass("podacium-reveal", "mt-4");
  });
});
