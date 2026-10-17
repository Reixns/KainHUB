const COUNTABLE_ORDER_STATUSES = new Set([
  'RECEIVED',
  'PREPARING',
  'READY',
  'OUT FOR DELIVERY',
  'COMPLETED',
]);

export function getShopBuyerStats(orders) {
  const stats = new Map();

  orders.forEach((order) => {
    if (!COUNTABLE_ORDER_STATUSES.has(order.status) || order.vendorId == null || order.customerId == null) return;
    const vendorId = String(order.vendorId);
    const current = stats.get(vendorId) || { buyerIds: new Set(), orders: 0 };
    current.buyerIds.add(String(order.customerId));
    current.orders += 1;
    stats.set(vendorId, current);
  });

  return new Map([...stats].map(([vendorId, stat]) => [
    vendorId,
    { buyers: stat.buyerIds.size, orders: stat.orders },
  ]));
}

export function rankShopsByBuyers(shops, buyerStats) {
  return shops
    .map((shop) => ({ shop, stats: buyerStats.get(String(shop.id)) || { buyers: 0, orders: 0 } }))
    .filter(({ stats }) => stats.buyers > 0)
    .sort((a, b) => (
      b.stats.buyers - a.stats.buyers
      || b.stats.orders - a.stats.orders
      || Number(b.shop.storeStatus === 'OPEN') - Number(a.shop.storeStatus === 'OPEN')
      || (Number(b.shop.rating) || 0) - (Number(a.shop.rating) || 0)
    ));
}

export function rankShopsByRating(shops, buyerStats) {
  return shops
    .filter((shop) => Number(shop.rating) > 0)
    .sort((a, b) => (
      (Number(b.rating) || 0) - (Number(a.rating) || 0)
      || (buyerStats.get(String(b.id))?.buyers || 0) - (buyerStats.get(String(a.id))?.buyers || 0)
    ));
}
