import { getSupabaseClient, isAuthCredentialError, isSupabaseConfigured } from '@/lib/supabase/client';
import { upsertProfile } from '@/lib/supabase/profile';
import { mapVendors, mapPosts, mapOrders, mapNotifications, mapCustomers, mapChats, mapFavorites, asNumber } from '@/lib/supabase/mappers';
import { writeTolerant, upsertNotification } from '@/lib/supabase/tolerantWrite';

/*
  Every write below is fire-and-forget against a schema we do not own at build
  time. When a column or constraint is missing, PostgREST answers 400 and the
  app carried on silently, so a customer could place an order, see it in the
  list, and have it never reach the database. Errors are logged with the table
  and the Postgres code so schema drift is visible immediately instead of
  showing up as "my order disappeared".

  A single missing column fails on every row of a batch and on every state save,
  which produced dozens of byte-identical messages and buried the one line that
  mattered. Each distinct failure is therefore reported once, with the count of
  later repeats, and an actionable hint where the cause is a known schema gap.
  Nothing is suppressed: the error is still raised and still explains itself.
*/
const reportedWriteErrors = new Set();
let sessionAuthFailureReported = false;

const SCHEMA_HINTS = {
  PGRST204: 'A column the app writes does not exist on this table. Run supabase/schema.sql in the Supabase SQL editor.',
  '42P10': 'An upsert used an onConflict column with no unique index behind it. Run supabase/schema.sql in the Supabase SQL editor.',
};

const reportWriteError = (operation, table, error) => {
  if (!error) return null;
  /*
    A dead session answers 401 first, then every policy denies the write as
    42501 because auth.uid() is NULL. Both describe one fault, and neither can
    be fixed by retrying, so this pass stops instead of issuing a request per
    row against a credential the server has already refused. The signed-out
    state the client sets in response is what actually moves the app forward.
  */
  if (isAuthCredentialError(error)) {
    const seen = sessionAuthFailureReported;
    sessionAuthFailureReported = true;
    if (!seen) {
      console.error(
        '[supabase] the stored session is no longer valid, so remote writes were stopped for this pass. Sign in again to resume syncing.'
      );
    }
    return error;
  }
  const key = `${table}:${error.code || 'unknown'}:${operation}`;
  if (reportedWriteErrors.has(key)) return error;
  reportedWriteErrors.add(key);
  const hint = SCHEMA_HINTS[error.code];
  console.error(
    `[supabase] ${operation} on "${table}" failed: ${error.code || ''} ${error.message || ''}`.trim(),
    error.details || error.hint || ''
  );
  if (hint) console.error(`[supabase] fix: ${hint} (further "${table}" ${error.code} errors are suppressed until reload)`);
  return error;
};

export async function loadRemoteState(userId, role) {
  const client = getSupabaseClient(role);
  if (!client) return null;
  const [vendorsResult, postsResult, ordersResult, notificationsResult, profilesResult, chatsResult, favoritesResult] = await Promise.all([
    client.from('vendors').select('*, menu_items(*)').order('created_at', { ascending: false }),
    role === 'admin'
      ? client.from('posts').select('*').order('created_at', { ascending: false })
      : client.from('posts').select('*').eq('hidden', false).order('created_at', { ascending: false }),
    userId
      ? (role === 'admin'
        ? client.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
        : client.from('orders').select('*, order_items(*)').or(`customer_id.eq.${userId},vendor_owner_id.eq.${userId}`).order('created_at', { ascending: false }))
      : Promise.resolve({ data: [] }),
    userId ? client.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    role === 'admin' || role === 'vendor'
      ? client.from('profiles').select('*').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    userId
      ? (role === 'customer'
        ? client.from('chats').select('*').eq('customer_id', userId).order('updated_at', { ascending: false })
        : client.from('chats').select('*').order('updated_at', { ascending: false }))
      : Promise.resolve({ data: [] }),
    // Favourites are private to the signed-in account, so this is asked for only
    // when there is a uid and never for an admin or vendor, who have no list.
    // The `eq(user_id)` is redundant with the RLS policy but keeps the row set
    // explicit, and it means a wrongly-scoped policy fails closed instead of
    // quietly returning another customer's list.
    userId && role === 'customer'
      ? client.from('favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  if (role === 'admin') {
    const failedQuery = [
      ['vendors', vendorsResult],
      ['posts', postsResult],
      ['orders', ordersResult],
      ['notifications', notificationsResult],
      ['profiles', profilesResult],
      ['chats', chatsResult],
    ].find(([, result]) => result.error);
    if (failedQuery) {
      const [table, result] = failedQuery;
      throw new Error(`Could not load admin ${table} from the database: ${result.error.message}`);
    }
  }
  const vendorRecipient = role === 'vendor'
    ? vendorsResult.data?.find((row) => String(row.owner_id) === String(userId))
    : null;
  const vendorRecipientId = vendorRecipient?.legacy_id ?? vendorRecipient?.id ?? null;
  return {
    vendors: hydrateLocalVendorOverlay(mapVendors(vendorsResult.data)),
    posts: mapPosts(postsResult.data),
    orders: mapOrders(ordersResult.data),
    notifications: mapNotifications(notificationsResult.data).map((notification) => {
      return vendorRecipientId == null
        ? notification
        : { ...notification, userId: asNumber(vendorRecipientId) };
    }),
    customers: mapCustomers(profilesResult.data),
    chats: mapChats(chatsResult.data),
    /*
      `favorites` is null rather than [] when the read failed, and the difference
      is load-bearing.

      A missing `favorites` table (schema.sql not run yet) or a denied policy
      answers with an error and no rows, which is byte-identical to a customer who
      has genuinely saved nothing. Reporting [] for both left the refresh tick
      unable to tell "the server has none" from "the server told us nothing", and
      it reconciled the two by emptying the local list -- so every heart the
      customer had just tapped vanished within 15 seconds of a page load.

      Callers must read null as "say nothing at all", never as "the list is
      empty". The same reasoning applies to any list where an empty reply is
      ambiguous, which is why this is not quietly normalised to [] here.
    */
    favorites: favoritesResult.error ? null : mapFavorites(favoritesResult.data),
    role,
  };
}

export async function loadRemoteOrders(userId, role) {
  const client = getSupabaseClient(role);
  if (!client || !userId) return null;
  const query = client
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false });
  const result = role === 'admin'
    ? await query
    : await query.or(`customer_id.eq.${userId},vendor_owner_id.eq.${userId}`);
  if (result.error) {
    throw new Error(`Could not load orders from the database: ${result.error.message}`);
  }
  return mapOrders(result.data);
}

export async function loadRemoteChats(userId, role) {
  const client = getSupabaseClient(role);
  if (!client || !userId) return null;
  const query = client.from('chats').select('*').order('updated_at', { ascending: false });
  const result = role === 'customer'
    ? await query.eq('customer_id', userId)
    : await query;
  if (result.error) {
    throw new Error(`Could not load chats from the database: ${result.error.message}`);
  }
  return mapChats(result.data);
}

export async function persistChatMessage({ chatId, vendorId, customerId, message }, role) {
  const client = getSupabaseClient(role);
  if (!client) throw new Error('Supabase is not configured for this session.');
  const { error } = await client.rpc('append_chat_message', {
    p_chat_id: chatId,
    p_vendor_legacy_id: vendorId,
    p_customer_id: customerId,
    p_message: message,
  });
  if (error) throw new Error(`Could not send message: ${error.message}`);
}

const persistProfile = async (client, state, authUser) => {
  const profile = state.auth?.user;
  /*
    A vendor's logo is mirrored into `profiles.avatar` and `profiles.cover_image`.

    This is what finally made the shop photo stick, and the reason is a plain
    asymmetry: a customer photo travels on two independent paths -- the
    `profiles` upsert below, and the customer array's own persist. A vendor logo
    had only `persistVendor`, which resolves the `vendors` row first and quietly
    abandons the write when that lookup misses. So a vendor could upload, see
    the local preview, reload, and find the image gone, while the identical
    action on the customer portal saved fine.

    Mirroring gives the logo the same always-runs upsert the customer already
    relied on. `avatar`/`cover_image` are only read back for a vendor when the
    `vendors` row has no logo of its own, so this cannot override a shop image
    that did save -- it is a fallback, not a second source of truth.
  */
  const isVendor = state.auth.role === 'vendor';
  await upsertProfile(authUser.id, {
    email: profile?.email || authUser.email,
    role: state.auth.role,
    full_name: profile?.fullName || profile?.ownerName || null,
    mobile: profile?.mobile || null,
    address: profile?.address || null,
    avatar: (isVendor ? profile?.logo : profile?.avatar) || null,
    cover_image: profile?.coverImage || null,
  }, state.auth.role);
  return profile;
};

/*
  Resolves the `vendors` row's primary key, which every vendor-scoped write
  below hangs off.

  This used to be a single `.single()` on `owner_id`, and two silent
  `return null`es when it found nothing. Both are why a vendor's uploaded logo
  simply never appeared while the same flow worked for a customer: customers
  persist through `upsertProfile`, which has no lookup to fail, so their photo
  saved every time. A vendor whose row is keyed differently -- `legacy_id` set
  but `owner_id` not matching the session uuid, or the row not yet committed --
  made this return null, the whole vendor block was skipped, and because the
  return was silent there was no toast, no console error, and nothing in the UI
  to tell the vendor their upload had not saved. They re-uploaded, saw the local
  preview change, reloaded, and the image was gone.

  So the lookup tries `owner_id` first, then falls back to the `legacy_id` the
  app itself treats as the vendor's canonical id, and every failure is reported
  rather than swallowed.
*/
const resolveVendorRow = async (client, authUser, profile) => {
  const byOwner = await client.from('vendors').select('id, legacy_id, owner_id, logo').eq('owner_id', authUser.id).maybeSingle();
  if (byOwner.error) {
    reportWriteError('select', 'vendors', byOwner.error);
  }
  if (byOwner.data?.id) return byOwner.data;

  const legacyId = profile?.id;
  if (legacyId != null) {
    const byLegacy = await client.from('vendors').select('id, legacy_id, owner_id, logo').eq('legacy_id', legacyId).maybeSingle();
    if (byLegacy.error) reportWriteError('select', 'vendors', byLegacy.error);
    if (byLegacy.data?.id) return byLegacy.data;
  }

  reportWriteError('select', 'vendors', {
    message: `no vendors row resolved for this session (owner_id=${authUser.id}, legacy_id=${legacyId}); a vendor logo will not be saved until this row exists`,
  });
  return null;
};

/*
  Vendor rows with a save currently in flight, keyed by the vendors primary key.

  Read by `hydrateLocalVendorOverlay` so a refresh tick cannot revert a logo the
  vendor has just uploaded but which has not been written yet.
*/
const inFlightVendorLogos = new Map();
const inFlightVendorLogoPins = new Map();

/*
  Vendor approval decisions with a write currently in flight, keyed by the app
  vendor id (`legacy_id || id`).

  Same failure mode as the logo pin above, and the reason "approve reverts to
  pending". The admin's write is debounced by 1.5s, but the 15s refresh tick (and
  the visibility-change hydrate) re-read the vendors table and `mergeById` lets the
  remote row win. If a read lands after Approve but before the UPDATE commits, the
  server still answers `status = 'pending'` and that stale value overwrites the
  admin's optimistic row -- so the vendor snaps back to Pending with no error on
  screen. Pinning the decision for the duration of the write keeps the tick from
  undoing it; once the write resolves the pin is dropped, so a genuinely rejected
  update still rolls back on the following tick.
*/
const inFlightVendorStatus = new Map();
const inFlightStoreStatus = new Map();

/*
  How long an admin's approval decision is held against stale reads.

  Longer than the write itself on purpose. The decision has to survive not just
  the debounce and the UPDATE round trip, but also a refresh tick or a
  cross-tab `storage` event that was already in flight with the old value when
  Approve was tapped. After this window the remote row is authoritative again, so
  a decision that genuinely failed to save still rolls back rather than sticking
  on screen forever.
*/
const VENDOR_STATUS_PIN_MS = 60000;

export function pinVendorStatus(vendorId, status) {
  if (vendorId == null) return;
  inFlightVendorStatus.set(String(vendorId), { status, expiresAt: Date.now() + VENDOR_STATUS_PIN_MS });
}

export function pinStoreStatus(vendorId, status) {
  if (vendorId == null) return;
  inFlightStoreStatus.set(String(vendorId), { status, expiresAt: Date.now() + VENDOR_STATUS_PIN_MS });
}

export function clearStoreStatusPin(vendorId) {
  if (vendorId == null) return;
  inFlightStoreStatus.delete(String(vendorId));
}

export function pinVendorLogo(vendorId, logo) {
  if (vendorId == null) return;
  inFlightVendorLogoPins.set(String(vendorId), {
    logo,
    expiresAt: Date.now() + VENDOR_STATUS_PIN_MS,
  });
}

export function clearVendorLogoPin(vendorId) {
  if (vendorId == null) return;
  inFlightVendorLogoPins.delete(String(vendorId));
}

const persistVendor = async (client, state, authUser, profile) => {
  const vendorRow = await resolveVendorRow(client, authUser, profile);
  if (!vendorRow?.id) return null;
  const vendor = state.vendors.find((item) => (
    String(item.id) === String(profile?.id)
    || String(item.id) === String(vendorRow.legacy_id)
    || String(item.ownerId) === String(authUser.id)
  ));
  if (!vendor) {
    reportWriteError('update', 'vendors', {
      message: 'the vendors row exists but no row in local state matches it, so the logo was not written',
    });
    return null;
  }
  /*
    Optimistic local echo, before the network round trip.

    `updateProfile` has already put the new URL in `auth.user` and in the
    `vendors` list, so the UI reflects it immediately. But the 15s refresh tick
    merges remote rows *over* local ones, and until this write lands the server
    still holds the old `logo` -- so that tick was silently reverting the
    vendor's freshly uploaded photo seconds after they picked it. Pinning the
    in-flight value here keeps the optimistic copy intact for the duration of
    the save, and lets the guard below notice when the server rejected it and
    roll the photo back rather than leaving the UI claiming a save that never
    happened.

    `inFlightVendorLogos` is a Map rather than a single value because two saves
    can overlap: the logo and the cover are separate `updateProfile` calls.
  */
  if (!inFlightVendorLogos.has(String(vendorRow.id))) {
    inFlightVendorLogos.set(String(vendorRow.id), { logo: vendor.logo, coverImage: vendor.coverImage });
  }
  const logoPin = inFlightVendorLogoPins.get(String(vendor.id));
  const savedLogo = logoPin?.expiresAt > Date.now() ? logoPin.logo : vendor.logo;
  /*
    Routed through `writeTolerant`, which the customer path has always used and
    this one had not. That asymmetry is the bug behind "the customer can set a
    photo but the vendor cannot": on a server whose `vendors` table predates the
    `logo` column, PostgREST rejects the *entire* update statement with PGRST204.
    Every other field went down with it, and the vendor's upload was discarded
    with no way to tell from the UI. `upsertProfile` drops only the unknown
    column and still saves `cover_image`, `full_name` and the rest -- which is
    precisely why the same photo worked one portal over.

    With schema.sql applied the first attempt succeeds and nothing is dropped;
    this is the fallback that keeps a logo from being silently unsaveable on an
    un-migrated database.
  */
  reportWriteError('update', 'vendors', (await writeTolerant({
    table: 'vendors',
    values: {
      name: vendor.name, owner_name: vendor.ownerName, mobile: vendor.mobile, address: vendor.address,
      category: vendor.category, operating_hours: vendor.operatingHours, description: vendor.description,
      /*
        `status` is intentionally not written here. It is the admin's approval
        decision ('pending'/'approved'/'rejected'/'suspended'), and a vendor's
        local copy still says 'pending' until the 15s refresh tick brings the
        approval down. Writing it from the vendor's own session therefore
        reverted an approval the admin had just made -- the vendor's client kept
        stamping the row back to 'pending' faster than it could read the update,
        so the account appeared stuck. Only the admin path (`persistAllVendors`)
        may change it; `store_status` stays because open/busy/closed is the
        vendor's own control.
      */
      store_status: vendor.storeStatus,
      logo: savedLogo || null, cover_image: vendor.coverImage || null,
    },
    run: (row) => client.from('vendors').update(row).eq('id', vendorRow.id).select().single(),
  })).error);
  /*
    The save has resolved, so the in-flight pin no longer applies. A server that
    rejected the write has simply kept the old value, and the next refresh tick
    will now bring that back -- which is the correct outcome, because a photo
    that never reached the database should not stay on screen pretending it did.
  */
  inFlightVendorLogos.delete(String(vendorRow.id));
  let menuWriteFailed = false;
  const savedMenuIds = new Set();
  for (const item of vendor.menu || []) {
    const values = {
      vendor_id: vendorRow.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      stock: item.stock || 0,
      available: item.available !== false,
      image: item.image || null,
    };
    let result;
    if (item.legacy_id != null) {
      result = await client.from('menu_items')
        .upsert({ ...values, legacy_id: item.legacy_id }, { onConflict: 'vendor_id,legacy_id' })
        .select('id')
        .single();
    } else if (item.dbId != null) {
      result = await client.from('menu_items')
        .update(values)
        .eq('id', item.dbId)
        .eq('vendor_id', vendorRow.id)
        .select('id')
        .maybeSingle();
    } else {
      result = await client.from('menu_items')
        .upsert({ ...values, legacy_id: item.id }, { onConflict: 'vendor_id,legacy_id' })
        .select('id')
        .single();
    }
    if (result.error || !result.data?.id) {
      menuWriteFailed = true;
      reportWriteError('upsert', 'menu_items', result.error || {
        code: 'NO_ROWS',
        message: `menu item ${item.id} was not saved for vendor ${vendorRow.id}`,
      });
      continue;
    }
    savedMenuIds.add(String(result.data.id));
  }

  /*
    Only prune menu rows after every local row has been confirmed saved and the
    database snapshot was read successfully. A failed upsert must never turn a
    transient network/schema error into deletion of the remaining menu.
  */
  if (!menuWriteFailed) {
    const { data: remoteMenu, error: menuReadError } = await client
      .from('menu_items')
      .select('id')
      .eq('vendor_id', vendorRow.id);
    if (menuReadError) {
      reportWriteError('select', 'menu_items', menuReadError);
    } else {
      const staleIds = (remoteMenu || [])
        .filter((row) => !savedMenuIds.has(String(row.id)))
        .map((row) => row.id);
      if (staleIds.length) {
        reportWriteError('delete', 'menu_items', (await client.from('menu_items')
          .delete()
          .eq('vendor_id', vendorRow.id)
          .in('id', staleIds)).error);
      }
    }
  }
  return vendor;
};

const persistAllVendors = async (client, state) => {
  for (const vendor of state.vendors || []) {
    if (!vendor.ownerId) continue;
    const values = {
      name: vendor.name,
      owner_name: vendor.ownerName,
      mobile: vendor.mobile,
      address: vendor.address,
      category: vendor.category,
      operating_hours: vendor.operatingHours,
      description: vendor.description,
      store_status: vendor.storeStatus,
      logo: vendor.logo || null, cover_image: vendor.coverImage || null,
    };
    /*
      Approval status is written by the explicit admin action, not this
      debounced profile save. Otherwise an older queued profile snapshot could
      race the approval and write `pending` back after the admin approved it.

      Profile fields are written against `owner_id` first because that is the
      column the signup trigger sets. A row whose owner_id does not match is
      retried by the ids the app uses.
    */
    let result = await client.from('vendors').update(values).eq('owner_id', vendor.ownerId).select('id');
    if (!result.error && !result.data?.length) {
      result = await client.from('vendors').update(values).eq('legacy_id', vendor.id).select('id');
    }
    if (!result.error && !result.data?.length) {
      result = await client.from('vendors').update(values).eq('id', vendor.id).select('id');
    }
    reportWriteError('update', 'vendors', result.error);
    /*
      Still nothing updated: the admin's session is not allowed to write this
      row, or the row no longer exists. Report it rather than silently dropping
      the vendor profile changes.
    */
    if (!result.error && !result.data?.length) {
      reportWriteError('update', 'vendors', {
        code: 'NO_ROWS',
        message: `profile update for vendor ${vendor.id} (owner_id=${vendor.ownerId}) matched no row. Check that the vendor row exists and its owner_id is correct.`,
      });
    }
  }
};

const persistOrders = async (client, state, authUser, profile) => {
  if (state.auth.role !== 'customer') return;
  const ordersToPersist = (state.orders || []).filter((item) => (
    String(item.customerId) === String(profile?.id)
  ));
  for (const order of ordersToPersist) {
    const vendor = await client
      .from('vendors')
      .select('owner_id')
      .or(`legacy_id.eq.${order.vendorId},id.eq.${order.vendorId}`)
      .maybeSingle();
    reportWriteError('select', 'vendors', vendor.error);
    const orderValues = {
      order_number: order.id, vendor_legacy_id: order.vendorId,
      vendor_owner_id: vendor.data?.owner_id || null,
      customer_name: order.customerName, customer_mobile: order.customerMobile || null,
      customer_address: order.customerAddress || null, total: order.total,
      payment_status: order.paymentStatus || null, gcash_ref: order.gcashRef || null,
      queue_number: order.queueNumber || null, status: order.status,
      updated_at: order.updatedAt || new Date().toISOString(),
      // Was read by the mapper but never written, so a vendor's rejection
      // reason was lost on the next reload.
      reject_reason: order.rejectReason || null,
      fulfillment: order.fulfillment, payment_method: order.paymentMethod,
      special_instructions: order.specialInstructions || '', timeline: order.timeline || [],
    };
    /*
      Customers create orders, but only vendors advance their status. Re-upserting
      an existing order from a customer's stale browser snapshot overwrote a newer
      vendor status; only insert missing orders and leave existing rows untouched.
    */
    let savedOrder = await client
      .from('orders')
      .select('id')
      .eq('order_number', order.id)
      .eq('customer_id', authUser.id)
      .maybeSingle();
    if (savedOrder.error) {
      reportWriteError('select', 'orders', savedOrder.error);
      continue;
    }
    if (!savedOrder.data) {
      savedOrder = await writeTolerant({
        table: 'orders',
        values: { ...orderValues, customer_id: authUser.id },
        run: (values) => client.from('orders').insert(values).select('id').single(),
        onError: (error) => {
          if (error.code !== '23505') reportWriteError('insert', 'orders', error);
        },
      });
      if (savedOrder.error?.code === '23505') {
        savedOrder = await client
          .from('orders')
          .select('id')
          .eq('order_number', order.id)
          .eq('customer_id', authUser.id)
          .maybeSingle();
      }
    }
    if (!savedOrder?.data?.id) {
      if (!savedOrder?.error) {
        reportWriteError('insert', 'orders', {
          code: 'NO_ROWS',
          message: `No order row was returned for "${order.id}". Check that the order exists and belongs to the signed-in customer.`,
        });
      }
      continue;
    }
    /*
      The items are rewritten on every state save. That was a delete followed by
      a bare insert, and two things went wrong with it. The insert carries no
      `order_id` in the policy's favour at check time -- RLS evaluates
      order_items_participant against the row being written, and a delete-then-
      insert inside the same save briefly has no visible parent -- so Postgres
      rejected the insert with 42501 "new row violates row-level security
      policy". And the delete itself is a separate round trip that can succeed
      while the insert fails, leaving the order with no items at all.

      Upserting the items onto the same parent keeps a valid order_id on every
      row for the check, and makes the write idempotent instead of destructive.
    */
    const items = (order.items || []).map((item) => ({
      order_id: savedOrder.data.id, menu_legacy_id: item.menuId, name: item.name,
      price: item.price, quantity: item.quantity, notes: item.notes || '',
    }));
    if (items.length > 0) {
      reportWriteError('upsert', 'order_items', (await client.from('order_items').upsert(items, {
        onConflict: 'order_id,menu_legacy_id,notes',
      })).error);
    }
  }
};

export async function persistOrderStatus(order, role) {
  if (!isSupabaseConfigured) return;
  if (!order?.id || !order.status || !role) {
    throw new Error('Order status update is missing required information.');
  }
  const client = getSupabaseClient(role);
  if (!client) throw new Error('Supabase is not configured for this session.');
  const values = {
    status: order.status,
    updated_at: order.updatedAt,
    timeline: order.timeline,
    ...(order.rejectReason ? { reject_reason: order.rejectReason } : {}),
  };
  const { data, error } = await client
    .from('orders')
    .update(values)
    .eq('order_number', order.id)
    .eq('status', order.expectedStatus)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Could not save order ${order.id}: ${error.message}`);
  if (!data) {
    throw new Error(`Order ${order.id} changed elsewhere or you no longer have permission to update it. Refresh and try again.`);
  }
}

const persistPosts = async (client, state, authUser, vendorForPosts) => {
  for (const post of (state.posts || []).filter((item) => (
    String(item.authorId) === String(authUser.id)
    || (vendorForPosts && (
      String(item.vendorId) === String(vendorForPosts.id)
      || String(item.authorId) === String(vendorForPosts.id)
    ))
  ))) {
    await writeTolerant({
      table: 'posts',
      values: {
        legacy_id: Number(post.id), author_id: authUser.id, author_name: post.authorName,
        author_avatar: post.authorAvatar || null,
        author_role: state.auth.role, content: post.content || '', type: post.type || null,
        product_id: post.productId || null,
        vendor_legacy_id: post.vendorId || (vendorForPosts?.id || null),
        product: post.products
          ? { kind: 'menu', products: post.products }
          : post.product || null,
        image_url: post.image || null,
        likes: post.likes || 0, liked_by: post.likedBy || [], comments: post.comments || [],
        pinned: !!post.pinned, hidden: !!post.hidden, reported: !!post.reported, report_reason: post.reportReason || null,
        publish_at: post.publishAt || null, expires_at: post.expiresAt || null,
      },
      run: (values) => client.from('posts').upsert(values, { onConflict: 'legacy_id' }),
      onError: (error) => reportWriteError('upsert', 'posts', error),
    });
  }
};

/*
  Deletes one notification from the database, for real.

  Backdating `expires_at` is enough to make a row disappear from every surface
  that reads it, but the row itself then sat in `notifications` forever and was
  re-fetched on every 15s tick only to be filtered again. For an order status
  that is a row per stage, so a busy account accumulated dead rows it never
  stopped re-reading. This removes them at the source.

  Scoped by `user_id` as well as `legacy_id`, so a caller can only ever delete
  the signed-in account's own notification. `dismissNotification` is reachable
  from the customer notification list, and without that second predicate a row id
  was enough to delete somebody else's alert. `user_id` is text and `legacy_id`
  is bigint, which is why the id is normalised with `asNumber` rather than
  stringified -- `.eq('legacy_id', '12')` against a bigint column is a type
  mismatch and PostgREST rejects it instead of matching the row.

  The admin-desk rows are deliberately not touched here: those are delivered
  through `notify_admin_desk` and are owned by the admin, not by the account
  dismissing them, so they are cleaned up on the admin side instead.

  Fire-and-forget, matching every other write in this file. Returns the error so
  the caller can surface it; the local backdate has already happened either way,
  so a failure here means a row stays hidden rather than reappearing.
*/
export async function deleteSupabaseNotification(notificationId, authUser) {
  if (!isSupabaseConfigured || notificationId == null || !authUser?.id) {
    return { error: null };
  }
  const client = getSupabaseClient();
  const legacyId = asNumber(notificationId);
  const { error } = await client
    .from('notifications')
    .delete()
    .eq('user_id', authUser.id)
    .eq('legacy_id', legacyId);
  if (error) reportWriteError('delete', 'notifications', error);
  return { error };
}

const deleteMediaFiles = async (client, rootPath = '') => {
  const bucket = client.storage.from('marketplace-media');
  const listFiles = async (path) => {
    const files = [];
    const folders = [];
    const limit = 100;

    for (let offset = 0; ; offset += limit) {
      const { data, error: listError } = await bucket.list(path, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (listError) {
        throw new Error(`Media files could not be listed: ${listError.message}`);
      }
      const entries = data || [];
      for (const entry of entries) {
        const fullPath = path ? `${path}/${entry.name}` : entry.name;
        if (entry.id == null) folders.push(fullPath);
        else files.push(fullPath);
      }
      if (entries.length < limit) break;
    }

    for (const folder of folders) {
      files.push(...await listFiles(folder));
    }
    return files;
  };

  const files = await listFiles(rootPath);
  for (let index = 0; index < files.length; index += 100) {
    const { error: removeError } = await bucket.remove(files.slice(index, index + 100));
    if (removeError) {
      throw new Error(`Media files could not be deleted: ${removeError.message}`);
    }
  }
  if ((await listFiles(rootPath)).length > 0) {
    throw new Error('Some uploaded media files still remain after the delete request.');
  }
};

export async function deleteSupabaseAccount(userId) {
  const client = getSupabaseClient('admin');
  if (!client) {
    throw new Error('Supabase is not configured, so the account could not be deleted.');
  }

  const { error } = await client.rpc('admin_delete_account', { p_user_id: userId });
  if (error) {
    const schemaHint = ['PGRST202', '42883'].includes(error.code)
      ? ' Apply the latest supabase/schema.sql in the Supabase SQL Editor.'
      : '';
    throw new Error(`Unable to delete account: ${error.message}${schemaHint}`);
  }

  try {
    const { data, error: verifyError } = await client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    if (verifyError) throw new Error(`Account deletion could not be verified: ${verifyError.message}`);
    if (data) throw new Error('The account profile still exists after the delete request.');
    await deleteMediaFiles(client, String(userId));
  } catch (error) {
    throw Object.assign(
      new Error(`The account was deleted, but its uploaded images could not be fully removed: ${error.message}`),
      { accountDeleteComplete: true }
    );
  }
}

export async function resetSupabaseData() {
  const client = getSupabaseClient('admin');
  if (!client) {
    throw new Error('Supabase is not configured, so database data could not be reset.');
  }

  const { error } = await client.rpc('admin_reset_data');
  if (error) {
    const schemaHint = ['PGRST202', '42883'].includes(error.code)
      ? ' Apply the latest supabase/schema.sql in the Supabase SQL Editor.'
      : '';
    throw new Error(`Unable to reset database data: ${error.message}${schemaHint}`);
  }

  try {
    const resetTables = [
      'vendors',
      'menu_items',
      'orders',
      'order_items',
      'posts',
      'post_comments',
      'notifications',
      'chats',
      'favorites',
    ];
    await Promise.all([
      ...resetTables.map(async (table) => {
        const { count, error: verifyError } = await client
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (verifyError) throw new Error(`${table} could not be verified: ${verifyError.message}`);
        if (count !== 0) throw new Error(`${table} still contains ${count} record(s).`);
      }),
      (async () => {
        const { count, error: verifyError } = await client
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .neq('role', 'admin');
        if (verifyError) throw new Error(`Non-admin accounts could not be verified: ${verifyError.message}`);
        if (count !== 0) throw new Error(`There are still ${count} non-admin profile(s).`);
      })(),
    ]);
    await deleteMediaFiles(client);
  } catch (error) {
    throw Object.assign(
      new Error(`Database records were reset, but uploaded media could not be fully deleted: ${error.message}`),
      { databaseResetComplete: true }
    );
  }
}

const persistNotifications = async (client, state, authUser) => {
  const all = state.notifications || [];
  const vendor = state.auth?.role === 'vendor'
    ? (state.vendors || []).find((item) => String(item.ownerId) === String(authUser.id))
    : null;
  const vendorRecipients = new Set(
    [vendor?.id, vendor?.legacy_id, vendor?.ownerId]
      .filter((id) => id != null)
      .flatMap((id) => [String(id), `vendor-${id}`])
  );

  /*
    Alerts for the admin desk are handled separately, through the RPC.

    They are raised by a customer or vendor -- a new registration, or a lockout
    after repeated failed logins -- so nobody is signed in as an admin when they
    are created and there is no admin id to address them to. The row has to be
    owned by the admin to be visible to the admin screens, and RLS does not let a
    customer write a row owned by somebody else, so the write happens inside
    `notify_admin_desk`.

    The alert's own id is sent as `p_legacy_id` and the function inserts on
    conflict do nothing, so repeats collapse in the database. An earlier version
    remembered sent ids in a module-level Set, which looked sufficient because
    persistState runs every 1.5s, but the Set is empty after every reload while
    the local copy of the alert stays in this customer's list until an admin
    reads it -- so each reload added another row for the same event. Dedupe has
    to live somewhere that outlives the page.
  */
  const adminAlerts = all.filter((item) => String(item.userId) === 'admin');
  for (const alert of adminAlerts) {
    /*
      A string id can never key a bigint column, so retrying it is futile: this
      used to `break`, which stopped the whole loop and left every *later* alert
      unsent for as long as the bad row stayed in the list. Because that row is
      persisted to localStorage and reloaded forever, one unfixable alert
      permanently silenced all admin-desk notifications after it. `continue`
      skips only the impossible row; the RPC guard below still stops the pass on
      a real failure, which is genuinely worth retrying.
    */
    if (!Number.isSafeInteger(alert.id)) {
      reportWriteError('rpc', 'notify_admin_desk', {
        message: `alert id ${alert.id} is not an integer, so it cannot key the notification row; skipping this row`,
      });
      continue;
    }
    // No client-side `already sent` check: the RPC is the guard. A failed call
    // breaks so the next pass retries it.
    const error = reportWriteError('rpc', 'notify_admin_desk', (await client.rpc('notify_admin_desk', {
      p_legacy_id: alert.id,
      p_title: alert.title || 'Account activity',
      p_message: alert.message || '',
      p_type: alert.type || 'account',
    })).error);
    if (error) break;
  }

  for (const notification of all.filter((item) => {
    const uid = item.userId;
    if (uid == null) return false;
    const str = String(uid);
    /*
      The literal 'admin' is handled above and must not also be claimed here: the
      old filter accepted it for every role and then stored `user_id =
      authUser.id`, so an alert meant for the admin desk landed in the
      registering customer's own list instead.

      `vendor-<id>` is the prefix used for a vendor's notifications before vendor
      rows carried their own id, so it is still matched by id and not by role.
    */
    if (str === 'admin') return false;
    return str === String(authUser.id)
      || str === `vendor-${authUser.id}`
      || (state.auth?.role === 'vendor' && vendorRecipients.has(str));
  })) {
    /*
      Requires a unique index on (user_id, legacy_id). Notification IDs are
      unique only within their recipient: the admin-desk RPC sends the same
      alert id to every admin, so a global unique constraint would silently
      deliver the alert to only the first admin. See schema.sql.
    */
    /*
      A null legacy_id never conflicts: an unparsable id would make every state
      change insert another copy of the row and reset created_at to now(), which
      resurfaced old alerts on every reload. An id that is not a safe integer is
      therefore skipped instead of coerced.
    */
    const legacyId = Number(notification.id);
    if (!Number.isSafeInteger(legacyId)) {
      reportWriteError('upsert', 'notifications', {
        message: `skipped notification ${JSON.stringify(notification.id)}: id is not a safe integer`,
        code: 'BAD_LEGACY_ID',
      });
      continue;
    }
    const createdAt = notification.createdAt || new Date().toISOString();
    const values = {
      legacy_id: legacyId, user_id: authUser.id, type: notification.type,
      title: notification.title, message: notification.message, read: !!notification.read,
      // Written on every upsert so re-saving an alert keeps the moment it was
      // raised instead of moving it to the top of the list on every reload.
      created_at: createdAt,
      /*
        Carried across so the TTL survives a reload. Without this column the
        expiry only ever existed in the browser that raised the notification:
        the row was written without it, the reload brought back a row with no
        `expiresAt`, and `isNotificationExpired` reads that as "never expires" --
        so every order status notification became permanent again after the first
        refresh. Written as null rather than omitted when there is no expiry, so
        a row that had one and lost it (a promo re-saved without a TTL) is cleared
        server-side too instead of keeping a stale stamp forever.
      */
      expires_at: notification.expiresAt || null,
    };
    await upsertNotification(client, values, (error) => reportWriteError('upsert', 'notifications', error));
  }
};

const persistChats = async (client, state, authUser, profile, vendorForPosts) => {
  if (state.auth.role !== 'customer' && state.auth.role !== 'vendor') return;
  const vendorId = vendorForPosts?.id;
  for (const chat of (state.chats || []).filter((item) => (
    state.auth.role === 'customer'
      ? String(item.customerId) === String(profile?.id)
      : String(item.vendorId) === String(vendorId)
  ))) {
    /*
      Customers must write their authenticated UUID because older/local chat
      rows can carry browser-generated ids. Vendors, however, must preserve the
      actual customer UUID on the conversation: writing the vendor's auth UUID
      into customer_id when replying transfers the thread away from its owner,
      so it disappears from the customer's inbox on the next refresh.
    */
    const existing = await client.from('chats').select('*').eq('id', chat.id).maybeSingle();
    if (existing.error) {
      reportWriteError('select', 'chats', existing.error);
      continue;
    }
    const latestChat = existing.data ? mapChats([existing.data])[0] : null;
    const persistedMessageIds = new Set((latestChat?.messages || []).map((message) => String(message.id)));
    for (const message of (chat.messages || [])) {
      if (!persistedMessageIds.has(String(message.id))) {
        const { error } = await client.rpc('append_chat_message', {
          p_chat_id: chat.id,
          p_vendor_legacy_id: chat.vendorId,
          p_customer_id: state.auth.role === 'customer' ? authUser.id : chat.customerId,
          p_message: message,
        });
        if (error) reportWriteError('rpc append', 'chats', error);
        continue;
      }
      const persistedMessage = latestChat.messages.find((item) => String(item.id) === String(message.id));
      if (JSON.stringify(persistedMessage.reactions || []) === JSON.stringify(message.reactions || [])) continue;
      const { error } = await client.rpc('update_chat_message_reactions', {
        p_chat_id: chat.id,
        p_vendor_legacy_id: chat.vendorId,
        p_customer_id: state.auth.role === 'customer' ? authUser.id : chat.customerId,
        p_message_id: String(message.id),
        p_reactions: message.reactions || [],
      });
      if (error) reportWriteError('rpc reaction update', 'chats', error);
    }
  }
};

const persistFavorites = async (client, state, authUser, canStillWrite, onConfirmed, onWriteFailed) => {
  // Only a customer has a favourites list. An admin or vendor that somehow holds
  // rows must not write them: `user_id` is written from the session below, so
  // they would land in their own account rather than the owner's.
  if (state.auth.role !== 'customer') return;

  const values = [];
  for (const favorite of state.favorites || []) {
    /*
      Only this account's rows may be written.

      localStorage is shared across accounts on one device, so `state.favorites`
      still carries rows belonging to whatever account was signed in before.
      Iterating the whole list stamped `user_id: authUser.id` onto all of them,
      which meant a second customer signing in on the same phone silently
      inherited the first customer's favourites on the server -- and because the
      delete pass below derives `kept` from the same list, those copied rows were
      then protected from cleanup as well. Filter first, then shape.
    */
    if (String(favorite.userId) !== String(authUser.id)) continue;
    const targetLegacyId = Number(favorite.refId);
    /*
      Same rule as notifications: a null conflict target never conflicts, so a
      non-integer refId would insert another copy of the row on every save. There
      is no unique index that could reject it either -- the key is made of all
      three columns, so a missing or fractional target is not a row the table can
      hold. It is skipped, not coerced.
    */
    if (!Number.isSafeInteger(targetLegacyId)) {
      reportWriteError('upsert', 'favorites', {
        code: 'BAD_LEGACY_ID',
        message: `skipped favourite ${JSON.stringify(favorite.refId)}: target is not a safe integer`,
      });
      continue;
    }
    const vendorLegacyId = favorite.vendorId == null ? null : Number(favorite.vendorId);
    values.push({
      user_id: authUser.id,
      target_type: favorite.type,
      target_legacy_id: targetLegacyId,
      vendor_legacy_id: Number.isSafeInteger(vendorLegacyId) ? vendorLegacyId : null,
      /*
        Resent on every save so the row keeps the moment it was added, and so that
        a row whose timestamp was lost still lands with a stable one.

        With ignoreDuplicates the payload is only consulted for rows the table does
        not have yet, which is exactly the behaviour wanted: an existing row keeps
        its original created_at instead of being restamped to now() on every save,
        which would otherwise drift every favourite to the top of the list on each
        reload.
      */
      created_at: favorite.createdAt || new Date().toISOString(),
    });
  }

  if (values.length) {
    /*
      ignoreDuplicates, not a plain upsert.

      PostgREST implements `.upsert()` as INSERT ... ON CONFLICT ... DO UPDATE, and
      PostgreSQL requires UPDATE privilege on the columns that clause writes. The
      schema deliberately grants only `select, insert, delete` on this table, so
      every single favourites write failed with 42501 permission denied -- the
      hearts lived in localStorage only, and the next reload's reconcile deleted
      them. DO NOTHING needs INSERT alone, which is what is already granted, and
      it is also the semantically right call: the conflict target is the full
      primary key, so a conflict means "this row is already correct" and there is
      nothing to update.
    */
    const { error: upsertError } = await client.from('favorites').upsert(values, {
      onConflict: 'user_id,target_type,target_legacy_id',
      ignoreDuplicates: true,
    });
    reportWriteError('upsert', 'favorites', upsertError);
    /*
      Tell the caller the write path is broken, before the early return. The caller
      uses this to stop the refresh tick from reconciling local rows away while the
      server is refusing writes; without the signal, a reload (which empties the
      in-memory pending set) would have the tick delete every favourite the failed
      write never stored.
    */
    if (upsertError) onWriteFailed?.(upsertError);
    if (!canStillWrite()) return;
    /*
      Confirm the rows the server has now accepted, and report the caller's
      onConfirmed with them. This is what releases the refresh tick's hold on a
      favourite that has not been written yet.

      A failed upsert deliberately confirms nothing. Leaving the rows pending means
      the tick keeps protecting them instead of reconciling them away, which is the
      correct outcome: the save is retried on the next pass, and a favourite the
      server never accepted is not one that should have been deleted locally.
    */
    if (!upsertError) {
      onConfirmed?.(values.map((row) => ({
        userId: row.user_id, type: row.target_type, refId: row.target_legacy_id,
      })));
    }
  }

  /*
    Deletions cannot be expressed as an upsert, so anything on the server that is
    no longer in state is removed explicitly. Without this, un-favouriting would
    clear the heart on this device and the row would come back on the next login,
    from a device that never un-favourited anything.

    The comparison is on the same three columns the table is keyed by, using the
    uid rather than the in-app id for the same reason persistChats does.

    A read that failed returns early rather than treating the reply as "the server
    holds nothing". Deleting every remote row because the table is missing would
    wipe the server-side list while the local copy made the hearts still look
    filled -- and the customer's favourites would be gone for good the moment they
    reloaded on another device.
  */
  const kept = new Set(values.map((row) => `${row.target_type}:${row.target_legacy_id}`));
  const { data: existing, error: listError } = await client
    .from('favorites').select('target_type,target_legacy_id').eq('user_id', authUser.id);
  if (listError) {
    reportWriteError('select', 'favorites', listError);
    onWriteFailed?.(listError);
    return;
  }
  for (const row of existing || []) {
    if (kept.has(`${row.target_type}:${Number(row.target_legacy_id)}`)) continue;
    reportWriteError('delete', 'favorites', (await client.from('favorites')
      .delete()
      .eq('user_id', authUser.id)
      .eq('target_type', row.target_type)
      .eq('target_legacy_id', row.target_legacy_id)).error);
    if (!canStillWrite()) return;  }
};

/*
  Re-applies an in-flight vendor logo/cover onto a freshly loaded remote row.

  `loadRemoteState` runs on sign-in and every 15s, and `mergeById` lets the
  remote row win. A vendor who uploads a photo gets an instant local preview,
  then the very next tick reads the server -- which does not have the new value
  yet, because the write is debounced by 1.5s and RTT-bound -- and overwrites the
  preview with the old `logo`. The upload appeared to work and then vanished on
  its own, with no error anywhere. That is the "hindi nag-rereflect" symptom.

  Only the fields with a save actually in flight are protected, and only for as
  long as that save takes: `persistVendor` deletes the entry once its write
  resolves, so a server that genuinely rejected the photo brings the old value
  back on the following tick. Silently keeping a picture that was never stored
  would be the worse failure -- the vendor would believe it was saved.
*/
export function hydrateLocalVendorOverlay(remoteVendors = [], inFlightLogos = inFlightVendorLogos) {
  if ((!inFlightLogos.size && !inFlightVendorLogos.size && !inFlightVendorLogoPins.size && !inFlightVendorStatus.size && !inFlightStoreStatus.size) || !Array.isArray(remoteVendors)) {
    return remoteVendors;
  }
  const now = Date.now();
  for (const [id, pin] of inFlightVendorStatus) {
    if (!pin || pin.expiresAt <= now) inFlightVendorStatus.delete(id);
  }
  for (const [id, pin] of inFlightStoreStatus) {
    if (!pin || pin.expiresAt <= now) inFlightStoreStatus.delete(id);
  }
  for (const [id, pin] of inFlightVendorLogoPins) {
    if (!pin || pin.expiresAt <= now) inFlightVendorLogoPins.delete(id);
  }
  return remoteVendors.map((row) => {
    const key = String(row.id);
    const pin = inFlightLogos.get(key) || inFlightVendorLogos.get(key);
    const vendorKey = String(row.legacy_id ?? row.id);
    const logoPin = inFlightVendorLogoPins.get(vendorKey);
    const statusPin = inFlightVendorStatus.get(vendorKey);
    const storeStatusPin = inFlightStoreStatus.get(vendorKey);
    if (!pin && logoPin === undefined && statusPin === undefined && storeStatusPin === undefined) return row;
    const out = { ...row };
    if (pin) {
      if (pin.logo !== undefined) out.logo = pin.logo;
      if (pin.coverImage !== undefined) out.coverImage = pin.coverImage;
    }
    if (logoPin) out.logo = logoPin.logo;
    if (statusPin) {
      out.status = statusPin.status;
    }
    if (storeStatusPin) {
      out.store_status = storeStatusPin.status;
    }
    return out;
  });
}

export async function persistState(state, authUser, options = {}) {
  const client = getSupabaseClient(state.auth?.role);
  if (!client || !authUser?.id) return;
  sessionAuthFailureReported = false;

  /*
    Each stage below loops once per row. If the credential turns out to be dead
    partway through -- which is what the 401-then-42501 flood was -- the
    remaining stages would each issue a request per row anyway and produce the
    same failure hundreds of times over. `canStillWrite` is re-checked between
    stages so one bad session costs one request, not one per record.
  */
  const { data: sessionData } = await client.auth.getSession().catch(() => ({ data: null }));
  const canStillWrite = () => !sessionAuthFailureReported;
  if (!sessionData?.session?.access_token) return;

  const profile = await persistProfile(client, state, authUser);
  if (!canStillWrite()) return;

  if (state.auth.role === 'vendor') {
    await persistVendor(client, state, authUser, profile);
  } else if (state.auth.role === 'admin') {
    await persistAllVendors(client, state);
  }
  if (!canStillWrite()) return;

  await persistOrders(client, state, authUser, profile);
  if (!canStillWrite()) return;

  const vendorForPosts = state.auth.role === 'vendor'
    ? (state.vendors || []).find((item) => String(item.ownerId) === String(authUser.id))
    : null;
  await persistPosts(client, state, authUser, vendorForPosts);
  if (!canStillWrite()) return;
  await persistNotifications(client, state, authUser);
  if (!canStillWrite()) return;
  await persistChats(client, state, authUser, profile, vendorForPosts);
  if (!canStillWrite()) return;
  await persistFavorites(client, state, authUser, canStillWrite, options.onFavoritesWritten, options.onFavoritesWriteFailed);
}
