import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../lib/auth";
import { getCsrfToken } from "../../../lib/csrf";

export const dynamic = "force-dynamic";

function getUploadMessage(error?: string) {
  switch (error) {
    case "invalid-file":
      return "Please choose a valid image, audio, video, PDF, text, or markdown file under the upload size limit.";
    case "storage-provider":
      return "Local uploads are available now; S3-compatible upload writes still need the production adapter.";
    case "write-failed":
      return "The upload could not be written. Try again or check server file permissions.";
    default:
      return "";
  }
}

export default async function AdminMediaUploadsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; uploaded?: string; url?: string; storageKey?: string; access?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const csrfToken = await getCsrfToken();
  const query = await searchParams;
  const errorMessage = getUploadMessage(query?.error);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <div className="mt-6">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Admin media uploads</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Upload media</h1>
        </div>

        {errorMessage && (
          <p className="mt-6 rounded-2xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
            {errorMessage}
          </p>
        )}
        {query?.uploaded === "1" && (
          <div className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <p className="font-semibold">Upload complete</p>
            {query.url && <p className="mt-2 break-all">{query.url}</p>}
            {!query.url && query.storageKey && <p className="mt-2 break-all">{query.storageKey}</p>}
          </div>
        )}

        <form action="/admin/media/uploads/create" method="post" encType="multipart/form-data" className="mt-8 grid gap-5">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <label className="block text-sm font-medium text-slate-200">
            File
            <input
              name="file"
              type="file"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none file:mr-4 file:rounded-full file:border-0 file:bg-indigo-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-400 focus:border-indigo-400"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Access
            <select
              name="access"
              defaultValue="public"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-indigo-400"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <button className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400">
            Upload
          </button>
        </form>
      </div>
    </div>
  );
}
