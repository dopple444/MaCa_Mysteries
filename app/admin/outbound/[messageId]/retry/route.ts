import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/auth";
import { logAuditEvent } from "../../../../lib/audit-log";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { retryOutboundMessage } from "../../../../lib/outbound-delivery";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  const { messageId } = await params;
  const message = await prisma.outboundMessage.findUnique({ where: { id: messageId } });
  if (!message) {
    return NextResponse.redirect(new URL("/admin", request.url), 303);
  }

  await retryOutboundMessage(message.id);
  await logAuditEvent({
    userId: user.id,
    partyId: message.partyId,
    action: "outbound.message.retryQueued",
    entityType: "OutboundMessage",
    entityId: message.id,
    metadata: {
      channel: message.channel,
      templateKey: message.templateKey,
      previousStatus: message.status
    }
  });

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
