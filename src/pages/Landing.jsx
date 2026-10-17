import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChefHat,
  Clock3,
  MapPin,
  ShoppingBag,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { isImageSource, MediaImage, PlatformLogo } from '@/components/UI';
import { getShopBuyerStats, rankShopsByRating } from '@/lib/shopPopularity';

export default function Landing() {
  const { platformSettings, vendors, orders } = useApp();
  const approvedVendors = vendors.filter((vendor) => vendor.status === 'approved');
  const buyerStats = getShopBuyerStats(orders);
  const featuredShop = rankShopsByRating(approvedVendors, buyerStats)[0];
  const featuredImage = isImageSource(featuredShop?.coverImage)
    ? featuredShop.coverImage
    : isImageSource(featuredShop?.logo)
      ? featuredShop.logo
      : '';
  const featuredLogo = featuredShop?.logo && !isImageSource(featuredShop.logo) ? featuredShop.logo : '';

  return (
    <div className="min-h-screen overflow-hidden bg-[#101014] text-white">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <Link to="/" className="inline-flex items-center gap-2.5" aria-label="KainHUB home">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-white">
            <PlatformLogo src={platformSettings.logo} alt="" />
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 text-sm font-medium text-white/60 sm:inline-flex">
            <MapPin className="h-4 w-4 text-violet-300" aria-hidden="true" />
            Lancaster
          </span>
          <Link
            to="/customer/login"
            className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            Sign in
          </Link>
          <Link
            to="/vendor/register"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-400/15 px-4 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-200/50 hover:bg-violet-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            <ChefHat className="h-4 w-4" aria-hidden="true" />
            Register your shop
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-8 md:grid-cols-[1.02fr_0.98fr] md:gap-6 lg:gap-12 lg:px-12 lg:pb-20 lg:pt-10">
          <div className="relative z-10 md:py-5">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Your neighborhood, served
            </div>
            <h1 className="max-w-2xl text-[2.7rem] font-extrabold leading-[1.06] tracking-[-0.045em] text-white sm:text-6xl md:text-5xl lg:text-[4.25rem]">
              Good food is
              <br />
              <span className="relative inline-block text-violet-300">
                closer than
                <svg className="absolute -bottom-2 left-0 h-3 w-full text-violet-500" viewBox="0 0 240 12" fill="none" aria-hidden="true" preserveAspectRatio="none">
                  <path d="M3 8.5C62 3 157 2.5 237 7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
              <br />
              you think.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-6 text-white/65 sm:text-base sm:leading-7 lg:text-lg lg:leading-8">
              Find the local kitchens you love, order something delicious, and keep your neighborhood thriving.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/customer"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-brand transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Explore local food
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
              >
                How it works <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-white/60 sm:text-xs lg:text-sm">
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-success" aria-hidden="true" /> Local shops</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-violet-300" aria-hidden="true" /> Live order updates</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-violet-300" aria-hidden="true" /> Lancaster area</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl md:max-w-none">
            <div className="absolute -right-16 -top-12 h-48 w-48 rounded-full bg-violet-900/40 blur-2xl sm:h-64 sm:w-64" aria-hidden="true" />
            <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-brand-muted/70 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[1.75rem] bg-[#211c2e] p-2.5 shadow-float sm:rounded-[2rem] sm:p-3">
              <div className="relative aspect-[1/1] overflow-hidden rounded-[1.3rem] bg-[#352d46] sm:aspect-[4/3] sm:rounded-[1.6rem] md:aspect-[0.9/1] lg:aspect-[4/3]">
                {featuredShop ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-950 via-[#28223a] to-[#19171f]">
                      <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] text-6xl font-bold text-white/80 shadow-float sm:h-36 sm:w-36">
                        {featuredLogo || featuredShop.name.trim().charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {featuredImage && (
                      <MediaImage
                        src={featuredImage}
                        alt={`${featuredShop.name} shop`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25" />
                    <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-[10px] font-semibold text-white shadow-raised backdrop-blur sm:left-5 sm:top-5 sm:text-xs">
                      <span className={`h-2 w-2 rounded-full ${featuredShop.storeStatus === 'OPEN' ? 'bg-emerald-400' : 'bg-white/50'}`} />
                      Top rated shop
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 text-white sm:bottom-6 sm:left-6 sm:right-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">{featuredShop.category || 'Lancaster'}</p>
                      <p className="mt-1 line-clamp-2 text-2xl font-bold tracking-tight sm:text-3xl">{featuredShop.name}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/75">
                        <span aria-hidden="true">★</span>
                        {Number(featuredShop.rating).toFixed(1)} rating
                      </p>
                      {featuredShop.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70 sm:text-sm">{featuredShop.description}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-[#28223a] to-[#19171f] px-6 text-center">
                    {platformSettings.logo
                      ? <div className="mb-5 h-20 w-20 drop-shadow-lg sm:h-24 sm:w-24"><PlatformLogo src={platformSettings.logo} alt="KainHUB" /></div>
                      : <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-violet-200">
                        <ChefHat className="h-8 w-8" aria-hidden="true" />
                      </div>}
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">KainHUB · Lancaster</p>
                    <p className="mt-2 max-w-xs text-2xl font-bold tracking-tight text-white sm:text-3xl">Local shops will appear here.</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-white/60">
                      A top-rated shop will appear when customer ratings are available.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 px-1 pb-1 pt-2.5 sm:gap-3 sm:px-2 sm:pb-2 sm:pt-3">
                <div className="rounded-xl bg-white/[0.08] p-2.5 sm:rounded-2xl sm:p-3">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white sm:mb-2.5 sm:h-9 sm:w-9">
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-white">Order your way</p>
                  <p className="mt-1 text-xs leading-5 text-white/65">Delivery or pick-up, your choice.</p>
                </div>
                <div className="rounded-xl bg-white/[0.08] p-2.5 sm:rounded-2xl sm:p-3">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand-deep sm:mb-2.5 sm:h-9 sm:w-9">
                    <ChefHat className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-white">Meet local makers</p>
                  <p className="mt-1 text-xs leading-5 text-white/65">Discover independent kitchens.</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/[0.08] bg-white/[0.025]">
          <div className="mx-auto grid max-w-7xl gap-7 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-12 lg:px-12">
            <div className="max-w-lg">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300">Simple by design</p>
              <h2 className="mt-2.5 max-w-sm text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Your neighborhood, on the menu.
              </h2>
              <p className="mt-2.5 max-w-md text-sm leading-6 text-white/55">
                A better way to discover local food and stay connected to the people who make it.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
              <Step number="01" title="Find your spot" text="Browse nearby shops and their menus." />
              <Step number="02" title="Make it yours" text="Choose delivery or pick-up at checkout." />
              <Step number="03" title="Stay in the loop" text="Follow order updates from kitchen to you." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="relative grid gap-6 overflow-hidden rounded-3xl border border-violet-300/15 bg-[linear-gradient(110deg,rgba(124,58,237,0.14),rgba(255,255,255,0.035)_55%)] p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10 lg:p-9">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-violet-700/15 blur-3xl" aria-hidden="true" />
            <div className="relative min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-300">Made for Lancaster</p>
              <h2 className="mt-2.5 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">Are you cooking up something good?</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                Bring your shop to KainHUB. Share your menu, manage orders, and meet more local customers.
              </p>
            </div>
            <Link
              to="/vendor/register"
              className="relative inline-flex min-h-12 items-center justify-center gap-2 justify-self-start rounded-full bg-violet-500 px-6 text-sm font-bold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 lg:justify-self-end"
            >
              <ChefHat className="h-4 w-4" aria-hidden="true" />
              Register your shop
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© 2026 KainHUB · Lancaster</p>
          <Link
            to="/admin/login"
            className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-control px-2 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 sm:self-auto"
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Staff access
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Step({ number, title, text }) {
  return (
    <article className="flex min-h-36 flex-col rounded-2xl border border-white/[0.09] bg-[#17161d]/80 p-4 transition-colors hover:border-violet-300/25 hover:bg-white/[0.045] sm:min-h-40 sm:p-5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/10 text-[10px] font-bold tracking-wide text-violet-200">{number}</span>
      <h3 className="mt-4 text-sm font-bold text-white sm:text-base">{title}</h3>
      <p className="mt-1.5 text-xs leading-5 text-white/55 sm:text-sm sm:leading-6">{text}</p>
    </article>
  );
}
