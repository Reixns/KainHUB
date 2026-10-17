import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/UI';

export default function ShopRatingForm({ order, savedRating, shop, rateShop, dark = false }) {
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submitRating = async () => {
    if (!selected || saving || savedRating) return;
    setSaving(true);
    setError('');
    try {
      const result = await rateShop(order.id, selected);
      if (!result.success) setError(result.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save your rating.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-4 ${dark ? 'text-white' : 'text-ink'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Rate {order.vendorName || shop?.name || 'this shop'}</h2>
          <p className={`mt-1 text-sm ${dark ? 'text-white/65' : 'text-muted'}`}>
            {savedRating
              ? 'Thanks for sharing your experience.'
              : 'Your order is complete. How was your experience?'}
          </p>
          {shop && (
            <p className={`mt-2 text-xs ${dark ? 'text-white/50' : 'text-muted'}`}>
              Shop rating: {Number(shop.rating || 0).toFixed(1)}
              {Number(shop.ratingCount) > 0
                ? ` (${shop.ratingCount} ${shop.ratingCount === 1 ? 'rating' : 'ratings'})`
                : ' (no ratings yet)'}
            </p>
          )}
        </div>
        {savedRating && (
          <span
            className="inline-flex items-center gap-1 text-sm font-medium"
            aria-label={`You rated this shop ${savedRating.rating} out of 5 stars`}
          >
            <Star className="h-4 w-4 fill-amber-300 text-amber-300" aria-hidden="true" />
            {savedRating.rating}/5
          </span>
        )}
      </div>

      {!savedRating && (
        <>
          <div className="mt-3 flex items-center gap-1" role="group" aria-label="Choose a rating from 1 to 5 stars">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                className="tap-target rounded-full text-amber-400 hover:bg-surface-hover disabled:cursor-not-allowed"
                aria-label={`${score} ${score === 1 ? 'star' : 'stars'}`}
                aria-pressed={selected === score}
                disabled={saving}
                onClick={() => setSelected(score)}
              >
                <Star
                  className={`h-6 w-6 ${score <= selected ? 'fill-amber-300 text-amber-300' : 'text-hairline-strong'}`}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <Button
            className="mt-3"
            size="sm"
            disabled={!selected || saving}
            loading={saving}
            onClick={submitRating}
          >
            Submit rating
          </Button>
          {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}
