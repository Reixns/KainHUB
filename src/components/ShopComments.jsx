import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Card, formatDateTime } from '@/components/UI';
import { getShopRatingComments, isSupabaseConfigured } from '@/lib/supabase';

const EMPTY_RATINGS = [];

export default function ShopComments({
  vendorId,
  role = 'customer',
  localRatings = EMPTY_RATINGS,
  rating = 0,
  ratingCount = 0,
  title = 'Customer comments',
  emptyMessage = 'No written comments yet.',
  hideWhenEmpty = false,
  className = '',
}) {
  const [comments, setComments] = useState([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const totalRatings = Number(ratingCount) || 0;

  useEffect(() => {
    const local = localRatings
      .filter((item) => String(item.vendorId) === String(vendorId) && item.comment?.trim())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(({ rating: score, comment, createdAt }) => ({ rating: score, comment, createdAt }));

    setComments(local);
    if (!vendorId || !isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    void getShopRatingComments(vendorId, role)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch((error) => {
        console.error('[ratings] shop comments could not be loaded:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vendorId, role, localRatings]);

  useEffect(() => {
    setOpen(false);
    setExpanded(false);
  }, [vendorId]);

  if (hideWhenEmpty && comments.length === 0) return null;

  const visibleComments = expanded ? comments : comments.slice(0, 2);
  const hasMore = comments.length > 2;
  const commentCountLabel = `${comments.length} written ${comments.length === 1 ? 'comment' : 'comments'}`;

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {open
              ? (comments.length > 0 ? commentCountLabel : 'No written comments yet.')
              : 'Tap the rating to read feedback'}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1.5 text-xs font-medium text-body transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          aria-expanded={open}
          aria-label={open ? 'Hide customer comments' : 'Show customer comments'}
          onClick={() => setOpen((current) => !current)}
        >
          <Star className="h-3.5 w-3.5 fill-rating text-rating" aria-hidden="true" />
          {totalRatings > 0 ? Number(rating || 0).toFixed(1) : '—'}
          <span className="text-muted">({totalRatings})</span>
        </button>
      </div>

      {open && (
        comments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {loading ? 'Loading comments…' : emptyMessage}
          </p>
        ) : (
          <>
            <div className={`mt-3 space-y-2 ${expanded && hasMore ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
              {visibleComments.map((item, index) => (
                <div key={`${item.createdAt}-${index}`} className="rounded-control border border-hairline px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <RatingStars rating={item.rating} />
                    <span className="shrink-0 text-[11px] text-muted">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className={`mt-1 text-sm leading-relaxed text-body ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                    {item.comment}
                  </p>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-brand-strong hover:underline"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? 'Show less' : `Show all ${comments.length}`}
              </button>
            )}
          </>
        )
      )}
    </Card>
  );
}

function RatingStars({ rating }) {
  const score = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span className="flex items-center gap-0.5" aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3 w-3 ${star <= score ? 'fill-rating text-rating' : 'text-hairline-strong'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
