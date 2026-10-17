import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { Store, ClipboardList, User, ShoppingCart, Bell, LogOut, Utensils, MessageSquare, Search, Heart, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Toasts, Avatar, isEmojiSource, PlatformLogo } from '@/components/UI';
import { useEffect, useRef, useState } from 'react';

// An avatar is either an emoji (short, no URL/file extension) or an uploaded
// image reference. Distinguishing them keeps a stored image URL from being
// rendered as literal text in the header.


export default function CustomerLayout() {
  const { auth, cart, logout, notifications, platformSettings, favoriteCount } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const unreadNotifs = notifications.filter((n) => String(n.userId) === String(auth.user?.id) && !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/customer/login');
  };

  // Dismiss the account menu on outside click or Escape, and return focus to
  // the button that opened it.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="customer-portal-theme min-h-screen bg-[#101014] pb-20 text-white lg:pb-0">
      {/*
        The flat dark header uses the same violet canvas as the customer
        discovery page and the account portals.
      */}
      {/*
        pt from the top inset, for the same reason as the admin and vendor bars:
        `sticky top-0` puts the header at the very top of the viewport, which in
        landscape on a notched phone is inside the cut out. Padding keeps the dark
        background painted under the notch; an offset would leave the page content
        scrolling through the gap behind it.

        The inner row stays a fixed h-14 so the bar's controls keep their height
        and the mobile search row below it does not move.
      */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#101014] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 min-w-0 max-w-7xl items-center gap-3 px-4 lg:gap-4 lg:px-8">
          <Link to="/customer" className="flex items-center gap-2.5 shrink-0" aria-label="KainHUB home">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-white">
              <PlatformLogo src={platformSettings.logo} alt="" />
            </span>
          </Link>

          {/* Keep the primary navigation focused; account destinations live in the profile menu. */}
          <nav className="hidden shrink-0 items-center gap-1 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1 lg:flex" aria-label="Primary">
            <HeaderNavLink to="/customer/shops" icon={Store}>Shops</HeaderNavLink>
            <HeaderNavLink to="/customer/foods" icon={Utensils}>Foods</HeaderNavLink>
            <HeaderNavLink to="/customer/community" icon={Users}>Community</HeaderNavLink>
          </nav>

          {/*
            Search. Sits in the header on sm+ and moves to its own full-width
            row on mobile, where three controls plus an input do not fit in
            320px. Submitting navigates to the shops list with the query, which
            is the existing route contract.
          */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const q = searchText.trim();
              navigate(`/customer/shops${q ? `?search=${encodeURIComponent(q)}` : ''}`);
            }}
            role="search"
            className="hidden lg:block min-w-0 flex-1"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search shops or cuisine"
                aria-label="Search shops or cuisine"
                className="min-h-10 w-full rounded-xl border border-white/10 bg-white/[0.045] py-2 pl-10 pr-3 text-sm text-white placeholder:text-white/40 transition-colors hover:border-white/20 focus:border-violet-400/70 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-400/20"
              />
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-white/10 pl-2 lg:ml-0 lg:gap-1.5 lg:pl-3">
            <Link
              to="/customer/messages"
              aria-label="Chat"
              title="Chat"
              className="tap-target relative rounded-xl text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              <MessageSquare className="w-5 h-5" aria-hidden="true" />
            </Link>
            <Link to="/customer/notifications" aria-label={unreadNotifs > 0 ? `Notifications, ${unreadNotifs} unread` : 'Notifications'} className="tap-target relative rounded-xl text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white">
              <Bell className="w-5 h-5" />
              {unreadNotifs > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-[#101014]" />
              )}
            </Link>

            <Link to="/customer/cart" aria-label={cartCount > 0 ? `Shopping cart, ${cartCount} items` : 'Shopping cart'} className="tap-target relative rounded-xl text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4.5 h-4.5 px-1 bg-violet-500 text-white text-[11px] rounded-full flex items-center justify-center font-semibold tabular-nums ring-2 ring-[#101014]">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>

            <button type="button"
              ref={menuButtonRef}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Open account menu"
              aria-expanded={menuOpen}
              className="tap-target shrink-0 rounded-full ring-1 ring-white/10 transition hover:ring-violet-300/50"
            >
              <Avatar name={auth.user?.fullName} emoji={isEmojiSource(auth.user?.avatar) ? auth.user.avatar : undefined} src={isEmojiSource(auth.user?.avatar) ? undefined : auth.user?.avatar} size="sm" />
            </button>
          </div>
        </div>

        {/* Mobile search row. Sits below the header bar so the controls above
            keep a predictable position as the user scrolls. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const q = searchText.trim();
            navigate(`/customer/shops${q ? `?search=${encodeURIComponent(q)}` : ''}`);
          }}
          role="search"
          className="px-4 pb-2.5 lg:hidden"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/45 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search shops or cuisine"
              aria-label="Search shops or cuisine"
              className="w-full rounded-xl border border-white/10 bg-white/[0.045] py-2 pl-10 pr-3 text-sm text-white placeholder:text-white/40 transition-colors hover:border-white/20 focus:border-violet-400/70 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-400/20"
            />
          </div>
        </form>

        {menuOpen && (
          <div ref={menuRef} className="absolute right-4 top-full mt-1 bg-[#19191f] rounded-card shadow-float border border-white/10 w-56 py-1 z-50 animate-fade-in">
            <div className="px-4 py-2.5 border-b border-hairline">
              <div className="text-sm font-medium text-ink truncate">{auth.user?.fullName}</div>
              <div className="text-xs text-muted truncate">{auth.user?.email}</div>
            </div>
            <Link to="/customer/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 min-h-11 px-4 py-2 text-sm text-body hover:bg-surface-sunken">
              <User className="w-4 h-4 text-subtle" /> My profile
            </Link>
            <Link to="/customer/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 min-h-11 px-4 py-2 text-sm text-body hover:bg-surface-sunken">
              <ClipboardList className="w-4 h-4 text-subtle" /> My orders
            </Link>
            <Link to="/customer/messages" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 min-h-11 px-4 py-2 text-sm text-body hover:bg-surface-sunken">
              <MessageSquare className="w-4 h-4 text-subtle" /> Messages
            </Link>
            <Link to="/customer/community" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 min-h-11 px-4 py-2 text-sm text-body hover:bg-surface-sunken">
              <Users className="w-4 h-4 text-subtle" /> Community
            </Link>
            {/* Count shown only when something is saved, so the row reads as
                "Favorites" rather than "Favorites 0" on a first visit. */}
            <Link to="/customer/favorites" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 min-h-11 px-4 py-2 text-sm text-body hover:bg-surface-sunken">
              <Heart className="w-4 h-4 text-subtle" /> Favorites
              {favoriteCount > 0 && (
                <span className="ml-auto text-xs font-semibold text-brand-strong tabular-nums">{favoriteCount}</span>
              )}
            </Link>
            <button type="button" onClick={handleLogout} className="w-full flex items-center gap-2.5 min-h-11 px-4 py-2 text-sm text-danger hover:bg-danger-soft">
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        )}
      </header>

      {/*
        Main content. The padding, min-w-0, and page-enter match AdminLayout and
        VendorLayout exactly. This shell used to own none of them: each customer
        page hand-rolled its own gutter and the nine of them disagreed (p-4,
        p-4 sm:p-6, p-3 sm:p-5), and one page cancelled its own padding back to
        zero at lg. min-w-0 matters because max-w plus mx-auto without it is the
        flexbox min-width:auto overflow trap on narrow screens.

        The two env() gutters are the device cut outs, not a style choice.
        `viewport-fit=cover` in index.html is what lets the bottom nav pad past
        the home indicator, and it equally lets the content run under the notch
        when the phone is held in landscape. max() keeps the normal 12px gutter
        on every device that reports a 0 inset.
      */}
        <main className="w-full min-w-0 max-w-7xl mx-auto px-3 py-5 sm:px-4 sm:py-6 lg:px-8 lg:py-8 page-enter pl-[max(0.75rem,env(safe-area-inset-left))] pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-0">
          <Outlet />
        </main>

      {/*
        Bottom navigation. Mobile and small-tablet only: from md+ the header
        links above replace it, so the reserved space is released as well.
      */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#101014] lg:hidden" aria-label="Primary">
        <div className="flex">
          <BottomNav to="/customer/shops" icon={Store} label="Shops" />
          <BottomNav to="/customer/foods" icon={Utensils} label="Foods" />
          <BottomNav to="/customer/orders" icon={ClipboardList} label="Orders" />
          <BottomNav to="/customer/messages" icon={MessageSquare} label="Chat" />
          <BottomNav to="/customer/profile" icon={User} label="Profile" />
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      <Toasts />
    </div>
  );
}

function HeaderNavLink({ to, icon: Icon, children, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm transition-colors ${
          isActive ? 'bg-white/10 text-violet-200 font-semibold ring-1 ring-inset ring-white/10' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
        }`
      }
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {children}
    </NavLink>
  );
}

function BottomNav({ to, icon: Icon, label, end, count }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-1 min-h-14 py-2 relative transition-colors ${
          isActive ? 'text-violet-300' : 'text-white/55 hover:text-white'
        }`
      }
    >
      {/*
        Active state is a filled icon plus a top indicator bar, not colour
        alone. Colour-only state is easy to miss on a phone in daylight and is
        invisible to users who cannot distinguish the accent hue.
      */}
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={`absolute top-0 h-0.5 w-8 rounded-full bg-violet-400 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
          />
          <span className="relative">
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.25]' : 'stroke-[1.75]'}`} aria-hidden="true" />
            {/* Only when there is something to report: a permanent "0" badge on a
                tab is noise that trains people to ignore badges. */}
            {count > 0 && (
              <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 bg-brand text-white text-[10px] leading-4 rounded-full font-semibold tabular-nums text-center">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </span>
          <span className={`text-[11px] leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
