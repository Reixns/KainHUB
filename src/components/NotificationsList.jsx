import { Bell, Check, Megaphone, ShoppingBag, Tag, Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState, Button, timeAgo } from '@/components/UI';
import { isNotificationExpired, ORDER_NOTIFICATION_TTL_MS } from '@/context/persistence';

const COUNTDOWN_TICK_MS = 60 * 1000;

/*
  A shared "now" that advances on its own.

  The countdown and the expiry filter both read the clock, but this component
  only renders when React decides to render it. With nothing else changing, a
  row arrived at 10:00 rendered "1h left" at 10:00 and then sat there showing the
  same string until something unrelated caused a re-render -- so the timer on an
  expiring notification was a label, not a countdown. Reading `Date.now()`
  directly during render cannot fix that; only a re-render can.

  The tick is deliberately coarse. What is on screen is minute-precision anyway
  (`Math.ceil(ms / 60000)`), and the 20-second sweep in AppContext owns the
  actual removal -- this only has to keep the number next to it honest.

  Gated on `active` so a screen with no TTL rows schedules no interval at all,
  and `setNow` on entry so a notification arriving while the list was idle shows
  real remaining time instead of a stale capture from mount.
*/
function useMinuteNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const CUSTOMER_STYLES = {
  icon: {
    order: { Icon: ShoppingBag, wrap: 'bg-cat-blue/10 text-brand-strong' },
    promo: { Icon: Tag, wrap: 'bg-brand-muted text-brand-strong' },
    default: { Icon: Megaphone, wrap: 'bg-cat-violet-soft text-cat-violet-deep' },
  },
  unreadClass: 'border-l-4 border-l-brand bg-brand-soft/30',
  unreadDot: 'bg-brand',
};

const VENDOR_STYLES = {
  icon: {
    order: { Icon: ShoppingBag, wrap: 'bg-cat-blue/10 text-brand-strong' },
    promo: { Icon: Tag, wrap: 'bg-brand-muted text-brand-strong' },
    alert: { Icon: Shield, wrap: 'bg-success-soft text-success' },
    default: { Icon: Shield, wrap: 'bg-success-soft text-success' },
  },
  unreadClass: 'border-l-4 border-l-emerald-500 bg-success-soft/30',
  unreadDot: 'bg-success',
};

export function NotificationsList({ styles, emptyDescription = "You're all caught up!" }) {
  const { auth, notifications, markNotifRead, markAllNotifRead, dismissNotification } = useApp();
  const mine = notifications.filter((n) => (
    String(n.userId) === String(auth.user.id)
    || (auth.user.ownerId && String(n.userId) === String(auth.user.ownerId))
  ) && n.type !== 'chat');
  const now = useMinuteNow(mine.some((n) => n.expiresAt));

  /*
    Expiry is filtered here as well as in the sweep that clears state, because the
    two answer different questions. The sweep keeps `notifications` itself clean
    so the header badge and every other consumer agree; this stops a row being
    visible in the window between its TTL passing and the next tick, and covers a
    row that arrived from Supabase after the last sweep.

    Rendered without touching state on purpose: filtering during render would
    mean a setState in render, and `NotificationsList` is rendered inside the
    header's badge count on the same tick that the remote refresh can land.
  */
  const myNotifs = mine
    .filter((n) => !isNotificationExpired(n, now))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = myNotifs.filter((n) => !n.read);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Notifications</h1>
          <p className="text-sm text-muted mt-0.5">
            {unread.length > 0 ? `${unread.length} unread` : "You're all caught up!"}
          </p>
        </div>
        {unread.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAllNotifRead(auth.user.id)}>
            <Check className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      {myNotifs.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description={emptyDescription} />
      ) : (
        <div className="space-y-2">
          {myNotifs.map((n) => {
            const { Icon, wrap } = styles.icon[n.type] || styles.icon.default;
            /*
              `now` comes from the shared ticker rather than `Date.now()` so the
              countdown advances on its own, and so every row in this pass
              measures against one consistent instant instead of each row
              sampling the clock at a slightly different moment.
            */
            const remainingMs = n.expiresAt ? Date.parse(n.expiresAt) - now : null;
            const minutesLeft = remainingMs != null && !Number.isNaN(remainingMs)
              ? Math.max(0, Math.ceil(remainingMs / 60000))
              : null;
            return (
              <Card
                key={n.id}
                className={`p-4 ${!n.read ? styles.unreadClass : ''}`}
                onClick={() => markNotifRead(n.id)}
              >
                <div className="flex gap-3">
                  <div className={`flex w-10 h-10 shrink-0 items-center justify-center rounded-full ${wrap}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-ink">{n.title}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && (
                          <>
                            <span className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${styles.unreadDot}`} aria-hidden="true" />
                            <span className="sr-only">Unread</span>
                          </>
                        )}
                        {/*
                          Dismiss. Stops propagation so dismissing a row does not
                          also mark it read first -- the row is going away, so the
                          read state is irrelevant and writing it would only churn
                          state on the way out.
                        */}
                        <button
                          type="button"
                          aria-label={`Dismiss notification: ${n.title}`}
                          title="Dismiss"
                          onClick={(event) => {
                            event.stopPropagation();
                            dismissNotification(n.id);
                          }}
                          className="-m-1.5 p-1.5 rounded-control text-subtle hover:text-ink hover:bg-surface-sunken transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-body">{n.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {timeAgo(n.createdAt)}
                      {/*
                        Only shown while the row is TTL-bound, so a promo with no
                        expiry never claims to be disappearing. Rounded up so a row
                        with 40 seconds left reads "1h left" rather than "0m left",
                        which would look already-expired.
                      */}
                      {minutesLeft != null && (
                        <>
                          <span aria-hidden="true"> &middot; </span>
                          <span title={`Auto-dismisses ${formatDuration(ORDER_NOTIFICATION_TTL_MS)} after it arrives`}>
                            {formatDuration(minutesLeft * 60000)} left
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const customerNotificationStyles = CUSTOMER_STYLES;
export const vendorNotificationStyles = VENDOR_STYLES;

/*
  Compact duration for the countdown, and for the tooltip that explains the TTL.

  Ceiling-minutes at the call site keeps "0m left" off the screen, so this only
  has to handle an hour or more -- but the hour boundary is handled rather than
  assumed, since a row created by an older build with a different TTL would land
  here with a value this has never seen.
*/
function formatDuration(ms) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
}
