import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AllocateSeatPoolModal } from "./AllocateSeatPoolModal";
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

const mockPools = [
  {
    id: 101,
    moduleId: "fullstack-algeria-2025",
    pathId: null,
    totalSeats: 25,
    allocatedSeats: 10,
    expiresAt: null,
  },
  {
    id: 102,
    moduleId: "financial-modeling-dzd",
    pathId: null,
    totalSeats: 5,
    allocatedSeats: 5,
    expiresAt: null,
  },
];

const mockDepartments = [
  { id: 1, name: "Engineering", code: "ENG-01" },
  { id: 2, name: "Finance", code: "FIN-01" },
];

describe("AllocateSeatPoolModal", () => {
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
    props: Partial<React.ComponentProps<typeof AllocateSeatPoolModal>> = {},
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AllocateSeatPoolModal
          isOpen={true}
          onClose={vi.fn()}
          orgId={1}
          pools={mockPools}
          departments={mockDepartments}
          {...props}
        />
      </QueryClientProvider>,
    );
  };

  it("renders pool selection, employee email, and department inputs", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "organizations.allocateSeat" }),
    ).toBeInTheDocument();
    expect(screen.getByText("organizations.selectPool")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.employeeEmailPlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("organizations.targetDepartment"),
    ).toBeInTheDocument();
  });

  it("shows remaining seat count hint for selected pool", () => {
    renderModal({ preselectedPoolId: 101 });

    expect(
      screen.getByText("organizations.availableSeats"),
    ).toBeInTheDocument();
  });

  it("validates that email is required and properly formatted", async () => {
    renderModal();

    const emailInput = screen.getByPlaceholderText(
      "organizations.employeeEmailPlaceholder",
    );
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.allocateSeat",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("organizations.emailRequired");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "organizations.emailRequired",
    );
  });

  it("disables submission if selected pool is exhausted", () => {
    renderModal({ preselectedPoolId: 102 });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.allocateSeat",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  it("submits seat allocation successfully to the selected pool", async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      id: 50,
      poolId: 101,
      userId: 77,
      assignedAt: new Date().toISOString(),
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    renderModal({
      preselectedPoolId: 101,
      onSuccess: handleSuccess,
      onClose: handleClose,
    });

    const emailInput = screen.getByPlaceholderText(
      "organizations.employeeEmailPlaceholder",
    );
    fireEvent.change(emailInput, { target: { value: "developer@company.dz" } });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.allocateSeat",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/organizations/1/edtech/pools/101/allocate",
        {
          email: "developer@company.dz",
        },
      );
      expect(toast.success).toHaveBeenCalled();
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("handles user not found or pool errors from backend", async () => {
    (apiClient.post as any).mockRejectedValueOnce({
      detail: "User with email missing@company.dz not found",
    });

    renderModal({ preselectedPoolId: 101 });

    const emailInput = screen.getByPlaceholderText(
      "organizations.employeeEmailPlaceholder",
    );
    fireEvent.change(emailInput, { target: { value: "missing@company.dz" } });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.allocateSeat",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "User with email missing@company.dz not found",
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "User with email missing@company.dz not found",
      );
    });
  });
});
