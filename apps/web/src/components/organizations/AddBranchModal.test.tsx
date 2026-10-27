import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddBranchModal } from "./AddBranchModal";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRtl: false, isRTL: false }),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AddBranchModal", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderModal = (
    props: Partial<React.ComponentProps<typeof AddBranchModal>> = {},
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AddBranchModal isOpen={true} onClose={vi.fn()} orgId={1} {...props} />
      </QueryClientProvider>,
    );
  };

  it("renders all branch fields including 58 wilayas dropdown and headquarters toggle", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "organizations.addBranch" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.branchNamePlaceholder"),
    ).toBeInTheDocument();
    expect(screen.getByText("organizations.branchWilaya")).toBeInTheDocument();
    expect(screen.getByText("organizations.branchCity")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.branchCodePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.branchAddressPlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.branchPhonePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.isHeadquarters"),
    ).toBeInTheDocument();
  });

  it("automatically adjusts city when a wilaya with a mapped city is chosen", () => {
    renderModal();

    const wilayaSelect = screen.getByLabelText(
      "organizations.branchWilaya",
    ) as HTMLSelectElement;
    fireEvent.change(wilayaSelect, { target: { value: "31" } }); // 31 - Oran

    const citySelect = screen.getByLabelText(
      "organizations.branchCity",
    ) as HTMLSelectElement;
    expect(citySelect.value).toBe("ORAN");
  });

  it("validates that branch name has at least 2 characters", async () => {
    renderModal();

    const nameInput = screen.getByPlaceholderText(
      "organizations.branchNamePlaceholder",
    );
    fireEvent.change(nameInput, { target: { value: "X" } });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.addBranch",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("organizations.nameRequired");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "organizations.nameRequired",
    );
  });

  it("submits valid branch data and triggers success lifecycle", async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      id: 5,
      organizationId: 1,
      name: "Oran Regional Hub",
      code: "ORN-01",
      wilayaCode: 31,
      city: "ORAN",
      address: "12 Boulevard Front de Mer",
      phoneNumber: "+213 41 23 45 67",
      isHeadquarters: true,
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    renderModal({ onSuccess: handleSuccess, onClose: handleClose });

    const nameInput = screen.getByPlaceholderText(
      "organizations.branchNamePlaceholder",
    );
    fireEvent.change(nameInput, { target: { value: "Oran Regional Hub" } });

    const wilayaSelect = screen.getByLabelText("organizations.branchWilaya");
    fireEvent.change(wilayaSelect, { target: { value: "31" } });

    const codeInput = screen.getByPlaceholderText(
      "organizations.branchCodePlaceholder",
    );
    fireEvent.change(codeInput, { target: { value: "ORN-01" } });

    const addressInput = screen.getByPlaceholderText(
      "organizations.branchAddressPlaceholder",
    );
    fireEvent.change(addressInput, {
      target: { value: "12 Boulevard Front de Mer" },
    });

    const phoneInput = screen.getByPlaceholderText(
      "organizations.branchPhonePlaceholder",
    );
    fireEvent.change(phoneInput, { target: { value: "+213 41 23 45 67" } });

    const hqSwitch = screen.getByRole("switch");
    fireEvent.click(hqSwitch);

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.addBranch",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/organizations/1/branches",
        {
          name: "Oran Regional Hub",
          code: "ORN-01",
          wilayaCode: 31,
          city: "ORAN",
          address: "12 Boulevard Front de Mer",
          phoneNumber: "+213 41 23 45 67",
          isHeadquarters: true,
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "organizations.branchCreatedSuccess",
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("handles server error response gracefully", async () => {
    (apiClient.post as any).mockRejectedValueOnce({
      detail: "Branch code already exists",
    });

    renderModal();

    const nameInput = screen.getByPlaceholderText(
      "organizations.branchNamePlaceholder",
    );
    fireEvent.change(nameInput, { target: { value: "Duplicate Branch" } });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.addBranch",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Branch code already exists");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Branch code already exists",
      );
    });
  });
});
