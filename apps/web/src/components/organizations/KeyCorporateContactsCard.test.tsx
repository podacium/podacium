import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeyCorporateContactsCard } from "./KeyCorporateContactsCard";
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

describe("KeyCorporateContactsCard", () => {
  const baseOrg: OrganizationResponse = {
    id: 1,
    name: "Podacium Cloud",
    slug: "podacium",
    sector: "TECHNOLOGY",
    city: "ALGIERS",
    country: "ALGERIA",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    keyContacts: {
      admin: {
        name: "Amine Admin",
        email: "amine@podacium.dz",
        phone: "+213555112233",
      },
      daf: {
        name: "Fatima Zahra DAF",
        email: "daf@podacium.dz",
        phone: "+213555998877",
      },
      it: { name: "Karim IT Helpdesk", email: "it@podacium.dz" },
      hr: { name: "Yasmine RH", email: "rh@podacium.dz" },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders key corporate contacts cards correctly", () => {
    render(<KeyCorporateContactsCard organization={baseOrg} canEdit={false} />);

    expect(screen.getByText("organizations.contactsTitle")).toBeInTheDocument();
    expect(screen.getByText("Amine Admin")).toBeInTheDocument();
    expect(screen.getByText("Fatima Zahra DAF")).toBeInTheDocument();
    expect(screen.getByText("Karim IT Helpdesk")).toBeInTheDocument();
    expect(screen.getByText("Yasmine RH")).toBeInTheDocument();

    expect(screen.getByText("amine@podacium.dz")).toBeInTheDocument();
    expect(screen.getByText("daf@podacium.dz")).toBeInTheDocument();
  });

  it("allows admin to open edit modal and save updated contacts", async () => {
    const onUpdated = vi.fn();
    render(
      <KeyCorporateContactsCard
        organization={baseOrg}
        canEdit={true}
        onUpdated={onUpdated}
      />,
    );

    const editBtn = screen.getByText("organizations.editContacts");
    fireEvent.click(editBtn);

    const saveBtn = screen.getByText("organizations.saveContacts");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.updateOrganization).toHaveBeenCalledTimes(1);
      expect(onUpdated).toHaveBeenCalledTimes(1);
    });
  });
});
