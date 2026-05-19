import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../lib/auth";
import { getCsrfToken } from "../../../lib/csrf";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

function formatActivityTime(date: Date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AdminSupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  const csrfToken = await getCsrfToken();

  const { ticketId } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });

  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16 text-slate-100">
      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-black/20">
        <Link href="/admin" className="text-sm font-semibold text-indigo-300 hover:text-white">
          Back to admin
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Support ticket</p>
            <h1 className="mt-4 text-4xl font-semibold text-white">{ticket.subject}</h1>
            <p className="mt-2 text-slate-400">{ticket.user?.name ?? ticket.email}</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            {ticket.status}
          </span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Email</p>
            <p className="mt-2 break-words font-semibold text-white">{ticket.email}</p>
          </div>
          <div className="rounded-2xl bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Created</p>
            <p className="mt-2 font-semibold text-white">{formatActivityTime(ticket.createdAt)}</p>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <h2 className="text-2xl font-semibold text-white">Message</h2>
          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-300">{ticket.message}</p>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-950/80 p-6">
          <h2 className="text-2xl font-semibold text-white">Status</h2>
          <form action={`/admin/support/${ticket.id}/status`} method="post" className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            {["OPEN", "PENDING", "CLOSED"].map((status) => (
              <button
                key={status}
                name="status"
                value={status}
                disabled={ticket.status === status}
                className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
              >
                {status}
              </button>
            ))}
          </form>
        </section>
      </div>
    </div>
  );
}
