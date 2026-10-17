import { useCallback, useMemo } from 'react';
import { favoriteKey, isFavoriteTarget } from './persistence';

/*
  Saved shops and dishes.

  Everything is keyed on (userId, type, refId) -- the same triple that is the
  primary key of the `favorites` table -- and nothing is ever given a synthetic
  id. That is what lets a heart stay filled across a reload: the row read back
  from the server maps onto exactly the row the browser sent, with no second
  identity to reconcile.

  Every comparison goes through String() on both sides. The ids reaching this
  module are the app's public ids, which are numbers in local mode but come back
  from Postgres as whatever the bigint column held, and `1234 === '1234'` is
  false. A strict compare here is a heart that fills on the list page and not on
  the detail page for the same dish.

  The owner is taken from the signed-in profile, never from a target row. In
  local mode a customer id is a Date.now()-derived number; on the server `user_id`
  must equal auth.uid() or the RLS policy denies the write.
*/
export function useFavoriteActions({
  favorites,
  setFavorites,
  auth,
  showToast,
  onAdded,
  onRemoved,
}) {
  const currentUserId = auth?.user?.id ?? null;

  // Only the signed-in account's rows are ever visible to it.
  const mine = useMemo(() => (
    (favorites || []).filter((favorite) => (
      favorite?.userId != null
      && currentUserId != null
      && String(favorite.userId) === String(currentUserId)
    ))
  ), [favorites, currentUserId]);

  const isFavorite = useCallback((type, refId) => {
    if (refId == null || !currentUserId) return false;
    return mine.some((favorite) => (
      String(favorite.type) === String(type) && String(favorite.refId) === String(refId)
    ));
  }, [mine, currentUserId]);

  const toggleFavorite = useCallback((type, refId, options = {}) => {
    if (!isFavoriteTarget(type)) return false;
    if (refId == null || !currentUserId) {
      showToast?.('Sign in to save shops and dishes.', 'error');
      return false;
    }
    // The shop a dish belongs to, kept on the row so the favourites list can name
    // it. A favourite shop is its own shop.
    const vendorId = type === 'shop'
      ? refId
      : (options.vendorId ?? null);

    /*
      Whether this adds or removes is decided from `mine` before the state is
      updated, not from inside the updater. The updater is a pure function of its
      previous state and StrictMode runs it twice to check exactly that; setting a
      flag in there made the toast depend on which of the two calls happened to be
      the last one, so the heart could fill and the message say it was removed.
    */
    const removing = isFavorite(type, refId);
    setFavorites((current) => (removing
      ? (current || []).filter((favorite) => !(
        String(favorite.userId) === String(currentUserId)
        && String(favorite.type) === String(type)
        && String(favorite.refId) === String(refId)
      ))
      : [...(current || []), {
        userId: currentUserId,
        type,
        refId,
        vendorId: vendorId == null ? null : vendorId,
        createdAt: new Date().toISOString(),
      }]));

    /*
      The refresh tick is allowed to remove a favourite that the server does not
      have, because that is how an un-save on another device arrives. It must not
      remove one that has simply not been written yet: persistState is debounced
      and the tick is not, so a favourite tapped a moment before a tick would be
      found locally and missing remotely, and reconciled into being deleted.

      So an addition is announced here and the tick holds it aside until the
      server confirms it. A removal is announced too, so a re-add of the same
      target within the window is not mistaken for one already written.
    */
    if (removing) onRemoved?.({ userId: currentUserId, type, refId });
    else onAdded?.({ userId: currentUserId, type, refId });

    if (!removing) {
      showToast?.(options.label ? `${options.label} saved to favorites.` : 'Saved to favorites.', 'success');
    }
    return !removing;
  }, [setFavorites, currentUserId, isFavorite, showToast, onAdded, onRemoved]);

  // Un-favouriting by identity rather than by target, used by the favourites page
  // where the row in hand is the stored row.
  const removeFavorite = useCallback((favorite) => {
    if (!favorite) return;
    setFavorites((current) => (current || []).filter((item) => (
      favoriteKey(item) !== favoriteKey(favorite)
    )));
    onRemoved?.(favorite);
  }, [setFavorites, onRemoved]);

  const favoriteCount = mine.length;

  return { favorites: mine, isFavorite, toggleFavorite, removeFavorite, favoriteCount };
}
