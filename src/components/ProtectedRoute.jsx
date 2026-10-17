import { Link, Navigate, useLocation } from 'react-router-dom';
import { useApp } from '@/context/AppContext';

export default function ProtectedRoute({ children, role }) {
  const { auth, authError, authReady } = useApp();
  const location = useLocation();

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted">Loading session...</div>;
  }

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-sunken">
        <div className="max-w-md rounded-xl border border-danger/30 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-ink">Account setup required</h1>
          <p className="mt-2 text-sm text-danger">{authError}</p>
          <Link to={`/${role}/login`} className="mt-4 inline-block text-sm font-medium text-brand-strong hover:underline">Return to login</Link>
        </div>
      </div>
    );
  }

  if (!auth.user || auth.role !== role) {
    // Determine login path
    const loginPath = `/${role}/login`;
    // Keep the query string: /customer/messages?chatId=...&vendorId=... is how
    // a conversation is addressed, and dropping it sent the user back to an
    // empty messages list instead of the thread they asked for.
    return <Navigate to={loginPath} state={{ from: location.pathname + location.search }} replace />;
  }
  return children;
}
