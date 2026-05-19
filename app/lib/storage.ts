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
