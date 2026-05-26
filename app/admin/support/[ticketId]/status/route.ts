import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../../lib/admin-permissions";
import { createAppUrl } from "../../../../lib/app-url";
import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { prisma } from "../../../../lib/prisma";

const ALLOWED_STATUSES = new Set(["OPEN", "PENDING", "CLOSED"]);

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToTicket(request: Request, ticketId: string) {
  return NextResponse.redirect(createAppUrl(`/admin/support/${ticketId}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }
  if (!hasAdminPermission(user, "support")) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }

  const { ticketId } = await params;
  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.redirect(createAppUrl("/admin", request.url), 303);
  }
  const status = getFormValue(formData, "status").toUpperCase();

  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.redirect(createAppUrl("/admin", request.url), 303);
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true }
  });

  if (!ticket) {
    return NextResponse.redirect(createAppUrl("/admin", request.url), 303);
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status }
  });
  await logAuditEvent({
    action: "support.ticket.statusChanged",
    userId: user.id,
    entityType: "SupportTicket",
    entityId: ticketId,
    metadata: {
      previousStatus: ticket.status,
      status
    }
  });

  return redirectToTicket(request, ticketId);
}
