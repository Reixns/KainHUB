import { useEffect, useMemo, useState } from 'react';
import { Clock, Globe, Laptop, MapPin, MonitorSmartphone, ShieldCheck, Smartphone } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/UI';

function getDeviceIcon(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/mobile|iphone|android.*mobile|ipod/.test(ua)) return Smartphone;
  if (/ipad|tablet|android(?!.*mobile)/.test(ua)) return MonitorSmartphone;
  if (/macintosh|mac os x/.test(ua)) return Laptop;
  return Globe;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function LoginSessionsCard({ role }) {
  const { auth } = useApp();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    try {
      const storageKey = 'kainhub_login_sessions';
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) {
        const filtered = stored
          .filter((session) => {
            if (!session) return false;
            if (role && session.role && session.role !== role) return false;
            if (auth?.user?.email && session.email && session.email.toLowerCase() !== auth.user.email.toLowerCase()) return false;
            return true;
          })
          .sort((a, b) => new Date(b.signedInAt || 0) - new Date(a.signedInAt || 0));
        setSessions(filtered.slice(0, 5));
      }
    } catch {
      setSessions([]);
    }
  }, [auth?.user?.email, role]);

  const items = useMemo(() => sessions, [sessions]);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-3 border-b border-hairline bg-surface-sunken px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-hairline bg-white text-muted">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-ink">Login sessions</h2>
          <p className="mt-0.5 text-sm text-muted">Recent sign-ins on this device and browser.</p>
        </div>
      </div>
      <div className="divide-y divide-hairline">
        {items.length === 0 ? (
          <div className="p-5 text-sm text-muted">No recent login activity recorded on this device.</div>
        ) : (
          items.map((session, index) => {
            const Icon = getDeviceIcon(session.userAgent);
            const isCurrent = index === 0 && session.current;
            return (
              <div key={session.id || index} className="flex items-start gap-3 p-5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{session.device || session.platform || 'Unknown device'}</p>
                    {isCurrent && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">Current session</span>}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Signed in {formatTime(session.signedInAt)}</span>
                  </p>
                  {session.location && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{session.location}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
