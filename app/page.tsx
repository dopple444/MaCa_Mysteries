import Link from "next/link";

import { getCurrentUser } from "./lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-24 text-center">
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold sm:text-5xl">MaCa Mysteries</h1>
          <p className="max-w-2xl text-lg text-slate-300">
            A modern murder mystery party platform for hosts, guests, and immersive storytelling.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={user ? "/dashboard" : "/login"} className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">
              {user ? "Open dashboard" : "Sign in to host"}
            </Link>
            <Link href="/join" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white">
              Join a party
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
