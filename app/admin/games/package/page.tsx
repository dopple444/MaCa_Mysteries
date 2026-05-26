import Link from "next/link";
import { notFound } from "next/navigation";

import { hasAdminPermission } from "../../../lib/admin-permissions";
import { requireUser } from "../../../lib/auth";
import { getCsrfToken } from "../../../lib/csrf";
import { GAME_PACKAGE_SCHEMA_VERSION } from "../../../lib/game-package";
import { GamePackageValidator } from "./GamePackageValidator";

export const dynamic = "force-dynamic";

export default async function AdminGamePackagePage() {
  const user = await requireUser();
  if (!hasAdminPermission(user, "content")) notFound();
  const csrfToken = await getCsrfToken();

  return (
    <div className="mx-auto max-w-5xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <div className="mt-6">
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Admin content</p>
          <h1 className="mt-4 text-4xl font-semibold text-white">Validate Game Package</h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Dry-run a first-party or AI-assisted package before any draft game records are created.
          </p>
        </div>

        <GamePackageValidator csrfToken={csrfToken} schemaVersion={GAME_PACKAGE_SCHEMA_VERSION} />
      </div>
    </div>
  );
}
