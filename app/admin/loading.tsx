/**
 * Loading state for the whole admin segment.
 *
 * Every screen here renders per request (`await connection()`), so moving
 * between them leaves the content area empty until the server answers. The
 * skeleton mirrors the real layout — four counters over two panels — so the
 * page does not jump when the data lands.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <p role="status" className="sr-only">
        Loading the panel…
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="h-[122px] animate-pulse rounded-2xl bg-white ring-1 ring-ink/8"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="h-[280px] animate-pulse rounded-2xl bg-white ring-1 ring-ink/8" />
        <div className="h-[280px] animate-pulse rounded-2xl bg-white ring-1 ring-ink/8" />
      </div>
    </div>
  );
}
