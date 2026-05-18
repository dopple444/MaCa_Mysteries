import { NextResponse } from "next/server";

import { getPublishedGames } from "../../lib/games";

export async function GET() {
  const games = await getPublishedGames();

  return NextResponse.json(
    games.map((game) => ({
      slug: game.slug,
      title: game.title,
      tagline: game.tagline,
      players: game.players
    }))
  );
}
