import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AboutHero } from "./_components/AboutHero";
import { AboutTrustBar } from "./_components/AboutTrustBar";
import { AboutFlywheel } from "./_components/AboutFlywheel";
import { AboutSecurity } from "./_components/AboutSecurity";
import { AboutTeam } from "./_components/AboutTeam";
import { AboutJourney } from "./_components/AboutJourney";
import { AboutVision } from "./_components/AboutVision";
import { AboutCTA } from "./_components/AboutCTA";

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
        style,
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
      h2: makeMock("h2"),
      h3: makeMock("h3"),
      p: makeMock("p"),
      span: makeMock("span"),
      section: makeMock("section"),
      ul: makeMock("ul"),
      li: makeMock("li"),
      ol: makeMock("ol"),
      blockquote: makeMock("blockquote"),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => false,
    useMotionValue: () => ({ set: () => {}, get: () => 0 }),
    useSpring: (value: unknown) => value,
    useTransform: () => 0,
  };
});

// Mock useAuth / useOptionalAuth
const mockAuthState = {
  isAuthenticated: false,
  user: null as any,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuthState,
  useOptionalAuth: () => mockAuthState,
}));

// Mock i18n
vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "about.hero.badge": "Academic Innovation • Incubated at HSE Oran",
    "about.hero.title": "Building the Future of Work and Learning in Algeria",
    "about.hero.description":
      "Podacium unites learning, work, and business intelligence.",
    "about.hero.buttons.explorePlatform": "Explore the Ecosystem",
    "about.hero.buttons.originStory": "Our Origin Story",
    "about.trust.badge": "Academic Pedigree & Institutional Trust",
    "about.trust.items.0.name": "HSE Oran Incubateur",
    "about.trust.items.1.name": "Arrêté 1275 / Startup.dz",
    "about.trust.items.2.name": "Chargily Pay & SATIM",
    "about.trust.items.3.name": "Law 18-07 Sovereign Compliance",
    "about.flywheel.badge": "The Circular Flywheel",
    "about.flywheel.title": "Three Integrated Pillars, One Continuous Loop",
    "about.flywheel.tabs.all": "The Ecosystem",
    "about.flywheel.tabs.learn": "1. Learn (Education)",
    "about.flywheel.tabs.earn": "2. Earn (Freelance Hub)",
    "about.flywheel.tabs.scale": "3. Scale (BI)",
    "about.security.badge": "Zero-Compromise Security",
    "about.security.title": "Engineered for Trust in Emerging Markets",
    "about.security.escrow.title": "100% Guaranteed Escrow Protection",
    "about.security.verification.title": "Verified Skill Passports",
    "about.security.privacy.title": "National Data Sovereignty",
    "about.team.header.badge": "The Founding Team",
    "about.team.header.title": "Architects of Algeria's Digital Future",
    "about.team.header.description":
      "Data scientists and operators from HSE Oran.",
    "about.team.founders.0.name": "Zakarya Roubhi",
    "about.team.founders.1.name": "Mohamed Redha Habib",
    "about.team.founders.2.name": "Ahmed Merhab",
    "about.team.labels.viewParcours": "View Background",
    "about.team.labels.hseAlum": "HSE Oran Data Science Alum",
    "about.team.linkedInProfile": "{name} LinkedIn Profile",
    "about.journey.badge": "Strategic Roadmap",
    "about.journey.title": "Our Journey & Horizon Milestones",
    "about.journey.milestones.0.year": "2024",
    "about.journey.milestones.1.year": "2025",
    "about.journey.milestones.2.year": "2026",
    "about.journey.milestones.3.year": "2027+",
    "about.journey.changelogNotice":
      "Follow real-time development and university incubation updates:",
    "about.journey.changelogLink": "Follow our journey on LinkedIn",
    "about.vision.badge": "Our 2030 Horizon",
    "about.vision.title": "Target Impact Commitments",
    "about.vision.targets.0.value": "200K+",
    "about.vision.targets.0.label": "Empowered Learners",
    "about.vision.targets.1.value": "10K+",
    "about.vision.targets.1.label": "Digitized SMEs",
    "about.vision.targets.2.value": "50%",
    "about.vision.targets.2.label": "Talent Retention Target",
    "about.vision.targets.3.value": "GDP+",
    "about.vision.targets.3.label": "Economic Contribution",
    "about.cta.badge": "Start Your Journey",
    "about.cta.title": "Join Algeria's Digital Transformation",
    "about.cta.description":
      "Whether you're a learner, freelancer, business owner, or investor, there's a place for you in the Podacium ecosystem.",
    "about.cta.talent.title": "For Learners & Freelancers",
    "about.cta.talent.description":
      "Build verifiable digital skills, earn recognized Skill Passports, and unlock protected freelance gigs across Algeria and international markets.",
    "about.cta.business.title": "For Businesses & Institutions",
    "about.cta.business.description":
      "Commission vetted Algerian talent with 100% escrow protection, leverage labor intelligence data, or partner on regional economic development.",
    "about.cta.business.note":
      "Institutional partnerships, university incubators & corporate pilots.",
    "about.cta.buttons.signup": "Start Your Free Account",
    "about.cta.buttons.dashboard": "Go to Dashboard",
    "about.cta.buttons.partnerWithUs": "Partner With Us",
    "about.cta.alreadyHaveAccount": "Already have an account?",
    "about.cta.signIn": "Sign in",
    "about.contact.email.subtitle": "General & Media Inquiries",
    "about.contact.location.subtitle": "Campus Headquarters",
    "about.contact.location.name": "HSE Oran, Algeria",
    "about.cta.loggedIn.greeting": "Welcome back, {name}!",
    "about.cta.loggedIn.roles.STUDENT.badge": "Active Learner",
    "about.cta.loggedIn.roles.STUDENT.title": "Ready to Advance Your Skills?",
    "about.cta.loggedIn.roles.STUDENT.description":
      "Continue your enrolled courses, level up your Skill Passport, and unlock upcoming freelance opportunities.",
    "about.cta.loggedIn.roles.STUDENT.primaryBtn": "Continue Learning",
    "about.cta.loggedIn.roles.STUDENT.secondaryBtn": "Go to Dashboard",
    "about.cta.loggedIn.roles.FREELANCER.badge": "Verified Freelancer",
    "about.cta.loggedIn.roles.FREELANCER.title":
      "Find Your Next Protected Client Gig",
    "about.cta.loggedIn.roles.FREELANCER.description":
      "Browse open client projects with 100% escrow protection and submit competitive proposals.",
    "about.cta.loggedIn.roles.FREELANCER.primaryBtn": "Browse Marketplace",
    "about.cta.loggedIn.roles.FREELANCER.secondaryBtn": "Freelancer Dashboard",
  };

  return {
    useTranslations: () => {
      const translator: any = (key: string, vars?: any) => {
        let str = dictionary[key] || "";
        if (vars && typeof vars === "object") {
          for (const k of Object.keys(vars)) {
            str = str.replace(`{${k}}`, String(vars[k]));
          }
        }
        return str;
      };
      translator.raw = (key: string) => dictionary[key];
      return translator;
    },
    useBidi: () => ({
      isRTL: false,
      dir: "ltr",
    }),
  };
});

describe("About Page Components", () => {
  beforeEach(() => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
  });

  it("renders AboutHero with title and primary actions", () => {
    render(<AboutHero />);
    expect(
      screen.getByText("Building the Future of Work and Learning in Algeria"),
    ).toBeInTheDocument();
    expect(screen.getByText("Explore the Ecosystem")).toBeInTheDocument();
    expect(screen.getByText("Our Origin Story")).toBeInTheDocument();
  });

  it("renders AboutHero with dashboard link when authenticated", () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { fullName: "Amina Larbi", role: "STUDENT" };
    render(<AboutHero />);
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });

  it("renders AboutTrustBar with institutional credentials", () => {
    render(<AboutTrustBar />);
    expect(screen.getByText("HSE Oran Incubateur")).toBeInTheDocument();
    expect(screen.getByText("Chargily Pay & SATIM")).toBeInTheDocument();
    expect(
      screen.getByText("Law 18-07 Sovereign Compliance"),
    ).toBeInTheDocument();
  });

  it("renders AboutFlywheel with three pillars and interactive tabs", () => {
    render(<AboutFlywheel />);
    expect(
      screen.getByText("Three Integrated Pillars, One Continuous Loop"),
    ).toBeInTheDocument();
    expect(screen.getByText("1. Learn (Education)")).toBeInTheDocument();
    expect(screen.getByText("2. Earn (Freelance Hub)")).toBeInTheDocument();
    expect(screen.getByText("3. Scale (BI)")).toBeInTheDocument();
  });

  it("renders AboutSecurity with escrow and data protection guarantees", () => {
    render(<AboutSecurity />);
    expect(
      screen.getByText("Engineered for Trust in Emerging Markets"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("100% Guaranteed Escrow Protection"),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified Skill Passports")).toBeInTheDocument();
  });

  it("renders AboutTeam with all 3 co-founders and opens background modal", () => {
    render(<AboutTeam />);
    expect(screen.getByText("Zakarya Roubhi")).toBeInTheDocument();
    expect(screen.getByText("Mohamed Redha Habib")).toBeInTheDocument();
    expect(screen.getByText("Ahmed Merhab")).toBeInTheDocument();
    expect(screen.queryByText("Abdelkrim Boucerba")).not.toBeInTheDocument();

    // Verify LinkedIn Profile Links
    const zakaryaLink = screen.getByRole("link", {
      name: /Zakarya Roubhi LinkedIn Profile/i,
    });
    expect(zakaryaLink).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/zakaryaroubhi/",
    );

    const redhaLink = screen.getByRole("link", {
      name: /Mohamed Redha Habib LinkedIn Profile/i,
    });
    expect(redhaLink).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/mohamed-redha-habib-7885962a3/",
    );

    const ahmedLink = screen.getByRole("link", {
      name: /Ahmed Merhab LinkedIn Profile/i,
    });
    expect(ahmedLink).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/ahmed-merhab-60b04a336/",
    );

    // Click "View Background" on first founder
    const viewButtons = screen.getAllByText("View Background");
    expect(viewButtons.length).toBe(3);
    fireEvent.click(viewButtons[0]);

    // Modal opens
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText("HSE Oran Data Science Alum"),
    ).toBeInTheDocument();
  });

  it("renders AboutJourney with accessible timeline markers", () => {
    render(<AboutJourney />);
    expect(
      screen.getByText("Our Journey & Horizon Milestones"),
    ).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("2027+")).toBeInTheDocument();

    const activeStep = screen.getByRole("listitem", { current: "step" });
    expect(activeStep).toBeInTheDocument();

    const linkedinLink = screen.getByRole("link", {
      name: /Follow our journey on LinkedIn/i,
    });
    expect(linkedinLink).toBeInTheDocument();
    expect(linkedinLink).toHaveAttribute(
      "href",
      "https://www.linkedin.com/company/podacium?originalSubdomain=dz",
    );
    expect(linkedinLink).toHaveAttribute("target", "_blank");
  });

  it("renders AboutVision with 2030 target impact metrics", () => {
    render(<AboutVision />);
    expect(screen.getByText("Target Impact Commitments")).toBeInTheDocument();
    expect(screen.getByText("200K+")).toBeInTheDocument();
    expect(screen.getByText("10K+")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("GDP+")).toBeInTheDocument();
  });

  it("renders AboutCTA for guests with dual audience segments and contact channels", () => {
    render(<AboutCTA />);
    expect(screen.getByText("For Learners & Freelancers")).toBeInTheDocument();
    expect(
      screen.getByText("For Businesses & Institutions"),
    ).toBeInTheDocument();
    expect(screen.getByText("podacium@podacium.com")).toBeInTheDocument();
    expect(screen.getByText("HSE Oran, Algeria")).toBeInTheDocument();
    expect(screen.getByText("Start Your Free Account")).toBeInTheDocument();
  });

  it("renders AboutCTA personalized for authenticated STUDENT with role routing", () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      fullName: "Amina Larbi",
      email: "amina@example.com",
      role: "STUDENT",
    };

    render(<AboutCTA />);
    expect(screen.getByText("Active Learner")).toBeInTheDocument();
    expect(screen.getByText("Welcome back, Amina Larbi!")).toBeInTheDocument();
    expect(
      screen.getByText("Ready to Advance Your Skills?"),
    ).toBeInTheDocument();
    expect(screen.getByText("Continue Learning")).toBeInTheDocument();
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });

  it("renders AboutCTA personalized for authenticated FREELANCER with role routing", () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      fullName: "Karim Benali",
      email: "karim@example.com",
      role: "FREELANCER",
    };

    render(<AboutCTA />);
    expect(screen.getByText("Verified Freelancer")).toBeInTheDocument();
    expect(
      screen.getByText("Find Your Next Protected Client Gig"),
    ).toBeInTheDocument();
    expect(screen.getByText("Browse Marketplace")).toBeInTheDocument();
    expect(screen.getByText("Freelancer Dashboard")).toBeInTheDocument();
  });
});
