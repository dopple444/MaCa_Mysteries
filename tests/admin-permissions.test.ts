import assert from "node:assert/strict";
import test from "node:test";

import { getAdminPermissions, hasAdminPermission, isOperationalAdminRole } from "../app/lib/admin-permissions";

test("admin role permissions separate content, payment, support, and outbound areas", () => {
  assert.deepEqual(getAdminPermissions("ADMIN"), ["overview", "content", "payment", "support", "outbound"]);
  assert.deepEqual(getAdminPermissions("SUPER_ADMIN"), ["overview", "content", "payment", "support", "outbound"]);
  assert.deepEqual(getAdminPermissions("CONTENT_EDITOR"), ["overview", "content"]);
  assert.deepEqual(getAdminPermissions("FINANCE"), ["overview", "payment"]);
  assert.deepEqual(getAdminPermissions("SUPPORT"), ["overview", "support", "outbound"]);
  assert.deepEqual(getAdminPermissions("HOST"), []);

  assert.equal(isOperationalAdminRole("SUPPORT"), true);
  assert.equal(isOperationalAdminRole("HOST"), false);
  assert.equal(hasAdminPermission({ role: "FINANCE" }, "payment"), true);
  assert.equal(hasAdminPermission({ role: "FINANCE" }, "content"), false);
  assert.equal(hasAdminPermission({ role: "SUPPORT" }, "outbound"), true);
});
