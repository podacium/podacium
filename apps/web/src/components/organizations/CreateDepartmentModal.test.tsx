import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateDepartmentModal } from "./CreateDepartmentModal";
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

describe("CreateDepartmentModal", () => {
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
    props: Partial<React.ComponentProps<typeof CreateDepartmentModal>> = {},
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CreateDepartmentModal
          isOpen={true}
          onClose={vi.fn()}
          orgId={1}
          {...props}
        />
      </QueryClientProvider>,
    );
  };

  it("renders form fields correctly when open", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "organizations.createDepartment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.departmentNamePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.departmentSlugPlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.costCenterCodePlaceholder"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("organizations.departmentDescPlaceholder"),
    ).toBeInTheDocument();
  });

  it("auto-generates slug as user types department name", () => {
    renderModal();

    const nameInput = screen.getByPlaceholderText(
      "organizations.departmentNamePlaceholder",
    );
    fireEvent.change(nameInput, { target: { value: "Finance & Accounting" } });

    const slugInput = screen.getByPlaceholderText(
      "organizations.departmentSlugPlaceholder",
    ) as HTMLInputElement;
    expect(slugInput.value).toBe("finance-accounting");
  });

  it("validates that department name has at least 2 characters", async () => {
    renderModal();

    const nameInput = screen.getByPlaceholderText(
      "organizations.departmentNamePlaceholder",
    );
    fireEvent.change(nameInput, { target: { value: "A" } });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.createDepartment",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("organizations.nameRequired");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "organizations.nameRequired",
    );
  });

  it("submits valid department data and triggers success lifecycle", async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      id: 10,
      name: "Engineering",
      slug: "engineering",
      code: "CC-ENG-01",
      description: "Core platform engineering unit",
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    renderModal({ onSuccess: handleSuccess, onClose: handleClose });

    const nameInput = screen.getByPlaceholderText(
      "organizations.departmentNamePlaceholder",
    );
    fireEvent.change(nameInput, { target: { value: "Engineering" } });

    const codeInput = screen.getByPlaceholderText(
      "organizations.costCenterCodePlaceholder",
    );
    fireEvent.change(codeInput, { target: { value: "CC-ENG-01" } });

    const descInput = screen.getByPlaceholderText(
      "organizations.departmentDescPlaceholder",
    );
    fireEvent.change(descInput, {
      target: { value: "Core platform engineering unit" },
    });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.createDepartment",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/organizations/1/departments",
        {
          name: "Engineering",
          slug: "engineering",
          code: "CC-ENG-01",
          description: "Core platform engineering unit",
        },
      );
      expect(toast.success).toHaveBeenCalledWith(
        "organizations.departmentCreatedSuccess",
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("handles API rejection and displays error toast", async () => {
    (apiClient.post as any).mockRejectedValueOnce({
      message: "Department code already in use",
    });

    renderModal();

    const nameInput = screen.getByPlaceholderText(
      "organizations.departmentNamePlaceholder",
    );
    fireEvent.change(nameInput, { target: { value: "Operations" } });

    const submitButtons = screen.getAllByRole("button", {
      name: "organizations.createDepartment",
    });
    const submitBtn = submitButtons[submitButtons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Department code already in use",
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Department code already in use",
      );
    });
  });
});
