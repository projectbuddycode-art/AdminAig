"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold"
    >
      Save PDF
    </button>
  );
}
