import { useMemo, useState } from 'react';
import { Search, ShoppingCart, Utensils, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import ProductCard from '@/components/ProductCard';
import { Button, PageHeader, SortSelect } from '@/components/UI';

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
  const activeFilterSummary = [
    search.trim() ? `Search: ${search.trim()}` : '',
    category ? categories.find((item) => item.key === category)?.name : '',
    availableOnly ? 'Available now' : '',
  ].filter(Boolean).join(' · ');
  const filteredShopCount = new Set(filteredProducts.map((product) => product.shop.id)).size;

  return (
    <div className="w-full">
      <PageHeader
        eyebrow="Lancaster food guide"
        icon={Utensils}
        title="Explore foods"
        description="Discover dishes and favorites from local shops."
        actions={(
          <label className="relative w-full sm:w-80">
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
        )}
      />

      <section className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3" aria-label="Food filters">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
          <FilterChip active={!category} onClick={() => setCategory('')} label="All foods" count={products.length} />
          {categories.map(({ key, name, count }) => (
            <FilterChip key={key} active={category === key} onClick={() => setCategory(key)} label={name} count={count} />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <SortSelect
            label="Sort foods"
            value={sortBy}
            onChange={setSortBy}
            compact
            className="w-full justify-between sm:w-auto"
            options={[
              { value: 'recommended', label: 'Recommended' },
              { value: 'price-low', label: 'Price: low to high' },
              { value: 'price-high', label: 'Price: high to low' },
              { value: 'name', label: 'Name A–Z' },
            ]}
          />

          <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-1 text-xs font-medium text-white/65 transition-colors hover:text-white">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) => setAvailableOnly(event.target.checked)}
              className="h-4 w-4 accent-violet-400"
            />
            Available now
          </label>

          {hasActiveOptions && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto min-h-9 rounded-lg px-3 text-xs font-semibold text-violet-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {activeFilterSummary && (
          <p className="mt-2 truncate border-t border-white/10 pt-2 text-[11px] text-white/45">{activeFilterSummary}</p>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45" aria-live="polite">
        <span>
          {hasFilters ? 'Matching foods' : 'All shop foods'} · {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
        </span>
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
          {hasActiveOptions && (
            <button type="button" onClick={clearFilters} className="mt-4 min-h-10 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400">
              Clear all
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.map((product) => (
            <FoodCard key={`${product.shop.id}-${product.id}`} product={product} />
          ))}
        </div>
      )}

      <div className="mt-10 border-t border-white/10 pt-4 text-xs text-white/40">
        Showing {filteredProducts.length} of {products.length} foods from {filteredShopCount} {filteredShopCount === 1 ? 'shop' : 'shops'}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 ${
        active
          ? 'border-violet-300/60 bg-violet-500/20 text-white'
          : 'border-white/10 bg-white/[0.04] text-white/60 hover:border-white/25 hover:text-white'
      }`}
    >
      {label}
      <span className="text-[10px] font-bold tabular-nums opacity-60">{count}</span>
    </button>
  );
}

function FoodCard({ product }) {
  const { addToCart } = useApp();
  const soldOut = !isAvailable(product);

  return (
    <ProductCard
      product={product}
      shop={product.shop}
      meta={product.category?.trim() || 'Uncategorized'}
      badge={soldOut ? getAvailabilityLabel(product) : 'Available'}
      dimmed={soldOut}
      fullWidth
    >
      <Button
        variant="secondary"
        size="sm"
        full
        disabled={soldOut}
        onClick={() => addToCart(product.shop, product, 1, '')}
      >
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
        {soldOut ? 'Unavailable' : 'Add to cart'}
      </Button>
    </ProductCard>
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
