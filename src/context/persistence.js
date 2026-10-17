// Local persistence + merge helpers. These are pure functions with no React
// dependency, so they are safe to unit test and safe to share.

export const STORAGE_KEY = 'lancaster_zone1_eats_state';
export const LOCAL_AUTH_KEY = 'lancaster_local_auth';
export const ACTIVE_PORTAL_KEY = 'lancaster_active_portal';
export const PORTAL_CHANGE_EVENT = 'lancaster:portal-changed';
export const FEED_CHANNEL = 'lancaster_feed_updates';
export const PRODUCT_SHARE_COOLDOWN_MS = 60 * 60 * 1000;

/*
  How long a transient order-status notification stays in the list.

  Every status change appends a row, and an order walks RECEIVED -> PREPARING ->
  READY -> OUT FOR DELIVERY -> COMPLETED, so a single order left the customer with
  five rows that never went away. Nothing bounded the list: no TTL, no delete, and
  the state is written to localStorage on every tick, so it only ever grew.

  One hour is long enough to cover a normal pickup, including the wait after
  "Ready", and short enough that a busy day does not bury the notification that
  actually matters. Deliberately not tied to the order's own lifecycle -- a
  terminal status that arrives while the tab is closed would then never be shown
  at all, which is the one alert a customer most needs to see.

  Notifications without an `expiresAt` never expire. Promo and announcement rows
  have no TTL by design; only the transient order-status rows set one.
*/
export const ORDER_NOTIFICATION_TTL_MS = 60 * 60 * 1000;

/*
  True once a notification is past its TTL.

  Read-only: it never mutates and never assumes a clock beyond `Date.now()`, so
  it is safe in render as well as in the sweep that clears state. `expiresAt` is
  read through `Date.parse`, and an unparseable value is treated as "no expiry"
  rather than as expired -- a malformed timestamp must not silently delete rows.
*/
export function isNotificationExpired(notification, now = Date.now()) {
  if (!notification?.expiresAt) return false;
  const expiry = Date.parse(notification.expiresAt);
  if (Number.isNaN(expiry)) return false;
  return expiry <= now;
}

/*
  Drops expired rows. Returns the original array when nothing changed so callers
  can compare by reference and skip a state write -- this runs on a timer, and a
  new array every tick would re-render every notification consumer forever.
*/
export function pruneExpiredNotifications(notifications = [], now = Date.now()) {
  const kept = notifications.filter((notification) => !isNotificationExpired(notification, now));
  return kept.length === notifications.length ? notifications : kept;
}

/*
  Ids for rows created in this browser (local registrations, menu items).

  `Date.now()` alone is not unique: two accounts registered inside the same
  millisecond got the same id, and every list is keyed by id -- `mergeById`
  dedupes on it, `updateProfile` matches on it, React keys rows by it. Two
  distinct accounts therefore collapsed into a single shared row, and the name
  and avatar written by one account appeared on the other.

  Monotonic, so a burst of creations in one tick still gets distinct ids, and it
  never returns a value at or below one already issued this session.
*/
let lastIssuedLocalId = 0;
export const nextLocalId = () => {
  lastIssuedLocalId = Math.max(Date.now(), lastIssuedLocalId + 1);
  return lastIssuedLocalId;
};

/*
  Repair ids that were minted as fractions.

  Rows created by the browser previously used `Date.now() + Math.random()`, so
  every `legacy_id` was fractional. Postgres does not reject a fraction written
  into a `bigint` column -- it assignment-casts numeric to bigint and rounds
  silently. The write therefore reported success, the server kept a different
  number than the app held, and the next reload read back an id the app had
  never seen. Every list is keyed by id, so the row then existed twice: once
  from local storage under the fractional id, once from the server under the
  rounded one, and neither copy knew about the other.

  Rounding must match the server's half-up rule, not JS's, hence
  `Math.round` on the absolute value plus the sign. `Math.floor` would send
  1234.7 back as 1234 and leave the pair split.
*/
export function normalizeRowId(value) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return value;
  if (Number.isInteger(num)) return num;
  return num < 0 ? -Math.round(-num) : Math.round(num);
}

/*
  Whether an id can key a `bigint` column on the server.

  `normalizeRowId` returns a non-numeric id untouched, which is correct for the
  lists it was written for but wrong for `notifications.legacy_id`, which is a
  bigint that `notify_admin_desk` inserts on. An older build minted ids like
  `account-1790330622253-nlutke`; those rows live in localStorage, survive every
  reload, and cannot be repaired by rounding -- there is no number to round
  them into. Each one made `persistNotifications` throw and abandon the rest of
  the admin-desk alerts behind it.
*/
export function isServerKeyableId(value) {
  return Number.isSafeInteger(typeof value === 'number' ? value : Number(value));
}

const normalizeRowKeys = (row, keys = ['id']) => {
  let changed = false;
  const next = { ...row };
  keys.forEach((key) => {
    if (next[key] == null) return;
    const repaired = normalizeRowId(next[key]);
    if (repaired !== next[key]) {
      next[key] = repaired;
      changed = true;
    }
  });
  return [next, changed];
};

/*
  Normalise every id-bearing list in a persisted state.

  Repaired rows can now collide with a sibling that already holds the rounded
  id -- two browser rows that both became 1234. The later one is dropped, which
  keeps the list keyed uniquely. `createdAt` breaks the tie so the survivor is
  the newer row rather than whichever happened to be ordered first.

  Returns the same shape it was given, plus the number of rows it had to drop,
  so the caller can report the repair instead of silently mutating user data.
*/
export function repairFractionalIds(state = {}) {
  let repaired = 0;
  let dropped = 0;

  const fixList = (list, keys) => {
    if (!Array.isArray(list) || !list.length) return list;
    // Repairs and de-duplication have to happen in one pass. The repaired rows
    // are the ones being keyed, so keying them by their pre-repair id would put
    // both copies back in the map and undo the repair.
    const byId = new Map();
    list.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const [next, changed] = normalizeRowKeys(row, keys);
      if (changed) repaired += 1;
      if (next.id == null) return;
      const key = String(next.id);
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, next);
        return;
      }
      // Same row after rounding: keep whichever was written later.
      const incomingTime = new Date(next.createdAt || 0).getTime();
      const existingTime = new Date(existing.createdAt || 0).getTime();
      if (incomingTime > existingTime) byId.set(key, next);
      dropped += 1;
    });
    if (byId.size === list.length && list.every((row, i) => row === [...byId.values()][i])) return list;
    return [...byId.values()];
  };

  const next = { ...state };
  // Rows keyed by their own id: repair it, then collapse rows that rounding
  // made identical.
  if (Array.isArray(next.vendors)) next.vendors = fixList(next.vendors, ['id']);
  if (Array.isArray(next.customers)) next.customers = fixList(next.customers, ['id']);
  if (Array.isArray(next.notifications)) {
    next.notifications = fixList(next.notifications, ['id']);
    next.notifications = next.notifications.map((n) => {
      const [next2, changed] = normalizeRowKeys(n || {}, ['userId']);
      if (changed) repaired += 1;
      return next2;
    });
  }
  if (Array.isArray(next.promos)) next.promos = fixList(next.promos, ['id']);

  if (Array.isArray(next.posts)) {
    next.posts = fixList(next.posts, ['id']);
    next.posts = next.posts.map((post) => {
      const [next2, changed] = normalizeRowKeys(post || {}, ['productId', 'vendorId']);
      if (changed) repaired += 1;
      return Array.isArray(next2.comments)
        ? { ...next2, comments: fixList(next2.comments, ['id']) }
        : next2;
    });
  }

  if (Array.isArray(next.chats)) {
    next.chats = next.chats.map((chat) => {
      const [next2, changed] = normalizeRowKeys(chat || {}, ['vendorId']);
      if (changed) repaired += 1;
      return Array.isArray(next2.messages)
        ? { ...next2, messages: fixList(next2.messages, ['id']) }
        : next2;
    });
  }

  /*
    Orders and vendors carry a different corrupt column each: the order number
    itself, plus the vendor it points at. Only the order number is the row's own
    identity, so that is the only key that may be de-duplicated -- collapsing on
    a foreign key would merge two genuinely separate orders placed at the same
    shop. The foreign ids are repaired in place.
  */
  if (Array.isArray(next.orders)) {
    next.orders = fixList(next.orders, ['id']);
    next.orders = next.orders.map((order) => {
      const [next2, changed] = normalizeRowKeys(order || {}, ['vendorId', 'customerId']);
      if (changed) repaired += 1;
      const withItems = Array.isArray(next2.items)
        ? { ...next2, items: next2.items.map((item) => { const [i2, c2] = normalizeRowKeys(item || {}, ['menuId', 'vendorId']); if (c2) repaired += 1; return i2; }) }
        : next2;
      /*
        Orders used to carry `subtotal` next to `total`. There was never a column
        for it and no mapper produced one, so it only ever existed in the browser
        copy and vanished on the first reload -- an order could read differently
        before and after a sync. New orders no longer write it; dropping it here
        retires the field on the rows already sitting in localStorage.
      */
      if (withItems && 'subtotal' in withItems) {
        const { subtotal: _retired, ...rest } = withItems;
        return rest;
      }
      return withItems;
    });
  }

  if (Array.isArray(next.vendors)) {
    next.vendors = next.vendors.map((vendor) => (Array.isArray(vendor.menu)
      ? { ...vendor, menu: fixList(vendor.menu, ['id']) }
      : vendor));
  }

  /*
    Favourites carry two ids and neither of them is the row's own identity: the
    key is (userId, type, refId), and `vendorId` is only a pointer to the shop a
    saved dish came from. Both are repaired in place, and dedupe runs on the
    natural key -- collapsing on refId alone would merge one customer's saved
    dish with another's.
  */
  if (Array.isArray(next.favorites)) {
    const byKey = new Map();
    next.favorites.forEach((favorite) => {
      if (!favorite || typeof favorite !== 'object') return;
      const [next2, changed] = normalizeRowKeys(favorite, ['refId', 'vendorId']);
      if (changed) repaired += 1;
      if (next2.userId == null || next2.refId == null || !next2.type) {
        dropped += 1;
        return;
      }
      const refId = normalizeRowId(next2.refId);
      const key = `${next2.userId}:${next2.type}:${refId}`;
      if (!byKey.has(key)) byKey.set(key, { ...next2, refId });
      else dropped += 1;
    });
    next.favorites = [...byKey.values()];
  }

  // Cart lines are keyed by cartId, and the vendor/menu ids they point at were
  // minted the same fractional way, so a repaired cartId would still reference
  // a shop and a dish that no longer exist under that id.
  if (Array.isArray(next.cart)) {
    const byKey = new Map();
    next.cart.forEach((line) => {
      if (!line || typeof line !== 'object' || line.cartId == null) return;
      const [next2, changed] = normalizeRowKeys(line, ['vendorId', 'menuId']);
      if (changed) repaired += 1;
      const key = String(normalizeRowId(next2.cartId));
      if (!byKey.has(key)) byKey.set(key, { ...next2, cartId: Number(key) });
      else dropped += 1;
    });
    next.cart = [...byKey.values()];
  }

  return { state: next, repaired, dropped };
}

/*
  Is `row` the account `user` is signed in as?

  Only a value present on both sides may be compared. `String(x ?? '') === ''` is
  true whenever `x` is missing, so comparing `email` or `ownerId` unguarded made
  every row lacking that field look like the signed-in account, and a profile
  save was applied to all of them at once. An absent value is not a match.
*/
export function isSameIdentity(row, user, keys = ['id', 'ownerId']) {
  if (!row || !user) return false;
  for (const key of keys) {
    const rowValue = row[key];
    const userValue = user[key];
    if (rowValue != null && userValue != null && String(rowValue) === String(userValue)) return true;
  }
  const rowEmail = String(row.email ?? '').trim().toLowerCase();
  const userEmail = String(user.email ?? '').trim().toLowerCase();
  return rowEmail !== '' && rowEmail === userEmail;
}

/*
  Apply `updates` to the single row belonging to `user`, leaving the rest alone.

  A `list.map()` wrote to *every* matching row. Combined with the empty-value
  comparison above that meant one save could rewrite several accounts at once.
  Only the first match is updated, so a save can never leak into another
  account even if the list somehow contains a duplicate identity.
*/
export function updateIdentityRow(list = [], user, updates, keys) {
  let applied = false;
  return (list || []).map((row) => {
    if (applied || !isSameIdentity(row, user, keys)) return row;
    applied = true;
    return { ...row, ...updates };
  });
}

export function getShareCooldownMessage(posts, vendorId) {
  const lastShare = posts
    .filter((post) => post.authorId === vendorId && (post.productId || post.menuVendorId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!lastShare) return null;
  const remainingMs = PRODUCT_SHARE_COOLDOWN_MS - (Date.now() - new Date(lastShare.createdAt).getTime());
  if (remainingMs <= 0) return null;
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  return `You can share again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`;
}

/*
  A favourite has no id of its own.

  It is the triple (owner, kind, target), and that is also the table's primary
  key on the server. Minting a synthetic id here would mean the two sides keyed
  the same row differently, so a reload would produce a row the browser could no
  longer match to the one it had sent -- the customer would tap the same dish and
  the heart would not fill in. The natural key is the id.

  `vendorId` is part of the stored row but not of the key. A dish id is only
  unique within one shop in local mode, so the key stays (userId, type, refId)
  to match the database, and the shop is carried along so the favourites list can
  say which shop a saved dish came from.
*/
export const FAVORITE_TYPES = ['shop', 'product'];

export const favoriteKey = (favorite) => (
  `${favorite?.userId ?? ''}:${favorite?.type ?? ''}:${favorite?.refId ?? ''}`
);

export const isFavoriteTarget = (type) => FAVORITE_TYPES.includes(type);

/*
  Collapse duplicates of the same favourite and drop unusable rows.

  Duplicates are reachable without any bug: saveState writes the whole state on
  every tick, and merging a stale copy with a fresh one would otherwise keep a
  favourite the customer had already removed. A row missing its owner, kind or
  target cannot be written to a table whose primary key is made of all three, so
  it is dropped here rather than failing the whole batch.
*/
export function normalizeFavorites(favoriteLists = []) {
  const merged = new Map();
  favoriteLists.flat().forEach((favorite) => {
    if (!favorite || typeof favorite !== 'object') return;
    const type = String(favorite.type || '');
    if (!isFavoriteTarget(type)) return;
    if (favorite.userId == null || favorite.refId == null) return;
    const key = favoriteKey({ ...favorite, type });
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        userId: favorite.userId,
        type,
        refId: favorite.refId,
        vendorId: favorite.vendorId ?? null,
        createdAt: favorite.createdAt || new Date().toISOString(),
      });
      return;
    }
    /*
      The oldest `createdAt` wins. The server keeps the row's own created_at, so
      re-saving a later value would move a favourite to the top of the list every
      time it was written and make the list reshuffle under the customer's finger.
    */
    const incomingTime = new Date(favorite.createdAt || 0).getTime();
    const existingTime = new Date(existing.createdAt || 0).getTime();
    if (incomingTime < existingTime) merged.set(key, { ...existing, createdAt: favorite.createdAt });
  });
  return [...merged.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function mergeFavorites(currentList = [], remoteList = []) {
  return normalizeFavorites([currentList || [], remoteList || []]);
}

export function normalizeChats(chatList = []) {
  const merged = new Map();
  chatList.forEach((chat) => {
    const id = `chat-${chat.vendorId}-${chat.customerId}`;
    const existing = merged.get(id);
    const messages = [...(existing?.messages || []), ...(chat.messages || [])]
      .filter((message, index, list) => {
        if (!message || message.id == null) return true;
        const last = list.findLastIndex((item) => item && item.id === message.id);
        return last === index;
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    merged.set(id, {
      ...(existing || {}),
      ...chat,
      id,
      messages,
      updatedAt: messages.at(-1)?.createdAt || chat.updatedAt || existing?.updatedAt || new Date().toISOString(),
    });
  });
  return [...merged.values()];
}

/*
  Union of two chat snapshots, keyed by conversation.

  Unlike `favorites`, folding is safe here and is what makes the cross-tab sync
  correct. A favourite is removed by the customer who owns it, so merging an old
  copy back in would resurrect the row that was just un-tapped. A chat message is
  only ever appended -- nothing deletes one -- so the union of two snapshots can
  only ever add a message the other side had not seen yet, never bring one back.

  `normalizeChats` deduplicates on message id and orders by `createdAt`, so
  replaying the same snapshot repeatedly is a no-op.

  Takes the two lists flat rather than nested: `normalizeChats` iterates one
  level, so passing `[current, remote]` would make it read a list of arrays as a
  single list of chats and silently drop both.
*/
export function mergeChats(currentList = [], remoteList = []) {
  return normalizeChats([...(currentList || []), ...(remoteList || [])]);
}

export function mergePosts(postLists = []) {
  const merged = new Map();
  postLists.flat().forEach((post) => {
    const existing = merged.get(post.id);
    const postTime = new Date(post.updatedAt || post.createdAt || 0).getTime();
    const existingTime = existing ? new Date(existing.updatedAt || existing.createdAt || 0).getTime() : -1;
    if (!existing || postTime >= existingTime) merged.set(post.id, post);
  });
  return [...merged.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/*
  One definition of "how recent is this order version". mergeOrders and saveState
  both deduplicate the same orders on every tick and on every write, and they
  used to disagree: saveState also fell back to the last timeline entry, so for a
  row with a null updatedAt but a real timeline the two picked different winners
  and the order reverted between reads and writes.
*/
const orderTimestamp = (order) => new Date(
  order?.updatedAt || order?.timeline?.at(-1)?.time || order?.createdAt || 0,
).getTime();

export function mergeOrders(orderLists = []) {
  const merged = new Map();
  orderLists.flat().forEach((order) => {
    const existing = merged.get(order.id);
    const orderTime = orderTimestamp(order);
    const existingTime = existing ? orderTimestamp(existing) : -1;
    if (!existing || orderTime >= existingTime) merged.set(order.id, order);
  });
  return [...merged.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function updateIfChanged(setter, nextValue) {
  setter((current) => JSON.stringify(current) === JSON.stringify(nextValue) ? current : nextValue);
}

/*
  Fold a remote list into the local one by id, remote winning on collision.

  Used instead of a plain replace for vendors, customers and notifications.
  A replace threw away every local row the remote query did not return -- a shop
  registered in this browser that is still awaiting approval, or a notification
  addressed to 'admin' -- and, because the mappers keep the raw snake_case row
  alongside the camelCase keys, the serialized shapes could never match, so the
  replace re-fired on every 15s tick and rewrote every row each time.
*/
export function mergeById(currentList = [], remoteList = []) {
  const merged = new Map();
  (currentList || []).forEach((item) => {
    if (item && item.id != null) merged.set(String(item.id), item);
  });
  (remoteList || []).forEach((item) => {
    if (item && item.id != null) merged.set(String(item.id), item);
  });
  const ordered = [...merged.values()];
  // Keep local ordering for rows that survive, so the list does not reshuffle on
  // every refresh; genuinely new rows go first.
  const known = new Set((currentList || []).filter((item) => item && item.id != null).map((item) => String(item.id)));
  const local = ordered.filter((item) => known.has(String(item.id)));
  const added = ordered.filter((item) => !known.has(String(item.id)));
  return [...added, ...local];
}

export function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      const demoCustomerEmails = new Set(['customer@example.com']);
      const demoVendorEmails = new Set([
        'vendor@example.com',
        'maria@example.com',
        'angela@example.com',
        'kuyaben@example.com',
        'lisa@example.com',
        'pedro@example.com',
      ]);
      const legacyDemoAdminPassword = 'admin123';
      const isDemoEmail = (email, emails) => emails.has(String(email || '').toLowerCase());
      const demoVendorIdsFromEmails = new Set(
        (state.vendors || [])
          .filter((vendor) => isDemoEmail(vendor.email, demoVendorEmails))
          .map((vendor) => vendor.id)
      );
      const demoCustomerIds = new Set(
        (state.customers || [])
          .filter((customer) => isDemoEmail(customer.email, demoCustomerEmails))
          .map((customer) => customer.id)
      );
      const demoVendorIds = new Set([1, 2, 3, 4, 5, 6, ...demoVendorIdsFromEmails]);
      const hasDemoAuthor = (post) =>
        [1, 2, 3, 4].includes(post.id)
        || ['Lancaster Zone 1 Admin', 'Juan Dela Cruz', "Juan's Food Corner", 'Zone 1 Milktea'].includes(post.authorName);

      const cleanedState = {
        ...state,
        auth: state.auth?.user && (
          isDemoEmail(state.auth.user.email, demoCustomerEmails)
          || isDemoEmail(state.auth.user.email, demoVendorEmails)
          || (state.auth.user.email?.toLowerCase() === 'admin@example.com' && state.auth.user.password === legacyDemoAdminPassword)
        ) ? { user: null, role: null } : state.auth,
        vendors: (state.vendors || [])
          .filter((vendor) => !isDemoEmail(vendor.email, demoVendorEmails)),
        customers: (state.customers || [])
          .filter((customer) => !isDemoEmail(customer.email, demoCustomerEmails)),
        admins: (state.admins || []).filter(
          (admin) => !(admin.email?.toLowerCase() === 'admin@example.com' && admin.password === legacyDemoAdminPassword)
        ),
        orders: (state.orders || []).filter(
          (order) => !demoVendorIds.has(order.vendorId) && !demoCustomerIds.has(order.customerId)
        ),
        posts: (state.posts || []).filter((post) => !hasDemoAuthor(post)),
        notifications: (state.notifications || [])
          .filter((notification) => !demoCustomerIds.has(notification.userId))
          /*
            Drops notifications keyed by an id the server cannot store. Only the
            admin-desk rows are affected -- `notify_admin_desk` inserts on
            `legacy_id`, a bigint, and an id like `account-...nlutke` is
            permanently unusable. They are filtered rather than renumbered
            because re-minting an id would invent a brand-new alert and replay it
            on every admin screen; these rows are dead weight from an
            already-delivered event, so losing them is the correct outcome.
          */
          .filter((notification) => String(notification?.userId) !== 'admin'
            || isServerKeyableId(notification?.id)),
        /*
          Favourites point at a shop or a dish by id, and the demo vendors seeded
          into an older build are removed just above. Left alone, their favourites
          would survive as rows that resolve to nothing -- an empty favourites page
          that still had the heart filled in on the page it was tapped from.

          Scoped to `demoVendorIdsFromEmails` only, and deliberately NOT to
          `demoVendorIds`. That set carries the hardcoded range [1..6] left over
          from the old seeded build, and a shop or dish is a perfectly ordinary
          row whose legacy_id can land inside it -- a vendor migrated from that
          build, or one inserted before nextLocalId() started issuing
          Date.now()-derived ids. Favourites are the only list where a wrongly
          matched id is unrecoverable rather than cosmetic: this filter runs on
          every single loadState, it writes the stripped result back to
          localStorage, and nothing else holds a copy. The customer taps a heart,
          reloads, and it is simply gone -- for exactly the shops with the lowest
          ids, which reads as random. The email match is the real signal that a row
          came from the demo seed; the numeric range is not.
        */
        favorites: (state.favorites || []).filter((favorite) => {
          if (demoCustomerIds.has(favorite?.userId)) return false;
          if (demoVendorIdsFromEmails.has(favorite?.vendorId)) return false;
          return favorite?.type === 'product' ? !demoVendorIdsFromEmails.has(favorite?.refId) : true;
        }),
        chats: (state.chats || []).filter(
          /*
            Same reasoning as `favorites` above, and the same reason it is scoped
            to `demoVendorIdsFromEmails` rather than `demoVendorIds`.

            Chats were the one list still filtered on the numeric range. A real
            vendor whose legacy_id landed in [1..6] -- one migrated from the old
            seeded build, or inserted before nextLocalId() started issuing
            Date.now()-derived ids -- had every conversation silently deleted on
            every loadState, and line 539 writes the stripped list straight back
            to localStorage, so it was unrecoverable. "Reload and my chat is
            gone" with no pattern to it, because only the low ids were hit.

            Chats are never seeded by the demo at all, so the email match is
            sufficient here and nothing legitimate is caught by it.
          */
          (chat) => !demoVendorIdsFromEmails.has(chat?.vendorId) && !demoCustomerIds.has(chat?.customerId)
        ),
        cart: (state.cart || []).filter((item) => !demoVendorIds.has(item.vendorId)),
      };
      const { state: repaired, repaired: repairedCount, dropped: droppedCount } =
        repairFractionalIds(cleanedState);
      if (repairedCount || droppedCount) {
        console.warn(
          `[kainhub] Repaired fractional ids from an older build: `
          + `${repairedCount} row(s) normalised, ${droppedCount} duplicate(s) merged.`,
        );
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(repaired));
      return repaired;
    }
  } catch {}
  return null;
}

export function saveState(state) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const latestById = new Map();
    [...(saved?.orders || []), ...(state.orders || [])].forEach((order) => {
      const existing = latestById.get(order.id);
      const orderTime = orderTimestamp(order);
      const existingTime = existing ? orderTimestamp(existing) : -1;
      if (!existing || orderTime >= existingTime) latestById.set(order.id, order);
    });
    const mergedChats = normalizeChats([...(saved?.chats || []), ...(state.chats || [])]);
    const mergedPosts = mergePosts([saved?.posts || [], state.posts || []]);
    const nextState = {
      ...saved,
      ...state,
      orders: [...latestById.values()],
      posts: mergedPosts,
      chats: mergedChats,
      /*
        Favourites are the one list that is deliberately NOT merged with the copy
        already in storage. Every other list is append- or newer-wins because a
        row is only ever added or updated; un-favouriting is a removal, so merging
        the old copy back in would resurrect the row the customer had just taken
        back and the heart would refill itself on the next tick. The list in state
        is the whole truth.
      */
      favorites: state.favorites ? normalizeFavorites([state.favorites]) : saved?.favorites,
    };
    const serialized = JSON.stringify(nextState);
    if (serialized !== localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch {}
}
