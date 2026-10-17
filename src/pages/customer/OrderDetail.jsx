import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCheck, Clock, ChefHat, Package, Truck, MapPin, Home, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, StatusBadge, formatPeso, formatDateTime, formatQueue, LogoMark } from '@/components/UI';
import ShopRatingForm from '@/components/ShopRatingForm';
import { ORDER_STATUSES_DELIVERY, ORDER_STATUSES_PICKUP } from '@/data/mockData';

export default function CustomerOrderDetail() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('success') === '1';
  const { orders, vendors, shopRatings, rateShop } = useApp();
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return (
      <div>
        <Link to="/customer/orders" className="inline-flex items-center gap-1 text-sm text-body hover:text-ink mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </Link>
        <div className="text-center py-20 text-muted">Order not found.</div>
      </div>
    );
  }

  const vendor = vendors.find((v) => v.id === order.vendorId);
  const savedRating = shopRatings.find((item) => String(item.orderNumber) === String(order.id));
  const statuses = order.fulfillment === 'DELIVERY' ? ORDER_STATUSES_DELIVERY : ORDER_STATUSES_PICKUP;
  const currentIdx = statuses.indexOf(order.status);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <Link to="/customer/orders" aria-label="Back to orders" className="-ml-1 tap-target rounded-full text-muted hover:bg-surface-hover hover:text-ink">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Order</h1>
      </div>

      {isNew && (
        <div className="bg-success-soft border border-success/30 rounded-card p-4 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-ink">Order placed</h2>
              <p className="text-sm text-body mt-0.5">
                Your queue number is <span className="font-semibold text-ink tabular-nums">{formatQueue(order.queueNumber)}</span>. Order {order.id}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/*
        Status first, and as the largest element on the page. A customer opening
        this link wants one answer -- where is my food -- so the tracker leads
        and the reference numbers are secondary.
      */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <div className="text-xs text-muted">Queue number</div>
            <div className="text-3xl font-bold text-ink tabular-nums leading-tight">{formatQueue(order.queueNumber)}</div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <ProgressTracker statuses={statuses} currentIdx={currentIdx} fulfillment={order.fulfillment} />
      </Card>

      {order.status === 'COMPLETED' && (
        <Card className="mb-4 overflow-hidden p-0">
          <ShopRatingForm order={order} savedRating={savedRating} rateShop={rateShop} shop={vendor} />
        </Card>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6 lg:items-start">
        <div className="space-y-4">
          {/* Items */}
          <Card className="p-4">
            <h2 className="font-semibold text-ink mb-3">Items</h2>
            <ul className="space-y-2.5">
              {order.items.map((item, idx) => (
                <li key={idx} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium text-ink">
                      <span className="tabular-nums">{item.quantity}&times;</span> {item.name}
                    </span>
                    {item.notes && <div className="text-xs text-muted italic mt-0.5">{item.notes}</div>}
                  </div>
                  <span className="text-body tabular-nums shrink-0">{formatPeso(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-hairline mt-3 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between font-bold text-ink">
                <span>Total</span>
                <span className="tabular-nums">{formatPeso(order.total)}</span>
              </div>
              <div className="flex justify-between text-muted text-xs pt-1">
                <span>Payment</span>
                <span>{order.paymentMethod} &middot; {order.paymentStatus}</span>
              </div>
            </div>
            {order.specialInstructions && (
              <p className="text-xs text-muted pt-3 mt-3 border-t border-hairline">
                <span className="font-medium text-body">Note: </span>{order.specialInstructions}
              </p>
            )}
          </Card>

          {/* Timeline */}
          <Card className="p-4">
            <h2 className="font-semibold text-ink mb-4">History</h2>
            <ol className="space-y-0">
              {order.timeline.map((t, i) => {
                const isLast = i === order.timeline.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    {/* Connector line between markers, so the list reads as one
                        continuous sequence rather than unrelated dots. */}
                    <div className="flex flex-col items-center shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isLast ? 'bg-brand' : 'bg-hairline-strong'}`} />
                      {!isLast && <span className="w-px flex-1 bg-hairline my-1" aria-hidden="true" />}
                    </div>
                    <div className={`pb-4 min-w-0 ${isLast ? '' : ''}`}>
                      <div className={`text-sm font-medium ${isLast ? 'text-ink' : 'text-body'}`}>{t.status}</div>
                      <div className="text-xs text-muted tabular-nums">{formatDateTime(t.time)}</div>
                      {t.reason && <div className="text-xs text-danger mt-1">{t.reason}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        {/* Seller and delivery details. Secondary column on desktop. */}
        <div className="mt-4 lg:mt-0 space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold text-ink mb-3">Seller</h2>
            <div className="flex items-center gap-3">
              <LogoMark name={order.vendorName} logo={vendor?.logo} size="md" />
              <div className="min-w-0">
                <div className="font-semibold text-ink truncate">{order.vendorName}</div>
                {vendor?.address && (
                  <div className="text-xs text-muted flex items-start gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{vendor.address}</span>
                  </div>
                )}
              </div>
            </div>

            {order.fulfillment === 'DELIVERY' ? (
              <div className="mt-3 pt-3 border-t border-hairline text-sm flex items-start gap-2">
                <Home className="w-4 h-4 text-subtle shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs text-muted">Delivering to</div>
                  <div className="text-ink">{order.customerAddress}</div>
                </div>
              </div>
            ) : (
              <p className="mt-3 pt-3 border-t border-hairline text-sm text-body flex items-start gap-2">
                <MapPin className="w-4 h-4 text-subtle shrink-0 mt-0.5" aria-hidden="true" />
                Pick up at the shop once marked ready.
              </p>
            )}
          </Card>

          <Button
            as={Link}
            to={`/customer/messages?chatId=${encodeURIComponent(`chat-${order.vendorId}-${order.customerId}`)}&vendorId=${order.vendorId}`}
            variant="outline"
            full
          >
            <MessageSquare className="w-4 h-4" /> Chat with seller
          </Button>
        </div>
      </div>
    </div>
  );
}

/*
 * Horizontal progress tracker. A single connector line runs behind the
 * markers and fills to the current step, which is easier to read at a glance
 * than five independently coloured circles.
 */
function ProgressTracker({ statuses, currentIdx, fulfillment }) {
  // REJECTED/CANCELLED are not in the status lists, so indexOf returns -1 and
  // the unfilled formula produced width: -25%, which the browser drops.
  const pct = statuses.length > 1 && currentIdx >= 0 ? (currentIdx / (statuses.length - 1)) * 100 : 0;
  const icons = [Clock, ChefHat, Package, fulfillment === 'DELIVERY' ? Truck : Check, CheckCheck];

  return (
    <div>
      <div className="relative">
        {/* Track and fill, inset so they sit under the marker centres. */}
        <div className="absolute left-5 right-5 top-5 h-0.5 bg-hairline" aria-hidden="true">
          <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>

        <ol className="relative flex justify-between">
          {statuses.map((s, i) => {
            const isDone = i <= currentIdx;
            const isCurrent = i === currentIdx;
            const Icon = icons[i] || Check;
            return (
              <li key={s} className="flex flex-col items-center w-1/5 last:w-auto last:flex-none">
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-brand text-white' : 'bg-surface-hover text-subtle'
                  } ${isCurrent ? 'ring-4 ring-brand-muted' : ''}`}
                  aria-hidden="true"
                >
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <span
                  className={`text-xs leading-tight mt-2 text-center font-medium ${
                    isDone ? 'text-ink' : 'text-subtle'
                  }`}
                >
                  {s}
                </span>
                {isCurrent && <span className="sr-only">(current status)</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
