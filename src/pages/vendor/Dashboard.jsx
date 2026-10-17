import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle, Package, Truck, DollarSign, Users, Store, AlertTriangle, UtensilsCrossed } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, StatusBadge, Badge, formatPeso, formatQueue, LogoMark, CARD_FOCUS_RING } from '@/components/UI';

export default function VendorDashboard() {
  const { auth, orders, setStoreStatus } = useApp();
  const [savingStoreStatus, setSavingStoreStatus] = useState(false);
  const vendorId = auth.user.id;
  const vendor = auth.user;

  const myOrders = orders.filter((o) => o.vendorId === vendorId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = myOrders.filter((o) => new Date(o.createdAt) >= today);
  const pending = myOrders.filter((o) => o.status === 'RECEIVED');
  const preparing = myOrders.filter((o) => o.status === 'PREPARING');
  const ready = myOrders.filter((o) => o.status === 'READY');
  const completedToday = todayOrders.filter((o) => o.status === 'COMPLETED');
  const todaySales = todayOrders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.total, 0);
  const changeStoreStatus = async (status) => {
    if (savingStoreStatus) return;
    setSavingStoreStatus(true);
    try {
      await setStoreStatus(vendorId, status);
    } finally {
      setSavingStoreStatus(false);
    }
  };

  const stats = [
    { label: "Today's Orders", value: todayOrders.length, icon: ClipboardList, color: 'bg-cat-blue/10 text-brand-strong' },
    { label: 'Pending', value: pending.length, icon: Clock, color: 'bg-warning-soft text-warning' },
    { label: 'Preparing', value: preparing.length, icon: ClipboardList, color: 'bg-brand-muted text-brand-strong' },
    { label: 'Ready', value: ready.length, icon: CheckCircle, color: 'bg-success-soft text-success' },
    { label: 'Completed Today', value: completedToday.length, icon: Package, color: 'bg-surface-hover text-body' },
    { label: "Today's Sales", value: formatPeso(todaySales), icon: DollarSign, color: 'bg-success-soft text-success' },
    { label: 'Current Queue', value: vendor.queue, icon: Users, color: 'bg-cat-violet-soft text-cat-violet-deep' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            <LogoMark name={vendor.name} logo={vendor.logo} size="md" />
            <div>
              <h1 className="text-2xl font-bold text-ink">Welcome back, {(vendor.ownerName || vendor.name || '').split(' ')[0]}!</h1>
              <p className="text-sm text-muted">Here's what's happening at {vendor.name}.</p>
            </div>
          </div>
        {vendor.status === 'pending' && (
          <div className="bg-warning-soft border border-warning/30 text-warning px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Awaiting admin approval
          </div>
        )}
      </div>

      {/* Store Status Control */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl bg-success-soft flex items-center justify-center">
              <Store className="w-6 h-6 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">Store Status</h3>
              <p className="text-sm text-muted">Current status: <StatusBadge status={vendor.storeStatus} /></p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={savingStoreStatus}
              onClick={() => changeStoreStatus('OPEN')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium border transition ${vendor.storeStatus === 'OPEN' ? 'bg-success text-white border-success' : 'bg-white text-success border-success/30 hover:bg-success-soft'}`}
            >
              OPEN
            </button>
            <button type="button" disabled={savingStoreStatus}
              onClick={() => changeStoreStatus('BUSY')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium border transition ${vendor.storeStatus === 'BUSY' ? 'bg-warning text-white border-warning-deep' : 'bg-white text-warning border-warning/30 hover:bg-warning-soft'}`}
            >
              BUSY
            </button>
            <button type="button" disabled={savingStoreStatus}
              onClick={() => changeStoreStatus('CLOSED')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium border transition ${vendor.storeStatus === 'CLOSED' ? 'bg-danger text-white border-danger' : 'bg-white text-danger border-danger/30 hover:bg-danger-soft'}`}
            >
              CLOSED
            </button>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-ink">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/vendor/kds" className={`block rounded-card ${CARD_FOCUS_RING}`}>
          <Card interactive className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-muted rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-brand-strong" />
              </div>
              <div>
                <h3 className="font-semibold text-ink text-sm">Kitchen Display</h3>
                <p className="text-xs text-muted">{pending.length + preparing.length + ready.length} active</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/vendor/menu" className={`block rounded-card ${CARD_FOCUS_RING}`}>
          <Card interactive className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cat-blue/10 rounded-lg flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-brand-strong" />
              </div>
              <div>
                <h3 className="font-semibold text-ink text-sm">Manage Menu</h3>
                <p className="text-xs text-muted">{vendor.menu?.length ?? 0} items</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/vendor/settings" className={`block rounded-card ${CARD_FOCUS_RING}`}>
          <Card interactive className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-surface-hover rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-body" />
              </div>
              <div>
                <h3 className="font-semibold text-ink text-sm">Delivery Settings</h3>
                <p className="text-xs text-muted">{vendor.deliveryAvailable ? 'Offering delivery' : 'Pick-up only'}</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Recent Orders */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">Recent Orders</h2>
          <Link to="/vendor/orders" className="text-xs text-success font-medium">View all →</Link>
        </div>
        {myOrders.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {myOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-2.5 bg-surface-sunken rounded-lg">
                <div>
                  <div className="font-medium text-sm text-ink">{order.id} <Badge color="orange">PILA {formatQueue(order.queueNumber)}</Badge></div>
                  <div className="text-xs text-muted">{order.customerName} · {formatPeso(order.total)}</div>
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* UtensilsCrossed was hand-copied from lucide-react as raw inline SVG, the only
   one in src. It hardcoded width/height="24" and so rendered at 24px inside the
   20px box it was placed in, and it could not be sized by className the way
   every other icon here is. vendor/Menu.jsx already imports the real
   UtensilsCrossed from lucide-react, so the local copy is deleted in favour of
   that import. */
