import { Link } from 'react-router-dom';
import { DollarSign, ShoppingBag, Store, Users, Clock, MessageSquare, TrendingUp, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, Button, formatPeso, LogoMark, CARD_FOCUS_RING } from '@/components/UI';
import SevenDayBarChart from '@/components/SevenDayBarChart';

export default function AdminDashboard() {
  const { vendors, customers, orders, posts } = useApp();

  const approvedVendors = vendors.filter((v) => v.status === 'approved');
  const pendingVendors = vendors.filter((v) => v.status === 'pending');
  const activeCustomers = customers.filter((c) => c.status === 'active');
  const allCompleted = orders.filter((o) => o.status === 'COMPLETED');
  const totalRevenue = allCompleted.reduce((s, o) => s + o.total, 0);
  const activeOrders = orders.filter((o) => ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(o.status));

  // Last 7 days revenue
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const dayOrders = allCompleted.filter((o) => {
      const od = new Date(o.createdAt);
      return od >= d && od < next;
    });
    days.push({
      label: d.toLocaleDateString('en-PH', { weekday: 'short' }),
      revenue: dayOrders.reduce((s, o) => s + o.total, 0),
      count: dayOrders.length,
    });
  }

  const stats = [
    { label: 'Total Revenue', value: formatPeso(totalRevenue), icon: DollarSign, color: 'bg-cat-green', to: '/admin/analytics' },
    { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'bg-cat-blue', to: '/admin/orders' },
    { label: 'Active Vendors', value: approvedVendors.length, icon: Store, color: 'bg-cat-teal', to: '/admin/vendors' },
    { label: 'Customers', value: activeCustomers.length, icon: Users, color: 'bg-cat-violet', to: '/admin/customers' },
    { label: 'Pending Vendors', value: pendingVendors.length, icon: Clock, color: 'bg-cat-amber', to: '/admin/vendors' },
    { label: 'Marketplace Posts', value: posts.length, icon: MessageSquare, color: 'bg-cat-pink', to: '/admin/marketplace' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Admin Dashboard</h1>
        <p className="text-sm text-muted">Platform overview for Lancaster Zone 1 Eats.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Link
            to={s.to}
            key={s.label}
            className={`block rounded-card ${CARD_FOCUS_RING}`}
          >
            {/*
              `interactive` rather than a hand-written `hover:shadow-md`. That
              shadow is not one of the four in the scale, it animated every
              property via bare `transition`, and it raised no focus ring -- so
              these tiles looked different from every other clickable card and
              were invisible to keyboard focus.
            */}
            <Card interactive className="p-4">
              <div className={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center text-white mb-2`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-ink tabular-nums break-words">{s.value}</div>
              <div className="text-xs text-muted">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink flex items-center gap-2"><TrendingUp className="w-5 h-5 text-brand-strong" /> Revenue (Last 7 Days)</h2>
          </div>
          <SevenDayBarChart days={days} valueKey="revenue" countKey="count" barClassName="bg-cat-blue-deep" />
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold text-ink mb-3 flex items-center gap-2"><Clock className="w-5 h-5 text-brand" /> Active Orders ({activeOrders.length})</h2>
          {activeOrders.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No active orders right now.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeOrders.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between p-2 bg-surface-sunken rounded-lg text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <LogoMark name={o.vendorName} logo={vendors.find((v) => String(v.id) === String(o.vendorId))?.logo} size="xs" />
                    <div className="min-w-0">
                      <div className="font-medium text-ink text-xs">{o.id}</div>
                      <div className="text-xs text-muted truncate">{o.vendorName}</div>
                    </div>
                  </div>
                  <Badge color={
                    o.status === 'RECEIVED' ? 'blue' :
                    o.status === 'PREPARING' ? 'yellow' :
                    o.status === 'READY' ? 'green' : 'purple'
                  }>{o.status}</Badge>
                </div>
              ))}
            </div>
          )}
          <Link to="/admin/orders" className="block mt-3 text-center text-xs text-brand-strong font-medium">View all orders →</Link>
        </Card>
      </div>

      {pendingVendors.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold text-ink mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /> Pending Vendor Approvals ({pendingVendors.length})</h2>
          <div className="space-y-2">
            {pendingVendors.map((v) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-warning-soft border border-warning/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <LogoMark name={v.name} logo={v.logo} size="sm" tone="yellow" />
                  <div>
                    <div className="font-medium text-ink text-sm">{v.name}</div>
                    <div className="text-xs text-muted">{v.ownerName} · {v.category}</div>
                  </div>
                </div>
                <Button as={Link} to="/admin/vendors" size="sm" variant="outline">Review</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
