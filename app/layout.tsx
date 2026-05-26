import type { Metadata } from "next";
import Link from "next/link";
import { isOperationalAdminRole } from "./lib/admin-permissions";
import { getCurrentUser } from "./lib/auth";
import { logout } from "./lib/auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "MaCa Mysteries",
  description: "Burnett Games murder mystery party platform"
};

const nav = [
  { href: "/", label: "Home" },
  { href: "/host", label: "Host" },
  { href: "/join", label: "Join" },
  { href: "/games", label: "Games" }
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="bg-slate-950 text-white">
        <header className="border-b border-white/10 bg-slate-950/95 px-6 py-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-lg font-semibold text-white">MaCa Mysteries</Link>
            <div className="flex flex-wrap items-center gap-3">
              <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                {nav.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-full px-3 py-2 transition hover:bg-white/10 hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </nav>

              {user ? (
                <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-sm text-slate-300 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                  <span className="text-slate-400">Signed in as {user.name.split(" ")[0]}</span>
                  <Link href="/dashboard" className="rounded-full bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400">
                    Dashboard
                  </Link>
                  {isOperationalAdminRole(user.role) && (
                    <Link href="/admin" className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white transition hover:border-white">
                      Admin
                    </Link>
                  )}
                  <form action={logout}>
                    <button className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white transition hover:border-white">
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-sm sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                  <Link href="/login" className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white transition hover:border-white">
                    Sign in
                  </Link>
                  <Link href="/signup" className="rounded-full bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400">
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
