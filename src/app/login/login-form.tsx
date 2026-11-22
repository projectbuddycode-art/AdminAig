"use client";

import { useActionState } from "react";
import { dummyLoginAction, loginAction } from "@/server/actions";
import { ErrorText, Field } from "@/components/ui";
import { PendingSubmit } from "@/components/forms";

export function LoginForm({
  configurationError,
  callbackUrl = "/",
}: {
  configurationError: string | null;
  callbackUrl?: string;
}) {
  const [state, action] = useActionState(loginAction, null);
  const [demoState, demoAction] = useActionState(dummyLoginAction, null);
  const passwordError = (state && "error" in state ? state.error : null) ?? configurationError;
  const demoError = demoState && "error" in demoState ? demoState.error : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-[var(--bg-secondary)] px-16 py-14 lg:flex">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          Accredited Institute of Gemology
        </p>
        <div>
          <h1 className="max-w-md font-[family-name:var(--font-serif)] text-6xl leading-[1.05] text-[var(--text)]">
            Administration for DiamondCam.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
            Manage customers, machine identities, plans and entitlements. Local ESP32 control remains on the device
            network and is never treated as a machine identity.
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">Box inventory is identity-based. IPs are not identifiers.</p>
      </section>
      <section className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Sign in</p>
            <h2 className="mt-2 font-[family-name:var(--font-serif)] text-4xl">AIG Admin</h2>
          </div>

          <form action={demoAction} className="space-y-3">
            <PendingSubmit pendingLabel="Opening dashboard…">Open demo dashboard</PendingSubmit>
            <ErrorText message={demoError} />
            <p className="text-center text-xs leading-5 text-[var(--muted)]">
              One click for client demos. No password. Opens the real dashboard with a temporary session.
            </p>
          </form>

          <div className="relative py-1 text-center text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <span className="bg-[var(--bg)] px-2">or use password</span>
          </div>

          <form action={action} className="space-y-5">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Field label="Email" name="email" type="email" autoComplete="username" required />
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
            <ErrorText message={passwordError} />
            <button
              type="submit"
              className="w-full rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]"
            >
              Continue as Administrator
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
