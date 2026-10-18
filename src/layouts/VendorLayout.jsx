import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Monitor, ClipboardList, Utensils, Package, MessageSquare, BarChart3, Settings, User, LogOut, Store, Menu, X, Bell, Ban, Clock } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Toasts, Avatar, isEmojiSource, PlatformLogo } from '@/components/UI';
import { useState } from 'react';

// A shop logo is either an emoji or an uploaded image reference. Distinguishing
// them stops a stored image URL from rendering as literal text in the sidebar.


export default function VendorLayout() {
  const { auth, logout, orders, vendors, chats, notifications, platformSettings } = useApp();
  const navigate = useNavigate();
  // Docked by default on desktop so the navigation is visible with the
  // interface beside it; closed by default on mobile where it is an overlay.
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  ));

  const pendingOrders = orders.filter((o) => (
    (String(o.vendorId) === String(auth.user?.id) || String(o.vendorId) === String(auth.user?.ownerId))
    && ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(o.status)
  )).length;
  const unreadNotifications = notifications.filter((notification) => (
    String(notification.userId) === String(auth.user?.id)
    && !notification.read
    && notification.type !== 'chat'
  )).length;
  const unreadChatCount = chats
    .filter((chat) => (
      String(chat.vendorId) === String(auth.user?.id)
      || String(chat.vendorId) === String(auth.user?.ownerId)
    ))
    .reduce((count, chat) => count + chat.messages.filter((message) => (
      message.senderRole !== auth.role && !message.readAt
    )).length, 0);

  const handleLogout = () => {
    logout();
    navigate('/vendor/login');
  };

  /*
    A vendor that is not yet approved, or that an admin has suspended, must not
    reach the portal: pending shops are hidden from customers and suspended shops
    are not supposed to sell at all. The whole shell is replaced by a status
    screen so no page underneath can be reached, and the only action is to sign
    out. The sign-out runs the shared `logout`, which also revokes the Supabase
    session -- the login gate only covers a fresh sign-in, not a session that was
    already open when the suspension happened.
  */
  /*
    Read the status from the live `vendors` list first, not only off `auth.user`.
    The signed-in user object is a snapshot taken at sign-in, so an approval or a
    suspension that lands afterwards -- via the 15s refresh tick, or a second tab
    -- updates the list but not `auth.user`. Falling back to `auth.user` covers
    the moment before the vendor's own row has loaded.
  */
  const liveVendor = vendors.find((vendor) => (
    String(vendor.id) === String(auth.user?.id) || String(vendor.ownerId) === String(auth.user?.id)
  ));
  const accountStatus = liveVendor?.status ?? auth.user?.status;
  const isPending = accountStatus === 'pending';
  const isRejected = accountStatus === 'rejected';
  if (isPending || accountStatus === 'suspended' || isRejected) {
    const isSuspended = accountStatus === 'suspended';
    const heading = isSuspended ? 'Account suspended' : isRejected ? 'Application rejected' : 'Pending approval';
    const body = isSuspended
      ? 'Your shop has been suspended by the platform admin. You cannot access the vendor portal while suspended. Contact the admin if you believe this is a mistake.'
      : isRejected
        ? 'Your shop application was rejected by the platform admin. You cannot access the vendor portal. Contact the admin if you believe this is a mistake.'
        : `Thanks, ${auth.user?.ownerName || auth.user?.name || 'there'}. Your registration was submitted and is waiting for admin approval. You can start selling once your shop is approved.`;
    return (
      <div className="staff-portal-theme flex min-h-screen items-center justify-center bg-[#101014] p-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#19191f] p-6 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isPending ? 'bg-violet-400/10 text-violet-200' : 'bg-danger/15 text-red-300'}`}>
            {isPending ? <Clock className="h-7 w-7" aria-hidden="true" /> : <Ban className="h-7 w-7" aria-hidden="true" />}
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {heading}
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {body}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.09] hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>
    );
  }

  // Below lg the sidebar is an overlay, so a nav tap should dismiss it. At lg
  // it is docked beside the content and must stay open when a feature is chosen.
  const handleNavigate = () => {
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      setSidebarOpen(false);
    }
  };

  const navItems = [
    { to: '/vendor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/vendor/kds', icon: Monitor, label: 'KDS', badge: pendingOrders },
    { to: '/vendor/orders', icon: ClipboardList, label: 'Orders' },
    { to: '/vendor/menu', icon: Utensils, label: 'Menu' },
    { to: '/vendor/inventory', icon: Package, label: 'Inventory' },
    { to: '/vendor/marketplace', icon: MessageSquare, label: 'Marketplace' },
    { to: '/vendor/messages', icon: MessageSquare, label: 'Messages', badge: unreadChatCount },
    { to: '/vendor/notifications', icon: Bell, label: 'Notifications', badge: unreadNotifications },
    { to: '/vendor/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/vendor/settings', icon: Settings, label: 'Settings' },
    { to: '/vendor/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="staff-portal-theme min-h-screen bg-[#101014] text-white flex">
      {/* Sidebar for desktop */}
      <aside id="vendor-navigation" className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-hairline shadow-[2px_0_18px_rgba(0,0,0,0.18)] flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/*
          pl-[max(1.25rem,env(safe-area-inset-left))] rather than px-5. The page
          sets `viewport-fit=cover` (index.html) so the bottom nav can pad past
          the home indicator, and that also lets content extend into the left cut
          out. On a landscape iPhone the notch is on the left, where this sidebar
          sits, and it would otherwise sit on top of the logo. `max()` keeps the
          20px gutter everywhere the inset is 0, and falls back to the device
          inset in landscape. pr-5 is untouched: the notch never clips the right.

          The top and bottom insets mirror the left one, and only this drawer can
          supply them: the aside is `fixed inset-y-0`, so its top edge is the
          literal top of the viewport -- the wordmark rendered inside the cut out
          in landscape -- and its bottom edge put the Logout button under the home
          indicator. h-16 became min-h-16 because a fixed height would absorb the
          inset padding and squeeze the 56px logo back up against the border.
        */}
        <div className="min-h-16 pt-[env(safe-area-inset-top)] flex items-center justify-between pl-[max(1.25rem,env(safe-area-inset-left))] pr-5 border-b border-hairline">
          <Link to="/vendor/dashboard" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-white">
              <PlatformLogo src={platformSettings.logo} alt="KainHUB" />
            </div>
          </Link>
          <button type="button" aria-label="Close navigation menu" className="tap-target" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>
        {/*
          flex-1 min-h-0 rather than a `calc(100vh - 8rem)` height. The aside is
          `fixed inset-y-0`, so it already matches the viewport exactly, and the
          magic number drifted out of sync with the real header height as soon as
          either changed. `100vh` is also the wrong unit on mobile: it measures
          the viewport with the browser chrome expanded, which is taller than
          what the user can actually see, so the nav scrolled past the bottom of
          a landscape phone and pushed the logout block off screen. min-h-0 is
          what lets this child shrink and scroll instead of overflowing.
        */}
        <nav className="flex-1 min-h-0 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavigate}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm font-medium transition-[background-color,border-color,color] duration-150 ${
                  isActive
                    ? 'is-active border-brand-line/70 bg-brand-soft text-brand-deep'
                    : 'border-transparent text-body hover:border-hairline hover:bg-surface-hover hover:text-ink'
                }`
              }
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors group-hover:text-ink group-[.is-active]:bg-white group-[.is-active]:text-brand-deep group-[.is-active]:shadow-sm">
                <item.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="min-w-5 rounded-full bg-brand-muted px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums text-brand-deep">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {/*
          shrink-0 in normal flow, not `absolute bottom-0`. The aside is now a
          flex column with the nav scrolling above it, so this sits at the end of
          the flow and stays pinned to the bottom on a tall screen. Absolute
          positioning would have needed the nav's bottom padding to clear it and
          would have overlapped the last item instead.

          The bottom inset matches the top one on the brand row: the aside ends at
          the literal bottom of the viewport, which is where the home indicator is,
          so the vendor's only logout control was partially under it in portrait.
        */}
        <div className="shrink-0 border-t border-hairline p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 mb-2 px-2">
            <Avatar
              name={auth.user?.name}
              emoji={isEmojiSource(auth.user?.logo) ? auth.user.logo : undefined}
              src={isEmojiSource(auth.user?.logo) ? undefined : auth.user?.logo}
              size="sm"
              className="!bg-brand-soft !text-brand-deep"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate">{auth.user?.name}</div>
              <div className="text-xs text-muted truncate">{auth.user?.ownerName}</div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="w-full min-h-11 flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted hover:text-danger hover:bg-danger-soft rounded-control font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && <button type="button" aria-label="Close navigation menu" className="fixed inset-0 z-30 cursor-default bg-black/45 lg:hidden" onClick={() => setSidebarOpen(false)}></button>}

      {/* Main content. lg:pl-64 offsets the docked sidebar so the interface
          stays fully visible beside the navigation instead of under it; the
          padding collapses when the sidebar is toggled shut. */}
      <div className={`min-w-0 flex-1 transition-[padding] duration-200 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        {/* Top bar */}
        {/* min-h-14 plus pt from the top inset: `sticky top-0` pins the bar to the
            very top of the viewport, which in landscape on a notched phone is
            inside the cut out. Padding paints the background under the notch, which
            is what a header is for, whereas `top: env(...)` would leave the content
            scrolling through the gap behind it. h-14 became min-h-14 so the inset
            cannot squeeze the bar's controls back under the 44px floor. */}
        <header className="sticky top-0 z-50 min-h-14 pt-[env(safe-area-inset-top)] border-b border-white/10 bg-[#101014]/95 flex items-center px-4 lg:px-8 gap-3 backdrop-blur-sm">
          <button type="button" aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-controls="vendor-navigation" aria-expanded={sidebarOpen} className="tap-target rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white" onClick={() => setSidebarOpen((open) => !open)}>
            <Menu className="w-5 h-5 text-body" />
          </button>
          <Avatar
            name={auth.user?.name}
            emoji={isEmojiSource(auth.user?.logo) ? auth.user.logo : undefined}
            src={isEmojiSource(auth.user?.logo) ? undefined : auth.user?.logo}
            size="md"
            className="!h-10 !w-10 !bg-white/[0.08] !text-white"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-ink hidden sm:block">{auth.user?.name}</h1>
            <p className="text-xs text-muted hidden sm:block">Vendor Dashboard</p>
          </div>
        </header>

        {/* pl-[max(0.75rem,env(safe-area-inset-left))] on the content too. Below
            lg the sidebar is off-screen, so main is full-width -- and in landscape
            on a notched phone that puts the first column under the left cut out.
            `max()` preserves the 12px gutter wherever the inset is 0. */}
        <main className="w-full min-w-0 p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto page-enter pl-[max(0.75rem,env(safe-area-inset-left))]">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
