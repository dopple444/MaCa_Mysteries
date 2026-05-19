# Next Steps

Last inspected: 2026-05-19

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
- Party completion/reopen flow with `PartyResult` and completed-party mutation blocking.
- Admin inventory with recent activity, orders, outbound messages, support queue, and content totals.
- Admin game detail pages with game metadata editing, game-version status controls, and first-party game draft creation.
- Admin support detail pages and support ticket status controls.
- Customer order/access history and admin order detail pages with items, access grants, and linked webhook events.
- Admin payment observability includes order status filters, webhook status filters, and recent webhook event inventory.
- Purchase gating service checks active products, development bypass, and `UserGameAccess`.
- Checkout-start creates pending orders and can redirect to Stripe when provider settings exist.
- Stripe webhook route verifies signatures, records provider event IDs idempotently, marks paid orders, and grants game access.
- Invitation email drafts are queued in `OutboundMessage` when parties are created, guests are added, or invites are resent.
- Outbound email/SMS provider helpers, queued email creation, sent/failed markers, and retry controls exist.
- SMS preference model and account notification settings screen exist; real SMS sending remains disabled until a provider is chosen.
- Support ticket intake stores requests in Postgres.
- Audit log foundation covers host, player, admin content, support, invite, party status, and outbound retry mutations.
- Database-backed rate limiting is wired into login, signup, join, support, and checkout-start.
- CSRF tokens are wired into mutation forms and route handlers; production rejects missing/invalid tokens.
- Object storage policy helpers and upload validation are in place before upload endpoints are enabled.
- Docker production scaffolding and deployment/cutover notes exist.
- Content workflow, spoiler review checklist, production recovery, security hardening, environment, and marketplace planning docs exist.
- Shared test fixture helper foundation exists under `tests/helpers`.
- Automated tests cover invite parsing, card/evidence/media visibility, access control, guest cookie behavior, assignment, round progression, evidence/final reveal, accusations, purchase gating, order fulfillment, rate limiting, support, storage validation, outbound delivery, payment checkout, and Stripe webhook handling.

## Next 20 Development Steps

1. Keep Git healthy.
   - Review the large uncommitted working tree.
   - Commit the completed platform slice when ready.
   - Keep future commits smaller and feature-scoped.

2. Run the live smoke suite after every server restart.
   - Keep `http://192.168.2.45:3001` reachable.
   - Run `TEST_BASE_URL=http://127.0.0.1:3001 npm test`.
   - Probe `/`, `/games`, `/support`, `/admin`, and one game detail route.

3. Create a dedicated test database.
   - Separate local development data from automated test data.
   - Add a documented `DATABASE_URL_TEST`.
   - Keep live-route tests able to target the dev server.

4. Configure Stripe test mode.
   - Set `PAYMENT_PROVIDER=stripe`, `APP_URL`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`.
   - Run a test checkout from game detail to Stripe.
   - Confirm webhook fulfillment grants game access.

5. Expand payment observability.
   - Add retry/reconcile tools for paid Stripe sessions that did not fulfill.
   - Add structured logs for checkout/session/webhook failures.
   - Add alerts for stuck pending orders and failed webhook events.

6. Choose and implement the email provider.
   - Pick Resend, Postmark, SendGrid, SES, or another transactional provider.
   - Add a delivery adapter for queued `OutboundMessage` email records.
   - Send invitations, purchase confirmations, support notices, and reminders.

7. Add email verification and password reset.
   - Add token tables or signed token flow.
   - Send verification/reset emails through the provider adapter.
   - Add support/admin recovery procedures.

8. Choose and implement the SMS provider.
   - Pick Twilio or another provider.
   - Add phone verification, opt-in history, STOP/START handling, and delivery adapter.
   - Keep SMS disabled for any user without explicit opt-in.

9. Build admin content editing for characters.
   - Create/edit character key, name, public bio, private bio, required/optional flag, and sort order.
   - Audit all edits.
   - Add validation for duplicate keys and required character coverage.

10. Build admin content editing for rounds and cards.
   - Create/edit round definitions and player cards.
   - Enforce visibility values and round ordering.
   - Add spoiler labels for victim/killer/final reveal content.

11. Build admin content editing for evidence and media metadata.
   - Create/edit evidence records and media metadata.
   - Validate visibility, round linkage, character linkage, and evidence type.
   - Keep binary upload separate until storage endpoints are ready.

12. Add upload endpoints and storage integration.
   - Implement local/S3-compatible storage behind the existing storage policy helpers.
   - Enforce MIME type, file size, and private/public path rules.
   - Add signed URL strategy before private media is used.

13. Build spoiler-safe host mode controls.
   - Keep default host view spoiler-safe.
   - Add explicit unlock flow for spoiler mode.
   - Audit spoiler unlock and require clear confirmation.

14. Improve invitation workflow.
   - Add invitation status, last sent time, resend count, and failed delivery details.
   - Let hosts resend failed invitations from party control.
   - Add reminder scheduling later.

15. Improve player mobile usability.
   - Test join/play/accusation/reveal on narrow mobile widths.
   - Tighten clue, evidence, media, and round panels for phone use.
   - Add accessibility pass for form labels, contrast, and focus states.

16. Add support replies and internal notes.
   - Add support-ticket message/history model.
   - Send replies through email provider.
   - Add internal-only admin notes and status history.

17. Split admin roles.
   - Add roles for support, content editor, finance, and super admin.
   - Restrict payment, support, and spoiler-heavy content views by role.
   - Audit permission changes.

18. Prepare production process and network layer.
   - Choose direct process manager versus Docker cutover.
   - Add reverse proxy, TLS, firewall, health checks, and restart policy.
   - Document the exact local Ubuntu to data-center path.

19. Automate backups and restore drills.
   - Schedule PostgreSQL backups.
   - Store backups off-box.
   - Practice restore into a separate database before production launch.

20. Keep marketplace work behind the first-party MVP.
   - Preserve creator profile, publishing approval, revenue split, payout, and review plans.
   - Do not build creator selling flows until first-party purchase, hosting, play, support, and operations are stable.
