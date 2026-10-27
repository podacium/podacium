import type { Metadata } from "next";
import { cookies } from "next/headers";
import { generateI18nMetadata } from "@/lib/i18n-metadata";
import { WorkspaceShell } from "@/components/navigation/WorkspaceShell";

export async function generateMetadata(): Promise<Metadata> {
  return generateI18nMetadata({
    key: "learn",
    path: "/learn/create",
    noindex: true,
  });
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const state =
    cookieStore.get("pd_sidebar")?.value === "collapsed"
      ? "collapsed"
      : "expanded";

  return (
    <WorkspaceShell
      sidebarState={state}
      preset="studio"
      labelKey="nav.courseAuthoring"
    >
      {children}
    </WorkspaceShell>
  );
}
