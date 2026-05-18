# Next Steps

Last inspected: 2026-05-18

These are the exact next 10 development steps after the current stabilization and database-backed catalog work.

1. Fix repository state.
   - Confirm whether `/home/dopple444/projects/MaCa_Mysteries` is supposed to be the active repo.
   - The local `.git` directory is still not usable, so restore a real Git clone or reconnect this workspace to `https://github.com/dopple444/MadMack_Mysteries`.
   - Do this before larger gameplay work so changes can be reviewed and rolled back.

2. Re-test the database-backed catalog in the browser.
   - Visit `/games`, `/games/the-last-curtain`, `/games/murder-at-hollow-lake`, and `/api/games`.
   - Confirm both valid games render and an invalid slug still returns 404.

3. Re-test party creation against database-backed games.
   - Sign in.
   - Start a party from `/games/the-last-curtain`.
   - Confirm the selected game loads from the database and party creation still redirects to `/host/party/[partyId]`.

4. Add party-to-game linkage.
   - Add nullable `gameId` and `gameVersionId` fields to `Party` while keeping `gameSlug` for compatibility.
   - Update party creation to store the published game/version IDs.
   - Backfill existing test parties by matching `gameSlug`.

5. Build the guest join backend flow.
   - Look up parties by invite code.
   - Let guests enter name/email and attach to an existing invite where possible.
   - Track joined status.
   - Keep this separate from character assignment.

6. Add player session or guest-token access.
   - Decide whether guests use accountless magic links, lightweight guest sessions, or full user accounts.
   - Ensure guests can only see their own party/player data.

7. Draft character and assignment models.
   - Add `GameCharacter`, required/optional flags, and `PartyCharacterAssignment`.
   - Keep victim/killer spoiler fields protected for later reveal rules.

8. Build host character assignment screen.
   - Show guests and available characters.
   - Enforce required character coverage.
   - Allow optional characters only when enough guests exist.

9. Draft round and player-card models.
   - Add `GameRound`, `GameCard`, and initial party round state.
   - Model public, host-safe, spoiler-protected, and player-private content boundaries.

10. Add basic automated tests.
   - Cover auth redirects.
   - Cover party ownership checks.
   - Cover catalog 200/404 behavior.
   - Cover guest invite parsing with both `Name, email` and email-only formats.

