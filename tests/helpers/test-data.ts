import crypto from "node:crypto";

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export function uniqueTestLabel(prefix: string) {
  return `${prefix}-${crypto.randomBytes(6).toString("hex")}`;
}

export async function deleteCommerceFixture(slugPrefix: string, emailDomain: string) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: emailDomain } },
    select: { id: true }
  });
  const userIds = users.map((user) => user.id);

  const games = await prisma.game.findMany({
    where: { slug: { startsWith: slugPrefix } },
    select: { id: true }
  });
  const gameIds = games.map((game) => game.id);

  const products = await prisma.product.findMany({
    where: { gameId: { in: gameIds } },
    select: { id: true }
  });
  const productIds = products.map((product) => product.id);
  const versions = await prisma.gameVersion.findMany({
    where: { gameId: { in: gameIds } },
    select: { id: true }
  });
  const versionIds = versions.map((version) => version.id);
  const rounds = await prisma.gameRound.findMany({
    where: { gameVersionId: { in: versionIds } },
    select: { id: true }
  });
  const roundIds = rounds.map((round) => round.id);
  const parties = await prisma.party.findMany({
    where: {
      OR: [{ gameId: { in: gameIds } }, { hostId: { in: userIds } }]
    },
    select: { id: true }
  });
  const partyIds = parties.map((party) => party.id);

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: { in: userIds } }, { email: { endsWith: emailDomain } }]
    },
    select: { id: true }
  });
  const orderIds = orders.map((order) => order.id);

  await prisma.paymentWebhookEvent.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.userGameAccess.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { gameId: { in: gameIds } }] } });
  await prisma.partyCodeAttempt.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyUnlockEvent.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyAssetView.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyPlayerInteraction.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyPlayerInventory.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyToolInstance.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyCharacterAssignment.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyAccusation.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyFinalRevealState.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyResult.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyEvidenceReveal.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.partyRoundState.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.guest.deleteMany({ where: { partyId: { in: partyIds } } });
  await prisma.party.deleteMany({ where: { id: { in: partyIds } } });
  await prisma.adminActionRequest.deleteMany({
    where: {
      OR: [
        { requestedByUserId: { in: userIds } },
        { targetUserId: { in: userIds } },
        { reviewedByUserId: { in: userIds } }
      ]
    }
  });
  await prisma.orderItem.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { productId: { in: productIds } }] } });
  await prisma.order.deleteMany({
    where: {
      OR: [{ id: { in: orderIds } }, { userId: { in: userIds } }, { email: { endsWith: emailDomain } }]
    }
  });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.gameCard.deleteMany({ where: { gameRoundId: { in: roundIds } } });
  await prisma.gameDigitalArtifact.deleteMany({ where: { gameVersionId: { in: versionIds } } });
  await prisma.gameUnlockRule.deleteMany({ where: { gameVersionId: { in: versionIds } } });
  await prisma.gameCharacterTool.deleteMany({ where: { gameVersionId: { in: versionIds } } });
  await prisma.gameMediaAsset.deleteMany({ where: { gameVersionId: { in: versionIds } } });
  await prisma.gameEvidence.deleteMany({ where: { gameVersionId: { in: versionIds } } });
  await prisma.gameFinalReveal.deleteMany({ where: { gameVersionId: { in: versionIds } } });
  await prisma.gameRound.deleteMany({ where: { id: { in: roundIds } } });
  await prisma.gameCharacter.deleteMany({ where: { gameVersionId: { in: versionIds } } });
  await prisma.gameVersion.deleteMany({ where: { gameId: { in: gameIds } } });
  await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.outboundMessage.deleteMany({
    where: {
      OR: [{ userId: { in: userIds } }, { recipient: { endsWith: emailDomain } }]
    }
  });
  const supportTickets = await prisma.supportTicket.findMany({
    where: { OR: [{ userId: { in: userIds } }, { email: { endsWith: emailDomain } }] },
    select: { id: true }
  });
  const supportTicketIds = supportTickets.map((ticket) => ticket.id);
  await prisma.accountRecoveryCase.deleteMany({
    where: {
      OR: [
        { requestedByUserId: { in: userIds } },
        { targetUserId: { in: userIds } },
        { reviewedByUserId: { in: userIds } },
        { supportTicketId: { in: supportTicketIds } },
        { email: { endsWith: emailDomain } }
      ]
    }
  });
  await prisma.supportTicketMessage.deleteMany({ where: { ticketId: { in: supportTicketIds } } });
  await prisma.supportTicket.deleteMany({ where: { id: { in: supportTicketIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
