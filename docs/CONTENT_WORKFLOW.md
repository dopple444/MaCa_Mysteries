# First-Party Content Production Workflow

Last updated: 2026-05-19

This workflow is for Burnett Games / MaCa Mysteries first-party games. Creator marketplace workflows should stay separate until the first-party pipeline is stable.

## Content Stages

1. Concept
   - Define title, theme, player count, duration, tone, and non-spoiler premise.
   - Identify required characters, optional characters, victim, killer, and solution.

2. Outline
   - Write the 3-round structure.
   - Confirm what the host can safely see.
   - Confirm what each player can see before and during each round.

3. Draft
   - Draft characters, private backgrounds, round cards, evidence, media notes, accusation prompts, victim reveal, killer reveal, solution, and epilogue.
   - Mark all spoiler-protected content while drafting.

4. Internal Review
   - Review for story logic, missing clues, contradictory motives, and player fairness.
   - Run the spoiler checklist in `docs/SPOILER_REVIEW_CHECKLIST.md`.

5. Playtest
   - Run at least one playtest with the intended player count.
   - Track confusion points, missing context, pacing, and clue timing.

6. Revision
   - Update content based on playtest notes.
   - Create a new `GameVersion` when changes would affect active parties or already-purchased content.

7. Publishing Review
   - Confirm required characters, rounds, cards, final reveal, and product are present.
   - Confirm public catalog copy contains no spoilers.
   - Confirm media assets have allowed file types and appropriate visibility.

8. Publish
   - Mark game/version as published only after validation passes.
   - Keep prior versions intact for active parties.

## Versioning Rules

- Never mutate a published game version in a way that changes active party gameplay.
- Use a new `GameVersion` for clue changes, culprit/victim changes, evidence changes, round-card changes, and final reveal changes.
- Minor typo fixes can be applied to a published version only when they do not alter gameplay, clue interpretation, or spoilers.

## Review Roles

- Writer: creates first draft.
- Story reviewer: checks plot, motive, clue logic, and pacing.
- Spoiler reviewer: checks content visibility and reveal timing.
- Technical reviewer: checks fields, media, route behavior, and seeded/admin content.
- Playtest host: runs the game and gathers feedback.

## Content Acceptance Criteria

- Public catalog copy is spoiler-free.
- Required and optional characters are clearly labeled.
- Victim identity is not exposed before the murder reveal.
- Killer identity is not exposed before final reveal unless the game design explicitly allows it.
- Every round has player-safe content.
- Every critical clue appears in the correct round.
- Final reveal explains victim, killer, motive, method, and clue trail.
- Media assets have allowed MIME types and player-safe visibility.
- Admin status controls publish only complete versions.
