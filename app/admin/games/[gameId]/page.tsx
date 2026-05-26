import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BUILDER_ARTIFACT_TYPES,
  BUILDER_VISIBILITIES,
  CHARACTER_TOOL_TYPES,
  UNLOCK_CODE_MODES,
  UNLOCK_RULE_STATUSES,
  UNLOCK_RULE_TYPES,
  UNLOCK_SCOPES,
  UNLOCK_TRIGGER_TYPES
} from "../../../lib/admin-builder";
import { hasAdminPermission } from "../../../lib/admin-permissions";
import { requireUser } from "../../../lib/auth";
import { getCsrfToken } from "../../../lib/csrf";
import { getGameVersionPublishReadiness } from "../../../lib/publish-readiness";
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

function getReadinessBadgeClass(ok: boolean) {
  return ok ? "bg-emerald-500/10 text-emerald-200" : "bg-yellow-500/10 text-yellow-100";
}

function getIssueClass(severity: string) {
  return severity === "ERROR" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-yellow-400/30 bg-yellow-500/10 text-yellow-100";
}

const CARD_VISIBILITY_OPTIONS = ["PUBLIC", "PLAYER_PRIVATE", "HOST_SAFE", "SPOILER_PROTECTED"];
const EVIDENCE_TYPE_OPTIONS = ["TEXT", "DOCUMENT", "NOTE", "IMAGE", "AUDIO", "VIDEO", "EMAIL", "MESSAGE"];
const MEDIA_ASSET_TYPE_OPTIONS = ["IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "EMAIL", "MESSAGE", "LINK"];

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function getTargetOptions(version: {
  rounds: { cards: { id: string; title: string; key: string }[] }[];
  evidence: { id: string; title: string; key: string }[];
  mediaAssets: { id: string; title: string; key: string }[];
  digitalArtifacts: { id: string; title: string; key: string }[];
}) {
  return [
    ...version.rounds.flatMap((round) =>
      round.cards.map((card) => ({
        value: `GameCard:${card.id}`,
        label: `Card: ${card.title || card.key}`
      }))
    ),
    ...version.evidence.map((evidence) => ({
      value: `GameEvidence:${evidence.id}`,
      label: `Evidence: ${evidence.title || evidence.key}`
    })),
    ...version.mediaAssets.map((media) => ({
      value: `GameMediaAsset:${media.id}`,
      label: `Media: ${media.title || media.key}`
    })),
    ...version.digitalArtifacts.map((artifact) => ({
      value: `GameDigitalArtifact:${artifact.id}`,
      label: `Artifact: ${artifact.title || artifact.key}`
    }))
  ];
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "incomplete-version":
      return "This version needs at least one character, one round, and a final reveal before it can be published.";
    case "publish-readiness":
      return "This version is not ready to publish. Review the publish readiness errors below.";
    case "invalid-game":
      return "Please provide valid game metadata, player counts, and duration values.";
    case "invalid-character":
      return "Please provide a valid character key, name, public bio, and sort order.";
    case "duplicate-character":
      return "Character keys must be unique within a game version.";
    case "published-version":
      return "Published versions are locked. Mark the version as draft before editing character content.";
    case "required-character":
      return "Each version must keep at least one required character.";
    case "invalid-round":
      return "Please provide a valid round key, title, summary, and sort order.";
    case "duplicate-round":
      return "Round keys must be unique within a game version.";
    case "invalid-card":
      return "Please provide a valid card round, key, title, body, visibility, and sort order.";
    case "duplicate-card":
      return "Card keys must be unique within each round.";
    case "invalid-card-character":
      return "Player-private cards must be assigned to a valid character in this game version.";
    case "invalid-evidence":
      return "Please provide a valid evidence key, title, body, type, visibility, and sort order.";
    case "duplicate-evidence":
      return "Evidence keys must be unique within a game version.";
    case "invalid-evidence-linkage":
      return "Evidence round and character links must belong to this game version; player-private evidence requires a character.";
    case "invalid-media":
      return "Please provide a valid media key, title, asset type, URL, visibility, and sort order.";
    case "duplicate-media":
      return "Media keys must be unique within a game version.";
    case "invalid-media-linkage":
      return "Media round, character, and evidence links must belong to this game version; player-private media requires a character.";
    case "invalid-artifact":
      return "Please provide a valid artifact key, title, type, visibility, JSON content, and sort order.";
    case "duplicate-artifact":
      return "Digital artifact keys must be unique within a game version.";
    case "invalid-artifact-linkage":
      return "Artifact round, character, evidence, media, and unlock rule links must belong to this game version; player-private artifacts require a character.";
    case "invalid-tool":
      return "Please provide a valid tool key, title, character, type, visibility, JSON config, and sort order.";
    case "duplicate-tool":
      return "Character tool keys must be unique within a game version.";
    case "invalid-tool-linkage":
      return "Character tools must be assigned to a valid character in this game version.";
    case "invalid-unlock-rule":
      return "Please provide a valid unlock rule key, title, target, trigger, scope, status, JSON config/effect, and sort order.";
    case "duplicate-unlock-rule":
      return "Unlock rule keys must be unique within a game version.";
    case "invalid-unlock-rule-linkage":
      return "Unlock rule links must belong to this game version. Access-code rules require an access-code generator tool.";
    default:
      return "";
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
  if (!hasAdminPermission(user, "content")) notFound();
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
          digitalArtifacts: {
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ],
            include: {
              gameRound: true,
              character: true,
              evidence: true,
              mediaAsset: true
            }
          },
          characterTools: {
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ],
            include: {
              character: true
            }
          },
          unlockRules: {
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ],
            include: {
              sourceTool: true,
              requiredRound: true,
              requiredCharacter: true
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
  const errorMessage = getErrorMessage(query?.error);
  const readinessByVersionId = new Map(
    await Promise.all(
      game.versions.map(async (version) => [
        version.id,
        await getGameVersionPublishReadiness({
          gameId: game.id,
          versionId: version.id
        })
      ] as const)
    )
  );

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

        {errorMessage && (
          <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            {errorMessage}
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
          {game.versions.map((version) => {
            const readiness = readinessByVersionId.get(version.id);

            return (
            <section key={version.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Version {version.versionNumber}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {Array.isArray(version.themes) ? version.themes.join(", ") : ""}
                  </p>
                  <Link
                    href={`/admin/games/${game.id}/versions/${version.id}/preview`}
                    className="mt-3 inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white"
                  >
                    Preview visibility
                  </Link>
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

              {readiness && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Publish readiness</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {readiness.errorCount} errors · {readiness.warningCount} warnings
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getReadinessBadgeClass(readiness.ok)}`}>
                      {readiness.ok ? "Ready" : "Needs work"}
                    </span>
                  </div>
                  {readiness.issues.length > 0 ? (
                    <div className="mt-4 grid gap-2">
                      {readiness.issues.slice(0, 8).map((issue) => (
                        <div key={`${issue.code}-${issue.entityId ?? issue.message}`} className={`rounded-xl border px-3 py-2 text-sm ${getIssueClass(issue.severity)}`}>
                          <span className="font-semibold">{issue.severity}</span>
                          <span className="mx-2 text-slate-500">/</span>
                          <span>{issue.message}</span>
                          {issue.entityLabel && <span className="ml-2 text-slate-400">({issue.entityLabel})</span>}
                        </div>
                      ))}
                      {readiness.issues.length > 8 && (
                        <p className="text-sm text-slate-400">
                          {readiness.issues.length - 8} more readiness items are hidden here.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">No publish blockers or warnings detected.</p>
                  )}
                </div>
              )}

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">Characters</h3>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                      {version.characters.length}
                    </span>
                  </div>
                  {version.status === "DRAFT" ? (
                    <form
                      action={`/admin/games/${game.id}/versions/${version.id}/characters`}
                      method="post"
                      className="mt-4 grid gap-3 rounded-2xl bg-slate-950/80 p-4"
                    >
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-200">
                          Key
                          <input
                            name="key"
                            required
                            pattern="[a-z0-9][a-z0-9-]{1,63}"
                            placeholder="detective-avery"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Name
                          <input
                            name="name"
                            required
                            maxLength={120}
                            placeholder="Detective Avery"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-slate-200">
                        Public bio
                        <textarea
                          name="publicBio"
                          required
                          rows={2}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-200">
                        Private bio
                        <textarea
                          name="privateBio"
                          rows={2}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                        <label className="block text-sm font-medium text-slate-200">
                          Sort order
                          <input
                            name="sortOrder"
                            type="number"
                            defaultValue={version.characters.length + 1}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-sm font-medium text-slate-200">
                          <input name="isRequired" type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-500" />
                          Required
                        </label>
                      </div>
                      <button className="inline-flex justify-center rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
                        Add character
                      </button>
                    </form>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                      Character editing is locked while this version is published.
                    </p>
                  )}
                  <div className="mt-4 space-y-3">
                    {version.characters.length === 0 && (
                      <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                        No characters have been added yet.
                      </p>
                    )}
                    {version.characters.map((character) => {
                      const characterBadge = (
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                          {character.isRequired ? "Required" : "Optional"}
                        </span>
                      );

                      if (version.status !== "DRAFT") {
                        return (
                          <article key={character.id} className="rounded-2xl bg-slate-950/80 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{character.name}</p>
                              {characterBadge}
                            </div>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{character.key}</p>
                            <p className="mt-2 leading-6 text-slate-300">{character.publicBio}</p>
                            {character.privateBio && (
                              <p className="mt-2 leading-6 text-slate-500">Private: {character.privateBio}</p>
                            )}
                          </article>
                        );
                      }

                      return (
                        <form
                          key={character.id}
                          action={`/admin/games/${game.id}/versions/${version.id}/characters`}
                          method="post"
                          className="grid gap-3 rounded-2xl bg-slate-950/80 p-4"
                        >
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="characterId" value={character.id} />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{character.name}</p>
                            {characterBadge}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-200">
                              Key
                              <input
                                name="key"
                                required
                                pattern="[a-z0-9][a-z0-9-]{1,63}"
                                defaultValue={character.key}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Name
                              <input
                                name="name"
                                required
                                maxLength={120}
                                defaultValue={character.name}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-200">
                            Public bio
                            <textarea
                              name="publicBio"
                              required
                              rows={2}
                              defaultValue={character.publicBio}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Private bio
                            <textarea
                              name="privateBio"
                              rows={2}
                              defaultValue={character.privateBio}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <label className="block text-sm font-medium text-slate-200">
                              Sort order
                              <input
                                name="sortOrder"
                                type="number"
                                defaultValue={character.sortOrder}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-sm font-medium text-slate-200">
                              <input
                                name="isRequired"
                                type="checkbox"
                                defaultChecked={character.isRequired}
                                className="h-4 w-4 accent-indigo-500"
                              />
                              Required
                            </label>
                          </div>
                          <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                            Save character
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">Rounds and cards</h3>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                      {version.rounds.length}
                    </span>
                  </div>
                  {version.status === "DRAFT" ? (
                    <form
                      action={`/admin/games/${game.id}/versions/${version.id}/rounds`}
                      method="post"
                      className="mt-4 grid gap-3 rounded-2xl bg-slate-950/80 p-4"
                    >
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-200">
                          Round key
                          <input
                            name="key"
                            required
                            pattern="[a-z0-9][a-z0-9-]{1,63}"
                            placeholder="round-1"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Title
                          <input
                            name="title"
                            required
                            maxLength={160}
                            placeholder="Round 1: Pre-Murder"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-slate-200">
                        Summary
                        <textarea
                          name="summary"
                          rows={2}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-200">
                        Sort order
                        <input
                          name="sortOrder"
                          type="number"
                          defaultValue={version.rounds.length + 1}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                        />
                      </label>
                      <button className="inline-flex justify-center rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
                        Add round
                      </button>
                    </form>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                      Round and card editing is locked while this version is published.
                    </p>
                  )}
                  <div className="mt-4 space-y-3">
                    {version.rounds.length === 0 && (
                      <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                        No rounds have been added yet.
                      </p>
                    )}
                    {version.rounds.map((round) => (
                      <article key={round.id} className="rounded-2xl bg-slate-950/80 p-4">
                        {version.status === "DRAFT" ? (
                          <form
                            action={`/admin/games/${game.id}/versions/${version.id}/rounds`}
                            method="post"
                            className="grid gap-3"
                          >
                            <input type="hidden" name="csrfToken" value={csrfToken} />
                            <input type="hidden" name="roundId" value={round.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block text-sm font-medium text-slate-200">
                                Round key
                                <input
                                  name="key"
                                  required
                                  pattern="[a-z0-9][a-z0-9-]{1,63}"
                                  defaultValue={round.key}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Title
                                <input
                                  name="title"
                                  required
                                  maxLength={160}
                                  defaultValue={round.title}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                            </div>
                            <label className="block text-sm font-medium text-slate-200">
                              Summary
                              <textarea
                                name="summary"
                                rows={2}
                                defaultValue={round.summary}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Sort order
                              <input
                                name="sortOrder"
                                type="number"
                                defaultValue={round.sortOrder}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                            <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                              Save round
                            </button>
                          </form>
                        ) : (
                          <>
                            <p className="font-semibold text-white">{round.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{round.key}</p>
                            <p className="mt-2 leading-6 text-slate-300">{round.summary}</p>
                          </>
                        )}

                        {version.status === "DRAFT" && (
                          <form
                            action={`/admin/games/${game.id}/versions/${version.id}/cards`}
                            method="post"
                            className="mt-4 grid gap-3 rounded-2xl bg-slate-900/80 p-4"
                          >
                            <input type="hidden" name="csrfToken" value={csrfToken} />
                            <input type="hidden" name="roundId" value={round.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block text-sm font-medium text-slate-200">
                                Card key
                                <input
                                  name="key"
                                  required
                                  pattern="[a-z0-9][a-z0-9-]{1,63}"
                                  placeholder={`${round.key}-public`}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Title
                                <input
                                  name="title"
                                  required
                                  maxLength={160}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                            </div>
                            <label className="block text-sm font-medium text-slate-200">
                              Body
                              <textarea
                                name="body"
                                required
                                rows={3}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className="block text-sm font-medium text-slate-200">
                                Visibility
                                <select
                                  name="visibility"
                                  defaultValue="PUBLIC"
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                >
                                  {CARD_VISIBILITY_OPTIONS.map((visibility) => (
                                    <option key={visibility} value={visibility}>
                                      {visibility.replaceAll("_", " ")}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Character
                                <select
                                  name="characterId"
                                  defaultValue=""
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                >
                                  <option value="">All players</option>
                                  {version.characters.map((character) => (
                                    <option key={character.id} value={character.id}>
                                      {character.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Sort order
                                <input
                                  name="sortOrder"
                                  type="number"
                                  defaultValue={round.cards.length + 1}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                            </div>
                            <button className="inline-flex justify-center rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
                              Add card
                            </button>
                          </form>
                        )}

                        <div className="mt-4 space-y-2">
                          {round.cards.length === 0 && (
                            <p className="rounded-xl bg-slate-900/80 px-3 py-2 text-sm text-slate-400">
                              No cards have been added to this round yet.
                            </p>
                          )}
                          {round.cards.map((card) => {
                            const cardBadge = (
                              <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(card.visibility)}`}>
                                {card.visibility.replaceAll("_", " ")}
                              </span>
                            );
                            const spoilerBadge =
                              card.visibility === "SPOILER_PROTECTED" ? (
                                <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-rose-200">
                                  Spoiler locked
                                </span>
                              ) : null;

                            if (version.status !== "DRAFT") {
                              return (
                                <div key={card.id} className="rounded-xl bg-slate-900/80 p-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-white">{card.title}</p>
                                    {cardBadge}
                                    {spoilerBadge}
                                  </div>
                                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                                    {card.character?.name ?? "All players"}
                                  </p>
                                  <p className="mt-2 leading-6 text-slate-300">{card.body}</p>
                                </div>
                              );
                            }

                            return (
                              <form
                                key={card.id}
                                action={`/admin/games/${game.id}/versions/${version.id}/cards`}
                                method="post"
                                className="grid gap-3 rounded-xl bg-slate-900/80 p-3"
                              >
                                <input type="hidden" name="csrfToken" value={csrfToken} />
                                <input type="hidden" name="cardId" value={card.id} />
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-white">{card.title}</p>
                                  {cardBadge}
                                  {spoilerBadge}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className="block text-sm font-medium text-slate-200">
                                    Card key
                                    <input
                                      name="key"
                                      required
                                      pattern="[a-z0-9][a-z0-9-]{1,63}"
                                      defaultValue={card.key}
                                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                    />
                                  </label>
                                  <label className="block text-sm font-medium text-slate-200">
                                    Title
                                    <input
                                      name="title"
                                      required
                                      maxLength={160}
                                      defaultValue={card.title}
                                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                    />
                                  </label>
                                </div>
                                <label className="block text-sm font-medium text-slate-200">
                                  Body
                                  <textarea
                                    name="body"
                                    required
                                    rows={3}
                                    defaultValue={card.body}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  <label className="block text-sm font-medium text-slate-200">
                                    Round
                                    <select
                                      name="roundId"
                                      defaultValue={card.gameRoundId}
                                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                    >
                                      {version.rounds.map((roundOption) => (
                                        <option key={roundOption.id} value={roundOption.id}>
                                          {roundOption.title}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block text-sm font-medium text-slate-200">
                                    Visibility
                                    <select
                                      name="visibility"
                                      defaultValue={card.visibility}
                                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                    >
                                      {CARD_VISIBILITY_OPTIONS.map((visibility) => (
                                        <option key={visibility} value={visibility}>
                                          {visibility.replaceAll("_", " ")}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block text-sm font-medium text-slate-200">
                                    Character
                                    <select
                                      name="characterId"
                                      defaultValue={card.characterId ?? ""}
                                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                    >
                                      <option value="">All players</option>
                                      {version.characters.map((character) => (
                                        <option key={character.id} value={character.id}>
                                          {character.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block text-sm font-medium text-slate-200">
                                    Sort order
                                    <input
                                      name="sortOrder"
                                      type="number"
                                      defaultValue={card.sortOrder}
                                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                    />
                                  </label>
                                </div>
                                <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                                  Save card
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">Evidence</h3>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                      {version.evidence.length}
                    </span>
                  </div>
                  {version.status === "DRAFT" ? (
                    <form
                      action={`/admin/games/${game.id}/versions/${version.id}/evidence`}
                      method="post"
                      className="mt-4 grid gap-3 rounded-2xl bg-slate-950/80 p-4"
                    >
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-200">
                          Evidence key
                          <input
                            name="key"
                            required
                            pattern="[a-z0-9][a-z0-9-]{1,63}"
                            placeholder="bloody-note"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Title
                          <input
                            name="title"
                            required
                            maxLength={160}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-slate-200">
                        Body
                        <textarea
                          name="body"
                          required
                          rows={3}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <label className="block text-sm font-medium text-slate-200">
                          Type
                          <select
                            name="evidenceType"
                            defaultValue="DOCUMENT"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            {EVIDENCE_TYPE_OPTIONS.map((evidenceType) => (
                              <option key={evidenceType} value={evidenceType}>
                                {evidenceType}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Visibility
                          <select
                            name="visibility"
                            defaultValue="PUBLIC"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            {CARD_VISIBILITY_OPTIONS.map((visibility) => (
                              <option key={visibility} value={visibility}>
                                {visibility.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Round
                          <select
                            name="gameRoundId"
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">No round</option>
                            {version.rounds.map((round) => (
                              <option key={round.id} value={round.id}>
                                {round.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Character
                          <select
                            name="characterId"
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">All players</option>
                            {version.characters.map((character) => (
                              <option key={character.id} value={character.id}>
                                {character.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Sort order
                          <input
                            name="sortOrder"
                            type="number"
                            defaultValue={version.evidence.length + 1}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                      </div>
                      <button className="inline-flex justify-center rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
                        Add evidence
                      </button>
                    </form>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                      Evidence editing is locked while this version is published.
                    </p>
                  )}
                  <div className="mt-4 space-y-3">
                    {version.evidence.length === 0 && (
                      <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                        No evidence has been added yet.
                      </p>
                    )}
                    {version.evidence.map((evidence) => {
                      const evidenceBadge = (
                        <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(evidence.visibility)}`}>
                          {evidence.visibility.replaceAll("_", " ")}
                        </span>
                      );
                      const spoilerBadge =
                        evidence.visibility === "SPOILER_PROTECTED" ? (
                          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-rose-200">
                            Spoiler locked
                          </span>
                        ) : null;

                      if (version.status !== "DRAFT") {
                        return (
                          <article key={evidence.id} className="rounded-2xl bg-slate-950/80 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{evidence.title}</p>
                              {evidenceBadge}
                              {spoilerBadge}
                            </div>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                              {[evidence.evidenceType, evidence.gameRound?.title, evidence.character?.name].filter(Boolean).join(" · ")}
                            </p>
                            <p className="mt-2 leading-6 text-slate-300">{evidence.body}</p>
                          </article>
                        );
                      }

                      return (
                        <form
                          key={evidence.id}
                          action={`/admin/games/${game.id}/versions/${version.id}/evidence`}
                          method="post"
                          className="grid gap-3 rounded-2xl bg-slate-950/80 p-4"
                        >
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="evidenceId" value={evidence.id} />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{evidence.title}</p>
                            {evidenceBadge}
                            {spoilerBadge}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-200">
                              Evidence key
                              <input
                                name="key"
                                required
                                pattern="[a-z0-9][a-z0-9-]{1,63}"
                                defaultValue={evidence.key}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Title
                              <input
                                name="title"
                                required
                                maxLength={160}
                                defaultValue={evidence.title}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-200">
                            Body
                            <textarea
                              name="body"
                              required
                              rows={3}
                              defaultValue={evidence.body}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <label className="block text-sm font-medium text-slate-200">
                              Type
                              <select
                                name="evidenceType"
                                defaultValue={evidence.evidenceType}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                {EVIDENCE_TYPE_OPTIONS.map((evidenceType) => (
                                  <option key={evidenceType} value={evidenceType}>
                                    {evidenceType}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Visibility
                              <select
                                name="visibility"
                                defaultValue={evidence.visibility}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                {CARD_VISIBILITY_OPTIONS.map((visibility) => (
                                  <option key={visibility} value={visibility}>
                                    {visibility.replaceAll("_", " ")}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Round
                              <select
                                name="gameRoundId"
                                defaultValue={evidence.gameRoundId ?? ""}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                <option value="">No round</option>
                                {version.rounds.map((round) => (
                                  <option key={round.id} value={round.id}>
                                    {round.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Character
                              <select
                                name="characterId"
                                defaultValue={evidence.characterId ?? ""}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                <option value="">All players</option>
                                {version.characters.map((character) => (
                                  <option key={character.id} value={character.id}>
                                    {character.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Sort order
                              <input
                                name="sortOrder"
                                type="number"
                                defaultValue={evidence.sortOrder}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                          </div>
                          <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                            Save evidence
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">Media</h3>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                      {version.mediaAssets.length}
                    </span>
                  </div>
                  {version.status === "DRAFT" ? (
                    <form
                      action={`/admin/games/${game.id}/versions/${version.id}/media`}
                      method="post"
                      className="mt-4 grid gap-3 rounded-2xl bg-slate-950/80 p-4"
                    >
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-200">
                          Media key
                          <input
                            name="key"
                            required
                            pattern="[a-z0-9][a-z0-9-]{1,63}"
                            placeholder="crime-scene-photo"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Title
                          <input
                            name="title"
                            required
                            maxLength={160}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-slate-200">
                        URL
                        <input
                          name="url"
                          required
                          placeholder="/media/example.png"
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-200">
                        Description
                        <textarea
                          name="description"
                          rows={2}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <label className="block text-sm font-medium text-slate-200">
                          Asset type
                          <select
                            name="assetType"
                            defaultValue="IMAGE"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            {MEDIA_ASSET_TYPE_OPTIONS.map((assetType) => (
                              <option key={assetType} value={assetType}>
                                {assetType}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Visibility
                          <select
                            name="visibility"
                            defaultValue="PUBLIC"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            {CARD_VISIBILITY_OPTIONS.map((visibility) => (
                              <option key={visibility} value={visibility}>
                                {visibility.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Round
                          <select
                            name="gameRoundId"
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">No round</option>
                            {version.rounds.map((round) => (
                              <option key={round.id} value={round.id}>
                                {round.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Character
                          <select
                            name="characterId"
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">All players</option>
                            {version.characters.map((character) => (
                              <option key={character.id} value={character.id}>
                                {character.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Sort order
                          <input
                            name="sortOrder"
                            type="number"
                            defaultValue={version.mediaAssets.length + 1}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-200">
                          Evidence
                          <select
                            name="evidenceId"
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">No linked evidence</option>
                            {version.evidence.map((evidence) => (
                              <option key={evidence.id} value={evidence.id}>
                                {evidence.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          MIME type
                          <input
                            name="mimeType"
                            placeholder="image/png"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                      </div>
                      <button className="inline-flex justify-center rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
                        Add media
                      </button>
                    </form>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                      Media editing is locked while this version is published.
                    </p>
                  )}
                  <div className="mt-4 space-y-3">
                    {version.mediaAssets.length === 0 && (
                      <p className="rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-400">
                        No media has been added yet.
                      </p>
                    )}
                    {version.mediaAssets.map((media) => {
                      const mediaBadge = (
                        <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(media.visibility)}`}>
                          {media.visibility.replaceAll("_", " ")}
                        </span>
                      );
                      const spoilerBadge =
                        media.visibility === "SPOILER_PROTECTED" ? (
                          <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-rose-200">
                            Spoiler locked
                          </span>
                        ) : null;

                      if (version.status !== "DRAFT") {
                        return (
                          <article key={media.id} className="rounded-2xl bg-slate-950/80 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{media.title}</p>
                              {mediaBadge}
                              {spoilerBadge}
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                                {media.assetType}
                              </span>
                            </div>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                              {[media.gameRound?.title, media.character?.name, media.evidence?.title].filter(Boolean).join(" · ")}
                            </p>
                            {media.description && <p className="mt-2 leading-6 text-slate-300">{media.description}</p>}
                            <p className="mt-2 break-all text-sm text-slate-500">{media.url}</p>
                          </article>
                        );
                      }

                      return (
                        <form
                          key={media.id}
                          action={`/admin/games/${game.id}/versions/${version.id}/media`}
                          method="post"
                          className="grid gap-3 rounded-2xl bg-slate-950/80 p-4"
                        >
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="mediaId" value={media.id} />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{media.title}</p>
                            {mediaBadge}
                            {spoilerBadge}
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                              {media.assetType}
                            </span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-200">
                              Media key
                              <input
                                name="key"
                                required
                                pattern="[a-z0-9][a-z0-9-]{1,63}"
                                defaultValue={media.key}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Title
                              <input
                                name="title"
                                required
                                maxLength={160}
                                defaultValue={media.title}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-200">
                            URL
                            <input
                              name="url"
                              required
                              defaultValue={media.url}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Description
                            <textarea
                              name="description"
                              rows={2}
                              defaultValue={media.description}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <label className="block text-sm font-medium text-slate-200">
                              Asset type
                              <select
                                name="assetType"
                                defaultValue={media.assetType}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                {MEDIA_ASSET_TYPE_OPTIONS.map((assetType) => (
                                  <option key={assetType} value={assetType}>
                                    {assetType}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Visibility
                              <select
                                name="visibility"
                                defaultValue={media.visibility}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                {CARD_VISIBILITY_OPTIONS.map((visibility) => (
                                  <option key={visibility} value={visibility}>
                                    {visibility.replaceAll("_", " ")}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Round
                              <select
                                name="gameRoundId"
                                defaultValue={media.gameRoundId ?? ""}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                <option value="">No round</option>
                                {version.rounds.map((round) => (
                                  <option key={round.id} value={round.id}>
                                    {round.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Character
                              <select
                                name="characterId"
                                defaultValue={media.characterId ?? ""}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                <option value="">All players</option>
                                {version.characters.map((character) => (
                                  <option key={character.id} value={character.id}>
                                    {character.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              Sort order
                              <input
                                name="sortOrder"
                                type="number"
                                defaultValue={media.sortOrder}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-200">
                              Evidence
                              <select
                                name="evidenceId"
                                defaultValue={media.evidenceId ?? ""}
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              >
                                <option value="">No linked evidence</option>
                                {version.evidence.map((evidence) => (
                                  <option key={evidence.id} value={evidence.id}>
                                    {evidence.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm font-medium text-slate-200">
                              MIME type
                              <input
                                name="mimeType"
                                defaultValue={media.mimeType}
                                placeholder="image/png"
                                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                              />
                            </label>
                          </div>
                          <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                            Save media
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>
              </div>

              <section className="mt-6 rounded-2xl bg-slate-900/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">Builder and conditional reveals</h3>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                    Admin editor
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Digital artifacts</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{version.digitalArtifacts.length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Character tools</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{version.characterTools.length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Unlock rules</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{version.unlockRules.length}</p>
                  </div>
                </div>

                {version.status === "DRAFT" ? (
                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    <form
                      action={`/admin/games/${game.id}/versions/${version.id}/artifacts`}
                      method="post"
                      className="rounded-2xl bg-slate-950/80 p-4"
                    >
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <h4 className="font-semibold text-white">Add digital artifact</h4>
                      <div className="mt-4 grid gap-3">
                        <label className="block text-sm font-medium text-slate-200">
                          Artifact key
                          <input
                            name="key"
                            required
                            placeholder="locked-folder"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Title
                          <input
                            name="title"
                            required
                            placeholder="Locked folder"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Type
                            <select
                              name="artifactType"
                              defaultValue="DOCUMENT"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {BUILDER_ARTIFACT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Visibility
                            <select
                              name="visibility"
                              defaultValue="PLAYER_PRIVATE"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {BUILDER_VISIBILITIES.map((visibility) => (
                                <option key={visibility} value={visibility}>
                                  {visibility.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Round
                            <select
                              name="gameRoundId"
                              defaultValue=""
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              <option value="">No round gate</option>
                              {version.rounds.map((round) => (
                                <option key={round.id} value={round.id}>
                                  {round.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Character
                            <select
                              name="characterId"
                              defaultValue=""
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              <option value="">No character</option>
                              {version.characters.map((character) => (
                                <option key={character.id} value={character.id}>
                                  {character.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="block text-sm font-medium text-slate-200">
                          Required unlock
                          <select
                            name="requiredUnlockRuleId"
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">No conditional unlock</option>
                            {version.unlockRules.map((rule) => (
                              <option key={rule.id} value={rule.id}>
                                {rule.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Description
                          <textarea
                            name="description"
                            rows={2}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Content JSON
                          <textarea
                            name="content"
                            rows={4}
                            defaultValue={'{\n  "body": ""\n}'}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <input type="hidden" name="sortOrder" value={version.digitalArtifacts.length + 1} />
                        <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                          Add artifact
                        </button>
                      </div>
                    </form>

                    <form
                      action={`/admin/games/${game.id}/versions/${version.id}/tools`}
                      method="post"
                      className="rounded-2xl bg-slate-950/80 p-4"
                    >
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <h4 className="font-semibold text-white">Add character tool</h4>
                      <div className="mt-4 grid gap-3">
                        <label className="block text-sm font-medium text-slate-200">
                          Tool key
                          <input
                            name="key"
                            required
                            placeholder="decoder"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Title
                          <input
                            name="title"
                            required
                            placeholder="Digital decoder"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Character
                          <select
                            name="characterId"
                            required
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">Choose character</option>
                            {version.characters.map((character) => (
                              <option key={character.id} value={character.id}>
                                {character.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Type
                            <select
                              name="toolType"
                              defaultValue="ACCESS_CODE_GENERATOR"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {CHARACTER_TOOL_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Visibility
                            <select
                              name="visibility"
                              defaultValue="PLAYER_PRIVATE"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {BUILDER_VISIBILITIES.map((visibility) => (
                                <option key={visibility} value={visibility}>
                                  {visibility.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="block text-sm font-medium text-slate-200">
                          Description
                          <textarea
                            name="description"
                            rows={2}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Config JSON
                          <textarea
                            name="config"
                            rows={4}
                            defaultValue={'{\n  "mode": "party-code"\n}'}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <input type="hidden" name="sortOrder" value={version.characterTools.length + 1} />
                        <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                          Add tool
                        </button>
                      </div>
                    </form>

                    <form
                      action={`/admin/games/${game.id}/versions/${version.id}/unlock-rules`}
                      method="post"
                      className="rounded-2xl bg-slate-950/80 p-4"
                    >
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <h4 className="font-semibold text-white">Add unlock rule</h4>
                      <div className="mt-4 grid gap-3">
                        <label className="block text-sm font-medium text-slate-200">
                          Rule key
                          <input
                            name="key"
                            required
                            placeholder="unlock-locked-folder"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Title
                          <input
                            name="title"
                            required
                            placeholder="Unlock locked folder"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-200">
                          Target content
                          <select
                            name="targetRef"
                            required
                            defaultValue=""
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          >
                            <option value="">Choose target</option>
                            {getTargetOptions(version).map((target) => (
                              <option key={target.value} value={target.value}>
                                {target.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Rule type
                            <select
                              name="ruleType"
                              defaultValue="ACCESS_CODE"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {UNLOCK_RULE_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Trigger
                            <select
                              name="triggerType"
                              defaultValue="CODE_ENTRY"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {UNLOCK_TRIGGER_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Source tool
                            <select
                              name="sourceToolId"
                              defaultValue=""
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              <option value="">No source tool</option>
                              {version.characterTools.map((tool) => (
                                <option key={tool.id} value={tool.id}>
                                  {tool.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Scope
                            <select
                              name="unlockScope"
                              defaultValue="PLAYER"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {UNLOCK_SCOPES.map((scope) => (
                                <option key={scope} value={scope}>
                                  {scope.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Code mode
                            <select
                              name="codeMode"
                              defaultValue="PARTY_TOOL_CODE"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {UNLOCK_CODE_MODES.map((mode) => (
                                <option key={mode || "none"} value={mode}>
                                  {mode ? mode.replaceAll("_", " ") : "None"}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Status
                            <select
                              name="status"
                              defaultValue="DRAFT"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              {UNLOCK_RULE_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Required round
                            <select
                              name="requiredRoundId"
                              defaultValue=""
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              <option value="">No round condition</option>
                              {version.rounds.map((round) => (
                                <option key={round.id} value={round.id}>
                                  {round.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Required character
                            <select
                              name="requiredCharacterId"
                              defaultValue=""
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                            >
                              <option value="">No character condition</option>
                              {version.characters.map((character) => (
                                <option key={character.id} value={character.id}>
                                  {character.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="block text-sm font-medium text-slate-200">
                          Description
                          <textarea
                            name="description"
                            rows={2}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-200">
                            Config JSON
                            <textarea
                              name="config"
                              rows={4}
                              defaultValue={'{\n  "uses": 1\n}'}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-200">
                            Effect JSON
                            <textarea
                              name="effect"
                              rows={4}
                              defaultValue="{}"
                              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                            />
                          </label>
                        </div>
                        <input type="hidden" name="sortOrder" value={version.unlockRules.length + 1} />
                        <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                          Add rule
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">
                    Builder editing is locked while this version is published.
                  </p>
                )}

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">Digital artifacts</h4>
                    {version.digitalArtifacts.length ? (
                      version.digitalArtifacts.map((artifact) => (
                        <form
                          key={artifact.id}
                          action={`/admin/games/${game.id}/versions/${version.id}/artifacts`}
                          method="post"
                          className="rounded-2xl bg-slate-950/80 p-4"
                        >
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="artifactId" value={artifact.id} />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{artifact.title}</p>
                            <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(artifact.visibility)}`}>
                              {artifact.visibility.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">{artifact.key}</p>
                          {version.status === "DRAFT" ? (
                            <div className="mt-4 grid gap-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Key
                                  <input
                                    name="key"
                                    required
                                    defaultValue={artifact.key}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Sort
                                  <input
                                    name="sortOrder"
                                    type="number"
                                    defaultValue={artifact.sortOrder}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                              </div>
                              <label className="block text-sm font-medium text-slate-200">
                                Title
                                <input
                                  name="title"
                                  required
                                  defaultValue={artifact.title}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Type
                                  <select
                                    name="artifactType"
                                    defaultValue={artifact.artifactType}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {BUILDER_ARTIFACT_TYPES.map((type) => (
                                      <option key={type} value={type}>
                                        {type.replaceAll("_", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Visibility
                                  <select
                                    name="visibility"
                                    defaultValue={artifact.visibility}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {BUILDER_VISIBILITIES.map((visibility) => (
                                      <option key={visibility} value={visibility}>
                                        {visibility.replaceAll("_", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Round
                                  <select
                                    name="gameRoundId"
                                    defaultValue={artifact.gameRoundId ?? ""}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    <option value="">No round gate</option>
                                    {version.rounds.map((round) => (
                                      <option key={round.id} value={round.id}>
                                        {round.title}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Character
                                  <select
                                    name="characterId"
                                    defaultValue={artifact.characterId ?? ""}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    <option value="">No character</option>
                                    {version.characters.map((character) => (
                                      <option key={character.id} value={character.id}>
                                        {character.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <label className="block text-sm font-medium text-slate-200">
                                Evidence
                                <select
                                  name="evidenceId"
                                  defaultValue={artifact.evidenceId ?? ""}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                >
                                  <option value="">No evidence link</option>
                                  {version.evidence.map((evidence) => (
                                    <option key={evidence.id} value={evidence.id}>
                                      {evidence.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Media
                                <select
                                  name="mediaAssetId"
                                  defaultValue={artifact.mediaAssetId ?? ""}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                >
                                  <option value="">No media link</option>
                                  {version.mediaAssets.map((media) => (
                                    <option key={media.id} value={media.id}>
                                      {media.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Required unlock
                                <select
                                  name="requiredUnlockRuleId"
                                  defaultValue={artifact.requiredUnlockRuleId}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                >
                                  <option value="">No conditional unlock</option>
                                  {version.unlockRules.map((rule) => (
                                    <option key={rule.id} value={rule.id}>
                                      {rule.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Description
                                <textarea
                                  name="description"
                                  rows={2}
                                  defaultValue={artifact.description}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Content JSON
                                <textarea
                                  name="content"
                                  rows={5}
                                  defaultValue={stringifyJson(artifact.content)}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                                Save artifact
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-400">
                              {[artifact.artifactType, artifact.gameRound?.title, artifact.character?.name].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </form>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-slate-950/80 p-4 text-sm text-slate-400">No digital artifacts yet.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">Character tools</h4>
                    {version.characterTools.length ? (
                      version.characterTools.map((tool) => (
                        <form
                          key={tool.id}
                          action={`/admin/games/${game.id}/versions/${version.id}/tools`}
                          method="post"
                          className="rounded-2xl bg-slate-950/80 p-4"
                        >
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="toolId" value={tool.id} />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{tool.title}</p>
                            <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(tool.visibility)}`}>
                              {tool.visibility.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {tool.key} · {tool.character.name}
                          </p>
                          {version.status === "DRAFT" ? (
                            <div className="mt-4 grid gap-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Key
                                  <input
                                    name="key"
                                    required
                                    defaultValue={tool.key}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Sort
                                  <input
                                    name="sortOrder"
                                    type="number"
                                    defaultValue={tool.sortOrder}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                              </div>
                              <label className="block text-sm font-medium text-slate-200">
                                Title
                                <input
                                  name="title"
                                  required
                                  defaultValue={tool.title}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Character
                                <select
                                  name="characterId"
                                  required
                                  defaultValue={tool.characterId}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                >
                                  {version.characters.map((character) => (
                                    <option key={character.id} value={character.id}>
                                      {character.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Type
                                  <select
                                    name="toolType"
                                    defaultValue={tool.toolType}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {CHARACTER_TOOL_TYPES.map((type) => (
                                      <option key={type} value={type}>
                                        {type.replaceAll("_", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Visibility
                                  <select
                                    name="visibility"
                                    defaultValue={tool.visibility}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {BUILDER_VISIBILITIES.map((visibility) => (
                                      <option key={visibility} value={visibility}>
                                        {visibility.replaceAll("_", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <label className="block text-sm font-medium text-slate-200">
                                Description
                                <textarea
                                  name="description"
                                  rows={2}
                                  defaultValue={tool.description}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Config JSON
                                <textarea
                                  name="config"
                                  rows={5}
                                  defaultValue={stringifyJson(tool.config)}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                                Save tool
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-400">
                              {tool.toolType.replaceAll("_", " ")} · {tool.character.name}
                            </p>
                          )}
                        </form>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-slate-950/80 p-4 text-sm text-slate-400">No character tools yet.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-white">Unlock rules</h4>
                    {version.unlockRules.length ? (
                      version.unlockRules.map((rule) => (
                        <form
                          key={rule.id}
                          action={`/admin/games/${game.id}/versions/${version.id}/unlock-rules`}
                          method="post"
                          className="rounded-2xl bg-slate-950/80 p-4"
                        >
                          <input type="hidden" name="csrfToken" value={csrfToken} />
                          <input type="hidden" name="unlockRuleId" value={rule.id} />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{rule.title}</p>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                              {rule.triggerType.replaceAll("_", " ")}
                            </span>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                              {rule.unlockScope.replaceAll("_", " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {rule.key} · Target: {rule.targetType}
                          </p>
                          {version.status === "DRAFT" ? (
                            <div className="mt-4 grid gap-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Key
                                  <input
                                    name="key"
                                    required
                                    defaultValue={rule.key}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Sort
                                  <input
                                    name="sortOrder"
                                    type="number"
                                    defaultValue={rule.sortOrder}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                              </div>
                              <label className="block text-sm font-medium text-slate-200">
                                Title
                                <input
                                  name="title"
                                  required
                                  defaultValue={rule.title}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-200">
                                Target content
                                <select
                                  name="targetRef"
                                  required
                                  defaultValue={`${rule.targetType}:${rule.targetId}`}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                >
                                  {getTargetOptions(version).map((target) => (
                                    <option key={target.value} value={target.value}>
                                      {target.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Rule type
                                  <select
                                    name="ruleType"
                                    defaultValue={rule.ruleType}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {UNLOCK_RULE_TYPES.map((type) => (
                                      <option key={type} value={type}>
                                        {type.replaceAll("_", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Trigger
                                  <select
                                    name="triggerType"
                                    defaultValue={rule.triggerType}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {UNLOCK_TRIGGER_TYPES.map((type) => (
                                      <option key={type} value={type}>
                                        {type.replaceAll("_", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Source tool
                                  <select
                                    name="sourceToolId"
                                    defaultValue={rule.sourceToolId ?? ""}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    <option value="">No source tool</option>
                                    {version.characterTools.map((tool) => (
                                      <option key={tool.id} value={tool.id}>
                                        {tool.title}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Scope
                                  <select
                                    name="unlockScope"
                                    defaultValue={rule.unlockScope}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {UNLOCK_SCOPES.map((scope) => (
                                      <option key={scope} value={scope}>
                                        {scope.replaceAll("_", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Code mode
                                  <select
                                    name="codeMode"
                                    defaultValue={rule.codeMode}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {UNLOCK_CODE_MODES.map((mode) => (
                                      <option key={mode || "none"} value={mode}>
                                        {mode ? mode.replaceAll("_", " ") : "None"}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Status
                                  <select
                                    name="status"
                                    defaultValue={rule.status}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    {UNLOCK_RULE_STATUSES.map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Required round
                                  <select
                                    name="requiredRoundId"
                                    defaultValue={rule.requiredRoundId ?? ""}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    <option value="">No round condition</option>
                                    {version.rounds.map((round) => (
                                      <option key={round.id} value={round.id}>
                                        {round.title}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Required character
                                  <select
                                    name="requiredCharacterId"
                                    defaultValue={rule.requiredCharacterId ?? ""}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                  >
                                    <option value="">No character condition</option>
                                    {version.characters.map((character) => (
                                      <option key={character.id} value={character.id}>
                                        {character.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <label className="block text-sm font-medium text-slate-200">
                                Description
                                <textarea
                                  name="description"
                                  rows={2}
                                  defaultValue={rule.description}
                                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-white outline-none focus:border-indigo-400"
                                />
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-200">
                                  Config JSON
                                  <textarea
                                    name="config"
                                    rows={5}
                                    defaultValue={stringifyJson(rule.config)}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-200">
                                  Effect JSON
                                  <textarea
                                    name="effect"
                                    rows={5}
                                    defaultValue={stringifyJson(rule.effect)}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                                  />
                                </label>
                              </div>
                              <button className="inline-flex justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white hover:border-white">
                                Save rule
                              </button>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-slate-400">
                              Target: {rule.targetType} · {rule.sourceTool?.title ?? "No source tool"}
                            </p>
                          )}
                        </form>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-slate-950/80 p-4 text-sm text-slate-400">No unlock rules yet.</p>
                    )}
                  </div>
                </div>
              </section>

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
            );
          })}
        </div>
      </div>
    </div>
  );
}
