# Game Builder Wizard And Conditional Reveal Engine

Last inspected: 2026-05-22

## Purpose

The Game Builder Wizard is the planned internal content-authoring system for Burnett Games / MaCa Mysteries. Its first audience is Burnett Games admins building first-party games. Later, the same foundation can support approved marketplace creators.

The Conditional Reveal Engine is the runtime rules layer that decides when cards, evidence, media, digital artifacts, and character tools become available to a host or player.

## Architecture Decision

The Mystery Party Theme Builder should remain part of the main MaCa Mysteries app, not a separate permanent product with its own source of truth. The app should stay responsible for game versions, content validation, spoiler rules, conditional reveal rules, publishing, previews, hosting, player visibility, purchases, support, and audit logs.

External AI tools can still be used later as optional authoring assistants. They should produce a structured Game Package import, not publish directly to live game data. Imported content should land in a draft `GameVersion`, then pass the same admin/creator preview and publish-readiness checks as manually authored content.

This gives us one canonical builder/runtime while leaving room for stronger AI workflows outside the app.

## Current Foundation

Implemented foundation:

- Existing `Game`, `GameVersion`, `GameCharacter`, `GameRound`, `GameCard`, `GameEvidence`, `GameMediaAsset`, and `GameFinalReveal` remain the core authored game model.
- `GameCard`, `GameEvidence`, and `GameMediaAsset` now have `requiredUnlockRuleId` so future authored content can be hidden behind conditional rules.
- New builder/runtime models exist for `GameDigitalArtifact`, `GameCharacterTool`, `GameUnlockRule`, `PartyToolInstance`, `PartyUnlockEvent`, `PartyCodeAttempt`, `PartyAssetView`, `PartyPlayerInteraction`, and `PartyPlayerInventory`.
- Player-safe card/evidence/media helpers now honor required unlock rules.
- Admin game detail pages now include draft-only editors for digital artifacts, character tools, and unlock rules.
- Builder editor routes audit create/update actions and reject published-version edits.
- Admin preview pages can project a game version as host-safe host, spoiler host, or a selected character.
- Publish-readiness validation now blocks publishing versions with missing essential content, orphan required unlock rules, unpublished required rules, missing access-code generators, and unattached published unlock rules.
- `/play` now renders character-specific access-code generator tools and locked evidence/card/media/artifact code-entry prompts for the first player-facing conditional unlock path.
- `POST /play/unlock` validates CSRF, rate limits attempts, records hashed code attempts, and creates unlock events without storing raw codes.
- Host party pages show sanitized code-attempt and unlock-event activity; spoiler-sensitive rule/tool labels stay generic unless host spoiler mode is unlocked.
- Tests cover role visibility separation, a cross-player access-code unlock flow, player tool panel/code-entry behavior, admin builder editor validation, builder preview projections, and publish-readiness validation.

## Builder Wizard Scope

The wizard should eventually walk an admin through:

1. Game synopsis, theme, setting, player count, duration, and content warnings.
2. Required and optional characters.
3. Public bios, private backgrounds, relationships, secrets, objectives, and costume/setup guidance.
4. Pre-game tasks.
5. Round structure and round cards.
6. Clues, evidence, documents, fake emails, fake text messages, audio, video, images, and investigation sheets.
7. Character-specific digital tools and inventory items.
8. Conditional unlock rules.
9. Final reveal and spoiler rules.
10. Preview as host and preview as a specific character.
11. Validation checklist.
12. Draft, publish, archive, and version control.

## AI-Assisted Game Package Import

Future AI tools should integrate through a reviewable package format rather than direct database writes.

The first validator lives in `app/lib/game-package.ts`; the detailed contract is documented in `docs/GAME_PACKAGE_IMPORT.md`.

The package should include:

- Synopsis, theme, setting, player count, duration, and content warnings.
- Required and optional characters.
- Public bios, private backgrounds, relationships, motives, secrets, and objectives.
- Pre-game tasks, round cards, clues, evidence, media placeholders, fake emails/texts/documents, and investigation sheets.
- Final reveal content, victim/killer timing rules, spoiler rules, conditional unlock rules, character tools, and validation notes.

Import rules:

- Create or update only draft content.
- Never publish automatically.
- Preserve source metadata so admins can tell whether content was hand-authored, imported, or AI-assisted.
- Run publish-readiness validation after import.
- Require human review for spoilers, quality, safety, IP/copyright concerns, and gameplay consistency.

## Certified Creator Dashboard

Creator access should be a permission layer over this same builder, not a separate builder system.

Future `/creator` routes should be visible only to authenticated users with a certified/approved creator profile. Certified creators should be able to:

- View their creator dashboard and game drafts.
- Create/import draft games using the same Game Package/import path.
- Use the same builder surfaces scoped to games they own.
- Preview as host/player before submission.
- Submit game versions for admin approval.
- Receive approval feedback and revise drafts.

Creators should not get payout, marketplace selling, or public storefront controls until the first-party MVP, internal builder, conditional reveal engine, support process, and production operations are stable.

## Conditional Mechanics

The engine should support:

- Public content.
- Host-safe content.
- Spoiler-protected host content.
- Character-private content.
- Content unlocked by round state.
- Content unlocked after victim reveal or final reveal.
- Content unlocked after host approval.
- Content unlocked after another clue was viewed.
- Content unlocked by cross-player interaction.
- One player generating a party-specific code that another player enters.
- One-time-use, round-specific, or party-specific codes.
- Unlock scope for one player, all players, host, or party.
- Audit/history of code attempts and unlock events.

## Security Rules

- Admins can inspect full draft content because admin pages are trusted content-authoring surfaces.
- Hosts remain spoiler-safe by default and must explicitly unlock spoiler mode for protected solution content.
- Players only receive content allowed by their assigned character, party state, round state, reveal state, and unlock state.
- Raw access codes should not be stored. Current foundation stores salted hashes for generated codes and salted hashes for attempts.
- Unlock attempts and successful unlocks are persisted for auditability.

## Near-Term Builder Sequence

1. Add admin/global monitoring for failed code attempts, successful unlock events, and unusual retry patterns.
2. Expand publish-readiness checks to cover spoiler wording, circular dependencies, asset-view rules, host-approval rules, reveal-state rules, and multi-player interaction rules.
3. Add runtime support for asset-view, host-approval, reveal-state, and multi-player interaction rules.
4. Add object storage and signed private media URLs before production private media.
5. Add admin-only Game Package dry-run upload/review UI.
6. Add a draft-only Game Package importer for AI-assisted drafts.
7. Add certified creator dashboard permissions only after the first-party builder is stable.
