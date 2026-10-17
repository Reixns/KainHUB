import { Heart } from 'lucide-react';
import { useApp } from '@/context/AppContext';

/*
  The save-to-favourites heart.

  One component for every place it appears, because the saved state is the whole
  point: a second implementation is how a detail page ends up showing an
  outlined heart next to a list page showing a filled one for the same dish.

  `type` and `refId` identify the target. `vendorId` is only needed for a product
  and names the shop it was read from, so the favourites list can label it.

  `variant` is how it sits on the page rather than how it looks:
    - `surface`  filled circle, for a photo or card corner
    - `plain`    no circle, for a row of text next to a heading
    - `icon`     small inline heart, for use inside another control's row
*/
export default function FavoriteButton({
  type,
  refId,
  vendorId,
  label,
  variant = 'surface',
  className = '',
}) {
  const { isFavorite, toggleFavorite } = useApp();
  const saved = isFavorite(type, refId);
  const name = label || (type === 'shop' ? 'this shop' : 'this dish');

  const variants = {
    surface: 'tap-target rounded-full bg-white/90 text-ink hover:bg-white shadow-sm',
    plain: 'tap-target rounded-full text-muted hover:bg-surface-hover hover:text-ink',
    icon: 'tap-target rounded-full text-muted hover:bg-surface-hover hover:text-ink',
  };

  return (
    <button
      type="button"
      // aria-pressed, not a label swap: the button keeps its accessible name and
      // simply reports the state, which is what a screen reader toggling it
      // expects. The label below changes nothing for assistive tech.
      aria-pressed={saved}
      aria-label={`${saved ? 'Remove' : 'Save'} ${name} ${saved ? 'from' : 'to'} favorites`}
      title={saved ? 'Remove from favorites' : 'Save to favorites'}
      onClick={(event) => {
        // The heart sits inside links and cards that navigate. Without this the
        // tap opens the shop and the heart never gets set.
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(type, refId, { vendorId, label });
      }}
      className={`${variants[variant]} ${saved ? 'text-danger' : ''} ${className}`}
    >
      <Heart className={`w-5 h-5 ${saved ? 'fill-danger' : ''}`} aria-hidden="true" />
    </button>
  );
}
