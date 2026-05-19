import assert from "node:assert/strict";
import test from "node:test";

import { parseGuestInvites } from "../app/lib/guest-invites";

test("parseGuestInvites supports named invite rows", () => {
  assert.deepEqual(parseGuestInvites("Alice Example, ALICE@EXAMPLE.COM\nbob@example.com"), [
    { name: "Alice Example", email: "alice@example.com" },
    { name: "bob@example.com", email: "bob@example.com" }
  ]);
});

test("parseGuestInvites supports comma-separated email-only lists", () => {
  assert.deepEqual(parseGuestInvites("one@example.com, two@example.com"), [
    { name: "one@example.com", email: "one@example.com" },
    { name: "two@example.com", email: "two@example.com" }
  ]);
});

test("parseGuestInvites ignores blank and non-email fragments", () => {
  assert.deepEqual(parseGuestInvites("not-an-email\n, three@example.com\n\n"), [
    { name: "three@example.com", email: "three@example.com" }
  ]);
});
