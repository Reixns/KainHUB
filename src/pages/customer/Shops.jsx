import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  Clock3,
  MapPin,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import FavoriteButton from '@/components/FavoriteButton';
import { isImageSource, MediaImage, PageHeader, SortSelect } from '@/components/UI';
import { rankShopsByRating } from '@/lib/shopPopularity';

const STATUS_FILTERS = [
  { id: 'all', label: 'All shops' },
  { id: 'OPEN', label: 'Open now' },
  { id: 'BUSY', label: 'Busy' },
  { id: 'CLOSED', label: 'Closed' },
];

export default function CustomerShops() {
  const { vendors } = useApp();
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

  const hasFilters = search.trim() !== '' || statusFilter !== 'all' || category !== 'all' || deliveryOnly;
  const hasActiveOptions = hasFilters || sortBy !== 'recommended';
  const activeFilterSummary = [
    search.trim() ? `Search: ${search.trim()}` : '',
    category !== 'all' ? category : '',
    statusFilter !== 'all' ? STATUS_FILTERS.find((item) => item.id === statusFilter)?.label : '',
    deliveryOnly ? 'Delivery' : '',
  ].filter(Boolean).join(' · ');
  const topRatedShops = rankShopsByRating(filteredShops, new Map());
  const featuredShop = !hasActiveOptions ? topRatedShops[0] || null : null;

  const clearAll = () => {
    setSearch('');
    setStatusFilter('all');
    setCategory('all');
    setDeliveryOnly(false);
    setSortBy('recommended');
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const q = search.trim();
    if (q) {
      setSearch(q);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="Lancaster food guide"
        icon={MapPin}
        title="Find your next favorite"
        description="Browse local kitchens, menus, and pickup options."
        actions={(
          <form onSubmit={submitSearch} role="search" className="relative w-full sm:w-80">
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
          </form>
        )}
      />

      <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3" aria-label="Shop filters">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <label className="relative block min-w-0">
            <span className="sr-only">Filter by cuisine</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by cuisine"
              style={{ colorScheme: 'dark' }}
              className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-white/[0.05] py-2 pl-3 pr-8 text-xs font-medium text-white outline-none transition-colors hover:border-white/25 focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/20 sm:w-48"
            >
              <option value="all" className="bg-[#19191f] text-white">All cuisines ({approved.length})</option>
              {categories.map(([name, count]) => (
                <option key={name} value={name} className="bg-[#19191f] text-white">{name} ({count})</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" aria-hidden="true" />
          </label>

          <label className="relative block min-w-0">
            <span className="sr-only">Filter by shop availability</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by shop availability"
              style={{ colorScheme: 'dark' }}
              className="h-10 w-full appearance-none rounded-lg border border-white/10 bg-white/[0.05] py-2 pl-3 pr-8 text-xs font-medium text-white outline-none transition-colors hover:border-white/25 focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/20 sm:w-40"
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status.id} value={status.id} className="bg-[#19191f] text-white">
                  {status.label} ({statusCounts[status.id]})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" aria-hidden="true" />
          </label>

          <SortSelect
            label="Sort shops"
            value={sortBy}
            onChange={setSortBy}
            compact
            className="w-full justify-between sm:w-auto"
            options={[
              { value: 'recommended', label: 'Recommended' },
              { value: 'rating', label: 'Top rated' },
              { value: 'name', label: 'Name A–Z' },
            ]}
          />

          <label className="col-span-2 flex min-h-9 w-fit cursor-pointer items-center gap-2 rounded-lg px-1 text-xs font-medium text-white/65 transition-colors hover:text-white sm:col-span-1">
            <input
              type="checkbox"
              checked={deliveryOnly}
              onChange={(event) => setDeliveryOnly(event.target.checked)}
              className="h-4 w-4 accent-violet-400"
            />
            Delivery
          </label>
        </div>
        {hasActiveOptions && (
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
            {activeFilterSummary && <p className="min-w-0 truncate text-[11px] text-white/45">{activeFilterSummary}</p>}
            <button type="button" onClick={clearAll} className="min-h-8 shrink-0 rounded-md px-2 text-[11px] font-semibold text-violet-300 transition-colors hover:bg-white/[0.06] hover:text-white">
              Clear
            </button>
          </div>
        )}
      </section>

      <div className="mb-4 flex items-center justify-between gap-3 text-xs text-white/45" aria-live="polite">
        <span>
          {hasActiveOptions ? 'Matching shops' : 'All local shops'} · {filteredShops.length}
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
            {hasActiveOptions ? 'Try another search or clear the filters to explore all shops.' : 'Approved shops will show up here.'}
          </p>
          {hasActiveOptions && <div className="mt-4"><ClearButton onClick={clearAll}>Clear filters</ClearButton></div>}
        </div>
      ) : (
        <>
          {featuredShop && <FeaturedShop shop={featuredShop} />}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredShops.map((shop) => <ShopGridCard key={shop.id} shop={shop} />)}
          </div>
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
    <section className="relative mb-5 h-36 overflow-hidden rounded-2xl border border-violet-300/20 bg-[#1c1922] sm:h-40">
      <ShopArtwork shop={shop} artwork={artwork} className="absolute inset-0 opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15" />
      <div className="relative flex h-full max-w-2xl flex-col justify-center px-4 py-3 pr-16 sm:px-6">
        <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-violet-500/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white">
          <Star className="h-3 w-3 fill-current" aria-hidden="true" />
          Top rated
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">{shop.category || 'Local kitchen'}</p>
        <h2 className="mt-0.5 truncate text-xl font-extrabold leading-tight text-white sm:text-2xl">{shop.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-white/75">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-hidden="true" />
            {Number(shop.rating || 0).toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${shop.storeStatus === 'OPEN' ? 'bg-emerald-400' : shop.storeStatus === 'BUSY' ? 'bg-amber-300' : 'bg-white/45'}`} />
            {shop.storeStatus === 'OPEN' ? 'Open' : shop.storeStatus === 'BUSY' ? 'Busy' : 'Closed'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" aria-hidden="true" />
            ~{wait} min
          </span>
        </div>
      </div>
      <Link
        to={`/customer/shops/${shop.id}`}
        aria-label={`Explore ${shop.name}`}
        className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 sm:bottom-4 sm:right-4"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <span className="absolute right-3 top-3 sm:right-4 sm:top-4">
        <FavoriteButton type="shop" refId={shop.id} label={shop.name} className="!h-9 !min-h-9 !w-9 !min-w-9" />
      </span>
    </section>
  );
}

function ShopGridCard({ shop }) {
  const artwork = getArtwork(shop);
  const wait = Math.max(5, (Number(shop.queue) || 0) * 5);

  return (
    <Link
      to={`/customer/shops/${shop.id}`}
      aria-label={`${shop.name}${shop.category ? `, ${shop.category}` : ''}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#19171f] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-violet-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#211e28]">
        <ShopArtwork shop={shop} artwork={artwork} className="absolute inset-0 transition-transform duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />
        <span className={`absolute left-2.5 top-2.5 z-10 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm ${
            shop.storeStatus === 'OPEN' ? 'bg-emerald-400/90 text-black' : shop.storeStatus === 'BUSY' ? 'bg-amber-300/90 text-black' : 'bg-black/55 text-white'
          }`}>
          {shop.storeStatus === 'OPEN' ? 'Open' : shop.storeStatus === 'BUSY' ? 'Busy' : 'Closed'}
        </span>
        <span className="absolute right-1.5 top-1.5 z-10">
          <FavoriteButton type="shop" refId={shop.id} label={shop.name} className="!h-9 !min-h-9 !w-9 !min-w-9" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-tight text-white">{shop.name}</h3>
          <p className="mt-1 truncate text-xs text-white/60">{shop.category || 'Local kitchen'}</p>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2 text-[10px] text-white/75">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Star className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" aria-hidden="true" />
              {Number(shop.rating || 0).toFixed(1)}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{shop.address || `~${wait} min`}</span>
            </span>
          </div>
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
      <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] text-3xl font-bold text-white/80 shadow-float sm:h-20 sm:w-20 sm:text-4xl">
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
