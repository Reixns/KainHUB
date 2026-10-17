import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Minus, Plus, ShoppingCart, MessageSquare } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, Button, formatPeso, Textarea, StatusBadge, getProductImage, LogoMark, MediaImage } from '@/components/UI';
import FavoriteButton from '@/components/FavoriteButton';

export default function CustomerShopDetail() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { vendors, addToCart, cart } = useApp();
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

  const handleQty = (id, delta) => {
    setQtys((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));
  };

  const handleAdd = (item) => {
    if (!isOpen || !item.available) return;
    setAddingItem(item.id);
    const qty = qtys[item.id] || 1;
    const note = notes[item.id] || '';
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
    <div className="pb-[calc(10rem+env(safe-area-inset-bottom))]">
      {/*
        The cover hero is gone. It existed to be a backdrop for an overlaid shop
        name, but the identity block below already carries the logo and name on
        its own surface, so all it did was put a second, competing image at the
        top of every shop page. The controls that lived on the scrim move into a
        plain bar so nothing is lost with it.
      */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <Link
          to="/customer/shops"
          aria-label="Back to all shops"
          className="tap-target rounded-full bg-white border border-hairline text-ink hover:bg-surface-hover"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <FavoriteButton type="shop" refId={shop.id} label={shop.name} />
          <StatusBadge status={shop.storeStatus} />
        </div>
      </div>

      {/* Shop identity, now the top of the page and the only image on it. The logo
          goes to `xl`: with the cover gone there is nothing competing for the
          top of the page, and at `md` it read as an avatar beside a title rather
          than as the shop's face. */}
      <div className="px-4 pt-4">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <LogoMark name={shop.name} logo={shop.logo} size="xl" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-ink tracking-tight leading-snug">{shop.name}</h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted flex-wrap">
                <span className="truncate">{shop.category}</span>
                <span aria-hidden="true" className="text-hairline-strong">&middot;</span>
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-rating fill-rating" aria-hidden="true" />
                  <span className="font-medium text-body">{Number(shop.rating || 0).toFixed(1)}</span>
                  <span className="text-xs text-muted">
                    {Number(shop.ratingCount) > 0
                      ? `(${shop.ratingCount} ${shop.ratingCount === 1 ? 'rating' : 'ratings'})`
                      : '(no ratings yet)'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {shop.description && (
            <p className="text-sm text-body mt-3">{shop.description}</p>
          )}

          {/* Queue facts: the two numbers a customer checks before ordering.
              Left-aligned in a hairline-divided row rather than centred. */}
          <dl className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-hairline text-sm">
            <div>
              <dt className="text-xs text-muted">In queue</dt>
              <dd className="font-semibold text-ink text-lg tabular-nums mt-0.5">{shop.queue}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Est. wait</dt>
              <dd className="font-semibold text-ink text-lg tabular-nums mt-0.5">{estWait}m</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Hours</dt>
              <dd className="font-medium text-ink mt-1 truncate">{shop.operatingHours}</dd>
            </div>
          </dl>

          <Button variant="outline" className="w-full mt-4" onClick={() => navigate(`/customer/messages?vendorId=${shop.id}`)}>
            <MessageSquare className="w-4 h-4" /> Message seller
          </Button>
        </Card>
      </div>

      {/* Menu */}
      <div className="px-4 mt-6">
        <h2 className="font-bold text-ink mb-3">Menu</h2>
        {(shop.menu || []).length === 0 ? (
          <Card className="p-8 text-center text-muted text-sm">No menu items yet.</Card>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4 -mx-4 px-4">
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

            <div className="-mx-4 overflow-x-auto px-4 pb-3 scrollbar-hide">
              <div className="flex w-max gap-4">
                {filteredMenu.map((item) => {
                  const qty = qtys[item.id] || 1;
                  const photo = getProductImage(item.image);
                  const soldOut = !item.available || item.stock === 0;
                  return (
                    <Card key={item.id} className="group flex w-[11.5rem] shrink-0 flex-col overflow-hidden border-white/10 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-violet-300/40 sm:w-52">
                      <div className="relative aspect-[4/5] overflow-hidden bg-surface-hover">
                        <MediaImage
                          src={photo}
                          alt={item.name}
                          className={`absolute inset-0 block h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${soldOut ? 'opacity-45 grayscale' : ''}`}
                          fallback={(
                            <div className={`absolute inset-0 flex h-full w-full items-center justify-center text-4xl ${soldOut ? 'opacity-50' : ''}`} aria-hidden="true">
                              {item.image && item.image.length <= 4 ? item.image : '🍽️'}
                            </div>
                          )}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />
                        <span className="absolute right-1.5 top-1.5">
                          <FavoriteButton type="product" refId={item.id} vendorId={shop.id} label={item.name} className="!h-9 !min-h-9 !w-9 !min-w-9" />
                        </span>
                        {soldOut ? (
                          <span className="absolute left-2.5 top-2.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                            Sold out
                          </span>
                        ) : item.stock > 0 && item.stock < 6 ? (
                          <span className="absolute left-2.5 top-2.5 rounded-full bg-violet-500/90 px-2.5 py-1 text-[10px] font-bold text-white">
                            {item.stock} left
                          </span>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 p-3">
                          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-tight text-white sm:text-base">{item.name}</h3>
                          <p className="mt-1 line-clamp-1 text-xs text-white/60">
                            {item.category || item.description || <span aria-hidden="true">&nbsp;</span>}
                          </p>
                          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2">
                            <span className="text-sm font-bold tabular-nums text-white sm:text-base">{formatPeso(item.price)}</span>
                            {!soldOut && !isOpen && <span className="text-[10px] font-medium text-white/65">Shop closed</span>}
                          </div>
                        </div>
                      </div>

                      {!soldOut && isOpen && (
                        <div className="space-y-2 p-3">
                          <Textarea
                            placeholder="Add a note (optional)"
                            aria-label={`Note for ${item.name}`}
                            value={notes[item.id] || ''}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
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
                              Add
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
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
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 px-4 z-30 max-w-4xl mx-auto">
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
