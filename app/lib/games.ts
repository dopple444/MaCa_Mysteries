import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";

export type GameDef = {
  id: string;
  versionId: string;
  versionNumber: number;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  players: string;
  duration: string;
  themes: string[];
  product: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
  } | null;
};

type GameWithPublishedVersion = Prisma.GameGetPayload<{
  include: {
    versions: true;
    products: true;
  };
}>;

function formatPlayers(minPlayers: number, maxPlayers: number) {
  if (minPlayers === maxPlayers) return `${minPlayers} players`;
  return `${minPlayers}-${maxPlayers} players`;
}

function formatDuration(durationMin: number, durationMax: number) {
  const minHours = durationMin / 60;
  const maxHours = durationMax / 60;

  if (Number.isInteger(minHours) && Number.isInteger(maxHours)) {
    if (minHours === maxHours) return `${minHours} hours`;
    return `${minHours}-${maxHours} hours`;
  }

  if (durationMin === durationMax) return `${durationMin} minutes`;
  return `${durationMin}-${durationMax} minutes`;
}

function getThemes(value: Prisma.JsonValue | undefined) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toGameDef(game: GameWithPublishedVersion): GameDef | null {
  const version = game.versions[0];
  if (!version) return null;
  const product = game.products[0];

  return {
    id: game.id,
    versionId: version.id,
    versionNumber: version.versionNumber,
    slug: game.slug,
    title: game.title,
    tagline: game.tagline,
    description: game.description,
    players: formatPlayers(game.minPlayers, game.maxPlayers),
    duration: formatDuration(game.durationMin, game.durationMax),
    themes: getThemes(version.themes),
    product: product
      ? {
          id: product.id,
          name: product.name,
          priceCents: product.priceCents,
          currency: product.currency
        }
      : null
  };
}

export async function getPublishedGames() {
  const records = await prisma.game.findMany({
    where: { status: "PUBLISHED" },
    include: {
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { versionNumber: "desc" },
        take: 1
      },
      products: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 1
      }
    },
    orderBy: { title: "asc" }
  });

  return records.flatMap((game) => {
    const mapped = toGameDef(game);
    return mapped ? [mapped] : [];
  });
}

export async function getGameBySlug(slug: string) {
  const game = await prisma.game.findFirst({
    where: {
      slug,
      status: "PUBLISHED"
    },
    include: {
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { versionNumber: "desc" },
        take: 1
      },
      products: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 1
      }
    }
  });

  return game ? toGameDef(game) : null;
}
