import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ChevronRight, Package, Clock, ChefHat, CheckCircle, Truck, Store } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Tabs, Button, StatusBadge, formatPeso, formatDateTime, formatQueue, EmptyState, LogoMark, CARD_FOCUS_RING } from '@/components/UI';

export default function CustomerOrders() {
  const { auth, orders, vendors } = useApp();
  const myOrders = orders
    .filter((o) => String(o.customerId) === String(auth.user.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const active = myOrders.filter((o) => ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(o.status));
  const completed = myOrders.filter((o) => o.status === 'COMPLETED');
  const cancelled = myOrders.filter((o) => ['CANCELLED', 'REJECTED'].includes(o.status));
  const preparingOrders = active.filter((o) => ['RECEIVED', 'PREPARING'].includes(o.status));
  const servingOrders = active.filter((o) => ['READY', 'OUT FOR DELIVERY'].includes(o.status));

  const [activeTab, setActiveTab] = useState('all');

  const tabList = [
    { id: 'all', label: 'All', count: myOrders.length },
    { id: 'active', label: 'Active', count: active.length },
    { id: 'completed', label: 'Completed', count: completed.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
  ];

  const displayed = activeTab === 'all' ? myOrders : activeTab === 'active' ? active : activeTab === 'completed' ? completed : cancelled;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">My Orders</h1>

      {active.length > 0 && (
        <Card className="p-4 mb-5 bg-ink text-white border-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-brand-300 font-semibold">Live status</div>
              <h2 className="text-base font-bold mt-0.5">Your place in line</h2>
            </div>
            <span className="text-xs text-subtle shrink-0">Updates as the kitchen works</span>
          </div>
          {/* Stacked on a phone, side by side from sm up. Two columns at 320px
              left each panel ~118px of content after the card padding, which
              truncated the shop name to a few characters -- and this is the panel
              whose whole job is to tell you which shop your order is at. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QueueColumn title="Preparing" icon={ChefHat} orders={preparingOrders} tone="warning" vendors={vendors} />
            <QueueColumn title="Ready" icon={CheckCircle} orders={servingOrders} tone="success" vendors={vendors} />
          </div>
        </Card>
      )}

      <Tabs tabs={tabList} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-3">
        {displayed.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={activeTab === 'all' ? 'No orders yet' : `No ${activeTab} orders`}
            description={activeTab === 'completed' || activeTab === 'cancelled'
              ? 'Orders you finish or cancel will show up here.'
              : 'Browse a nearby shop and place your first order.'}
            action={(activeTab === 'all' || activeTab === 'active') ? (
              <Button as={Link} to="/customer/shops">Browse shops</Button>
            ) : null}
          />
        ) : (
          displayed.map((order) => {
             const vendor = vendors.find((v) => String(v.id) === String(order.vendorId));
            const isActiveOrder = ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(order.status);
            return (
              <Link
                to={`/customer/orders/${order.id}`}
                key={order.id}
                className={`block rounded-card ${CARD_FOCUS_RING}`}
              >
                {/*
                  `interactive` supplies the hover lift that used to be pasted
                  into this className. The focus ring was already correctly on the
                  <Link> above -- focus lands there, never on this inner div -- so
                  the two halves of the affordance were being written in two
                  places, on two different elements.
                */}
                <Card interactive className={`p-4 ${isActiveOrder ? 'border-brand-line' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink text-sm">{order.vendorName}</span>
                        <LogoMark name={order.vendorName} logo={vendor?.logo} size="xs" />
                      </div>
                      <div className="text-xs text-subtle mt-0.5">{order.id}</div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold text-ink text-sm tabular-nums">{formatPeso(order.total)}</span>
                    <span className="flex items-center gap-1">
                      {order.fulfillment === 'DELIVERY'
                        ? <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        : <Store className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      {order.fulfillment === 'DELIVERY' ? 'Delivery' : 'Pickup'}
                    </span>
                    <span>{order.paymentMethod}</span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-hairline flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1 text-muted">
                      <Clock className="w-3 h-3 shrink-0" aria-hidden="true" /> {formatDateTime(order.createdAt)}
                    </span>
                    <span className="text-brand-strong font-medium flex items-center gap-0.5">
                      {isActiveOrder ? 'Track order' : 'View details'}
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function QueueColumn({ title, icon: Icon, orders, tone, vendors = [] }) {
  // On the dark board the soft status fills are unreadable, so the accent is
  // used for the icon and the queue number only. Everything else stays neutral.
  const accent = tone === 'warning' ? 'text-warning' : 'text-success';
  const panel = tone === 'warning' ? 'bg-warning/10 border-warning/25' : 'bg-success/10 border-success/25';

  return (
    <div className={`rounded-card border p-3 min-h-28 ${panel}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${accent}`}>
        <Icon className="w-4 h-4" aria-hidden="true" />
        {title}
      </div>
      <div className="mt-2.5 space-y-1.5">
        {orders.length === 0 ? (
          <div className="text-xs text-subtle">Nothing here right now</div>
        ) : orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between gap-2 rounded-control bg-white/10 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <LogoMark name={order.vendorName} logo={vendors.find((v) => String(v.id) === String(order.vendorId))?.logo} size="xs" />
              <div className="text-xs text-gray-200 truncate">{order.vendorName}</div>
            </div>
            <div className={`text-lg font-bold shrink-0 tabular-nums ${accent}`}>{formatQueue(order.queueNumber)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
