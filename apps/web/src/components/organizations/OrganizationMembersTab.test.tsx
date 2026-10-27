import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrganizationMembersTab } from "./OrganizationMembersTab";
import {
  api,
  OrganizationResponse,
  OrganizationMemberResponse,
} from "@/lib/api";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

const mockMembers: OrganizationMemberResponse[] = [
  {
    id: 1,
    organizationId: 1,
    userId: 101,
    role: "OWNER",
    createdAt: "2026-01-01T00:00:00Z",
    user: { id: 101, fullName: "Redha Founder", email: "redha@podacium.dz" },
  },
  {
    id: 2,
    organizationId: 1,
    userId: 102,
    role: "ADMIN",
    departmentId: 10,
    createdAt: "2026-01-05T00:00:00Z",
    user: {
      id: 102,
      fullName: "Zakarya Engineer",
      email: "zakarya@podacium.dz",
    },
  },
  {
    id: 3,
    organizationId: 1,
    userId: 103,
    role: "MEMBER",
    departmentId: 20,
    createdAt: "2026-01-10T00:00:00Z",
    user: { id: 103, fullName: "Amina Designer", email: "amina@podacium.dz" },
  },
];

vi.mock("@/lib/api", () => ({
  api: {
    getOrganizationMembers: vi.fn(),
  },
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

describe("OrganizationMembersTab", () => {
  const baseOrg: OrganizationResponse = {
    id: 1,
    name: "Podacium",
    ownerId: 101,
    sector: "TECHNOLOGY",
    city: "ALGIERS",
    country: "ALGERIA",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const departments = [
    { id: 10, name: "Engineering", code: "ENG" },
    { id: 20, name: "Design", code: "DES" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (api.getOrganizationMembers as any).mockResolvedValue(mockMembers);
  });

  it("renders members and department badge after loading", async () => {
    render(
      <OrganizationMembersTab
        organization={baseOrg}
        departments={departments}
        t={(key) => key}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Redha Founder")).toBeInTheDocument();
      expect(screen.getByText("Zakarya Engineer")).toBeInTheDocument();
      expect(screen.getByText("Amina Designer")).toBeInTheDocument();
      expect(screen.getAllByText("Engineering").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Design").length).toBeGreaterThan(0);
    });
  });

  it("filters members by search query (name or email)", async () => {
    render(
      <OrganizationMembersTab
        organization={baseOrg}
        departments={departments}
        t={(key) => key}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Redha Founder")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "organizations.searchMembersPlaceholder",
    );
    fireEvent.change(searchInput, { target: { value: "zakarya" } });

    expect(screen.getByText("Zakarya Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Redha Founder")).not.toBeInTheDocument();
    expect(screen.queryByText("Amina Designer")).not.toBeInTheDocument();
  });

  it("shows empty state when no search results match", async () => {
    render(
      <OrganizationMembersTab
        organization={baseOrg}
        departments={departments}
        t={(key) => key}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Redha Founder")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "organizations.searchMembersPlaceholder",
    );
    fireEvent.change(searchInput, { target: { value: "nonexistent-user" } });

    expect(
      screen.getByText("organizations.noMembersFound"),
    ).toBeInTheDocument();

    const resetBtn = screen.getAllByText("organizations.clearFilters")[0];
    fireEvent.click(resetBtn);

    expect(screen.getByText("Redha Founder")).toBeInTheDocument();
  });
});
