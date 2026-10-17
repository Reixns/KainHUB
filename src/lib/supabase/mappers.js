// Row -> app-shape mappers. The database uses snake_case columns, the app uses
// camelCase, and most rows also carry a `legacy_id` that the app treats as the
// canonical public id. Every mapper also normalizes numeric ids so that values
// arriving as either numbers or strings compare reliably.

/*
  `legacy_id` is nullable on every table that has one (schema.sql declares it
  without a not-null constraint and the signup trigger inserts vendors without
  it), so the fallback to the primary key is reached for real rows. On vendors
  and menu_items that key is a bigint and converts cleanly. On notifications it
  is a uuid, and `Number(uuid)` is NaN -- and because NaN !== NaN, every strict
  comparison against it silently failed: the row matched nothing, so a shop's
  stock was never decremented on purchase and the customer was still charged for
  it. Return the value untouched unless it really is a finite number.
*/
export const asNumber = (value) => {
  if (value == null) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

export const mapVendors = (rows) => (rows || []).map((v) => ({
  ...v,
  id: asNumber(v.legacy_id || v.id),
  rating: Number.isFinite(Number(v.rating)) ? Number(v.rating) : 0,
  ratingCount: Number.isFinite(Number(v.rating_count)) ? Number(v.rating_count) : 0,
  ownerId: v.owner_id,
  ownerName: v.owner_name,
  storeStatus: v.store_status,
  deliveryAvailable: v.delivery_available,
  coverImage: v.cover_image,
  menu: (v.menu_items || []).map((m) => ({
    ...m,
    id: asNumber(m.legacy_id || m.id),
    dbId: m.id,
    vendorId: asNumber(v.legacy_id || v.id),
  })),
}));

export const mapPosts = (rows) => (rows || []).map((p) => {
  const menuProducts = Array.isArray(p.products)
    ? p.products
    : Array.isArray(p.product?.products)
      ? p.product.products
      : null;
  return {
    ...p,
    id: asNumber(p.legacy_id || p.id),
    authorId: p.author_id,
    authorRole: p.author_role,
    authorName: p.author_name,
    authorAvatar: p.author_avatar || p.author_avatar_url,
    image: p.image_url || p.image,
    productId: asNumber(p.product_id),
    vendorId: asNumber(p.vendor_legacy_id),
    product: menuProducts ? null : p.product,
    products: menuProducts || undefined,
    likedBy: p.liked_by || [],
    comments: p.comments || [],
    publishAt: p.publish_at,
    expiresAt: p.expires_at,
    reportReason: p.report_reason,
    createdAt: p.created_at,
    updatedAt: p.updated_at || p.created_at,
  };
});

export const mapOrders = (rows) => (rows || []).map((o) => ({
  ...o,
  id: o.order_number,
  dbId: o.id,
  customerId: o.customer_id,
  vendorId: asNumber(o.vendor_legacy_id),
  vendorOwnerId: o.vendor_owner_id,
  total: Number.isFinite(Number(o.total)) ? Number(o.total) : 0,
  createdAt: o.created_at,
  customerName: o.customer_name,
  customerMobile: o.customer_mobile,
  customerAddress: o.customer_address,
  paymentMethod: o.payment_method,
  paymentStatus: o.payment_status,
  gcashRef: o.gcash_ref,
  specialInstructions: o.special_instructions,
  queueNumber: o.queue_number ?? o.queueNumber ?? null,
  rejectReason: o.reject_reason || o.rejectReason,
  updatedAt: o.updated_at || o.created_at,
  timeline: o.timeline || [],
  items: (o.order_items || []).map((item) => ({
    ...item, menuId: asNumber(item.menu_legacy_id), quantity: item.quantity,
  })),
}));

export const mapNotifications = (rows) => (rows || []).map((n) => ({
  ...n, id: asNumber(n.legacy_id || n.id), userId: n.user_id, createdAt: n.created_at,
  // Restores the TTL on the way back. Null for promo and admin-desk rows, which
  // `isNotificationExpired` correctly reads as "no expiry".
  expiresAt: n.expires_at ?? null,
}));

export const mapCustomers = (rows) => (rows || [])
  .filter((p) => p.role === 'customer')
  .map((p) => ({
    ...p,
    id: p.id,
    fullName: p.full_name,
    status: p.status || 'active',
    createdAt: p.created_at,
  }));

export const mapChats = (rows) => (rows || []).map((chat) => ({
  ...chat,
  vendorId: asNumber(chat.vendor_legacy_id),
  customerId: chat.customer_id,
  messages: chat.messages || [],
  updatedAt: chat.updated_at,
}));

export const mapShopRatings = (rows) => (rows || []).map((rating) => ({
  orderNumber: rating.order_number,
  vendorId: asNumber(rating.vendor_legacy_id),
  rating: Number(rating.rating),
  createdAt: rating.created_at,
}));

/*
  Favourites have no surrogate id, so the three columns that make up the key are
  mapped to the three fields the browser keeps: userId, type and refId.

  `target_legacy_id` goes through asNumber for the same reason every other id
  does: PostgREST hands back a bigint column as a number already, but a row that
  came through the tolerant-write path or an older payload can carry it as a
  string, and `1234 === '1234'` is false -- so the heart on the list page would
  not match the one on the detail page and the customer would see a filled and an
  unfilled heart for the same dish.

  `vendor_legacy_id` is nullable by design (a favourite shop points at itself),
  and asNumber returns null untouched.
*/
export const mapFavorites = (rows) => (rows || []).map((f) => ({
  userId: f.user_id,
  type: f.target_type,
  refId: asNumber(f.target_legacy_id),
  vendorId: f.vendor_legacy_id == null ? null : asNumber(f.vendor_legacy_id),
  createdAt: f.created_at,
}));
