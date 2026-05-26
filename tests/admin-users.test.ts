import assert from "node:assert/strict";
import test from "node:test";

import {
  approveAdminActionRequest,
  canManageAdminUsers,
  denyAdminActionRequest,
  getAdminActionRequests,
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

test("updateManagedUserRole creates approval requests for sensitive role changes", async () => {
  const fixture = await createAdminUsersFixture("admin-users-role");

  try {
    const result = await updateManagedUserRole({
      actor: fixture.superAdmin,
      targetUserId: fixture.target.id,
      role: "SUPPORT"
    });

    assert.equal(result.status, "REQUESTED");
    assert.ok(result.requestId);

    const target = await prisma.user.findUnique({ where: { id: fixture.target.id } });
    assert.equal(target?.role, "HOST");

    const request = await prisma.adminActionRequest.findUniqueOrThrow({
      where: { id: result.requestId }
    });
    assert.equal(request.status, "PENDING");
    assert.equal(request.previousRole, "HOST");
    assert.equal(request.requestedRole, "SUPPORT");

    const audit = await prisma.auditLog.findFirst({
      where: {
        userId: fixture.superAdmin.id,
        action: "admin.actionRequest.created",
        entityId: result.requestId
      }
    });
    assert.ok(audit);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("approveAdminActionRequest applies pending role changes and audits the review", async () => {
  const fixture = await createAdminUsersFixture("admin-users-approve");

  try {
    const requested = await updateManagedUserRole({
      actor: fixture.superAdmin,
      targetUserId: fixture.target.id,
      role: "CONTENT_EDITOR"
    });

    assert.equal(requested.status, "REQUESTED");
    assert.ok(requested.requestId);

    const approved = await approveAdminActionRequest({
      actor: fixture.superAdmin,
      requestId: requested.requestId
    });

    assert.equal(approved.status, "APPROVED");

    const target = await prisma.user.findUnique({ where: { id: fixture.target.id } });
    assert.equal(target?.role, "CONTENT_EDITOR");

    const request = await prisma.adminActionRequest.findUniqueOrThrow({
      where: { id: requested.requestId }
    });
    assert.equal(request.status, "APPROVED");
    assert.equal(request.reviewedByUserId, fixture.superAdmin.id);
    assert.ok(request.reviewedAt);

    const roleAudit = await prisma.auditLog.findFirst({
      where: {
        userId: fixture.superAdmin.id,
        action: "admin.user.roleChanged",
        entityId: fixture.target.id
      }
    });
    assert.ok(roleAudit);
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});

test("denyAdminActionRequest closes pending role changes without updating the user", async () => {
  const fixture = await createAdminUsersFixture("admin-users-deny");

  try {
    const requested = await updateManagedUserRole({
      actor: fixture.superAdmin,
      targetUserId: fixture.target.id,
      role: "FINANCE"
    });

    assert.equal(requested.status, "REQUESTED");
    assert.ok(requested.requestId);

    const denied = await denyAdminActionRequest({
      actor: fixture.superAdmin,
      requestId: requested.requestId
    });

    assert.equal(denied.status, "DENIED");

    const target = await prisma.user.findUnique({ where: { id: fixture.target.id } });
    assert.equal(target?.role, "HOST");

    const request = await prisma.adminActionRequest.findUniqueOrThrow({
      where: { id: requested.requestId }
    });
    assert.equal(request.status, "DENIED");
    assert.equal(request.reviewedByUserId, fixture.superAdmin.id);
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
    await approveAdminActionRequest({
      actor: fixture.superAdmin,
      requestId: (await prisma.adminActionRequest.findFirstOrThrow({
        where: {
          requestedByUserId: fixture.superAdmin.id,
          targetUserId: fixture.target.id,
          requestedRole: "SUPPORT"
        },
        select: { id: true }
      })).id
    });
    await prisma.userSession.create({
      data: {
        userId: fixture.target.id,
        tokenHash: `${fixture.label}-active-session`,
        ipAddress: "203.0.113.20",
        userAgent: "Unit Test Browser",
        createdBy: "LOGIN",
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    const matchingUsers = await getManagedUsers({
      query: "target",
      role: "SUPPORT"
    });

    assert.ok(matchingUsers.some((user) => user.id === fixture.target.id));
    assert.ok(matchingUsers.every((user) => user.role === "SUPPORT"));
    const targetUser = matchingUsers.find((user) => user.id === fixture.target.id);
    assert.equal(targetUser?.sessions.length, 1);
    assert.equal(targetUser?.sessions[0]?.ipAddress, "203.0.113.20");

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

test("revokeManagedUserSessions revokes target sessions and audits the action", async () => {
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
    assert.equal(await prisma.userSession.count({ where: { userId: fixture.target.id, revokedAt: null } }), 0);
    assert.equal(
      await prisma.userSession.count({
        where: {
          userId: fixture.target.id,
          revokedAt: { not: null },
          revokedByUserId: fixture.superAdmin.id,
          revokeReason: "ADMIN_REVOKE"
        }
      }),
      2
    );

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
      (candidate) => candidate.action === "admin.actionRequest.created" && candidate.entityId
    );
    const authEvent = events.find(
      (candidate) => candidate.action === "auth.login.success" && candidate.entityId === fixture.target.id
    );

    assert.ok(event);
    assert.equal(event.user?.email, fixture.superAdmin.email);
    assert.equal((event.metadata as Record<string, string>).requestedRole, "CONTENT_EDITOR");
    assert.ok(authEvent);
    assert.equal(authEvent.user?.email, fixture.target.email);

    const requests = await getAdminActionRequests(5);
    assert.ok(requests.some((request) => request.targetUserId === fixture.target.id && request.status === "PENDING"));
  } finally {
    await deleteCommerceFixture(fixture.label, fixture.emailDomain);
  }
});
