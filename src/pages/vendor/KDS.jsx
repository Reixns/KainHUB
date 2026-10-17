import { useEffect, useState } from 'react';
import { Clock, Phone, MapPin, Check, Package, ChefHat, Truck, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, Button, StatusBadge, formatPeso, Tabs, formatDateTime, formatQueue, LogoMark } from '@/components/UI';

export default function VendorKDS() {
  const { auth, orders, updateOrderStatus, rejectOrder, savingOrderIds, ordersRealtimeStatus } = useApp();
  const vendorId = auth.user.id;

  const myOrders = orders.filter((o) => (
    (String(o.vendorId) === String(vendorId) || String(o.vendorId) === String(auth.user.ownerId))
    && !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(o.status)
  ));

  const received = myOrders.filter((o) => o.status === 'RECEIVED');
  const preparing = myOrders.filter((o) => o.status === 'PREPARING');
  const ready = myOrders.filter((o) => o.status === 'READY');
  const outForDelivery = myOrders.filter((o) => o.status === 'OUT FOR DELIVERY');

  const [activeTab, setActiveTab] = useState('all');

  const tabs = [
    { id: 'all', label: 'All', count: myOrders.length },
    { id: 'RECEIVED', label: 'New', count: received.length },
    { id: 'PREPARING', label: 'Preparing', count: preparing.length },
    { id: 'READY', label: 'Ready', count: ready.length },
    { id: 'OUT', label: 'Out for Delivery', count: outForDelivery.length },
  ];

  let filtered = myOrders;
  if (activeTab === 'RECEIVED') filtered = received;
  else if (activeTab === 'PREPARING') filtered = preparing;
  else if (activeTab === 'READY') filtered = ready;
  else if (activeTab === 'OUT') filtered = outForDelivery;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Kitchen Display</h1>
          <p className="text-sm text-muted">Move each ticket through to pickup or delivery.</p>
        </div>
        <RealtimeStatus status={ordersRealtimeStatus} />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label="Order status" />

      <div className="mt-4 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <Card className="col-span-full p-8 text-center">
            <ChefHat className="w-12 h-12 mx-auto mb-3 text-subtle" aria-hidden="true" />
            <p className="font-medium text-ink">No active orders</p>
            <p className="text-sm text-muted mt-0.5">New orders will appear here.</p>
          </Card>
        ) : (
          filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              shop={auth.user}
              onUpdate={updateOrderStatus}
              onReject={rejectOrder}
              saving={savingOrderIds.has(String(order.id))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, shop, onUpdate, onReject, saving }) {
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // A kitchen display is judged on one number: how long this order has been
  // waiting. It ticks here rather than only on re-render so a ticket that has
  // been sitting for a while visibly escalates on its own.
  const [elapsedMin, setElapsedMin] = useState(() => minutesSince(order.createdAt));
  useEffect(() => {
    const id = setInterval(() => setElapsedMin(minutesSince(order.createdAt)), 30_000);
    return () => clearInterval(id);
  }, [order.createdAt]);

  const overdue = elapsedMin >= 20;

  const nextAction = {
    RECEIVED: { label: 'Start preparing', icon: <ChefHat className="w-4 h-4" />, status: 'PREPARING' },
    PREPARING: { label: 'Mark ready', icon: <Check className="w-4 h-4" />, status: 'READY' },
    READY: order.fulfillment === 'DELIVERY'
      ? { label: 'Out for delivery', icon: <Truck className="w-4 h-4" />, status: 'OUT FOR DELIVERY' }
      : { label: 'Mark completed', icon: <Package className="w-4 h-4" />, status: 'COMPLETED' },
    'OUT FOR DELIVERY': { label: 'Mark completed', icon: <Package className="w-4 h-4" />, status: 'COMPLETED' },
  }[order.status];

  // Status is carried by the left rail and the badge rather than by tinting the
  // whole ticket, so the order text stays black on white and legible under
  // kitchen lighting.
  const statusRail = {
    RECEIVED: 'border-l-info',
    PREPARING: 'border-l-warning',
    READY: 'border-l-success',
    'OUT FOR DELIVERY': 'border-l-gray-400',
  }[order.status];

  return (
    <Card className={`border-l-4 ${statusRail} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-black text-ink tabular-nums leading-none">{formatQueue(order.queueNumber)}</span>
            <StatusBadge status={order.status} />
          </div>
          <div className="text-right shrink-0">
            <div className={`text-sm font-bold tabular-nums ${overdue ? 'text-danger' : 'text-muted'}`}>
              {elapsedMin < 1 ? 'just now' : `${elapsedMin}m`}
            </div>
            <div className="text-xs text-subtle">waiting</div>
          </div>
        </div>

        {overdue && (
          <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-danger bg-danger-soft border border-danger/20 rounded-control px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Running late — {elapsedMin} minutes since it came in
          </div>
        )}

        <div className="flex items-center gap-2 text-sm mb-1.5">
          <LogoMark name={shop?.name} logo={shop?.logo} size="xs" />
          <span className="font-semibold text-ink truncate">{shop?.name || order.vendorName}</span>
          <span className="text-xs text-muted truncate">· {order.customerName}</span>
        </div>
        <div className="space-y-0.5 text-xs text-muted">
          <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" aria-hidden="true" /> {order.customerMobile || 'No mobile on file'}</div>
          {order.fulfillment === 'DELIVERY' && (
            <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" /> <span className="flex-1">{order.customerAddress}</span></div>
          )}
          <div className="flex items-center gap-1.5 pt-1.5">
            <Badge color={order.fulfillment === 'DELIVERY' ? 'gray' : 'blue'}>
              {order.fulfillment === 'DELIVERY' ? 'Delivery' : 'Pick-up'}
            </Badge>
            <Badge color={order.paymentMethod === 'GCASH' ? 'green' : 'yellow'}>{order.paymentMethod}</Badge>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-hairline">
          <div className="text-xs font-medium text-muted mb-2">Items</div>
          <div className="space-y-1.5">
            {order.items.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{item.quantity}&times; {item.name}</span>
                  <span className="text-muted tabular-nums">{formatPeso(item.price * item.quantity)}</span>
                </div>
                {item.notes && (
                  <p className="text-xs text-warning bg-warning-soft rounded-control px-2 py-1 mt-1">
                    <span className="font-medium">Note:</span> {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
          {order.specialInstructions && (
            <div className="mt-2 text-xs text-body bg-brand-soft px-2.5 py-2 rounded-control border border-brand-muted">
              <span className="font-semibold">Order note:</span> {order.specialInstructions}
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted">Total</div>
            <div className="text-xl font-bold text-ink tabular-nums">{formatPeso(order.total)}</div>
          </div>
          <div className="text-xs text-subtle flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" /> {formatDateTime(order.createdAt)}
          </div>
        </div>
      </div>

      <div className="p-3 bg-surface-sunken border-t border-hairline space-y-2">
        {order.status === 'RECEIVED' && !showReject && (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="w-full min-h-10 text-xs font-medium text-danger hover:underline"
          >
            Reject this order
          </button>
        )}
        {showReject && (
          <div className="bg-white border border-danger/30 rounded-control p-3 space-y-2">
            <label htmlFor={`reject-${order.id}`} className="block text-xs font-medium text-body">Reason for rejection</label>
            <textarea
              id={`reject-${order.id}`}
              className="w-full px-2.5 py-2 text-sm border border-hairline-strong rounded-control focus:border-brand focus:ring-2 focus:ring-brand-muted"
              rows={2}
              placeholder="e.g. Item out of stock"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" full onClick={() => setShowReject(false)}>Cancel</Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                full
                loading={saving}
                onClick={async () => {
                  const saved = await onReject(order.id, rejectReason || 'Unavailable');
                  if (saved) {
                    setShowReject(false);
                    setRejectReason('');
                  }
                }}
              >
                {saving ? 'Saving rejection...' : 'Reject order'}
              </Button>
            </div>
          </div>
        )}
        {nextAction && (
          <Button
            type="button"
            size="lg"
            variant={order.status === 'PREPARING' || order.status === 'READY' || order.status === 'OUT FOR DELIVERY' ? 'success' : 'primary'}
            full
            loading={saving}
            onClick={() => onUpdate(order.id, nextAction.status)}
          >
            {saving ? 'Saving status...' : <>{nextAction.icon} {nextAction.label}</>}
          </Button>
        )}
      </div>
    </Card>
  );
}

function RealtimeStatus({ status }) {
  const connected = status === 'connected';
  const local = status === 'local';
  const label = connected
    ? 'Live updates connected'
    : status === 'reconnecting'
      ? 'Reconnecting to live updates...'
      : local
        ? 'Local mode — orders are not shared'
        : 'Connecting to live updates...';
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
        connected
          ? 'bg-success-soft text-success'
          : local
            ? 'bg-warning-soft text-warning'
            : 'bg-surface-sunken text-muted'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${connected ? 'bg-success' : local ? 'bg-warning' : 'bg-muted'}`} aria-hidden="true" />
      {label}
    </div>
  );
}

function minutesSince(dateStr) {
  const created = new Date(dateStr).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 60000));
}
