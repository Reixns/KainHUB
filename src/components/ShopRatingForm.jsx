import { useId, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/UI';
import { FIELD_CHAR_LIMITS, countCharacters } from '@/lib/textLimits';

export default function ShopRatingForm({ order, savedRating, shop, rateShop, dark = false }) {
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const commentId = useId();
  const commentCountId = useId();
  const commentCharacters = countCharacters(comment);
  const commentOverLimit = commentCharacters > FIELD_CHAR_LIMITS.ratingComment;

  const submitRating = async () => {
    if (!selected || saving || savedRating || commentOverLimit) return;
    setSaving(true);
    setError('');
    try {
      const result = await rateShop(order.id, selected, comment);
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

      {savedRating?.comment && (
        <div className={`mt-3 rounded-control border px-3 py-2 text-sm ${dark ? 'border-white/10 bg-white/5 text-white/75' : 'border-hairline bg-surface-sunken text-body'}`}>
          <div className={`text-xs font-medium ${dark ? 'text-white/50' : 'text-muted'}`}>Your comment</div>
          <p className="mt-0.5 whitespace-pre-wrap">{savedRating.comment}</p>
        </div>
      )}

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
          <div className="mt-3">
            <label htmlFor={commentId} className={`block text-sm font-medium ${dark ? 'text-white/75' : 'text-body'}`}>
              Comment <span className={dark ? 'font-normal text-white/45' : 'font-normal text-muted'}>(optional)</span>
            </label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={FIELD_CHAR_LIMITS.ratingComment}
              rows={3}
              aria-describedby={commentCountId}
              placeholder="Tell the shop what stood out about your order."
              className={`mt-1.5 w-full resize-none rounded-control border px-3 py-2 text-sm outline-none ${
                dark
                  ? 'border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-white/30'
                  : 'border-hairline bg-white text-ink placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-brand'
              }`}
            />
            <p id={commentCountId} className={`mt-1 text-right text-xs ${dark ? 'text-white/45' : 'text-muted'}`} aria-live="polite">
              {commentCharacters}/{FIELD_CHAR_LIMITS.ratingComment} characters
            </p>
          </div>
          <Button
            className="mt-3"
            size="sm"
            disabled={!selected || saving || commentOverLimit}
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
