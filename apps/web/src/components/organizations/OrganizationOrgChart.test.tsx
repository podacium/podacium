import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OrganizationOrgChart } from "./OrganizationOrgChart";
import { OrganizationResponse, OrganizationMemberResponse } from "@/lib/api";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

describe("OrganizationOrgChart", () => {
  const baseOrg: OrganizationResponse = {
    id: 1,
    name: "Sonatrach Systems",
    sector: "ENERGY",
    city: "ALGIERS",
    country: "ALGERIA",
    timeZone: "Africa/Algiers",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const departments = [
    { id: 10, name: "Engineering & Cloud", code: "CC-ENG-01" },
    { id: 20, name: "Finance & Accounting", code: "CC-FIN-02" },
  ];

  const branches = [
    {
      id: 101,
      name: "Algiers Headquarters",
      wilayaCode: 16,
      city: "Algiers",
      isHeadquarters: true,
    },
    {
      id: 102,
      name: "Oran Regional Branch",
      wilayaCode: 31,
      city: "Oran",
      isHeadquarters: false,
    },
  ];

  const members: OrganizationMemberResponse[] = [
    {
      id: 1,
      organizationId: 1,
      userId: 100,
      role: "ADMIN",
      departmentId: 10,
      createdAt: "2026-01-01T00:00:00Z",
      user: {
        id: 100,
        fullName: "Sofiane Cloud Lead",
        email: "sofiane@sonatrach.dz",
      },
    },
    {
      id: 2,
      organizationId: 1,
      userId: 200,
      role: "MEMBER",
      departmentId: null, // Unassigned
      createdAt: "2026-01-01T00:00:00Z",
      user: {
        id: 200,
        fullName: "Nadia Specialist",
        email: "nadia@sonatrach.dz",
      },
    },
  ];

  it("renders the root node with organization name, timezone, and branches", () => {
    render(
      <OrganizationOrgChart
        organization={baseOrg}
        departments={departments}
        branches={branches}
        members={members}
      />,
    );

    expect(screen.getByText("Sonatrach Systems")).toBeInTheDocument();
    expect(screen.getByText("Africa/Algiers")).toBeInTheDocument();
    expect(screen.getByText("Algiers Headquarters")).toBeInTheDocument();
    expect(screen.getByText("Oran Regional Branch")).toBeInTheDocument();
    expect(screen.getByText("W16")).toBeInTheDocument();
    expect(screen.getByText("W31")).toBeInTheDocument();
  });

  it("renders departments and assigned team members in tree view", () => {
    render(
      <OrganizationOrgChart
        organization={baseOrg}
        departments={departments}
        branches={branches}
        members={members}
      />,
    );

    expect(screen.getByText("Engineering & Cloud")).toBeInTheDocument();
    expect(screen.getByText("CC-ENG-01")).toBeInTheDocument();
    expect(screen.getByText("Sofiane Cloud Lead")).toBeInTheDocument();
    expect(screen.getByText("sofiane@sonatrach.dz")).toBeInTheDocument();

    // Unassigned section
    expect(
      screen.getByText("organizations.unassignedMembers"),
    ).toBeInTheDocument();
    expect(screen.getByText("Nadia Specialist")).toBeInTheDocument();
  });

  it("toggles between Tree hierarchy and Cards view", () => {
    render(
      <OrganizationOrgChart
        organization={baseOrg}
        departments={departments}
        branches={branches}
        members={members}
      />,
    );

    const cardsBtn = screen.getByText("organizations.cardsView");
    fireEvent.click(cardsBtn);

    // In cards view, departments grid is rendered
    expect(screen.getByText("Engineering & Cloud")).toBeInTheDocument();
    expect(screen.getByText("Finance & Accounting")).toBeInTheDocument();
  });
});
