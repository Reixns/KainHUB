import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { isImageSource, CARD_FOCUS_RING } from '@/components/UI';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 shrink-0 rounded-full bg-surface-sunken flex items-center justify-center text-muted">{icon}</div>
      {/* min-w-0 lets a long email or address wrap instead of pushing the row
          wider than its card. */}
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="text-ink font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

export function MediaButton({ label, folder, loading, uploading, uploadMediaFile, onUploaded, showToast }) {
  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    // Reset the input first so picking the same file twice in a row still fires
    // a change event.
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('Image must be under 4 MB.', 'error');
      return;
    }
    uploading(folder);
    try {
      const result = await uploadMediaFile(file, folder);
      if (!result?.success) {
        showToast(result?.message || 'Unable to upload image.', 'error');
        return;
      }
      const saveResult = await onUploaded(result.url);
      if (saveResult?.success === false) {
        showToast(saveResult.message || 'Unable to save image.', 'error');
        return;
      }
      showToast(`${label} updated.`, 'success');
    } catch (err) {
      showToast(err?.message || 'Unable to upload image.', 'error');
    } finally {
      uploading('');
    }
  };

  /*
   * A <label> wrapping a hidden file input is the usual pattern but it is not
   * reachable by keyboard and shows no focus ring. `tabIndex` plus an Enter/Space
   * handler makes the control operable, and the input is visually hidden rather
   * than display:none so it stays in the accessibility tree. The whole thing
   * clears the 44px tap target minimum because it sits in a profile toolbar.
   */
  return (
    <label
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.currentTarget.querySelector('input')?.click();
        }
      }}
      className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-11 rounded-control border text-xs font-medium cursor-pointer transition-colors ${CARD_FOCUS_RING} ${
        loading
          ? 'border-hairline bg-surface-sunken text-subtle cursor-progress'
          : 'border-hairline-strong bg-white text-body hover:bg-surface-sunken'
      }`}
    >
      <ImagePlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {loading ? 'Uploading...' : label}
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={loading}
        className="sr-only"
      />
    </label>
  );
}

export function LogoAvatar({ user, className = 'bg-brand-muted', size = 'w-20 h-20 text-4xl' }) {
  const [broken, setBroken] = useState(false);
  const logo = user.logo;
  /*
    An <img> whose src fails to resolve paints nothing at all -- no broken-image
    glyph in most browsers, and certainly no initials -- so the circle just went
    blank and a vendor whose upload silently failed looked identical to one who
    never uploaded. `broken` is reset whenever the URL changes so replacing a
    failed image with a working one recovers without a reload.

    The `key` forces a remount when the URL changes, which is the other half of
    the same problem: React reuses the same DOM node across a src change, so a
    previously-failed <img> would otherwise stay blank for the new URL too.
  */
  useEffect(() => { setBroken(false); }, [logo]);

  const showImage = !broken && isImageSource(logo);
  return (
    <div className={`${size} ${className} rounded-full mx-auto -mt-10 relative flex items-center justify-center mb-3 border-4 border-white overflow-hidden`}>
      {showImage ? (
        <img
          key={logo}
          src={logo}
          alt={user.name || 'Profile logo'}
          className="w-full h-full object-cover"
          onError={() => {
            // Without this the circle silently went blank and looked identical
            // to "no logo chosen". Logging the URL is what makes a storage
            // rejection (403 on the insert, or a bucket that is not public)
            // distinguishable from a bad path.
            console.error('[profile] logo failed to load:', logo);
            setBroken(true);
          }}
        />
      ) : (
        // Falls back to the emoji, then to initials, so an empty field -- or one
        // pointing at an unreachable file -- never leaves a blank circle where
        // the shop identity should be.
        <span aria-hidden="true">{logo && !isImageSource(logo) ? logo : (user.name || '?').slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}
