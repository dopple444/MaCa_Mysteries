import Link from "next/link";

export default async function JoinPage({ searchParams }: { searchParams?: Promise<{ code?: string }> }) {
  const params = await searchParams;
  const code = params?.code;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <h1 className="text-4xl font-semibold text-white">Join a mystery party</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Enter your party code and follow the prompts to receive your character and clues.
        </p>
        <form className="mt-8 grid gap-4">
          <label className="block text-sm font-medium text-slate-200">Party code</label>
          <input
            type="text"
            name="code"
            defaultValue={code}
            placeholder="Enter party code"
            className="w-full rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-indigo-400"
          />
          <button type="submit" className="inline-flex justify-center rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">
            Join party
          </button>
        </form>
        <div className="mt-8 text-sm text-slate-400">
          <p>If you don’t have a party code yet, ask the host for an invite link.</p>
          <p className="mt-3">
            Ready to host? <Link href="/host" className="text-indigo-300 hover:text-white">Start here.</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
