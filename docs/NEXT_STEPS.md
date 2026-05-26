# Next Steps

Last inspected: 2026-05-22

## Current Baseline Completed

- Database-backed game catalog and game detail pages.
- Host party creation linked to `Game` and `GameVersion`.
- Guest join and pending approval flow.
- Character model and host character assignment flow.
- Round model, party round states, host round controls, and player-visible round cards.
- Evidence model, seeded evidence, host reveal/hide controls, and player evidence view.
- Final reveal model with separate victim reveal and final solution reveal timing.
- Accusation model, player accusation form, and host accusation results view.
- Media asset model, seeded local placeholder media, host media inventory, and player-safe media display.
- Host run-of-show summary and player status summary.
- Join/play pages have a first mobile/accessibility pass for tighter phone spacing, explicit form labels, full-width mobile actions, and safer media sizing.
- Game Builder Wizard and Conditional Reveal Engine foundations now exist for digital artifacts, character tools, unlock rules, player inventory, tool instances, code attempts, asset views, player interactions, and unlock events.
- Game Package import contract, validator, admin dry-run package review screen, and draft-only importer now exist for future AI-assisted draft creation.
- Admin game detail pages now include draft-only editors for digital artifacts, character tools, and unlock rules.
- Admin builder preview pages can simulate host-safe, spoiler-host, and character-specific visibility with round progress and selected unlock rules.
- Publish-readiness validation blocks unsafe game-version publishing when required content or conditional unlock wiring is incomplete.
- Player-facing character tool inventory and access-code entry now exist on `/play` for locked evidence, cards, media, and digital artifacts.
- Host party control now includes spoiler-safe conditional unlock activity counts, recent unlock events, and recent code attempts.
- Admin inventory now includes platform-wide conditional unlock monitoring and suspicious-attempt alert queueing for recent code attempts, failed attempts, and successful unlock events.
- Party completion/reopen flow with `PartyResult` and completed-party mutation blocking.
- Admin inventory with recent activity, orders, outbound messages, support queue, and content totals.
- Admin game detail pages with game metadata editing, game-version status controls, and first-party game draft creation.
- Admin support detail pages, support ticket status controls, reply history, queued reply emails, and internal notes.
- Customer order/access history and admin order detail pages with items, access grants, and linked webhook events.
- Admin payment observability includes order status filters, webhook status filters, and recent webhook event inventory.
- Purchase gating service checks active products, development bypass, and `UserGameAccess`.
- Checkout-start creates pending orders and can redirect to Stripe when provider settings exist.
- Stripe webhook route verifies signatures, records provider event IDs idempotently, marks paid orders, and grants game access.
- Stripe test mode is configured locally and a sandbox checkout has completed successfully.
- Stripe Dashboard webhook delivery is configured for public staging at `https://staging.macamysteries.com/api/webhooks/payments/stripe`; the old local Stripe CLI listener is stopped for staging.
- Sandbox purchase fulfillment granted active access to Murder at Hollow Lake.
- Paid order fulfillment now queues an idempotent purchase confirmation email through `OutboundMessage`.
- Payment setup docs and config check scripts exist in `docs/PAYMENT_PROVIDER_SETUP.md` and `npm run payment:check`.
- Admin payment maintenance can cancel stale pending orders and reconcile paid orders that are missing game access.
- Payment checkout and Stripe webhook routes emit structured payment logs and mark failed checkout/webhook processing states.
- Invitation email drafts are queued in `OutboundMessage` when parties are created, guests are added, or invites are resent, and guest records track invitation queued/sent/failed status.
- Outbound email/SMS provider helpers, queued email creation, console/Resend email delivery, sent/failed markers, and retry controls exist.
- Account email verification and password reset flows use signed links and queued email messages.
- Support-gated account recovery cases exist for ticket-linked identity review, safe reset/verification email queueing, active/stale/risk reporting, deduped risk alerting, and recovery audit history.
- User sessions now retain IP address, user-agent, created-by, last-seen, expiration, and revocation metadata.
- Login now tracks consecutive failed attempts and temporarily locks accounts after repeated failures.
- Repeated-login lockouts now queue deduped account-security alert emails when `ADMIN_ALERT_EMAILS` is configured.
- Role changes and password resets now invalidate active sessions for the affected account.
- SMS preference model and account notification settings screen exist; real SMS sending remains disabled until a provider is chosen.
- Support ticket intake stores requests in Postgres.
- Audit log foundation covers host, player, admin content, support, invite, party status, and outbound retry mutations.
- Database-backed rate limiting is wired into login, signup, join, support, and checkout-start.
- CSRF tokens are wired into mutation forms and route handlers; production rejects missing/invalid tokens.
- Object storage policy helpers, upload validation, and local admin media uploads are in place.
- Docker production scaffolding and deployment/cutover notes exist.
- Content workflow, spoiler review checklist, account recovery, production recovery, security hardening, environment, and marketplace planning docs exist.
- Shared test fixture helper foundation exists under `tests/helpers`.
- Dedicated test database preparation exists through `npm run test:prepare`, and standard `npm test` uses the test database when `TEST_BASE_URL` is not set.
- Automated tests cover invite parsing, invitation delivery state, card/evidence/media visibility, access control, guest cookie behavior, assignment, round progression, evidence/final reveal, accusations, purchase gating, order fulfillment, rate limiting, support replies/internal notes, storage validation/local upload writes, outbound delivery, payment checkout, Stripe webhook handling, admin character/round/card/evidence/media/builder editing, builder previews, and publish readiness.
- Conditional reveal tests cover role-safe visibility, cross-player access-code unlocks that reveal locked content only to the intended player, player tool panel/code-entry behavior, admin validation for builder-authored tools/rules/artifacts, preview-as-host/character behavior, and publish blocking for unsafe unlock wiring.

## Next Development Steps

1. Keep Git healthy.
   - Status: implemented save point.
   - Commit `725ded9` saves the completed platform foundation and conditional reveal engine slice.
   - Keep future commits smaller and feature-scoped.

2. Run the live smoke suite after every server restart.
   - Keep `http://192.168.2.45:3001` reachable.
   - Keep `https://staging.macamysteries.com` healthy through Cloudflare Tunnel.
   - Run `TEST_BASE_URL=http://127.0.0.1:3001 npm test`.
   - Run `TEST_BASE_URL=https://staging.macamysteries.com npm test` after public staging changes.
   - Probe `/`, `/games`, `/support`, `/admin`, and one game detail route.

3. Create a dedicated test database.
   - Status: implemented.
   - `npm run test:prepare` creates/migrates the test database.
   - `npm test` uses `DATABASE_URL_TEST` or a derived `_test` database when `TEST_BASE_URL` is not set.
   - `TEST_BASE_URL=http://127.0.0.1:3001 npm test` still uses the running app database so live route fixtures match the server.

4. Clean up payment test operations.
   - Status: implemented.
   - Stale pending orders older than 24 hours can be cancelled from Admin > Payment operations.
   - Paid orders can be reconciled from Admin > Payment operations or a specific admin order detail page.
   - Pending Stripe Checkout sessions older than 10 minutes can be checked against Stripe and fulfilled if Stripe reports the session as complete/paid.
   - Restart steps for the staging app and Stripe Dashboard webhook setup are documented in `docs/PAYMENT_PROVIDER_SETUP.md`.

5. Expand payment observability.
   - Status: implemented foundation.
   - Structured logs now cover checkout session creation/failure and Stripe webhook invalid/duplicate/completed/failed processing events.
   - Admin payment operations now shows an attention banner for failed webhooks and recoverable pending Stripe checkouts.
   - Admin payment operations can queue deduped payment-risk alert emails to `ADMIN_ALERT_EMAILS` for failed webhooks, stale pending orders, and recoverable Stripe checkouts.
   - Configure `ADMIN_ALERT_EMAILS` before live testing and keep email delivery healthy.
   - Add deeper filters for abandoned sessions and repeated checkout attempts.

6. Choose and implement the email provider.
   - Status: partially implemented.
   - Console dry-run email delivery and Resend HTTP delivery are wired for queued `OutboundMessage` email records.
   - Production sender/domain setup and real API key configuration still need to be completed outside the codebase.
   - Before go-live, replace the temporary Gmail sender with a verified `MaCaMysteries.com` sender/domain and rerun the email checklist in `docs/EMAIL_PROVIDER_SETUP.md`.
   - Purchase confirmation emails are queued after paid fulfillment.
   - Next email templates: polished invitations, support notices, account verification, password reset, reminders, and branded HTML/plain-text production versions.

7. Add email verification and password reset.
   - Status: implemented foundation plus support/admin recovery case workflow.
   - Signed account-action links support email verification and password reset.
   - Verification/reset messages are queued as `OutboundMessage` emails for console/Resend delivery.
   - Password reset revokes existing sessions and signs the user in with the new password.
   - Support/admin recovery procedures are documented in `docs/ACCOUNT_RECOVERY_PROCEDURES.md`.
   - `/admin/account-recovery` lets support-capable admins create recovery cases, link matching support tickets, mark identity verification state, queue password reset/email verification messages, review active/stale/recent/repeated-request recovery counts, queue deduped risk alerts, and close cases without exposing signed recovery links.
   - Session metadata and the first account lockout policy are implemented.
   - Repeated-login lockouts queue deduped account-security alert emails to configured admin alert recipients.
   - Password reset invalidates active sessions for the affected account.
   - Next: run a recovery drill, add session rotation after additional sensitive changes, and deepen behavioral risk scoring before production launch.

8. Choose and implement the SMS provider.
   - Pick Twilio or another provider.
   - Add phone verification, opt-in history, STOP/START handling, and delivery adapter.
   - Keep SMS disabled for any user without explicit opt-in.

9. Build admin content editing for characters.
   - Status: implemented foundation.
   - Create/edit character key, name, public bio, private bio, required/optional flag, and sort order.
   - Audit all edits.
   - Add validation for duplicate keys and required character coverage.
   - Character editing is available on `/admin/games/[gameId]` for draft versions only; published versions are locked.

10. Build admin content editing for rounds and cards.
   - Status: implemented foundation.
   - Create/edit round definitions and player cards.
   - Enforce visibility values and round ordering.
   - Add spoiler labels for victim/killer/final reveal content.
   - Round/card editing is available on `/admin/games/[gameId]` for draft versions only; published versions are locked.

11. Build admin content editing for evidence and media metadata.
   - Status: implemented foundation.
   - Create/edit evidence records and media metadata.
   - Validate visibility, round linkage, character linkage, and evidence type.
   - Keep binary upload separate until storage endpoints are ready.
   - Evidence/media metadata editing is available on `/admin/games/[gameId]` for draft versions only; binary uploads remain separate.

12. Add upload endpoints and storage integration.
   - Status: implemented local foundation.
   - Implement local/S3-compatible storage behind the existing storage policy helpers.
   - Enforce MIME type, file size, and private/public path rules.
   - Add signed URL strategy before private media is used.
   - Keep media assets compatible with conditional reveal rules, locked evidence, digital artifacts, and private player-only content.
   - Admin uploads are available at `/admin/media/uploads`; public local files are served from `/uploads/media/...`, while private local files are stored outside `public/` and are not served until signed URLs exist.

13. Build spoiler-safe host mode controls.
   - Status: implemented foundation.
   - Keep default host view spoiler-safe.
   - Add explicit unlock flow for spoiler mode.
   - Audit spoiler unlock and require clear confirmation.
   - Host party pages now hide spoiler-protected media and final solution details until the host explicitly unlocks spoiler mode; unlock state is stored on the party and audit logged.

14. Improve invitation workflow.
   - Status: implemented foundation.
   - Guest records track invitation status, last queued time, last sent time, resend count, failed time, and failed delivery details.
   - Host party control shows invitation delivery state per guest and keeps resend available, including failed invitations.
   - Outbound delivery markers update guest invitation state when invitation emails are sent, failed, or retried.
   - Add reminder scheduling later.

15. Improve player mobile usability.
   - Status: partially implemented.
   - Join and player pages now use tighter mobile spacing, responsive heading sizes, explicit labels for form controls, full-width mobile action buttons, safer image containment, and break-word guards for long names/emails/titles.
   - Manual real-device or browser viewport review is still needed for join/play/accusation/reveal before launch.
   - Continue accessibility pass for contrast, focus states, and screen-reader flow as designs mature.

16. Add support replies and internal notes.
   - Status: implemented foundation.
   - Support tickets now have message history records.
   - Admins can queue customer reply emails through `OutboundMessage`.
   - Admins can add internal-only notes.
   - Status changes, replies, and internal notes are audit logged.
   - Dedicated SLA/status-history automation can be added later if support volume grows.

17. Split admin roles.
   - Status: implemented foundation.
   - `UserRole` now includes `SUPER_ADMIN`, `CONTENT_EDITOR`, `SUPPORT`, and `FINANCE`.
   - Admin pages and mutation routes are gated by content, payment, support, and outbound-message permissions.
   - `ADMIN` remains fully compatible as a full-access operational role.
   - Super-admin account operations now exist at `/admin/users` for role assignment requests, approval review, session revocation, search/filtering, and recent account-security audit review.
   - If no `SUPER_ADMIN` exists yet, a current full `ADMIN` can bootstrap the first super-admin account.
   - Sensitive operational role changes now create `AdminActionRequest` approval records before the target user role changes.
   - Role-change requests, approvals, denials, session revocations, account creation, sign-in success/failure/rate-limit events, logout, email verification, and password reset events are audit logged and visible in the recent account-security trail.
   - Account recovery case actions are audit logged and included in the account-security trail.
   - Active session metadata, failed-attempt counts, account lock status, and recent session context are visible in `/admin/users`.
   - Approved role changes invalidate active sessions for the target account.
   - Next: add broader login/security event monitoring, run the recovery drill, and deepen behavioral risk scoring.

18. Prepare production process, network layer, and security gates.
   - Status: in progress.
   - Docker production Compose now passes public URL, CSRF/account secrets, provider settings, and app health checks into the app container.
   - Production startup now requires `APP_URL`, `CSRF_SECRET`, and `ACCOUNT_TOKEN_SECRET`, and rejects placeholder-grade secrets.
   - Choose direct process manager versus Docker cutover.
   - Add reverse proxy, TLS, firewall, health checks, and restart policy.
   - Keep CSRF protection, rate limiting, access control tests, host spoiler-safe mode, and player-safe content projections active as every new route is added.
   - Document the exact local Ubuntu to data-center path.

19. Automate backups and restore drills.
   - Status: implemented foundation.
   - `npm run backup:db` creates timestamped custom-format PostgreSQL dumps under `DATABASE_BACKUP_DIR`.
   - `npm run backup:restore-drill -- /path/to/backup.dump` restores a backup into a separate guarded drill database and verifies Prisma migration status.
   - The backup and restore-drill scripts use host PostgreSQL client tools when available and can fall back to a running Postgres Docker container.
   - Server prerequisite still preferred: install PostgreSQL client tools so `pg_dump`, `pg_restore`, and `psql` are available directly.
   - Schedule PostgreSQL backups.
   - Store backups off-box.
   - Practice restore into a separate database before production launch and record the drill result.

20. Keep marketplace work behind the first-party MVP.
   - Preserve creator profile, publishing approval, revenue split, payout, and review plans.
   - The Mystery Party Theme Builder should remain inside the MaCa Mysteries app as the canonical builder/runtime.
   - Future AI authoring tools should feed the app through a structured Game Package import into draft game versions.
   - Do not build creator selling flows until first-party purchase, hosting, play, support, operations, the internal Game Builder, and the Conditional Reveal Engine are stable.

21. Build the internal Game Builder Wizard and Conditional Reveal Engine.
   - Status: implemented foundation with draft-only admin editors, admin preview pages, publish-readiness checks, and the first player-facing access-code unlock path for evidence/cards/media/digital artifacts.
   - Schema now supports digital artifacts, character tools, unlock rules, tool instances, unlock events, code attempts, asset views, player interactions, and player inventory.
   - Existing cards, evidence, and media can reference a required unlock rule.
   - Player-safe content helpers now hide conditionally locked cards/evidence/media until the player has the required unlock event.
   - `/play` now shows character-specific access-code generator tools, prompts players for locked evidence/card/media/artifact codes when applicable, and posts unlock attempts through a CSRF-protected, rate-limited route.
   - Host party pages now show sanitized conditional unlock activity without exposing raw codes or spoiler-sensitive rule titles unless host spoiler mode is unlocked.
   - Admin inventory now shows platform-wide conditional unlock monitoring and deduped alert queueing for recent code attempts, failed attempts, and unlock events without exposing stored code hashes.
   - Admin game detail pages can create/update draft digital artifacts, character tools, and unlock rules.
   - Builder editor services validate draft locks, duplicate keys, version-owned linkages, player-private character requirements, valid rule targets, and access-code source tools.
   - Builder preview pages simulate host-safe, spoiler-host, and character-specific visibility with round progress and selected unlock rules.
   - Publishing now checks required content, final reveal presence, version-owned linkages, orphan required unlocks, unpublished required rules, unattached published rules, and access-code generator requirements.
   - Game Package schema validation now exists for AI-assisted drafts; it validates structure, duplicate keys, references, visibility rules, source metadata, and final reveal references without writing to the database.
   - `/admin/games/package` lets content admins dry-run pasted JSON or uploaded `.json` packages, and `POST /admin/games/package/validate` returns validation reports without creating game records.
   - `POST /admin/games/package/import` now creates a new draft game/version from a valid package, preserves source metadata/content warnings, wires conditional unlock targets, redirects to admin game detail, and leaves publishing/manual review separate.
   - Next implementation step: continue conditional reveal work for asset-view rules, host-approval rules, reveal-state rules, multi-player interaction rules, threshold tuning/reporting, deeper readiness checks for circular dependencies and spoiler wording, and then polish imported draft review workflows.

22. Add a certified creator dashboard after the internal builder is stable.
   - Future `/creator` routes should be hidden unless the signed-in user has a certified/approved creator profile.
   - Certified creators should use the same builder/versioning/preview/publish-readiness foundation as Burnett Games admins, scoped to games they own.
   - Creator drafts may be hand-authored or imported from external AI tools through the Game Package pipeline.
   - Creator submissions require admin review and publishing approval before any marketplace sale.
   - Payouts, revenue splits, public creator storefronts, and reviews remain later marketplace work.
