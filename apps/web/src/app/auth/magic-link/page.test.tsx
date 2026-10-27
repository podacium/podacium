import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MagicLinkPage from "./page";
import { IntlProvider } from "@/lib/i18n";
import { loadMessages } from "@/lib/locale-loader";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Mock useAuth
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    refreshUser: vi.fn(),
  }),
}));

// Mock AuthSplitLayout to isolate form and translation tests
vi.mock("@/components/auth/AuthSplitLayout", () => ({
  default: ({ heroTitle, heroSubtitle, heroFeatures, children }: any) => (
    <div>
      <h1 data-testid="hero-title">{heroTitle}</h1>
      <p data-testid="hero-subtitle">{heroSubtitle}</p>
      <ul>
        {heroFeatures?.map((f: any, i: number) => (
          <li key={i}>{f.text}</li>
        ))}
      </ul>
      {children}
    </div>
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => {
  const makeMock = (Tag: string) => {
    const Comp = React.forwardRef<any, any>(({ children, ...props }, ref) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        whileInView,
        viewport,
        transition,
        layout,
        ...validProps
      } = props;
      return React.createElement(Tag, { ...validProps, ref }, children);
    });
    Comp.displayName = `motion.${Tag}`;
    return Comp;
  };

  return {
    motion: {
      div: makeMock("div"),
      button: makeMock("button"),
      h1: makeMock("h1"),
      p: makeMock("p"),
      span: makeMock("span"),
      form: makeMock("form"),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

describe("MagicLinkPage", () => {
  it("renders with full translated headings, labels, and buttons without empty text", async () => {
    const messages = await loadMessages("en");

    render(
      <IntlProvider messages={messages} locale="en">
        <MagicLinkPage />
      </IntlProvider>,
    );

    // Check headings and form elements are populated and not empty
    const headings = screen.getAllByRole("heading", {
      level: 1,
      name: "Passwordless Sign-In",
    });
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        "Enter your email and we'll send you an instant login link.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send Magic Link" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Back to standard login")).toBeInTheDocument();

    // Check hero features
    expect(
      screen.getByText("Cryptographically secure single-use links"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Instant access directly from your inbox"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Protected against brute force & phishing"),
    ).toBeInTheDocument();
  });
});
