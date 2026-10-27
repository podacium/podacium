import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import OrganizationPublicProfilePage from "./page";
import { api, PublicOrganizationProfileResponse } from "@/lib/api";

const mockPush = vi.fn();
let mockParams = { slug: "acme-tech-algeria" };

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getOrganizationBySlug: vi.fn(),
  },
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string, vars?: Record<string, any>) => {
    if (vars && typeof vars === "object") {
      let res = key;
      for (const [k, v] of Object.entries(vars)) {
        res = res.replace(`{${k}}`, String(v));
      }
      return res;
    }
    return key;
  },
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockOrgData: PublicOrganizationProfileResponse = {
  id: 1,
  name: "Acme Technologies Algeria",
  slug: "acme-tech-algeria",
  description:
    "Acme Technologies is an Algerian enterprise cloud engineering group.",
  website: "https://acme.dz",
  sector: "Technology & Software",
  city: "Algiers",
  country: "Algeria",
  tagline:
    "Pioneering Sovereign Enterprise AI & Cloud Systems across 58 Wilayas",
  brandAccentColor: "#1B4D3E",
  coverBannerUrl:
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
  socialLinks: {
    website: "https://acme.dz",
    linkedin: "https://linkedin.com/company/acme-algerie",
    twitter: "https://x.com/acme_dz",
    github: "https://github.com/acme-dz",
    email: "contact@acme.dz",
    phone: "+213 21 00 00 00",
  },
  rcNumber: "16B0012345",
  nifNumber: "002016012345678",
  nisNumber: "002016012345678",
  articleImposition: "16012345678",
  taxRegime: "REEL",
  isKybVerified: true,
  kybStatus: "APPROVED",
  kybRiskScore: 9.5,
  memberCount: 42,
  averageRating: 4.9,
  reviewCount: 18,
  kyb: {
    legalName: "Acme Technologies SARL",
    tradeName: "Acme Tech",
    legalStructure: "SARL",
    rcNumber: "16B0012345",
    nifNumber: "002016012345678",
    status: "APPROVED",
    riskScore: 9.5,
  },
  orgProfile: {
    longDescription:
      "Detailed mission statement and long description of Acme Technologies.",
    mission: "To accelerate sovereign digital transformation in Algeria.",
    culture: "Excellence, ownership, and deep technical craft.",
    benefits: "Health coverage, continuous training, and remote flexibility.",
    specialties: [
      "Cloud Architecture",
      "Enterprise Security",
      "Data Engineering",
    ],
    technologies: ["Next.js", "Python", "FastAPI", "PostgreSQL", "Docker"],
  },
  caseStudies: [
    {
      id: 101,
      organizationId: 1,
      title: "National Telematics Migration",
      slug: "national-telematics-migration",
      clientName: "Algérie Télécom",
      industry: "Telecommunications",
      problemStatement:
        "Legacy monolithic architecture causing latency spikes during peak load.",
      solutionSummary:
        "Engineered distributed event-driven microservices on sovereign infra.",
      roiMetrics: [
        { label: "Cost Reduction", value: "42%" },
        { label: "Deployment Velocity", value: "3.5x" },
      ],
      technologies: ["FastAPI", "Redis", "Kubernetes"],
      isFeatured: true,
      createdAt: "2026-01-15T00:00:00Z",
    },
  ],
  leadership: [
    {
      id: 201,
      organizationId: 1,
      fullName: "Amine Benali",
      roleTitle: "PDG / CEO",
      bio: "Former Chief Architect with 15+ years leading Algerian enterprise systems.",
      avatarUrl: null,
      linkedinUrl: "https://linkedin.com/in/amine-benali",
      displayOrder: 1,
      isExecutive: true,
    },
    {
      id: 202,
      organizationId: 1,
      fullName: "Yasmine Mansouri",
      roleTitle: "Directrice Administrative et Financière (DAF)",
      bio: "CPA and corporate finance specialist handling Article 169 CIDTA compliance.",
      avatarUrl: null,
      linkedinUrl: "https://linkedin.com/in/yasmine-mansouri",
      displayOrder: 2,
      isExecutive: true,
    },
    {
      id: 203,
      organizationId: 1,
      fullName: "Karim Zerrouki",
      roleTitle: "Chief Technology Officer (CTO)",
      bio: "Distributed systems expert and open-source contributor.",
      avatarUrl: null,
      linkedinUrl: "https://linkedin.com/in/karim-zerrouki",
      displayOrder: 3,
      isExecutive: true,
    },
  ],
  companyReviews: [
    {
      id: 301,
      organizationId: 1,
      reviewerId: 501,
      contractId: 701,
      reviewerType: "FREELANCER",
      overallRating: 5.0,
      paymentPromptnessRating: 5.0,
      scopeClarityRating: 4.8,
      communicationRating: 4.9,
      title: "Exceptional promptness and crystal-clear milestones",
      comment:
        "Flawless collaboration, payment escrow released immediately upon sign-off.",
      isVerifiedContract: true,
      createdAt: "2026-02-10T12:00:00Z",
    },
  ],
  datasets: [
    {
      id: 401,
      name: "Algerian Logistics Index 2026",
      description: "Benchmark telemetry dataset across 58 Wilayas.",
      rowsCount: 450000,
      createdAt: "2026-03-01T00:00:00Z",
    },
  ],
  projects: [
    {
      id: 501,
      title: "Sovereign Document Vault",
      description: "Zero-knowledge encrypted corporate records platform.",
      status: "COMPLETED",
      category: "Security",
    },
  ],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("OrganizationPublicProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { slug: "acme-tech-algeria" };
    (api.getOrganizationBySlug as any).mockResolvedValue(mockOrgData);
  });

  it("renders header identity, legal & trading names, and KYB badge", async () => {
    render(<OrganizationPublicProfilePage />);

    expect(screen.getByTestId("loading-state")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Acme Technologies SARL")).toBeInTheDocument();
    });

    // DBA badge
    expect(
      screen.getByText("organizations.publicProfile.dba: Acme Tech"),
    ).toBeInTheDocument();

    // KYB Verified badge
    expect(
      screen.getByText("organizations.publicProfile.kybBadge"),
    ).toBeInTheDocument();

    // Sector & City
    expect(screen.getByText("Technology & Software")).toBeInTheDocument();
    expect(screen.getByText("Algiers, Algeria")).toBeInTheDocument();

    // Risk Score
    expect(
      screen.getByText("organizations.publicProfile.kybRiskScore"),
    ).toBeInTheDocument();
  });

  it("renders corporate branding kit, tagline, trust badges, and fiscal shield", async () => {
    render(<OrganizationPublicProfilePage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Pioneering Sovereign Enterprise AI & Cloud Systems across 58 Wilayas",
        ),
      ).toBeInTheDocument();
    });

    // Trust badges
    expect(
      screen.getByText("organizations.publicProfile.trustCnrc"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.publicProfile.trustAnae"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.publicProfile.trustIso"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.publicProfile.trustEnterprise"),
    ).toBeInTheDocument();

    // Fiscal shield banner (Article 169 CIDTA)
    expect(
      screen.getByText("organizations.publicProfile.fiscalShieldTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.publicProfile.fiscalShieldDesc"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.publicProfile.fiscalShieldBadge"),
    ).toBeInTheDocument();

    // External links and contact channels
    expect(
      screen.getByText("organizations.publicProfile.channels.website"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.publicProfile.channels.linkedin"),
    ).toBeInTheDocument();
    expect(screen.getByText("16B0012345")).toBeInTheDocument();
  });

  it("renders B2B case studies tab with problem, solution, and quantifiable ROI metrics", async () => {
    render(<OrganizationPublicProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Technologies SARL")).toBeInTheDocument();
    });

    // Click on Case Studies tab
    const caseStudiesTab = screen.getByText(
      "organizations.publicProfile.tabs.caseStudies",
    );
    fireEvent.click(caseStudiesTab);

    await waitFor(() => {
      expect(screen.getByTestId("case-studies-section")).toBeInTheDocument();
    });

    expect(
      screen.getByText("National Telematics Migration"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Algérie Télécom • Telecommunications"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Legacy monolithic architecture causing latency spikes during peak load.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Engineered distributed event-driven microservices on sovereign infra.",
      ),
    ).toBeInTheDocument();

    // Quantifiable ROI numbers
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();
    expect(screen.getByText("3.5x")).toBeInTheDocument();
    expect(screen.getByText("Deployment Velocity")).toBeInTheDocument();
  });

  it("renders executive leadership roster (CEO, DAF, CTO) with bios and LinkedIn links", async () => {
    render(<OrganizationPublicProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Technologies SARL")).toBeInTheDocument();
    });

    // Click on Leadership tab
    const leadershipTab = screen.getByText(
      "organizations.publicProfile.tabs.leadership",
    );
    fireEvent.click(leadershipTab);

    await waitFor(() => {
      expect(screen.getByTestId("leadership-section")).toBeInTheDocument();
    });

    // Amine Benali (CEO)
    expect(screen.getByText("Amine Benali")).toBeInTheDocument();
    expect(screen.getByText("PDG / CEO")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Former Chief Architect with 15+ years leading Algerian enterprise systems.",
      ),
    ).toBeInTheDocument();

    // Yasmine Mansouri (DAF)
    expect(screen.getByText("Yasmine Mansouri")).toBeInTheDocument();
    expect(
      screen.getByText("Directrice Administrative et Financière (DAF)"),
    ).toBeInTheDocument();

    // Karim Zerrouki (CTO)
    expect(screen.getByText("Karim Zerrouki")).toBeInTheDocument();
    expect(
      screen.getByText("Chief Technology Officer (CTO)"),
    ).toBeInTheDocument();

    // LinkedIn links
    const linkedinLinks = screen.getAllByText(
      "organizations.publicProfile.leadership.viewLinkedin",
    );
    expect(linkedinLinks.length).toBe(3);
  });

  it("renders two-sided verified reviews with ratings and verified contract badge", async () => {
    render(<OrganizationPublicProfilePage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Technologies SARL")).toBeInTheDocument();
    });

    // Click on Reviews tab
    const reviewsTab = screen.getByText(
      "organizations.publicProfile.tabs.reviews",
    );
    fireEvent.click(reviewsTab);

    await waitFor(() => {
      expect(screen.getByTestId("reviews-section")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Exceptional promptness and crystal-clear milestones"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Flawless collaboration, payment escrow released immediately upon sign-off.",
      ),
    ).toBeInTheDocument();

    // Verified Contract badge
    expect(
      screen.getByText("organizations.publicProfile.reviews.verifiedContract"),
    ).toBeInTheDocument();

    // Freelancer reviewer badge
    expect(
      screen.getByText(
        "organizations.publicProfile.reviews.reviewerTypes.FREELANCER",
      ),
    ).toBeInTheDocument();
  });

  it("renders not found state when API returns an error", async () => {
    (api.getOrganizationBySlug as any).mockRejectedValueOnce(
      new Error("Organization not found"),
    );

    render(<OrganizationPublicProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId("not-found-state")).toBeInTheDocument();
    });

    expect(
      screen.getByText("organizations.publicProfile.state.notFoundTitle"),
    ).toBeInTheDocument();

    const backButton = screen.getByText(
      "organizations.publicProfile.state.backToDirectory",
    );
    fireEvent.click(backButton);
    expect(mockPush).toHaveBeenCalledWith("/organizations");
  });
});
