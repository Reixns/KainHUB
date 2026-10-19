import { TrendingUp, DollarSign, ShoppingBag, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, formatPeso } from '@/components/UI';
import SevenDayBarChart from '@/components/SevenDayBarChart';

export default function VendorAnalytics() {
  const { auth, orders } = useApp();
  const vendorIds = new Set([auth.user.id, auth.user.ownerId].filter((id) => id != null).map(String));
  const myOrders = orders.filter((order) => (
    (order.vendorId != null && vendorIds.has(String(order.vendorId)))
    || (order.vendorOwnerId != null && vendorIds.has(String(order.vendorOwnerId)))
  ));
  const completed = myOrders.filter((o) => o.status === 'COMPLETED');
  const cancelled = myOrders.filter((o) => ['CANCELLED', 'REJECTED'].includes(o.status));
  const completedSalesCents = completed.reduce((sum, order) => (
    sum + Math.round((Number(order.total) || 0) * 100)
  ), 0);
  const totalSales = completedSalesCents / 100;
  const avgOrder = completed.length > 0 ? completedSalesCents / completed.length / 100 : 0;
  const formattedAverage = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(avgOrder);

  // Compute simple "last 7 days"
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const dayOrders = completed.filter((o) => {
      const od = new Date(o.createdAt);
      return od >= d && od < next;
    });
    const daySales = dayOrders.reduce((s, o) => s + o.total, 0);
    days.push({
      label: d.toLocaleDateString('en-PH', { weekday: 'short' }),
      orders: dayOrders.length,
      sales: daySales,
    });
  }

  // Popular items
  const itemCounts = {};
  completed.forEach((o) => o.items.forEach((i) => {
    itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
  }));
  const popular = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        <p className="text-sm text-muted">Shop performance overview.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="w-10 h-10 rounded-lg bg-success-soft text-success flex items-center justify-center mb-2"><DollarSign className="w-5 h-5" /></div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums break-words">{formatPeso(totalSales)}</div>
          <div className="text-xs text-muted">Total Sales</div>
        </Card>
        <Card className="p-4">
          <div className="w-10 h-10 rounded-lg bg-cat-blue/10 text-brand-strong flex items-center justify-center mb-2"><ShoppingBag className="w-5 h-5" /></div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums">{completed.length}</div>
          <div className="text-xs text-muted">Completed Orders</div>
        </Card>
        <Card className="p-4">
          <div className="w-10 h-10 rounded-lg bg-brand-muted text-brand-strong flex items-center justify-center mb-2"><TrendingUp className="w-5 h-5" /></div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums break-words">{formattedAverage}</div>
          <div className="text-xs text-muted">Avg Order Value</div>
        </Card>
        <Card className="p-4">
          <div className="w-10 h-10 rounded-lg bg-danger-soft text-danger flex items-center justify-center mb-2"><X className="w-5 h-5" /></div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums">{cancelled.length}</div>
          <div className="text-xs text-muted">Cancelled/Rejected</div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold text-ink mb-4">Last 7 Days Sales</h2>
        <SevenDayBarChart
          days={days}
          valueKey="sales"
          countKey="orders"
          barClassName="bg-brand transition-all"
          heightClass="h-40"
          minBarHeight={8}
          emptyBarHeight={2}
        />
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-ink mb-3">Popular Items</h2>
        {popular.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No completed orders yet.</p>
        ) : (
          <div className="space-y-2">
            {popular.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-muted text-brand-strong flex items-center justify-center text-xs font-bold">{i + 1}</div>
                <span className="flex-1 text-sm text-ink font-medium">{name}</span>
                <span className="text-sm text-body">{count} sold</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
