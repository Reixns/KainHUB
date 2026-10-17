import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, Search, Utensils, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import FavoriteButton from '@/components/FavoriteButton';
import { formatPeso, getProductImage, MediaImage } from '@/components/UI';

export default function CustomerFoods() {
  const { vendors } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState('recommended');

  const products = useMemo(
    () => vendors
      .filter((shop) => shop.status === 'approved')
      .flatMap((shop) => (shop.menu || []).map((item) => ({ ...item, shop }))),
    [vendors],
  );

  const categories = useMemo(() => {
    const counts = new Map();
    products.forEach((product) => {
      const name = product.category?.trim() || 'Uncategorized';
      const key = normalizeText(name);
      const current = counts.get(key);
      counts.set(key, { name: current?.name || name, count: (current?.count || 0) + 1 });
    });
    return [...counts.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(search);
    const result = products.filter((product) => {
      const productCategory = product.category?.trim() || 'Uncategorized';
      const inCategory = !category || normalizeText(productCategory) === category;
      const inSearch = !query || [
        product.name,
        product.category,
        product.shop.name,
        product.shop.category,
        product.description,
      ].some((value) => normalizeText(value).includes(query));
      const available = isAvailable(product);
      return inCategory && inSearch && (!availableOnly || available);
    });

    if (sortBy === 'price-low') result.sort((a, b) => getPrice(a) - getPrice(b));
    if (sortBy === 'price-high') result.sort((a, b) => getPrice(b) - getPrice(a));
    if (sortBy === 'name') result.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
    return result;
  }, [products, search, category, availableOnly, sortBy]);

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setAvailableOnly(false);
    setSortBy('recommended');
  };
  const hasFilters = Boolean(search.trim()) || Boolean(category) || availableOnly;
  const hasActiveOptions = hasFilters || sortBy !== 'recommended';

  return (
    <div className="-mx-3 -my-4 min-h-[calc(100dvh-8rem)] bg-[#101014] px-3 pb-12 pt-6 text-white sm:-mx-4 sm:-my-5 sm:px-5 sm:pt-8 lg:-mx-8 lg:-my-8 lg:px-8 lg:pt-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300">
            <Utensils className="h-3.5 w-3.5" aria-hidden="true" />
            Lancaster food guide
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Explore foods</h1>
          <p className="mt-1 text-sm text-white/55">Discover dishes and favorites from local shops.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:min-w-[23rem]">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
            <span className="sr-only">Search foods or shops</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search foods or shops"
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
            <span className="sr-only">Sort foods</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort foods"
              className="max-w-[7rem] cursor-pointer appearance-none bg-transparent pr-3 text-xs font-medium text-white outline-none"
            >
              <option className="text-ink" value="recommended">Recommended</option>
              <option className="text-ink" value="price-low">Price: low to high</option>
              <option className="text-ink" value="price-high">Price: high to low</option>
              <option className="text-ink" value="name">Name A-Z</option>
            </select>
          </label>
        </div>
      </header>

      <section className="mb-6" aria-label="Browse food categories">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">Browse by category</h2>
            <p className="mt-0.5 text-xs text-white/45">Pick a category to find what you’re craving.</p>
          </div>
          {category !== '' && (
            <button type="button" onClick={() => setCategory('')} className="min-h-8 px-2 text-xs font-semibold text-violet-300 transition-colors hover:text-white">
              Show all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          <CategoryCard
            name="All foods"
            count={products.length}
            active={!category}
            onClick={() => setCategory('')}
          />
          {categories.map(({ key, name, count }) => (
            <CategoryCard
              key={key}
              name={name}
              count={count}
              active={category === key}
              onClick={() => setCategory(key)}
            />
          ))}
        </div>
      </section>

      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 sm:px-4" aria-label="Food filters">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-medium text-white/70">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(event) => setAvailableOnly(event.target.checked)}
            className="h-4 w-4 accent-violet-400"
          />
          Available from open shops
        </label>
        {hasActiveOptions && (
          <button type="button" onClick={clearFilters} className="min-h-9 rounded-lg px-3 text-xs font-semibold text-violet-300 transition-colors hover:bg-white/[0.06] hover:text-white">
            Clear all
          </button>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45" aria-live="polite">
        <span>{hasFilters ? 'Matching foods' : 'All shop foods'} · {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}</span>
        {sortBy !== 'recommended' && (
          <span className="text-white/55">Sorted by {sortBy === 'name' ? 'name' : sortBy === 'price-low' ? 'lowest price' : 'highest price'}</span>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200">
            <Utensils className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">{products.length === 0 ? 'No foods available yet' : 'No foods found'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-white/55">
            {products.length === 0
              ? 'Menu items from approved shops will appear here.'
              : 'Try another search or clear your filters to see more foods.'}
          </p>
          {hasActiveOptions && <button type="button" onClick={clearFilters} className="mt-4 min-h-10 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400">Clear all</button>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.map((product) => (
            <FoodCard key={`${product.shop.id}-${product.id}`} product={product} />
          ))}
        </div>
      )}
      <div className="mt-10 border-t border-white/10 pt-4 text-xs text-white/40">
        Showing {filteredProducts.length} of {products.length} foods from approved local shops
      </div>
    </div>
  );
}

function FoodCard({ product }) {
  const soldOut = !isAvailable(product);
  const image = getProductImage(product.image);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] transition-colors hover:border-violet-300/30 hover:bg-white/[0.065]">
      <Link to={`/customer/shops/${product.shop.id}`} className="block focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-violet-300">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#211e28]">
          <MediaImage
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            fallback={<Utensils className="h-8 w-8 text-violet-200/50" aria-hidden="true" />}
          />
          <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold ${soldOut ? 'bg-black/65 text-white/75' : 'bg-emerald-400/95 text-[#102016]'}`}>
            {soldOut ? getAvailabilityLabel(product) : 'Available'}
          </span>
        </div>
        <div className="p-3">
          <h2 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-white">{product.name || 'Untitled food'}</h2>
          <p className="mt-0.5 truncate text-xs text-white/50">{product.shop.name}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm font-extrabold tabular-nums text-violet-200">{formatPeso(product.price)}</span>
            <span className="max-w-[50%] truncate rounded-full bg-white/[0.07] px-2 py-1 text-[10px] text-white/55">{product.category?.trim() || 'Uncategorized'}</span>
          </div>
        </div>
      </Link>
      <span className="absolute right-2 top-2">
        <FavoriteButton type="product" refId={product.id} vendorId={product.shop.id} label={product.name} />
      </span>
    </article>
  );
}

function CategoryCard({ name, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[4.5rem] items-center gap-2.5 rounded-xl border p-3 text-left transition-colors sm:min-h-16 sm:gap-3 sm:px-4 ${
        active
          ? 'border-violet-300/40 bg-violet-500/20 text-white'
          : 'border-white/10 bg-white/[0.035] text-white/75 hover:border-violet-300/25 hover:bg-white/[0.07]'
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-violet-400/20 text-violet-200' : 'bg-white/[0.07] text-white/55'}`}>
        <Utensils className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold sm:text-sm">{name}</span>
        <span className="mt-0.5 block text-[10px] text-white/45">{count} {count === 1 ? 'food' : 'foods'}</span>
      </span>
    </button>
  );
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

function getPrice(product) {
  const price = Number(product.price);
  return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
}

function isAvailable(product) {
  const stock = Number(product.stock);
  const hasNoStock = product.stock !== null && product.stock !== undefined && product.stock !== '' && Number.isFinite(stock) && stock <= 0;
  return Boolean(product.available) && !hasNoStock && product.shop.storeStatus === 'OPEN';
}

function getAvailabilityLabel(product) {
  if (product.shop.storeStatus === 'BUSY') return 'Shop busy';
  if (product.shop.storeStatus !== 'OPEN') return 'Shop closed';
  return 'Unavailable';
}
