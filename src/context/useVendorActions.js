import { useCallback } from 'react';
import { getShareCooldownMessage, nextLocalId, PRODUCT_SHARE_COOLDOWN_MS } from '@/context/persistence';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { clearStoreStatusPin, pinStoreStatus, pinVendorStatus } from '@/lib/supabase/state';

/*
  Menu edits are applied to `vendors` first and the resulting menu is then
  mirrored into auth.user, rather than relying on a variable assigned inside the
  setVendors updater. React only invokes an updater synchronously when that hook
  has no pending update; otherwise it runs during the render phase, after the
  assignment below had already read null. Two edits in one tick therefore left
  the signed-in vendor's own menu -- the copy every vendor page reads from --
  stale, or emptied it outright on add.
*/
const applyVendorMenuUpdate = (setVendors, setAuth, auth, vendorId, mapMenu, vendors) => {
  const current = vendors.find((v) => String(v.id) === String(vendorId));
  if (!current) return;
  const newMenu = mapMenu(current.menu || []);
  setVendors((list) => list.map((v) => (String(v.id) === String(vendorId) ? { ...v, menu: newMenu } : v)));
  if (auth.user && String(auth.user.id) === String(vendorId)) {
    setAuth((a) => ({ ...a, user: { ...a.user, menu: newMenu } }));
  }
};

export function useVendorActions({ setVendors, setCustomers, setPosts, setAuth, auth, vendors, customers, posts, showToast }) {
  const updateVendor = useCallback((vendorId, updates) => {
    setVendors((list) => list.map((v) => (String(v.id) === String(vendorId) ? { ...v, ...updates } : v)));
    if (auth.user && String(auth.user.id) === String(vendorId)) {
      setAuth((a) => ({ ...a, user: { ...a.user, ...updates } }));
    }
  }, [setVendors, setAuth, auth]);

  const addVendorMenu = useCallback((vendorId, item) => {
    const newItem = { ...item, id: nextLocalId() };
    const current = vendors.find((v) => String(v.id) === String(vendorId));
    const newMenu = [...(current?.menu || []), newItem];
    setVendors((list) => list.map((v) => (String(v.id) === String(vendorId) ? { ...v, menu: newMenu } : v)));
    if (auth.user && String(auth.user.id) === String(vendorId)) {
      setAuth((a) => ({ ...a, user: { ...a.user, menu: newMenu } }));
    }
    showToast('Product added to your menu.', 'success');
  }, [setVendors, setAuth, auth, vendors, showToast]);

  const postVendorProduct = useCallback((vendorId, itemId, { publishAt, expiresAt } = {}) => {
    const vendor = vendors.find((v) => String(v.id) === String(vendorId));
    const item = vendor?.menu?.find((m) => m.id === itemId);
    if (!vendor || !item) return { success: false, message: 'Product not found.' };
    const cooldownMessage = getShareCooldownMessage(posts, vendorId);
    if (cooldownMessage) return { success: false, message: cooldownMessage };

    const productPost = {
      authorId: vendor.id,
      authorRole: 'vendor',
      authorName: vendor.name,
      authorAvatar: vendor.logo || '🍽️',
      verified: vendor.status === 'approved',
      content: `New product alert: ${item.name} is now available!${item.description ? ` ${item.description}` : ''}`,
      type: 'new_product',
      productId: item.id,
      vendorId: vendor.id,
      product: item,
      publishAt: publishAt || new Date().toISOString(),
      expiresAt: expiresAt || null,
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString(),
      pinned: false,
      hidden: false,
    };
    const existingPost = posts.find((post) => post.authorId === vendor.id && (post.productId === item.id || post.product?.id === item.id));
    if (existingPost) {
      setPosts((current) => current.map((post) => post.id === existingPost.id ? { ...post, ...productPost, id: post.id, likes: post.likes || 0, likedBy: post.likedBy || [], comments: post.comments || [] } : post));
    } else {
      setPosts((current) => [{ id: nextLocalId(), ...productPost }, ...current]);
    }
    showToast(publishAt && new Date(publishAt) > new Date() ? 'Product post scheduled.' : 'Product posted to the marketplace!', 'success');
    return { success: true };
  }, [vendors, posts, setPosts, showToast]);

  const postVendorMenu = useCallback((vendorId, { publishAt, expiresAt } = {}) => {
    const vendor = vendors.find((v) => String(v.id) === String(vendorId));
    if (!vendor || !vendor.menu?.length) return { success: false, message: 'No menu items to share.' };
    const cooldownMessage = getShareCooldownMessage(posts, vendorId);
    if (cooldownMessage) return { success: false, message: cooldownMessage };

    const publishTimestamp = Date.parse(publishAt || new Date().toISOString());
    if (!Number.isFinite(publishTimestamp)) {
      return { success: false, message: 'Menu post publish time is invalid.' };
    }
    const expiryTimestamp = expiresAt
      ? Date.parse(expiresAt)
      : publishTimestamp + PRODUCT_SHARE_COOLDOWN_MS;
    if (!Number.isFinite(expiryTimestamp) || expiryTimestamp <= publishTimestamp) {
      return { success: false, message: 'Menu post expiry must be after its publish time.' };
    }
    const menuPublishAt = new Date(publishTimestamp).toISOString();
    const menuExpiresAt = new Date(expiryTimestamp).toISOString();

    const menuPost = {
      authorId: vendor.id,
      authorRole: 'vendor',
      authorName: vendor.name,
      authorAvatar: vendor.logo || '🍽️',
      verified: vendor.status === 'approved',
      content: `${vendor.name} shared the full menu. Check out all available products!`,
      type: 'new_product',
      menuVendorId: vendor.id,
      vendorId: vendor.id,
      products: vendor.menu,
      publishAt: menuPublishAt,
      expiresAt: menuExpiresAt,
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date().toISOString(),
      pinned: false,
      hidden: false,
    };
    const existingPost = posts.find((post) => post.authorId === vendor.id && post.menuVendorId === vendor.id);
    if (existingPost) {
      setPosts((current) => current.map((post) => post.id === existingPost.id ? { ...post, ...menuPost, id: post.id, likes: post.likes || 0, likedBy: post.likedBy || [], comments: post.comments || [] } : post));
    } else {
      setPosts((current) => [{ id: nextLocalId(), ...menuPost }, ...current]);
    }
    showToast(publishAt && new Date(publishAt) > new Date() ? 'Menu post scheduled.' : 'Full menu posted to the marketplace for one hour.', 'success');
    return { success: true };
  }, [vendors, posts, setPosts, showToast]);

  const updateVendorMenu = useCallback((vendorId, itemId, updates) => {
    applyVendorMenuUpdate(setVendors, setAuth, auth, vendorId, (menu) => menu.map((m) => (
      String(m.id) === String(itemId) ? { ...m, ...updates } : m
    )), vendors);
  }, [setVendors, setAuth, auth, vendors]);

  const deleteVendorMenu = useCallback((vendorId, itemId) => {
    applyVendorMenuUpdate(setVendors, setAuth, auth, vendorId, (menu) => menu.filter((m) => String(m.id) !== String(itemId)), vendors);
  }, [setVendors, setAuth, auth, vendors]);

  const updateStock = useCallback((vendorId, itemId, newStock) => {
    const stock = Number(newStock) || 0;
    applyVendorMenuUpdate(setVendors, setAuth, auth, vendorId, (menu) => menu.map((m) => (
      String(m.id) === String(itemId) ? { ...m, stock, available: stock > 0 } : m
    )), vendors);
  }, [setVendors, setAuth, auth, vendors]);

  const setStoreStatus = useCallback(async (vendorId, status) => {
    const vendor = vendors.find((item) => String(item.id) === String(vendorId));
    if (!vendor) {
      showToast('Unable to update store status: vendor not found.', 'error');
      return false;
    }
    if (!['OPEN', 'BUSY', 'CLOSED'].includes(status)) {
      showToast('Unable to update store status: invalid status.', 'error');
      return false;
    }

    const previousStatus = vendor.storeStatus;
    pinStoreStatus(vendorId, status);
    try {
      if (isSupabaseConfigured) {
        if (auth.role !== 'vendor' || !auth.user?.ownerId) {
          throw new Error('Sign in with the vendor account that owns this store, then try again.');
        }
        const client = getSupabaseClient(auth.role);
        if (!client) throw new Error('Could not connect to Supabase. Please try again.');
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        if (authData.user?.id !== auth.user.ownerId) {
          throw new Error('Your vendor session is no longer valid. Sign in again and retry.');
        }

        const { data, error } = await client
          .from('vendors')
          .update({ store_status: status })
          .eq('owner_id', authData.user.id)
          .select('id, legacy_id, store_status');
        if (error) throw error;
        if (!data?.length || data.some((row) => row.store_status !== status)) {
          throw new Error('No store was updated. Check your vendor account permissions and try again.');
        }
      }

      setVendors((list) => list.map((item) => (
        String(item.id) === String(vendorId) ? { ...item, storeStatus: status } : item
      )));
      if (auth.user && String(auth.user.id) === String(vendorId)) {
        setAuth((current) => ({ ...current, user: { ...current.user, storeStatus: status } }));
      }
      showToast(`Store status updated to ${status.toLowerCase()}.`, 'success');
      return true;
    } catch (error) {
      clearStoreStatusPin(vendorId);
      setVendors((list) => list.map((item) => (
        String(item.id) === String(vendorId) ? { ...item, storeStatus: previousStatus } : item
      )));
      if (auth.user && String(auth.user.id) === String(vendorId)) {
        setAuth((current) => ({ ...current, user: { ...current.user, storeStatus: previousStatus } }));
      }
      showToast(`Unable to update store status: ${error.message}`, 'error');
      return false;
    }
  }, [vendors, setVendors, setAuth, auth.role, auth.user, showToast]);

  const setVendorStatus = useCallback(async (vendorId, status, message) => {
    const vendor = vendors.find((item) => String(item.id) === String(vendorId));
    if (!vendor) return;
    const previousStatus = vendor.status;
    /*
      Hold the decision from the instant it is made, not from when the debounced
      write starts. A refresh tick or a `storage` event from another portal tab
      can land inside that debounce window carrying the old status; without the
      pin it overwrites the optimistic row and the vendor snaps back to Pending.
    */
    pinVendorStatus(vendorId, status);
    setVendors((list) => list.map((v) => (String(v.id) === String(vendorId) ? { ...v, status } : v)));
    if (auth.user && String(auth.user.id) === String(vendorId)) {
      setAuth((a) => ({ ...a, user: { ...a.user, status } }));
    }
    try {
      if (isSupabaseConfigured) {
        const client = getSupabaseClient(auth.role);
        if (!client) throw new Error('Could not connect to Supabase. Please try again.');
        if (auth.role !== 'admin') throw new Error('Only an admin can change vendor approval status.');

        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          throw new Error('You are using a local/demo admin session. Sign in with a Supabase admin account to approve vendors.');
        }
        const { data: adminProfile, error: profileError } = await client
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (adminProfile?.role !== 'admin') {
          throw new Error('This Supabase account is not an admin. Set its public.profiles role to admin, then sign in again.');
        }

        const filters = [];
        if (vendor.ownerId) filters.push(['owner_id', vendor.ownerId]);
        if (vendor.id != null) {
          filters.push(['legacy_id', vendor.id]);
          filters.push(['id', vendor.id]);
        }

        let result = null;
        for (const [column, value] of filters) {
          result = await client.from('vendors').update({ status }).eq(column, value).select('id, status');
          if (result.error || result.data?.length) break;
        }
        if (!result || result.error) throw result?.error || new Error('Vendor status could not be saved.');
        if (!result.data?.length || result.data.some((row) => row.status !== status)) {
          throw new Error('No vendor row was updated. Check the admin account permissions and try again.');
        }
      }
      showToast(message, 'success');
    } catch (error) {
      pinVendorStatus(vendorId, previousStatus);
      setVendors((list) => list.map((v) => (
        String(v.id) === String(vendorId) ? { ...v, status: previousStatus } : v
      )));
      if (auth.user && String(auth.user.id) === String(vendorId)) {
        setAuth((a) => ({ ...a, user: { ...a.user, status: previousStatus } }));
      }
      showToast(`Unable to update vendor status: ${error.message}`, 'error');
    }
  }, [vendors, setVendors, setAuth, auth.role, auth.user, showToast]);

  const approveVendor = useCallback((vendorId) => setVendorStatus(vendorId, 'approved', 'Vendor approved successfully.'), [setVendorStatus]);
  const rejectVendor = useCallback((vendorId) => setVendorStatus(vendorId, 'rejected', 'Vendor rejected.'), [setVendorStatus]);
  const suspendVendor = useCallback((vendorId) => setVendorStatus(vendorId, 'suspended', 'Vendor suspended.'), [setVendorStatus]);
  const activateVendor = useCallback((vendorId) => setVendorStatus(vendorId, 'approved', 'Vendor activated.'), [setVendorStatus]);

  const setCustomerStatus = useCallback(async (customerId, status, message) => {
    const customer = customers.find((item) => String(item.id) === String(customerId));
    if (!customer) return;

    try {
      if (isSupabaseConfigured) {
        if (auth.role !== 'admin') throw new Error('Only an admin can change customer status.');
        if (typeof customer.id !== 'string') {
          throw new Error('This customer has no Supabase account ID.');
        }

        const client = getSupabaseClient(auth.role);
        if (!client) throw new Error('Could not connect to Supabase. Please try again.');
        const { data: authData, error: authError } = await client.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          throw new Error('Your admin database session is unavailable. Sign in again and retry.');
        }

        const { data: adminProfile, error: profileError } = await client
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (adminProfile?.role !== 'admin') {
          throw new Error('This Supabase account is not an admin.');
        }

        const { data, error } = await client
          .from('profiles')
          .update({ status })
          .eq('id', customer.id)
          .eq('role', 'customer')
          .select('id, status');
        if (error) throw error;
        if (!data?.some((row) => row.id === customer.id && row.status === status)) {
          throw new Error('Customer status was not updated. Check database permissions and try again.');
        }
      }

      setCustomers((list) => list.map((item) => (
        String(item.id) === String(customer.id) ? { ...item, status } : item
      )));
      showToast(message, 'success');
    } catch (error) {
      showToast(`Unable to update customer status: ${error.message}`, 'error');
    }
  }, [customers, auth.role, setCustomers, showToast]);

  const suspendCustomer = useCallback((customerId) => setCustomerStatus(customerId, 'suspended', 'Customer suspended.'), [setCustomerStatus]);
  const activateCustomer = useCallback((customerId) => setCustomerStatus(customerId, 'active', 'Customer activated.'), [setCustomerStatus]);

  return {
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
    suspendCustomer,
    activateCustomer,
  };
}
