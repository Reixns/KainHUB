import { Outlet, Link } from 'react-router-dom';
;

export default function AuthLayout() {
  return (
    <div className="auth-page-shell">
      <Outlet />
    </div>
  );
}

// Auth shell component for each portal's auth pages
export function AuthShell({ title, subtitle, portalColor, portalLabel, children }) {
  return (
    <div className="w-full max-w-md px-1">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-body hover:text-ink mb-6 font-medium">
        ← Back to portals
      </Link>
      <div className="auth-card p-6 sm:p-8">
        <div className={`inline-flex items-center gap-2 ${portalColor} text-white px-3 py-1.5 rounded-full text-xs font-semibold mb-4 shadow-sm`}>
          {portalLabel}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink mb-1">{title}</h1>
        <p className="text-sm text-muted mb-6">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
