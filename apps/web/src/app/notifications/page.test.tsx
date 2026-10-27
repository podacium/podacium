import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotificationsPage from "./page";
import { NotificationCategory, NotificationPriority } from "@/lib/api";

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

const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/notifications",
}));

vi.mock("@/lib/i18n", () => ({
  useTranslations: () => {
    const t = (key: string, _vars?: any, fallback?: string) => fallback || key;
    t.isolate = (text: string) => text;
    return t;
  },
  useLocale: () => "en",
  useBidi: () => ({ dir: "ltr", isRTL: false }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, email: "test@podacium.com", name: "Test User" },
    isAuthenticated: true,
    loading: false,
    logout: vi.fn(),
  }),
  useOptionalAuth: () => ({
    user: { id: 1, email: "test@podacium.com", name: "Test User" },
    isAuthenticated: true,
    loading: false,
  }),
  useAuthContext: () => ({
    user: { id: 1, email: "test@podacium.com", name: "Test User" },
    isAuthenticated: true,
    loading: false,
  }),
  useOptionalAuthContext: () => ({
    user: { id: 1, email: "test@podacium.com", name: "Test User" },
    isAuthenticated: true,
    loading: false,
  }),
}));

vi.mock("@/hooks/useAuthGuard", () => ({
  useAuthGuard: () => ({
    isAuthenticated: true,
    loading: false,
    showAuthModal: false,
    handleLogin: vi.fn(),
    handleSignup: vi.fn(),
    handleClose: vi.fn(),
  }),
}));

vi.mock("@/components/design-system/PodaciumTabs", () => ({
  default: function MockPodaciumTabs({ tabs, defaultTab, onChange }: any) {
    const [active, setActive] = React.useState(defaultTab || tabs[0]?.id);
    return (
      <div role="tablist">
        {tabs.map((tab: any) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => {
              setActive(tab.id);
              onChange?.(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  },
  PodaciumTabs: ({ tabs, defaultTab, onChange }: any) => {
    const [active, setActive] = React.useState(defaultTab || tabs[0]?.id);
    return (
      <div role="tablist">
        {tabs.map((tab: any) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => {
              setActive(tab.id);
              onChange?.(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  },
}));

const mockNotifications = [
  {
    id: 1,
    user_id: 1,
    title: "New Project Proposal",
    body: "You received a new bid on your project",
    category: NotificationCategory.PROJECT,
    priority: NotificationPriority.HIGH,
    is_read: false,
    created_at: new Date().toISOString(),
    data: { project_id: 42 },
  },
  {
    id: 2,
    user_id: 1,
    title: "Course Completed",
    body: "Congratulations on finishing Data Engineering",
    category: NotificationCategory.COURSE,
    priority: NotificationPriority.NORMAL,
    is_read: true,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    data: { course_id: 101 },
  },
];

const mockMarkAsRead = vi.fn();
const mockMarkAllAsRead = vi.fn();
const mockBulkMarkAsRead = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({
    data: {
      notifications: mockNotifications,
      total: 2,
      unread_count: 1,
    },
    isLoading: false,
    refetch: vi.fn(),
    isRefetching: false,
  }),
  useUnreadCount: () => ({ data: 1 }),
  useNotificationStats: () => ({
    data: {
      total: 2,
      unread: 1,
      read: 1,
      by_category: { PROJECT: 1, COURSE: 1 },
    },
  }),
  useMarkAsRead: () => ({ mutate: mockMarkAsRead }),
  useMarkAllAsRead: () => ({ mutate: mockMarkAllAsRead, isPending: false }),
  useBulkMarkAsRead: () => ({ mutateAsync: mockBulkMarkAsRead }),
  useDeleteNotification: () => ({ mutateAsync: mockDelete }),
  useNotificationPreferences: () => ({
    data: {
      email_notifications: true,
      in_app_notifications: true,
      marketing_emails: false,
    },
    isLoading: false,
  }),
  useUpdateNotificationPreferences: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

describe("NotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notification page title and items", () => {
    render(<NotificationsPage />);

    expect(screen.getByText("notifications.page.title")).toBeInTheDocument();
    expect(screen.getByText("New Project Proposal")).toBeInTheDocument();
    expect(screen.getByText("Course Completed")).toBeInTheDocument();
  });

  it("navigates to source and marks as read on notification row click", () => {
    render(<NotificationsPage />);

    const unreadItem = screen.getByText("New Project Proposal");
    fireEvent.click(unreadItem);

    expect(mockMarkAsRead).toHaveBeenCalledWith(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/hub/projects/42");
  });

  it("filters notifications by tab", () => {
    render(<NotificationsPage />);

    // Click Unread tab
    const unreadTab = screen.getByText("notifications.tabs.unread");
    fireEvent.click(unreadTab);

    expect(screen.getByText("New Project Proposal")).toBeInTheDocument();
    expect(screen.queryByText("Course Completed")).not.toBeInTheDocument();
  });

  it("handles mark all as read action", () => {
    render(<NotificationsPage />);

    const markAllBtn = screen.getByText("notifications.actions.markAllRead");
    fireEvent.click(markAllBtn);

    expect(mockMarkAllAsRead).toHaveBeenCalled();
  });
});
