# Game Package Import Contract

Last updated: 2026-05-26

## Decision

The MaCa Mysteries app remains the canonical builder, validator, publisher, and runtime. External AI tools may assist story creation later, but they should produce a structured Game Package that imports into a draft game version for human review.

No external tool should write directly to live game tables or publish content.

## Current Implementation

- `app/lib/game-package.ts` defines the first `maca-game-package/v1` contract and validator.
- `validateGamePackage()` checks structure, duplicate keys, supported enum values, broken references, player-private character requirements, final reveal references, and AI-review warnings.
- `/admin/games/package` provides a content-admin dry-run screen for pasted JSON or uploaded `.json` package files.
- `POST /admin/games/package/validate` validates the submitted package, returns a JSON report, enforces content-admin access and CSRF, and audits the dry-run without storing package content.
- `POST /admin/games/package/import` validates the same package format and creates a new draft `Game` plus draft `GameVersion` only when validation passes and the slug is unused.
- `app/lib/game-package-import.ts` imports characters, rounds, cards, evidence, media assets, digital artifacts, character tools, unlock rules, final reveal content, source metadata, themes, and content warnings.
- Imported conditional content is created in two phases so unlock rules can target created content and cards/evidence/media/artifacts can be backfilled with their `requiredUnlockRuleId`.
- `tests/game-package.test.ts` covers accepted AI-assisted packages, duplicate keys, broken references, unsupported schema versions, and unsafe player/duration ranges.
- `tests/game-package-import.test.ts` covers draft import creation, source metadata preservation, conditional unlock link wiring, invalid packages, and duplicate slugs.
- Live access-control tests cover the admin-only dry-run route and validation endpoint.
- The importer is draft-only. It does not publish, create products, create parties, or grant customer access.

## Package Shape

Top-level fields:

- `schemaVersion`: must be `maca-game-package/v1`
- `source`: optional source metadata such as `MANUAL`, `AI_ASSISTED`, or `IMPORT`
- `game`: non-spoiler catalog metadata
- `characters`: required and optional characters
- `rounds`: round definitions with nested cards
- `evidence`: authored evidence records
- `mediaAssets`: media metadata and placeholder URLs
- `digitalArtifacts`: fake emails, fake texts, documents, folders, inventory items, and other builder artifacts
- `characterTools`: character-specific tools such as access-code generators
- `unlockRules`: conditional reveal rules
- `finalReveal`: victim, killer, solution, and epilogue content

## Key Rules

- Keys use lowercase letters, numbers, and hyphens.
- Character keys are package-wide.
- Round keys are package-wide.
- Evidence, media, digital artifact, tool, and unlock-rule keys are package-wide within their type.
- Card keys are scoped to a round, so unlock rules targeting `GameCard` must include `targetRoundKey`.
- Player-private cards, evidence, media, digital artifacts, and tools must reference a character.
- References by key must point to existing objects in the same package.
- AI-assisted packages produce an `AI_REVIEW_REQUIRED` warning and must remain drafts until reviewed.

## Import Roadmap

1. Keep the validator independent from database writes. Status: implemented.
2. Add an admin-only dry-run upload/review route that displays validation results. Status: implemented.
3. Add a draft-only importer that creates a new draft `GameVersion`. Status: implemented for new draft games.
4. Preserve source metadata for imported/AI-assisted content. Status: implemented on `GameVersion`.
5. Run publish-readiness after import. Status: available after redirecting to the admin game detail; deeper import-specific readiness messaging can still be polished.
6. Add certified creator access to the same dry-run/import flow after the internal builder is stable.

## Example

```json
{
  "schemaVersion": "maca-game-package/v1",
  "source": {
    "kind": "AI_ASSISTED",
    "toolName": "Writer Room Prototype"
  },
  "game": {
    "slug": "murder-at-example-manor",
    "title": "Murder at Example Manor",
    "tagline": "A locked-room evening mystery.",
    "description": "Spoiler-free catalog copy.",
    "minPlayers": 6,
    "maxPlayers": 10,
    "durationMin": 120,
    "durationMax": 180,
    "themes": ["country house", "locked room"]
  },
  "characters": [
    {
      "key": "detective",
      "name": "The Detective",
      "publicBio": "A guest with a habit of noticing details.",
      "privateBio": "Privately knows more than they admit.",
      "isRequired": true
    }
  ],
  "rounds": [
    {
      "key": "round-1",
      "title": "Before the Murder",
      "cards": [
        {
          "key": "detective-intro",
          "title": "A Strange Arrival",
          "body": "Introduce yourself and ask about the locked study.",
          "visibility": "PLAYER_PRIVATE",
          "characterKey": "detective"
        }
      ]
    }
  ],
  "finalReveal": {
    "title": "The Truth",
    "killerCharacterKey": "detective",
    "solutionText": "The complete solution goes here."
  }
}
```
