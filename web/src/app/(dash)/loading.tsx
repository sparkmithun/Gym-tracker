/** Skeleton shown instantly while a page's data loads. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-surface" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => <div key={i} className="h-72 rounded-2xl bg-surface" />)}
      </div>
    </div>
  );
}
