import Link from "next/link";

const features = [
  { title: "Create a party", description: "Start a new murder mystery session and invite guests." },
  { title: "Assign characters", description: "Match players to roles and manage required/optional cast." },
  { title: "Lock spoilers", description: "Keep plot secrets hidden until the right round." }
];

export default function HostPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 text-slate-100">
      <div className="mb-12 space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Host experience</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">Run your murder mystery party</h1>
        <p className="mx-auto max-w-2xl text-base leading-8 text-slate-300">
          Build a party, invite guests, assign roles, and unlock rounds in spoiler-safe mode. Start with a first-party game and adapt it for your event.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/games" className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400">
            Browse games
          </Link>
          <Link href="/join" className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:border-white">
            Join a party
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((item) => (
          <section key={item.title} className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-xl shadow-indigo-500/5">
            <h2 className="text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{item.description}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
