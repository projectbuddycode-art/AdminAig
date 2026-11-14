export default function ReportsLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-64 rounded-md bg-[var(--bg-secondary)]" />
      <div className="h-20 rounded-[var(--radius)] bg-[var(--bg-secondary)]" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-[var(--radius)] bg-[var(--bg-secondary)]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-64 rounded-[var(--radius)] bg-[var(--bg-secondary)]" />
        <div className="h-64 rounded-[var(--radius)] bg-[var(--bg-secondary)]" />
      </div>
    </div>
  );
}
