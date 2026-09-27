export default function PageLoading() {
  return <div className="page-loading page-skeleton" role="status" aria-live="polite">
    <span className="sr-only">Loading your next favourites…</span>
    <div className="skeleton-heading" aria-hidden="true" />
    <div className="skeleton-grid" aria-hidden="true">
      {[0,1,2,3].map(i => <div className="skeleton-card" key={i}><div/><span/><span/></div>)}
    </div>
  </div>;
}