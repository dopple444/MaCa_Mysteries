import Link from "next/link";

import { getCsrfToken } from "../lib/csrf";
import { requireGuest } from "../lib/guest-auth";
import { getUnlockedRuleIdsForGuest } from "../lib/conditional-unlocks";
import { getVisiblePlayerArtifacts } from "../lib/player-artifacts";
import { getActiveRoundStates, getVisiblePlayerCards } from "../lib/player-cards";
import { getVisiblePlayerEvidence } from "../lib/player-evidence";
import { getVisiblePlayerMedia } from "../lib/player-media";
import { getPlayerToolPanel } from "../lib/player-tools";

export const dynamic = "force-dynamic";

function getUnlockMessage(status?: string) {
  switch (status) {
    case "success":
      return "Code accepted. The locked content is now available.";
    case "invalid-code":
      return "That code did not unlock this content.";
    case "already-unlocked":
      return "This content is already unlocked.";
    case "no-active-code":
      return "No active code is available yet. Check with the player who has the matching tool.";
    case "rate-limited":
      return "Too many code attempts. Please wait before trying again.";
    case "target-not-available":
      return "That locked content is not available for this player yet.";
    case "invalid":
      return "The unlock request could not be verified. Please refresh and try again.";
    default:
      return "";
  }
}

function getArtifactTypeLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function getArtifactContentText(content: unknown) {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const record = content as Record<string, unknown>;
    for (const key of ["body", "text", "message", "content", "summary"]) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key] as string;
    }
  }
  return JSON.stringify(content, null, 2);
}

export default async function PlayPage({
  searchParams
}: {
  searchParams?: Promise<{ unlock?: string }>;
}) {
  const guest = await requireGuest();
  const csrfToken = await getCsrfToken();
  const params = await searchParams;
  const unlockMessage = getUnlockMessage(params?.unlock);
  const gameTitle = guest.party.game?.title ?? guest.party.gameSlug;
  const isPendingApproval = guest.status === "PENDING_APPROVAL";
  const assignment = guest.assignments[0];
  const toolPanel = !isPendingApproval && assignment
    ? await getPlayerToolPanel(guest.id)
    : { tools: [], lockedEvidence: [], lockedContent: [] };
  const activeRoundStates = getActiveRoundStates(guest.party.roundStates);
  const unlockedRuleIds = getUnlockedRuleIdsForGuest(guest.party.unlockEvents, guest.id);
  const visibleCards = getVisiblePlayerCards(guest.party.roundStates, assignment, { unlockedRuleIds });
  const visibleEvidence = getVisiblePlayerEvidence(guest.party.evidenceReveals, assignment, { unlockedRuleIds });
  const visibleEvidenceIds = new Set(visibleEvidence.map((evidence) => evidence.id));
  const visibleMedia = getVisiblePlayerMedia(
    guest.party.gameVersion?.mediaAssets ?? [],
    assignment,
    guest.party.roundStates,
    visibleEvidenceIds,
    { unlockedRuleIds }
  );
  const visibleMediaIds = new Set(visibleMedia.map((media) => media.id));
  const visibleArtifacts = getVisiblePlayerArtifacts(
    guest.party.gameVersion?.digitalArtifacts ?? [],
    assignment,
    guest.party.roundStates,
    visibleEvidenceIds,
    visibleMediaIds,
    { unlockedRuleIds }
  );
  const activeAccusationRound = activeRoundStates.some((roundState) => roundState.gameRound.sortOrder >= 3);
  const existingAccusation = guest.party.accusations[0];
  const suspectCharacters = guest.party.gameVersion?.characters ?? [];
  const finalRevealState = guest.party.finalRevealState;
  const currentRoundTitle = activeRoundStates[0]?.gameRound.title ?? "Waiting";
  const revealStatus = finalRevealState?.finalRevealedAt
    ? "Solution"
    : finalRevealState?.victimRevealedAt
      ? "Victim"
      : "Locked";
  const playerStatusCards = [
    ["Character", assignment?.character.name ?? "Unassigned", assignment ? "Ready for play" : "Waiting for host"],
    ["Current round", currentRoundTitle, activeRoundStates.length ? "Active now" : "Not started"],
    [
      "Clues",
      `${visibleCards.length + visibleEvidence.length + visibleMedia.length + visibleArtifacts.length}`,
      "Cards, evidence, media, and artifacts"
    ],
    ["Accusation", activeAccusationRound ? "Open" : "Locked", existingAccusation ? "Draft submitted" : "No submission"],
    ["Reveal", revealStatus, finalRevealState?.victimRevealedAt ? "Unlocked content available" : "No spoilers shown"]
  ];

  const joinedMessage = assignment
    ? `You are joined as ${guest.name}. Your assigned character is ${assignment.character.name}.`
    : `You are joined as ${guest.name}. The host has not assigned characters yet.`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 sm:px-6 sm:py-16">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl shadow-black/20 sm:rounded-3xl sm:p-10">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Player lobby</p>
        <h1 className="mt-4 break-words text-3xl font-semibold text-white sm:text-4xl">{guest.party.title}</h1>
        <p className="mt-4 max-w-3xl text-slate-300">
          {isPendingApproval
            ? `You are waiting for host approval as ${guest.name}.`
            : joinedMessage}
        </p>
        {isPendingApproval && (
          <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            This email was not on the original guest list. The host can see your request in party control.
          </p>
        )}
        {unlockMessage && (
          <p className="mt-6 rounded-2xl bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
            {unlockMessage}
          </p>
        )}
        {!isPendingApproval && assignment && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Your character</p>
            <h2 className="mt-3 break-words text-2xl font-semibold text-white">{assignment.character.name}</h2>
            <p className="mt-3 leading-7 text-slate-300">{assignment.character.publicBio}</p>
          </div>
        )}
        {!isPendingApproval && !assignment && (
          <p className="mt-6 rounded-2xl bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
            The host has not assigned your character yet.
          </p>
        )}

        {!isPendingApproval && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {playerStatusCards.map(([label, value, detail]) => (
              <div key={label} className="min-w-0 rounded-2xl bg-slate-950/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
                <p className="mt-2 break-words font-semibold text-white">{value}</p>
                <p className="mt-1 text-sm text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        )}

        {!isPendingApproval && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Digital artifacts</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {visibleArtifacts.length ? "Available" : "Waiting"}
              </span>
            </div>
            {visibleArtifacts.length ? (
              <div className="mt-4 space-y-4">
                {visibleArtifacts.map((artifact) => (
                  <article key={artifact.id} className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="break-words font-semibold text-white">{artifact.title}</p>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {getArtifactTypeLabel(artifact.artifactType)}
                      </span>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {artifact.visibility === "PUBLIC" ? "Public" : "Private"}
                      </span>
                    </div>
                    {artifact.gameRound && (
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-indigo-300">{artifact.gameRound.title}</p>
                    )}
                    {artifact.description && <p className="mt-3 text-sm text-slate-400">{artifact.description}</p>}
                    <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-slate-300">
                      {getArtifactContentText(artifact.content)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                Digital artifacts will appear here when your character, round, and unlock state allow them.
              </p>
            )}
          </div>
        )}

        {!isPendingApproval && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Character tools</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {toolPanel.tools.length || toolPanel.lockedContent.length ? "Available" : "Waiting"}
              </span>
            </div>
            {toolPanel.tools.length || toolPanel.lockedContent.length ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {toolPanel.tools.map((tool) => (
                  <article key={tool.id} className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="break-words font-semibold text-white">{tool.title}</p>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {tool.toolType.replaceAll("_", " ")}
                      </span>
                    </div>
                    {tool.description && <p className="mt-2 text-sm text-slate-400">{tool.description}</p>}
                    {tool.codes.length ? (
                      <div className="mt-4 space-y-3">
                        {tool.codes.map((code) => (
                          <div key={code.unlockRuleId} className="rounded-2xl bg-slate-950/80 p-4">
                            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">{code.unlockRuleTitle}</p>
                            {code.code ? (
                              <p className="mt-2 break-words font-mono text-2xl font-semibold tracking-[0.16em] text-white">
                                {code.code}
                              </p>
                            ) : (
                              <p className="mt-2 text-sm text-slate-300">No active code remains for this rule.</p>
                            )}
                            <p className="mt-2 text-sm text-slate-400">
                              Status: {code.status.toLowerCase()} · Uses remaining: {code.usesRemaining}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">No active code rules are linked to this tool yet.</p>
                    )}
                  </article>
                ))}

                {toolPanel.lockedContent.map((item) => (
                  <article key={`${item.targetType}-${item.targetId}-${item.unlockRuleId}`} className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="break-words font-semibold text-white">{item.title}</p>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {item.contentTypeLabel}
                      </span>
                    </div>
                    {item.detailLabel && (
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-indigo-300">{item.detailLabel}</p>
                    )}
                    <p className="mt-3 text-sm text-slate-300">
                      Ask the player with {item.sourceToolTitle ?? "the matching tool"} for a code.
                    </p>
                    <form action="/play/unlock" method="post" className="mt-4 grid gap-3">
                      <input type="hidden" name="csrfToken" value={csrfToken} />
                      <input type="hidden" name="unlockRuleId" value={item.unlockRuleId} />
                      <label htmlFor={`code-${item.unlockRuleId}`} className="block text-sm font-medium text-slate-200">
                        Access code
                      </label>
                      <input
                        id={`code-${item.unlockRuleId}`}
                        name="code"
                        required
                        inputMode="text"
                        autoComplete="off"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 font-mono text-base uppercase text-white outline-none focus:border-indigo-400"
                      />
                      <button className="inline-flex w-full justify-center rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 sm:w-auto">
                        Unlock content
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                Character tools and locked content prompts will appear here when this game uses them.
              </p>
            )}
          </div>
        )}

        {!isPendingApproval && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Current round</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {activeRoundStates.length ? "Active" : "Waiting"}
              </span>
            </div>
            {activeRoundStates.length ? (
              <div className="mt-4 space-y-4">
                {visibleCards.length ? (
                  visibleCards.map((card) => (
                    <article key={card.id} className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="break-words font-semibold text-white">{card.title}</p>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                          {card.visibility === "PUBLIC" ? "Public" : "Private"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-indigo-300">{card.roundTitle}</p>
                      <p className="mt-3 leading-7 text-slate-300">{card.body}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">
                    This round is active, but no player-safe cards are available for you yet.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                The host has not started a round yet. Player cards will appear here when a round is active.
              </p>
            )}
          </div>
        )}

        {!isPendingApproval && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Media clues</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {visibleMedia.length ? "Available" : "Waiting"}
              </span>
            </div>
            {visibleMedia.length ? (
              <div className="mt-4 space-y-4">
                {visibleMedia.map((media) => (
                  <article key={media.id} className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="break-words font-semibold text-white">{media.title}</p>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {media.assetType}
                      </span>
                    </div>
                    {media.description && <p className="mt-2 text-sm text-slate-400">{media.description}</p>}
                    {media.assetType === "IMAGE" ? (
                      <img
                        src={media.url}
                        alt={media.title}
                        className="mt-4 max-h-[70vh] w-full rounded-2xl border border-white/10 bg-slate-950 object-contain"
                      />
                    ) : (
                      <a
                        href={media.url}
                        className="mt-4 inline-flex w-full justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white sm:w-auto"
                      >
                        Open media
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                Media clues will appear here after the host reveals the related evidence or starts the related round.
              </p>
            )}
          </div>
        )}

        {!isPendingApproval && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Revealed evidence</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {visibleEvidence.length ? "Available" : "Waiting"}
              </span>
            </div>
            {visibleEvidence.length ? (
              <div className="mt-4 space-y-4">
                {visibleEvidence.map((evidence) => (
                  <article key={evidence.id} className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="break-words font-semibold text-white">{evidence.title}</p>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {evidence.evidenceType}
                      </span>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                        {evidence.visibility === "PUBLIC" ? "Public" : "Private"}
                      </span>
                    </div>
                    {evidence.roundTitle && (
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-indigo-300">{evidence.roundTitle}</p>
                    )}
                    <p className="mt-3 leading-7 text-slate-300">{evidence.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                The host has not revealed any player-safe evidence for you yet.
              </p>
            )}
          </div>
        )}

        {!isPendingApproval && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Accusation</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {activeAccusationRound ? "Open" : "Locked"}
              </span>
            </div>
            {activeAccusationRound ? (
              <form action="/play/accusation" method="post" className="mt-4 grid gap-4">
                <input type="hidden" name="csrfToken" value={csrfToken} />
                <label htmlFor="suspect-character" className="block text-sm font-medium text-slate-200">Suspect</label>
                <select
                  id="suspect-character"
                  name="suspectCharacterId"
                  defaultValue={existingAccusation?.suspectCharacterId ?? ""}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-base text-white outline-none focus:border-indigo-400"
                >
                  <option value="">Choose a suspect</option>
                  {suspectCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="motive-notes" className="block text-sm font-medium text-slate-200">Motive</label>
                <textarea
                  id="motive-notes"
                  name="motiveNotes"
                  defaultValue={existingAccusation?.motiveNotes ?? ""}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-base text-white outline-none focus:border-indigo-400"
                />

                <label htmlFor="evidence-notes" className="block text-sm font-medium text-slate-200">Evidence</label>
                <textarea
                  id="evidence-notes"
                  name="evidenceNotes"
                  defaultValue={existingAccusation?.evidenceNotes ?? ""}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-base text-white outline-none focus:border-indigo-400"
                />

                <label htmlFor="accusation-text" className="block text-sm font-medium text-slate-200">Final accusation</label>
                <textarea
                  id="accusation-text"
                  name="accusationText"
                  defaultValue={existingAccusation?.accusationText ?? ""}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-base text-white outline-none focus:border-indigo-400"
                />

                <button className="inline-flex w-full justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 sm:w-auto">
                  {existingAccusation ? "Update accusation" : "Submit accusation"}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                Accusations open when the host starts the accusation and reveal round.
              </p>
            )}
          </div>
        )}

        {!isPendingApproval && finalRevealState && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-white">Reveal</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                {finalRevealState.finalRevealedAt
                  ? "Solution"
                  : finalRevealState.victimRevealedAt
                    ? "Victim"
                    : "Locked"}
              </span>
            </div>
            {finalRevealState.victimRevealedAt ? (
              <div className="mt-4 space-y-4">
                <article className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Victim revealed</p>
                  <h3 className="mt-2 break-words text-lg font-semibold text-white">
                    {finalRevealState.finalReveal.victimCharacter?.name ?? "The victim"}
                  </h3>
                  <p className="mt-3 leading-7 text-slate-300">{finalRevealState.finalReveal.victimRevealText}</p>
                </article>
                {finalRevealState.finalRevealedAt ? (
                  <article className="min-w-0 rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Final solution</p>
                    <h3 className="mt-2 break-words text-lg font-semibold text-white">
                      {finalRevealState.finalReveal.killerCharacter?.name ?? "The killer"}
                    </h3>
                    <p className="mt-3 leading-7 text-slate-300">{finalRevealState.finalReveal.killerRevealText}</p>
                    <p className="mt-3 leading-7 text-slate-300">{finalRevealState.finalReveal.solutionText}</p>
                    <p className="mt-3 leading-7 text-slate-300">{finalRevealState.finalReveal.epilogueText}</p>
                  </article>
                ) : (
                  <p className="text-sm text-slate-300">The killer and full solution are still locked.</p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                Victim and killer information will appear only when the host reveals it.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 rounded-2xl bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <p className="text-sm text-slate-400">Game</p>
            <p className="mt-2 break-words font-semibold text-white">{gameTitle}</p>
          </div>
          <div className="min-w-0 rounded-2xl bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <p className="text-sm text-slate-400">Player email</p>
            <p className="mt-2 break-words font-semibold text-white">{guest.email}</p>
          </div>
          <div className="min-w-0 rounded-2xl bg-slate-950/80 p-5 sm:rounded-3xl sm:p-6">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-2 font-semibold text-white">
              {isPendingApproval ? "Awaiting host approval" : guest.status}
            </p>
          </div>
        </div>

        <div className="mt-8 text-sm text-slate-400">
          Waiting for the host? Keep this page open or return with your invite link.{" "}
          <Link href="/join" className="text-indigo-300 hover:text-white">
            Join another party
          </Link>
        </div>
      </div>
    </div>
  );
}
