/*
  Shared word limit for free-text content (chat messages, posts, comments).

  Kept in one leaf module so the composer UI (live counter), the action layer
  (defence in depth) and any future caller all agree on the same number and the
  same definition of a "word". The database enforces the same 100-word ceiling
  through triggers/RPC checks; the client copy exists only to give the writer
  feedback before they hit send.
*/
export const WORD_LIMIT = 100;

export function countWords(text) {
  if (typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function isWithinWordLimit(text, limit = WORD_LIMIT) {
  return countWords(text) <= limit;
}

export function wordLimitMessage(limit = WORD_LIMIT) {
  return `Please keep it to ${limit} words or fewer.`;
}
