import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, User, Truck, Package, CreditCard, Banknote, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input, Textarea, formatPeso, LogoMark, EmptyState } from '@/components/UI';
import { sanitizeMobile, isValidMobile, mobileValidationMessage, MOBILE_LENGTH } from '@/lib/mobile';

export default function CustomerCheckout() {
  const { auth, cart, vendors, placeOrder, sendChatOrderReceipt, clearCart, platformSettings, showToast } = useApp();
  const navigate = useNavigate();
  const user = auth.user;

  const grouped = cart.reduce((acc, item) => {
    if (!acc[item.vendorId]) {
      const vendor = vendors.find((v) => String(v.id) === String(item.vendorId));
      acc[item.vendorId] = { vendor, items: [], subtotal: 0 };
    }
    acc[item.vendorId].items.push(item);
    acc[item.vendorId].subtotal += item.price * item.quantity;
    return acc;
  }, {});
  const groups = Object.values(grouped);
  // Declared up here rather than after the empty-cart guard so the hook below
  // is unconditional: the early return on an empty cart would otherwise change
  // the hook count between renders.
  const canDeliver = groups.length > 0
    && groups.every((g) => g.vendor?.deliveryAvailable)
    && platformSettings.deliveryEnabled;

  /*
    Delivery also requires every vendor in the cart to offer it, so the initial
    value is seeded from canDeliver rather than from platformSettings alone.
    Reading only the platform setting meant the page could open on a Delivery
    choice that was simultaneously rendered selected *and* disabled, and "Place
    order" then failed on a selection the UI had already made.
  */
  const [fulfillment, setFulfillment] = useState(null);
  // `auth.user` is populated asynchronously after sign-in, so these must not be
  // read unguarded: a null profile used to throw while rendering the page.
  const [name, setName] = useState(user?.fullName || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [address, setAddress] = useState(user?.address || '');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (COD)');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [placing, setPlacing] = useState(false);
  // `placing` is read through the render closure, so two clicks in the same tick
  // both saw false and placed the order twice. A ref closes that window before
  // React has re-rendered with the new state.
  const placingRef = useRef(false);

  useEffect(() => {
    if (fulfillment === null) setFulfillment(canDeliver ? 'DELIVERY' : 'PICKUP');
    else if (fulfillment === 'DELIVERY' && !canDeliver) setFulfillment('PICKUP');
  }, [canDeliver, fulfillment]);

  if (cart.length === 0) {
    return (
      <div>
        <EmptyState
          icon={Package}
          title="Your cart is empty"
          description="Add something from a shop to start an order."
          action={<Button as={Link} to="/customer/shops">Browse shops</Button>}
        />
      </div>
    );
  }

  /*
    A cart can outlive the shop it points at: a vendor can be rejected,
    suspended or removed while items still sit in the cart. The old code read
    `g.vendor.deliveryAvailable` straight after this, which threw on a missing
    vendor and took the whole page down. Handle it explicitly instead.
  */
  const unavailableGroups = groups.filter((group) => !group.vendor);
  if (unavailableGroups.length > 0) {
    return (
      <div>
        <EmptyState
          icon={AlertTriangle}
          title="A shop in your cart is no longer available"
          description="One or more shops you ordered from are no longer open. Remove those items to continue."
          action={<Button as={Link} to="/customer/cart">Back to cart</Button>}
        />
      </div>
    );
  }

  /*
    There is no delivery fee and no discount in this app: the shop and the
    customer settle payment in chat. So the item sum is the whole total, summed
    the same way `placeOrder` does it, which keeps the quoted figure and the
    stored figure identical.
  */
  const total = groups.reduce((sum, group) => sum + group.subtotal, 0);

  const handlePlaceOrder = () => {
    if (placingRef.current) return;
    if (!user?.id) {
      showToast('Your profile is still loading. Please try again in a moment.', 'error');
      return;
    }
    if (groups.length === 0 || groups.some((group) => !group.vendor)) {
      showToast('Some shop information is no longer available. Please review your cart.', 'error');
      return;
    }
    if (fulfillment === 'DELIVERY' && !canDeliver) {
      showToast('Delivery is not available right now.', 'error');
      return;
    }
    // Name and mobile were the only fields the seller has to contact the
    // customer with, and neither was checked: an empty value was stored on the
    // order and rendered in the vendor's chat receipt.
    if (!name.trim()) {
      showToast('Please enter your name.', 'error');
      return;
    }
    if (!mobile) {
      showToast('Please enter your mobile number.', 'error');
      return;
    }
    if (!isValidMobile(mobile)) {
      showToast(mobileValidationMessage(), 'error');
      return;
    }
    if (fulfillment === 'DELIVERY' && !address.trim()) {
      showToast('Please enter a delivery address.', 'error');
      return;
    }
    const unavailableItem = groups.flatMap((group) => group.items.map((cartItem) => {
      const menuItem = (group.vendor.menu || []).find((item) => String(item.id) === String(cartItem.menuId));
      return !menuItem || !menuItem.available || (Number(menuItem.stock) || 0) < (Number(cartItem.quantity) || 0) ? cartItem.name : null;
    })).find(Boolean);
    if (unavailableItem) {
      showToast(`${unavailableItem} is no longer available in the requested quantity.`, 'error');
      return;
    }
    placingRef.current = true;
    setPlacing(true);
    try {
      // Place one order per vendor
      const orders = [];
      let firstChatId = null;
      groups.forEach(({ vendor, items }) => {
        const order = placeOrder({
          customer: { ...user, fullName: name, mobile, address },
          vendor,
          items,
          fulfillment,
          paymentMethod,
          specialInstructions,
        });
        if (!order) return;
        const chatId = sendChatOrderReceipt({ order });
        if (!firstChatId) firstChatId = chatId;
        orders.push(order);
      });
      if (orders.length === 0) {
        showToast('Unable to place the order. Please try again.', 'error');
        return;
      }
      clearCart();
      if (orders[0]?.id) {
        navigate(`/customer/messages?chatId=${encodeURIComponent(firstChatId)}&vendorId=${orders[0].vendorId}`);
      }
    } catch {
      // Without this the rejection escaped the click handler as an unhandled
      // promise and clearCart never ran, so a partially created batch left the
      // cart intact and retrying produced a duplicate of the first order.
      showToast('Something went wrong placing your order. Please try again.', 'error');
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  // pb-56 reserves room for the mobile Place Order bar: the nav height (56px plus
  // the bottom inset) plus ~88px of its own height. The inset appears in both the
  // bar's offset and this padding -- the old flat bottom-16 meant the bar tucked
  // under the nav on a device with a home indicator, and a flat pb-56 then left
  // the last summary row hidden behind it.
  return (
    <div className="pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="flex items-center gap-2 mb-5">
        <Link to="/customer/cart" aria-label="Back to cart" className="-ml-1 tap-target rounded-full text-muted hover:bg-surface-hover hover:text-ink">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Checkout</h1>
      </div>

      {/*
        Two columns on desktop: form on the left, order summary on the right.
        On mobile the summary falls below the form, which keeps the flow linear
        (details first, then review) instead of interleaving the two.
      */}
      <div className="lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8 lg:items-start">
        <div className="space-y-4">
          <CheckoutStep step={1} title="Your details">
            <Input label="Name" icon={User} value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Mobile number" icon={Phone} type="tel" inputMode="numeric" maxLength={MOBILE_LENGTH} value={mobile} onChange={(e) => setMobile(sanitizeMobile(e.target.value))} />
            {fulfillment === 'DELIVERY' && (
              <Input label="Delivery address" icon={MapPin} value={address} onChange={(e) => setAddress(e.target.value)} />
            )}
          </CheckoutStep>

          <CheckoutStep step={2} title="How you want it">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Fulfilment method">
              <ChoiceCard
                selected={fulfillment === 'DELIVERY'}
                disabled={!canDeliver}
                onClick={() => canDeliver && setFulfillment('DELIVERY')}
                icon={Truck}
                title="Delivery"
                description={canDeliver ? 'Discuss the details with the shop' : 'Unavailable'}
              />
              <ChoiceCard
                selected={fulfillment === 'PICKUP'}
                onClick={() => setFulfillment('PICKUP')}
                icon={Package}
                title="Pick-up"
                description="Collect at the shop"
              />
            </div>
          </CheckoutStep>

          <CheckoutStep step={3} title="Payment">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
              {[
                { value: 'Online Payment', label: 'Online payment', description: 'Pay digitally', icon: CreditCard },
                { value: 'Cash on Delivery (COD)', label: 'Cash on delivery', description: 'Pay when it arrives', icon: Banknote },
              ].map((option) => (
                <ChoiceCard
                  key={option.value}
                  selected={paymentMethod === option.value}
                  onClick={() => setPaymentMethod(option.value)}
                  icon={option.icon}
                  title={option.label}
                  description={option.description}
                />
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">
              Your payment choice is sent to the seller in the order receipt.
            </p>
            <Textarea
              label="Special instructions (optional)"
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="E.g. Please knock three times"
              className="mt-4"
            />
          </CheckoutStep>
        </div>

        {/* Sticky on desktop so the total stays visible while filling the form. */}
        <div className="mt-4 lg:mt-0 lg:sticky lg:top-20">
          <Card className="p-4">
            <h2 className="font-semibold text-ink mb-3">Order summary</h2>

            <div className="space-y-4">
              {groups.map(({ vendor, items, subtotal: groupSubtotal }) => (
                <div key={vendor.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <LogoMark name={vendor.name} logo={vendor.logo} size="xs" />
                    <span className="font-medium text-sm text-ink truncate">{vendor.name}</span>
                    <span className="ml-auto text-sm font-semibold text-ink tabular-nums">{formatPeso(groupSubtotal)}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((i) => (
                      <li key={i.cartId} className="flex justify-between gap-3 text-sm">
                        <span className="text-muted min-w-0">
                          <span className="font-medium text-body tabular-nums">{i.quantity}&times;</span> {i.name}
                        </span>
                        <span className="text-body tabular-nums shrink-0">{formatPeso(i.price * i.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/*
              No delivery fee and no discount exist in this app, so a
              "Subtotal" row would just repeat the Total. Per-shop amounts are
              listed above; payment is settled with the shop in chat.
            */}
            <div className="border-t border-hairline mt-4 pt-3 text-base font-bold text-ink">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="tabular-nums">{formatPeso(total)}</span>
              </div>
            </div>

            {/*
              The fixed bar below is `lg:hidden`, which meant desktop had no
              Place Order control at all -- checkout could not be completed on a
              laptop. The button lives in the sticky summary from `lg` up.
            */}
            <div className="hidden lg:block mt-4">
              <Button className="w-full" size="lg" onClick={handlePlaceOrder} loading={placing}>
                Place order
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/*
        The summary card already shows the total above on desktop, so the sticky
        bar is mobile-only. It stacks on the bottom nav: nav height is 56px plus the
        bottom inset, so the offset has to carry the inset as well -- a flat
        bottom-16 put this bar, and the Place Order button inside it, underneath the
        nav on any device with a home indicator.
      */}
      <div className="lg:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-white border-t border-hairline z-30 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-muted">Total</div>
            <div className="text-lg font-bold text-ink tabular-nums leading-tight">{formatPeso(total)}</div>
          </div>
          <Button className="shrink-0" size="lg" onClick={handlePlaceOrder} loading={placing}>
            Place order
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

// Numbered step. Gives the form a scannable order on a long single-column page.
function CheckoutStep({ step, title, children }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-6 h-6 rounded-full bg-ink text-white text-xs font-semibold flex items-center justify-center tabular-nums" aria-hidden="true">
          {step}
        </span>
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

/*
 * Selectable option with a real radio role, so the group is announced as a
 * single choice rather than as unrelated buttons.
 *
 * `radiogroup` implies arrow-key movement and a single tab stop, which a group
 * of buttons did not implement. Left arrow (forward in DOM order) and ArrowUp
 * are handled, since the two checkouts render these stacked on mobile and
 * right/ArrowDown would be ambiguous there.
 */
export function ChoiceCard({ selected, onClick, icon: Icon, title, description, disabled }) {
  const handleKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowUp') return;
    const group = event.currentTarget.closest('[role="radiogroup"]');
    if (!group) return;
    const options = Array.from(group.querySelectorAll('[role="radio"]:not(:disabled)'));
    const index = options.indexOf(event.currentTarget);
    if (index === -1) return;
    event.preventDefault();
    const next = options[(index + 1) % options.length];
    next.focus();
    next.click();
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`flex min-h-11 items-start gap-3 rounded-card border p-3 text-left transition-colors duration-150 ${
        selected
          ? 'border-brand bg-brand-soft'
          : 'border-hairline-strong bg-white hover:border-hairline-hover hover:bg-surface-sunken'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`flex w-9 h-9 shrink-0 items-center justify-center rounded-control ${selected ? 'bg-brand text-white' : 'bg-surface-hover text-muted'}`}>
        <Icon className="w-4.5 h-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted mt-0.5">{description}</span>
      </span>
    </button>
  );
}
