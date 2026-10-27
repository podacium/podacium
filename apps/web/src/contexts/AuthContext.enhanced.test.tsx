import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import * as apiModule from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    getCurrentUserLight: vi.fn(),
    getCurrentUserProfile: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  AuthenticationError: class AuthenticationError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "AuthenticationError";
    }
  },
  handleApiError: (e: any) => e?.message || "Unknown error",
}));

const mockApi = vi.mocked(apiModule.api);

function TestConsumer() {
  const { user, loading, isAuthenticated, error, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user?.fullName || "none"}</span>
      <span data-testid="error">{error || "none"}</span>
      <button
        data-testid="login-btn"
        onClick={async () => {
          try {
            await login("test@test.com", "pass");
          } catch {}
        }}
      >
        Login
      </button>
      <button
        data-testid="logout-btn"
        onClick={async () => {
          try {
            await logout();
          } catch {}
        }}
      >
        Logout
      </button>
    </div>
  );
}

describe("AuthContext Enhanced", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "podacium_auth_hint=; max-age=0";
    document.cookie = "access_token=; max-age=0";
  });

  it("shows loading state on mount", () => {
    document.cookie = "access_token=1; path=/";
    mockApi.getCurrentUserLight.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("sets authenticated after successful init", async () => {
    document.cookie = "podacium_auth_hint=1; path=/";
    mockApi.getCurrentUserLight.mockResolvedValue({
      id: 1,
      fullName: "Test User",
      email: "test@test.com",
      role: "STUDENT",
      emailVerified: true,
      onboardingCompleted: true,
    });
    mockApi.getCurrentUserProfile.mockResolvedValue({
      id: 1,
      fullName: "Test User",
      email: "test@test.com",
      role: "STUDENT",
      emailVerified: true,
      onboardingCompleted: true,
      skills: [],
      memberships: [],
      certificates: [],
      enrollments: [],
      lessonProgresses: [],
      instructedModules: [],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });
  });

  it("is unauthenticated when init fails", async () => {
    mockApi.getCurrentUserLight.mockRejectedValue(new Error("Unauthorized"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("none");
    });
  });

  it("handles login success", async () => {
    mockApi.getCurrentUserLight.mockRejectedValue(new Error("Unauthorized"));
    mockApi.login.mockResolvedValue({
      user: {
        id: 1,
        fullName: "Logged In",
        email: "test@test.com",
        role: "STUDENT",
        onboardingCompleted: false,
      },
    });
    mockApi.getCurrentUserProfile.mockResolvedValue({
      id: 1,
      fullName: "Logged In",
      email: "test@test.com",
      role: "STUDENT",
      emailVerified: true,
      onboardingCompleted: false,
      skills: [],
      memberships: [],
      certificates: [],
      enrollments: [],
      lessonProgresses: [],
      instructedModules: [],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByTestId("login-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
      expect(screen.getByTestId("user").textContent).toContain("Logged In");
    });
  });

  it("handles login failure", async () => {
    mockApi.getCurrentUserLight.mockRejectedValue(new Error("Unauthorized"));
    mockApi.login.mockRejectedValue(new Error("Invalid credentials"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByTestId("login-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).not.toBe("none");
    });
  });

  it("handles logout", async () => {
    mockApi.getCurrentUserLight.mockRejectedValue(new Error("Unauthorized"));
    mockApi.login.mockResolvedValue({
      user: {
        id: 1,
        fullName: "Test User",
        email: "test@test.com",
        role: "STUDENT",
        onboardingCompleted: true,
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
    });

    await act(async () => {
      screen.getByTestId("login-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });

    await act(async () => {
      screen.getByTestId("logout-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("none");
    });
  });

  it("restores auth from hint cookie", async () => {
    document.cookie = "podacium_auth_hint=1; path=/";
    mockApi.getCurrentUserLight.mockResolvedValue({
      id: 1,
      fullName: "Cookie User",
      email: "test@test.com",
      role: "STUDENT",
      emailVerified: true,
      onboardingCompleted: true,
    });
    mockApi.getCurrentUserProfile.mockResolvedValue({
      id: 1,
      fullName: "Cookie User",
      email: "test@test.com",
      role: "STUDENT",
      emailVerified: true,
      skills: [],
      memberships: [],
      certificates: [],
      enrollments: [],
      lessonProgresses: [],
      instructedModules: [],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
      expect(screen.getByTestId("user").textContent).toBe("Cookie User");
    });
  });

  it("throws error when useAuth used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAuth must be used within an AuthProvider",
    );
    spy.mockRestore();
  });
});
