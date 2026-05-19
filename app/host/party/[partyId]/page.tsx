import Link from "next/link";
import { notFound } from "next/navigation";

import { addGuest, approveGuest } from "../../../lib/party-actions";
import { requireUser } from "../../../lib/auth";
import { getCsrfToken } from "../../../lib/csrf";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function getGuestStatusLabel(status: string) {
  switch (status) {
    case "JOINED":
      return "Joined";
    case "PENDING_APPROVAL":
      return "Needs approval";
    case "INVITED":
      return "Invited";
    default:
      return status;
  }
}

function getGuestStatusClass(status: string) {
  switch (status) {
    case "JOINED":
      return "bg-emerald-500/10 text-emerald-200";
    case "PENDING_APPROVAL":
      return "bg-yellow-500/10 text-yellow-100";
    default:
      return "bg-slate-800 text-slate-300";
  }
}

function getRoundStatusClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/10 text-emerald-200";
    case "UNLOCKED":
      return "bg-indigo-500/10 text-indigo-200";
    case "COMPLETED":
      return "bg-slate-700 text-slate-200";
    default:
      return "bg-slate-800 text-slate-300";
  }
}

function getAuditLabel(action: string) {
  switch (action) {
    case "party.assignment.saved":
      return "Character assignment saved";
    case "party.assignment.cleared":
      return "Character assignment cleared";
    case "party.round.unlocked":
      return "Round unlocked";
    case "party.round.started":
      return "Round started";
    case "party.round.completed":
      return "Round completed";
    case "party.evidence.revealed":
      return "Evidence revealed";
    case "party.evidence.hidden":
      return "Evidence hidden";
    case "party.finalReveal.victimRevealed":
      return "Victim reveal shown";
    case "party.finalReveal.victimHidden":
      return "Victim reveal hidden";
    case "party.finalReveal.solutionRevealed":
      return "Final solution shown";
    case "party.finalReveal.solutionHidden":
      return "Final solution hidden";
    case "party.accusation.submitted":
      return "Accusation submitted";
    default:
      return action.replaceAll(".", " ");
  }
}

function formatActivityTime(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function PartyPage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const user = await requireUser();
  const csrfToken = await getCsrfToken();
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      game: true,
      gameVersion: {
        include: {
          characters: {
            orderBy: [
              { isRequired: "desc" },
              { sortOrder: "asc" },
              { name: "asc" }
            ]
          },
          evidence: {
            include: {
              gameRound: true,
              character: true
            },
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ]
          },
          mediaAssets: {
            include: {
              gameRound: true,
              character: true,
              evidence: true
            },
            orderBy: [
              { sortOrder: "asc" },
              { title: "asc" }
            ]
          }
        }
      },
      guests: {
        orderBy: [
          { status: "asc" },
          { name: "asc" },
          { email: "asc" }
        ]
      },
      assignments: {
        include: {
          character: true,
          guest: true
        }
      },
      roundStates: {
        include: {
          gameRound: {
            include: {
              cards: true
            }
          }
        }
      },
      evidenceReveals: {
        include: {
          evidence: true
        },
        orderBy: {
          revealedAt: "desc"
        }
      },
      accusations: {
        include: {
          guest: true,
          suspectCharacter: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      finalRevealState: {
        include: {
          finalReveal: {
            include: {
              victimCharacter: true,
              killerCharacter: true
            }
          }
        }
      },
      result: {
        include: {
          completedByUser: {
            select: {
              name: true,
              email: true
            }
          }
        }
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!party || party.hostId !== user.id) notFound();

  const joinedGuests = party.guests.filter((guest) => guest.status === "JOINED");
  const invitedGuests = party.guests.filter((guest) => guest.status === "INVITED");
  const pendingGuests = party.guests.filter((guest) => guest.status === "PENDING_APPROVAL");
  const assignableGuests = party.guests.filter((guest) => ["INVITED", "JOINED"].includes(guest.status));
  const assignmentByCharacterId = new Map(
    party.assignments.map((assignment) => [assignment.characterId, assignment])
  );
  const requiredCharacters = party.gameVersion?.characters.filter((character) => character.isRequired) ?? [];
  const optionalCharacters = party.gameVersion?.characters.filter((character) => !character.isRequired) ?? [];
  const assignedRequiredCount = requiredCharacters.filter((character) =>
    assignmentByCharacterId.has(character.id)
  ).length;
  const assignedOptionalCount = optionalCharacters.filter((character) =>
    assignmentByCharacterId.has(character.id)
  ).length;
  const missingRequiredCount =
    requiredCharacters.length - assignedRequiredCount;
  const requiredCastComplete = requiredCharacters.length > 0 && missingRequiredCount === 0;
  const roundStates = [...party.roundStates].sort(
    (a, b) => a.gameRound.sortOrder - b.gameRound.sortOrder
  );
  const activeRound = roundStates.find((roundState) => roundState.status === "ACTIVE");
  const roundStatusByRoundId = new Map(roundStates.map((roundState) => [roundState.gameRoundId, roundState.status]));
  const revealedEvidenceIds = new Set(party.evidenceReveals.map((reveal) => reveal.evidenceId));
  const evidenceList = party.gameVersion?.evidence ?? [];
  const mediaAssets = party.gameVersion?.mediaAssets ?? [];
  const roundTwoStarted = roundStates.some(
    (roundState) => roundState.gameRound.sortOrder >= 2 && ["ACTIVE", "COMPLETED"].includes(roundState.status)
  );
  const roundThreeStarted = roundStates.some(
    (roundState) => roundState.gameRound.sortOrder >= 3 && ["ACTIVE", "COMPLETED"].includes(roundState.status)
  );
  const isCompleted = party.status === "COMPLETED";
  const finalSolutionRevealed = Boolean(party.finalRevealState?.finalRevealedAt);
  const revealStatus = party.finalRevealState?.finalRevealedAt
    ? "Solution revealed"
    : party.finalRevealState?.victimRevealedAt
      ? "Victim revealed"
      : "Locked";
  const readinessCards = [
    ["Party status", party.status, isCompleted ? "Late edits locked" : "Host controls available"],
    ["Guests", `${joinedGuests.length} joined`, `${invitedGuests.length} invited · ${pendingGuests.length} pending`],
    [
      "Required cast",
      `${assignedRequiredCount}/${requiredCharacters.length}`,
      requiredCastComplete ? "Ready" : `${missingRequiredCount} required open`
    ],
    ["Current round", activeRound?.gameRound.title ?? "Not started", activeRound?.status ?? "Waiting"],
    ["Evidence", `${party.evidenceReveals.length}/${evidenceList.length}`, "Revealed to players"],
    ["Accusations", `${party.accusations.length}`, roundThreeStarted ? "Open or reviewing" : "Locked"],
    ["Reveal", revealStatus, roundThreeStarted ? "Final controls available" : "Waiting for later rounds"]
  ];

  function countCardsByVisibility(roundState: (typeof roundStates)[number], visibility: string) {
    return roundState.gameRound.cards.filter((card) => card.visibility === visibility).length;
  }

  function canRevealEvidence(evidence: (typeof evidenceList)[number]) {
    if (!evidence.gameRoundId) return true;
    const roundStatus = roundStatusByRoundId.get(evidence.gameRoundId);
    return Boolean(roundStatus && ["UNLOCKED", "ACTIVE", "COMPLETED"].includes(roundStatus));
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Party control</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">{party.title}</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Invite code</p>
            <p className="mt-2 font-semibold text-white">{party.inviteCode}</p>
          </div>
          <div className="rounded-3xl bg-slate-950/80 p-6">
            <p className="text-sm text-slate-400">Game</p>
            <p className="mt-2 font-semibold text-white">{party.game?.title ?? party.gameSlug}</p>
            <p className="mt-1 text-sm text-slate-400">
              {party.gameVersion ? `Version ${party.gameVersion.versionNumber}` : party.gameSlug}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {readinessCards.map(([label, value, detail]) => (
            <div key={label} className="rounded-2xl bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
              <p className="mt-2 font-semibold text-white">{value}</p>
              <p className="mt-1 text-sm text-slate-400">{detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {isCompleted ? "Party completed" : "Party completion"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {isCompleted
                  ? `Completed ${party.result ? formatActivityTime(party.result.completedAt) : "after final reveal"}. Reopen to make late changes.`
                  : finalSolutionRevealed
                    ? "The final solution has been revealed. You can mark this party completed when the event is finished."
                    : "Completion unlocks after the final solution is revealed."}
              </p>
              {party.result?.completedByUser && (
                <p className="mt-2 text-sm text-slate-500">
                  Completed by {party.result.completedByUser.name || party.result.completedByUser.email}
                </p>
              )}
            </div>
            <form action={`/host/party/${party.id}/status`} method="post">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="action" value={isCompleted ? "reopen" : "complete"} />
              <button
                disabled={!isCompleted && !finalSolutionRevealed}
                className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isCompleted ? "Reopen party" : "Mark completed"}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <h2 className="text-xl font-semibold text-white">Guests</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {party.guests.length ? (
                  party.guests.map((guest) => (
                    <div key={guest.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">{guest.name || "Unnamed guest"}</p>
                          <p className="mt-1 text-slate-400">{guest.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${getGuestStatusClass(guest.status)}`}>
                            {getGuestStatusLabel(guest.status)}
                          </span>
                          {guest.status === "PENDING_APPROVAL" && (
                            <form action={approveGuest}>
                              <input type="hidden" name="csrfToken" value={csrfToken} />
                              <input type="hidden" name="partyId" value={party.id} />
                              <input type="hidden" name="guestId" value={guest.id} />
                              <button className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400">
                                Approve
                              </button>
                            </form>
                          )}
                          {guest.status !== "PENDING_APPROVAL" && (
                            <form action={`/host/party/${party.id}/invite`} method="post">
                              <input type="hidden" name="csrfToken" value={csrfToken} />
                              <input type="hidden" name="guestId" value={guest.id} />
                              <button className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white">
                                Resend invite
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No guests invited yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <h2 className="text-xl font-semibold text-white">Round states</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {roundStates.length ? (
                  roundStates.map((roundState) => {
                    const canUnlock = roundState.status === "LOCKED";
                    const canStart = ["LOCKED", "UNLOCKED", "COMPLETED"].includes(roundState.status);
                    const canComplete = roundState.status === "ACTIVE";

                    return (
                      <div key={roundState.id} className="rounded-2xl bg-slate-900/80 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-semibold text-white">{roundState.gameRound.title}</p>
                            <p className="mt-2 leading-6 text-slate-400">{roundState.gameRound.summary}</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${getRoundStatusClass(roundState.status)}`}>
                            {roundState.status}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em]">
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                            Public {countCardsByVisibility(roundState, "PUBLIC")}
                          </span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                            Host-safe {countCardsByVisibility(roundState, "HOST_SAFE")}
                          </span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                            Private {countCardsByVisibility(roundState, "PLAYER_PRIVATE")}
                          </span>
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                            Spoiler {countCardsByVisibility(roundState, "SPOILER_PROTECTED")}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          {canUnlock && (
                            <form action={`/host/party/${party.id}/round`} method="post">
                              <input type="hidden" name="csrfToken" value={csrfToken} />
                              <input type="hidden" name="roundStateId" value={roundState.id} />
                              <input type="hidden" name="action" value="unlock" />
                              <button className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white">
                                Unlock
                              </button>
                            </form>
                          )}
                          {canStart && (
                            <form action={`/host/party/${party.id}/round`} method="post">
                              <input type="hidden" name="csrfToken" value={csrfToken} />
                              <input type="hidden" name="roundStateId" value={roundState.id} />
                              <input type="hidden" name="action" value="start" />
                              <button className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400">
                                {roundState.status === "COMPLETED" ? "Restart" : "Start"}
                              </button>
                            </form>
                          )}
                          {canComplete && (
                            <form action={`/host/party/${party.id}/round`} method="post">
                              <input type="hidden" name="csrfToken" value={csrfToken} />
                              <input type="hidden" name="roundStateId" value={roundState.id} />
                              <input type="hidden" name="action" value="complete" />
                              <button className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400">
                                Complete
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p>No round state has been initialized for this party yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-white">Evidence reveals</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {party.evidenceReveals.length} revealed
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {evidenceList.length ? (
                  evidenceList.map((evidence) => {
                    const isRevealed = revealedEvidenceIds.has(evidence.id);
                    const canReveal = canRevealEvidence(evidence);
                    const isSpoilerProtected = evidence.visibility === "SPOILER_PROTECTED";
                    const roundStatus = evidence.gameRoundId ? roundStatusByRoundId.get(evidence.gameRoundId) : undefined;

                    return (
                      <div key={evidence.id} className="rounded-2xl bg-slate-900/80 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{evidence.title}</p>
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                                {evidence.evidenceType}
                              </span>
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                                {evidence.visibility.replaceAll("_", " ")}
                              </span>
                              {evidence.gameRound && (
                                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                                  {evidence.gameRound.title}
                                </span>
                              )}
                              {evidence.character && (
                                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                                  {evidence.character.name}
                                </span>
                              )}
                            </div>
                            <p className="mt-3 leading-6 text-slate-400">
                              {isSpoilerProtected
                                ? "Spoiler-protected evidence body is hidden until dedicated final reveal controls are added."
                                : evidence.body}
                            </p>
                            {evidence.gameRoundId && (
                              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                                Round status: {roundStatus ?? "Not initialized"}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                                isRevealed ? "bg-emerald-500/10 text-emerald-200" : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {isRevealed ? "Revealed" : "Hidden"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          {isRevealed ? (
                            <form action={`/host/party/${party.id}/evidence`} method="post">
                              <input type="hidden" name="csrfToken" value={csrfToken} />
                              <input type="hidden" name="evidenceId" value={evidence.id} />
                              <input type="hidden" name="action" value="hide" />
                              <button className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white">
                                Hide
                              </button>
                            </form>
                          ) : (
                            <form action={`/host/party/${party.id}/evidence`} method="post">
                              <input type="hidden" name="csrfToken" value={csrfToken} />
                              <input type="hidden" name="evidenceId" value={evidence.id} />
                              <input type="hidden" name="action" value="reveal" />
                              <button
                                disabled={!canReveal}
                                className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                              >
                                {canReveal ? "Reveal" : "Round locked"}
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p>No evidence has been added for this game version yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-white">Media assets</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {mediaAssets.length} assets
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {mediaAssets.length ? (
                  mediaAssets.map((media) => (
                    <article key={media.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{media.title}</p>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                          {media.assetType}
                        </span>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                          {media.visibility.replaceAll("_", " ")}
                        </span>
                        {media.gameRound && (
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                            {media.gameRound.title}
                          </span>
                        )}
                        {media.character && (
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-300">
                            {media.character.name}
                          </span>
                        )}
                      </div>
                      {media.description && <p className="mt-3 leading-6 text-slate-400">{media.description}</p>}
                      {media.evidence && (
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                          Related evidence: {media.evidence.title}
                        </p>
                      )}
                      {media.assetType === "IMAGE" ? (
                        <img
                          src={media.url}
                          alt={media.title}
                          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950"
                        />
                      ) : (
                        <a
                          href={media.url}
                          className="mt-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white"
                        >
                          Open media
                        </a>
                      )}
                    </article>
                  ))
                ) : (
                  <p>No media assets have been added for this game version yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-white">Accusations</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {party.accusations.length} submitted
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {party.accusations.length ? (
                  party.accusations.map((accusation) => (
                    <article key={accusation.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-white">{accusation.guest.name || accusation.guest.email}</p>
                          <p className="mt-1 text-slate-400">
                            Suspect: {accusation.suspectCharacter?.name ?? "No suspect selected"}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                          Submitted
                        </span>
                      </div>
                      {accusation.motiveNotes && (
                        <p className="mt-3 leading-6 text-slate-300">
                          <span className="font-semibold text-white">Motive:</span> {accusation.motiveNotes}
                        </p>
                      )}
                      {accusation.evidenceNotes && (
                        <p className="mt-3 leading-6 text-slate-300">
                          <span className="font-semibold text-white">Evidence:</span> {accusation.evidenceNotes}
                        </p>
                      )}
                      {accusation.accusationText && (
                        <p className="mt-3 leading-6 text-slate-300">
                          <span className="font-semibold text-white">Final accusation:</span> {accusation.accusationText}
                        </p>
                      )}
                    </article>
                  ))
                ) : (
                  <p>No accusations have been submitted yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-white">Final reveal</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {party.finalRevealState?.finalRevealedAt
                    ? "Solution revealed"
                    : party.finalRevealState?.victimRevealedAt
                      ? "Victim revealed"
                      : "Locked"}
                </span>
              </div>
              {party.finalRevealState ? (
                <div className="mt-4 rounded-2xl bg-slate-900/80 p-4 text-sm text-slate-300">
                  <h3 className="text-lg font-semibold text-white">{party.finalRevealState.finalReveal.title}</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Victim</p>
                      <p className="mt-2 font-semibold text-white">
                        {party.finalRevealState.victimRevealedAt
                          ? party.finalRevealState.finalReveal.victimCharacter?.name ?? "Unassigned victim"
                          : "Hidden"}
                      </p>
                      <p className="mt-2 leading-6 text-slate-400">
                        {party.finalRevealState.victimRevealedAt
                          ? party.finalRevealState.finalReveal.victimRevealText
                          : "Reveal only after the murder round starts."}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-950/80 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Killer</p>
                      <p className="mt-2 font-semibold text-white">
                        {party.finalRevealState.finalRevealedAt
                          ? party.finalRevealState.finalReveal.killerCharacter?.name ?? "Unassigned killer"
                          : "Hidden"}
                      </p>
                      <p className="mt-2 leading-6 text-slate-400">
                        {party.finalRevealState.finalRevealedAt
                          ? party.finalRevealState.finalReveal.killerRevealText
                          : "Killer identity remains locked until final reveal."}
                      </p>
                    </div>
                  </div>
                  {party.finalRevealState.finalRevealedAt && (
                    <div className="mt-4 space-y-3 rounded-2xl bg-slate-950/80 p-4">
                      <p className="leading-6 text-slate-300">
                        <span className="font-semibold text-white">Solution:</span>{" "}
                        {party.finalRevealState.finalReveal.solutionText}
                      </p>
                      <p className="leading-6 text-slate-300">
                        <span className="font-semibold text-white">Epilogue:</span>{" "}
                        {party.finalRevealState.finalReveal.epilogueText}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {party.finalRevealState.victimRevealedAt ? (
                      <form action={`/host/party/${party.id}/final-reveal`} method="post">
                        <input type="hidden" name="csrfToken" value={csrfToken} />
                        <input type="hidden" name="action" value="hide-victim" />
                        <button className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white">
                          Hide victim
                        </button>
                      </form>
                    ) : (
                      <form action={`/host/party/${party.id}/final-reveal`} method="post">
                        <input type="hidden" name="csrfToken" value={csrfToken} />
                        <input type="hidden" name="action" value="reveal-victim" />
                        <button
                          disabled={!roundTwoStarted}
                          className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {roundTwoStarted ? "Reveal victim" : "Round 2 locked"}
                        </button>
                      </form>
                    )}
                    {party.finalRevealState.finalRevealedAt ? (
                      <form action={`/host/party/${party.id}/final-reveal`} method="post">
                        <input type="hidden" name="csrfToken" value={csrfToken} />
                        <input type="hidden" name="action" value="hide-final" />
                        <button className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-white">
                          Hide solution
                        </button>
                      </form>
                    ) : (
                      <form action={`/host/party/${party.id}/final-reveal`} method="post">
                        <input type="hidden" name="csrfToken" value={csrfToken} />
                        <input type="hidden" name="action" value="reveal-final" />
                        <button
                          disabled={!roundThreeStarted}
                          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {roundThreeStarted ? "Reveal solution" : "Round 3 locked"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-300">No final reveal has been added for this game version yet.</p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-white">Character assignments</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                    requiredCastComplete
                      ? "bg-emerald-500/10 text-emerald-200"
                      : "bg-yellow-500/10 text-yellow-100"
                  }`}
                >
                  {requiredCastComplete ? "Required cast complete" : `${missingRequiredCount} required open`}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <p className="text-slate-400">Required assigned</p>
                  <p className="mt-1 font-semibold text-white">
                    {assignedRequiredCount} of {requiredCharacters.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <p className="text-slate-400">Optional assigned</p>
                  <p className="mt-1 font-semibold text-white">
                    {assignedOptionalCount} of {optionalCharacters.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900/80 p-4">
                  <p className="text-slate-400">Joined guests</p>
                  <p className="mt-1 font-semibold text-white">{joinedGuests.length}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Optional characters stay available for planning, but only required characters count toward readiness.
                Choose Unassigned and save to clear a role.
              </p>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {party.gameVersion?.characters.length ? (
                  party.gameVersion.characters.map((character) => {
                    const assignment = assignmentByCharacterId.get(character.id);
                    const canSaveAssignment = assignableGuests.length > 0 || Boolean(assignment);

                    return (
                      <div key={character.id} className="rounded-2xl bg-slate-900/80 p-4">
                        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="font-semibold text-white">{character.name}</p>
                              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                                {character.isRequired ? "Required" : "Optional"}
                              </span>
                            </div>
                            <p className="mt-2 leading-6 text-slate-400">{character.publicBio}</p>
                          </div>
                          <form action={`/host/party/${party.id}/assign`} method="post" className="space-y-2">
                            <input type="hidden" name="csrfToken" value={csrfToken} />
                            <input type="hidden" name="characterId" value={character.id} />
                            <label className="block text-xs uppercase tracking-[0.2em] text-slate-400">
                              Assigned guest
                            </label>
                            <select
                              name="guestId"
                              defaultValue={assignment?.guestId ?? ""}
                              disabled={!canSaveAssignment}
                              className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-3 text-white outline-none focus:border-indigo-400"
                            >
                              <option value="">Unassigned</option>
                              {assignableGuests.map((guest) => (
                                <option key={guest.id} value={guest.id}>
                                  {guest.name || guest.email}
                                  {guest.status === "INVITED" ? " (invited)" : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              disabled={!canSaveAssignment}
                              className="w-full rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                            >
                              Save assignment
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p>No character roster has been added for this game version yet.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6">
            <h2 className="text-xl font-semibold text-white">Invite more guests</h2>
            <form action={addGuest} className="mt-6 space-y-4">
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="partyId" value={party.id} />
              <label className="block text-sm font-medium text-slate-200">Guest name</label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
              <label className="block text-sm font-medium text-slate-200">Guest email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
              <button className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
                Add guest
              </button>
            </form>
            <div className="mt-8 border-t border-white/10 pt-6">
              <h2 className="text-xl font-semibold text-white">Recent activity</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                {party.auditLogs.length ? (
                  party.auditLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl bg-slate-900/80 p-4">
                      <p className="font-semibold text-white">{getAuditLabel(log.action)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {formatActivityTime(log.createdAt)}
                      </p>
                      {log.user && (
                        <p className="mt-2 text-slate-400">
                          {log.user.name || log.user.email}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p>No host/player activity has been logged for this party yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-slate-400">
          Share this party link with guests: <Link href={`/join?code=${party.inviteCode}`} className="text-indigo-300 hover:text-white">{`/join?code=${party.inviteCode}`}</Link>
        </div>
      </div>
    </div>
  );
}
