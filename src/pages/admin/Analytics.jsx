import { BarChart3, DollarSign, ShoppingBag, Store, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, formatPeso, LogoMark } from '@/components/UI';

export default function AdminAnalytics() {
  const { orders, vendors, customers } = useApp();
  const completed = orders.filter((o) => o.status === 'COMPLETED');
  const totalRevenue = completed.reduce((s, o) => s + o.total, 0);
  const vendorRevenues = {};
  completed.forEach((o) => {
    vendorRevenues[o.vendorName] = (vendorRevenues[o.vendorName] || 0) + o.total;
  });
  const topVendors = Object.entries(vendorRevenues).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxRev = Math.max(1, ...Object.values(vendorRevenues));

  // 7 day
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const dayOrders = completed.filter((o) => { const od = new Date(o.createdAt); return od >= d && od < next; });
    days.push({
      label: d.toLocaleDateString('en-PH', { weekday: 'short' }),
      revenue: dayOrders.reduce((s, o) => s + o.total, 0),
      count: dayOrders.length,
    });
  }
  const maxDayRev = Math.max(1, ...days.map((d) => d.revenue));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Platform Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="w-10 h-10 rounded-lg bg-success-soft text-success flex items-center justify-center mb-2"><DollarSign className="w-5 h-5" /></div><div className="text-2xl font-bold">{formatPeso(totalRevenue)}</div><div className="text-xs text-muted">Total Revenue</div></Card>
        <Card className="p-4"><div className="w-10 h-10 rounded-lg bg-cat-blue/10 text-brand-strong flex items-center justify-center mb-2"><ShoppingBag className="w-5 h-5" /></div><div className="text-2xl font-bold">{orders.length}</div><div className="text-xs text-muted">Total Orders</div></Card>
        <Card className="p-4"><div className="w-10 h-10 rounded-lg bg-cat-teal-soft text-cat-teal-deep flex items-center justify-center mb-2"><Store className="w-5 h-5" /></div><div className="text-2xl font-bold">{vendors.filter(v => v.status === 'approved').length}</div><div className="text-xs text-muted">Approved Vendors</div></Card>
        <Card className="p-4"><div className="w-10 h-10 rounded-lg bg-cat-violet-soft text-cat-violet-deep flex items-center justify-center mb-2"><Users className="w-5 h-5" /></div><div className="text-2xl font-bold">{customers.length}</div><div className="text-xs text-muted">Customers</div></Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-brand-strong" /> Revenue - Last 7 Days</h2>
        <div className="flex items-end justify-between gap-2 h-48">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-xs text-muted font-medium">{formatPeso(d.revenue)}</div>
              <div className="w-full bg-cat-blue-deep rounded-t-md" style={{ height: `${(d.revenue / maxDayRev) * 100}%`, minHeight: d.revenue > 0 ? '12px' : '3px' }}></div>
              <div className="text-xs text-muted">{d.label}</div>
              <div className="text-xs font-medium">{d.count}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">Top Performing Vendors</h2>
        {topVendors.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No completed orders yet.</p>
        ) : (
          <div className="space-y-2">
            {topVendors.map(([name, rev], i) => (
              <div key={name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <LogoMark name={name} logo={vendors.find((v) => v.name === name)?.logo} size="xs" />
                    <span className="font-medium truncate">{i + 1}. {name}</span>
                  </span>
                  <span className="font-semibold shrink-0">{formatPeso(rev)}</span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-2">
                  <div className="bg-cat-blue-deep h-2 rounded-full" style={{ width: `${(rev / maxRev) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
