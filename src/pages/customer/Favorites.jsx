import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Heart, Star } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, EmptyState, Badge, formatPeso, getProductImage, timeAgo, MediaImage, isImageSource } from '@/components/UI';
import FavoriteButton from '@/components/FavoriteButton';

/*
  Saved shops and dishes.

  The stored row is only (owner, kind, target), so nothing here is read from it
  but its identity -- a saved shop or dish has to be resolved against the live
  `vendors` list on every render. That is deliberate: a favourite is a bookmark to
  something that can change, and a copy of the old name and price frozen into the
  list would show a deleted dish, yesterday's price, and a photo that 404s.

  A row that no longer resolves is reported separately instead of being hidden.
  Silently dropping it is how a favourites list quietly empties itself and looks
  broken; saying "2 saved items are no longer available" is the truth and lets
  the customer clear them.
*/
export default function CustomerFavorites() {
  const { vendors, myFavorites, removeFavorite } = useApp();

  const { shops, dishes, missing } = useMemo(() => {
    const vendorById = new Map(vendors.map((vendor) => [String(vendor.id), vendor]));
    const foundShops = [];
    const foundDishes = [];
    const gone = [];

    myFavorites.forEach((favorite) => {
      const vendor = vendorById.get(String(favorite.vendorId ?? favorite.refId));
      if (favorite.type === 'shop') {
        const shop = vendorById.get(String(favorite.refId));
        if (shop) foundShops.push({ favorite, shop });
        else gone.push(favorite);
        return;
      }
      const dish = (vendor?.menu || []).find((item) => String(item.id) === String(favorite.refId));
      if (vendor && dish) foundDishes.push({ favorite, shop: vendor, dish });
      else gone.push(favorite);
    });

    return { shops: foundShops, dishes: foundDishes, missing: gone };
  }, [myFavorites, vendors]);

  const isEmpty = shops.length === 0 && dishes.length === 0 && missing.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Favorites</h1>
          <p className="text-sm text-muted mt-0.5">
            {myFavorites.length === 0
              ? 'Shops and dishes you save are kept here.'
              : `${shops.length} shop${shops.length === 1 ? '' : 's'} and ${dishes.length} dish${dishes.length === 1 ? '' : 'es'} saved.`}
          </p>
        </div>
      </div>

      {isEmpty && (
        <EmptyState
          icon={Heart}
          title="Nothing saved yet"
          description="Tap the heart on a shop or a dish and it will show up here."
          action={<Link to="/customer/shops" className="text-sm font-medium text-brand-strong hover:text-brand-deep">Browse shops</Link>}
        />
      )}

      {missing.length > 0 && (
        <Card className="p-4 mb-5 border-hairline-strong">
          <div className="flex items-start gap-3">
            <Badge color="orange">{missing.length} unavailable</Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-body">
                {missing.length === 1 ? 'One saved item is' : `${missing.length} saved items are`} no longer available.
                It may have been removed by the shop.
              </p>
              <button
                type="button"
                onClick={() => missing.forEach(removeFavorite)}
                className="mt-2 text-sm font-medium text-danger hover:underline"
              >
                Clear {missing.length === 1 ? 'it' : 'them'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {shops.length > 0 && (
        <section className="mb-6">
          <h2 className="font-bold text-ink mb-3">Shops</h2>
          <div className="-mx-3 overflow-x-auto px-3 pb-3 scrollbar-hide sm:-mx-4 sm:px-4 lg:-mx-8 lg:px-8">
            <div className="flex w-max gap-4">
              {shops.map(({ favorite, shop }) => (
                <SavedShopCard key={`shop-${favorite.refId}`} shop={shop} favorite={favorite} />
              ))}
            </div>
          </div>
        </section>
      )}

      {dishes.length > 0 && (
        <section>
          <h2 className="font-bold text-ink mb-3">Dishes</h2>
          <div className="-mx-3 overflow-x-auto px-3 pb-3 scrollbar-hide sm:-mx-4 sm:px-4 lg:-mx-8 lg:px-8">
            <div className="flex w-max gap-4">
            {dishes.map(({ favorite, shop, dish }) => (
              <SavedDishCard key={`product-${favorite.refId}`} dish={dish} shop={shop} favorite={favorite} />
            ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SavedShopCard({ shop, favorite }) {
  const artwork = isImageSource(shop.coverImage)
    ? shop.coverImage
    : isImageSource(shop.logo)
      ? shop.logo
      : '';
  const mark = shop.logo && !isImageSource(shop.logo)
    ? shop.logo
    : shop.name.trim().charAt(0).toUpperCase();

  return (
    <Card className="group w-[11.5rem] shrink-0 overflow-hidden border-white/10 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-violet-300/40 sm:w-52">
      <Link
        to={`/customer/shops/${shop.id}`}
        aria-label={`${shop.name}${shop.category ? `, ${shop.category}` : ''}`}
        className="relative block aspect-[4/5] overflow-hidden bg-surface-hover focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-300"
      >
        {artwork ? (
          <MediaImage
            src={artwork}
            alt={`${shop.name} shop`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={<ShopTileFallback mark={mark} />}
          />
        ) : (
          <ShopTileFallback mark={mark} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />
        <span className="absolute left-2.5 top-2.5">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            shop.storeStatus === 'OPEN' ? 'bg-emerald-400/90 text-black' : shop.storeStatus === 'BUSY' ? 'bg-amber-300/90 text-black' : 'bg-black/55 text-white'
          }`}>
            {shop.storeStatus === 'OPEN' ? 'Open' : shop.storeStatus === 'BUSY' ? 'Busy' : 'Closed'}
          </span>
        </span>
        <span className="absolute right-1.5 top-1.5">
          <FavoriteButton type="shop" refId={shop.id} label={shop.name} className="!h-9 !min-h-9 !w-9 !min-w-9" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-base font-bold leading-tight text-white">{shop.name}</h3>
          <p className="mt-1 truncate text-xs text-white/60">{shop.category || 'Local kitchen'}</p>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2 text-[11px] text-white/75">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden="true" />
              {Number(shop.rating || 0).toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1 truncate">
              <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
              Saved {timeAgo(favorite.createdAt)}
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}

function ShopTileFallback({ mark }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-hover">
      <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] text-4xl font-bold text-white/75">
        {mark}
      </span>
    </div>
  );
}

/*
  Dish tile placeholder, for both "no image" and "image would not load", so the
  two cases cannot disagree about what an empty tile looks like.
*/
function DishTileFallback({ dish }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-4xl" aria-hidden="true">
      {dish.image && dish.image.length <= 4 ? dish.image : '🍽️'}
    </div>
  );
}

function SavedDishCard({ dish, shop, favorite }) {
  const photo = getProductImage(dish.image);
  return (
    <Card className="group w-[11.5rem] shrink-0 overflow-hidden border-white/10 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-violet-300/40 sm:w-52">
      <Link
        to={`/customer/shops/${shop.id}`}
        aria-label={`${dish.name} from ${shop.name}`}
        className="relative block aspect-[4/5] overflow-hidden bg-surface-hover focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-300"
      >
        {photo ? (
          <MediaImage
            src={photo}
            alt={dish.name}
            className="absolute inset-0 block h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={<div className="absolute inset-0"><DishTileFallback dish={dish} /></div>}
          />
        ) : (
          <div className="absolute inset-0"><DishTileFallback dish={dish} /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />
        <span className="absolute right-1.5 top-1.5">
          <FavoriteButton type="product" refId={dish.id} vendorId={shop.id} label={dish.name} className="!h-9 !min-h-9 !w-9 !min-w-9" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-tight text-white sm:text-base">{dish.name}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-white/65">{shop.name}</p>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2">
            <span className="text-sm font-bold tabular-nums text-white sm:text-base">{formatPeso(dish.price)}</span>
            <span className="truncate text-right text-[10px] text-white/60">Saved {timeAgo(favorite.createdAt)}</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
