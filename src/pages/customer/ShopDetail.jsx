import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock3, Star, Minus, Plus, ShoppingCart, MessageSquare, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ProductCard from '@/components/ProductCard';
import { Card, Button, Textarea, MediaImage, isImageSource } from '@/components/UI';
import OrderQueueBoard, { ACTIVE_ORDER_STATUSES } from '@/components/OrderQueueBoard';
import FavoriteButton from '@/components/FavoriteButton';
import ShopComments from '@/components/ShopComments';
import AccountReportButton from '@/components/AccountReportButton';
import { FIELD_CHAR_LIMITS, characterLimitMessage, isWithinCharacterLimit } from '@/lib/textLimits';

function ShopProfileHeader({ shop }) {
  const image = isImageSource(shop.coverImage)
    ? shop.coverImage
    : isImageSource(shop.logo)
      ? shop.logo
      : '';
  const fallback = (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-950 via-[#28223a] to-[#19171f]">
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-4xl font-bold text-white/80 shadow-float">
        {shop.logo && !isImageSource(shop.logo) ? shop.logo : shop.name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );

  return (
    <section className="relative mt-2 min-h-[15rem] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1922] sm:min-h-[19rem]">
      <MediaImage
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fallback={fallback}
        eager
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">
          {shop.category || 'Local kitchen'}
        </p>
        <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
          {shop.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-white/75 sm:text-sm">
          <span className={`inline-flex items-center gap-1.5 ${
            shop.storeStatus === 'OPEN' ? 'text-emerald-300' : shop.storeStatus === 'BUSY' ? 'text-amber-200' : 'text-white/65'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              shop.storeStatus === 'OPEN' ? 'bg-emerald-400' : shop.storeStatus === 'BUSY' ? 'bg-amber-300' : 'bg-white/45'
            }`} />
            {shop.storeStatus === 'OPEN' ? 'Open now' : shop.storeStatus === 'BUSY' ? 'Busy' : 'Closed'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden="true" />
            {Number(shop.rating || 0).toFixed(1)}
            {Number(shop.ratingCount) > 0 && <span>({shop.ratingCount} ratings)</span>}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            ~{Math.max(5, (Number(shop.queue) || 0) * 5)} min
          </span>
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{shop.address || 'Location not set'}</span>
          </span>
        </div>
      </div>
    </section>
  );
}

export default function CustomerShopDetail() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { auth, vendors, orders, addToCart, cart, showToast, shopRatings } = useApp();
  const shop = vendors.find((v) => String(v.id) === String(shopId));
  const [activeCategory, setActiveCategory] = useState('all');
  const [qtys, setQtys] = useState({});
  const [notes, setNotes] = useState({});
  const [addingItem, setAddingItem] = useState(null);

  // Must be declared before the early return below, otherwise the hook count
  // changes between renders and React throws "Rendered more hooks than...".
  const shopMenuCategories = useMemo(() => {
    const cats = [{ id: 'all', name: 'All' }];
    (shop?.menu || []).forEach((m) => {
      const category = m.category?.trim();
      if (category && !cats.find((x) => x.id === category)) cats.push({ id: category, name: category });
    });
    return cats;
  }, [shop?.menu]);

  if (!shop) {
    return (
      <div>
        <Link to="/customer/shops" className="text-sm text-brand-strong flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> Back to shops</Link>
        <div className="text-center py-20 text-muted">Shop not found.</div>
      </div>
    );
  }

  const isOpen = shop.storeStatus === 'OPEN';
  const filteredMenu = (shop.menu || []).filter((m) => activeCategory === 'all' || m.category === activeCategory);
  const estWait = Math.max(5, shop.queue * 5);
  const cartForShop = cart.filter((c) => c.vendorId === shop.id);
  const cartCount = cartForShop.reduce((s, i) => s + i.quantity, 0);
  const shopOrders = orders.filter((order) => String(order.vendorId) === String(shop.id));
  const activeShopOrders = shopOrders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status));
  const myActiveOrderIds = activeShopOrders
    .filter((order) => String(order.customerId) === String(auth.user?.id))
    .map((order) => order.id);

  const handleQty = (id, delta) => {
    setQtys((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));
  };

  const handleAdd = (item) => {
    if (!isOpen || !item.available) return;
    setAddingItem(item.id);
    const qty = qtys[item.id] || 1;
    const note = notes[item.id] || '';
    if (!isWithinCharacterLimit(note, FIELD_CHAR_LIMITS.itemNote)) {
      showToast(characterLimitMessage(FIELD_CHAR_LIMITS.itemNote), 'error');
      setAddingItem(null);
      return;
    }
    setTimeout(() => {
      addToCart(shop, item, qty, note);
      setQtys((prev) => ({ ...prev, [item.id]: 1 }));
      setNotes((prev) => ({ ...prev, [item.id]: '' }));
      setAddingItem(null);
    }, 300);
  };

  // pb-40 reserves room for the fixed "View Cart" bar. That bar is the nav height
  // (56px + bottom inset) plus a 48px button, so the padding carries the inset too
  // -- otherwise the last ~34px of content stayed hidden behind the bar on a phone
  // with a home indicator even though the bar itself had moved up.
  return (
    <div className="mx-auto w-full max-w-5xl pb-[calc(10rem+env(safe-area-inset-bottom))]">
      {/*
        The cover hero is gone. It existed to be a backdrop for an overlaid shop
        name, but the identity block below already carries the logo and name on
        its own surface, so all it did was put a second, competing image at the
        top of every shop page. The controls that lived on the scrim move into a
        plain bar so nothing is lost with it.
      */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Link
          to="/customer/shops"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          All shops
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <AccountReportButton
            accountId={shop.ownerId || shop.id}
            accountType="vendor"
            accountName={shop.name}
          />
          <FavoriteButton type="shop" refId={shop.id} label={shop.name} />
        </div>
      </div>

      <ShopProfileHeader shop={shop} />

      <Card className="mt-3 p-4 sm:p-5">
        {shop.description && <p className="text-sm leading-6 text-white/70">{shop.description}</p>}
        <div className="mt-3 flex items-start gap-2 text-sm text-white/60">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
          <span className="break-words">{shop.address || 'Location not set'}</span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4 text-sm">
          <div>
            <dt className="text-xs text-white/45">In queue</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-white">{Number(shop.queue) || 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/45">Est. wait</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-white">{estWait} min</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-white/45">Hours</dt>
            <dd className="mt-1 truncate font-semibold text-white">{shop.operatingHours || 'Not set'}</dd>
          </div>
        </dl>
        <Button variant="outline" className="mt-4 w-full border-white/15 text-white hover:bg-white/[0.07]" onClick={() => navigate(`/customer/messages?vendorId=${shop.id}`)}>
          <MessageSquare className="h-4 w-4" /> Message seller
        </Button>
      </Card>

      {activeShopOrders.length > 0 && (
        <div className="mt-4">
          <OrderQueueBoard
            orders={activeShopOrders}
            highlightOrderIds={myActiveOrderIds}
            subtitle="See which customer numbers are preparing and ready."
            emptyMessage="No active orders right now."
          />
        </div>
      )}

      <div className="mt-6">
        <ShopComments
          vendorId={shop.id}
          role="customer"
          localRatings={shopRatings}
          rating={shop.rating}
          ratingCount={shop.ratingCount}
          hideWhenEmpty
        />
      </div>

      {/* Menu */}
      <div className="mt-6">
        <h2 className="font-bold text-ink mb-3">Menu</h2>
        {(shop.menu || []).length === 0 ? (
          <Card className="p-8 text-center text-muted text-sm">No menu items yet.</Card>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4 -mx-3 px-3 sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0">
              {shopMenuCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={activeCategory === c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`shrink-0 min-h-10 px-3 rounded-full text-sm font-medium border transition-colors duration-150 ${
                    activeCategory === c.id
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-body border-hairline-strong hover:border-hairline-hover hover:text-ink'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="-mx-3 overflow-x-auto px-3 pb-3 scrollbar-hide sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0">
              <div className="flex w-max gap-4">
                {filteredMenu.map((item) => {
                  const qty = qtys[item.id] || 1;
                  const soldOut = !item.available
                    || (item.stock != null && item.stock !== '' && Number.isFinite(Number(item.stock)) && Number(item.stock) <= 0);
                  const badge = soldOut
                    ? 'Unavailable'
                    : Number(item.stock) > 0 && Number(item.stock) < 6
                      ? `${item.stock} left`
                      : null;
                  return (
                    <ProductCard
                      key={item.id}
                      product={item}
                      shop={shop}
                      meta={item.category || item.description}
                      badge={!isOpen ? 'Shop closed' : badge}
                      dimmed={soldOut || !isOpen}
                    >
                      {!soldOut && isOpen ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Add a note (optional)"
                            aria-label={`Note for ${item.name}`}
                            value={notes[item.id] || ''}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            maxCharacters={FIELD_CHAR_LIMITS.itemNote}
                            maxLength={FIELD_CHAR_LIMITS.itemNote}
                            rows={1}
                            className="text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex shrink-0 items-center rounded-control border border-white/10 bg-black/20">
                              <button type="button" aria-label={`Decrease ${item.name} quantity`} onClick={() => handleQty(item.id, -1)} className="flex h-10 w-8 items-center justify-center rounded-l-control text-body transition-colors hover:bg-white/[0.06] hover:text-white">
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{qty}</span>
                              <button type="button" aria-label={`Increase ${item.name} quantity`} onClick={() => handleQty(item.id, 1)} className="flex h-10 w-8 items-center justify-center rounded-r-control text-body transition-colors hover:bg-white/[0.06] hover:text-white">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <Button className="min-w-0 flex-1 !px-3" aria-label={`Add ${item.name} to cart`} onClick={() => handleAdd(item)} loading={addingItem === item.id}>
                              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                              Add to cart
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="secondary" size="sm" full disabled>
                          Unavailable
                        </Button>
                      )}
                    </ProductCard>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Cart bar

          bottom-20 was a fixed 80px, but the bottom nav is h-14 *plus* a
          h-[env(safe-area-inset-bottom)] spacer, so its real height is
          56px + inset -- about 90px on a phone with a home indicator. The bar
          therefore sat underneath the nav on exactly the devices most likely to
          need the tap, hiding the View Cart CTA behind it. Offsetting by the
          inset as well as the nav keeps it stacked on top of the nav everywhere.
      */}
      {cartCount > 0 && (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 mx-auto max-w-5xl px-3 sm:px-4 lg:px-8">
          <Link
            to="/customer/cart"
            className="w-full bg-brand hover:bg-brand-strong text-white rounded-control px-4 py-3 min-h-12 flex items-center justify-between shadow-brand font-semibold"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              {cartCount} item{cartCount !== 1 ? 's' : ''} from this shop
            </span>
            <span>View cart &rarr;</span>
          </Link>
        </div>
      )}
    </div>
  );
}
