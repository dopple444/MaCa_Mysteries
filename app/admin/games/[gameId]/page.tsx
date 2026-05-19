import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../lib/auth";
import { getCsrfToken } from "../../../lib/csrf";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function getVisibilityClass(visibility: string) {
  switch (visibility) {
    case "PUBLIC":
      return "bg-emerald-500/10 text-emerald-200";
    case "PLAYER_PRIVATE":
      return "bg-indigo-500/10 text-indigo-200";
    case "HOST_SAFE":
      return "bg-sky-500/10 text-sky-200";
    case "SPOILER_PROTECTED":
      return "bg-rose-500/10 text-rose-200";
    default:
      return "bg-slate-800 text-slate-300";
  }
}

export default async function AdminGameDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ gameId: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const csrfToken = await getCsrfToken();

  const { gameId } = await params;
  const query = await searchParams;
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      products: {
        orderBy: { name: "asc" }
      },
      versions: {
        orderBy: { versionNumber: "asc" },
        include: {
          characters: {
            orderBy: [
              { isRequired: "desc" },
              { sortOrder: "asc" },
              { name: "asc" }
            ]
          },
          rounds: {
            orderBy: { sortOrder: "asc" },
            include: {
              cards: {
                orderBy: [
                  { sortOrder: "asc" },
                  { title: "asc" }
                ],
                include: {
                  character: true
                }
              }
            }
          },
          evidence: {
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ],
            include: {
              gameRound: true,
              character: true
            }
          },
          mediaAssets: {
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ],
            include: {
              gameRound: true,
              character: true,
              evidence: true
            }
          },
          finalReveal: {
            include: {
              victimCharacter: true,
              killerCharacter: true
            }
          }
        }
      }
    }
  });

  if (!game) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Admin game detail</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{game.title}</h1>
            <p className="mt-2 text-sm text-slate-400">{game.slug}</p>
            <p className="mt-4 max-w-3xl leading-7 text-slate-300">{game.description}</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            {game.status}
          </span>
        </div>

        {query?.error === "incomplete-version" && (
          <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            This version needs at least one character, one round, and a final reveal before it can be published.
          </p>
        )}
        {query?.error === "invalid-game" && (
          <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            Please provide valid game metadata, player counts, and duration values.
          </p>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Players</p>
            <p className="mt-2 font-semibold text-white">
              {game.minPlayers}-{game.maxPlayers}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Duration</p>
            <p className="mt-2 font-semibold text-white">
              {game.durationMin}-{game.durationMax} min
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Versions</p>
            <p className="mt-2 font-semibold text-white">{game.versions.length}</p>
          </div>
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Products</p>
            <p className="mt-2 font-semibold text-white">{game.products.length}</p>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <h2 className="text-2xl font-semibold text-white">Game metadata</h2>
          <form action={`/admin/games/${game.id}/edit`} method="post" className="mt-6 grid gap-4">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <label className="block text-sm font-medium text-slate-200">Title</label>
            <input
              name="title"
              required
              defaultValue={game.title}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
            <label className="block text-sm font-medium text-slate-200">Tagline</label>
            <input
              name="tagline"
              required
              defaultValue={game.tagline}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
            <label className="block text-sm font-medium text-slate-200">Description</label>
            <textarea
              name="description"
              required
              rows={4}
              defaultValue={game.description}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm font-medium text-slate-200">
                Min players
                <input
                  name="minPlayers"
                  type="number"
                  min={1}
                  required
                  defaultValue={game.minPlayers}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
                />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Max players
                <input
                  name="maxPlayers"
                  type="number"
                  min={1}
                  required
                  defaultValue={game.maxPlayers}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
                />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Min minutes
                <input
                  name="durationMin"
                  type="number"
                  min={1}
                  required
                  defaultValue={game.durationMin}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
                />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Max minutes
                <input
                  name="durationMax"
                  type="number"
                  min={1}
                  required
                  defaultValue={game.durationMax}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
                />
              </label>
            </div>
            <button className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
              Save metadata
            </button>
          </form>
        </section>

        {game.products.length > 0 && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-2xl font-semibold text-white">Products</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {game.products.map((product) => (
                <article key={product.id} className="rounded-2xl bg-slate-900/80 p-4">
                  <p className="font-semibold text-white">{product.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{product.slug}</p>
                  <p className="mt-3 text-sm text-slate-300">
                    {product.currency} {(product.priceCents / 100).toFixed(2)} · {product.status}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 space-y-8">
          {game.versions.map((version) => (
            <section key={version.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Version {version.versionNumber}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {Array.isArray(version.themes) ? version.themes.join(", ") : ""}
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {version.status}
                </span>
              </div>
              <form
                action={`/admin/games/${game.id}/versions/${version.id}/status`}
                method="post"
                className="mt-4 flex flex-wrap gap-2"
              >
                <input type="hidden" name="csrfToken" value={csrfToken} />
                {["DRAFT", "PUBLISHED"].map((status) => (
                  <button
                    key={status}
                    name="status"
                    value={status}
                    disabled={version.status === status}
                    className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                  >
                    Mark {status.toLowerCase()}
                  </button>
                ))}
              </form>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <h3 className="text-lg font-semibold text-white">Characters</h3>
                  <div className="mt-4 space-y-3">
                    {version.characters.map((character) => (
                      <article key={character.id} className="rounded-2xl bg-slate-950/80 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{character.name}</p>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                            {character.isRequired ? "Required" : "Optional"}
                          </span>
                        </div>
                        <p className="mt-2 leading-6 text-slate-300">{character.publicBio}</p>
                        {character.privateBio && (
                          <p className="mt-2 leading-6 text-slate-500">Private: {character.privateBio}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <h3 className="text-lg font-semibold text-white">Rounds and cards</h3>
                  <div className="mt-4 space-y-3">
                    {version.rounds.map((round) => (
                      <article key={round.id} className="rounded-2xl bg-slate-950/80 p-4">
                        <p className="font-semibold text-white">{round.title}</p>
                        <p className="mt-2 leading-6 text-slate-300">{round.summary}</p>
                        <div className="mt-3 space-y-2">
                          {round.cards.map((card) => (
                            <div key={card.id} className="rounded-xl bg-slate-900/80 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-white">{card.title}</p>
                                <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(card.visibility)}`}>
                                  {card.visibility.replaceAll("_", " ")}
                                </span>
                              </div>
                              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                {card.character?.name ?? "All players"}
                              </p>
                              <p className="mt-2 leading-6 text-slate-300">{card.body}</p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <h3 className="text-lg font-semibold text-white">Evidence</h3>
                  <div className="mt-4 space-y-3">
                    {version.evidence.map((evidence) => (
                      <article key={evidence.id} className="rounded-2xl bg-slate-950/80 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{evidence.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(evidence.visibility)}`}>
                            {evidence.visibility.replaceAll("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {[evidence.evidenceType, evidence.gameRound?.title, evidence.character?.name].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-2 leading-6 text-slate-300">{evidence.body}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <h3 className="text-lg font-semibold text-white">Media</h3>
                  <div className="mt-4 space-y-3">
                    {version.mediaAssets.map((media) => (
                      <article key={media.id} className="rounded-2xl bg-slate-950/80 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{media.title}</p>
                          <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(media.visibility)}`}>
                            {media.visibility.replaceAll("_", " ")}
                          </span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                            {media.assetType}
                          </span>
                        </div>
                        {media.description && <p className="mt-2 leading-6 text-slate-300">{media.description}</p>}
                        <p className="mt-2 break-all text-sm text-slate-500">{media.url}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>

              {version.finalReveal && (
                <section className="mt-6 rounded-2xl bg-slate-900/80 p-4">
                  <h3 className="text-lg font-semibold text-white">{version.finalReveal.title}</h3>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Victim</p>
                      <p className="mt-2 font-semibold text-white">
                        {version.finalReveal.victimCharacter?.name ?? "Unassigned"}
                      </p>
                      <p className="mt-2 leading-6 text-slate-300">{version.finalReveal.victimRevealText}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Killer</p>
                      <p className="mt-2 font-semibold text-white">
                        {version.finalReveal.killerCharacter?.name ?? "Unassigned"}
                      </p>
                      <p className="mt-2 leading-6 text-slate-300">{version.finalReveal.killerRevealText}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-950/80 p-4">
                    <p className="leading-6 text-slate-300">{version.finalReveal.solutionText}</p>
                    <p className="mt-3 leading-6 text-slate-300">{version.finalReveal.epilogueText}</p>
                  </div>
                </section>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
