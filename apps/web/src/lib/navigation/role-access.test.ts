import { describe, expect, it } from "vitest";
import {
  ROLE_GATES,
  isRoleAllowedForPath,
  isRoleGatedPath,
  resolveRoleGate,
} from "./role-access";

describe("role-access gates", () => {
  it("matches the most specific gate first", () => {
    expect(resolveRoleGate("/admin/content-review/42")?.allowed).toEqual([
      "ADMIN",
      "MODERATOR",
    ]);
    expect(resolveRoleGate("/admin/courses")?.allowed).toEqual(["ADMIN"]);
    expect(resolveRoleGate("/learn/create/lesson")?.allowed).toEqual([
      "ADMIN",
      "INSTRUCTOR",
    ]);
    expect(resolveRoleGate("/dashboard")).toBeNull();
  });

  it("flags only gated paths", () => {
    expect(isRoleGatedPath("/admin")).toBe(true);
    expect(isRoleGatedPath("/live/my-sessions")).toBe(true);
    expect(isRoleGatedPath("/learn/courses")).toBe(false);
    expect(isRoleGatedPath("/dashboard")).toBe(false);
  });

  it("allows ADMIN and super admins on the admin console", () => {
    expect(isRoleAllowedForPath("ADMIN", "/admin/mail")).toBe(true);
    expect(isRoleAllowedForPath("admin", "/admin/mail")).toBe(true);
    expect(isRoleAllowedForPath("SUPERADMIN", "/admin/mail")).toBe(true);
    expect(isRoleAllowedForPath("SUPER_ADMIN", "/admin/mail")).toBe(true);
  });

  it("limits MODERATOR to the moderation sub-routes", () => {
    expect(isRoleAllowedForPath("MODERATOR", "/admin/content-review")).toBe(
      true,
    );
    expect(isRoleAllowedForPath("MODERATOR", "/admin/appeals/7")).toBe(true);
    expect(isRoleAllowedForPath("MODERATOR", "/admin/courses")).toBe(false);
    expect(isRoleAllowedForPath("MODERATOR", "/admin/mail")).toBe(false);
  });

  it("allows instructors to author content but not to reach the admin console", () => {
    expect(isRoleAllowedForPath("INSTRUCTOR", "/learn/create")).toBe(true);
    expect(isRoleAllowedForPath("INSTRUCTOR", "/learn/manage")).toBe(true);
    expect(isRoleAllowedForPath("INSTRUCTOR", "/live/my-sessions")).toBe(true);
    expect(isRoleAllowedForPath("INSTRUCTOR", "/admin/courses")).toBe(false);
  });

  it("fails closed for gated paths when the role is missing", () => {
    expect(isRoleAllowedForPath(undefined, "/admin/courses")).toBe(false);
    expect(isRoleAllowedForPath(null, "/admin/courses")).toBe(false);
    expect(isRoleAllowedForPath("", "/admin/courses")).toBe(false);
  });

  it("keeps ungated paths open for every role", () => {
    expect(isRoleAllowedForPath(undefined, "/dashboard")).toBe(true);
    expect(isRoleAllowedForPath("STUDENT", "/learn/courses")).toBe(true);
  });

  it("exposes the gate list for middleware parity", () => {
    expect(ROLE_GATES.length).toBeGreaterThan(0);
    expect(ROLE_GATES[0]).toHaveProperty("prefix");
    expect(ROLE_GATES[0]).toHaveProperty("allowed");
  });
});
