import { CheckCircle2, ChefHat, Truck } from 'lucide-react';
import { Badge, Card, formatQueue } from '@/components/UI';

export const ACTIVE_ORDER_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'];

const STATUS_LABELS = {
  RECEIVED: 'Received',
  PREPARING: 'Preparing',
  READY: 'Ready',
  'OUT FOR DELIVERY': 'Out for delivery',
};

const GROUPS = [
  {
    id: 'preparing',
    title: 'Preparing',
    icon: ChefHat,
    statuses: ['RECEIVED', 'PREPARING'],
    panel: 'border-warning/25 bg-warning/10',
    accent: 'text-warning',
  },
  {
    id: 'ready',
    title: 'Ready',
    icon: CheckCircle2,
    statuses: ['READY'],
    panel: 'border-success/25 bg-success/10',
    accent: 'text-success',
  },
  {
    id: 'delivery',
    title: 'On the way',
    icon: Truck,
    statuses: ['OUT FOR DELIVERY'],
    panel: 'border-white/10 bg-white/5',
    accent: 'text-brand-300',
  },
];

export default function OrderQueueBoard({
  orders = [],
  highlightOrderIds = [],
  showCustomerNames = false,
  title = 'Live order queue',
  subtitle = 'Order numbers and statuses update as the kitchen works.',
  emptyMessage = 'No active orders right now.',
}) {
  const activeOrders = orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status));
  const highlighted = new Set((highlightOrderIds || []).map(String));
  const groups = GROUPS.map((group) => ({
    ...group,
    orders: activeOrders
      .filter((order) => group.statuses.includes(order.status))
      .sort((a, b) => Number(a.queueNumber || 0) - Number(b.queueNumber || 0)),
  }));

  return (
    <Card className="overflow-hidden border-0 bg-ink text-white">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-300">{subtitle}</p>
        </div>
        <Badge color="orange" className="shrink-0">{activeOrders.length} active</Badge>
      </div>

      {activeOrders.length === 0 ? (
        <p className="p-4 text-sm text-gray-300">{emptyMessage}</p>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-3" aria-live="polite">
          {groups.map(({ id, title: groupTitle, icon: Icon, orders: groupOrders, panel, accent }) => (
            <section key={id} className={`min-h-28 rounded-card border p-3 ${panel}`} aria-label={`${groupTitle} orders`}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${accent}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {groupTitle}
                <span className="ml-auto tabular-nums">{groupOrders.length}</span>
              </div>
              <div className="mt-2.5 space-y-2">
                {groupOrders.length === 0 ? (
                  <div className="text-xs text-gray-400">Nothing here right now</div>
                ) : groupOrders.map((order) => {
                  const isHighlighted = highlighted.has(String(order.id));
                  return (
                    <div
                      key={order.id}
                      className={`rounded-control bg-white/10 px-3 py-2 ${isHighlighted ? 'ring-2 ring-brand-300' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-2xl font-black leading-none tabular-nums">{formatQueue(order.queueNumber)}</div>
                          {showCustomerNames && order.customerName && (
                            <div className="mt-1 truncate text-[11px] text-gray-300">{order.customerName}</div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] font-medium text-gray-200">{STATUS_LABELS[order.status] || order.status}</div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-400">
                            {order.fulfillment === 'DELIVERY' ? 'Delivery' : 'Pickup'}
                          </div>
                        </div>
                      </div>
                      {isHighlighted && (
                        <div className="mt-1 text-[10px] font-semibold text-brand-300">YOUR ORDER</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
