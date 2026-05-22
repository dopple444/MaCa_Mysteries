import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { addSupportTicketInternalNote, addSupportTicketReply } from "../../../../lib/support-service";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToTicket(request: Request, ticketId: string) {
  return NextResponse.redirect(new URL(`/admin/support/${ticketId}`, request.url), 303);
}

export async function POST(request: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const { ticketId } = await params;
  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToTicket(request, ticketId);
  }

  const messageType = getFormValue(formData, "messageType").toUpperCase();
  const body = getFormValue(formData, "body");

  if (messageType === "CUSTOMER_REPLY") {
    const result = await addSupportTicketReply({
      ticketId,
      authorUserId: user.id,
      body
    });
    if (result) {
      await logAuditEvent({
        action: "support.ticket.replied",
        userId: user.id,
        entityType: "SupportTicket",
        entityId: ticketId,
        metadata: {
          supportTicketMessageId: result.message.id,
          outboundMessageId: result.outboundMessage.id
        }
      });
    }
    return redirectToTicket(request, ticketId);
  }

  if (messageType === "INTERNAL_NOTE") {
    const message = await addSupportTicketInternalNote({
      ticketId,
      authorUserId: user.id,
      body
    });
    if (message) {
      await logAuditEvent({
        action: "support.ticket.internalNoteAdded",
        userId: user.id,
        entityType: "SupportTicket",
        entityId: ticketId,
        metadata: {
          supportTicketMessageId: message.id
        }
      });
    }
  }

  return redirectToTicket(request, ticketId);
}
