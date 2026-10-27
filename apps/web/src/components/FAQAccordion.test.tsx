import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { FAQAccordion, normalizeFaqItems } from "./FAQAccordion";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useBidi: () => ({
    dir: "ltr",
    isolateText: (text: string) => text,
  }),
}));

// Mock StructuredData
vi.mock("@/components/StructuredData", () => ({
  FAQPageJsonLd: () => <div data-testid="jsonld" />,
}));

describe("normalizeFaqItems", () => {
  it("normalizes standard array of items", () => {
    const raw = [
      { question: "What is Podacium?", answer: "An EdTech platform" },
    ];
    const normalized = normalizeFaqItems(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].question).toBe("What is Podacium?");
    expect(normalized[0].answer).toBe("An EdTech platform");
    expect(normalized[0].id).toBeDefined();
  });

  it("normalizes { q, a } legacy format", () => {
    const raw = [{ q: "How does billing work?", a: "Monthly or yearly" }];
    const normalized = normalizeFaqItems(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].question).toBe("How does billing work?");
    expect(normalized[0].answer).toBe("Monthly or yearly");
  });

  it("normalizes nested object category maps", () => {
    const raw = {
      general: [{ question: "General Q1", answer: "A1" }],
      billing: [{ question: "Billing Q1", answer: "A2" }],
    };
    const normalized = normalizeFaqItems(raw);
    expect(normalized).toHaveLength(2);
    expect(normalized[0].category).toBe("general");
    expect(normalized[1].category).toBe("billing");
  });
});

describe("FAQAccordion", () => {
  const sampleItems = [
    {
      id: "faq-1",
      question: "How do I enroll?",
      answer: "Click the enroll button.",
      category: "general",
    },
    {
      id: "faq-2",
      question: "Can I get a refund?",
      answer: "Yes, within 14 days.",
      category: "billing",
    },
  ];

  const sampleCategories = [
    { id: "general", label: "General" },
    { id: "billing", label: "Billing" },
  ];

  it("renders questions and header", () => {
    render(
      <FAQAccordion
        title="Frequently Asked Questions"
        subtitle="Got questions? We have answers."
        items={sampleItems}
      />,
    );

    expect(screen.getByText("Frequently Asked Questions")).toBeInTheDocument();
    expect(
      screen.getByText("Got questions? We have answers."),
    ).toBeInTheDocument();
    expect(screen.getByText("How do I enroll?")).toBeInTheDocument();
    expect(screen.getByText("Can I get a refund?")).toBeInTheDocument();
  });

  it("expands and collapses answers on click", () => {
    render(<FAQAccordion items={sampleItems} />);

    const button = screen.getByRole("button", { name: /How do I enroll\?/i });
    expect(button).toHaveAttribute("aria-expanded", "false");

    // Expand
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Click the enroll button.")).toBeInTheDocument();

    // Collapse
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("filters by category tabs", () => {
    render(<FAQAccordion items={sampleItems} categories={sampleCategories} />);

    // Click 'Billing' category
    const billingTab = screen.getByRole("button", { name: "Billing" });
    fireEvent.click(billingTab);

    expect(screen.queryByText("How do I enroll?")).not.toBeInTheDocument();
    expect(screen.getByText("Can I get a refund?")).toBeInTheDocument();
  });

  it("filters by search query and highlights matching text", () => {
    render(<FAQAccordion items={sampleItems} searchable={true} />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    fireEvent.change(searchInput, { target: { value: "refund" } });

    expect(screen.queryByText("How do I enroll?")).not.toBeInTheDocument();
    // Verify highlight mark was applied to "refund"
    const mark = screen.getByText("refund");
    expect(mark.tagName).toBe("MARK");
  });

  it("shows empty state when search finds no matches", () => {
    render(<FAQAccordion items={sampleItems} searchable={true} />);

    const searchInput = screen.getByRole("textbox", { name: /search/i });
    fireEvent.change(searchInput, {
      target: { value: "nonexistent query xyz" },
    });

    expect(screen.getByText("common.noMatchingQuestions")).toBeInTheDocument();
  });

  it("submits helpfulness feedback", () => {
    render(<FAQAccordion items={sampleItems} defaultOpenIds={["faq-1"]} />);

    const yesBtn = screen.getByRole("button", { name: /common.yes/i });
    fireEvent.click(yesBtn);

    expect(screen.getByText("common.thankYouFeedback")).toBeInTheDocument();
  });
});
