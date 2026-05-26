type UserLike = {
  role: string;
};

export type AdminPermission = "overview" | "content" | "payment" | "support" | "outbound";

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
