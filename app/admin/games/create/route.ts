import { NextResponse } from "next/server";

import { hasAdminPermission } from "../../../lib/admin-permissions";
import { createAppUrl } from "../../../lib/app-url";
import { logAuditEvent } from "../../../lib/audit-log";
import { getCurrentUser } from "../../../lib/auth";
import { verifyCsrfToken } from "../../../lib/csrf";
import { prisma } from "../../../lib/prisma";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getIntFormValue(formData: FormData, key: string) {
  const value = Number.parseInt(getFormValue(formData, key), 10);
  return Number.isFinite(value) ? value : null;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function redirectToNew(request: Request, error = "invalid") {
  return NextResponse.redirect(createAppUrl(`/admin/games/new?error=${error}`, request.url), 303);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(createAppUrl("/login", request.url), 303);
  }
  if (!hasAdminPermission(user, "content")) {
    return NextResponse.redirect(createAppUrl("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToNew(request);
  }

  const title = getFormValue(formData, "title");
  const slug = normalizeSlug(getFormValue(formData, "slug"));
  const tagline = getFormValue(formData, "tagline");
  const description = getFormValue(formData, "description");
  const minPlayers = getIntFormValue(formData, "minPlayers");
  const maxPlayers = getIntFormValue(formData, "maxPlayers");
  const durationMin = getIntFormValue(formData, "durationMin");
  const durationMax = getIntFormValue(formData, "durationMax");

  if (
    !title ||
    !slug ||
    !tagline ||
    !description ||
    !minPlayers ||
    !maxPlayers ||
    !durationMin ||
    !durationMax ||
    minPlayers < 1 ||
    maxPlayers < minPlayers ||
    durationMin < 1 ||
    durationMax < durationMin
  ) {
    return redirectToNew(request);
  }

  const existing = await prisma.game.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return redirectToNew(request, "exists");
  }

  const game = await prisma.game.create({
    data: {
      slug,
      title,
      tagline,
      description,
      minPlayers,
      maxPlayers,
      durationMin,
      durationMax,
      status: "DRAFT",
      versions: {
        create: {
          versionNumber: 1,
          status: "DRAFT",
          themes: []
        }
      }
    }
  });

  await logAuditEvent({
    action: "admin.game.created",
    userId: user.id,
    entityType: "Game",
    entityId: game.id,
    metadata: { slug, title }
  });

  return NextResponse.redirect(createAppUrl(`/admin/games/${game.id}`, request.url), 303);
}
