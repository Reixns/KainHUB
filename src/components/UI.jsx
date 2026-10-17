import { useEffect, useId, useRef, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, Utensils } from 'lucide-react';

export const PRODUCT_IMAGE_URLS = {
  '🍗': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600',
  '🍖': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600',
  '🥩': 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=600',
  '🍳': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600',
  '🍲': 'https://images.unsplash.com/photo-1547592180-85f17399099d?w=600',
  '🍛': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600',
  '🍜': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600',
  '🍝': 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600',
  '🍚': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600',
  '🍟': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600',
  '🍕': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600',
  '🌭': 'https://images.unsplash.com/photo-1612392062631-94dd858cba88?w=600',
  '🍔': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
  '🥪': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7b?w=600',
  '🍢': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600',
  '🍣': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600',
  '🍤': 'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=600',
  '🧋': 'https://images.unsplash.com/photo-1558857563-c0c6ee6ff8a0?w=600',
  '🍵': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600',
  '🥤': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600',
  '🍰': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600',
  '🍩': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600',
  '🍪': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600',
  '🧁': 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=600',
  '🍨': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600',
};

function PlatformLogoImage({ src, alt, className }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <Utensils className={`h-6 w-6 ${className}`} aria-hidden="true" />;
  return (
    <img
      src={src}
      alt={alt}
      className={`h-full w-full object-contain ${className}`}
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export function PlatformLogo({ src, alt = 'KainHUB', className = '' }) {
  return src
    ? <PlatformLogoImage key={src} src={src} alt={alt} className={className} />
    : <Utensils className={`h-6 w-6 ${className}`} aria-hidden="true" />;
}

/*
 * An avatar / logo / cover field is polymorphic: it may hold a short emoji the
 * vendor typed, or the URL of an uploaded image. Anything with a URL-ish prefix
 * is an image; any other short string is an emoji.
 *
 * This used to be five separate copies of the same regex across the app, and
 * two of them only checked `http` and `data`. A logo stored as a root-relative
 * path or a local `blob:` preview therefore rendered as literal text inside the
 * avatar circle. One definition, checked everywhere.
 */
export function isImageSource(value) {
  return typeof value === 'string' && /^(https?:|data:image\/|blob:|\/)/.test(value);
}

export function isEmojiSource(value) {
  return typeof value === 'string' && value.trim().length > 0 && !isImageSource(value);
}

export function getProductImage(image) {
  if (typeof image !== 'string' || !image) return '';
  if (PRODUCT_IMAGE_URLS[image]) return PRODUCT_IMAGE_URLS[image];
  return image.startsWith('data:image/') || image.startsWith('http') || image.startsWith('/') || image.startsWith('blob:') ? image : '';
}

export function Button({ children, variant = 'primary', size = 'md', className = '', loading, disabled, full, type = 'button', as: Component = 'button', ...props }) {
  /*
   * Every variant is a flat fill or a hairline outline. The previous set
   * attached a colored 24px-blur glow to primary/danger/success, so a screen
   * with four buttons had four unrelated halos competing for attention. Only
   * `primary` keeps a shadow, and only a 1px one.
   */
  const variants = {
    primary: 'bg-brand text-white shadow-brand hover:bg-brand-strong active:bg-brand-deep',
    secondary: 'bg-brand-soft text-brand-deep ring-1 ring-inset ring-brand-line hover:bg-brand-muted',
    outline: 'bg-white text-body ring-1 ring-inset ring-hairline-strong hover:bg-surface-sunken hover:text-ink active:bg-surface-hover',
    danger: 'bg-danger text-white hover:bg-danger-deep active:bg-danger-deep',
    success: 'bg-success text-white hover:bg-success-deep active:bg-success-deep',
    ghost: 'text-body hover:bg-surface-hover hover:text-ink',
    dark: 'bg-ink text-white hover:bg-body active:bg-body',
  };
  // min-h keeps every size at or above a 44px tap target (Apple HIG / WCAG
  // 2.5.5). `sm` was min-h-10 (40px), which missed the guideline by 4px on the
  // smallest and most-used button -- the inline actions in dialog footers and
  // "Mark all read" on the notification screens. Padding is left alone so the
  // visual rhythm of the other sizes does not shift.
  const sizes = {
    sm: 'px-3.5 py-2 text-sm rounded-control min-h-11',
    md: 'px-4 py-2.5 text-sm rounded-control min-h-11',
    lg: 'px-5 py-3 text-base rounded-control min-h-12',
    xl: 'px-6 py-3.5 text-base rounded-control min-h-13',
  };
  /*
   * `as` lets a navigation action keep the exact button styling without
   * nesting a real <button> inside an <a>. That nesting is invalid HTML: the
   * link cannot contain interactive content, and keyboard users end up with two
   * tab stops for one visible control. When rendering a non-button element
   * there is no `disabled` attribute, so a blocked state is expressed with
   * aria-disabled plus the same pointer blocking.
   *
   * `type` defaults to "button", not to the HTML default of "submit". Modal
   * footers and inline toolbars are rendered as plain divs rather than through
   * a portal, so a Button inside one inherits the submission semantics of
   * whatever form encloses it: every "Cancel", "Delete", or filter button in a
   * dialog footer was silently submitting the form behind the dialog. The seven
   * real submit buttons all pass type="submit" explicitly.
   */
  const isNativeButton = Component === 'button';
  const inert = disabled || loading;
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 font-semibold leading-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${inert && !isNativeButton ? 'opacity-50 pointer-events-none' : ''} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${full ? 'w-full' : ''} ${className}`}
      type={isNativeButton ? type : undefined}
      disabled={isNativeButton ? inert : undefined}
      aria-disabled={!isNativeButton && inert ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"></span>
      )}
      {children}
    </Component>
  );
}

const FIELD_BASE = 'w-full rounded-control text-sm bg-white transition-colors duration-150 disabled:bg-surface-sunken disabled:text-muted';
const FIELD_OK = 'border border-hairline-strong hover:border-hairline-hover focus:border-brand focus:ring-2 focus:ring-brand-muted';
const FIELD_ERR = 'border-danger/50 focus:border-danger focus:ring-2 focus:ring-danger/20';

export function Input({ label, error, icon: Icon, hint, endAdornment, className = '', labelClassName = 'text-body', hintClassName = 'text-muted', ...props }) {
  return (
    <div className="w-full">
      {label && <label className={`block text-sm font-medium ${labelClassName} mb-1.5`}>{label}</label>}
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" />}
        <input
          className={`${FIELD_BASE} ${error ? FIELD_ERR : FIELD_OK} ${Icon ? 'pl-11' : 'pl-3.5'} ${endAdornment ? 'pr-12' : 'pr-3.5'} py-3 min-h-11 text-ink placeholder:text-subtle ${className}`}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />
        {endAdornment && (
          <span className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center">
            {endAdornment}
          </span>
        )}
      </div>
      {error
        ? <p className="text-xs text-danger mt-1.5 font-medium">{error}</p>
        : hint && <p className={`text-xs mt-1.5 ${hintClassName}`}>{hint}</p>}
    </div>
  );
}

export function Textarea({ label, error, hint, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-body mb-1.5">{label}</label>}
      <textarea
        className={`${FIELD_BASE} ${error ? FIELD_ERR : FIELD_OK} px-3.5 py-3 text-ink placeholder:text-subtle resize-none ${className}`}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      {error
        ? <p className="text-xs text-danger mt-1.5 font-medium">{error}</p>
        : hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

/*
  Split from the keyboard half on purpose. Focus lands on whichever element is
  actually focusable -- the <Link> for a link-wrapped card, not the <div> inside
  it -- so a ring written here would never paint for those callers.
*/
export const CARD_HOVER = 'cursor-pointer transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-hairline-strong hover:shadow-raised active:translate-y-0';
export const CARD_FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-strong';

export function Card({ children, className = '', onClick, flat, interactive = false, ...rest }) {
  /*
    `interactive` exists separately from `onClick` because a card wrapped in a
    <Link> cannot pass onClick -- the click would navigate twice -- so it used to
    hand-copy these classes into its own className. That left three different
    treatments for one affordance: the admin dashboard used an off-token
    `hover:shadow-md` with no focus ring, the vendor dashboard repeated
    `transition-shadow hover:shadow-raised` four times, and the customer order
    rows copied the full string. Anything written twice drifts, and this had
    already drifted twice.

    Keyboard semantics stay tied to `onClick` alone. A link-wrapped card is
    already reachable and activatable through its <Link>, and adding
    role="button" to a div inside an anchor would both misreport it as a button
    and intercept the space bar the link needs.
  */
  const clickable = typeof onClick === 'function';
  const lift = clickable || interactive;
  const interactiveProps = clickable
    ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick(event);
          }
        },
      }
    : {};
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-card border border-hairline ${lift ? CARD_HOVER : ''} ${clickable ? CARD_FOCUS_RING : ''} ${flat ? 'shadow-none' : ''} ${className}`}
      {...interactiveProps}
      {...rest}
    >
      {children}
    </div>
  );
}

/*
 * Small status pill. Deliberately low-contrast: these sit next to content and
 * should read as metadata, not compete with the page headline for attention.
 */
export function Badge({ children, color = 'gray', className = '' }) {
  const colors = {
    gray: 'bg-surface-hover text-body',
    green: 'bg-success-soft text-success',
    red: 'bg-danger-soft text-danger',
    yellow: 'bg-warning-soft text-warning',
    blue: 'bg-info-soft text-info',
    orange: 'bg-brand-soft text-brand-deep',
    purple: 'bg-cat-violet-soft text-cat-violet-deep',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const restoreFocusTo = useRef(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      const target = restoreFocusTo.current;
      if (target && typeof target.focus === 'function' && document.contains(target)) target.focus();
    };
  }, [open]);

  if (!open) return null;
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-4xl',
  };
  // The overlay gutters below are env()-aware on all four sides.
  //
  // Horizontally this matters in landscape: the panel is centred, so on a notched
  // phone the left and right cut outs clipped its edges -- the close button in the
  // header was the first thing to go under the camera housing. max() keeps the
  // original 0.5rem/1rem gutters wherever no inset is reported.
  //
  // Vertically the bottom inset matters on the mobile sheet (items-end), where the
  // panel sits flush against the bottom edge; the header of a tall form could not
  // scroll clear of the home indicator without it. The footer already carries its
  // own inset padding for its buttons.
  //
  // max-h on the panel is max-h-full, against the overlay's content box, rather than
  // a hand-computed 100dvh minus a guess, so it stays correct with these insets.
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pt-2 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4 animate-fade-in">
      {/* The scrim sits at z-[100] with the panel, so on mobile the sheet peeks
          up from the bottom edge and a tap near the top still closes. */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true"></div>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-white w-full ${sizes[size]} rounded-card shadow-float max-h-full overflow-hidden flex flex-col animate-slide-up`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4 border-b border-hairline">
          <h3 id={titleId} className="font-semibold text-ink text-lg min-w-0 break-words">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="tap-target shrink-0 hover:bg-surface-hover rounded-lg text-muted">
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap gap-2 justify-end border-t bg-surface-sunken px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={variant} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Button>
        </>
      }
    >
      <p className="text-body text-sm">{message}</p>
    </Modal>
  );
}

import { useApp } from '@/context/AppContext';

export function Toasts() {
  const { toasts } = useApp();
  return (
    /*
     * role="status" + aria-live="polite" means a screen reader announces each
     * toast as it arrives. These are transient confirmations for actions like
     * "saved" or "upload failed", which are otherwise silent for blind users.
     *
     * Positioned at the top on desktop but pinned above the safe-area inset on
     * mobile, so notifications clear the notch and the home indicator instead
     * of sitting underneath them.
     *
     * All three offsets are max() with the inset for the same reason as the sticky
     * headers: at a flat top-3 a toast rendered inside the cut out in landscape and
     * the first line of an error was unreadable, and a right-notched phone clipped
     * the opposite gutter. max() keeps the 0.75rem/1rem offsets on any device that
     * reports a zero inset.
     */
    <div
      role="status"
      aria-live="polite"
      className="fixed left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 pointer-events-none sm:left-auto sm:top-4 sm:right-4 sm:items-end"
    >
      {toasts.map((t) => {
        const config = {
          success: { Icon: CheckCircle, bar: 'bg-ink' },
          error: { Icon: AlertCircle, bar: 'bg-danger' },
        }[t.type] || { Icon: Info, bar: 'bg-ink' };
        const { Icon, bar } = config;
        return (
          <div
            key={t.id}
            className={`${bar} w-full sm:max-w-sm text-white px-4 py-3 rounded-control shadow-float flex items-start gap-3 animate-slide-up`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-px" aria-hidden="true" />
            <span className="text-sm font-medium leading-snug">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

// Derives up to two initials from a display name, e.g. "Maria Santos" -> "MS".
// Used as the avatar fallback when no emoji or image is available.
function initialsFor(name) {
  if (typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/*
 * Logo marks can be either an emoji or an uploaded image reference, depending on
 * whether the vendor uploaded one. Callers used to render `{vendor.logo}`
 * directly, which printed a stored URL as literal text once a logo was uploaded.
 * This resolves the two cases in one place.
 */
export function LogoMark({ name, logo, size = 'md', tone = 'orange', className = '', fill = false }) {
  const sizes = {
    xs: 'w-7 h-7 text-sm rounded-lg',
    sm: 'w-10 h-10 text-xl rounded-xl',
    md: 'w-12 h-12 text-2xl rounded-2xl',
    lg: 'w-16 h-16 text-3xl rounded-2xl',
    xl: 'w-20 h-20 text-4xl rounded-2xl',
  };
  const tones = {
    orange: 'bg-brand-muted text-brand-deep',
    emerald: 'bg-success-soft text-success',
    yellow: 'bg-warning-soft text-warning',
    gray: 'bg-surface-hover text-muted',
    blue: 'bg-cat-blue/10 text-brand-strong',
  };
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [logo]);

  const isImage = !broken && isImageSource(logo);
  const initials = initialsFor(name);

  /*
    `fill` stretches the mark to its container so a shop card can lead with the
    picture instead of centring a 64px tile on a blank surface.

    It builds a fresh class list rather than appending `w-full h-full` to
    `sizes[size]`: `w-20` and `w-full` are the same specificity, so which one
    wins depends on their order inside the generated stylesheet, not on the order
    here. Choosing between two strings removes that.

    Corners are dropped because the clipping container already owns the radius --
    keeping `rounded-2xl` on a full-bleed image would round the image itself and
    show the card's background through the gaps on a non-square photo.
  */
  const boxClass = fill
    ? 'w-full h-full rounded-none text-4xl'
    : (sizes[size] ?? sizes.md);

  return (
    <div className={`${boxClass} ${tones[tone] ?? tones.orange} flex items-center justify-center font-semibold shrink-0 overflow-hidden ${className}`}>
      {isImage ? (
        // Same reasoning as LogoAvatar: a src that fails to resolve paints
        // nothing, so an unreachable logo blanked the mark on every screen that
        // shows a shop. `key` forces a remount when the URL changes, otherwise
        // React reuses the broken <img> for the replacement too.
        <img key={logo} src={logo} alt={name ? `${name} logo` : 'Logo'} className="w-full h-full object-cover" onError={() => { console.error('[logo] failed to load:', logo); setBroken(true); }} />
      ) : logo && !isImageSource(logo) ? (
        <span aria-hidden="true">{logo}</span>
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <span aria-hidden="true">{'🍽️'}</span>
      )}
    </div>
  );
}

/*
  An <img> that degrades instead of disappearing.

  The pattern it replaces was `onError={(e) => { e.currentTarget.style.display =
  'none'; }}` on every product photo, dish photo and post image in the app. Hiding
  the element is not a fallback: it removes the only content of whatever box it
  was in, so a dead URL left a bare `bg-surface-hover` rectangle sitting on screen
  reading as "no photo" -- which is indistinguishable from a shop that genuinely
  has no photo, and made a failed upload look like a successful one that had
  nothing to show.

  This renders `fallback` in the image's place instead. The caller's own wrapper
  supplies the background, so passing an emoji or a short label here means the
  box is never empty.

  `key` on the <img> is load-bearing and not a React micro-optimisation: React
  reuses the same DOM node across a src change, so a previously failed image
  stays broken for its replacement. Same reasoning as the reset effect.

  `fallback` renders even when `src` is empty, so callers can drop their own
  `{src && <img/>}` guard.
*/
export function MediaImage({ src, alt = '', className = '', fallback = null, eager = false, ...rest }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);

  if (!src || broken) return fallback;
  return (
    <img
      key={src}
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        // The URL is logged because a storage rejection and a bad path look
        // identical on screen -- both just fail to load -- and only the URL says
        // which one it is.
        console.error('[image] failed to load:', src);
        setBroken(true);
      }}
      {...rest}
    />
  );
}

/*
  Centred glyph for the inside of a photo box, used as MediaImage's `fallback`.
  Sized by the caller through the wrapper rather than here, so the same glyph
  works in a 40px dish tile and a 384px post image.
*/
export function ImageFallback({ children = '🍽️', className = '' }) {
  return (
    <div className={`w-full h-full flex items-center justify-center ${className}`} aria-hidden="true">
      <span>{children}</span>
    </div>
  );
}

export function Avatar({ name, emoji, src, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  };
  const initials = initialsFor(name);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  const isImage = !broken && isImageSource(src);

  return (
    <div className={`${sizes[size] ?? sizes.md} rounded-full bg-brand-muted flex items-center justify-center font-semibold text-brand-deep shrink-0 overflow-hidden ${className}`}>
      {isImage ? (
        <img key={src} src={src} alt={name || ''} className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : emoji ? (
        <span aria-hidden="true">{emoji}</span>
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <span aria-hidden="true">{'👤'}</span>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && <div className="w-16 h-16 rounded-full bg-surface-sunken flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-subtle" aria-hidden="true" />
      </div>}
      <h3 className="font-semibold text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-muted mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-10 h-10 border-4 border-brand-line border-t-brand rounded-full animate-spin mb-3"></div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function StatusBadge({ status }) {
  const map = {
    OPEN: { color: 'green', label: 'OPEN' },
    BUSY: { color: 'yellow', label: 'BUSY' },
    CLOSED: { color: 'red', label: 'CLOSED' },
    RECEIVED: { color: 'blue', label: 'Received' },
    PREPARING: { color: 'yellow', label: 'Preparing' },
    READY: { color: 'green', label: 'Ready' },
    'OUT FOR DELIVERY': { color: 'purple', label: 'Out for Delivery' },
    COMPLETED: { color: 'gray', label: 'Completed' },
    CANCELLED: { color: 'red', label: 'Cancelled' },
    REJECTED: { color: 'red', label: 'Rejected' },
    PENDING: { color: 'yellow', label: 'Pending' },
    approved: { color: 'green', label: 'Approved' },
    pending: { color: 'yellow', label: 'Pending' },
    suspended: { color: 'red', label: 'Suspended' },
    rejected: { color: 'red', label: 'Rejected' },
    active: { color: 'green', label: 'Active' },
  };
  const cfg = map[status] || { color: 'gray', label: status };
  return <Badge color={cfg.color}>{cfg.label}</Badge>;
}

export function Tabs({ tabs, activeTab, onChange, label = 'Sections' }) {
  /*
   * The tablist only had role/aria-selected, which left it keyboard-unusable:
   * every tab sat in the tab order and arrow keys did nothing. Implemented the
   * APG pattern -- roving tabindex (only the selected tab is a tab stop) and
   * Arrow/Home/End to move selection.
   */
  const onKeyDown = (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const current = tabs.findIndex((tab) => tab.id === activeTab);
    if (current === -1) return;
    event.preventDefault();

    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else {
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      next = (current + delta + tabs.length) % tabs.length;
    }
    onChange(tabs[next].id);
  };

  return (
    <div className="flex border-b border-hairline overflow-x-auto scrollbar-hide" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-brand text-brand-strong'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full tabular-nums ${
                isActive ? 'bg-brand-muted text-brand-deep' : 'bg-surface-hover text-body'
              }`}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function formatPeso(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-PH');
}

export function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/*
  Queue numbers are `orders.queue_number`, a nullable column, and every screen
  rendered `#${order.queueNumber}` inline. A row without one therefore showed a
  literal "#undefined" as the primary reference number, in the largest type on
  the order detail page. Centralised so the placeholder is consistent.
*/
export function formatQueue(queueNumber) {
  return queueNumber == null || queueNumber === '' ? 'PENDING' : `#${queueNumber}`;
}

/*
  `isAdminNotification` used to be defined here.

  It is a pure predicate with no React in it, but AppContext needs it and this
  module needs `useApp` to render toasts -- so it made AppContext -> UI ->
  AppContext. That cycle surfaced as `useApp must be used within AppProvider`
  thrown from components that were plainly inside the provider, because the
  module instance UI.jsx had captured was built before AppContext.jsx finished
  evaluating and so held a different context object than the one AppProvider was
  handed. It now lives in lib/notifications.js, which is a leaf. Re-exported here
  for the callers that already import it from this path.
*/
export { isAdminNotification } from '@/lib/notifications';
