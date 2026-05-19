import assert from "node:assert/strict";
import test from "node:test";

import { getStorageProvider, validateMediaUpload } from "../app/lib/storage";

test("getStorageProvider falls back to local storage until object storage is configured", () => {
  assert.equal(getStorageProvider({}), "local");
  assert.equal(
    getStorageProvider({
      OBJECT_STORAGE_ENDPOINT: "https://storage.example",
      OBJECT_STORAGE_BUCKET: "maca",
      OBJECT_STORAGE_ACCESS_KEY_ID: "key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret"
    }),
    "s3-compatible"
  );
});

test("validateMediaUpload allows media and document types within size limits", () => {
  assert.deepEqual(
    validateMediaUpload({
      fileName: "map.png",
      mimeType: "image/png",
      sizeBytes: 1024
    }),
    { allowed: true, reason: "" }
  );
  assert.deepEqual(
    validateMediaUpload({
      fileName: "brief.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024
    }),
    { allowed: true, reason: "" }
  );
});

test("validateMediaUpload blocks missing names, bad sizes, and unsupported types", () => {
  assert.equal(
    validateMediaUpload({
      fileName: "",
      mimeType: "image/png",
      sizeBytes: 1024
    }).allowed,
    false
  );
  assert.equal(
    validateMediaUpload({
      fileName: "too-large.mp4",
      mimeType: "video/mp4",
      sizeBytes: 251 * 1024 * 1024
    }).allowed,
    false
  );
  assert.equal(
    validateMediaUpload({
      fileName: "script.js",
      mimeType: "application/javascript",
      sizeBytes: 1024
    }).allowed,
    false
  );
});
