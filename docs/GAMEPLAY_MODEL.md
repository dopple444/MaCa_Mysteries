# Gameplay Model

Last inspected: 2026-05-22

## Purpose

This document defines the target domain model for running digital murder mystery games on MaCa Mysteries. It is a product and architecture model, not a statement of what the current app fully implements.

The initial product should focus on first-party games owned by Burnett Games / MaCa Mysteries. The model should still leave clean space for future third-party creator publishing.

## Core Concepts

### Game

A top-level playable mystery title, such as `The Last Curtain`.

Contains public catalog identity:

- Title
- Slug
- Short description
- Player count range
- Duration
- Themes/tags
- Cover media
- Published status
- First-party or creator-owned source

A `Game` should not directly contain all mutable story content. Story content belongs to `GameVersion`.

### GameVersion

A versioned, publishable snapshot of game content.

Purpose:

- Preserve the exact content used by existing parties.
- Allow edits and improvements without changing games already sold or activated.
- Support draft, review, published, retired, and archived states.

Contains:

- Character set
- Rounds
- Cards
- Clues
- Evidence
- Media assets
- Messages
- Spoiler rules
- Final solution/reveal data

### PartyInstance

A hosted run of one game version.

Created when a host activates or starts a party.

Contains:

- Host
- Selected game version
- Invite code/link
- Party title/date
- Party status
- Guest list
- Character assignments
- Current round state
- Evidence/message unlock state
- Accusations/results
- Spoiler unlock state for host

### User

A platform account.

Roles:

- Customer/host
- Player/guest with account later
- Admin
- Support
- Creator later

Users may buy games, host parties, play as guests, administer content, or create marketplace content depending on role and permissions.

### Host

The user responsible for a `PartyInstance`.

Host responsibilities:

- Create party
- Invite guests
- Assign characters
- Start or unlock rounds
- Manage guest attendance
- Run the game in spoiler-safe mode
- Optionally unlock spoiler mode
- Trigger final reveal

The host should not automatically see killer/victim/solution content unless spoiler mode is intentionally unlocked or the content is safe for host operations.

### Guest

A person invited to or joining a party.

Guest may be:

- Invited by email/SMS/name.
- Joined through invite code/link.
- Assigned a character.
- Given player-private cards and clues.
- Allowed to submit accusations.

Guest does not necessarily need a full user account in the MVP, but should have a secure guest session or invite token.

Guest invitation state should be tracked separately from gameplay participation:

- `INVITED`, `JOINED`, and `PENDING_APPROVAL` describe party participation.
- `NOT_SENT`, `QUEUED`, `SENT`, and `FAILED` describe invitation delivery.
- Hosts should see last queued/sent timestamps, resend count, and failed delivery details without exposing game spoilers.

### Character

A playable role in a game.

Contains:

- Public name
- Public description
- Private background
- Objectives
- Secrets to reveal
- Secrets to conceal
- Relationships
- Required or optional flag
- Gender/presentation guidance if the game uses it
- Costume suggestions if desired
- Media portrait if available

### RequiredCharacter

A character that must be assigned for the game to work.

Examples:

- Victim
- Killer
- Key witnesses
- Characters holding critical clues

Required characters need validation before a party can start.

### OptionalCharacter

A character that improves or expands the game but is not required for the core mystery.

Optional characters should:

- Have non-blocking clues or redundant clues.
- Avoid being the sole holder of critical information.
- Be assignable only when player count allows.

### CharacterAssignment

The mapping between a `PartyInstance` guest and a game character.

Contains:

- Party
- Guest
- Character
- Assignment status
- Assigned by host/manual/auto
- Timestamps

Rules:

- A guest should have at most one active character assignment per party.
- A character should be assigned to at most one active guest per party.
- Required characters must be assigned before the game starts.
- Assignments should be auditable because they affect spoiler access.

### Round

A major phase of gameplay.

Default game structure:

1. Optional pre-game tasks
2. Round 1: pre-murder interaction
3. Round 2: murder and post-murder investigation
4. Round 3: accusation, solution, and final reveal

Each game may define custom round labels, but the engine should support this default structure cleanly.

### RoundCard

Player-facing content delivered for a character during a round.

May contain:

- Public prompts
- Private prompts
- Clues to share
- Clues to conceal
- Objectives
- Conversation starters
- Round-specific instructions
- Media references
- Message/evidence unlock references

Round cards must be filtered by player and party state.

### PreGameTask

Optional task shown before Round 1.

Examples:

- Costume prompt
- Character intro
- Relationship reading
- Private preparation
- Host setup checklist
- Optional pre-party message

Pre-game tasks must not reveal murder timing, killer identity, or victim identity unless a specific game intentionally requires it.

### Clue

A piece of information used by players to solve the mystery.

Types:

- Public clue
- Player-private clue
- Host-safe clue
- Spoiler-protected clue
- Evidence-linked clue
- Message-linked clue
- Round-unlocked clue

Clues should have explicit visibility and unlock rules.

### Evidence

A discoverable object, document, media item, or fact used in the investigation.

Examples:

- Photograph
- Letter
- Audio clip
- Video
- Fake email
- Text-message thread
- Receipts
- Investigation sheet
- Physical prop reference

Evidence can be globally visible, host-revealed, round-unlocked, player-private, or spoiler-protected.

### MediaAsset

A file or external media reference used in catalog pages or gameplay.

Types:

- Image
- Video
- Audio
- PDF/document
- Text-message-style image/content
- Fake email/document

Media assets should have metadata:

- Storage key/path
- MIME type
- Size
- Duration where relevant
- Alt text/caption
- Visibility classification
- Linked game version

### Message

An in-game communication artifact.

Examples:

- Text-message-style clue
- Fake email
- Voicemail transcript
- Letter
- System clue notification

Messages may be:

- Static game content
- Delivered to a character at a round
- Delivered by host reveal
- Logged in party state after delivery

### DigitalArtifact

A structured gameplay object authored by an admin or future creator.

Examples:

- Fake emails
- Fake text messages
- Documents
- Investigation sheets
- Locked folders
- Digital keys
- Decoder payloads
- Inventory-style clues

Digital artifacts should have explicit visibility, optional character/round/evidence/media links, and optional conditional unlock rules. They are the builder-friendly layer above raw cards, evidence, and media assets.

### CharacterTool

A character-specific interactive tool available in a player's app.

Examples:

- Digital key
- Decoder
- Scanner
- Access-code generator
- Notebook
- Restricted-folder opener

Tools are authored on a `GameVersion` and assigned to a `Character`. Runtime copies are represented by party-specific tool instances so codes and state can differ per party.

### AccessCodeGenerator

A specialized `CharacterTool` that creates or carries a party-specific code.

Rules:

- Raw codes should not be stored.
- Codes should be scoped to a party.
- Codes may be one-time use, limited-use, round-specific, or expiring.
- Code attempts should be recorded without exposing the raw code.

### LockedEvidence

Evidence, cards, media, or digital artifacts that require an unlock rule before becoming visible.

Locked evidence may require:

- Current or completed round.
- Host reveal.
- Specific character assignment.
- Player interaction.
- Code entry.
- Host approval.
- Prior clue or asset view.

### UnlockRule

A rule describing how locked content becomes available.

Rule inputs may include:

- Required round.
- Required character.
- Source character tool.
- Required asset view.
- Required player interaction.
- Host approval.
- Victim reveal or final reveal state.
- Access-code validation.

Rule effects should declare the target content and unlock scope: one player, all players, host, host and players, or the whole party.

### PlayerInteraction

A runtime record that two or more players interacted through an authored mechanic.

Examples:

- One player generates a code and another enters it.
- A player scans another player's clue.
- A player shares a digital key.
- Multiple players confirm a joint action.

Interactions should be party-scoped and auditable.

### PlayerInventory

The runtime set of digital items available to a guest.

Inventory can contain:

- Character tools.
- Digital artifacts.
- Keys or access tokens.
- Unlocked documents.
- Temporary clue objects.

Inventory items should be party-specific and tied to the guest, not only to the authored game definition.

### ToolInstance

A party-specific instance of a `CharacterTool`.

Used for:

- Per-party access codes.
- Tool status such as active, used, expired, or revoked.
- Remaining uses.
- Expiration time.
- Runtime metadata.

### UnlockEvent

A successful runtime unlock.

Used by player-safe content filters to decide whether locked content is available. Unlock events should store the actor, target player when relevant, target content, scope, and metadata, but not raw secrets.

### AssetView

A runtime record that a guest viewed a card, evidence item, media asset, or digital artifact.

Useful for rules such as:

- Unlock content after another clue has been viewed.
- Track investigation progress.
- Provide admin/host progress summaries without revealing private content.

### CodeAttempt

A runtime record of an access-code attempt.

Stores:

- Party.
- Actor guest.
- Tool instance when relevant.
- Unlock rule.
- Status.
- Salted/hash-derived attempted value or equivalent safe fingerprint.
- Metadata such as failure reason.

Raw submitted codes should not be stored.

### Accusation

A player's submitted guess or formal accusation.

Contains:

- Party
- Guest/player
- Suspect/killer guess
- Motive guess
- Evidence explanation
- Submitted round
- Timestamp

The game should support:

- One final accusation per player
- Optional editable drafts before final submission
- Host/admin review after game

### FinalReveal

The solution content unlocked at the end.

Contains:

- Killer reveal
- Victim reveal if not already public
- Method
- Motive
- Timeline
- Evidence explanation
- Character epilogues
- Scoring/results if used

Final reveal is spoiler-protected until the host triggers it or the party reaches the proper state.

### SpoilerRule

A rule describing when content may be seen by a given actor.

Actors:

- Public visitor
- Customer
- Host safe mode
- Host spoiler mode
- Assigned player
- Other players
- Admin
- Creator/editor
- Support

Spoiler rules should be enforceable in backend services, not only hidden in UI.

### PartyState

Current state of a party instance.

Suggested states:

- `DRAFT`
- `INVITING`
- `ASSIGNING_CHARACTERS`
- `READY`
- `IN_PROGRESS`
- `PAUSED`
- `FINAL_REVEAL_UNLOCKED`
- `COMPLETE`
- `CANCELLED`

Party state controls which actions are available.

### RoundState

Current state of a party round.

Suggested states:

- `LOCKED`
- `AVAILABLE_TO_HOST`
- `OPEN_TO_PLAYERS`
- `PAUSED`
- `COMPLETE`

Round state should be tracked per party and per round.

## Content Visibility Model

### Public Content

Safe before purchase or login.

Examples:

- Game title
- Public description
- Non-spoiler premise
- Player count
- Duration
- Age/content warnings
- Public character names if marketing allows
- Cover image
- Price and product info

Public content must not reveal:

- Killer identity
- Victim identity if hidden
- Murder method
- Solution
- Critical clue chain

### Host-Safe Content

Content needed for hosting without spoiling the core mystery.

Examples:

- Setup checklist
- Guest invite status
- Guest invitation delivery status and failure details
- Required character count
- Character assignment labels that avoid killer/victim spoilers
- Round start buttons
- Non-spoiler timing guidance
- Player progress indicators

Host-safe mode is the default host mode.

### Spoiler-Protected Content

Content hidden unless spoiler mode is explicitly unlocked by an authorized actor.

Examples:

- Killer identity
- Victim identity before murder
- Final solution
- Full clue map
- Evidence explanation
- Character secrets that reveal solution
- Author/editor notes

Spoiler unlock should be:

- Explicit
- Logged
- Reversible only for UI state, not for audit history
- Protected by confirmation

### Player-Private Content

Content visible only to the assigned player/guest.

Examples:

- Character private background
- Personal objectives
- Secrets to reveal
- Secrets to conceal
- Round cards
- Private clues
- Private messages
- Assigned accusations/results

Player-private content should be fetched through server-side access checks based on party, guest, assignment, current round, and visibility rules.

### Round-Unlocked Content

Content gated by party round state.

Examples:

- Round 1 cards open when Round 1 starts.
- Murder event content opens during Round 2.
- Investigation evidence opens after murder reveal.
- Accusation forms open in Round 3.
- Final reveal opens after accusations are complete or host triggers it.

Unlocking should be stored in party state, not inferred only from UI navigation.

## Victim Reveal Rules

Default rule:

- Players should not know they are the victim until the murder occurs.

Implementation guidance:

- A victim character can exist internally as a required character, but player-facing pre-murder content should avoid revealing that status.
- Host-safe assignment screens should avoid labels like `Victim` unless spoiler mode is unlocked.
- Round 1 cards for the victim should not state future victimhood.
- Round 2 murder event should reveal the victim to the party at the designed moment.
- If the victim continues as a ghost/witness/player helper, the post-murder role should be modeled in round content.

Intentional exceptions:

- Some game designs may intentionally tell a player they will be the victim. That exception should be encoded as a `SpoilerRule` or game design flag, not handled informally.

## Killer Reveal Rules

Default rule:

- Players should not know they are the killer until the final reveal.

Implementation guidance:

- Killer identity should be stored as spoiler-protected solution metadata.
- Pre-reveal player cards should not disclose killer status to the killer unless the game intentionally uses a known-killer mechanic.
- Clues may point toward or away from the killer, but the final truth should remain protected.
- Host-safe mode should not show the killer.
- Final reveal unlocks killer identity, motive, and explanation.

Intentional exceptions:

- Some games may be designed with a player knowingly acting as the killer. This should be a game-level design mode and should affect content validation, player cards, and host warnings.

## Missing Required Characters

The engine should block starting the game if required characters are not assigned.

Recommended behavior:

1. During party setup, show host a spoiler-safe required count and assignment completeness.
2. If the host has not unlocked spoiler mode, label missing requirements without revealing solution roles.
3. Prevent transition from `ASSIGNING_CHARACTERS` to `READY` while required characters are missing.
4. Offer remedies:
   - Invite more guests.
   - Assign host as a player if allowed.
   - Use a game-provided fallback if available.
   - Switch to a smaller-player-count game/version if available.
5. Optional characters can remain unassigned.
6. Critical clues held by optional characters must have redundancy or host-reveal alternatives.

## Recommended Access Check Pattern

Every gameplay read should answer these questions server-side:

1. Who is requesting the content?
2. Which party are they accessing?
3. What role do they have in that party?
4. Which character are they assigned to, if any?
5. What is the party state?
6. What is the round state?
7. Has the host unlocked spoiler mode?
8. What visibility classification does the content have?
9. What unlock rules apply?
10. Should this content be redacted, hidden, or returned?

## Conditional Reveal Flow

The current foundation adds a rule-aware layer to the existing round/reveal model.

Recommended flow:

1. Authored content is created as a card, evidence item, media asset, or digital artifact.
2. If it is conditional, the content stores a `requiredUnlockRuleId`.
3. A character tool or other trigger creates a party-scoped unlock path.
4. A runtime event, such as a valid code entry, records a successful `UnlockEvent`.
5. Player-safe services collect unlock events for the current guest.
6. Cards, evidence, media, and future digital artifacts remain hidden until the guest has the required unlock rule, the round/reveal state allows it, and the assignment/visibility rules match.

Current runtime foundation:

- `/play` displays character-specific access-code generator tools only to the assigned tool holder.
- Locked evidence, cards, media, and digital artifacts that are otherwise visible to a player appear as code-entry prompts until their required unlock rule succeeds.
- `POST /play/unlock` validates the guest, assignment, rule, target availability, CSRF token, rate limit, and hashed party tool code before recording an unlock event.
- Raw access codes are not stored; generated tool instances and attempts store hashes.

Host and admin behavior:

- Admins can inspect full authored content in admin surfaces.
- Hosts can see public and host-safe operational content by default.
- Hosts can only see spoiler-protected content after explicit spoiler-mode unlock.
- Host spoiler unlock remains separate from player conditional unlocks.

Cross-player example:

1. Character A has an access-code generator.
2. Character B has locked evidence.
3. Character A shares the generated party-specific code.
4. Character B enters the code.
5. The app records a `CodeAttempt`.
6. If valid, the app records an `UnlockEvent` scoped to Character B's guest.
7. Character B can now see the locked content; Character A and other players still cannot unless the rule scope allows it.
