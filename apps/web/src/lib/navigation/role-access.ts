/**
 * Role-based route gates — single source of truth.
 *
 * The Edge middleware enforces these on every request (fail-closed), and the
 * navigation layer uses the same rules to:
 *   - hide links the signed-in role can never open (no dead ends), and
 *   - skip RSC prefetches the Edge would answer with a redirect (otherwise the
 *     browser logs "Fetch failed loading" for every gated link in view).
 *
 * Keep this module free of server-only imports so it can be used from both the
 * middleware (Edge) and client components.
 */

export type RoleGate = { prefix: string; allowed: readonly string[] };

export const ROLE_GATES: readonly RoleGate[] = [
  // Specific moderation sub-routes allowed for MODERATOR
  { prefix: "/admin/content-review", allowed: ["ADMIN", "MODERATOR"] },
  { prefix: "/admin/appeals", allowed: ["ADMIN", "MODERATOR"] },
  // General admin console: ADMIN only
  { prefix: "/admin", allowed: ["ADMIN"] },
  // Content creation & management — instructor/admin features.
  { prefix: "/learn/create", allowed: ["ADMIN", "INSTRUCTOR"] },
  { prefix: "/learn/manage", allowed: ["ADMIN", "INSTRUCTOR"] },
  // Live session creation.
  { prefix: "/live/create", allowed: ["ADMIN", "INSTRUCTOR"] },
  { prefix: "/live/my-sessions", allowed: ["ADMIN", "INSTRUCTOR"] },
];

const SUPER_ADMIN_ROLES = new Set(["SUPERADMIN", "SUPER_ADMIN"]);

export function normalizeRole(role?: string | null): string | undefined {
  return role ? role.toUpperCase() : undefined;
}

export function resolveRoleGate(pathname: string): RoleGate | null {
  return ROLE_GATES.find((gate) => pathname.startsWith(gate.prefix)) ?? null;
}

/** True when the path is protected by a role gate (independently of the role). */
export function isRoleGatedPath(pathname: string): boolean {
  return resolveRoleGate(pathname) !== null;
}

/**
 * Whether a role may open a path. Ungated paths are open to any authenticated
 * role; gated paths fail closed when the role is missing or not allowed.
 * Must mirror the middleware check exactly.
 */
export function isRoleAllowedForPath(
  role: string | null | undefined,
  pathname: string,
): boolean {
  const gate = resolveRoleGate(pathname);
  if (!gate) return true;

  const userRole = normalizeRole(role);
  if (!userRole) return false;

  const allowed = gate.allowed.map((r) => r.toUpperCase());
  return (
    allowed.includes(userRole) ||
    (allowed.includes("ADMIN") && SUPER_ADMIN_ROLES.has(userRole))
  );
}
