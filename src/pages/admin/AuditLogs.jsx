import { useApp } from '@/context/AppContext';
import { Card, StatusBadge, formatDateTime, LogoMark } from '@/components/UI';

const MAX_LOGS_SHOWN = 100;

export default function AdminAuditLogs() {
  const { orders, vendors } = useApp();
  const logoFor = (order) => vendors.find((v) => String(v.id) === String(order.vendorId))?.logo;
  const logs = [];
  orders.forEach((o) => {
    o.timeline.forEach((t) => {
      logs.push({ orderId: o.id, action: t.status, time: t.time, vendor: o.vendorName, logo: logoFor(o), customer: o.customerName, reason: t.reason });
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
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted">No logs yet.</td></tr> : logs.slice(0, MAX_LOGS_SHOWN).map((l, i) => (
                <tr key={i} className="border-t border-hairline">
                  <td className="px-3 py-2 text-xs text-muted">{formatDateTime(l.time)}</td>
                  <td className="px-3 py-2 font-medium">{l.orderId}</td>
                  <td className="px-3 py-2"><StatusBadge status={l.action} /></td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <LogoMark name={l.vendor} logo={l.logo} size="xs" />
                      <span className="truncate">{l.vendor}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">{l.customer}</td>
                  <td className="px-3 py-2 text-xs">{l.reason || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
