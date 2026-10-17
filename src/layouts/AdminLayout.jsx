import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, Users, ClipboardList, MessageSquare, AlertTriangle, Bell, BarChart3, Settings, ScrollText, User, LogOut, Shield, Menu, X, Utensils } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Toasts, isAdminNotification, PlatformLogo } from '@/components/UI';
import { useState } from 'react';

export default function AdminLayout() {
  const { auth, logout, vendors, orders, posts, notifications, platformSettings } = useApp();
  const navigate = useNavigate();
  // Keep the admin navigation docked on desktop like the vendor portal, while
  // using a dismissible overlay on smaller screens.
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  ));

  const pendingVendors = vendors.filter((v) => v.status === 'pending').length;
  const activeOrders = orders.filter((o) => ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(o.status)).length;
  const reportedPosts = posts.filter((p) => p.reported).length;
  const unreadAccountNotifications = notifications.filter((notification) => isAdminNotification(notification, auth.user?.id) && !notification.read).length;

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const handleNavigate = () => {
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      setSidebarOpen(false);
    }
  };

  const navItems = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/vendors', icon: Store, label: 'Vendors', badge: pendingVendors },
    { to: '/admin/customers', icon: Users, label: 'Customers' },
    { to: '/admin/orders', icon: ClipboardList, label: 'All Orders', badge: activeOrders },
    { to: '/admin/marketplace', icon: MessageSquare, label: 'Marketplace', badge: reportedPosts },
    { to: '/admin/reports', icon: AlertTriangle, label: 'Reports' },
    { to: '/admin/notifications', icon: Bell, label: 'Notifications', badge: unreadAccountNotifications },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/admin/audit-logs', icon: ScrollText, label: 'Audit Logs' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
    { to: '/admin/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="staff-portal-theme min-h-screen bg-[#101014] text-white flex">
      <aside id="admin-navigation" className={`fixed inset-y-0 left-0 z-40 w-64 bg-white text-body border-r border-hairline shadow-[2px_0_18px_rgba(0,0,0,0.18)] flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* pl-[max(1.25rem,env(safe-area-inset-left))] rather than px-5. The
            page sets `viewport-fit=cover` (index.html) so the modal footers can
            pad past the home indicator, and that also lets content extend into
            the left cut out -- which on a landscape iPhone is exactly where this
            sidebar sits. `max()` keeps the 20px gutter where the inset is 0.

            The top and bottom insets are here for the same reason, and they are
            the two this drawer could not get from anywhere else: the aside is
            `fixed inset-y-0`, so it starts at the literal top of the viewport
            (the KainHUB wordmark sat inside the cut out in landscape) and ends at
            the literal bottom, where the Logout button landed under the home
            indicator. h-16 became min-h-16 for the same reason as the header:
            a fixed height would swallow the inset padding. */}
        <div className="min-h-16 pt-[env(safe-area-inset-top)] flex items-center justify-between pl-[max(1.25rem,env(safe-area-inset-left))] pr-5 border-b border-hairline">
          <Link to="/admin/dashboard" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-white">
              <PlatformLogo src={platformSettings.logo} alt="KainHUB" />
            </div>
          </Link>
          <button type="button" aria-label="Close navigation menu" className="tap-target text-muted" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
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
                <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${item.to === '/admin/vendors' || item.to === '/admin/orders' || item.to === '/admin/marketplace' ? 'bg-warning-soft text-warning' : 'bg-brand-muted text-brand-deep'}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {/* shrink-0 in normal flow rather than `absolute bottom-0`: the aside is
            a flex column with the nav scrolling above it, so this stays at the
            bottom of the flow and is never overlapped by the last nav item. The
            bottom inset keeps Logout reachable above the home indicator, matching
            the top inset on the brand row above. */}
        <div className="shrink-0 border-t border-hairline p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 mb-2 px-2">
            <div className="w-8 h-8 bg-brand-soft rounded-full flex items-center justify-center text-brand-deep">
              <Shield className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink truncate">{auth.user?.fullName}</div>
              <div className="text-xs text-muted truncate">Platform Admin</div>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="w-full min-h-11 flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted hover:text-danger hover:bg-danger-soft rounded-control font-medium transition-colors">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* aria-hidden because Escape and the close button are the keyboard path
          out; a scrim is a pointer affordance only. */}
      {sidebarOpen && <button type="button" aria-label="Close navigation menu" className="fixed inset-0 z-30 cursor-default bg-black/45 lg:hidden" onClick={() => setSidebarOpen(false)}></button>}

      <div className={`min-w-0 flex-1 transition-[padding] duration-200 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        {/*
          min-h-14 rather than h-14, and pt from the top inset.

          `sticky top-0` pins the bar to the very top of the viewport, which in
          landscape on a notched phone is *inside* the cut out -- the page title
          sat behind the camera housing. The inset has to be padding on the header
          itself, not an offset on the sticky position: `top: env(...)` moves the
          header down but leaves the content behind it scrolling through the gap,
          whereas padding keeps the background painted under the cut out, which is
          what a header is for.

          h-14 had to become min-h-14 because a fixed height would absorb the inset
          padding and squeeze the 44px controls in the bar back under the minimum.
        */}
        <header className="sticky top-0 z-50 min-h-14 pt-[env(safe-area-inset-top)] border-b border-white/10 bg-[#101014]/95 flex items-center px-4 lg:px-8 gap-3 backdrop-blur-sm">
          <button type="button" aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-controls="admin-navigation" aria-expanded={sidebarOpen} className="tap-target rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white" onClick={() => setSidebarOpen((open) => !open)}>
            <Menu className="w-5 h-5 text-body" />
          </button>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden text-white" aria-hidden="true">
            <PlatformLogo src={platformSettings.logo} alt="" />
          </span>
          <div className="min-w-0 flex-1">
            <div>
              <h1 className="font-semibold text-ink hidden sm:block">Platform administration</h1>
              <p className="hidden text-xs text-muted sm:block">Manage the KainHUB community</p>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-surface-sunken px-3 py-1.5 text-xs font-medium text-muted sm:inline-flex">
            <Shield className="h-3.5 w-3.5 text-brand-strong" aria-hidden="true" /> Admin workspace
          </span>
        </header>

        {/* pl-[max(0.75rem,env(safe-area-inset-left))] on the content too: below
            lg the sidebar is off-screen and main is full-width, which in landscape
            on a notched phone puts the first column under the left cut out. */}
        <main className="w-full min-w-0 p-3 sm:p-5 lg:p-8 max-w-7xl mx-auto page-enter pl-[max(0.75rem,env(safe-area-inset-left))]">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
