import Link from "next/link";
import { ReactNode } from "react";

export function AppShell({
  kind,
  actions,
  children,
}: {
  kind: "student" | "admin" | "public";
  actions?: ReactNode;
  children: ReactNode;
}) {
  const homeHref = kind === "admin" ? "/admin" : "/";
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={homeHref} className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600 text-white font-black tracking-tight">SIH</span>
            <span className="text-sm sm:text-base font-semibold">
              SIH 2026 <span className="hidden sm:inline text-slate-400 font-normal">— Internal Registration</span>
              {kind === "admin" && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wide">Admin</span>}
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">{actions}</div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500 flex flex-wrap gap-3 justify-between">
          <span>© {new Date().getFullYear()} ISU Internal Hackathon Portal</span>
          <span>
            <a href="https://www.sih.gov.in/" target="_blank" rel="noopener" className="underline hover:text-indigo-600">Official SIH 2026 Website</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
