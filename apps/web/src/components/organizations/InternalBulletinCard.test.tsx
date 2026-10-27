import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InternalBulletinCard } from "./InternalBulletinCard";
import { api, OrganizationResponse } from "@/lib/api";

// Mock i18n
vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    updateOrganization: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

describe("InternalBulletinCard", () => {
  const baseOrg: OrganizationResponse = {
    id: 1,
    name: "Podacium Corp",
    sector: "TECHNOLOGY",
    city: "ALGIERS",
    country: "ALGERIA",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    internalBulletin: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no notices exist and shows post button for admins", () => {
    render(<InternalBulletinCard organization={baseOrg} canEdit={true} />);

    expect(screen.getByText("organizations.bulletinTitle")).toBeInTheDocument();
    expect(screen.getByText("organizations.bulletinEmpty")).toBeInTheDocument();
    expect(
      screen.getAllByText("organizations.postNotice").length,
    ).toBeGreaterThan(0);
  });

  it("renders pinned and regular notices with markdown content", () => {
    const notices = [
      {
        id: "notice-1",
        title: "Welcome to New Hires",
        content: "# Onboarding\n- Read employee wiki\n- Join `#general` Slack",
        category: "ONBOARDING",
        pinned: true,
        link: "https://wiki.podacium.dz/onboarding",
        createdAt: "2026-02-01T10:00:00Z",
      },
    ];

    const orgWithNotices: OrganizationResponse = {
      ...baseOrg,
      internalBulletin: JSON.stringify(notices),
    };

    render(
      <InternalBulletinCard organization={orgWithNotices} canEdit={false} />,
    );

    expect(screen.getByText("Welcome to New Hires")).toBeInTheDocument();
    expect(screen.getByText("organizations.pinnedBadge")).toBeInTheDocument();
    expect(
      screen.getByText("organizations.categoryOnboarding"),
    ).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Read employee wiki")).toBeInTheDocument();
    expect(screen.getByText("organizations.categoryLink")).toBeInTheDocument();
  });

  it("opens post notice modal and saves notice via api.updateOrganization", async () => {
    const onUpdated = vi.fn();
    render(
      <InternalBulletinCard
        organization={baseOrg}
        canEdit={true}
        onUpdated={onUpdated}
      />,
    );

    const postBtn = screen.getAllByText("organizations.postNotice")[0];
    fireEvent.click(postBtn);

    expect(screen.getByText("organizations.noticeTitle")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("organizations.noticeTitle");
    const contentInput = screen.getByPlaceholderText(
      "organizations.noticeContent",
    );

    fireEvent.change(titleInput, { target: { value: "Sprint Review Notice" } });
    fireEvent.change(contentInput, {
      target: { value: "All teams please submit slides before 3 PM." },
    });

    const submitBtn = screen.getByText("organizations.saveBulletin");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.updateOrganization).toHaveBeenCalledTimes(1);
      expect(api.updateOrganization).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          internalBulletin: expect.stringContaining("Sprint Review Notice"),
        }),
      );
      expect(onUpdated).toHaveBeenCalledTimes(1);
    });
  });
});
