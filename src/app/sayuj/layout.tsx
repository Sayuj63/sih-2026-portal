import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-guard";
import { AdminLogoutButton } from "./AdminLogoutButton";

export default async function AdminLayout({ children }: LayoutProps<"/sayuj">) {
  // /admin/login is a public shell page — but this layout only wraps /admin/*.
  // Next.js will apply this layout to /admin/login too, so let the login page pass through when unauthenticated.
  const admin = await requireAdmin();

  return (
    <AppShell
      kind="admin"
      actions={
        admin ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium">{admin.fullName}</div>
              <div className="text-xs text-slate-500">{admin.username} · {admin.role}</div>
            </div>
            <AdminLogoutButton />
          </div>
        ) : (
          <Link href="/sayuj/login" className="text-slate-700">Sign in</Link>
        )
      }
    >
      {admin && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl flex gap-1 overflow-x-auto px-4">
            <NavLink href="/sayuj">Overview</NavLink>
            <NavLink href="/sayuj/teams">Teams</NavLink>
            <NavLink href="/sayuj/students">Students</NavLink>
            <NavLink href="/sayuj/ps">Problem statements</NavLink>
            <NavLink href="/sayuj/audit">Audit</NavLink>
            <NavLink href="/sayuj/settings">Settings</NavLink>
          </div>
        </div>
      )}
      {children}
    </AppShell>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-2 text-sm text-slate-700 hover:text-indigo-600 border-b-2 border-transparent hover:border-indigo-500">{children}</Link>
  );
}

