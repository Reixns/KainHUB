export function getCartGroupBlockReason(vendor, items) {
  if (!vendor) return 'This shop is no longer available.';
  if (vendor.storeStatus !== 'OPEN') {
    return vendor.storeStatus === 'BUSY' ? 'This shop is busy and cannot accept orders right now.' : 'This shop is closed.';
  }

  for (const item of items) {
    const menuItem = (vendor.menu || []).find((menu) => String(menu.id) === String(item.menuId));
    if (!menuItem) return `${item.name} is no longer available.`;

    const stock = Number(menuItem.stock) || 0;
    if (stock <= 0) return `${item.name} is out of stock.`;
    if (!menuItem.available) return `${item.name} is unavailable right now.`;
    if (stock < (Number(item.quantity) || 0)) {
      return `Only ${stock} ${item.name} left in stock. Update the quantity to continue.`;
    }
  }

  return null;
}
