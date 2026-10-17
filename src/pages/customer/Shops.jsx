import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpDown,
  Check,
  Clock3,
  MapPin,
  Play,
  Search,
  SlidersHorizontal,
  Star,
  Truck,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import FavoriteButton from '@/components/FavoriteButton';
import { isImageSource, MediaImage } from '@/components/UI';
import { getShopBuyerStats, rankShopsByBuyers, rankShopsByRating } from '@/lib/shopPopularity';

const STATUS_FILTERS = [
  { id: 'all', label: 'All shops' },
  { id: 'OPEN', label: 'Open now' },
  { id: 'BUSY', label: 'Busy' },
  { id: 'CLOSED', label: 'Closed' },
];

export default function CustomerShops() {
  const { vendors, orders } = useApp();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [sortBy, setSortBy] = useState('recommended');

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  const approved = useMemo(() => vendors.filter((vendor) => vendor.status === 'approved'), [vendors]);

  const categories = useMemo(() => {
    const counts = new Map();
    approved.forEach((vendor) => {
      const name = (vendor.category || 'Uncategorized').trim();
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [approved]);

  const [category, setCategory] = useState('all');

  const filteredShops = useMemo(() => {
    const query = search.trim().toLowerCase();
    const shops = approved
      .filter((vendor) => statusFilter === 'all' || vendor.storeStatus === statusFilter)
      .filter((vendor) => !deliveryOnly || vendor.deliveryAvailable)
      .filter((vendor) => category === 'all' || (vendor.category || 'Uncategorized').trim() === category)
      .filter((vendor) => !query || vendor.name.toLowerCase().includes(query) || (vendor.category || '').toLowerCase().includes(query));

    if (sortBy === 'rating') shops.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    if (sortBy === 'name') shops.sort((a, b) => a.name.localeCompare(b.name));
    return shops;
  }, [approved, search, statusFilter, category, deliveryOnly, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = { all: approved.length, OPEN: 0, BUSY: 0, CLOSED: 0 };
    approved.forEach((vendor) => {
      if (counts[vendor.storeStatus] !== undefined) counts[vendor.storeStatus] += 1;
    });
    return counts;
  }, [approved]);

  const buyerStats = useMemo(() => {
    return getShopBuyerStats(orders);
  }, [orders]);

  const hasFilters = search.trim() !== '' || statusFilter !== 'all' || category !== 'all' || deliveryOnly;
  const activeFilterCount = Number(category !== 'all') + Number(statusFilter !== 'all') + Number(deliveryOnly);
  const bestSellingShops = rankShopsByBuyers(filteredShops, buyerStats);
  const topRatedShops = rankShopsByRating(filteredShops, buyerStats);
  const featuredShop = !hasFilters ? topRatedShops[0] || null : null;
  const openShops = filteredShops.filter((shop) => shop.storeStatus === 'OPEN');

  const clearAll = () => {
    setSearch('');
    setStatusFilter('all');
    setCategory('all');
    setDeliveryOnly(false);
    setSortBy('recommended');
  };

  return (
    <div className="-mx-3 -my-4 min-h-[calc(100dvh-8rem)] bg-[#101014] px-3 pb-12 pt-6 text-white sm:-mx-4 sm:-my-5 sm:px-5 sm:pt-8 lg:-mx-8 lg:-my-8 lg:px-8 lg:pt-10">
      <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Lancaster food guide
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Find your next favorite</h1>
          <p className="mt-1 text-sm text-white/55">Browse local kitchens, menus, and pickup options.</p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto sm:min-w-[23rem]">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
            <span className="sr-only">Search shops or cuisine</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shops or cuisine"
              className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-white/40 transition-colors focus:border-violet-400/70 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-violet-400/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <label className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-white/70 transition-colors hover:bg-white/[0.08]">
            <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Sort shops</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort shops"
              className="max-w-[6rem] cursor-pointer appearance-none bg-transparent pr-3 text-xs font-medium text-white outline-none"
            >
              <option className="text-ink" value="recommended">Recommended</option>
              <option className="text-ink" value="rating">Top rated</option>
              <option className="text-ink" value="name">Name A-Z</option>
            </select>
          </label>
        </div>
      </header>

      <section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4" aria-label="Shop filters">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
            <SlidersHorizontal className="h-4 w-4 text-violet-300" aria-hidden="true" />
            Refine shops
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500/20 px-1.5 text-[10px] font-bold text-violet-200">
                {activeFilterCount}
              </span>
            )}
          </div>
          {hasFilters && (
            <button type="button" onClick={clearAll} className="min-h-8 px-2 text-xs font-semibold text-violet-300 transition-colors hover:text-white">
              Clear filters
            </button>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="w-16 shrink-0 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">Cuisine</span>
            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-hide" aria-label="Shop categories">
              <FilterChip active={category === 'all'} onClick={() => setCategory('all')}>
                All <span className="text-white/45">{approved.length}</span>
              </FilterChip>
              {categories.map(([name, count]) => (
                <FilterChip key={name} active={category === name} onClick={() => setCategory(name)}>
                  {name} <span className="text-white/45">{count}</span>
                </FilterChip>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-3 border-t border-white/[0.07] pt-3">
            <span className="w-16 shrink-0 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">Availability</span>
            <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 scrollbar-hide" aria-label="Shop availability">
              {STATUS_FILTERS.map((status) => (
                <FilterChip key={status.id} active={statusFilter === status.id} onClick={() => setStatusFilter(status.id)}>
                  {status.label}
                  {status.id !== 'all' && <span className="text-white/45">{statusCounts[status.id]}</span>}
                </FilterChip>
              ))}
              <FilterChip active={deliveryOnly} onClick={() => setDeliveryOnly(!deliveryOnly)}>
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                Delivery
                {deliveryOnly && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </FilterChip>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-white/45" aria-live="polite">
        <span>
          {hasFilters ? 'Matching shops' : 'Local shops'} · {filteredShops.length}
        </span>
        {sortBy !== 'recommended' && (
          <span className="inline-flex items-center gap-1.5 text-white/55">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            {sortBy === 'rating' ? 'Top rated first' : 'Name A–Z'}
          </span>
        )}
      </div>

      {filteredShops.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-2xl" aria-hidden="true">🍽️</div>
          <h2 className="mt-4 text-lg font-bold text-white">No shops match</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-white/55">
            {hasFilters ? 'Try another search or clear the filters to explore all shops.' : 'Approved shops will show up here.'}
          </p>
          {hasFilters && <div className="mt-4"><ClearButton onClick={clearAll}>Clear filters</ClearButton></div>}
        </div>
      ) : (
        <>
          {hasFilters ? (
            <ShopRail title="Search results" subtitle={`${filteredShops.length} ${filteredShops.length === 1 ? 'shop' : 'shops'} to explore`} shops={filteredShops} />
          ) : (
            <>
              {featuredShop && <FeaturedShop shop={featuredShop} />}
              {openShops.length > 0 && <ShopRail title="Open now" subtitle="Ready when you are" shops={openShops} />}
              {bestSellingShops.length > 0 && (
                <ShopRail
                  title="Popular around you"
                  subtitle="Shops with the most local buyers"
                  shops={bestSellingShops.map(({ shop }) => shop)}
                  buyerStats={buyerStats}
                />
              )}
              {topRatedShops.length > 0 && <TopRatedFeature shops={topRatedShops} />}
              {categories.map(([name]) => {
                const shops = filteredShops.filter((shop) => (shop.category || 'Uncategorized').trim() === name);
                return shops.length > 0
                  ? <ShopRail key={name} title={name} subtitle={`${shops.length} ${shops.length === 1 ? 'local shop' : 'local shops'}`} shops={shops} />
                  : null;
              })}
            </>
          )}
        </>
      )}

      <div className="mt-10 border-t border-white/10 pt-4 text-xs text-white/40">
        Showing {filteredShops.length} of {approved.length} approved {approved.length === 1 ? 'shop' : 'shops'} in Lancaster
      </div>
    </div>
  );
}

function FeaturedShop({ shop }) {
  const artwork = getArtwork(shop);
  const wait = Math.max(5, (Number(shop.queue) || 0) * 5);

  return (
    <section className="relative mb-10 min-h-[21rem] overflow-hidden rounded-2xl border border-white/10 bg-[#1c1922] sm:min-h-[25rem]">
      <ShopArtwork shop={shop} artwork={artwork} className="absolute inset-0 opacity-65" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-black/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
      <div className="relative flex min-h-[21rem] max-w-2xl flex-col justify-end p-5 sm:min-h-[25rem] sm:p-9">
        <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-500/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Top rated shop
        </span>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">{shop.category || 'Local kitchen'}</p>
        <h2 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">{shop.name}</h2>
        {shop.description && <p className="mt-3 line-clamp-2 max-w-lg text-sm leading-6 text-white/75">{shop.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-white/75">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${shop.storeStatus === 'OPEN' ? 'bg-emerald-400' : 'bg-white/45'}`} />
            {shop.storeStatus === 'OPEN' ? 'Open now' : shop.storeStatus === 'BUSY' ? 'Busy' : 'Closed'}
          </span>
          <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden="true" /> {Number(shop.rating || 0).toFixed(1)}</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> ~{wait} min</span>
        </div>
        <Link
          to={`/customer/shops/${shop.id}`}
          className="mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-[#17151b] transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          Explore shop
          <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <span className="absolute right-3 top-3 sm:right-5 sm:top-5">
        <FavoriteButton type="shop" refId={shop.id} label={shop.name} />
      </span>
    </section>
  );
}

function ShopRail({ title, subtitle, shops, buyerStats }) {
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">{title}</h2>
          <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>
        </div>
        <span className="pb-0.5 text-xs font-medium text-white/40">{shops.length} places</span>
      </div>
      <div className="-mx-3 overflow-x-auto px-3 pb-3 scrollbar-hide sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <div className="flex w-max gap-3 sm:gap-4">
          {shops.map((shop) => (
            <ShopPoster
              key={shop.id}
              shop={shop}
              buyerCount={buyerStats?.get(String(shop.id))?.buyers}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TopRatedFeature({ shops }) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">Customer ratings</p>
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Top rated shops</h2>
        <p className="mt-1 text-xs text-white/45">Explore local shops with the highest ratings.</p>
      </div>
      <div className="-mx-3 overflow-x-auto px-3 pb-3 scrollbar-hide sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <div className="flex w-max gap-4">
          {shops.map((shop) => <RatedShopCard key={shop.id} shop={shop} />)}
        </div>
      </div>
    </section>
  );
}

function RatedShopCard({ shop }) {
  const artwork = getArtwork(shop);

  return (
    <Link
      to={`/customer/shops/${shop.id}`}
      className="group flex h-48 w-[min(88vw,34rem)] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#19171f] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 sm:h-56"
    >
      <div className="relative w-[38%] shrink-0 overflow-hidden bg-[#211e28]">
        <ShopArtwork shop={shop} artwork={artwork} className="absolute inset-0 transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15" />
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/35 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-200 backdrop-blur">
          <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden="true" />
          Top rated
        </span>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-3 pb-3">
          <span className="truncate text-[11px] font-medium text-white/80">{shop.category || 'Local kitchen'}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-white">
            <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden="true" />
            {Number(shop.rating).toFixed(1)}
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-bold text-white sm:text-base">{shop.name}</h3>
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-white/45 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-200" aria-hidden="true" />
        </div>
        <p className="mt-2 text-xs text-white/45">Explore this shop and browse its menu.</p>
      </div>
    </Link>
  );
}

function ShopPoster({ shop, buyerCount }) {
  const artwork = getArtwork(shop);
  const wait = Math.max(5, (Number(shop.queue) || 0) * 5);

  return (
    <Link
      to={`/customer/shops/${shop.id}`}
      className="group w-[13rem] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#19171f] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 sm:w-56"
    >
      <div className="relative aspect-[5/3] overflow-hidden bg-[#211e28]">
        <ShopArtwork shop={shop} artwork={artwork} className="absolute inset-0 transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />
        <div className="absolute left-2.5 top-2.5">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm ${
            shop.storeStatus === 'OPEN' ? 'bg-emerald-400/90 text-black' : shop.storeStatus === 'BUSY' ? 'bg-amber-300/90 text-black' : 'bg-black/55 text-white'
          }`}>
            {shop.storeStatus === 'OPEN' ? 'Open' : shop.storeStatus === 'BUSY' ? 'Busy' : 'Closed'}
          </span>
        </div>
        <span className="absolute right-1.5 top-1.5 z-10">
          <FavoriteButton type="shop" refId={shop.id} label={shop.name} className="!h-9 !min-h-9 !w-9 !min-w-9" />
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-bold text-white">{shop.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-white/45">{shop.category || 'Local kitchen'}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-white/75">
            {buyerCount > 0
              ? <>{buyerCount} <span className="hidden sm:inline">{buyerCount === 1 ? 'buyer' : 'buyers'}</span></>
              : <><Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden="true" /> {Number(shop.rating || 0).toFixed(1)}</>}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1 border-t border-white/[0.08] pt-2 text-[10px] text-white/45">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          Est. {wait} min
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-violet-200 transition-colors group-hover:text-white">View menu <ArrowRight className="h-3 w-3" aria-hidden="true" /></span>
        </div>
      </div>
    </Link>
  );
}

function getArtwork(shop) {
  const image = isImageSource(shop.coverImage)
    ? shop.coverImage
    : isImageSource(shop.logo)
      ? shop.logo
      : '';
  return {
    image,
    emoji: shop.logo && !isImageSource(shop.logo) ? shop.logo : '',
  };
}

function ShopArtwork({ shop, artwork, className = '' }) {
  const fallback = (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-950 via-[#28223a] to-[#19171f]">
      <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-white/[0.08] text-4xl font-bold text-white/80 shadow-float sm:h-24 sm:w-24">
        {artwork.emoji || shop.name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );

  return (
    <div className={`${className} overflow-hidden bg-[#211e28]`}>
      {artwork.image
        ? <MediaImage src={artwork.image} alt="" className="h-full w-full object-cover" fallback={fallback} />
        : fallback}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150 ${
        active
          ? 'border-violet-400 bg-violet-500 text-white'
          : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function ClearButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-400"
    >
      {children}
    </button>
  );
}
