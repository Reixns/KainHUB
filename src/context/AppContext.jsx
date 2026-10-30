import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  INITIAL_VENDORS,
  INITIAL_CUSTOMERS,
  INITIAL_ADMINS,
  INITIAL_ORDERS,
  INITIAL_POSTS,
  INITIAL_NOTIFICATIONS,
  PLATFORM_SETTINGS,
} from '@/data/mockData';
import {
  supabase,
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseConfigError,
  signIn as supabaseSignIn,
  sendPhoneOtp as supabaseSendPhoneOtp,
  verifyPhoneOtp as supabaseVerifyPhoneOtp,
  sendEmailOtp as supabaseSendEmailOtp,
  verifyEmailOtp as supabaseVerifyEmailOtp,
  signUp as supabaseSignUp,
  resetPassword as supabaseResetPassword,
  updatePassword as supabaseUpdatePassword,
  changePassword as supabaseChangePassword,
  unlockAccount as supabaseUnlockAccount,
  getProfile,
  loadRemoteState,
  loadRemoteOrders,
  persistState,
  persistNewOrder,
  deleteSupabaseAccount,
  resetSupabaseData,
  uploadMedia as uploadSupabaseMedia,
  deleteSupabaseNotification,
  markSupabaseNotificationRead,
  markAllSupabaseNotificationsRead,
  persistAdminPostModeration,
  deleteSupabasePost,
  persistChatMessage,
  persistChatMessageRead,
  persistShopRating,
  persistAdminMarketplacePost,
  reportSupabasePost,
  reportSupabaseAccount,
  resolveSupabaseAccountReport,
  persistMarketplaceComment,
  deleteMarketplaceComment,
  persistOrderStatus,
} from '@/lib/supabase';

import { STORAGE_KEY, LOCAL_AUTH_KEY, ACTIVE_PORTAL_KEY, PORTAL_CHANGE_EVENT, FEED_CHANNEL, loadState, saveState, replaceCachedPosts, normalizeChats, mergeChats, mergePosts, mergeOrders, mergeFavorites, mergeById, updateIfChanged, nextLocalId, updateIdentityRow, normalizeFavorites, favoriteKey, ORDER_NOTIFICATION_TTL_MS, isNotificationExpired, pruneExpiredNotifications } from '@/context/persistence';
import { asNumber, normalizeStoreStatus } from '@/lib/supabase/mappers';
import { clearVendorLogoPin, hydrateLocalVendorOverlay, pinVendorLogo } from '@/lib/supabase/state';
/*
  From lib/notifications, NOT from components/UI. UI.jsx imports useApp to render
  toasts, so importing the predicate back out of UI.jsx made a cycle
  (AppContext -> UI -> AppContext) that surfaced as `useApp must be used within
  AppProvider` from components which were, in fact, inside the provider. See the
  header of lib/notifications.js.
*/
import { isAdminNotification } from '@/lib/notifications';
import {
  findPasswordHistoryEntry,
  forgetPasswordHistoryEntry,
  isPasswordReused,
  rememberPassword,
} from '@/lib/passwordHistory';
import { useCartActions } from '@/context/useCartActions';
import { useChatActions } from '@/context/useChatActions';
import { useFavoriteActions } from '@/context/useFavoriteActions';
import { prepareImageForLocalStorage } from '@/lib/imageResize';
import { useVendorActions } from '@/context/useVendorActions';
import { useMarketplaceActions } from '@/context/useMarketplaceActions';
import { FIELD_CHAR_LIMITS, findCharacterLimitViolation, isWithinCharacterLimit, characterLimitMessage } from '@/lib/textLimits';

const AppContext = createContext(null);

/*
  ISO stamp one hour out, stamped fresh per call rather than computed once at
  module load: these run inside event handlers, and a module-level constant would
  freeze the expiry at import time and expire the whole list the moment the page
  had been open long enough.
*/
const orderNotificationExpiry = () => new Date(Date.now() + ORDER_NOTIFICATION_TTL_MS).toISOString();

const readCachedAuth = () => {
  try {
    const cached = JSON.parse(sessionStorage.getItem(LOCAL_AUTH_KEY) || 'null');
    return cached?.user && cached?.role ? cached : { user: null, role: null };
  } catch {
    return { user: null, role: null };
  }
};

/*
  How often expired notifications are swept out of state. See the sweep effect
  below; the TTL itself is an hour, so this only controls how long an already
  expired row can linger in state before it is cleared.
*/
const NOTIFICATION_SWEEP_MS = 20 * 1000;

// See the remote-persist effect below: this is how long a burst of state changes
// is allowed to accumulate before one Supabase pass runs for all of them.
const REMOTE_PERSIST_DEBOUNCE_MS = 100;
const REALTIME_REFRESH_DEBOUNCE_MS = 50;
const REALTIME_ORDER_REFRESH_DEBOUNCE_MS = 75;
const REALTIME_FALLBACK_POLL_MS = 5000;
const REALTIME_TABLES = [
  'profiles',
  'customer_profiles',
  'vendor_profiles',
  'admin_profiles',
  'vendors',
  'menu_items',
  'posts',
  'notifications',
  'chats',
  'favorites',
  'shop_ratings',
  'account_reports',
];

const reconcileRemoteRows = (currentRows = [], remoteRows = []) => {
  const remoteIds = new Set(remoteRows.map((row) => String(row.id)));
  const localOnlyRows = currentRows.filter((row) => (
    row?.id != null
    && row.created_at == null
    && row.legacy_id == null
    && row.dbId == null
    && !remoteIds.has(String(row.id))
  ));
  return mergeById(localOnlyRows, remoteRows);
};
const notificationKey = (notification) => `${String(notification?.userId)}:${String(notification?.id)}`;
const ORDER_STATUS_TRANSITIONS = {
  RECEIVED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['COMPLETED', 'OUT FOR DELIVERY'],
  'OUT FOR DELIVERY': ['COMPLETED'],
};

export function AppProvider({ children }) {
  const [initialState] = useState(loadState);

  const [auth, setAuth] = useState(readCachedAuth);
  const [vendors, setVendors] = useState(
    (initialState?.vendors || INITIAL_VENDORS).map((vendor) => ({
      ...vendor,
      storeStatus: normalizeStoreStatus(vendor.storeStatus),
    }))
  );
  const [customers, setCustomers] = useState(initialState?.customers || INITIAL_CUSTOMERS);
  const savedAdmins = initialState?.admins || [];
  const [admins, setAdmins] = useState(() => [
    ...savedAdmins,
    ...INITIAL_ADMINS.filter((seed) => !savedAdmins.some((admin) => admin.email?.toLowerCase() === seed.email.toLowerCase())),
  ]);
  const [orders, setOrders] = useState(initialState?.orders || INITIAL_ORDERS);

  const savedPosts = initialState?.posts || INITIAL_POSTS;
  const [posts, setPosts] = useState(savedPosts.filter((post) => !(post.type === 'new_product' && post.product && !post.publishAt)));
  const [notifications, setNotifications] = useState(initialState?.notifications || INITIAL_NOTIFICATIONS);
  const [platformSettings, setPlatformSettings] = useState({
    ...PLATFORM_SETTINGS,
    ...(initialState?.platformSettings || {}),
    logo: PLATFORM_SETTINGS.logo,
  });
  const [cart, setCart] = useState(initialState?.cart || []);
  const [chats, setChats] = useState(normalizeChats(initialState?.chats || []));
  const [shopRatings, setShopRatings] = useState(initialState?.shopRatings || []);
  const [favorites, setFavorites] = useState(normalizeFavorites([initialState?.favorites || []]));
  const [accountReports, setAccountReports] = useState(initialState?.accountReports || []);
  /*
    Favourites saved here but not yet confirmed by the server.

    persistState is debounced (REMOTE_PERSIST_DEBOUNCE_MS) and realtime refreshes
    are not, so between the tap and the write there is a window where the row exists
    locally and not remotely. The refresh reconciles a favourite the server lacks
    by removing it -- that is how an un-save on another device arrives -- and
    without this set it would also remove every favourite saved inside that
    window. Entries are dropped as soon as the server is seen to hold them.

    A Set of keys rather than a count: the same dish can be saved, removed and
    saved again inside one window, and a counter could not tell those apart.
  */
  const pendingFavoritesRef = useRef(new Set());
  /*
    Latched while the server is refusing favourites writes.

    The refresh tick treats "on the server but not here" as "removed on another
    device" and deletes the local row. That inference is only sound if the server
    is actually able to accept this device's favourites. When the write path is
    broken -- the table was never created, the grant is missing, the session died --
    every favourite is localStorage-only, and a reload empties pendingFavoritesRef,
    so the tick saw an unprotected row the server had never heard of and deleted
    it. That is the whole of "the heart disappears when I reload".

    So a failed write latches this and the tick stops being destructive for as long
    as it is set, falling back to a plain merge (union). Losing cross-device
    un-favouriting for a while is a far better failure than silently destroying
    the customer's list. Any successful write clears it.
  */
  const favoritesWriteBlockedRef = useRef(false);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((message, type = 'success') => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3000);
  }, []);
  const [remoteUser, setRemoteUser] = useState(null);
  const [authError, setAuthError] = useState(supabaseConfigError);
  const [authReady, setAuthReady] = useState(() => Boolean(readCachedAuth().user) || !supabase);
  const refreshInFlightRef = useRef(false);
  const refreshRemoteStateRef = useRef(null);
  const lastRemoteRefreshRef = useRef(0);
  const orderStatusWritesRef = useRef(new Set());
  const [savingOrderIds, setSavingOrderIds] = useState(() => new Set());
  const [ordersRealtimeStatus, setOrdersRealtimeStatus] = useState('connecting');
  const [chatRealtimeStatus, setChatRealtimeStatus] = useState('connecting');
  const authWatchIdRef = useRef(0);
  const lastNotificationIdRef = useRef(0);
  // The signed-in account as of the last render, readable from inside async
  // callbacks whose closure would otherwise capture an older value. Lets a
  // write that started for one account notice it was superseded mid-flight.
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);
  // The signed-in *user*, kept separately because the async write paths compare
  // `target.id` against it. Reading it off `auth` does not work: `auth` is
  // `{ user, role }`, so `auth.id` is undefined, `undefined !== <vendor id>` is
  // always true, and every `updateProfile` call took the "superseded" early
  // return. Nothing was ever written for either role -- a profile save silently
  // did nothing, with no toast and no error.
  const authUserRef = useRef(auth?.user);
  useEffect(() => {
    authUserRef.current = auth?.user;
  }, [auth]);

  // Persist state
  useEffect(() => {
    saveState({ vendors, customers, admins, orders, posts, notifications, platformSettings, cart, chats, shopRatings, favorites, accountReports });
    try {
      localStorage.setItem('kainhub_cart', JSON.stringify(cart));
    } catch {}
    sessionStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(auth));
  }, [auth, vendors, customers, admins, orders, posts, notifications, platformSettings, cart, chats, shopRatings, favorites, accountReports]);

  /*
    The Supabase write is a second, debounced effect rather than sharing the
    local one above. It used to fire on every one of those dependency changes,
    and because the remote write is a sequence of one request per row -- every
    notification, every chat, every order and its items -- a single state change
    fanned out into hundreds of PostgREST calls. Ten state changes in a row
    meant thousands of requests, which is what produced the wall of repeated
    403s and the 57014 "canceling statement due to statement timeout": the
    database was being asked to answer more writes than it could before the
    statement timeout, so it started refusing them.

    Coalescing on a timer collapses a burst of changes into a single pass. The
    newest state is read through a ref at flush time so the debounce never
    persists a stale snapshot, and an in-flight pass is never overlapped.
  */
  const pendingRemoteRef = useRef(null);
  const remoteBusyRef = useRef(false);
  const remoteIdleRef = useRef(Promise.resolve());
  const resetInProgressRef = useRef(false);
  const remoteStateReadyRef = useRef(false);
  const dismissedNotificationKeysRef = useRef(new Set());
  const mergeRemoteNotifications = (current, remote) => {
    const visible = (rows) => (rows || []).filter(
      (notification) => !dismissedNotificationKeysRef.current.has(notificationKey(notification))
    );
    const currentById = new Map(visible(current).map((notification) => [notificationKey(notification), notification]));
    return reconcileRemoteRows(visible(current), visible(remote)).map((notification) => (
      currentById.get(notificationKey(notification))?.read && !notification.read
        ? { ...notification, read: true }
        : notification
    ));
  };
  useEffect(() => {
    if (!isSupabaseConfigured || !remoteUser || !remoteStateReadyRef.current) {
      pendingRemoteRef.current = null;
      return undefined;
    }
    pendingRemoteRef.current = {
      state: {
        auth,
        vendors,
        orders,
        posts,
        chats,
        notifications: notifications.filter((notification) => (
          !dismissedNotificationKeysRef.current.has(notificationKey(notification))
        )),
        favorites,
      },
      authUser: remoteUser,
    };
    const flushPendingWrites = async () => {
      if (remoteBusyRef.current || resetInProgressRef.current) return;
      if (!pendingRemoteRef.current) return;
      remoteBusyRef.current = true;
      const writePass = (async () => {
        try {
          while (pendingRemoteRef.current && !resetInProgressRef.current) {
            const pending = pendingRemoteRef.current;
            pendingRemoteRef.current = null;
            try {
              await persistState(pending.state, pending.authUser, {
                onFavoritesWritten: (rows) => {
                  rows.forEach((row) => pendingFavoritesRef.current.delete(favoriteKey(row)));
                  favoritesWriteBlockedRef.current = false;
                },
                onFavoritesWriteFailed: () => {
                  favoritesWriteBlockedRef.current = true;
                },
              });
            } catch {
              // persistState reports per-table failures; continue with newer queued state.
            }
          }
        } finally {
          remoteBusyRef.current = false;
        }
      })();
      remoteIdleRef.current = writePass;
      await writePass;
    };
    const timer = setTimeout(flushPendingWrites, REMOTE_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [auth, vendors, customers, orders, posts, notifications, platformSettings, cart, chats, favorites, remoteUser]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const isResetPath = window.location.pathname === '/reset-password';
    const requestedResetRole = new URLSearchParams(window.location.search).get('role');
    const resetRole = ['admin', 'vendor', 'customer'].includes(requestedResetRole)
      ? requestedResetRole
      : 'customer';
    const pathRole = isResetPath
      ? resetRole
      : window.location.pathname.startsWith('/admin')
      ? 'admin'
      : window.location.pathname.startsWith('/vendor')
        ? 'vendor'
        : 'customer';
    let activeRole = pathRole;
    let active = true;
    let unsubscribe = () => {};
    let currentClient = null;
    const hydrate = async (session, portalRole = activeRole, watchId) => {
      if (!session?.user || !active || watchId !== authWatchIdRef.current) return;
      remoteStateReadyRef.current = false;
      setRemoteUser(session.user);
      const client = getSupabaseClient(portalRole);
      const profile = await getProfile(session.user.id, portalRole);
      const { data: vendor, error: vendorError } = await client
        .from('vendors')
        .select('*')
        .eq('owner_id', session.user.id)
        .maybeSingle();
      if (!active || watchId !== authWatchIdRef.current) return;
      if (vendorError) {
        setRemoteUser(null);
        setAuth({ user: null, role: null });
        setAuthError(`Vendor profile could not be loaded: ${vendorError.message}`);
        setAuthReady(true);
        return;
      }
      const role = profile?.role === 'admin'
        ? 'admin'
        : vendor
          ? 'vendor'
          : (profile?.role || session.user.user_metadata?.role || (portalRole === 'customer' ? 'customer' : null));
      if (!role) {
        setAuthError('Your account profile is incomplete. Add a customer, vendor, or admin role in Supabase, then sign in again.');
        setAuthReady(true);
        return;
      }
      if (role === 'customer' && profile?.status === 'suspended') {
        await client.auth.signOut({ scope: 'local' });
        if (!active || watchId !== authWatchIdRef.current) return;
        setRemoteUser(null);
        setAuth({ user: null, role: null });
        setAuthError('Your customer account has been suspended. Contact support for help.');
        setAuthReady(true);
        return;
      }
      if (role === 'admin') {
        setVendors([]);
        setPosts([]);
        setOrders([]);
        setNotifications([]);
        setCustomers([]);
        setChats([]);
        setAccountReports([]);
      }
      setAuthError('');
      const user = {
        ...(vendor ? {
          ...vendor,
          id: asNumber(vendor.legacy_id ?? vendor.id),
          ownerId: vendor.owner_id,
          ownerName: vendor.owner_name,
          storeStatus: normalizeStoreStatus(vendor.store_status),
          deliveryAvailable: vendor.delivery_available,
          /*
            Read-back for the shop logo and cover.

            `persistProfile` mirrors a vendor's `logo` into `profiles.avatar`, so
            a vendor whose `vendors` write was dropped still has their photo when
            they sign back in -- the same guarantee a customer gets from the
            profiles upsert. `vendor.logo` stays the source of truth and only
            falls back here when it is empty, so this cannot clobber a shop image
            that did save.
          */
          logo: vendor.logo || profile?.avatar || vendor.logo,
          coverImage: vendor.cover_image || profile?.cover_image || vendor.cover_image,
          menu: [],
        } : {}),
        ...profile,
        id: vendor ? asNumber(vendor.legacy_id ?? vendor.id) : session.user.id,
        ownerId: vendor?.owner_id,
        email: session.user.email,
        fullName: profile?.full_name || session.user.user_metadata?.fullName || '',
        coverImage: profile?.cover_image || profile?.coverImage || '',
        role,
      };
      if (vendor) {
        // `...profile` lands after the vendor block above and carries the raw
        // `avatar`/`cover_image` column names, which is not what the vendor UI
        // reads. Re-assert the merged values so the spread order cannot undo them.
        user.logo = vendor.logo || profile?.avatar || '';
        user.coverImage = vendor.cover_image || profile?.cover_image || '';
      }
      setAuth({ user, role });
      let remote;
      try {
        remote = await loadRemoteState(session.user.id, role);
      } catch (error) {
        if (!active || watchId !== authWatchIdRef.current) return;
        remoteStateReadyRef.current = false;
        const message = error instanceof Error ? error.message : 'Unknown database error.';
        setAuthError(`Admin data could not be loaded from Supabase: ${message}`);
        setAuthReady(true);
        return;
      }
      if (!active || watchId !== authWatchIdRef.current || !remote) return;
      remoteStateReadyRef.current = true;
      replaceCachedPosts(remote.posts || []);
      if (role === 'customer' && remote.shopRatings !== null) {
        setShopRatings(remote.shopRatings || []);
      } else if (role !== 'customer') {
        setShopRatings([]);
      }
      if (role === 'admin') {
        setVendors(hydrateLocalVendorOverlay(remote.vendors || []));
      } else if (remote.vendors?.length) {
        setVendors((current) => {
          const next = mergeById(current, hydrateLocalVendorOverlay(remote.vendors));
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (role === 'vendor') {
          const remoteVendor = remote.vendors.find((item) => (
            String(item.ownerId) === String(session.user.id) || String(item.id) === String(user.id)
          ));
          if (remoteVendor) setAuth((current) => ({
            ...current,
            user: { ...current.user, ...remoteVendor, role: 'vendor', menu: remoteVendor.menu || [] },
          }));
        }
      }
      if (role === 'admin') {
        setPosts(remote.posts || []);
        setOrders(remote.orders || []);
        if (Array.isArray(remote.notifications)) setNotifications((current) => {
          const next = mergeRemoteNotifications(current, remote.notifications);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        setCustomers(remote.customers || []);
        setChats(normalizeChats(remote.chats || []));
        setAccountReports(remote.accountReports || []);
      } else {
        setPosts(remote.posts || []);
        if (remote.orders?.length) setOrders((current) => {
          const next = mergeOrders([current, remote.orders]);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (remote.notifications?.length) setNotifications((current) => {
          const next = mergeRemoteNotifications(current, remote.notifications);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (remote.customers?.length) setCustomers((current) => {
          const next = mergeById(current, remote.customers);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (remote.chats?.length) setChats((current) => {
          const next = normalizeChats([...current, ...remote.chats]);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
      }
      /*
        Favourites merge rather than replace. A sign-in on a second device should
        bring the server's list down without discarding a favourite the customer
        just added on this one -- but the rows are only ever added from this
          device, and removal propagates through persistFavorites, so a union is the
          correct direction. `userId` is not filtered here: loadRemoteState already
          scoped the query to this uid, and the rows are keyed by it.

          This site cannot remove anything, so it is safe on a sign-in where the
          write has not happened yet. The refresh tick below is the one that has
          to distinguish "not saved" from "not written yet".
        */
      if (remote.favorites?.length) {
        remote.favorites.forEach((row) => pendingFavoritesRef.current.delete(favoriteKey(row)));
        setFavorites((current) => {
          const next = mergeFavorites(current, remote.favorites);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
      }
      if (role === 'customer') setCustomers((current) => current.some((c) => c.id === user.id) ? current : [...current, user]);
      lastRemoteRefreshRef.current = Date.now();
      setAuthReady(true);
    };
    const watchRole = async (role) => {
      const watchId = ++authWatchIdRef.current;
      remoteStateReadyRef.current = false;

      unsubscribe();
      activeRole = role;
      sessionStorage.setItem(ACTIVE_PORTAL_KEY, role);
      currentClient = getSupabaseClient(role);
      const recoveryUrl = isResetPath ? new URL(window.location.href) : null;
      const recoveryCode = recoveryUrl?.searchParams.get('code');
      let recoverySession = null;
      if (recoveryCode) {
        recoveryUrl.searchParams.delete('code');
        window.history.replaceState(
          window.history.state,
          '',
          `${recoveryUrl.pathname}${recoveryUrl.search}${recoveryUrl.hash}`,
        );
        const recovery = await currentClient.auth.exchangeCodeForSession(recoveryCode);
        if (watchId !== authWatchIdRef.current) return;
        if (recovery.error || !recovery.data?.session) {
          setRemoteUser(null);
          setAuth({ user: null, role: null });
          setAuthError(`Unable to verify your password reset link: ${recovery.error?.message || 'No recovery session was returned.'}`);
          setAuthReady(true);
          return;
        }
        recoverySession = recovery.data.session;
      }
      const { data, error } = recoverySession
        ? { data: { session: recoverySession }, error: null }
        : await currentClient.auth.getSession();
      if (watchId !== authWatchIdRef.current) return;
      if (error) {
        setRemoteUser(null);
        setAuth({ user: null, role: null });
        setAuthError(`Unable to restore your Supabase session: ${error.message}`);
        setAuthReady(true);
        return;
      }
      if (!data.session) {
        setRemoteUser(null);
        setAuth({ user: null, role: null });
      } else {
        await hydrate(data.session, role, watchId);
      }
      const { data: listener } = currentClient.auth.onAuthStateChange((event, session) => {
        if (watchId !== authWatchIdRef.current || activeRole !== role) return;
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
        if (session) void hydrate(session, role, watchId);
        else if (event === 'SIGNED_OUT') {
          // Supabase can briefly emit SIGNED_OUT while a persisted session is
          // being restored after a tab becomes active. Confirm before clearing
          // the UI session so tab switching cannot log the user out.
          window.setTimeout(async () => {
            if (watchId !== authWatchIdRef.current || activeRole !== role) return;
            const { data } = await currentClient.auth.getSession();
            if (!data.session && watchId === authWatchIdRef.current) {
              setRemoteUser(null);
              setAuth({ user: null, role: null });
            }
          }, 1000);
        }
      });
      unsubscribe = () => listener.subscription.unsubscribe();
      setAuthReady(true);
    };
    const handlePortalChange = (event) => {
      const role = event.detail;
      if (role === 'admin' || role === 'vendor' || role === 'customer') void watchRole(role);
    };
    const refreshVisibleSession = async () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRemoteRefreshRef.current < 2000) return;
      const watchId = authWatchIdRef.current;
      const role = activeRole;
      const client = getSupabaseClient(role);
      const { data } = await client.auth.getSession();
      if (!active || watchId !== authWatchIdRef.current) return;
      if (!data.session) {
        setRemoteUser(null);
        setAuth({ user: null, role: null });
        setAuthReady(true);
        return;
      }
      if (refreshRemoteStateRef.current) void refreshRemoteStateRef.current();
    };
    window.addEventListener(PORTAL_CHANGE_EVENT, handlePortalChange);
    document.addEventListener('visibilitychange', refreshVisibleSession);
    void watchRole(activeRole).catch(() => setAuthReady(true));
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener(PORTAL_CHANGE_EVENT, handlePortalChange);
      document.removeEventListener('visibilitychange', refreshVisibleSession);
    };
  }, []);

  // Keep separate portal tabs in sync with orders, posts, and chats.
  useEffect(() => {
    if (!isSupabaseConfigured || !remoteUser || !auth.role) return undefined;
    let active = true;
    let refreshQueued = false;
    let refreshTimer = null;
    let orderRefreshInFlight = false;
    let orderRefreshQueued = false;
    let orderRefreshTimer = null;
    const finishRefresh = () => {
      refreshInFlightRef.current = false;
      if (active && refreshQueued) {
        refreshQueued = false;
        scheduleRefresh();
      }
    };
    const refresh = async () => {
      if (refreshInFlightRef.current) {
        refreshQueued = true;
        return;
      }
      refreshInFlightRef.current = true;
      if (auth.role === 'customer') {
        let profile;
        try {
          profile = await getProfile(remoteUser.id, auth.role);
        } catch (error) {
          setOrdersRealtimeStatus('reconnecting');
          setChatRealtimeStatus('reconnecting');
          console.error('[customer] account status refresh failed:', error);
          finishRefresh();
          return;
        }
        if (!active) {
          finishRefresh();
          return;
        }
        if (profile?.status === 'suspended') {
          const client = getSupabaseClient(auth.role);
          const { error } = await client.auth.signOut({ scope: 'local' });
          if (error) console.error('[customer] unable to clear suspended session:', error.message);
          setRemoteUser(null);
          setAuth({ user: null, role: null });
          setAuthError('Your customer account has been suspended. Contact support for help.');
          setAuthReady(true);
          remoteStateReadyRef.current = false;
          finishRefresh();
          return;
        }
      }
      let remote;
      try {
        remote = await loadRemoteState(remoteUser.id, auth.role);
      } catch (error) {
        setOrdersRealtimeStatus('reconnecting');
        setChatRealtimeStatus('reconnecting');
        if (active && auth.role === 'admin') {
          const message = error instanceof Error ? error.message : 'Unknown database error.';
          console.error('[admin] database refresh failed:', message);
          showToast(`Admin data refresh failed: ${message}`, 'error');
        }
        finishRefresh();
        return;
      }
      if (!active || !remote) {
        finishRefresh();
        return;
      }
      lastRemoteRefreshRef.current = Date.now();
      replaceCachedPosts(remote.posts || []);
      if (auth.role === 'admin') {
        setVendors(hydrateLocalVendorOverlay(remote.vendors || []));
        updateIfChanged(setPosts, remote.posts || []);
        setOrders(remote.orders || []);

        if (Array.isArray(remote.notifications)) setNotifications((current) => {
          const next = mergeRemoteNotifications(current, remote.notifications);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        setCustomers(remote.customers || []);
        setChats(normalizeChats(remote.chats || []));
        setAccountReports((current) => (
          JSON.stringify(current) === JSON.stringify(remote.accountReports || [])
            ? current
            : remote.accountReports || []
        ));
      } else {

        if (Array.isArray(remote.vendors)) setVendors((current) => {
          const next = reconcileRemoteRows(current, hydrateLocalVendorOverlay(remote.vendors));
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (Array.isArray(remote.posts)) updateIfChanged(setPosts, remote.posts);
        if (Array.isArray(remote.orders)) setOrders((current) => {
          const next = reconcileRemoteRows(current, remote.orders);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (Array.isArray(remote.notifications)) setNotifications((current) => {
          const next = mergeRemoteNotifications(current, remote.notifications);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (Array.isArray(remote.customers)) setCustomers((current) => {
          const next = reconcileRemoteRows(current, remote.customers);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
        if (Array.isArray(remote.chats)) setChats((current) => {
          const localOnlyChats = current.filter((chat) => (
            chat?.id != null
            && chat.created_at == null
            && chat.legacy_id == null
            && !remote.chats.some((remoteChat) => String(remoteChat.id) === String(chat.id))
          ));
          const next = normalizeChats([...remote.chats, ...localOnlyChats]);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
      }
      if (auth.role === 'customer' && remote.shopRatings !== null) {
        setShopRatings(remote.shopRatings || []);
      }
      /*
        Merged on the refresh tick as well as at sign-in. Un-favouriting on another
        device has to reach this one, and a merge cannot do that on its own -- so
          the removal is applied first and the server's rows are then folded in. The
          filter is scoped to the signed-in account, so a row belonging to somebody
          else is never touched, and a row still waiting to be written is held
          aside rather than treated as removed.
        */
      if (auth.role === 'customer' && remote.favorites) {
        const remoteKeys = new Set(remote.favorites.map(favoriteKey));
        /*
          Anything the server holds is confirmed, so it no longer needs the
          protection below and stops occupying the set.
        */
        remoteKeys.forEach((key) => pendingFavoritesRef.current.delete(key));
        const pending = pendingFavoritesRef.current;
        /*
          A pending row has only ever been added seconds ago, so it is safe to wait
          one tick for its write to land. A row that is neither pending nor on the
          server means either "removed on another device" (delete it) or "the
          server never took our copy" (keep it). Which one it is cannot be told
          from this data alone, and guessing wrong deletes a favourite the customer
          is looking at. So the deletion is skipped entirely while the write path is
          known to be failing, and the list degrades to a union instead.
        */
        const writeBlocked = favoritesWriteBlockedRef.current;
        setFavorites((current) => {
          /*
            Only rows this account owns are reconciled. localStorage is shared
            across accounts on one device, so a customer who signs out and a
            second one signs in would otherwise have the first one's favourites
            compared against the second one's server list and deleted -- so the
            other accounts' rows are carried through untouched rather than
            filtered out and then dropped by the merge.
          */
          const isMine = (favorite) => String(favorite.userId) === String(remoteUser.id);
          const others = current.filter((favorite) => !isMine(favorite));
          const kept = current.filter((favorite) => {
            if (!isMine(favorite)) return false;
            if (remoteKeys.has(favoriteKey(favorite)) || pending.has(favoriteKey(favorite))) return true;
            return writeBlocked;
          });
          const next = mergeFavorites([...others, ...kept], remote.favorites);
          return JSON.stringify(current) === JSON.stringify(next) ? current : next;
        });
      }
      finishRefresh();
    };
    const refreshOrders = async () => {
      if (orderRefreshInFlight) {
        orderRefreshQueued = true;
        return;
      }
      orderRefreshInFlight = true;
      try {
        const remoteOrders = await loadRemoteOrders(remoteUser.id, auth.role);
        if (active && remoteOrders) {
          setOrders((current) => {
            const next = reconcileRemoteRows(current, remoteOrders);
            return JSON.stringify(current) === JSON.stringify(next) ? current : next;
          });
          setOrdersRealtimeStatus('connected');
        }
      } catch (error) {
        if (active) {
          setOrdersRealtimeStatus('reconnecting');
          console.error('[orders] realtime refresh failed:', error);
        }
      } finally {
        orderRefreshInFlight = false;
        if (active && orderRefreshQueued) {
          orderRefreshQueued = false;
          scheduleOrderRefresh();
        }
      }
    };
    const scheduleOrderRefresh = () => {
      if (orderRefreshTimer !== null) window.clearTimeout(orderRefreshTimer);
      orderRefreshTimer = window.setTimeout(() => {
        orderRefreshTimer = null;
        void refreshOrders();
      }, REALTIME_ORDER_REFRESH_DEBOUNCE_MS);
    };
    refreshRemoteStateRef.current = refresh;
    let fallbackInterval = null;
    let subscribed = false;
    const startFallbackPolling = () => {
      if (fallbackInterval !== null) return;
      fallbackInterval = window.setInterval(() => {
        void refresh().catch(() => {
          finishRefresh();
        });
      }, REALTIME_FALLBACK_POLL_MS);
    };
    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refresh().catch(() => {
          finishRefresh();
        });
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    startFallbackPolling();
    const client = getSupabaseClient(auth.role);
    const channel = client?.channel(`app-data-${auth.role}-${remoteUser.id}`);
    if (channel) {
      REALTIME_TABLES.forEach((table) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
      });
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleOrderRefresh);
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, scheduleOrderRefresh);
      channel.subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setOrdersRealtimeStatus('connected');
          setChatRealtimeStatus('connected');
          if (fallbackInterval !== null) {
            window.clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
          if (!subscribed) {
            subscribed = true;
            scheduleRefresh();
          }
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setOrdersRealtimeStatus('reconnecting');
          setChatRealtimeStatus('reconnecting');
          startFallbackPolling();
        }
      });
    } else {
      setOrdersRealtimeStatus('reconnecting');
      setChatRealtimeStatus('reconnecting');
    }

    return () => {
      active = false;
      if (refreshRemoteStateRef.current === refresh) refreshRemoteStateRef.current = null;
      if (fallbackInterval !== null) window.clearInterval(fallbackInterval);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      if (orderRefreshTimer !== null) window.clearTimeout(orderRefreshTimer);
      if (channel) void client.removeChannel(channel);
    };
  }, [auth.role, remoteUser, showToast]);

  // Sync shared app data across open browser tabs in real time.
  useEffect(() => {
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(FEED_CHANNEL) : null;
    const handleStorageUpdate = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const nextState = JSON.parse(event.newValue);
        // Another tab holds the authoritative copy of the shared lists, but its
        // vendors/customers/notifications are the whole state for that tab. Fold
        // rather than replace so a row the writer's own tab knows about and this
        // one does not is not destroyed on every storage event.
        /*
          Overlaid before the merge so an unresolved admin approval survives a
          stale cross-tab list. When the admin approves, the vendor portal tab is
          still holding `pending`; when it writes its own state back, the
          `storage` event used to hand that old value to `mergeById`, which lets
          the incoming list win -- and the admin's row flipped straight back to
          Pending. The overlay re-applies any decision still inside its pin
          window, so the incoming stale row cannot undo it.
        */
        if (nextState.vendors) setVendors((current) => mergeById(current, hydrateLocalVendorOverlay(nextState.vendors)));
        if (nextState.customers) setCustomers((current) => mergeById(current, nextState.customers));
        if (nextState.orders) updateIfChanged(setOrders, nextState.orders);
        if (!isSupabaseConfigured && nextState.posts) updateIfChanged(setPosts, mergePosts([nextState.posts]));
        if (nextState.notifications) setNotifications((current) => mergeRemoteNotifications(current, nextState.notifications));
        if (nextState.platformSettings) {
          updateIfChanged(setPlatformSettings, { ...nextState.platformSettings, logo: PLATFORM_SETTINGS.logo });
        }
        if (nextState.chats) setChats((current) => mergeChats(current, nextState.chats));
        if (nextState.accountReports) updateIfChanged(setAccountReports, nextState.accountReports);
        /*
          Replaced, not folded. The writer's copy is the whole shared truth for
          every account at once -- saveState writes the full favourites list rather
          than merging, precisely so a removal survives -- so folding here would
          resurrect anything the other tab had just un-favourited. Folding is still
          correct for the other lists above because none of them is ever deleted by
          the customer who owns it.
        */
        if (nextState.favorites) updateIfChanged(setFavorites, normalizeFavorites([nextState.favorites]));
      } catch {}
    };

    const handleFeedUpdate = (event) => {
      if (isSupabaseConfigured) return;
      if (!event.data?.posts) return;
      setPosts((current) => {
        // `current` has to be one of the merge inputs, not just the remote list.
        // Passing only the sender's posts turned this into a replace: two tabs
        // each holding a post the other did not have deleted each other's on
        // every broadcast and rebroadcast the result forever.
        const nextPosts = mergePosts([current, event.data.posts]);
        return JSON.stringify(current) === JSON.stringify(nextPosts) ? current : nextPosts;
      });
    };

    window.addEventListener('storage', handleStorageUpdate);
    channel?.addEventListener('message', handleFeedUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      channel?.removeEventListener('message', handleFeedUpdate);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return undefined;
    const channel = new BroadcastChannel(FEED_CHANNEL);
    channel.postMessage({ posts });
    channel.close();
    return undefined;
  }, [posts]);

  /*
    notifications.legacy_id is a bigint and the only thing the upsert in
    src/lib/supabase/state.js can conflict on, so a locally created notification
    must carry a plain integer id. The old string ids (`login-<ts>-<rand>`) went
    through Number() to NaN, which serialises to JSON null, and a null legacy_id
    never matches ON CONFLICT: every single state change inserted another copy
    of the row with created_at = now(). That is why "New login detected" came
    back on every reload even though the notification is only created in login().
    Monotonic so two notifications created in the same millisecond still differ.
  */
  const nextNotificationId = useCallback(() => {
    lastNotificationIdRef.current = Math.max(Date.now(), lastNotificationIdRef.current + 1);
    return lastNotificationIdRef.current;
  }, []);

  const notifyAdminOfRegistration = useCallback((role, data, email) => {
    const roleLabel = role === 'vendor' ? 'vendor' : 'customer';
    const name = role === 'vendor' ? data.shopName || data.ownerName : data.fullName;
    const notification = {
      id: nextNotificationId(),
      userId: 'admin',
      type: 'account',
      title: `New ${roleLabel} account`,
      message: `${name || email} created a new ${roleLabel} account.`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((current) => [notification, ...current]);
    showToast(`New ${roleLabel} account registered.`, 'info');
  }, [showToast, nextNotificationId]);

  const notifyAccountLogin = useCallback((user, role) => {
    const roleLabel = role === 'admin' ? 'admin' : role === 'vendor' ? 'vendor' : 'customer';
    const notification = {
      id: nextNotificationId(),
      userId: user.id,
      type: 'security',
      title: 'New login detected',
      message: `Your ${roleLabel} account was signed in at ${new Date().toLocaleString()}.`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((current) => [notification, ...current]);
  }, [nextNotificationId]);

  /*
    The database records failed-login alerts for the account owner. This local
    fallback is only for accounts already present in local state, such as a
    deployment without the lockout RPC; it must never send a target account's
    sign-in details to the admin desk.
  */
  const notifyFailedLogin = useCallback((email, role, details = {}) => {
    const normalizedEmail = email.toLowerCase().trim();
    const account = role === 'customer'
      ? customers.find((item) => item.email?.toLowerCase() === normalizedEmail)
      : role === 'vendor'
        ? vendors.find((item) => item.email?.toLowerCase() === normalizedEmail)
        : admins.find((item) => item.email?.toLowerCase() === normalizedEmail);
    if (account?.id == null) return;
    const attempts = Math.max(2, Number(details.attempts) || 2);
    const attemptLabel = `${attempts} incorrect password attempt${attempts === 1 ? '' : 's'}`;
    const consequence = details.permanent
      ? 'The account is now permanently locked until it is recovered by email.'
      : details.locked
        ? 'The account is temporarily locked for a security cooldown.'
        : 'The account is not locked yet; another wrong answer will lock it.';
    const notification = {
      id: nextNotificationId(),
      userId: account.id,
      type: 'security',
      title: details.locked ? 'Account locked after failed logins' : 'Multiple failed login attempts',
      message: `${attemptLabel} on your ${role} account at ${new Date().toLocaleString()}. ${consequence}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((current) => [notification, ...current]);
  }, [customers, vendors, admins, nextNotificationId]);

  // AUTH
  const login = useCallback(async (email, password, role) => {
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    const normalizedEmail = email.toLowerCase().trim();
    if (supabase) {
      const remote = await supabaseSignIn(normalizedEmail, password, role);
      if (!remote.error && remote.data?.user) {
        const profile = remote.profile || {};
      const user = {
          ...(remote.vendor ? {
            ...remote.vendor,
            id: asNumber(remote.vendor.legacy_id ?? remote.vendor.id),
            dbId: asNumber(remote.vendor.id),
            ownerId: remote.vendor.owner_id,
            ownerName: remote.vendor.owner_name,
            storeStatus: normalizeStoreStatus(remote.vendor.store_status),
            deliveryAvailable: remote.vendor.delivery_available,
            // Falls back to the profiles mirror, same as `hydrate`. See the note
            // there -- a vendor whose `vendors` write was dropped still signs in
            // with the photo they uploaded.
            logo: remote.vendor.logo || profile?.avatar || '',
            coverImage: remote.vendor.cover_image || profile?.cover_image || '',
            menu: [],
          } : {}),
          ...profile,
          id: role === 'vendor' && remote.vendor ? asNumber(remote.vendor.legacy_id ?? remote.vendor.id) : remote.data.user.id,
          ownerId: role === 'vendor' && remote.vendor ? remote.vendor.owner_id : undefined,
          email: remote.data.user.email,
          fullName: profile.full_name || remote.data.user.user_metadata?.fullName || '',
          role,
        };
        if (role === 'customer' && profile.status === 'suspended') {
          await getSupabaseClient(role)?.auth.signOut({ scope: 'local' });
          return { success: false, message: 'Your account has been suspended.' };
        }
        if (role === 'vendor' && user.status === 'suspended') {
          try { await getSupabaseClient(role)?.auth.signOut(); } catch {}
          return { success: false, message: 'Your account has been suspended.' };
        }
        await forgetPasswordHistoryEntry(normalizedEmail, password);
        setRemoteUser(remote.data.user);
        sessionStorage.setItem(ACTIVE_PORTAL_KEY, role);
        window.dispatchEvent(new CustomEvent(PORTAL_CHANGE_EVENT, { detail: role }));
        setAuthError('');
        setAuth({ user, role });
        try {
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
          const sessionsKey = 'kainhub_login_sessions';
          const existing = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
          const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            email: user.email,
            role,
            userAgent: ua,
            device: /mobile|iphone|ipad|android/i.test(ua) ? 'Mobile device' : 'Desktop/Laptop',
            platform: ua,
            signedInAt: new Date().toISOString(),
            current: true,
            location: '',
          };
          const next = [entry, ...(Array.isArray(existing) ? existing : [])]
            .map((item, index) => ({ ...item, current: index === 0 }))
            .slice(0, 10);
          localStorage.setItem(sessionsKey, JSON.stringify(next));
          // Try to get approximate location (best effort)
          const fetchLocation = async () => {
            try {
              const ipRes = await fetch('https://ipapi.co/json/');
              if (ipRes.ok) {
                const ipData = await ipRes.json();
                const parts = [ipData.city, ipData.region, ipData.country_name].filter(Boolean);
                if (parts.length) {
                  const loc = parts.slice(0, 2).join(', ');
                  const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                  if (Array.isArray(updated)) {
                    const idx = updated.findIndex((s) => s?.id === entry.id);
                    if (idx >= 0) {
                      updated[idx].location = loc;
                      localStorage.setItem(sessionsKey, JSON.stringify(updated));
                      return;
                    }
                  }
                }
              }
            } catch {}
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  (async () => {
                    try {
                      let loc = `Lat ${pos.coords.latitude.toFixed(3)}, Lon ${pos.coords.longitude.toFixed(3)}`;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, {
                          headers: { 'Accept-Language': 'en', 'User-Agent': 'LANCASTER-App' },
                        });
                        if (res.ok) {
                          const data = await res.json();
                          const a = data?.address || {};
                          const parts = [a.city || a.town || a.municipality || a.village, a.state || a.province, a.country].filter(Boolean);
                          if (parts.length) loc = parts.slice(0, 2).join(', ');
                          else if (data?.display_name) loc = data.display_name.split(',').slice(0, 2).join(', ');
                        }
                      } catch {}
                      const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                      if (Array.isArray(updated)) {
                        const idx = updated.findIndex((s) => s?.id === entry.id);
                        if (idx >= 0) {
                          updated[idx].location = loc;
                          localStorage.setItem(sessionsKey, JSON.stringify(updated));
                        }
                      }
                    } catch {}
                  })();
                },
                () => {},
                { timeout: 5000, enableHighAccuracy: false }
              );
            }
          };
          fetchLocation();
        } catch {
          // Login sessions are best-effort only.
        }
        notifyAccountLogin(user, role);
        showToast(`${role === 'admin' ? 'Admin' : role === 'vendor' ? 'Vendor' : 'Customer'} login successful.`, 'success');
        return { success: true };
      }
      // A configured Supabase project is authoritative. Falling through to
      // seeded/local credentials here let a demo admin appear signed in without
      // a Supabase session, so admin actions were correctly rejected by RLS.
      const oldEntry = await findPasswordHistoryEntry(normalizedEmail, password);
      return {
        success: false,
        message: remote.error?.message || 'Unable to sign in with this Supabase account.',
        oldPassword: Boolean(oldEntry),
        oldPasswordChangedAt: oldEntry?.changedAt || null,
        countAttempt: remote.countAttempt === true,
        locked: remote.locked === true,
        permanent: remote.permanent === true,
        secondsRemaining: remote.secondsRemaining,
        failedAttempts: remote.failedAttempts,
        attemptsRemaining: remote.attemptsRemaining,
        alerted: remote.alerted === true,
      };
    }
    if (role === 'customer') {
      const customer = customers.find(
        (c) => (c.email?.toLowerCase() === normalizedEmail || c.mobile === email.trim()) && c.password === password
      );
      if (customer) {
        if (customer.status === 'suspended') {
          return { success: false, message: 'Your account has been suspended.' };
        }
        const user = { ...customer, role: 'customer' };
        setAuth({ user, role: 'customer' });
        try {
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
          const sessionsKey = 'kainhub_login_sessions';
          const existing = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
          const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            email: user.email,
            role: 'customer',
            userAgent: ua,
            device: /mobile|iphone|ipad|android/i.test(ua) ? 'Mobile device' : 'Desktop/Laptop',
            platform: ua,
            signedInAt: new Date().toISOString(),
            current: true,
            location: '',
          };
          const next = [entry, ...(Array.isArray(existing) ? existing : [])]
            .map((item, index) => ({ ...item, current: index === 0 }))
            .slice(0, 10);
          localStorage.setItem(sessionsKey, JSON.stringify(next));
          const fetchLocation = async () => {
            try {
              const ipRes = await fetch('https://ipapi.co/json/');
              if (ipRes.ok) {
                const ipData = await ipRes.json();
                const parts = [ipData.city, ipData.region, ipData.country_name].filter(Boolean);
                if (parts.length) {
                  const loc = parts.slice(0, 2).join(', ');
                  const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                  if (Array.isArray(updated)) {
                    const idx = updated.findIndex((s) => s?.id === entry.id);
                    if (idx >= 0) {
                      updated[idx].location = loc;
                      localStorage.setItem(sessionsKey, JSON.stringify(updated));
                      return;
                    }
                  }
                }
              }
            } catch {}
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  (async () => {
                    try {
                      let loc = `Lat ${pos.coords.latitude.toFixed(3)}, Lon ${pos.coords.longitude.toFixed(3)}`;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, {
                          headers: { 'Accept-Language': 'en', 'User-Agent': 'LANCASTER-App' },
                        });
                        if (res.ok) {
                          const data = await res.json();
                          const a = data?.address || {};
                          const parts = [a.city || a.town || a.municipality || a.village, a.state || a.province, a.country].filter(Boolean);
                          if (parts.length) loc = parts.slice(0, 2).join(', ');
                          else if (data?.display_name) loc = data.display_name.split(',').slice(0, 2).join(', ');
                        }
                      } catch {}
                      const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                      if (Array.isArray(updated)) {
                        const idx = updated.findIndex((s) => s?.id === entry.id);
                        if (idx >= 0) {
                          updated[idx].location = loc;
                          localStorage.setItem(sessionsKey, JSON.stringify(updated));
                        }
                      }
                    } catch {}
                  })();
                },
                () => {},
                { timeout: 5000, enableHighAccuracy: false }
              );
            }
          };
          fetchLocation();
        } catch {}
        notifyAccountLogin(user, 'customer');
        showToast('Customer login successful.', 'success');
        return { success: true };
      }
    } else if (role === 'vendor') {
      const vendor = vendors.find(
        (v) => v.email?.toLowerCase() === normalizedEmail && v.password === password
      );
      if (vendor) {
        if (vendor.status === 'suspended') {
          return { success: false, message: 'Your account has been suspended.' };
        }
        const user = { ...vendor, role: 'vendor' };
        setAuth({ user, role: 'vendor' });
        try {
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
          const sessionsKey = 'kainhub_login_sessions';
          const existing = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
          const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            email: user.email,
            role: 'vendor',
            userAgent: ua,
            device: /mobile|iphone|ipad|android/i.test(ua) ? 'Mobile device' : 'Desktop/Laptop',
            platform: ua,
            signedInAt: new Date().toISOString(),
            current: true,
            location: '',
          };
          const next = [entry, ...(Array.isArray(existing) ? existing : [])]
            .map((item, index) => ({ ...item, current: index === 0 }))
            .slice(0, 10);
          localStorage.setItem(sessionsKey, JSON.stringify(next));
          const fetchLocation = async () => {
            try {
              const ipRes = await fetch('https://ipapi.co/json/');
              if (ipRes.ok) {
                const ipData = await ipRes.json();
                const parts = [ipData.city, ipData.region, ipData.country_name].filter(Boolean);
                if (parts.length) {
                  const loc = parts.slice(0, 2).join(', ');
                  const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                  if (Array.isArray(updated)) {
                    const idx = updated.findIndex((s) => s?.id === entry.id);
                    if (idx >= 0) {
                      updated[idx].location = loc;
                      localStorage.setItem(sessionsKey, JSON.stringify(updated));
                      return;
                    }
                  }
                }
              }
            } catch {}
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  (async () => {
                    try {
                      let loc = `Lat ${pos.coords.latitude.toFixed(3)}, Lon ${pos.coords.longitude.toFixed(3)}`;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, {
                          headers: { 'Accept-Language': 'en', 'User-Agent': 'LANCASTER-App' },
                        });
                        if (res.ok) {
                          const data = await res.json();
                          const a = data?.address || {};
                          const parts = [a.city || a.town || a.municipality || a.village, a.state || a.province, a.country].filter(Boolean);
                          if (parts.length) loc = parts.slice(0, 2).join(', ');
                          else if (data?.display_name) loc = data.display_name.split(',').slice(0, 2).join(', ');
                        }
                      } catch {}
                      const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                      if (Array.isArray(updated)) {
                        const idx = updated.findIndex((s) => s?.id === entry.id);
                        if (idx >= 0) {
                          updated[idx].location = loc;
                          localStorage.setItem(sessionsKey, JSON.stringify(updated));
                        }
                      }
                    } catch {}
                  })();
                },
                () => {},
                { timeout: 5000, enableHighAccuracy: false }
              );
            }
          };
          fetchLocation();
        } catch {}
        notifyAccountLogin(user, 'vendor');
        showToast('Vendor login successful.', 'success');
        return { success: true };
      }
    } else if (role === 'admin') {
      const admin = admins.find(
        (a) => a.email?.toLowerCase() === normalizedEmail && a.password === password
      );
      if (admin) {
        const user = { ...admin, role: 'admin' };
        setAuth({ user, role: 'admin' });
        try {
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
          const sessionsKey = 'kainhub_login_sessions';
          const existing = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
          const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            email: user.email,
            role: 'admin',
            userAgent: ua,
            device: /mobile|iphone|ipad|android/i.test(ua) ? 'Mobile device' : 'Desktop/Laptop',
            platform: ua,
            signedInAt: new Date().toISOString(),
            current: true,
            location: '',
          };
          const next = [entry, ...(Array.isArray(existing) ? existing : [])]
            .map((item, index) => ({ ...item, current: index === 0 }))
            .slice(0, 10);
          localStorage.setItem(sessionsKey, JSON.stringify(next));
          const fetchLocation = async () => {
            try {
              const ipRes = await fetch('https://ipapi.co/json/');
              if (ipRes.ok) {
                const ipData = await ipRes.json();
                const parts = [ipData.city, ipData.region, ipData.country_name].filter(Boolean);
                if (parts.length) {
                  const loc = parts.slice(0, 2).join(', ');
                  const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                  if (Array.isArray(updated)) {
                    const idx = updated.findIndex((s) => s?.id === entry.id);
                    if (idx >= 0) {
                      updated[idx].location = loc;
                      localStorage.setItem(sessionsKey, JSON.stringify(updated));
                      return;
                    }
                  }
                }
              }
            } catch {}
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  (async () => {
                    try {
                      let loc = `Lat ${pos.coords.latitude.toFixed(3)}, Lon ${pos.coords.longitude.toFixed(3)}`;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, {
                          headers: { 'Accept-Language': 'en', 'User-Agent': 'LANCASTER-App' },
                        });
                        if (res.ok) {
                          const data = await res.json();
                          const a = data?.address || {};
                          const parts = [a.city || a.town || a.municipality || a.village, a.state || a.province, a.country].filter(Boolean);
                          if (parts.length) loc = parts.slice(0, 2).join(', ');
                          else if (data?.display_name) loc = data.display_name.split(',').slice(0, 2).join(', ');
                        }
                      } catch {}
                      const updated = JSON.parse(localStorage.getItem(sessionsKey) || '[]');
                      if (Array.isArray(updated)) {
                        const idx = updated.findIndex((s) => s?.id === entry.id);
                        if (idx >= 0) {
                          updated[idx].location = loc;
                          localStorage.setItem(sessionsKey, JSON.stringify(updated));
                        }
                      }
                    } catch {}
                  })();
                },
                () => {},
                { timeout: 5000, enableHighAccuracy: false }
              );
            }
          };
          fetchLocation();
        } catch {}
        notifyAccountLogin(user, 'admin');
        showToast('Admin login successful.', 'success');
        return { success: true };
      }
    }
    const oldEntry = await findPasswordHistoryEntry(normalizedEmail, password);
    return {
      success: false,
      message: 'Invalid email or password.',
      oldPassword: Boolean(oldEntry),
      oldPasswordChangedAt: oldEntry?.changedAt || null,
      countAttempt: true,
    };
  }, [customers, vendors, admins, notifyAccountLogin, showToast]);

  const requestPhoneOtp = useCallback(async (phone, role) => {
    if (role === 'admin') return { success: false, message: 'Admin login still uses email and password.' };
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    if (!isSupabaseConfigured) return { success: false, message: 'Phone login requires Supabase Phone Auth and an SMS provider.' };
    const result = await supabaseSendPhoneOtp(phone, role);
    return result.error ? { success: false, message: result.error.message } : { success: true, message: 'Verification code sent.' };
  }, []);

  const verifyPhoneOtp = useCallback(async (phone, token, role) => {
    if (role === 'admin') return { success: false, message: 'Admin login still uses email and password.' };
    const remote = await supabaseVerifyPhoneOtp(phone, token, role);
    if (remote.error || !remote.data?.user) return { success: false, message: remote.error?.message || 'Invalid verification code.' };
    const profile = remote.profile || {};
    const user = {
      ...(remote.vendor ? {
        ...remote.vendor,
        id: asNumber(remote.vendor.legacy_id ?? remote.vendor.id),
        ownerId: remote.vendor.owner_id,
        ownerName: remote.vendor.owner_name,
        storeStatus: normalizeStoreStatus(remote.vendor.store_status),
        deliveryAvailable: remote.vendor.delivery_available,
        coverImage: remote.vendor.cover_image,
        menu: [],
      } : {}),
      ...profile,
      id: role === 'vendor' && remote.vendor ? asNumber(remote.vendor.legacy_id ?? remote.vendor.id) : remote.data.user.id,
      ownerId: role === 'vendor' && remote.vendor ? remote.vendor.owner_id : undefined,
      email: remote.data.user.email,
      fullName: profile.full_name || remote.data.user.user_metadata?.fullName || '',
      mobile: remote.data.user.phone || profile.mobile || phone,
      role,
    };
    if (role === 'vendor' && user.status === 'suspended') return { success: false, message: 'Your account has been suspended.' };
    setRemoteUser(remote.data.user);
    sessionStorage.setItem(ACTIVE_PORTAL_KEY, role);
    window.dispatchEvent(new CustomEvent(PORTAL_CHANGE_EVENT, { detail: role }));
    setAuthError('');
    setAuth({ user, role });
    return { success: true };
  }, []);

  const getSupabaseEmailMessage = useCallback((error) => {
    if (!error) return 'Supabase could not send the email.';
    const message = error.message || '';
    const lower = `${error.code || ''} ${message}`.toLowerCase();
    if (/(rate.?limit|too many.*email|too many requests|rate_limit_exceeded)/i.test(lower)) {
      return 'We could not send the email right now. Please try again in a moment.';
    }
    if (/(smtp|provider|email.*disabled|not configured|missing.*smtp|mail.*server)/i.test(lower)) {
      return 'Supabase email is not configured correctly. Enable the Email provider and set a working SMTP sender in Supabase.';
    }
    if (/(already registered|user already registered|email.*already.*use|duplicate.*email)/i.test(lower)) {
      return 'This email is already registered. Please sign in instead.';
    }
    if (/(user not found|not registered|email.*not.*exist|invalid email)/i.test(lower)) {
      return 'This email is not registered yet or the account must be created first.';
    }
    return message || 'Supabase could not send the email.';
  }, []);

  const requestEmailOtp = useCallback(async (email, role) => {
    if (role === 'admin') return { success: false, message: 'Admin login still uses email and password.' };
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    if (!isSupabaseConfigured) return { success: false, message: 'Email code is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart the app.' };
    const result = await supabaseSendEmailOtp(email, role);
    if (result.error) {
      return { success: false, message: getSupabaseEmailMessage(result.error) };
    }
    return { success: true, message: 'Sign-in link sent. Check your email and click the link to continue.' };
  }, [getSupabaseEmailMessage]);

  const verifyEmailOtp = useCallback(async (email, token, role) => {
    if (role === 'admin') return { success: false, message: 'Admin login still uses email and password.' };
    const remote = await supabaseVerifyEmailOtp(email, token, role);
    if (remote.error || !remote.data?.user) return { success: false, message: getSupabaseEmailMessage(remote.error) || 'Invalid verification code.' };
    const profile = remote.profile || {};
    const user = {
      ...(remote.vendor ? { ...remote.vendor, id: asNumber(remote.vendor.legacy_id ?? remote.vendor.id), ownerId: remote.vendor.owner_id, ownerName: remote.vendor.owner_name, storeStatus: normalizeStoreStatus(remote.vendor.store_status), deliveryAvailable: remote.vendor.delivery_available, coverImage: remote.vendor.cover_image, menu: [] } : {}),
      ...profile,
      id: role === 'vendor' && remote.vendor ? asNumber(remote.vendor.legacy_id ?? remote.vendor.id) : remote.data.user.id,
      ownerId: role === 'vendor' && remote.vendor ? remote.vendor.owner_id : undefined,
      email: remote.data.user.email || email,
      fullName: profile.full_name || remote.data.user.user_metadata?.fullName || '',
      role,
    };
    if (role === 'vendor' && user.status === 'suspended') return { success: false, message: 'Your account has been suspended.' };
    setRemoteUser(remote.data.user);
    sessionStorage.setItem(ACTIVE_PORTAL_KEY, role);
    window.dispatchEvent(new CustomEvent(PORTAL_CHANGE_EVENT, { detail: role }));
    setAuthError('');
    setAuth({ user, role });
    return { success: true };
  }, [getSupabaseEmailMessage]);

  const registerCustomer = useCallback(async (data) => {
    const violation = findCharacterLimitViolation(data, {
      fullName: FIELD_CHAR_LIMITS.fullName,
      address: FIELD_CHAR_LIMITS.address,
    });
    if (violation) return { success: false, message: characterLimitMessage(violation.limit) };
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    const email = data.email.toLowerCase().trim();
    if (supabase) {
      const remote = await supabaseSignUp(data, 'customer');
      if (!remote.error) {
        notifyAdminOfRegistration('customer', data, email);
        /*
          With email confirmation on, signUp returns a user but no session.
          setAuth ran anyway, so the customer landed in the authenticated shell
          with no Supabase session and every RLS-guarded read and write failing.
          Tell them to confirm instead of pretending they are signed in.
        */
        if (!remote.data?.session) {
          return { success: true, message: 'Check your email to confirm your account, then sign in.' };
        }
        const user = {
          id: remote.data?.user?.id || Date.now(),
          email,
          fullName: data.fullName,
          mobile: data.mobile,
          address: data.address,
          role: 'customer',
          avatar: '👤',
          status: 'active',
        };
        if (remote.data?.user) {
          setRemoteUser(remote.data.user);
        }
        setAuth({ user, role: 'customer' });
        return { success: true, message: '' };
      }
      const alreadyRegistered = /already registered|user already registered|duplicate.*email/i.test(remote.error?.message || '');
      if (alreadyRegistered) {
        return { success: false, message: 'This email is already registered. Please sign in instead.', redirectToLogin: true };
      }
      if (remote.error?.status !== 404) return { success: false, message: getSupabaseEmailMessage(remote.error) };
    }
    if (customers.find((c) => c.email?.toLowerCase() === email)) {
      return { success: false, message: 'Email already registered.' };
    }
    const newCustomer = {
      id: nextLocalId(),
      fullName: data.fullName,
      mobile: data.mobile,
      email,
      password: data.password,
      address: data.address,
      role: 'customer',
      avatar: '👤',
      status: 'active',
    };
    setCustomers((c) => [...c, newCustomer]);
    setAuth({ user: newCustomer, role: 'customer' });
    return { success: true };
  }, [customers, notifyAdminOfRegistration, getSupabaseEmailMessage]);

  const registerVendor = useCallback(async (data) => {
    const violation = findCharacterLimitViolation({
      ownerName: data.ownerName,
      shopName: data.shopName,
      address: data.shopAddress,
      category: data.category,
      operatingHours: data.operatingHours,
      shopDescription: data.description || '',
    });
    if (violation) return { success: false, message: characterLimitMessage(violation.limit) };
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    const email = data.email.toLowerCase().trim();
    if (supabase) {
      const remote = await supabaseSignUp(data, 'vendor');
      if (!remote.error) {
        notifyAdminOfRegistration('vendor', data, email);
        return { success: true, message: 'Registration submitted. Your shop is pending approval.' };
      }
      const alreadyRegistered = /already registered|user already registered|duplicate.*email/i.test(remote.error?.message || '');
      if (alreadyRegistered) {
        return { success: false, message: 'This email is already registered. Please sign in instead.', redirectToLogin: true };
      }
      if (remote.error?.status !== 404) return { success: false, message: getSupabaseEmailMessage(remote.error) };
    }
    if (vendors.find((v) => v.email?.toLowerCase() === email)) {
      return { success: false, message: 'Email already registered.' };
    }
    const newVendor = {
      id: nextLocalId(),
      ownerName: data.ownerName,
      name: data.shopName,
      mobile: data.mobile,
      email,
      password: data.password,
      address: data.shopAddress,
      category: data.category.trim(),
      categoryId: data.category.trim().toLowerCase().replace(/\s+/g, '-'),
      operatingHours: data.operatingHours,
      description: data.description || '',
      status: 'pending',
      storeStatus: 'CLOSED',
      rating: 0,
      deliveryAvailable: true,
      queue: 0,
      /*
        No stock cover image. This seeded a stock Unsplash restaurant photo on
        every newly registered shop, and because the shop card, the saved-shops
        card and the shop page each treated `coverImage` and `logo` as an
        either/or branch, that default won on every surface -- so a vendor's own
        uploaded logo was never rendered anywhere in the customer portal. With
        covers removed there is nothing to seed; the logo below is the shop's
        only image, and LogoMark falls back to it.
      */
      logo: '🍽️',
      menu: [],
    };
    setVendors((v) => [...v, newVendor]);
    notifyAdminOfRegistration('vendor', data, email);
    return { success: true, message: 'Registration submitted. Please wait for admin approval.' };
  }, [vendors, notifyAdminOfRegistration, getSupabaseEmailMessage]);

  const resetPassword = useCallback(async (email, role = 'customer') => {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return { success: false, message: 'Enter your email address first.' };
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    if (!supabase) return { success: false, message: 'Password reset requires a configured Supabase account.' };
    const result = await supabaseResetPassword(normalizedEmail, role);
    return result.error
      ? { success: false, message: result.error.message }
      : { success: true, message: 'If an account matches that email, password reset instructions will arrive shortly. Check your inbox and spam folder.' };
  }, []);

  const updatePassword = useCallback(async (password, role = auth.role || 'customer') => {
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    const result = await supabaseUpdatePassword(password, role);
    return result.error
      ? { success: false, message: result.error.message }
      : { success: true };
  }, [auth.role]);

  const changePassword = useCallback(async (currentPassword, nextPassword, role = auth.role || 'customer') => {
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    if (!auth.user?.id) return { success: false, message: 'Sign in again before changing your password.' };
    if (!currentPassword) return { success: false, message: 'Enter your current password.' };
    if (!nextPassword) return { success: false, message: 'Enter a new password.' };
    if (currentPassword === nextPassword) {
      return { success: false, message: 'Your new password must be different from your current password.' };
    }

    // Keyed by email so the login screen, which has no signed-in user yet, can
    // find the same history. Falling back to the id keeps accounts without an
    // email working.
    const historyKey = String(auth.user?.email || '').toLowerCase().trim() || auth.user?.id;
    if (await isPasswordReused(historyKey, nextPassword)) {
      return { success: false, message: 'You cannot reuse a recently used password. Choose a new one.' };
    }

    if (isSupabaseConfigured) {
      const result = await supabaseChangePassword(currentPassword, nextPassword, role);
      if (result.error) return { success: false, message: result.error.message };
      // Record only the password that was just replaced, with the moment it was
      // replaced, so a later sign-in with it can say when it changed.
      await rememberPassword(historyKey, currentPassword, { changedAt: new Date().toISOString() });
      return { success: true, message: 'Password changed.' };
    }

    const sameAccount = (account) => (
      String(account.id) === String(auth.user.id)
      || account.email?.toLowerCase() === auth.user.email?.toLowerCase()
    );
    const accounts = role === 'customer' ? customers : role === 'vendor' ? vendors : admins;
    const account = accounts.find(sameAccount);
    if (!account || account.password !== currentPassword) {
      return { success: false, message: 'Your current password is incorrect.' };
    }
    const withPassword = (item) => (sameAccount(item) ? { ...item, password: nextPassword } : item);

    if (role === 'customer') setCustomers((current) => current.map(withPassword));
    else if (role === 'vendor') setVendors((current) => current.map(withPassword));
    else setAdmins((current) => current.map(withPassword));
    setAuth((current) => ({
      ...current,
      user: current.user ? { ...current.user, password: nextPassword } : current.user,
    }));
    await rememberPassword(historyKey, currentPassword, { changedAt: new Date().toISOString() });
    return { success: true, message: 'Password changed.' };
  }, [auth.role, auth.user, admins, customers, vendors]);

  const unlockAccount = useCallback(async (role = auth.role || 'customer') => {
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    const result = await supabaseUnlockAccount(role);
    return result.success
      ? { success: true }
      : { success: false, message: result.error?.message || 'Unable to unlock this account.' };
  }, [auth.role]);

  const logout = useCallback(() => {
    if (isSupabaseConfigured && auth.role) void getSupabaseClient(auth.role)?.auth.signOut();
    sessionStorage.removeItem(ACTIVE_PORTAL_KEY);
    sessionStorage.removeItem(LOCAL_AUTH_KEY);
    setRemoteUser(null);
    setAuthError('');
    setAuth({ user: null, role: null });

    setCart([]);
    // The pending set is keyed by user, so an entry left here would only ever be
    // consulted by that same account again -- but it would then protect a row
    // forever, since nothing will confirm it while nobody is signed in. Clearing
    // it means the next sign-in reconciles from the server as it should.
    pendingFavoritesRef.current.clear();
  }, [auth.role]);

  const updateProfile = useCallback(async (updates) => {
    if (!auth.user) return;
    const violation = findCharacterLimitViolation({
      fullName: updates.fullName,
      ownerName: updates.ownerName,
      shopName: updates.name,
      address: updates.address,
      category: updates.category,
      operatingHours: updates.operatingHours,
      shopDescription: updates.description,
    });
    if (violation) {
      const message = characterLimitMessage(violation.limit);
      showToast(message, 'error');
      return { success: false, message };
    }
    /*
      Snapshot who the edit was started for, and re-check it after every await.

      Changing the email goes through `auth.updateUser`, which is a network
      round trip. If the account is signed out, or another account signs in,
      while that is in flight, the closures below were still holding the old
      `auth.user` and wrote the new name and photo onto whoever was signed in
      by the time the promise resolved -- the previous account's edits landing
      on the new one's row. `updateIdentityRow` matches on the snapshot, so
      bailing out is enough to keep the two apart.
    */
    const target = auth.user;
    const role = auth.role;
    const client = getSupabaseClient(role);
    // Compares against `auth?.user`, not `auth`. See `authUserRef` at its
    // declaration: `auth` has no top-level `id`, so this used to read
    // `undefined !== <id>` and every profile save bailed out before writing.
    const superseded = () => authUserRef.current?.id !== target.id;
    if (supabase && client && updates.email && updates.email.trim().toLowerCase() !== target.email?.toLowerCase()) {
      const { error } = await client.auth.updateUser({ email: updates.email.trim().toLowerCase() });
      if (error) {
        showToast(error.message, 'error');
        return { success: false, message: error.message };
      }
    }
    /*
      Checked unconditionally, not only after the email call. Most saves do not
      change the email, so the await above is skipped -- but the caller may still
      have switched accounts before this callback ran, and then the row written
      below belonged to the previous account. `updateIdentityRow` matches on the
      snapshot, so it would find the right row and still land an edit the person
      now signed in did not make.
    */
    if (superseded()) {
      return { success: false, message: 'The signed-in account changed while saving. Please try again.' };
    }
    if (role === 'vendor' && Object.hasOwn(updates, 'logo') && isSupabaseConfigured) {
      if (!client || !target.ownerId) {
        return { success: false, message: 'Your shop account could not be verified. Sign in again and retry.' };
      }
      pinVendorLogo(target.id, updates.logo);
      try {
        const { data: session, error: sessionError } = await client.auth.getUser();
        if (sessionError) throw sessionError;
        if (session.user?.id !== target.ownerId) {
          throw new Error('Your shop session has expired. Sign in again and retry.');
        }
        const { data, error } = await client
          .from('vendors')
          .update({ logo: updates.logo })
          .eq('owner_id', session.user.id)
          .select('id, logo')
          .maybeSingle();
        if (error) throw error;
        if (!data?.id || data.logo !== updates.logo) {
          throw new Error('The shop photo was not saved. Check your account permissions and try again.');
        }
        if (superseded()) {
          clearVendorLogoPin(target.id);
          return { success: false, message: 'The signed-in account changed while saving. Please try again.' };
        }
      } catch (error) {
        clearVendorLogoPin(target.id);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'The shop photo could not be saved.',
        };
      }
    }
    /*
      Each branch updates exactly one row, chosen by identity.

      These were `list.map()` with an unguarded `String(c.email ?? '') ===
      String(auth.user.email ?? '')`. `String(undefined ?? '')` is `''`, so a
      row with no email compared equal to a signed-in account with no email and
      the save was applied to every one of them. Because customers share one
      array across the whole app, that rewrote the other account's name and
      profile photo as well. `updateIdentityRow` stops at the first match and
      `isSameIdentity` refuses to treat a missing value as a match.
    */
    if (role === 'customer') {
      setCustomers((list) => updateIdentityRow(list, target, updates, ['id']));
      setAuth((a) => (a.user?.id === target.id ? { ...a, user: { ...a.user, ...updates } } : a));
    } else if (role === 'vendor') {
      setVendors((list) => updateIdentityRow(list, target, updates, ['id', 'ownerId']));
      setAuth((a) => (a.user?.id === target.id ? { ...a, user: { ...a.user, ...updates } } : a));
    }
    return { success: true };
  }, [auth, showToast]);

  const uploadMediaFile = useCallback(async (file, folder) => {
    if (!auth.user || !file) return { success: false, message: 'Choose an image first.' };
    if (!file.type.startsWith('image/')) return { success: false, message: 'Please select an image file.' };
    if (file.size > 4 * 1024 * 1024) return { success: false, message: 'Images must be 4 MB or smaller.' };
    if (supabaseConfigError) return { success: false, message: supabaseConfigError };
    if (isSupabaseConfigured) {
      /*
        The path prefix has to be the *auth* uuid, and a vendor's `auth.user.id` is
        not one: at login it is set to the vendor row's legacy_id so the rest of
        the app can address the shop by its own id. Uploading with that wrote
        `<legacy_id>/<folder>/...`, and the storage policy
        `(storage.foldername(name))[1] = auth.uid()::text` compared a number
        against the session uuid and rejected the insert -- so vendors were the
        one role that could not upload anything. `remoteUser` is the session user
        from Supabase, so its id is the uuid the policy matches.
      */
      const ownerId = remoteUser?.id || auth.user.id;
      let result;
      try {
        result = await uploadSupabaseMedia(file, folder, ownerId, auth.role);
      } catch (error) {
        console.error('[supabase] media upload failed:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Image upload failed. Check your connection and try again.',
        };
      }
      if (result.error) return { success: false, message: result.error.message };
      // Guarding the URL instead of passing it straight through. A success with
      // no url used to reach `onUploaded(undefined)`, which set `logo` to
      // undefined -- so the field read as empty and the upload looked like it
      // had simply not happened, with no message anywhere.
      if (!result.data?.url) return { success: false, message: 'Upload finished but no image URL was returned.' };
      return { success: true, url: result.data.url };
    }
    // The base64 form of a full-size photo does not fit in localStorage, and
    // persistence swallows that failure silently. Shrink it first.
    try {
      const prepared = await prepareImageForLocalStorage(file);
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read the image.'));
        reader.readAsDataURL(prepared);
      });
      return { success: true, url };
    } catch (error) {
      console.error('[local] image preparation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unable to prepare the image for local storage.',
      };
    }
  }, [auth.user, auth.role, remoteUser]);

  // CART
  const { addToCart, updateCartQty, removeFromCart, removeCartItems, clearCart } = useCartActions({ setCart, showToast });

  // FAVORITES
  const { favorites: myFavorites, isFavorite, toggleFavorite, removeFavorite, favoriteCount } =
    useFavoriteActions({
      favorites,
      setFavorites,
      auth,
      showToast,
      onAdded: (row) => { pendingFavoritesRef.current.add(favoriteKey(row)); },
      onRemoved: (row) => { pendingFavoritesRef.current.delete(favoriteKey(row)); },
    });

  const rateShop = useCallback(async (orderNumber, rating, comment = '') => {
    const score = Number(rating);
    const reviewComment = typeof comment === 'string' ? comment.trim() : '';
    if (auth.role !== 'customer' || !auth.user?.id) {
      return { success: false, message: 'Sign in as a customer to rate a shop.' };
    }
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return { success: false, message: 'Choose a rating from 1 to 5 stars.' };
    }
    if (!isWithinCharacterLimit(reviewComment, FIELD_CHAR_LIMITS.ratingComment)) {
      return { success: false, message: `Please keep your comment to ${FIELD_CHAR_LIMITS.ratingComment} characters or fewer.` };
    }
    const order = orders.find((item) => String(item.id) === String(orderNumber));
    if (!order || String(order.customerId) !== String(auth.user.id)) {
      return { success: false, message: 'This order does not belong to your account.' };
    }
    if (order.status !== 'COMPLETED') {
      return { success: false, message: 'You can rate the shop after the order is completed.' };
    }
    if (shopRatings.some((item) => String(item.orderNumber) === String(order.id))) {
      return { success: false, message: 'You have already rated this order.' };
    }

    let aggregate;
    if (isSupabaseConfigured) {
      try {
        aggregate = await persistShopRating(order.id, score, reviewComment);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save your rating. Please try again.';
        console.error('[ratings] shop rating could not be saved:', error);
        showToast(message, 'error');
        return { success: false, message };
      }
    } else {
      const shop = vendors.find((item) => String(item.id) === String(order.vendorId));
      const count = Number(shop?.ratingCount) || 0;
      aggregate = {
        rating: ((Number(shop?.rating) || 0) * count + score) / (count + 1),
        rating_count: count + 1,
      };
    }

    const createdAt = new Date().toISOString();
    setShopRatings((current) => current.some((item) => String(item.orderNumber) === String(order.id))
      ? current
      : [{ orderNumber: order.id, vendorId: order.vendorId, rating: score, comment: reviewComment, createdAt }, ...current]);
    setVendors((current) => current.map((shop) => String(shop.id) === String(order.vendorId)
      ? { ...shop, rating: Number(aggregate.rating), ratingCount: Number(aggregate.rating_count) }
      : shop));
    showToast('Thanks for rating this shop!');
    return { success: true };
  }, [auth, orders, shopRatings, vendors, showToast]);

  // NOTIFICATIONS
  const addNotification = useCallback((notif) => {
    setNotifications((n) => [{ ...notif, read: false, createdAt: new Date().toISOString(), id: nextNotificationId() }, ...n]);
  }, [nextNotificationId]);

  // BUYER/VENDOR CHAT
  const {
    getOrCreateChat,
    sendChatMessage,
    sendChatMenu,
    sendChatOrderReceipt,
    toggleChatReaction,
    markChatMessageRead,
  } = useChatActions({
    chats,
    setChats,
    auth,
    vendors,
    persistMessage: isSupabaseConfigured ? persistChatMessage : null,
    persistMessageRead: isSupabaseConfigured ? persistChatMessageRead : null,
    showToast,
  });

  // ORDERS
  const placeOrder = useCallback(({ customer, vendor, items, paymentMethod, fulfillment, gcashRef, specialInstructions }) => {
    const violation = findCharacterLimitViolation({
      fullName: customer?.fullName,
      address: customer?.address,
      specialInstructions: specialInstructions || '',
    }, {
      fullName: FIELD_CHAR_LIMITS.fullName,
      address: FIELD_CHAR_LIMITS.address,
      specialInstructions: FIELD_CHAR_LIMITS.specialInstructions,
    });
    const invalidItemName = (items || []).some((item) => (
      !isWithinCharacterLimit(item.name, FIELD_CHAR_LIMITS.productName)
    ));
    const invalidItemNote = (items || []).some((item) => (
      !isWithinCharacterLimit(item.notes || '', FIELD_CHAR_LIMITS.itemNote)
    ));
    if (violation || invalidItemName || invalidItemNote) {
      const limit = violation?.limit || (invalidItemName ? FIELD_CHAR_LIMITS.productName : FIELD_CHAR_LIMITS.itemNote);
      showToast(characterLimitMessage(limit), 'error');
      return null;
    }
    // No delivery fee and no discounts: the shop and the customer settle
    // payment in chat, so the item sum is the whole total. Computed here in one
    // place and reused by the checkout summary from the same items, so the
    // quoted figure and the stored figure cannot drift apart.
    //
    // The order stored a `subtotal` field as well as `total`. There is no
    // `subtotal` column and the mapper never produced one, so the value was
    // written into the browser copy and then lost on the next reload, leaving
    // an order that looked different before and after a sync. Only `total` is
    // kept, and it is the whole amount.
    const total = (items || []).reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return sum + price * quantity;
    }, 0);
    const activeVendorOrders = orders.filter((o) => String(o.vendorId) === String(vendor.id) && ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(o.status));
    const queueNumber = activeVendorOrders.length + 1;
    // Was `ORD-${Date.now()}-${random 3 digits}`: only 1000 suffixes for every
    // order placed in a given millisecond, and orders.order_number is a unique
    // column, so a clash surfaced as a failed insert and a lost order.
    const orderId = `ORD-${nextLocalId()}`;
    const now = new Date().toISOString();
    const order = {
      id: orderId,
      queueNumber,
      customerId: customer.id,
      customerName: customer.fullName,
      customerMobile: customer.mobile,
      customerAddress: customer.address,
      vendorId: vendor.id,
      vendorDbId: vendor.dbId ?? null,
      vendorName: vendor.name,
      items: items.map((i) => ({
        menuId: i.menuId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        notes: i.notes,
      })),
      total,
      paymentMethod: paymentMethod || 'TO BE DISCUSSED IN CHAT',
      paymentStatus: paymentMethod === 'Online Payment' ? 'ONLINE PAYMENT' : 'COD',
      fulfillment,
      status: 'RECEIVED',
      specialInstructions: specialInstructions || '',
      gcashRef: gcashRef || null,
      createdAt: now,
      timeline: [{ status: 'RECEIVED', time: now }],
      updatedAt: now,
    };
    setOrders((o) => [order, ...o]);
    if (isSupabaseConfigured) {
      void persistNewOrder(order, customer.id).catch((error) => {
        console.error('[orders] order save failed:', error);
        showToast(error instanceof Error ? error.message : 'Order could not be saved. Please retry.', 'error');
      });
    }

    /*
      Decrement stock for each item ordered + increment queue.

      Derived from `vendors` rather than from a variable written inside the
      setState updater. React only runs an updater synchronously when that hook
      has no pending update, so with an update already queued the assignment
      after setVendors still read `null`, the signed-in vendor's `menu` in
      auth.user silently kept the old copy, and stock was never decremented.
    */
    const currentVendor = vendors.find((v) => String(v.id) === String(vendor.id));
    if (currentVendor) {
      const newMenu = (currentVendor.menu || []).map((m) => {
        const orderedItem = items.find((i) => String(i.menuId) === String(m.id));
        if (!orderedItem) return m;
        const stock = Number(m.stock) || 0;
        const quantity = Number(orderedItem.quantity) || 0;
        const newStock = Math.max(0, stock - quantity);
        return { ...m, stock: newStock, available: newStock > 0 };
      });
      setVendors((vlist) => vlist.map((v) => (
        String(v.id) === String(vendor.id) ? { ...v, menu: newMenu, queue: activeVendorOrders.length + 1 } : v
      )));
      if (auth.user && String(auth.user.id) === String(vendor.id)) {
        setAuth((a) => ({ ...a, user: { ...a.user, menu: newMenu, queue: activeVendorOrders.length + 1 } }));
      }
    }

    // Add notification for vendor (simulated via vendor's view)
    try {
      addNotification({
        userId: vendor.id,
        type: 'order',
        title: 'New Order Received',
        message: `Order ${orderId} from ${customer.fullName}`,
        read: false,
        createdAt: now,
      });
      // Add customer notification
      addNotification({
        userId: customer.id,
        type: 'order',
        title: 'Order Placed',
        message: `Your order ${orderId} has been placed. Pila #${queueNumber}`,
        read: false,
        createdAt: now,
        expiresAt: orderNotificationExpiry(),
      });
    } catch {}
    return order;
  }, [orders, vendors, auth, addNotification, showToast]);

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    const order = orders.find((item) => String(item.id) === String(orderId));
    if (!order) return false;
    if (auth.role !== 'vendor' && auth.role !== 'admin') {
      showToast('Only the shop can update this order status.', 'error');
      return false;
    }
    const allowedStatuses = ORDER_STATUS_TRANSITIONS[order.status] || [];
    const fulfillmentAllowsTransition = order.status !== 'READY'
      || (order.fulfillment === 'DELIVERY' ? newStatus === 'OUT FOR DELIVERY' : newStatus === 'COMPLETED');
    if (!allowedStatuses.includes(newStatus) || !fulfillmentAllowsTransition) {
      showToast('This order status can no longer be changed from its current state.', 'error');
      return false;
    }
    const orderKey = String(order.id);
    if (orderStatusWritesRef.current.has(orderKey)) return false;
    orderStatusWritesRef.current.add(orderKey);
    setSavingOrderIds((current) => new Set(current).add(orderKey));
    const now = new Date().toISOString();
    const updatedOrder = {
      ...order,
      status: newStatus,
      updatedAt: now,
      timeline: [...(order.timeline || []), { status: newStatus, time: now }],
    };
    setOrders((current) => current.map((item) => (
      String(item.id) === orderKey ? updatedOrder : item
    )));
    showToast('Saving order status...', 'info');

    try {
      if (isSupabaseConfigured) {
        if (!remoteUser?.id) throw new Error('Your database session is unavailable. Sign in again and retry.');
        await persistOrderStatus({
          ...updatedOrder,
          expectedStatus: order.status,
        }, auth.role);
      }
      addNotification({
        userId: order.customerId,
        type: 'order',
        title: `Order ${newStatus}`,
        message: `Your order ${order.id} is now ${newStatus}.`,
        read: false,
        createdAt: now,
        expiresAt: orderNotificationExpiry(),
      });
      showToast('Order status saved.', 'success');
      if (newStatus === 'COMPLETED') {
        const remainingQueue = orders.filter((item) => String(item.vendorId) === String(order.vendorId)
          && String(item.id) !== orderKey
          && ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(item.status)).length;
        setVendors((vlist) => vlist.map((vendor) => (
          String(vendor.id) === String(order.vendorId) ? { ...vendor, queue: remainingQueue } : vendor
        )));
      }
      return true;
    } catch (error) {
      console.error('[orders] status save failed:', error);
      setOrders((current) => current.map((item) => (
        String(item.id) === orderKey && item.updatedAt === now ? order : item
      )));
      showToast(error instanceof Error ? error.message : 'Order status could not be saved. Please retry.', 'error');
      return false;
    } finally {
      orderStatusWritesRef.current.delete(orderKey);
      setSavingOrderIds((current) => {
        const next = new Set(current);
        next.delete(orderKey);
        return next;
      });
    }
  }, [orders, addNotification, showToast, remoteUser, auth.role]);

  const rejectOrder = useCallback(async (orderId, reason) => {
    const order = orders.find((item) => String(item.id) === String(orderId));
    if (!order) return false;
    if (auth.role !== 'vendor' && auth.role !== 'admin') {
      showToast('Only the shop can reject this order.', 'error');
      return false;
    }
    if (order.status !== 'RECEIVED') {
      showToast('Only newly received orders can be rejected.', 'error');
      return false;
    }
    if (findCharacterLimitViolation({ rejectionReason: reason || '' }, {
      rejectionReason: FIELD_CHAR_LIMITS.rejectionReason,
    })) {
      showToast(characterLimitMessage(FIELD_CHAR_LIMITS.rejectionReason), 'error');
      return false;
    }
    const orderKey = String(order.id);
    if (orderStatusWritesRef.current.has(orderKey)) return false;
    orderStatusWritesRef.current.add(orderKey);
    setSavingOrderIds((current) => new Set(current).add(orderKey));
    const now = new Date().toISOString();
    const rejectionReason = reason?.trim() || 'Unavailable';
    const updatedOrder = {
      ...order,
      status: 'REJECTED',
      updatedAt: now,
      rejectReason: rejectionReason,
      timeline: [...(order.timeline || []), { status: 'REJECTED', time: now, reason: rejectionReason }],
    };
    setOrders((current) => current.map((item) => (
      String(item.id) === orderKey ? updatedOrder : item
    )));
    showToast('Saving order status...', 'info');

    try {
      if (isSupabaseConfigured) {
        if (!remoteUser?.id) throw new Error('Your database session is unavailable. Sign in again and retry.');
        await persistOrderStatus({
          ...updatedOrder,
          expectedStatus: order.status,
        }, auth.role);
      }
      addNotification({
        userId: order.customerId,
        type: 'order',
        title: 'Order Rejected',
        message: `Your order ${order.id} was rejected: ${rejectionReason}`,
        read: false,
        createdAt: now,
        expiresAt: orderNotificationExpiry(),
      });
      showToast('Order rejection saved.', 'success');
      setVendors((vlist) => vlist.map((vendor) => (
        String(vendor.id) === String(order.vendorId)
          ? { ...vendor, queue: Math.max(0, (Number(vendor.queue) || 0) - 1) }
          : vendor
      )));
      return true;
    } catch (error) {
      console.error('[orders] status save failed:', error);
      setOrders((current) => current.map((item) => (
        String(item.id) === orderKey && item.updatedAt === now ? order : item
      )));
      showToast(error instanceof Error ? error.message : 'Order rejection could not be saved. Please retry.', 'error');
      return false;
    } finally {
      orderStatusWritesRef.current.delete(orderKey);
      setSavingOrderIds((current) => {
        const next = new Set(current);
        next.delete(orderKey);
        return next;
      });
    }
  }, [orders, addNotification, showToast, remoteUser, auth.role]);

  const cancelOrder = useCallback(async (orderId) => {
    const order = orders.find((item) => String(item.id) === String(orderId));
    if (!order) return false;
    if (auth.role !== 'customer') {
      showToast('Only the customer who placed this order can cancel it.', 'error');
      return false;
    }
    if (String(order.customerId) !== String(auth.user?.id)) {
      showToast('You can only cancel your own order.', 'error');
      return false;
    }
    if (order.status !== 'RECEIVED') {
      showToast('The shop already accepted this order, so it can no longer be cancelled.', 'error');
      return false;
    }
    const orderKey = String(order.id);
    if (orderStatusWritesRef.current.has(orderKey)) return false;
    orderStatusWritesRef.current.add(orderKey);
    setSavingOrderIds((current) => new Set(current).add(orderKey));
    const now = new Date().toISOString();
    const updatedOrder = {
      ...order,
      status: 'CANCELLED',
      updatedAt: now,
      timeline: [...(order.timeline || []), { status: 'CANCELLED', time: now, reason: 'Cancelled by customer' }],
    };
    showToast('Cancelling order...', 'info');

    try {
      if (isSupabaseConfigured) {
        if (!remoteUser?.id) throw new Error('Your database session is unavailable. Sign in again and retry.');
        await persistOrderStatus({
          ...updatedOrder,
          expectedStatus: order.status,
        }, auth.role);
      }
      setOrders((current) => current.map((item) => (
        String(item.id) === orderKey ? updatedOrder : item
      )));
      setVendors((vlist) => vlist.map((vendor) => {
        if (String(vendor.id) !== String(order.vendorId)) return vendor;
        const menu = (vendor.menu || []).map((menuItem) => {
          const orderedQuantity = (order.items || [])
            .filter((item) => String(item.menuId) === String(menuItem.id))
            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          if (orderedQuantity === 0) return menuItem;
          const stock = (Number(menuItem.stock) || 0) + orderedQuantity;
          return { ...menuItem, stock, available: stock > 0 };
        });
        return { ...vendor, menu, queue: Math.max(0, (Number(vendor.queue) || 0) - 1) };
      }));
      showToast('Order cancelled.', 'success');
      return true;
    } catch (error) {
      console.error('[orders] cancellation failed:', error);
      if (isSupabaseConfigured) void refreshRemoteStateRef.current?.();
      const message = error instanceof Error ? error.message : '';
      showToast(
        message.includes('changed elsewhere')
          ? 'The shop already accepted this order, so it can no longer be cancelled.'
          : message || 'Order could not be cancelled. Please retry.',
        'error',
      );
      return false;
    } finally {
      orderStatusWritesRef.current.delete(orderKey);
      setSavingOrderIds((current) => {
        const next = new Set(current);
        next.delete(orderKey);
        return next;
      });
    }
  }, [orders, auth.role, auth.user?.id, remoteUser, showToast]);

  // VENDOR OPERATIONS
  const {
    updateVendor, addVendorMenu, postVendorProduct, postVendorMenu, updateVendorMenu,
    deleteVendorMenu, updateStock, setStoreStatus, approveVendor, rejectVendor,
    suspendVendor, activateVendor, suspendCustomer, activateCustomer,
  } = useVendorActions({ setVendors, setCustomers, setPosts, setAuth, auth, vendors, customers, posts, showToast });

  const deleteCustomerAccount = useCallback(async (customerId) => {
    const customer = customers.find((item) => String(item.id) === String(customerId));
    if (!customer) return false;
    const removeFromState = () => {
      setCustomers((current) => current.filter((item) => String(item.id) !== String(customer.id)));
      setOrders((current) => current.filter((order) => String(order.customerId) !== String(customer.id)));
      setChats((current) => current.filter((chat) => String(chat.customerId) !== String(customer.id)));
      setPosts((current) => current.filter((post) => String(post.authorId) !== String(customer.id)));
      setNotifications((current) => current.filter((item) => String(item.userId) !== String(customer.id)));
      setFavorites((current) => current.filter((item) => String(item.userId) !== String(customer.id)));
    };
    try {
      if (isSupabaseConfigured) {
        if (auth.role !== 'admin') throw new Error('Only an admin can delete customer accounts.');
        if (typeof customer.id !== 'string') throw new Error('This customer has no Supabase account ID.');
        await deleteSupabaseAccount(customer.id);
      }
      removeFromState();
      showToast('Customer account permanently deleted.', 'success');
      return true;
    } catch (error) {
      if (error?.accountDeleteComplete) removeFromState();
      showToast(`Unable to delete customer account: ${error.message}`, 'error');
      return Boolean(error?.accountDeleteComplete);
    }
  }, [customers, auth.role, setCustomers, setOrders, setChats, setPosts, setNotifications, setFavorites, showToast]);

  const deleteVendorAccount = useCallback(async (vendorId) => {
    const vendor = vendors.find((item) => String(item.id) === String(vendorId));
    if (!vendor) return false;
    const vendorIds = new Set([vendor.id, vendor.legacy_id].filter((id) => id != null).map(String));
    const removeFromState = () => {
      setVendors((current) => current.filter((item) => String(item.id) !== String(vendor.id)));
      setOrders((current) => current.filter((order) => (
        !vendorIds.has(String(order.vendorId))
        && (vendor.ownerId == null
          || String(order.vendor_owner_id || order.vendorOwnerId) !== String(vendor.ownerId))
      )));
      setChats((current) => current.filter((chat) => !vendorIds.has(String(chat.vendorId))));
      setPosts((current) => current.filter((post) => (
        (vendor.ownerId == null || String(post.authorId) !== String(vendor.ownerId))
        && !vendorIds.has(String(post.vendorId))
      )));
      setNotifications((current) => current.filter((item) => (
        vendor.ownerId == null || String(item.userId) !== String(vendor.ownerId)
      )));
      setFavorites((current) => current.filter((item) => (
        String(item.vendorId) !== String(vendor.id)
        && !(item.type === 'shop' && vendorIds.has(String(item.refId)))
      )));
    };
    try {
      if (isSupabaseConfigured) {
        if (auth.role !== 'admin') throw new Error('Only an admin can delete vendor accounts.');
        if (typeof vendor.ownerId !== 'string') throw new Error('This vendor has no Supabase account ID.');
        await deleteSupabaseAccount(vendor.ownerId);
      }
      removeFromState();
      showToast('Vendor account permanently deleted.', 'success');
      return true;
    } catch (error) {
      if (error?.accountDeleteComplete) removeFromState();
      showToast(`Unable to delete vendor account: ${error.message}`, 'error');
      return Boolean(error?.accountDeleteComplete);
    }
  }, [vendors, auth.role, setVendors, setOrders, setChats, setPosts, setNotifications, setFavorites, showToast]);

  // MARKETPLACE
  const {
    addPost, toggleLikePost, addComment, deleteComment,
    deletePost, togglePinPost, toggleHidePost, reportPost, resolvePostReport,
  } = useMarketplaceActions({
    setPosts,
    auth,
    showToast,
    persistAdminPostModeration,
    deleteSupabasePost,
    persistMarketplaceComment,
    deleteMarketplaceComment,
    persistAdminMarketplacePost,
    reportSupabasePost,
    isSupabaseConfigured,
  });

  const reportAccount = useCallback(async (accountId, accountType, reason) => {
    if (!auth.user || !['customer', 'vendor'].includes(auth.role)) {
      showToast('Sign in as a customer or vendor to report an account.', 'error');
      return false;
    }
    if (!accountId || !['customer', 'vendor'].includes(accountType)) {
      showToast('This account cannot be reported.', 'error');
      return false;
    }
    if (!['Spam', 'Scam', 'Inappropriate', 'Impersonation', 'Harassment', 'Other'].includes(reason)) {
      showToast('Choose a valid reason for reporting this account.', 'error');
      return false;
    }
    const usesRemote = isSupabaseConfigured && Boolean(remoteUser);
    if (usesRemote && (
      typeof accountId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)
    )) {
      showToast('The account has no valid Supabase account ID and cannot be reported.', 'error');
      return false;
    }
    const reporterId = remoteUser?.id || auth.user.ownerId || auth.user.id;
    if (String(reporterId) === String(accountId)) {
      showToast('You cannot report your own account.', 'error');
      return false;
    }
    try {
      let report;
      if (usesRemote) {
        report = await reportSupabaseAccount(accountId, accountType, reason, auth.role);
      } else {
        const existing = accountReports.find((item) => (
          String(item.reporterId) === String(reporterId)
          && String(item.accountId) === String(accountId)
          && item.status === 'open'
        ));
        if (existing) {
          showToast('You already have an open report for this account.', 'error');
          return false;
        }
        report = {
          id: nextLocalId(),
          reporterId,
          accountId,
          accountType,
          reason,
          status: 'open',
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          resolvedBy: null,
        };
      }
      setAccountReports((current) => mergeById(current, [report]));
      showToast('Account report submitted for admin review.', 'success');
      return true;
    } catch (error) {
      showToast(`Unable to submit account report: ${error.message}`, 'error');
      return false;
    }
  }, [auth, remoteUser, accountReports, showToast]);

  const resolveAccountReport = useCallback(async (report) => {
    if (auth.role !== 'admin') {
      showToast('Only an admin can resolve account reports.', 'error');
      return false;
    }
    try {
      if (isSupabaseConfigured && remoteUser) await resolveSupabaseAccountReport(report.id);
      const resolvedAt = new Date().toISOString();
      setAccountReports((current) => current.map((item) => (
        String(item.id) === String(report.id)
          ? { ...item, status: 'resolved', resolvedAt, resolvedBy: remoteUser?.id || auth.user?.id }
          : item
      )));
      showToast('Account report resolved.', 'success');
      return true;
    } catch (error) {
      showToast(`Unable to resolve account report: ${error.message}`, 'error');
      return false;
    }
  }, [auth, remoteUser, showToast]);

  const markNotifRead = useCallback(async (notifId) => {
    const belongsToCurrentUser = (notification) => auth.role === 'admin'
      ? isAdminNotification(notification, remoteUser?.id || auth.user?.id)
      : String(notification.userId) === String(auth.user?.id)
        || String(notification.userId) === String(auth.user?.ownerId);
    const target = notifications.find((notification) => (
      String(notification.id) === String(notifId) && belongsToCurrentUser(notification)
    ));
    if (!target || target.read) return;

    setNotifications((current) => current.map((notification) => (
      String(notification.id) === String(target.id)
      && String(notification.userId) === String(target.userId)
        ? { ...notification, read: true }
        : notification
    )));

    if (isSupabaseConfigured && remoteUser?.id) {
      const { error } = await markSupabaseNotificationRead(target, remoteUser);
      if (error) {
        console.error('[kainhub] failed to mark notification as read:', error.message || error);
        showToast('Could not save the notification read status. Please try again.', 'error');
      }
    }
  }, [auth, notifications, remoteUser, showToast]);

  /*
    Takes the signed-in account's uuid, and matches admin-desk rows through
    `isAdminNotification` so a row still carrying the literal 'admin' -- one
    raised before `notify_admin_desk` delivered it -- is marked too.

    This was an exact `x.userId === userId`, and the admin page passed the
    literal 'admin' to it. Admin-desk alerts are created by a customer or
    vendor, so nobody is signed in as an admin when they are raised and there is
    no admin id to address them to, which is why the app held them as
    `userId: 'admin'`. Once the RPC delivers them the row comes back owned by
    the admin's uuid, so the literal matched nothing: "Mark all read" reported
    that it had run and left every alert unread.
  */
  const markAllNotifRead = useCallback(async (userId) => {
    const belongsToCurrentUser = (notification) => auth.role === 'admin'
      ? isAdminNotification(notification, userId || remoteUser?.id)
      : String(notification.userId) === String(auth.user?.id)
        || String(notification.userId) === String(auth.user?.ownerId);
    const unread = notifications.filter((notification) => (
      !notification.read && belongsToCurrentUser(notification)
    ));
    if (unread.length === 0) return;

    setNotifications((current) => current.map((notification) => (
      belongsToCurrentUser(notification) ? { ...notification, read: true } : notification
    )));

    if (isSupabaseConfigured && remoteUser?.id) {
      const { error } = await markAllSupabaseNotificationsRead(remoteUser);
      if (error) {
        console.error('[kainhub] failed to mark all notifications as read:', error.message || error);
        showToast('Could not save all notification read statuses. Please try again.', 'error');
      }
    }
  }, [auth, notifications, remoteUser, showToast]);

  /*
    Dismiss, for the customer tapping the X on a single row.

    Two steps, in this order on purpose.

    Locally, the row is removed from state immediately so the list reacts on the
    same frame as the click. Filtering it out of the array is enough here because
    the delete below follows; this is not the backdate-only approach the TTL
    sweep needs, since a row dropped from state is no longer written by
    `persistNotifications` at all.

    Then the row is deleted from the database for real. That is what stops it
    coming back: the notification list is re-seeded from Supabase on every 15s
    tick and folded in with `mergeById`, so a row only removed from local state
    reappeared seconds later -- the same resurrection the favourites list avoids
    by never folding.

    Awaited, but the UI does not wait on it. The optimistic removal is what the
    customer sees, and a failed delete leaves the row hidden rather than popping
    back, which is the safer direction to fail in. The error is reported rather
    than swallowed so a failing delete is visible in the console.

    Matched by `String` because ids come back from Supabase as strings and are
    minted locally as `Date.now()`-derived strings, but a row written by an older
    build can hold a number.
  */
  const dismissNotification = useCallback(async (notification) => {
    const target = typeof notification === 'object'
      ? notification
      : notifications.find((item) => String(item.id) === String(notification));
    if (!target) return;
    dismissedNotificationKeysRef.current.add(notificationKey(target));
    setNotifications((n) => n.filter((x) => (
      String(x.id) !== String(target.id) || String(x.userId) !== String(target.userId)
    )));
    if (!isSupabaseConfigured) return;
    await remoteIdleRef.current;
    const { error } = await deleteSupabaseNotification(target, remoteUser);
    if (error) {
      console.error('[kainhub] failed to delete notification from the database:', error.message || error);
      showToast('Could not permanently dismiss this notification. Please try again.', 'error');
    }
  }, [notifications, remoteUser, showToast]);

  /*
    The expiry timer.

    One shared interval for every notification rather than a `setTimeout` per row:
    rows arrive continuously, so a per-row timeout would mean an unbounded number
    of live timers and a pending timeout for each row that is already gone.

    `pruneExpiredNotifications` returns the same array reference when nothing has
    expired, and the identity check stops the setState, so a tick that changes
    nothing does not re-render the notification list or the header badge.

    Twenty seconds is a compromise: the TTL itself is an hour, so the visible
    error in the countdown is at most twenty seconds, while twenty write cycles an
    hour is negligible beside the realtime updates.

    Each expired row is deleted from the database, not just hidden. Backdating the
    expiry is what removes it from the list, but the row would otherwise sit in
    `notifications` forever and be re-fetched on every tick only to be filtered
    again -- one dead row per order stage, growing without bound. Deleting inside
    the sweep rather than in a Supabase trigger or a cron keeps the rule in one
    place: anything past its TTL is gone from both sides.

    Only rows owned by the signed-in account are deleted. `deleteSupabaseNotification`
    scopes the statement by `user_id` as well, so this is a request-count
    optimisation rather than the security boundary -- RLS is.
  */
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isSupabaseConfigured || !remoteUser?.id) {
        setNotifications((n) => pruneExpiredNotifications(n));
        return;
      }
      setNotifications((n) => {
        const expired = n.filter((item) => String(item.userId) === String(remoteUser.id) && isNotificationExpired(item));
        // Fire the deletes from inside the updater, which React may run more than
        // once in StrictMode, so the calls are guarded by only ever passing rows
        // that are actually in this snapshot. `deleteSupabaseNotification` is
        // idempotent -- deleting an already-deleted row matches nothing -- so a
        // duplicate call is harmless.
        expired.forEach((item) => { void deleteSupabaseNotification(item, remoteUser); });
        return pruneExpiredNotifications(n);
      });
    }, NOTIFICATION_SWEEP_MS);
    return () => window.clearInterval(interval);
  }, [remoteUser]);

  // PLATFORM SETTINGS (admin)
  const updatePlatformSettings = useCallback((updates) => {
    setPlatformSettings((s) => ({ ...s, ...updates, logo: PLATFORM_SETTINGS.logo }));
    showToast('Settings saved.', 'success');
  }, [showToast]);

  const resetData = useCallback(async () => {
    if (auth.role !== 'admin') {
      showToast('Only an admin can reset platform data.', 'error');
      return { success: false, message: 'Only an admin can reset platform data.' };
    }

    resetInProgressRef.current = true;
    try {
      if (isSupabaseConfigured) {
        if (!remoteUser?.id) {
          throw new Error('Your admin database session is unavailable. Sign in again and retry.');
        }
        await remoteIdleRef.current;
        await resetSupabaseData();
      }
      pendingRemoteRef.current = null;
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
      return { success: true };
    } catch (error) {
      if (!error?.databaseResetComplete) resetInProgressRef.current = false;
      const message = error instanceof Error ? error.message : 'Unable to reset platform data.';
      showToast(message, 'error');
      return { success: false, message };
    }
  }, [auth.role, remoteUser, showToast]);

  const value = {
    auth,
      authError,
    authReady,
      ordersRealtimeStatus,
    chatRealtimeStatus,
    savingOrderIds,
    vendors,
    customers,
    admins,
    orders,

    posts,
    notifications,
    platformSettings,
    cart,
    chats,
    shopRatings,
    favorites,
    toasts,
    // auth
    login,
    requestPhoneOtp,
    verifyPhoneOtp,
    requestEmailOtp,
    verifyEmailOtp,
    registerCustomer,
    registerVendor,
    resetPassword,
    updatePassword,
    changePassword,
    unlockAccount,
    logout,
    updateProfile,
    uploadMediaFile,
    // cart
    addToCart,
    updateCartQty,
    removeFromCart,
    removeCartItems,
    clearCart,
    // favorites
    myFavorites,
    favoriteCount,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    getOrCreateChat,
    sendChatMessage,
    sendChatMenu,
    sendChatOrderReceipt,
    toggleChatReaction,
    markChatMessageRead,
    // orders
    placeOrder,
    rateShop,
    updateOrderStatus,
    rejectOrder,
    cancelOrder,
    // vendor
    updateVendor,
    addVendorMenu,
    postVendorProduct,
    postVendorMenu,
    updateVendorMenu,
    deleteVendorMenu,
    updateStock,
    setStoreStatus,
    approveVendor,
    rejectVendor,
    suspendVendor,
    activateVendor,
    // customer admin
    suspendCustomer,
    activateCustomer,
    deleteCustomerAccount,
    deleteVendorAccount,
    // marketplace
    addPost,
    toggleLikePost,
    addComment,
    deleteComment,
    deletePost,
    togglePinPost,
    toggleHidePost,
    reportPost,
    resolvePostReport,
    accountReports,
    reportAccount,
    resolveAccountReport,
    // notifications
    markNotifRead,
    markAllNotifRead,
    dismissNotification,
    // settings
    updatePlatformSettings,
    resetData,
    // utilities
    showToast,
    notifyFailedLogin,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
