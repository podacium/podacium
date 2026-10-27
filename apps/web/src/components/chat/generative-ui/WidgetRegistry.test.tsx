import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  WidgetRegistry,
  WidgetErrorBoundary,
  WidgetErrorFallback,
} from "./WidgetRegistry";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => ({
    t: (k: string, vars?: Record<string, unknown>) => {
      if (vars && vars.count !== undefined) {
        return `${k} (${vars.count})`;
      }
      return k;
    },
  }),
  useLocale: () => "fr",
  useBidi: () => ({ isRTL: false, dir: "ltr" }),
}));

function BombComponent(): JSX.Element {
  throw new Error("Malicious or broken generative payload crash!");
}

describe("WidgetRegistry and ErrorBoundary", () => {
  it("renders unknown widget fallback box for unrecognized types", () => {
    render(<WidgetRegistry widget={{ type: "unknown_future_widget" }} />);
    expect(
      screen.getByText(/\[Widget: unknown_future_widget\]/i),
    ).toBeInTheDocument();
  });

  it("renders course card for single course payload", () => {
    render(
      <WidgetRegistry
        widget={{
          type: "CourseDetailCard",
          course: {
            id: 1,
            title: "Formation Python Avancé",
            price_dzd: 4500,
            level: "INTERMEDIATE",
          },
        }}
      />,
    );
    expect(screen.getByText("Formation Python Avancé")).toBeInTheDocument();
  });

  it("renders course carousel for CourseCarousel payload with multiple courses", () => {
    render(
      <WidgetRegistry
        widget={{
          type: "CourseCarousel",
          courses: [
            {
              id: "c1",
              title: "Machine Learning Masterclass",
              price: { discounted: 5000 },
              skills: ["Python", "TensorFlow"],
            },
            {
              id: "c2",
              title: "Prompt Engineering Pro",
              price: { discounted: 3000 },
              skills: ["LLM", "AI"],
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByText("Machine Learning Masterclass"),
    ).toBeInTheDocument();
    expect(screen.getByText("Prompt Engineering Pro")).toBeInTheDocument();
  });

  it("renders dashboard list card for dashboard_list_card payload", () => {
    render(
      <WidgetRegistry
        widget={{
          widgetType: "dashboard_list_card",
          dashboards: [
            {
              id: 10,
              name: "Revenus E-commerce Q1",
              description: "Suivi des ventes",
              is_public: true,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Revenus E-commerce Q1")).toBeInTheDocument();
  });

  it("renders project listing grid for ProjectListingGrid payload", () => {
    render(
      <WidgetRegistry
        widget={{
          type: "ProjectListingGrid",
          projects: [
            {
              id: 42,
              title: "Développement Application Mobile Flutter",
              budget_dzd: 150000,
              skills: ["Flutter", "Dart"],
              proposals_count: 3,
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByText("Développement Application Mobile Flutter"),
    ).toBeInTheDocument();
  });

  it("catches rendering errors in WidgetErrorBoundary and displays WidgetErrorFallback", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <WidgetErrorBoundary widgetType="faulty_widget">
        <BombComponent />
      </WidgetErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("component.generativeUi.unavailableTitle"),
    ).toBeInTheDocument();
    expect(screen.getByText(/faulty_widget/i)).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("renders custom fallback in WidgetErrorBoundary if provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <WidgetErrorBoundary fallback={<div>Custom Error Box</div>}>
        <BombComponent />
      </WidgetErrorBoundary>,
    );

    expect(screen.getByText("Custom Error Box")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
