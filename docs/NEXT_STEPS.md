# Next Steps

Last inspected: 2026-05-18

These are the exact next 10 development steps after the current stabilization, database-backed catalog work, party-to-game linkage, and basic guest join flow.

1. Keep Git healthy.
   - Continue committing each completed slice.
   - Push to `dopple444/MaCa_Mysteries`.
   - Avoid large unreviewed rewrites while the gameplay model is still evolving.

2. Re-test the database-backed catalog in the browser.
   - Visit `/games`, `/games/the-last-curtain`, `/games/murder-at-hollow-lake`, and `/api/games`.
   - Confirm both valid games render and an invalid slug still returns 404.

3. Re-test party creation against database-backed games.
   - Sign in.
   - Start a party from `/games/the-last-curtain`.
   - Confirm the selected game loads from the database and party creation still redirects to `/host/party/[partyId]`.

4. Re-test party-to-game linkage.
   - Confirm newly created parties store `gameId` and `gameVersionId`.
   - Confirm existing test parties still load.
   - Confirm the party page shows game title and version.

5. Re-test the guest join backend flow.
   - Open `/join?code=INVITECODE`.
   - Join with an invited guest email and confirm status changes to `JOINED`.
   - Join with a new email and confirm a guest is created.
   - Confirm `/play` shows the player lobby.

6. Tighten guest access rules.
   - Decide whether unmatched emails should auto-join, require host approval, or be blocked.
   - Add a host-visible distinction between invited, joined, and uninvited-code-joined guests.
   - Add tests around guest cookie access.

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
