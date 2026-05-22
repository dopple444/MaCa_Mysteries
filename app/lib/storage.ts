import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "video/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown"
]);

type ValidateMediaUploadInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

type EnvMap = Partial<Record<string, string | undefined>>;
type UploadAccess = "public" | "private";

type StoreLocalMediaUploadInput = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  access: UploadAccess;
};

type StoreLocalMediaUploadOptions = {
  rootDir?: string;
  now?: Date;
  randomId?: string;
};

export type StoredMediaUpload =
  | {
      ok: true;
      provider: "local";
      access: UploadAccess;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      diskPath: string;
      url: string;
    }
  | {
      ok: false;
      reason: string;
    };

export function getStorageProvider(env: EnvMap = process.env) {
  if (
    env.OBJECT_STORAGE_ENDPOINT?.trim() &&
    env.OBJECT_STORAGE_BUCKET?.trim() &&
    env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() &&
    env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim()
  ) {
    return "s3-compatible";
  }

  return "local";
}

export function validateMediaUpload(input: ValidateMediaUploadInput) {
  const fileName = input.fileName.trim();
  const mimeType = input.mimeType.trim().toLowerCase();

  if (!fileName) {
    return { allowed: false, reason: "File name is required." };
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_UPLOAD_BYTES) {
    return { allowed: false, reason: "File size is outside the allowed range." };
  }

  const allowedMime =
    ALLOWED_MIME_TYPES.has(mimeType) ||
    ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));

  if (!allowedMime) {
    return { allowed: false, reason: "File type is not allowed." };
  }

  return { allowed: true, reason: "" };
}

function getSafeFileName(fileName: string) {
  const parsed = path.parse(fileName.trim());
  const safeBase = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const safeExtension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 16);
  return `${safeBase || "upload"}${safeExtension}`;
}

function getUploadDateParts(now: Date) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return { year, month };
}

export async function storeLocalMediaUpload(
  input: StoreLocalMediaUploadInput,
  options: StoreLocalMediaUploadOptions = {}
): Promise<StoredMediaUpload> {
  const validation = validateMediaUpload({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength
  });

  if (!validation.allowed) {
    return { ok: false, reason: validation.reason };
  }

  const rootDir = options.rootDir ?? process.cwd();
  const now = options.now ?? new Date();
  const randomId = options.randomId ?? crypto.randomBytes(8).toString("hex");
  const { year, month } = getUploadDateParts(now);
  const safeFileName = `${randomId}-${getSafeFileName(input.fileName)}`;

  const relativeKey =
    input.access === "public"
      ? path.posix.join("uploads", "media", year, month, safeFileName)
      : path.posix.join("private", "media", year, month, safeFileName);
  const diskPath =
    input.access === "public"
      ? path.join(rootDir, "public", "uploads", "media", year, month, safeFileName)
      : path.join(rootDir, "storage", "private", "media", year, month, safeFileName);

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, input.bytes, { flag: "wx" });

  return {
    ok: true,
    provider: "local",
    access: input.access,
    fileName: safeFileName,
    mimeType: input.mimeType.trim().toLowerCase(),
    sizeBytes: input.bytes.byteLength,
    storageKey: relativeKey,
    diskPath,
    url: input.access === "public" ? `/${relativeKey}` : ""
  };
}
