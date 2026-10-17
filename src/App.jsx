import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AppProvider } from '@/context/AppContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Layouts
import CustomerLayout from '@/layouts/CustomerLayout';
import VendorLayout from '@/layouts/VendorLayout';
import AdminLayout from '@/layouts/AdminLayout';

const Landing = lazy(() => import('@/pages/Landing'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

const CustomerLogin = lazy(() => import('@/pages/customer/Login'));
const CustomerRegister = lazy(() => import('@/pages/customer/Register'));
const CustomerHome = lazy(() => import('@/pages/customer/Home'));
const CustomerCommunity = lazy(() => import('@/pages/customer/Home').then((module) => ({ default: module.CustomerCommunity })));
const CustomerShops = lazy(() => import('@/pages/customer/Shops'));
const CustomerFoods = lazy(() => import('@/pages/customer/Foods'));
const CustomerShopDetail = lazy(() => import('@/pages/customer/ShopDetail'));
const CustomerFavorites = lazy(() => import('@/pages/customer/Favorites'));
const CustomerCart = lazy(() => import('@/pages/customer/Cart'));
const CustomerCheckout = lazy(() => import('@/pages/customer/Checkout'));
const CustomerOrders = lazy(() => import('@/pages/customer/Orders'));
const CustomerOrderDetail = lazy(() => import('@/pages/customer/OrderDetail'));
const CustomerProfile = lazy(() => import('@/pages/customer/Profile'));
const CustomerNotifications = lazy(() => import('@/pages/customer/Notifications'));
const CustomerPublicProfile = lazy(() => import('@/pages/customer/PublicProfile'));

const VendorLogin = lazy(() => import('@/pages/vendor/Login'));
const VendorRegister = lazy(() => import('@/pages/vendor/Register'));
const VendorDashboard = lazy(() => import('@/pages/vendor/Dashboard'));
const VendorKDS = lazy(() => import('@/pages/vendor/KDS'));
const VendorOrders = lazy(() => import('@/pages/vendor/Orders'));
const VendorMenu = lazy(() => import('@/pages/vendor/Menu'));
const VendorInventory = lazy(() => import('@/pages/vendor/Inventory'));
const VendorMarketplace = lazy(() => import('@/pages/vendor/Marketplace'));
const VendorAnalytics = lazy(() => import('@/pages/vendor/Analytics'));
const VendorSettings = lazy(() => import('@/pages/vendor/Settings'));
const VendorProfile = lazy(() => import('@/pages/vendor/Profile'));
const VendorNotifications = lazy(() => import('@/pages/vendor/Notifications'));
const Chat = lazy(() => import('@/pages/Chat'));

const AdminLogin = lazy(() => import('@/pages/admin/Login'));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminVendors = lazy(() => import('@/pages/admin/Vendors'));
const AdminVendorDetail = lazy(() => import('@/pages/admin/Vendors').then((module) => ({ default: module.AdminVendorDetail })));
const AdminCustomers = lazy(() => import('@/pages/admin/Customers'));
const AdminCustomerDetail = lazy(() => import('@/pages/admin/Customers').then((module) => ({ default: module.AdminCustomerDetail })));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminMarketplace = lazy(() => import('@/pages/admin/Marketplace'));
const AdminReports = lazy(() => import('@/pages/admin/Reports'));
const AdminAnnouncements = lazy(() => import('@/pages/admin/Notifications'));
const AdminAnalytics = lazy(() => import('@/pages/admin/Analytics'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));
const AdminProfile = lazy(() => import('@/pages/admin/Profile'));

function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-sunken">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-ink mb-2">403 - Unauthorized</h1>
        <p className="text-body mb-6">You don't have permission to access this page. Please sign in with the correct account.</p>
        <Link to="/" className="inline-block px-4 py-2 bg-brand text-white rounded-lg font-medium hover:bg-brand-strong">Go to Portals</Link>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-sunken">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="text-2xl font-bold text-ink mb-2">404 - Page Not Found</h1>
        <p className="text-body mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/" className="inline-block px-4 py-2 bg-brand text-white rounded-lg font-medium hover:bg-brand-strong">Go Home</Link>
      </div>
    </div>
  );
}

/*
 * Resets scroll on every navigation. Without it, going Shop -> Shop detail ->
 * back left the page scrolled to where you had been, so the new view opened
 * halfway down. Skipped for hash links so in-page anchors still work.
 *
 * Also keeps document.title in step with the route. It was hardcoded to
 * "KainHUB" for every page, so browser history, bookmarks, and the tab strip
 * all showed the same string for 30+ screens.
 */
const TITLES = {
  '/': 'KainHUB',
  '/reset-password': 'Reset password · KainHUB',
  '/customer/login': 'Sign in · KainHUB',
  '/customer/register': 'Create account · KainHUB',
  '/customer': 'Marketplace · KainHUB',
  '/customer/shops': 'Shops · KainHUB',
  '/customer/foods': 'Foods · KainHUB',
  '/customer/community': 'Community · KainHUB',
  '/customer/favorites': 'Favorites · KainHUB',
  '/customer/cart': 'Cart · KainHUB',
  '/customer/checkout': 'Checkout · KainHUB',
  '/customer/orders': 'Orders · KainHUB',
  '/customer/messages': 'Messages · KainHUB',
  '/customer/profile': 'Profile · KainHUB',
  '/customer/notifications': 'Notifications · KainHUB',
  '/vendor/login': 'Vendor sign in · KainHUB',
  '/vendor/register': 'Register your shop · KainHUB',
  '/vendor': 'Dashboard · KainHUB',
  '/vendor/dashboard': 'Dashboard · KainHUB',
  '/vendor/kds': 'Kitchen · KainHUB',
  '/vendor/orders': 'Orders · KainHUB',
  '/vendor/menu': 'Menu · KainHUB',
  '/vendor/inventory': 'Inventory · KainHUB',
  '/vendor/marketplace': 'Marketplace · KainHUB',
  '/vendor/messages': 'Messages · KainHUB',
  '/vendor/analytics': 'Analytics · KainHUB',
  '/vendor/settings': 'Settings · KainHUB',
  '/vendor/profile': 'Profile · KainHUB',
  '/vendor/notifications': 'Notifications · KainHUB',
  '/admin/login': 'Admin sign in · KainHUB',
  '/forgot-password': 'Forgot password · KainHUB',
  '/admin': 'Dashboard · KainHUB',
  '/admin/dashboard': 'Dashboard · KainHUB',
  '/admin/vendors': 'Vendors · KainHUB',
  '/admin/customers': 'Customers · KainHUB',
  '/admin/orders': 'Orders · KainHUB',
  '/admin/marketplace': 'Marketplace · KainHUB',
  '/admin/reports': 'Reports · KainHUB',
  '/admin/notifications': 'Notifications · KainHUB',
  '/admin/analytics': 'Analytics · KainHUB',
  '/admin/audit-logs': 'Audit logs · KainHUB',
  '/admin/settings': 'Settings · KainHUB',
  '/admin/profile': 'Profile · KainHUB',
  '/unauthorized': 'Unauthorized · KainHUB',
  '/profiles/:profileType/:profileId': 'Profile · KainHUB',
  '/customer/profile/:profileType/:profileId': 'Profile · KainHUB',
  '/customer/shops/:shopId': 'Shop · KainHUB',
  '/customer/orders/:orderId': 'Order · KainHUB',
  '/admin/vendors/:vendorId': 'Vendor · KainHUB',
  '/admin/customers/:customerId': 'Customer · KainHUB',
};

function RouteEffects() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    const patternKey = Object.keys(TITLES).find((key) => {
      if (!key.includes(':')) return false;
      const parts = key.split('/').filter(Boolean);
      return parts.length === segments.length && parts.every((part, i) => part.startsWith(':') || part === segments[i]);
    });
    const title = TITLES[pathname] ?? (patternKey ? TITLES[patternKey] : undefined);
    if (title) document.title = title;
  }, [pathname]);

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <RouteEffects />
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-body" role="status">Loading...</div>}>
          <Routes>
          {/* Landing / Portal Selector */}
          <Route path="/" element={<Landing />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profiles/:profileType/:profileId" element={<CustomerPublicProfile />} />

          {/* ===== CUSTOMER APP ===== */}
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer/register" element={<CustomerRegister />} />
          <Route path="/customer" element={
            <ProtectedRoute role="customer"><CustomerLayout /></ProtectedRoute>
          }>
            <Route index element={<CustomerHome />} />
            <Route path="shops" element={<CustomerShops />} />
            <Route path="foods" element={<CustomerFoods />} />
            <Route path="community" element={<CustomerCommunity />} />
            <Route path="shops/:shopId" element={<CustomerShopDetail />} />
      <Route path="favorites" element={<CustomerFavorites />} />
            <Route path="cart" element={<CustomerCart />} />
            <Route path="checkout" element={<CustomerCheckout />} />
            <Route path="orders" element={<CustomerOrders />} />
            <Route path="orders/:orderId" element={<CustomerOrderDetail />} />
            <Route path="profile" element={<CustomerProfile />} />
            <Route path="messages" element={<Chat />} />
            <Route path="profile/:profileType/:profileId" element={<CustomerPublicProfile />} />
            <Route path="notifications" element={<CustomerNotifications />} />
          </Route>

          {/* ===== VENDOR APP ===== */}
          <Route path="/vendor/login" element={<VendorLogin />} />
          <Route path="/vendor/register" element={<VendorRegister />} />
          <Route path="/vendor" element={
            <ProtectedRoute role="vendor"><VendorLayout /></ProtectedRoute>
          }>
            <Route index element={<Navigate to="/vendor/dashboard" replace />} />
            <Route path="dashboard" element={<VendorDashboard />} />
            <Route path="kds" element={<VendorKDS />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="menu" element={<VendorMenu />} />
            <Route path="inventory" element={<VendorInventory />} />
            <Route path="marketplace" element={<VendorMarketplace />} />
            <Route path="messages" element={<Chat />} />
            <Route path="analytics" element={<VendorAnalytics />} />
            <Route path="settings" element={<VendorSettings />} />
            <Route path="profile" element={<VendorProfile />} />
            <Route path="notifications" element={<VendorNotifications />} />
          </Route>

          {/* ===== ADMIN APP ===== */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>
          }>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="vendors/:vendorId" element={<AdminVendorDetail />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="customers/:customerId" element={<AdminCustomerDetail />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="marketplace" element={<AdminMarketplace />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="notifications" element={<AdminAnnouncements />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  );
}
