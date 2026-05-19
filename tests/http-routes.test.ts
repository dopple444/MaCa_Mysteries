import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.TEST_BASE_URL;

test("http route checks", { skip: baseUrl ? false : "Set TEST_BASE_URL to check the running app." }, async () => {
  assert.ok(baseUrl);

  const healthResponse = await fetch(`${baseUrl}/api/health`, { redirect: "manual" });
  assert.equal(healthResponse.status, 200);

  const gamesResponse = await fetch(`${baseUrl}/games`, { redirect: "manual" });
  assert.equal(gamesResponse.status, 200);

  const gameDetailResponse = await fetch(`${baseUrl}/games/the-last-curtain`, { redirect: "manual" });
  assert.equal(gameDetailResponse.status, 200);

  const missingGameResponse = await fetch(`${baseUrl}/games/not-real`, { redirect: "manual" });
  assert.equal(missingGameResponse.status, 404);

  const dashboardResponse = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  assert.ok([307, 308].includes(dashboardResponse.status));
  assert.equal(dashboardResponse.headers.get("location"), "/login");

  const adminResponse = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  assert.ok([307, 308].includes(adminResponse.status));
  assert.equal(adminResponse.headers.get("location"), "/login");
});
