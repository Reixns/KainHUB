import { useLocation } from 'react-router-dom';

function SkeletonBlock({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse motion-reduce:animate-none rounded-xl bg-white/10 ${className}`} />;
}

export default function SessionSkeleton({ role: requestedRole }) {
  const { pathname } = useLocation();
  const routeRole = pathname.split('/')[1];
  const role = requestedRole || (['customer', 'vendor', 'admin'].includes(routeRole) ? routeRole : null);
  const isCustomer = role === 'customer';

  return (
    <div
      className={`min-h-screen ${isCustomer ? 'customer-portal-theme' : 'staff-portal-theme'} bg-[#101014] text-white`}
      role="status"
      aria-label="Loading your session"
    >
      <span className="sr-only">Loading your session…</span>
      {isCustomer ? (
        <header className="flex h-16 items-center gap-5 border-b border-white/10 px-5">
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <SkeletonBlock className="hidden h-8 w-28 sm:block" />
          <SkeletonBlock className="hidden h-8 w-20 sm:block" />
          <SkeletonBlock className="hidden h-8 w-24 sm:block" />
          <SkeletonBlock className="ml-auto h-10 w-10 rounded-full" />
        </header>
      ) : (
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/10 bg-white/[0.03] p-5 lg:flex">
          <SkeletonBlock className="mb-8 h-12 w-12 rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 8 }, (_, index) => (
              <SkeletonBlock key={index} className="h-10 w-full" />
            ))}
          </div>
        </aside>
      )}

      <main className={isCustomer ? 'mx-auto max-w-7xl px-5 py-8' : 'px-5 py-8 lg:ml-64 lg:px-8'}>
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="w-full max-w-sm space-y-3">
            <SkeletonBlock className="h-8 w-2/3" />
            <SkeletonBlock className="h-4 w-full max-w-xs" />
          </div>
          {!isCustomer && <SkeletonBlock className="h-10 w-28" />}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <SkeletonBlock className="mb-4 h-4 w-2/3" />
              <SkeletonBlock className="h-8 w-1/2" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <SkeletonBlock className="mb-5 h-6 w-1/3" />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 border-t border-white/5 py-3">
                <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-4 w-2/3" />
                  <SkeletonBlock className="h-3 w-full max-w-sm" />
                </div>
                <SkeletonBlock className="h-8 w-16" />
              </div>
            ))}
          </div>
          <div className="hidden space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:block">
            <SkeletonBlock className="mb-5 h-6 w-2/3" />
            <SkeletonBlock className="h-28 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>
        </div>
      </main>
    </div>
  );
}
