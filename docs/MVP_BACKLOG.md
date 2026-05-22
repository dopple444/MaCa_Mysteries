# MVP Backlog

Last inspected: 2026-05-21

## Product Focus

Initial MVP should sell and run MaCa Mysteries / Burnett Games first-party murder mystery games. The creator marketplace should remain later-stage architecture until the first-party purchase, hosting, player, and spoiler-safe game loop is solid.

## Must Have

### Public Visitor

- As a public visitor, I can view a list of published first-party mystery games so I can decide what to play.
- As a public visitor, I can view a spoiler-free game detail page so I understand player count, duration, premise, and content warnings.
- As a public visitor, I can create an account or sign in so I can buy or host games.

### Customer

- As a customer, I can purchase or activate a game so I can host it.
- As a customer, I can view my purchased games so I know what I can run.
- As a customer, I can access a receipt or order history so I can confirm my purchase.

### Host

- As a host, I can create a party from a game I own so I can prepare an event.
- As a host, I can invite guests by link or email so players can join.
- As a host, I can see which guests have joined so I can manage attendance.
- As a host, I can assign characters to guests so everyone has a role.
- As a host, I can see whether required characters are assigned so I know if the game is ready.
- As a host, I can run the game in spoiler-safe mode so I do not accidentally learn the solution.
- As a host, I can intentionally unlock spoiler mode so I can troubleshoot or run a fully guided event.
- As a host, I can unlock rounds so players receive the correct content at the correct time.
- As a host, I can trigger the final reveal so the game ends cleanly.

### Player

- As a player, I can join a party through an invite code or link so I can participate.
- As a player, I can see my assigned character so I know who I am playing.
- As a player, I can see my private background and pre-game tasks so I can prepare.
- As a player, I can receive round-specific cards and clues so I know what to do.
- As a player, I can see only the content I am allowed to see so the mystery is protected.
- As a player, I can submit an accusation so I can make a final guess.
- As a player, I can view the final reveal after it unlocks so I understand the solution.

### Admin

- As an admin, I can create and edit first-party games so Burnett Games can publish original content.
- As an admin, I can version game content so live parties are not changed by future edits.
- As an admin, I can mark games and versions as draft, published, retired, or archived.
- As an admin, I can preview content as public visitor later, host-safe host, spoiler host, and assigned player so I can check access rules.
- As an admin, I can upload or attach media assets so games can include rich clues.
- As an admin, I can create and edit conditional reveal rules, digital artifacts, and character tools so advanced game mechanics can be reviewed before publishing.
- As an admin, I can run publish-readiness validation before publishing so missing required content and unsafe conditional unlock wiring are caught.

## Should Have

### Public Visitor

- As a public visitor, I can filter games by player count, duration, theme, and difficulty so I can find a good match.
- As a public visitor, I can read non-spoiler FAQs so I know how a digital party works.

### Customer

- As a customer, I can reset my password so I can recover account access.
- As a customer, I can update profile details so invite and account info stays current.
- As a customer, I can contact support from my account with order context.

### Host

- As a host, I can resend guest invites so late guests can join easily.
- As a host, I can remove or replace guests so the party can adapt to changes.
- As a host, I can auto-assign characters so setup is faster.
- As a host, I can print or export key host-safe materials for in-person backup.
- As a host, I can pause and resume a party so real-life interruptions do not break the game.
- As a host, I can see non-spoiler progress for locked evidence and collaborative unlocks so I can run the party without learning the solution.

### Player

- As a player, I can update my display name so the host knows who joined.
- As a player, I can view public party information so I know event details.
- As a player, I can review previous round cards after a new round opens.
- As a player, I can view shared evidence as it is revealed.
- As a player, I can unlock character-specific evidence only after the game rule allows it so collaborative mechanics feel fair and spoiler-safe.

### Admin

- As an admin, I can duplicate a game version so edits can start from the previous published version.
- As an admin, I can view audit logs for spoiler unlocks, publishing, and payment events.
- As an admin, I can run deeper conditional-rule QA reports for circular dependencies, spoiler wording, asset-view triggers, host-approval triggers, reveal-state triggers, and multi-player interaction rules.

## Could Have

### Public Visitor

- As a public visitor, I can preview sample non-spoiler character cards so I understand the experience.
- As a public visitor, I can join a mailing list for new game releases.

### Customer

- As a customer, I can buy gift access for another host.
- As a customer, I can leave feedback after hosting a party.

### Host

- As a host, I can schedule automatic round reminders.
- As a host, I can customize party title, date, and basic welcome message.
- As a host, I can upload optional party-specific images or notes if a game allows it.
- As a host, I can export a post-game summary.

### Player

- As a player, I can receive optional email/SMS reminders when a party starts or a round unlocks.
- As a player, I can save notes during investigation.
- As a player, I can view a personal clue notebook.
- As a player, I can use a character-specific digital tool to help another player unlock evidence.
- As a player, I can enter a party-specific code and see whether it unlocks the intended clue.

### Admin

- As an admin, I can see basic analytics for game purchases and party completion.
- As an admin, I can manage support tickets.
- As an admin, I can run content QA reports for spoiler risk and missing media.
- As an admin, I can run conditional-rule QA reports for orphan targets, impossible unlocks, and unused character tools.

## Later / Marketplace

### Future Creator

- As a creator, I can apply for a creator profile so I can submit games.
- As a creator, I can draft a game in the builder so I can build a mystery without coding.
- As a creator, I can submit a game for approval so it can be reviewed before sale.
- As a creator, I can see approval feedback so I can revise my submission.
- As a creator, I can track sales and payouts so I understand revenue.

### Admin Marketplace

- As an admin, I can approve or reject creator games so marketplace quality is controlled.
- As an admin, I can moderate reviews so abusive or spoiler content is removed.
- As an admin, I can manage creator payouts and revenue splits.
- As an admin, I can suspend creator profiles or games when necessary.

### Customer Marketplace

- As a customer, I can browse marketplace games separately from first-party games.
- As a customer, I can read reviews without seeing spoilers.
- As a customer, I can report a game or review.

## Priority Notes

Recommended first implementation order:

1. Database-backed first-party game catalog.
2. Auth hardening and account basics.
3. Game version, character, round, card, evidence model.
4. Party creation tied to game version and entitlement.
5. Guest join flow.
6. Character assignment.
7. Player-private round cards.
8. Host spoiler-safe round controls.
9. Accusation and final reveal.
10. Payment/email integration.
11. Conditional unlock/code-entry player UI.
12. Deeper publish-readiness checks for non-code conditional rule types.
13. Final reveal editor.
14. Creator marketplace only after the internal builder and conditional engine are stable.
