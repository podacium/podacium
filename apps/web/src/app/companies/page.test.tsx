import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CompaniesDirectoryPage from "./page";
import { api, PublicOrganizationSummary } from "@/lib/api";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      layout,
      whileTap,
      ...props
    }: any) => <div {...props}>{children}</div>,
    button: ({ children, whileTap, transition, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/companies",
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock i18n
vi.mock("@/lib/i18n", async () => {
  const organizationsEn =
    await import("../../../locales/en/organizations.json");
  const commonEn = await import("../../../locales/en/common.json");

  const dictionary: Record<string, any> = {
    ...organizationsEn.default,
    common: commonEn.default,
    organizations: organizationsEn.default,
  };

  const resolve = (obj: any, path: string) => {
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) cur = cur[p];
      else return undefined;
    }
    return cur;
  };

  return {
    useTranslations: () => {
      const t = (key: string, vars?: any) => {
        let text = resolve(dictionary, key);
        if (text === undefined && key.startsWith("organizations.")) {
          text = resolve(
            organizationsEn.default,
            key.replace("organizations.", ""),
          );
        }
        if (typeof text !== "string") return key;
        if (vars && typeof vars === "object") {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replace(`{${k}}`, String(v));
          }
        }
        return text;
      };
      t.isolate = (str: string) => str;
      return t;
    },
    useLocale: () => "en",
    useBidi: () => ({ dir: "ltr", isRTL: false }),
  };
});

// Mock API
vi.mock("@/lib/api", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    api: {
      ...actual.api,
      getPublicOrganizationDirectory: vi.fn(),
    },
  };
});

const mockCompanies: PublicOrganizationSummary[] = [
  {
    id: 1,
    name: "Sonatrach Energie",
    slug: "sonatrach-energie",
    city: "ALGIERS",
    country: "ALGERIA",
    sector: "ENERGY_AND_OIL_AND_GAS",
    website: "https://sonatrach.dz",
    tagline:
      "National leader in hydrocarbon exploration, refining, petrochemicals, and energy distribution across all 58 Wilayas.",
    companySizeBracket: "ENTERPRISE_500_PLUS",
    operationalScale: "NATIONAL_58_WILAYAS",
    primaryLanguages: ["ARABIC", "FRENCH", "ENGLISH"],
    brandAccentColor: "#0D9488",
    coverBannerUrl: null,
    logoUrl: null,
    isKybVerified: true,
    kybStatus: "APPROVED",
    averageRating: 4.8,
    reviewCount: 32,
    caseStudyCount: 5,
    createdAt: "2024-01-15T08:00:00Z",
  },
  {
    id: 2,
    name: "Yassir Technologies",
    slug: "yassir-technologies",
    city: "ALGIERS",
    country: "ALGERIA",
    sector: "TECHNOLOGY_AND_SOFTWARE",
    website: "https://yassir.com",
    tagline:
      "Super-app ecosystem offering ride-hailing, on-demand food delivery, courier logistics, and financial technology services.",
    companySizeBracket: "LARGE_201_500",
    operationalScale: "NATIONAL_58_WILAYAS",
    primaryLanguages: ["ARABIC", "FRENCH"],
    brandAccentColor: "#4F46E5",
    coverBannerUrl: "https://example.com/banner-yassir.jpg",
    logoUrl: "https://example.com/logo-yassir.png",
    isKybVerified: true,
    kybStatus: "APPROVED",
    averageRating: 4.6,
    reviewCount: 45,
    caseStudyCount: 8,
    createdAt: "2024-02-10T09:30:00Z",
  },
  {
    id: 3,
    name: "Oran Agri-Food Solutions",
    slug: "oran-agri-food",
    city: "ORAN",
    country: "ALGERIA",
    sector: "AGRICULTURE_AND_FOOD_PRODUCTION",
    website: "https://oran-agri.dz",
    tagline:
      "Sustainable olive oil production, citrus harvesting, and high-tech agronomical processing.",
    companySizeBracket: "SMALL_11_50",
    operationalScale: "REGIONAL",
    primaryLanguages: ["FRENCH", "ARABIC"],
    brandAccentColor: "#16A34A",
    coverBannerUrl: null,
    logoUrl: null,
    isKybVerified: false,
    kybStatus: "PENDING",
    averageRating: 3.9,
    reviewCount: 6,
    caseStudyCount: 1,
    createdAt: "2024-03-01T12:00:00Z",
  },
  {
    id: 4,
    name: "Constantine BioHealth Lab",
    slug: "constantine-biohealth",
    city: "CONSTANTINE",
    country: "ALGERIA",
    sector: "HEALTHCARE_AND_PHARMACEUTICALS",
    website: "https://constantine-health.dz",
    tagline:
      "Clinical pathology laboratory specializing in oncology genomics and high-precision blood analysis.",
    companySizeBracket: "MID_51_200",
    operationalScale: "REGIONAL",
    primaryLanguages: ["FRENCH"],
    brandAccentColor: "#DC2626",
    coverBannerUrl: null,
    logoUrl: null,
    isKybVerified: false,
    kybStatus: "UNVERIFIED",
    averageRating: 0.0,
    reviewCount: 0,
    caseStudyCount: 0,
    createdAt: "2024-04-12T14:15:00Z",
  },
];

describe("CompaniesDirectoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getPublicOrganizationDirectory as any).mockResolvedValue(
      mockCompanies,
    );
  });

  it("renders page header, search input, filter selects, and company cards", async () => {
    render(<CompaniesDirectoryPage />);

    // Header & badge
    expect(
      screen.getAllByText("Algerian Enterprise & Company Directory").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ecosystem Discovery")).toBeInTheDocument();

    // Search input
    expect(
      screen.getByPlaceholderText(
        "Search companies by name, tagline, sector, or keywords...",
      ),
    ).toBeInTheDocument();

    // Filters
    expect(screen.getByLabelText("Filter by Wilaya")).toBeInTheDocument();
    expect(screen.getByLabelText("Industry Sector")).toBeInTheDocument();
    expect(screen.getByLabelText("Company Size Bracket")).toBeInTheDocument();
    expect(screen.getByText("CNRC Verified Only")).toBeInTheDocument();

    // Wait for companies to render
    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
      expect(screen.getByText("Yassir Technologies")).toBeInTheDocument();
      expect(screen.getByText("Oran Agri-Food Solutions")).toBeInTheDocument();
      expect(screen.getByText("Constantine BioHealth Lab")).toBeInTheDocument();
    });

    // Check count
    expect(screen.getByText("4 companies found")).toBeInTheDocument();
  });

  it("renders card details: badges, sector, wilaya, rating, and View Showcase links pointing to /org/[slug]", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    // Verified badge
    const verifiedBadges = screen.getAllByText("CNRC Verified");
    expect(verifiedBadges.length).toBeGreaterThanOrEqual(2);

    // Unverified badge
    const unverifiedBadges = screen.getAllByText("Unverified");
    expect(unverifiedBadges.length).toBeGreaterThanOrEqual(2);

    // Wilayas
    expect(screen.getAllByText("16 - Alger").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("31 - Oran").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("25 - Constantine").length,
    ).toBeGreaterThanOrEqual(1);

    // Ratings
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("(32)")).toBeInTheDocument();

    // View Showcase links
    const showcaseLinks = screen.getAllByRole("link", {
      name: /view showcase/i,
    });
    expect(showcaseLinks.length).toBe(4);
    expect(showcaseLinks[0].closest("a")).toHaveAttribute(
      "href",
      "/org/sonatrach-energie",
    );
    expect(showcaseLinks[1].closest("a")).toHaveAttribute(
      "href",
      "/org/yassir-technologies",
    );
  });

  it("filters companies in real time by search query", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, { target: { value: "Yassir" } });

    await waitFor(() => {
      expect(screen.getByText("Yassir Technologies")).toBeInTheDocument();
      expect(screen.queryByText("Sonatrach Energie")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Oran Agri-Food Solutions"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Constantine BioHealth Lab"),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("1 companies found")).toBeInTheDocument();
  });

  it("filters companies by 58 Wilayas mapping", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    const wilayaSelect = screen.getByLabelText("Filter by Wilaya");
    // Select 31 (Oran)
    fireEvent.change(wilayaSelect, { target: { value: "31" } });

    await waitFor(() => {
      expect(screen.getByText("Oran Agri-Food Solutions")).toBeInTheDocument();
      expect(screen.queryByText("Sonatrach Energie")).not.toBeInTheDocument();
      expect(screen.queryByText("Yassir Technologies")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Constantine BioHealth Lab"),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("1 companies found")).toBeInTheDocument();
  });

  it("filters companies by Industry Sector enum", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    const sectorSelect = screen.getByLabelText("Industry Sector");
    fireEvent.change(sectorSelect, {
      target: { value: "HEALTHCARE_AND_PHARMACEUTICALS" },
    });

    await waitFor(() => {
      expect(screen.getByText("Constantine BioHealth Lab")).toBeInTheDocument();
      expect(screen.queryByText("Sonatrach Energie")).not.toBeInTheDocument();
      expect(screen.queryByText("Yassir Technologies")).not.toBeInTheDocument();
    });

    expect(screen.getByText("1 companies found")).toBeInTheDocument();
  });

  it("filters companies by size bracket", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    const sizeSelect = screen.getByLabelText("Company Size Bracket");
    fireEvent.change(sizeSelect, { target: { value: "ENTERPRISE_500_PLUS" } });

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
      expect(screen.queryByText("Yassir Technologies")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Oran Agri-Food Solutions"),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("1 companies found")).toBeInTheDocument();
  });

  it("filters companies by KYB Verified only status", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    const kybButton = screen.getByRole("button", {
      name: /cnrc verified only/i,
    });
    fireEvent.click(kybButton);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
      expect(screen.getByText("Yassir Technologies")).toBeInTheDocument();
      expect(
        screen.queryByText("Oran Agri-Food Solutions"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Constantine BioHealth Lab"),
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("2 companies found")).toBeInTheDocument();
  });

  it("toggles between Grid and List view modes", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    // Default is Grid view
    const listBtn = screen.getByRole("button", { name: "List View" });
    fireEvent.click(listBtn);

    // Card should still be visible in list view
    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
      expect(screen.getByText("Yassir Technologies")).toBeInTheDocument();
    });

    // Switch back to grid
    const gridBtn = screen.getByRole("button", { name: "Grid View" });
    fireEvent.click(gridBtn);
    expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
  });

  it("shows empty state and allows resetting filters when no companies match", async () => {
    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });

    const searchInput = screen.getByRole("searchbox");
    fireEvent.change(searchInput, {
      target: { value: "NonExistentCompanyXYZ" },
    });

    await waitFor(() => {
      expect(
        screen.getByText("No companies match your filters"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Try broadening your search query or resetting Wilaya and sector filters.",
        ),
      ).toBeInTheDocument();
    });

    // Click reset filters
    const resetButtons = screen.getAllByRole("button", {
      name: /reset filters/i,
    });
    fireEvent.click(resetButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
      expect(screen.getByText("Yassir Technologies")).toBeInTheDocument();
    });
  });

  it("handles API error with retry action", async () => {
    (api.getPublicOrganizationDirectory as any).mockRejectedValueOnce(
      new Error("Network timeout"),
    );

    render(<CompaniesDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByText("Network timeout")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    (api.getPublicOrganizationDirectory as any).mockResolvedValueOnce(
      mockCompanies,
    );
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Sonatrach Energie")).toBeInTheDocument();
    });
  });
});
