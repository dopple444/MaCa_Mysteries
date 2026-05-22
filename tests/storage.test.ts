import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getStorageProvider, storeLocalMediaUpload, validateMediaUpload } from "../app/lib/storage";

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

test("storeLocalMediaUpload writes public uploads under the public media path", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "maca-upload-public-"));

  try {
    const result = await storeLocalMediaUpload(
      {
        fileName: "../Crime Scene Photo.PNG",
        mimeType: "IMAGE/PNG",
        bytes: Buffer.from("public upload"),
        access: "public"
      },
      {
        rootDir,
        now: new Date("2026-05-21T00:00:00Z"),
        randomId: "abc123"
      }
    );

    assert.equal(result.ok, true);
    if (!result.ok) assert.fail("Expected public upload storage to succeed.");
    assert.equal(result.url, "/uploads/media/2026/05/abc123-crime-scene-photo.png");
    assert.equal(result.storageKey, "uploads/media/2026/05/abc123-crime-scene-photo.png");
    assert.equal(
      await readFile(path.join(rootDir, "public", "uploads", "media", "2026", "05", "abc123-crime-scene-photo.png"), "utf8"),
      "public upload"
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("storeLocalMediaUpload keeps private uploads outside the public path", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "maca-upload-private-"));

  try {
    const result = await storeLocalMediaUpload(
      {
        fileName: "Secret Note.txt",
        mimeType: "text/plain",
        bytes: Buffer.from("private upload"),
        access: "private"
      },
      {
        rootDir,
        now: new Date("2026-05-21T00:00:00Z"),
        randomId: "private123"
      }
    );

    assert.equal(result.ok, true);
    if (!result.ok) assert.fail("Expected private upload storage to succeed.");
    assert.equal(result.url, "");
    assert.equal(result.storageKey, "private/media/2026/05/private123-secret-note.txt");
    assert.equal(
      await readFile(path.join(rootDir, "storage", "private", "media", "2026", "05", "private123-secret-note.txt"), "utf8"),
      "private upload"
    );
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
