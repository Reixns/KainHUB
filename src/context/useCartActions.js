import { useCallback } from 'react';
import { nextLocalId } from './persistence';

export function useCartActions({ setCart, showToast }) {
  const addToCart = useCallback((vendor, item, quantity, notes) => {
    const normalizedNotes = notes || '';
    const wanted = Math.max(1, Number(quantity) || 1);
    setCart((current) => {
      // Compared against the same normalized value that is stored below. The
      // lookup used the raw argument while the stored row held `notes || ''`, so
      // any caller that omitted notes got a second cart line for the same dish.
      const match = current.find((c) => (
        String(c.vendorId) === String(vendor.id)
        && String(c.menuId) === String(item.id)
        && (c.notes || '') === normalizedNotes
      ));
      if (match) {
        return current.map((c) => c === match ? { ...c, quantity: (Number(c.quantity) || 0) + wanted } : c);
      }
      return [...current, {
        cartId: nextLocalId(),
        vendorId: vendor.id,
        vendorName: vendor.name,
        menuId: item.id,
        name: item.name,
        price: item.price,
        quantity: wanted,
        notes: normalizedNotes,
        image: item.image,
      }];
    });
    showToast(`${item.name} added to cart!`, 'success');
  }, [setCart, showToast]);

  const updateCartQty = useCallback((cartId, delta) => {
    setCart((current) => current.map((c) => {
      if (c.cartId === cartId) {
        const newQty = Math.max(1, (Number(c.quantity) || 1) + delta);
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  }, [setCart]);

  const removeFromCart = useCallback((cartId) => {
    setCart((current) => current.filter((c) => c.cartId !== cartId));
  }, [setCart]);

  const clearCart = useCallback(() => setCart([]), [setCart]);

  return { addToCart, updateCartQty, removeFromCart, clearCart };
}
