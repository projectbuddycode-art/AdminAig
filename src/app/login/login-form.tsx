"use client";

import { useActionState } from "react";
import { dummyLoginAction, loginAction } from "@/server/actions";
import { ErrorText, Field } from "@/components/ui";
import { PendingSubmit } from "@/components/forms";

export function LoginForm({ configurationError }: { configurationError: string | null }) {
  const [state, action] = useActionState(loginAction, null);
  const [dummyState, dummyAction] = useActionState(dummyLoginAction, null);

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
        <form action={action} className="w-full max-w-sm space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Sign in</p>
            <h2 className="mt-2 font-[family-name:var(--font-serif)] text-4xl">AIG Admin</h2>
          </div>
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required />
          <ErrorText message={state && "error" in state ? state.error : configurationError} />
          <PendingSubmit pendingLabel="Signing in…">Continue</PendingSubmit>
        </form>
        <form action={dummyAction} className="w-full max-w-sm">
          <button
            type="submit"
            className="mt-3 w-full rounded-md border border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-[var(--text)]"
          >
            Continue as administrator
          </button>
          <ErrorText message={dummyState && "error" in dummyState ? dummyState.error : null} />
          <p className="mt-2 text-center text-xs leading-5 text-[var(--muted)]">
            Dummy login with full administrator access. Customers, machines, plans, and reports stay on the real dashboard.
          </p>
        </form>
      </section>
    </div>
  );
}
