type UserLike = {
  role: string;
};

export type AdminPermission = "overview" | "content" | "payment" | "support" | "outbound";

export const USER_ROLE_OPTIONS = [
  "HOST",
  "PLAYER",
  "ADMIN",
  "SUPER_ADMIN",
  "CONTENT_EDITOR",
  "SUPPORT",
  "FINANCE"
] as const;

const ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  ADMIN: ["overview", "content", "payment", "support", "outbound"],
  SUPER_ADMIN: ["overview", "content", "payment", "support", "outbound"],
  CONTENT_EDITOR: ["overview", "content"],
  FINANCE: ["overview", "payment"],
  SUPPORT: ["overview", "support", "outbound"]
};

export function getAdminPermissions(role: string): AdminPermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function isOperationalAdminRole(role: string) {
  return getAdminPermissions(role).length > 0;
}

export function hasAdminPermission(user: UserLike | null | undefined, permission: AdminPermission) {
  if (!user) return false;
  return getAdminPermissions(user.role).includes(permission);
}

export function isKnownUserRole(role: string) {
  return (USER_ROLE_OPTIONS as readonly string[]).includes(role);
}
