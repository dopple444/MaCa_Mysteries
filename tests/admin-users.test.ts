import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageAdminUsers,
  getManagedUsers,
  getRecentAdminUserEvents,
  revokeManagedUserSessions,
  updateManagedUserRole
} from "../app/lib/admin-users";
import { logAuthAuditEvent } from "../app/lib/auth-audit";
import { deleteCommerceFixture, prisma, uniqueTestLabel } from "./helpers/test-data";

async function createAdminUsersFixture(prefix: string) {
  const label = uniqueTestLabel(prefix);
  const emailDomain = `@${label}.example`;

  await deleteCommerceFixture(label, emailDomain);

  const [superAdmin, admin, target] = await Promise.all([
    prisma.user.create({
      data: {
        email: `super${emailDomain}`,
        name: "Super Admin Test",
        role: "SUPER_ADMIN"
      }
    }),
    prisma.user.create({
      data: {
        email: `admin${emailDomain}`,
        name: "Admin Test",
        role: "ADMIN"
      }
    }),
    prisma.user.create({
      data: {
        email: `target${emailDomain}`,
        name: "Target Test",
        role: "HOST"
      }
    })
  ]);

  return { label, emailDomain, superAdmin, admin, target };
}

test("updateManagedUserRole lets super admins assign scoped roles and audit the change", async () => {
  const fixture = await createAdminUsersFixture("admin-users-role");

  try {
    const result = await updateManagedUserRole({
      actor: fixture.superAdmin,
      targetUserId: fixture.target.id,
      role: "SUPPORT"
    });

    assert.equal(result.status, "UPDATED");

    const target = await prisma.user.findUnique({ where: { id: fixture.target.id } });
    assert.equal(target?.role, "SUPPORT");

    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: fixture.superAdmin.id,
        action: "admin.user.roleChanged",
        entityId: fixture.target.id
      }
    });
    assert.ok(audit);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("getManagedUsers filters accounts by role and search text", async () => {
  const fixture = await createAdminUsersFixture("admin-users-filter");

  try {
    await updateManagedUserRole({
      actor: fixture.superAdmin,
      targetUserId: fixture.target.id,
      role: "SUPPORT"
    });

    const matchingUsers = await getManagedUsers({
      query: "target",
      role: "SUPPORT"
    });

    assert.ok(matchingUsers.some((user) => user.id === fixture.target.id));
    assert.ok(matchingUsers.every((user) => user.role === "SUPPORT"));

    const nonMatchingUsers = await getManagedUsers({
      query: "target",
      role: "FINANCE"
    });
    assert.equal(nonMatchingUsers.some((user) => user.id === fixture.target.id), false);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("updateManagedUserRole blocks regular admins once a super admin exists", async () => {
  const fixture = await createAdminUsersFixture("admin-users-forbidden");

  try {
    assert.equal(await canManageAdminUsers(fixture.admin), false);

    const result = await updateManagedUserRole({
      actor: fixture.admin,
      targetUserId: fixture.target.id,
      role: "FINANCE"
    });

    assert.equal(result.status, "FORBIDDEN");
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("updateManagedUserRole protects the last super admin", async () => {
  const fixture = await createAdminUsersFixture("admin-users-last-super");

  try {
    const result = await updateManagedUserRole({
      actor: fixture.superAdmin,
      targetUserId: fixture.superAdmin.id,
      role: "ADMIN"
    });

    assert.equal(result.status, "LAST_SUPER_ADMIN");
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("revokeManagedUserSessions deletes target sessions and audits the action", async () => {
  const fixture = await createAdminUsersFixture("admin-users-sessions");

  try {
    await prisma.userSession.createMany({
      data: [
        {
          userId: fixture.target.id,
          tokenHash: `${fixture.label}-session-a`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        },
        {
          userId: fixture.target.id,
          tokenHash: `${fixture.label}-session-b`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        }
      ]
    });

    const result = await revokeManagedUserSessions({
      actor: fixture.superAdmin,
      targetUserId: fixture.target.id
    });

    assert.equal(result.status, "REVOKED");
    assert.equal(result.revokedSessionCount, 2);
    assert.equal(await prisma.userSession.count({ where: { userId: fixture.target.id } }), 0);

    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: fixture.superAdmin.id,
        action: "admin.user.sessionsRevoked",
        entityId: fixture.target.id
      }
    });
    assert.ok(audit);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("getRecentAdminUserEvents returns account security audit events with actor details", async () => {
  const fixture = await createAdminUsersFixture("admin-users-events");

  try {
    await Promise.all([
      updateManagedUserRole({
        actor: fixture.superAdmin,
        targetUserId: fixture.target.id,
        role: "CONTENT_EDITOR"
      }),
      logAuthAuditEvent({
        action: "auth.login.success",
        userId: fixture.target.id,
        email: fixture.target.email,
        reason: "verified"
      })
    ]);

    const events = await getRecentAdminUserEvents(5);
    const event = events.find(
      (candidate) => candidate.action === "admin.user.roleChanged" && candidate.entityId === fixture.target.id
    );
    const authEvent = events.find(
      (candidate) => candidate.action === "auth.login.success" && candidate.entityId === fixture.target.id
    );

    assert.ok(event);
    assert.equal(event.user?.email, fixture.superAdmin.email);
    assert.equal((event.metadata as Record<string, string>).nextRole, "CONTENT_EDITOR");
    assert.ok(authEvent);
    assert.equal(authEvent.user?.email, fixture.target.email);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});
