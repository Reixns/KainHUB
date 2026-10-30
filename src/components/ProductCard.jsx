import { Link } from 'react-router-dom';
import { Card, formatPeso, getProductImage, MediaImage } from '@/components/UI';
import FavoriteButton from '@/components/FavoriteButton';

export default function ProductCard({
  product,
  shop,
  meta,
  badge,
  dimmed = false,
  fullWidth = false,
  className = '',
  children,
}) {
  const image = getProductImage(product.image);
  const fallback = (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-950 via-[#28223a] to-[#19171f] text-4xl">
      {product.image && product.image.length <= 4 ? product.image : '🍽️'}
    </div>
  );

  return (
    <Card className={`group flex ${fullWidth ? 'w-full' : 'w-[11.5rem] shrink-0 sm:w-52'} flex-col overflow-hidden border-white/10 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-violet-300/40 ${className}`}>
      <div className="relative">
        <Link
          to={`/customer/shops/${shop.id}`}
          aria-label={`${product.name} from ${shop.name}`}
          className="relative block aspect-[4/5] overflow-hidden bg-surface-hover focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-violet-300"
        >
          <MediaImage
            src={image}
            alt={product.name}
            className={`absolute inset-0 block h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${dimmed ? 'opacity-45 grayscale' : ''}`}
            fallback={fallback}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/5" />
          {badge && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              {badge}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-tight text-white sm:text-base">{product.name}</h3>
            <p className="mt-1 line-clamp-1 text-xs text-white/65">{shop.name}</p>
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/20 pt-2">
              <span className="text-sm font-bold tabular-nums text-white sm:text-base">{formatPeso(product.price)}</span>
              <span className="truncate text-right text-[10px] text-white/60">{meta || <span aria-hidden="true">&nbsp;</span>}</span>
            </div>
          </div>
        </Link>
        <span className="absolute right-1.5 top-1.5">
          <FavoriteButton
            type="product"
            refId={product.id}
            vendorId={shop.id}
            label={product.name}
            className="!h-9 !min-h-9 !w-9 !min-w-9"
          />
        </span>
      </div>
      {children && <div className="p-2.5">{children}</div>}
    </Card>
  );
}
