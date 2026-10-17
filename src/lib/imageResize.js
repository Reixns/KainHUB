/*
 * Without Supabase, an uploaded image is encoded into localStorage as a base64
 * data URL. That inflates the file by roughly a third, so a single 5 MB photo
 * becomes ~6.7 MB of string -- past the typical 5 MB localStorage quota. The
 * persistence writer in context/persistence.js swallows its write errors in a
 * bare `catch {}`, so an oversized photo would not just fail to save, it would
 * silently stop every write for the whole app. Downscaling to a byte budget
 * keeps one photo from breaking persistence for unrelated state.
 *
 * The Supabase path does not need this: those bytes go to storage, not to
 * localStorage, so originals are uploaded untouched.
 */

const MAX_DIMENSION = 1600;
export const LOCAL_IMAGE_MAX_BYTES = 512 * 1024;

// Each step is tried in order and the first result inside the budget wins, so
// large screenshots shrink without over-compressing already-small photos.
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5];

const decodeImage = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Unable to read the image.'));
  };
  image.src = objectUrl;
});

const toBlob = (canvas, type, quality) => new Promise((resolve) => {
  if (typeof canvas.toBlob !== 'function') {
    resolve(null);
    return;
  }
  canvas.toBlob(resolve, type, quality);
});

const rename = (file, type) => {
  const extension = type === 'image/webp' ? 'webp' : 'jpg';
  return `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.${extension}`;
};

// Never throws. A photo we cannot shrink is still worth sending, and the
// caller would rather have a too-large image than a broken composer.
export async function prepareImageForLocalStorage(file) {
  if (!file || !file.type?.startsWith('image/')) return file;
  if (file.size <= LOCAL_IMAGE_MAX_BYTES) return file;

  try {
    const image = await decodeImage(file);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    // WebP keeps its own quality knob and is widely supported, so it is
    // preferred. PNG is skipped on purpose: re-encoding it at a fixed size
    // usually stays above the budget, and JPEG would drop transparency that
    // logos depend on.
    const type = file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    let lastBlob = null;
    for (const quality of QUALITY_STEPS) {
      const blob = await toBlob(canvas, type, quality);
      if (!blob) break;
      lastBlob = blob;
      if (blob.size <= LOCAL_IMAGE_MAX_BYTES) {
        return new File([blob], rename(file, type), { type, lastModified: Date.now() });
      }
    }
    if (!lastBlob) return file;
    // Still above budget at the lowest step: send it anyway rather than
    // blocking the send on a soft localStorage limit.
    return new File([lastBlob], rename(file, type), { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
