import assert from "node:assert/strict";
import test from "node:test";

import { createAppUrl, getAppBaseUrl } from "../app/lib/app-url";

test("getAppBaseUrl prefers APP_URL and removes a trailing slash", () => {
  assert.equal(
    getAppBaseUrl("http://0.0.0.0:3001/checkout/start", {
      APP_URL: "http://192.168.2.45:3001/"
    }),
    "http://192.168.2.45:3001"
  );
});

test("getAppBaseUrl does not expose 0.0.0.0 as a browser URL", () => {
  assert.equal(getAppBaseUrl("http://0.0.0.0:3001/checkout/start", {}), "http://localhost:3000");
});

test("createAppUrl builds browser-safe absolute URLs", () => {
  assert.equal(
    createAppUrl("/host/create?game=murder-at-hollow-lake", "http://0.0.0.0:3001/checkout/start", {
      APP_URL: "http://192.168.2.45:3001"
    }).toString(),
    "http://192.168.2.45:3001/host/create?game=murder-at-hollow-lake"
  );
});
