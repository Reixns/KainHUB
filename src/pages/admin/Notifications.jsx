import { useApp } from '@/context/AppContext';
import { Button, Card, EmptyState, isAdminNotification } from '@/components/UI';

export default function AdminNotifications() {
  const { auth, notifications, markNotifRead, markAllNotifRead } = useApp();
  const accountNotifications = notifications
    .filter((notification) => isAdminNotification(notification, auth.user?.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unreadCount = accountNotifications.filter((notification) => !notification.read).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Notifications</h1>
          <p className="text-sm text-muted">Account activity and important admin alerts.</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => markAllNotifRead(auth.user?.id)}>
            Mark all read
          </Button>
        )}
      </div>

      {accountNotifications.length === 0 ? (
        <Card>
          <EmptyState title="No notifications" description="Important account activity will appear here." />
        </Card>
      ) : (
        <div className="space-y-2">
          {accountNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => markNotifRead(notification.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                notification.read ? 'border-hairline bg-white' : 'border-brand-line bg-brand-soft'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{notification.title}</p>
                  <p className="mt-1 text-sm text-body">{notification.message}</p>
                  <p className="mt-2 text-xs text-muted">
                    {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}
                  </p>
                </div>
                {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
