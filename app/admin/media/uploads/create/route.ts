import { NextResponse } from "next/server";

import { logAuditEvent } from "../../../../lib/audit-log";
import { getCurrentUser } from "../../../../lib/auth";
import { verifyCsrfToken } from "../../../../lib/csrf";
import { getStorageProvider, storeLocalMediaUpload, validateMediaUpload } from "../../../../lib/storage";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectToUploads(request: Request, params: Record<string, string> = {}) {
  const url = new URL("/admin/media/uploads", request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const formData = await request.formData();
  if (!(await verifyCsrfToken(formData))) {
    return redirectToUploads(request, { error: "invalid-file" });
  }

  if (getStorageProvider() !== "local") {
    return redirectToUploads(request, { error: "storage-provider" });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return redirectToUploads(request, { error: "invalid-file" });
  }

  const mimeType = file.type || "application/octet-stream";
  const validation = validateMediaUpload({
    fileName: file.name,
    mimeType,
    sizeBytes: file.size
  });
  if (!validation.allowed) {
    return redirectToUploads(request, { error: "invalid-file" });
  }

  const access = getFormValue(formData, "access") === "private" ? "private" : "public";
  const storedUpload = await storeLocalMediaUpload({
    fileName: file.name,
    mimeType,
    bytes: Buffer.from(await file.arrayBuffer()),
    access
  });

  if (!storedUpload.ok) {
    return redirectToUploads(request, { error: "write-failed" });
  }

  await logAuditEvent({
    action: "admin.mediaUpload.created",
    userId: user.id,
    entityType: "MediaUpload",
    entityId: storedUpload.storageKey,
    metadata: {
      provider: storedUpload.provider,
      access: storedUpload.access,
      fileName: storedUpload.fileName,
      mimeType: storedUpload.mimeType,
      sizeBytes: storedUpload.sizeBytes,
      url: storedUpload.url || null
    }
  });

  return redirectToUploads(request, {
    uploaded: "1",
    access: storedUpload.access,
    storageKey: storedUpload.storageKey,
    url: storedUpload.url
  });
}
