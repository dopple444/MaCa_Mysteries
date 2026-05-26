import Link from "next/link";
import { notFound } from "next/navigation";

import { hasAdminPermission } from "../../../../../../lib/admin-permissions";
import { BUILDER_PREVIEW_MODES, getBuilderPreview, type BuilderPreviewMode } from "../../../../../../lib/builder-preview";
import { requireUser } from "../../../../../../lib/auth";

export const dynamic = "force-dynamic";

type SearchValue = string | string[] | undefined;

function getSingleValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function getArrayValue(value: SearchValue) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeMode(value: SearchValue): BuilderPreviewMode {
  const mode = getSingleValue(value)?.trim().toUpperCase();
  return BUILDER_PREVIEW_MODES.includes(mode as BuilderPreviewMode) ? (mode as BuilderPreviewMode) : "HOST_SAFE";
}

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

function JsonPreview({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-56 overflow-auto rounded-2xl bg-slate-950/90 p-3 text-xs leading-5 text-slate-300">
      {JSON.stringify(value ?? {}, null, 2)}
    </pre>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="rounded-2xl bg-slate-950/80 p-4 text-sm text-slate-400">{label}</p>;
}

export default async function BuilderPreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ gameId: string; versionId: string }>;
  searchParams?: Promise<Record<string, SearchValue>>;
}) {
  const user = await requireUser();
  if (!hasAdminPermission(user, "content")) notFound();

  const { gameId, versionId } = await params;
  const query = (await searchParams) ?? {};
  const mode = normalizeMode(query.mode);
  const selectedCharacterId = getSingleValue(query.characterId) ?? "";
  const selectedRoundId = getSingleValue(query.roundId) ?? "";
  const unlockedRuleIds = getArrayValue(query.unlockRuleIds).filter(Boolean);

  const preview = await getBuilderPreview({
    gameId,
    versionId,
    mode,
    characterId: selectedCharacterId,
    roundId: selectedRoundId,
    unlockedRuleIds
  });

  if (!preview) notFound();

  const selectedCharacter = preview.version.characters.find((character) => character.id === preview.characterId);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/admin/games/${gameId}`} className="font-semibold text-indigo-300 hover:text-white">
            Back to game
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">Builder preview</span>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Admin preview</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{preview.version.game.title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              Version {preview.version.versionNumber} · {preview.version.status}
            </p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            {preview.mode.replaceAll("_", " ")}
          </span>
        </div>

        <form method="get" className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block text-sm font-medium text-slate-200">
              Preview mode
              <select
                name="mode"
                defaultValue={preview.mode}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              >
                {BUILDER_PREVIEW_MODES.map((modeOption) => (
                  <option key={modeOption} value={modeOption}>
                    {modeOption.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Character
              <select
                name="characterId"
                defaultValue={preview.characterId ?? ""}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              >
                <option value="">First character</option>
                {preview.version.characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Round progress
              <select
                name="roundId"
                defaultValue={preview.selectedRoundId ?? ""}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              >
                <option value="">All rounds</option>
                {preview.version.rounds.map((round) => (
                  <option key={round.id} value={round.id}>
                    Through {round.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Simulated unlocks
              <select
                name="unlockRuleIds"
                multiple
                defaultValue={[...preview.unlockedRuleIds]}
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              >
                {preview.unlockRules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="mt-4 inline-flex rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
            Refresh preview
          </button>
        </form>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Character", selectedCharacter?.name ?? "Host"],
            ["Cards", preview.cards.length.toString()],
            ["Evidence", preview.evidence.length.toString()],
            ["Media", preview.mediaAssets.length.toString()],
            ["Artifacts", preview.digitalArtifacts.length.toString()]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 break-words font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">Cards</h2>
            <div className="mt-4 space-y-3">
              {preview.cards.length ? (
                preview.cards.map((card) => (
                  <article key={card.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{card.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(card.visibility)}`}>
                        {card.visibility.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-indigo-300">{card.roundTitle}</p>
                    {card.character && <p className="mt-2 text-sm text-slate-400">{card.character.name}</p>}
                    <p className="mt-3 leading-7 text-slate-300">{card.body}</p>
                  </article>
                ))
              ) : (
                <EmptyState label="No cards are visible in this preview state." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">Evidence</h2>
            <div className="mt-4 space-y-3">
              {preview.evidence.length ? (
                preview.evidence.map((evidence) => (
                  <article key={evidence.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{evidence.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(evidence.visibility)}`}>
                        {evidence.visibility.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {[evidence.evidenceType, evidence.gameRound?.title, evidence.character?.name].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-3 leading-7 text-slate-300">{evidence.body}</p>
                  </article>
                ))
              ) : (
                <EmptyState label="No evidence is visible in this preview state." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">Media</h2>
            <div className="mt-4 space-y-3">
              {preview.mediaAssets.length ? (
                preview.mediaAssets.map((media) => (
                  <article key={media.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{media.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(media.visibility)}`}>
                        {media.visibility.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {[media.assetType, media.gameRound?.title, media.character?.name, media.evidence?.title].filter(Boolean).join(" · ")}
                    </p>
                    {media.description && <p className="mt-3 leading-7 text-slate-300">{media.description}</p>}
                    <p className="mt-3 break-all text-xs text-slate-500">{media.url}</p>
                  </article>
                ))
              ) : (
                <EmptyState label="No media is visible in this preview state." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">Digital artifacts</h2>
            <div className="mt-4 space-y-3">
              {preview.digitalArtifacts.length ? (
                preview.digitalArtifacts.map((artifact) => (
                  <article key={artifact.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{artifact.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(artifact.visibility)}`}>
                        {artifact.visibility.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {[artifact.artifactType, artifact.gameRound?.title, artifact.character?.name].filter(Boolean).join(" · ")}
                    </p>
                    {artifact.description && <p className="mt-3 leading-7 text-slate-300">{artifact.description}</p>}
                    <JsonPreview value={artifact.content} />
                  </article>
                ))
              ) : (
                <EmptyState label="No digital artifacts are visible in this preview state." />
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-white">Character tools</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {preview.characterTools.length ? (
                preview.characterTools.map((tool) => (
                  <article key={tool.id} className="rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{tool.title}</p>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] ${getVisibilityClass(tool.visibility)}`}>
                        {tool.visibility.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      {tool.toolType.replaceAll("_", " ")} · {tool.character.name}
                    </p>
                    {tool.description && <p className="mt-3 leading-7 text-slate-300">{tool.description}</p>}
                    <JsonPreview value={tool.config} />
                  </article>
                ))
              ) : (
                <EmptyState label="No tools are visible in this preview state." />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
