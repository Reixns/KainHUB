import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingCart, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, formatPeso, EmptyState, getProductImage, LogoMark, StatusBadge } from '@/components/UI';

export default function CustomerCart() {
  const { cart, vendors, updateCartQty, removeFromCart } = useApp();
  const navigate = useNavigate();

  // Group cart by vendor. One vendor per order is settled at checkout, so the
  // group is the unit the customer reasons about here.
  const grouped = cart.reduce((acc, item) => {
    if (!acc[item.vendorId]) {
      const vendor = vendors.find((v) => String(v.id) === String(item.vendorId));
      // The group keeps its own vendorId. It is the key it was stored under, and
      // the unavailable branch below needs it for a React key -- reading
      // `group.vendorId` off a group that never stored it gave undefined.
      acc[item.vendorId] = { vendorId: item.vendorId, vendor, items: [], subtotal: 0 };
    }
    acc[item.vendorId].items.push(item);
    acc[item.vendorId].subtotal += item.price * item.quantity;
    return acc;
  }, {});

  const groups = Object.values(grouped);
  const grandSubtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const unavailableGroups = groups.filter((group) => !group.vendor);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  if (cart.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight mb-4">Cart</h1>
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse shops and add something you like."
          action={
            <Button as={Link} to="/customer/shops">Browse shops</Button>
          }
        />
      </div>
    );
  }

  /*
    A cart can outlive the shop it points at: a vendor can be rejected,
    suspended or removed while items still sit in the cart, which made
    `vendor.id` on the group card throw and white-screen the page. Checkout
    guards the same case; handle it here rather than rendering a broken header.

    The unavailable groups are listed with their dishes and a remove control
    instead of only offering a link to the shops page. The message used to say
    "remove those items to continue" while rendering nothing the customer could
    remove, so the only way out was to clear the whole cart or work out each
    item by hand in the browser.
  */
  if (unavailableGroups.length > 0) {
    const unavailableItems = unavailableGroups.flatMap((group) => group.items);
    return (
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight mb-4">Cart</h1>
        <div className="rounded-card border border-danger/30 bg-danger-soft p-4 mb-4">
          <div className="font-semibold text-danger">Some items can no longer be ordered</div>
          <p className="text-sm text-muted mt-1">
            One or more shops you ordered from are no longer open. Remove the items below to check out the rest.
          </p>
        </div>

        <div className="space-y-3 mb-4">
          {unavailableGroups.map((group) => (
            <Card key={`gone-${group.vendorId ?? group.items[0]?.cartId}`} className="overflow-hidden opacity-90">
              <div className="flex items-center gap-3 px-4 py-3 bg-surface-sunken border-b border-hairline">
                <div className="w-9 h-9 rounded-control bg-hairline flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4 text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate">Shop no longer available</div>
                  <div className="text-xs text-muted">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <ul className="divide-y divide-hairline">
                {group.items.map((item) => (
                  <li key={item.cartId} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-ink font-medium truncate">
                        {item.quantity}× {item.name}
                      </div>
                      <div className="text-xs text-muted tabular-nums">{formatPeso(item.price * item.quantity)}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${item.name} from cart`}
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-danger hover:bg-danger-soft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" as={Link} to="/customer/shops">Browse shops</Button>
          <Button
            variant="ghost"
            onClick={() => unavailableItems.forEach((item) => removeFromCart(item.cartId))}
          >
            Remove all unavailable items
          </Button>
        </div>
      </div>
    );
  }

  return (
    // pb reserves room for the fixed checkout bar: the nav height (56px + bottom
    // inset) plus roughly 80px of bar height. The inset has to be in the padding
    // as well as the bar's offset, or the last row of the cart stays hidden behind
    // the bar on a phone with a home indicator.
    <div className="pb-[calc(12rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2 mb-5">
        <Link to="/customer/shops" aria-label="Back to shops" className="-ml-1 tap-target rounded-full text-muted hover:bg-surface-hover hover:text-ink">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Cart</h1>
        <span className="text-sm text-muted ml-auto tabular-nums">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-4">
        {groups.map(({ vendor, items, subtotal }) => {
          return (
            <Card key={String(vendor.id)} className="overflow-hidden">
              {/* Vendor header on a sunken surface. The shop name is the primary
                  label for the whole group, since the items below are
                  meaningless without knowing which kitchen they came from. */}
              <div className="flex items-center gap-3 px-4 py-3 bg-surface-sunken border-b border-hairline">
                <LogoMark name={vendor.name} logo={vendor.logo} size="sm" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-ink truncate leading-snug">{vendor.name}</h2>
                  {vendor.address && (
                    <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{vendor.address}</span>
                    </p>
                  )}
                </div>
                <StatusBadge status={vendor.storeStatus} />
              </div>

              <ul className="divide-y divide-hairline">
                {items.map((item) => {
                  const photo = getProductImage(item.image);
                  return (
                    <li key={item.cartId} className="flex gap-3 p-4">
                      <div className="w-14 h-14 bg-surface-hover rounded-control flex items-center justify-center text-xl shrink-0 overflow-hidden">
                        {photo ? (
                          <img src={photo} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <span aria-hidden="true">{item.image && item.image.length <= 4 ? item.image : '🍽️'}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/*
                          min-w-0 on the name. It is a flex item, so its default
                          min-width:auto lets a long dish name refuse to shrink --
                          which pushed the line total out past the row and made the
                          cart horizontally scrollable on a phone. The price keeps
                          shrink-0 because the number is the part being compared.
                        */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-ink text-sm leading-snug min-w-0 break-words">{item.name}</h3>
                          <span className="font-semibold text-ink text-sm tabular-nums shrink-0">
                            {formatPeso(item.price * item.quantity)}
                          </span>
                        </div>
                        <p className="text-xs text-muted tabular-nums mt-0.5">{formatPeso(item.price)} each</p>
                        {item.notes && <p className="text-xs text-body italic mt-1 break-words">{item.notes}</p>}

                        <div className="flex items-center justify-between gap-2 mt-2.5">
                          <div className="flex items-center rounded-control border border-hairline-strong bg-white">
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${item.name}`}
                              onClick={() => updateCartQty(item.cartId, -1)}
                              className="w-10 h-10 rounded-l-control text-body hover:bg-surface-hover hover:text-ink flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${item.name}`}
                              onClick={() => updateCartQty(item.cartId, 1)}
                              className="w-10 h-10 rounded-r-control text-body hover:bg-surface-hover hover:text-ink flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cartId)}
                            aria-label={`Remove ${item.name} from cart`}
                            className="w-10 h-10 rounded-control text-subtle hover:bg-danger-soft hover:text-danger flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="px-4 py-3 bg-surface-sunken border-t border-hairline">
                {/* Same min-w-0 reasoning as the line item above: the totals row
                    overflowed on a phone once a total reached four digits. */}
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted shrink-0">Items total</span>
                  <span className="font-semibold text-ink tabular-nums min-w-0 text-right break-words">{formatPeso(subtotal)}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/*
        The subtotal bar is offset by the nav height *plus* the bottom inset.
        bottom-20 is a flat 80px, but the bottom nav is h-14 + a
        h-[env(safe-area-inset-bottom)] spacer, i.e. ~90px on a phone with a home
        indicator -- so the bar slid under the nav and the checkout button in it
        became untappable on exactly the devices that are most likely to be
        holding a cart.
      */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-white border-t border-hairline z-30 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-muted">Subtotal</div>
            <div className="text-lg font-bold text-ink tabular-nums leading-tight">{formatPeso(grandSubtotal)}</div>
          </div>
          <Button className="shrink-0" size="lg" onClick={() => navigate('/customer/checkout')}>
            Checkout
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
