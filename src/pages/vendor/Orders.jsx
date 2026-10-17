import { useState } from 'react';
;
import { Eye, Check, X, ChefHat, Package, Truck } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, Button, StatusBadge, formatPeso, Tabs, formatDateTime, EmptyState, Modal, Textarea, formatQueue, LogoMark } from '@/components/UI';

export default function VendorOrders() {
  const { auth, orders, updateOrderStatus, rejectOrder } = useApp();
  const vendorId = auth.user.id;
  const myOrders = orders.filter((o) => (
    String(o.vendorId) === String(vendorId) || String(o.vendorId) === String(auth.user.ownerId)
  )).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const [activeTab, setActiveTab] = useState('all');
  const [viewOrder, setViewOrder] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const active = myOrders.filter((o) => ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(o.status));
  const completed = myOrders.filter((o) => o.status === 'COMPLETED');
  const cancelled = myOrders.filter((o) => ['CANCELLED', 'REJECTED'].includes(o.status));

  const tabs = [
    { id: 'active', label: 'Active', count: active.length },
    { id: 'completed', label: 'Completed', count: completed.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
    { id: 'all', label: 'All', count: myOrders.length },
  ];

  const displayed = activeTab === 'active' ? active : activeTab === 'completed' ? completed : activeTab === 'cancelled' ? cancelled : myOrders;

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">All Orders</h1>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-3">
        {displayed.length === 0 ? (
          <EmptyState title="No orders found" description="Orders will appear here." />
        ) : (
          displayed.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink">{order.id}</span>
                    <Badge color="orange">PILA {formatQueue(order.queueNumber)}</Badge>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="text-sm text-body mt-1">
                    {order.customerName} · {order.items.length} items · {formatPeso(order.total)}
                  </div>
                  <div className="text-xs text-muted mt-0.5">{formatDateTime(order.createdAt)}</div>
                  {order.rejectReason && <div className="text-xs text-danger mt-0.5">Rejected: {order.rejectReason}</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setViewOrder(order)}>
                    <Eye className="w-4 h-4" /> View
                  </Button>
                  {order.status === 'RECEIVED' && (
                    <>
                      <Button size="sm" onClick={() => updateOrderStatus(order.id, 'PREPARING')}>
                        <ChefHat className="w-4 h-4" /> Accept
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejecting(order)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {order.status === 'PREPARING' && (
                    <Button size="sm" variant="success" onClick={() => updateOrderStatus(order.id, 'READY')}>
                      <Check className="w-4 h-4" /> Ready
                    </Button>
                  )}
                  {order.status === 'READY' && order.fulfillment === 'DELIVERY' && (
                    <Button size="sm" onClick={() => updateOrderStatus(order.id, 'OUT FOR DELIVERY')}>
                      <Truck className="w-4 h-4" /> Out for Delivery
                    </Button>
                  )}
                  {order.status === 'READY' && order.fulfillment === 'PICKUP' && (
                    <Button size="sm" variant="success" onClick={() => updateOrderStatus(order.id, 'COMPLETED')}>
                      <Package className="w-4 h-4" /> Complete
                    </Button>
                  )}
                  {order.status === 'OUT FOR DELIVERY' && (
                    <Button size="sm" variant="success" onClick={() => updateOrderStatus(order.id, 'COMPLETED')}>
                      <Check className="w-4 h-4" /> Complete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {viewOrder && (
        <Modal open={true} onClose={() => setViewOrder(null)} title={`Order ${viewOrder.id}`} size="lg">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LogoMark name={auth.user.name} logo={auth.user.logo} size="sm" />
              <div className="min-w-0">
                <div className="font-semibold text-sm text-ink truncate">{auth.user.name}</div>
                <div className="text-xs text-muted">Seller</div>
              </div>
              <span className="flex-1" />
              <Badge color="orange">PILA {formatQueue(viewOrder.queueNumber)}</Badge>
              <StatusBadge status={viewOrder.status} />
            </div>
          {/*
            Single column on a phone. The payment cell is the one that overflowed:
            "Payment: CASH (UNPAID)" plus a label is wider than half a 320px
            screen, and the value wrapped mid-word. These are also the four facts a
            vendor calls a customer to confirm, so none of them may be clipped.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="min-w-0"><span className="text-muted">Customer:</span> <span className="break-words">{viewOrder.customerName}</span></div>
            <div className="min-w-0"><span className="text-muted">Mobile:</span> <span className="break-words">{viewOrder.customerMobile}</span></div>
            <div className="min-w-0"><span className="text-muted">Payment:</span> <span className="break-words">{viewOrder.paymentMethod} ({viewOrder.paymentStatus})</span></div>
            <div className="min-w-0"><span className="text-muted">Fulfillment:</span> <span className="break-words">{viewOrder.fulfillment}</span></div>
          </div>
            {viewOrder.fulfillment === 'DELIVERY' && (
              <div className="text-sm"><span className="text-muted">Address:</span> {viewOrder.customerAddress}</div>
            )}
            <div>
              <h4 className="font-medium text-sm mb-2">Items</h4>
              <div className="space-y-1 bg-surface-sunken rounded-lg p-3">
                {viewOrder.items.map((i, idx) => (
                  <div key={idx} className="text-sm flex justify-between">
                    <span>{i.quantity}× {i.name} {i.notes && <span className="text-xs text-muted italic">({i.notes})</span>}</span>
                    <span>{formatPeso(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-2 space-y-1 text-sm">

              <div className="flex justify-between font-bold"><span>Total</span><span className="text-brand-strong">{formatPeso(viewOrder.total)}</span></div>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={!!rejecting} onClose={() => { setRejecting(null); setRejectReason(''); }} title="Reject Order" size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setRejecting(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="danger" onClick={() => { if (rejectReason) { rejectOrder(rejecting.id, rejectReason); setRejecting(null); setRejectReason(''); } }}>Reject Order</Button>
          </>
        }
      >
        <p className="text-sm text-body mb-3">Please provide a reason for rejecting this order.</p>
        <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="E.g. Item out of stock" />
      </Modal>
    </div>
  );
}
