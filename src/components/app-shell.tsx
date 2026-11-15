"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/server/actions";
import { asFormAction } from "@/lib/form-action";
import { Icons } from "@/components/icons";

const NAV = [
  { href: "/", label: "Command center", icon: Icons.dashboard },
  { href: "/customers", label: "Customers", icon: Icons.customers },
  { href: "/machines", label: "Machines", icon: Icons.machines },
  { href: "/usage", label: "Usage", icon: Icons.activity },
  { href: "/plans", label: "Plans", icon: Icons.plans },
  { href: "/subscriptions", label: "Subscriptions", icon: Icons.subscriptions },
  { href: "/notifications", label: "Notifications", icon: Icons.subscriptions },
  { href: "/activity", label: "Audit log", icon: Icons.activity },
  { href: "/logins", label: "Login history", icon: Icons.customers },
  { href: "/reports", label: "Reports", icon: Icons.plans },
  { href: "/integrations", label: "Integrations", icon: Icons.settings },
  { href: "/settings", label: "Settings", icon: Icons.settings },
];

export function AppShell({
  children,
  adminName,
  adminEmail,
  role,
  tenant,
}: {
  children: React.ReactNode;
  adminName: string;
  adminEmail: string;
  role: string;
  tenant: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh max-w-[100vw] overflow-hidden bg-[var(--bg)]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[13.5rem] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)] transition-transform duration-200 lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-5 pb-2 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">AIG</p>
          <p className="mt-1 font-[family-name:var(--font-serif)] text-xl leading-none">Command center</p>
          {tenant === "demo" ? (
            <p className="mt-2 rounded-md bg-[#f6e7c8] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6a4b12]">
              Demo environment
            </p>
          ) : null}
          {adminEmail === "temporary@localhost" ? (
            <p className="mt-2 rounded-md bg-[#f6e7c8] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#6a4b12]">
              Temporary login
            </p>
          ) : null}
        </div>
        <nav className="mt-6 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Primary">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--accent)] ${active ? "bg-[var(--accent-light)] font-semibold text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
              >
                <Icon />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] px-4 py-4">
          <p className="truncate text-sm font-medium">{adminName}</p>
          <p className="truncate text-xs text-[var(--muted)]">{adminEmail}</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-[var(--muted)]">{role.replaceAll("_", " ")}</p>
          <form action={asFormAction(logoutAction)} className="mt-2">
            <button type="submit" className="text-sm font-medium text-[var(--accent)] hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {open ? (
        <button
          className="fixed inset-0 z-30 bg-[rgba(31,28,23,0.28)] lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {tenant === "demo" ? (
          <div className="shrink-0 border-b border-[#e4c98a] bg-[#f6e7c8] px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6a4b12]">
            Demo environment
          </div>
        ) : null}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--bg)] px-4 lg:justify-end lg:px-6">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Icons.menu />
            Menu
          </button>
          <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--accent)] lg:hidden">AIG Admin</span>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium">{adminName}</p>
              <p className="truncate text-xs text-[var(--muted)]">{adminEmail}</p>
            </div>
            <Link
              href="/settings"
              className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--bg-secondary)]"
            >
              Settings
            </Link>
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px] min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
