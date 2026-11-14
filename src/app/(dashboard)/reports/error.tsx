"use client";

export default function ReportsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-[var(--radius)] border border-[#e7c8cc] bg-white p-6">
      <h1 className="font-[family-name:var(--font-serif)] text-2xl">Reports could not be loaded</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">The analytics query failed. Filters were not applied to an empty chart.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
