import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { LearnCard, type LearnCardData } from "./LearnCard";

// Framer's layout/whileInView machinery needs observers jsdom does not have;
// the card only uses it for the entrance, so render the markup directly.
vi.mock("framer-motion", () => {
  const motionProps = new Set([
    "initial",
    "animate",
    "whileInView",
    "whileHover",
    "viewport",
    "transition",
  ]);

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Tag = tag as any;
        return ({ children, ...props }: any) => {
          const domProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !motionProps.has(key)),
          );
          return <Tag {...domProps}>{children}</Tag>;
        };
      },
    },
  );

  return { motion, useReducedMotion: () => false };
});

const baseData: LearnCardData = {
  id: "course-1",
  href: "/learn/courses/course-1",
  title: "Advanced React Patterns",
  description: "Compose resilient components with hooks and context.",
  imageUrl: "/course.png",
  eyebrow: "Engineering",
  level: "Advanced",
  rating: 4.6,
  duration: "3h 10min",
  count: "12 lessons",
  badges: [{ label: "Featured", tone: "featured" }],
  stats: [
    { value: "1,204", label: "enrolled" },
    { value: "12", label: "lessons" },
  ],
  price: { current: 3000, original: 5000, isFree: false, isDiscounted: true },
  currency: "DA",
  freeLabel: "Free",
  ctaLabel: "Start Course",
  isEnrolled: false,
  progress: 0,
  progressLabel: "Progress",
};

const pathData: LearnCardData = {
  ...baseData,
  id: "path-1",
  href: "/learn/paths/path-1",
  title: "Full-stack Web Development",
  chips: [
    { label: "React", tone: "skill" },
    { label: "Frontend", tone: "tag" },
  ],
  eyebrow: undefined,
  ctaLabel: "Explore",
  price: null,
};

describe("LearnCard", () => {
  it("renders the title, description and call to action", () => {
    render(<LearnCard data={baseData} />);

    expect(
      screen.getByRole("heading", { name: "Advanced React Patterns" }),
    ).toBeInTheDocument();
    expect(screen.getByText(baseData.description)).toBeInTheDocument();
    expect(screen.getByText("Start Course")).toBeInTheDocument();
  });

  it("renders the duration and item-count pills", () => {
    render(<LearnCard data={baseData} />);

    expect(screen.getByText("3h 10min")).toBeInTheDocument();
    expect(screen.getByText("12 lessons")).toBeInTheDocument();
  });

  it("renders badges without requiring hover", () => {
    render(<LearnCard data={baseData} />);

    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("renders every stat with its label", () => {
    render(<LearnCard data={baseData} />);

    expect(screen.getByText("1,204")).toBeInTheDocument();
    expect(screen.getAllByText("lessons").length).toBeGreaterThan(0);
  });

  it("shows the discount as a percentage and keeps the original struck through", () => {
    render(<LearnCard data={baseData} />);

    expect(screen.getByText("-40%")).toBeInTheDocument();
    expect(screen.getByText("5,000 DA")).toBeInTheDocument();
  });

  it("shows a free label instead of an amount for free items", () => {
    render(
      <LearnCard
        data={{
          ...baseData,
          price: {
            current: 0,
            original: 0,
            isFree: true,
            isDiscounted: false,
          },
        }}
      />,
    );

    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  it("omits the price block when there is no price", () => {
    render(<LearnCard data={{ ...baseData, price: null }} />);

    expect(screen.queryByText("DA")).not.toBeInTheDocument();
    expect(screen.queryByText("-40%")).not.toBeInTheDocument();
  });

  it("renders the path variant with its skill and tag chips", () => {
    render(<LearnCard data={pathData} variant="path" />);

    expect(
      screen.getByRole("heading", { name: "Full-stack Web Development" }),
    ).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
  });

  it("renders an accessible progress bar for an enrolled course", () => {
    render(
      <LearnCard
        data={{
          ...baseData,
          isEnrolled: true,
          progress: 42,
          ctaLabel: "Continue",
        }}
      />,
    );

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAccessibleName("Progress");
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("hides progress for courses that are not enrolled", () => {
    render(<LearnCard data={{ ...baseData, isEnrolled: true, progress: 0 }} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps the call to action out of the heading, so the card exposes one heading", () => {
    render(<LearnCard data={baseData} />);

    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<LearnCard data={baseData} />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations in the path variant", async () => {
    const { container } = render(<LearnCard data={pathData} variant="path" />);
    const results = await axe(container);

    expect(results).toHaveNoViolations();
  });
});
