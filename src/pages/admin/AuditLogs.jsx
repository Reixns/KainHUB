import { useApp } from '@/context/AppContext';
import { Badge, Card, formatDateTime } from '@/components/UI';

const MAX_LOGS_SHOWN = 100;

const formatChanges = (log) => {
  if (log.legacy) return log.details || 'Order status changed';
  const fields = Array.isArray(log.details?.changed_fields) ? log.details.changed_fields : [];
  if (fields.length === 0) return 'No field details';
  return fields.map((field) => {
    const before = log.details?.before || {};
    const after = log.details?.after || {};
    const hasBefore = Object.hasOwn(before, field);
    const hasAfter = Object.hasOwn(after, field);
    if (!hasBefore && !hasAfter) return field;
    const from = hasBefore ? JSON.stringify(before[field]) : '—';
    const to = hasAfter ? JSON.stringify(after[field]) : '—';
    return `${field}: ${from} → ${to}`;
  }).join(', ');
};

export default function AdminAuditLogs() {
  const { orders, auditLogs } = useApp();
  const loggedOrders = new Set(
    auditLogs.filter((log) => log.entity_type === 'orders').map((log) => String(log.entity_id)),
  );
  const logs = auditLogs.map((log) => ({
    id: `activity-${log.id}`,
    time: log.created_at,
    actorRole: log.actor_role || 'system',
    actorId: log.actor_id,
    action: log.action,
    entity: log.entity_type,
    entityId: log.entity_id,
    details: log.details,
  }));
  orders.forEach((order) => {
    if (loggedOrders.has(String(order.id))) return;
    (order.timeline || []).forEach((event, index) => {
      logs.push({
        id: `history-${order.id}-${index}`,
        time: event.time,
        actorRole: 'history',
        actorId: null,
        action: event.status,
        entity: 'orders',
        entityId: order.id,
        details: event.reason,
        legacy: true,
      });
    });
  });
  logs.sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">Audit Logs</h1>
      <p className="text-sm text-muted mb-4">System-wide activity and order events.</p>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Portal</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Record</th>
                <th className="px-3 py-2">Changes</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted">No activity recorded yet.</td></tr> : logs.slice(0, MAX_LOGS_SHOWN).map((log) => (
                <tr key={log.id} className="border-t border-hairline">
                  <td className="px-3 py-2 text-xs text-muted">{formatDateTime(log.time)}</td>
                  <td className="px-3 py-2">
                    <Badge color={log.actorRole === 'admin' ? 'blue' : log.actorRole === 'vendor' ? 'green' : 'gray'}>
                      {log.actorRole}
                    </Badge>
                  </td>
                  <td className="px-3 py-2" title={log.actorId || 'System'}>{log.actorId ? `${log.actorId.slice(0, 8)}…` : 'System'}</td>
                  <td className="px-3 py-2 font-medium">{log.action}</td>
                  <td className="px-3 py-2">{log.entity}{log.entityId ? ` · ${log.entityId}` : ''}</td>
                  <td className="px-3 py-2 text-xs">{formatChanges(log)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
