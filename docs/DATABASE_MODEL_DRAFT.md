# Database Model Draft

Last inspected: 2026-05-21

## Purpose

This is a first-draft PostgreSQL/Prisma-oriented data model for the self-hosted MaCa Mysteries platform. It extends far beyond the current Prisma schema.

Current implemented Prisma models now cover the first-party MVP plus the Game Builder / Conditional Reveal foundation:

- Auth and accounts: `User`, `UserSession`
- Commerce: `Product`, `Order`, `OrderItem`, `UserGameAccess`, `PaymentWebhookEvent`
- Game content: `Game`, `GameVersion`, `GameCharacter`, `GameRound`, `GameCard`, `GameEvidence`, `GameMediaAsset`, `GameFinalReveal`
- Builder/conditional content: `GameDigitalArtifact`, `GameCharacterTool`, `GameUnlockRule`
- Party runtime: `Party`, `Guest`, `PartyCharacterAssignment`, `PartyRoundState`, `PartyEvidenceReveal`, `PartyFinalRevealState`, `PartyAccusation`, `PartyResult`
- Conditional runtime: `PartyToolInstance`, `PartyUnlockEvent`, `PartyCodeAttempt`, `PartyAssetView`, `PartyPlayerInteraction`, `PartyPlayerInventory`
- Operations: `OutboundMessage`, `SupportTicket`, `SupportTicketMessage`, `AuditLog`, `AdminActionRequest`, `AccountRecoveryCase`, `RateLimitBucket`

Target models below use snake_case table names because the requested documentation names them that way. Prisma model names can be PascalCase with `@@map()` if desired.

## Design Principles

- Game content must be versioned.
- Party instances must reference a specific game version.
- Spoiler-sensitive content must have explicit visibility fields.
- Player-private content must be tied to character assignments and party round state.
- Orders and products must be separate from gameplay content.
- Marketplace tables should be planned but not implemented until first-party game sales and hosting work.
- Binary media should live in object storage, with metadata in PostgreSQL.

## Core Auth And Users

### users

Stores platform users.

Suggested fields:

- `id`
- `email`
- `email_verified_at`
- `name`
- `first_name`
- `last_name`
- `role`
- `password_hash`
- `status`
- `created_at`
- `updated_at`

Notes:

- Current schema has `User.id`, `email`, `emailVerifiedAt`, `name`, `role`, `passwordHash`, phone/preference fields, and timestamps.
- Current `UserRole` values are `HOST`, `PLAYER`, `ADMIN`, `SUPER_ADMIN`, `CONTENT_EDITOR`, `SUPPORT`, and `FINANCE`.
- Add user status before production.

### accounts

Needed if OAuth/social login is added.

Suggested fields:

- `id`
- `user_id`
- `provider`
- `provider_account_id`
- `access_token_encrypted`
- `refresh_token_encrypted`
- `expires_at`
- `created_at`
- `updated_at`

Status:

- Later or only if OAuth is needed.

### sessions

Stores active user sessions.

Suggested fields:

- `id`
- `user_id`
- `token_hash`
- `ip_address`
- `user_agent`
- `expires_at`
- `revoked_at`
- `created_at`

Notes:

- Current schema has `UserSession`.
- Consider renaming/mapping to `sessions` or keeping `user_sessions`.

### admin_action_requests

Tracks super-admin approval requests for sensitive account operations.

Current implemented fields:

- `id`
- `requested_by_user_id`
- `target_user_id`
- `reviewed_by_user_id`
- `action_type`
- `status`
- `target_type`
- `target_id`
- `previous_role`
- `requested_role`
- `reason`
- `review_note`
- `metadata`
- `reviewed_at`
- `expires_at`
- `created_at`
- `updated_at`

Current use:

- Sensitive role changes involving operational roles are queued as `PENDING` approval requests instead of immediately changing the user.
- Approve/deny actions are CSRF-protected, audit logged, and visible on `/admin/users`.
- First-super-admin bootstrap remains direct when no `SUPER_ADMIN` exists yet.

### account_recovery_cases

Tracks support/admin account recovery reviews without exposing reset links.

Current Prisma name: `AccountRecoveryCase`.

Current implemented fields:

- `id`
- `requested_by_user_id`
- `target_user_id`
- `reviewed_by_user_id`
- `support_ticket_id`
- `email`
- `request_type`
- `status`
- `verification_status`
- `notes`
- `resolution_note`
- `password_reset_queued_at`
- `email_verification_queued_at`
- `sessions_revoked_at`
- `reviewed_at`
- `created_at`
- `updated_at`

Current use:

- `/admin/account-recovery` is visible to support-capable admin roles.
- Cases can link to support tickets, but the account email must match the ticket email.
- Password reset emails can be queued from a case only after identity verification is marked `VERIFIED`.
- Email verification messages can be requeued for unverified target accounts.
- Recovery actions are audit logged with `accountRecovery.*` actions.
- Signed reset/verification links remain inside queued outbound email content and are not shown in admin UI.

## Catalog And Game Content

### games

Top-level game title.

Suggested fields:

- `id`
- `slug`
- `title`
- `subtitle`
- `public_description`
- `short_description`
- `player_count_min`
- `player_count_max`
- `duration_minutes_min`
- `duration_minutes_max`
- `themes`
- `content_warnings`
- `cover_media_asset_id`
- `ownership_type`
- `status`
- `created_by_user_id`
- `created_at`
- `updated_at`

### game_versions

Versioned content snapshot for a game.

Suggested fields:

- `id`
- `game_id`
- `version_label`
- `version_number`
- `status`
- `published_at`
- `retired_at`
- `design_mode`
- `default_round_count`
- `solution_summary`
- `killer_character_id`
- `victim_character_id`
- `created_by_user_id`
- `created_at`
- `updated_at`

Visibility warning:

- `killer_character_id`, `victim_character_id`, and `solution_summary` are spoiler-protected.

### game_characters

Characters available in a game version.

Suggested fields:

- `id`
- `game_version_id`
- `slug`
- `display_name`
- `public_description`
- `private_background`
- `host_safe_label`
- `is_required`
- `is_optional`
- `is_victim`
- `is_killer`
- `assignment_group`
- `sort_order`
- `portrait_media_asset_id`
- `visibility`
- `created_at`
- `updated_at`

Notes:

- `is_victim` and `is_killer` are spoiler-protected.
- For strict spoiler design, these can be moved to a `game_solution_roles` table.

### game_rounds

Rounds in a game version.

Suggested fields:

- `id`
- `game_version_id`
- `round_number`
- `slug`
- `title`
- `host_safe_title`
- `description`
- `sort_order`
- `default_state`
- `unlock_policy`
- `created_at`
- `updated_at`

### game_cards

Cards delivered to characters by round.

Suggested fields:

- `id`
- `game_version_id`
- `round_id`
- `character_id`
- `title`
- `body`
- `objectives`
- `things_to_reveal`
- `things_to_conceal`
- `visibility`
- `required_unlock_rule_id`
- `unlock_policy`
- `sort_order`
- `created_at`
- `updated_at`

### game_evidence

Evidence definitions for a game version.

Suggested fields:

- `id`
- `game_version_id`
- `round_id`
- `slug`
- `title`
- `description`
- `evidence_type`
- `body`
- `media_asset_id`
- `visibility`
- `required_unlock_rule_id`
- `unlock_policy`
- `revealed_by_default`
- `sort_order`
- `created_at`
- `updated_at`

### game_media_assets

Media metadata for game content.

Suggested fields:

- `id`
- `game_version_id`
- `storage_provider`
- `storage_key`
- `public_url`
- `mime_type`
- `asset_type`
- `filename`
- `size_bytes`
- `duration_seconds`
- `alt_text`
- `caption`
- `visibility`
- `required_unlock_rule_id`
- `checksum`
- `created_by_user_id`
- `created_at`
- `updated_at`

### game_messages

In-game message templates or scripted communication artifacts.

Suggested fields:

- `id`
- `game_version_id`
- `round_id`
- `character_id`
- `sender_label`
- `recipient_label`
- `message_type`
- `subject`
- `body`
- `media_asset_id`
- `visibility`
- `unlock_policy`
- `sort_order`
- `created_at`
- `updated_at`

### pre_game_tasks

Not in the required list, but recommended.

Suggested fields:

- `id`
- `game_version_id`
- `character_id`
- `title`
- `body`
- `visibility`
- `sort_order`
- `created_at`
- `updated_at`

### spoiler_rules

Not in the required list, but recommended.

Suggested fields:

- `id`
- `game_version_id`
- `content_type`
- `content_id`
- `actor_type`
- `visibility`
- `unlock_round_id`
- `requires_host_spoiler_mode`
- `requires_assignment_character_id`
- `created_at`
- `updated_at`

### game_digital_artifacts

Structured builder-authored artifacts such as fake emails, fake text messages, investigation sheets, restricted folders, decoder payloads, or inventory-style clues.

Current Prisma name: `GameDigitalArtifact`.

Suggested fields:

- `id`
- `game_version_id`
- `game_round_id`
- `character_id`
- `evidence_id`
- `media_asset_id`
- `key`
- `title`
- `description`
- `artifact_type`
- `visibility`
- `required_unlock_rule_id`
- `content`
- `sort_order`
- `created_at`
- `updated_at`

### game_character_tools

Character-specific digital tools such as keys, decoders, scanners, access-code generators, or investigation aids.

Current Prisma name: `GameCharacterTool`.

Suggested fields:

- `id`
- `game_version_id`
- `character_id`
- `key`
- `title`
- `description`
- `tool_type`
- `visibility`
- `config`
- `sort_order`
- `created_at`
- `updated_at`

### game_unlock_rules

Rules that describe when and how locked content becomes available.

Current Prisma name: `GameUnlockRule`.

Suggested fields:

- `id`
- `game_version_id`
- `required_round_id`
- `required_character_id`
- `source_tool_id`
- `key`
- `title`
- `description`
- `rule_type`
- `trigger_type`
- `target_type`
- `target_id`
- `unlock_scope`
- `code_mode`
- `config`
- `effect`
- `status`
- `sort_order`
- `created_at`
- `updated_at`

## Commerce

### products

Sellable products.

Suggested fields:

- `id`
- `game_id`
- `sku`
- `name`
- `description`
- `price_cents`
- `currency`
- `status`
- `provider_product_id`
- `provider_price_id`
- `created_at`
- `updated_at`

### orders

Customer purchases.

Suggested fields:

- `id`
- `user_id`
- `status`
- `subtotal_cents`
- `tax_cents`
- `total_cents`
- `currency`
- `payment_provider`
- `provider_checkout_session_id`
- `provider_payment_intent_id`
- `paid_at`
- `created_at`
- `updated_at`

### order_items

Purchased items inside orders.

Suggested fields:

- `id`
- `order_id`
- `product_id`
- `game_id`
- `quantity`
- `unit_price_cents`
- `total_cents`
- `created_at`

### user_game_access

Recommended for linking purchases to host ability.

Suggested fields:

- `id`
- `user_id`
- `game_id`
- `product_id`
- `source`
- `status`
- `created_at`
- `updated_at`

Current Prisma name: `UserGameAccess`.

### payment_webhook_events

Provider webhook idempotency and audit trail.

Suggested fields:

- `id`
- `provider`
- `event_id`
- `event_type`
- `status`
- `order_id`
- `payload`
- `processed_at`
- `created_at`
- `updated_at`

Current Prisma name: `PaymentWebhookEvent`.

## Party Runtime

### party_instances

Hosted game run.

Suggested fields:

- `id`
- `host_user_id`
- `game_id`
- `game_version_id`
- `order_item_id`
- `title`
- `invite_code`
- `status`
- `scheduled_at`
- `started_at`
- `completed_at`
- `host_spoiler_unlocked_at`
- `host_spoiler_unlocked_by_user_id`
- `created_at`
- `updated_at`

Current equivalent:

- `Party`

### party_guests

Invited or joined party participants.

Suggested fields:

- `id`
- `party_instance_id`
- `user_id`
- `email`
- `phone`
- `display_name`
- `invite_token_hash`
- `guest_session_token_hash`
- `status`
- `invitation_status`
- `invitation_last_queued_at`
- `invitation_last_sent_at`
- `invitation_resend_count`
- `invitation_failed_at`
- `invitation_failure_detail`
- `invited_at`
- `joined_at`
- `last_seen_at`
- `created_at`
- `updated_at`

Current equivalent:

- `Guest`, including invitation status, queued/sent timestamps, resend count, and failed delivery detail.

### party_tool_instances

Party-specific instances of character tools, including one-time or limited-use code generators.

Current Prisma name: `PartyToolInstance`.

### party_unlock_events

Successful unlock history. Used by player-safe content filters.

Current Prisma name: `PartyUnlockEvent`.

### party_code_attempts

Access-code attempt history. Raw codes should not be stored; the current foundation stores salted hashes.

Current Prisma name: `PartyCodeAttempt`.

### party_asset_views

Asset/content view history for rules such as "unlock after another clue has been viewed."

Current Prisma name: `PartyAssetView`.

### party_player_interactions

Cross-player interaction history for rules requiring collaboration.

Current Prisma name: `PartyPlayerInteraction`.

### party_player_inventory

Per-player inventory state for digital keys, tools, clues, and artifacts.

Current Prisma name: `PartyPlayerInventory`.

### party_character_assignments

Guest-to-character mapping.

Suggested fields:

- `id`
- `party_instance_id`
- `party_guest_id`
- `game_character_id`
- `assigned_by_user_id`
- `assignment_method`
- `status`
- `created_at`
- `updated_at`

Constraints:

- Unique active assignment per `party_guest_id`.
- Unique active assignment per `game_character_id` within a party.

### party_round_state

Round state for a party.

Suggested fields:

- `id`
- `party_instance_id`
- `game_round_id`
- `state`
- `opened_at`
- `completed_at`
- `opened_by_user_id`
- `created_at`
- `updated_at`

### party_evidence_reveals

Evidence unlock/reveal log.

Suggested fields:

- `id`
- `party_instance_id`
- `game_evidence_id`
- `revealed_to`
- `party_guest_id`
- `game_character_id`
- `revealed_by_user_id`
- `revealed_at`
- `created_at`

### party_messages

Delivered in-game messages.

Suggested fields:

- `id`
- `party_instance_id`
- `game_message_id`
- `party_guest_id`
- `game_character_id`
- `delivery_channel`
- `delivery_status`
- `delivered_at`
- `read_at`
- `created_at`
- `updated_at`

### party_accusations

Player accusations.

Suggested fields:

- `id`
- `party_instance_id`
- `party_guest_id`
- `accused_character_id`
- `motive_text`
- `evidence_text`
- `is_final`
- `submitted_at`
- `created_at`
- `updated_at`

### party_results

Final party outcome.

Suggested fields:

- `id`
- `party_instance_id`
- `final_reveal_unlocked_at`
- `final_reveal_unlocked_by_user_id`
- `killer_character_id`
- `victim_character_id`
- `result_summary`
- `created_at`
- `updated_at`

## Support And Operations

### outbound_messages

Queued email/SMS delivery records.

Suggested fields:

- `id`
- `user_id`
- `party_id`
- `channel`
- `recipient`
- `template_key`
- `subject`
- `body_preview`
- `provider`
- `provider_message_id`
- `status`
- `error_message`
- `sent_at`
- `created_at`
- `updated_at`

### support_tickets

Customer support requests.

Suggested fields:

- `id`
- `user_id`
- `party_instance_id`
- `order_id`
- `email`
- `subject`
- `body`
- `status`
- `priority`
- `assigned_to_user_id`
- `created_at`
- `updated_at`

### support_ticket_messages

Threaded support history for customer messages, admin replies, and internal notes.

Current Prisma name: `SupportTicketMessage`.

Suggested fields:

- `id`
- `ticket_id`
- `author_user_id`
- `message_type`
- `body`
- `outbound_message_id`
- `created_at`

### audit_log

Security and business audit events.

Suggested fields:

- `id`
- `actor_user_id`
- `actor_type`
- `event_type`
- `entity_type`
- `entity_id`
- `metadata`
- `ip_address`
- `user_agent`
- `created_at`

Important events:

- Login
- Logout
- Password reset
- Party created
- Guest invited
- Character assigned
- Spoiler mode unlocked
- Round unlocked
- Evidence revealed
- Final reveal unlocked
- Payment completed/refunded
- Admin content published

### rate_limit_buckets

Database-backed request throttling.

Suggested fields:

- `id`
- `scope`
- `key`
- `window_start`
- `count`
- `expires_at`
- `created_at`
- `updated_at`

## Future Marketplace Entities

These should be designed later and not included in the first MVP implementation unless needed.

### creator_profiles

Later.

Stores creator seller identity, bio, payout status, and marketplace settings.

Suggested fields:

- `id`
- `user_id`
- `display_name`
- `bio`
- `status`
- `payout_provider_account_id`
- `created_at`
- `updated_at`

### creator_games

Later.

Links creator profiles to games they own or manage.

Suggested fields:

- `id`
- `creator_profile_id`
- `game_id`
- `role`
- `created_at`
- `updated_at`

### creator_payouts

Later.

Tracks payout batches to creators.

Suggested fields:

- `id`
- `creator_profile_id`
- `amount_cents`
- `currency`
- `status`
- `provider_payout_id`
- `period_start`
- `period_end`
- `paid_at`
- `created_at`
- `updated_at`

### creator_revenue_splits

Later.

Defines revenue share rules.

Suggested fields:

- `id`
- `game_id`
- `creator_profile_id`
- `percentage_bps`
- `effective_from`
- `effective_to`
- `created_at`
- `updated_at`

### marketplace_reviews

Later.

Customer reviews of marketplace games.

Suggested fields:

- `id`
- `game_id`
- `user_id`
- `rating`
- `title`
- `body`
- `status`
- `created_at`
- `updated_at`

### publishing_approvals

Later.

Moderation and approval workflow for creator games.

Suggested fields:

- `id`
- `game_id`
- `game_version_id`
- `submitted_by_user_id`
- `reviewed_by_user_id`
- `status`
- `notes`
- `submitted_at`
- `reviewed_at`
- `created_at`
- `updated_at`

## Suggested Enums

Useful enums for Prisma:

- `UserRole`: `CUSTOMER`, `HOST`, `PLAYER`, `ADMIN`, `SUPPORT`, `CREATOR`
- `UserStatus`: `ACTIVE`, `PENDING_EMAIL`, `SUSPENDED`, `DELETED`
- `GameStatus`: `DRAFT`, `REVIEW`, `PUBLISHED`, `RETIRED`, `ARCHIVED`
- `GameOwnershipType`: `FIRST_PARTY`, `CREATOR`
- `GameVersionStatus`: `DRAFT`, `REVIEW`, `PUBLISHED`, `RETIRED`, `ARCHIVED`
- `Visibility`: `PUBLIC`, `HOST_SAFE`, `HOST_SPOILER`, `PLAYER_PRIVATE`, `ROUND_UNLOCKED`, `ADMIN_ONLY`
- `BuilderArtifactType`: `DOCUMENT`, `EMAIL`, `MESSAGE`, `IMAGE`, `AUDIO`, `VIDEO`, `INVESTIGATION_SHEET`, `INVENTORY_ITEM`, `TOOL_PAYLOAD`
- `CharacterToolType`: `GENERIC`, `ACCESS_CODE_GENERATOR`, `DECODER`, `KEY`, `SCANNER`, `NOTEBOOK`
- `UnlockRuleType`: `MANUAL`, `ACCESS_CODE`, `ASSET_VIEWED`, `PLAYER_INTERACTION`, `HOST_APPROVAL`, `ROUND_STATE`, `REVEAL_STATE`
- `UnlockScope`: `PLAYER`, `ALL_PLAYERS`, `HOST`, `HOST_AND_PLAYERS`, `PARTY`
- `PartyStatus`: `DRAFT`, `INVITING`, `ASSIGNING_CHARACTERS`, `READY`, `IN_PROGRESS`, `PAUSED`, `FINAL_REVEAL_UNLOCKED`, `COMPLETE`, `CANCELLED`
- `RoundState`: `LOCKED`, `AVAILABLE_TO_HOST`, `OPEN_TO_PLAYERS`, `PAUSED`, `COMPLETE`
- `GuestStatus`: `INVITED`, `JOINED`, `DECLINED`, `REMOVED`
- `InvitationStatus`: `NOT_SENT`, `QUEUED`, `SENT`, `FAILED`
- `AssignmentStatus`: `ACTIVE`, `REPLACED`, `REMOVED`
- `OrderStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `CANCELLED`
- `SupportTicketStatus`: `OPEN`, `WAITING_ON_CUSTOMER`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`

## Near-Term Migration From Current Schema

Current Prisma names intentionally use PascalCase model names and map naturally to the self-hosted domain:

- `User`, `UserSession`
- `Game`, `GameVersion`, `GameCharacter`, `GameRound`, `GameCard`, `GameEvidence`, `GameMediaAsset`, `GameFinalReveal`
- `Product`, `Order`, `OrderItem`, `UserGameAccess`, `PaymentWebhookEvent`
- `Party`, `Guest`, `PartyCharacterAssignment`, `PartyRoundState`, `PartyEvidenceReveal`, `PartyFinalRevealState`, `PartyAccusation`, `PartyResult`
- `GameDigitalArtifact`, `GameCharacterTool`, `GameUnlockRule`
- `PartyToolInstance`, `PartyUnlockEvent`, `PartyCodeAttempt`, `PartyAssetView`, `PartyPlayerInteraction`, `PartyPlayerInventory`
- `OutboundMessage`, `SupportTicket`, `SupportTicketMessage`, `AuditLog`, `RateLimitBucket`

Near-term strategy:

1. Keep published `GameVersion` records immutable.
2. Keep publish-readiness validation in the publish path as builder entities expand.
3. Continue expanding tests against the dedicated test database before production.
4. Avoid destructive renames until backup/restore drills and migration scripts are proven.
