import { Link } from 'react-router-dom';
import { Clock, Star, Truck } from 'lucide-react';
import SharedMarketplace from '@/pages/SharedMarketplace';
import { LogoMark, StatusBadge, CARD_HOVER, CARD_FOCUS_RING } from '@/components/UI';
import FavoriteButton from '@/components/FavoriteButton';

export default function CustomerHome() {
  return <SharedMarketplace />;
}

export function CustomerCommunity() {
  return <SharedMarketplace />;
}

export function ShopCard({ shop }) {
  const estWait = Math.max(5, shop.queue * 5);

  return (
    <Link
      to={`/customer/shops/${shop.id}`}
      className={`group block bg-white rounded-card border border-hairline overflow-hidden ${CARD_HOVER} ${CARD_FOCUS_RING}`}
    >
      {/*
        Fixed 4:3 tile, reserved up front so every card in the grid is the same
        height regardless of what a vendor has uploaded.

        The cover is gone -- the shop's picture is the card, so it fills the tile
        outright instead of sitting as a centred mark on a blank surface. The two
        used to be an either/or branch, and because registration used to seed a
        stock Unsplash `coverImage`, that branch always won and the vendor's own
        uploaded logo was never rendered here at all.

        `fill` still routes through LogoMark, so a shop with no picture, or one
        whose URL is dead, falls back to its emoji or initials on the tile's
        background rather than leaving an empty box.
      */}
      <div className="relative aspect-[4/3] bg-surface-hover overflow-hidden">
        <LogoMark name={shop.name} logo={shop.logo} tone="gray" fill />

        <div className="absolute top-2.5 left-2.5">
          <StatusBadge status={shop.storeStatus} />
        </div>
        {/* The whole card is a Link, so the heart cancels the navigation itself
            (stopPropagation in FavoriteButton). Placed top-right, clear of the
            status pill on the left. */}
        <span className="absolute top-2 right-2">
          <FavoriteButton type="shop" refId={shop.id} label={shop.name} />
        </span>
      </div>

      <div className="p-4">
        {/*
          Shop name leads the text block, so the grid still scans by name.

          The 28px logo that used to sit beside it is gone. It was only reaching
          the screen because the tile above was blank -- now that the picture
          fills that tile, the same image twice on one card reads as a rendering
          bug, and it was eating 28px plus a 10px gap of the name's width.
        */}
        <h3 className="font-semibold text-ink leading-snug truncate">{shop.name}</h3>

        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted">
          <span className="truncate">{shop.category}</span>
          <span aria-hidden="true" className="text-hairline-strong">&middot;</span>
          <span className="flex items-center gap-1 shrink-0">
            <Star className="w-3.5 h-3.5 text-rating fill-rating" aria-hidden="true" />
            <span className="font-medium text-body">{shop.rating.toFixed(1)}</span>
          </span>
        </div>

        {/* Meta row: hairline-separated so it reads as a footer, not more body copy. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-hairline text-xs">
          {shop.queue > 0 ? (
            <span className="flex items-center gap-1 text-muted">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {shop.queue} in queue &middot; ~{estWait}m
            </span>
          ) : (
            <span className="flex items-center gap-1 text-success font-medium">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> No queue
            </span>
          )}
          <span className="flex items-center gap-1 text-muted ml-auto">
            <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {shop.deliveryAvailable ? 'Delivery' : 'Pick-up only'}
          </span>
        </div>
      </div>
    </Link>
  );
}
