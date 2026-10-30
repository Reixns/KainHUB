export const MAX_TEXT_LENGTH = 200;
export const MAX_WORD_COUNT = 20;

export const FIELD_CHAR_LIMITS = {
  fullName: 60,
  shopName: 80,
  ownerName: 60,
  address: 120,
  category: 40,
  operatingHours: 80,
  shopDescription: 500,
  productName: 160,
  productDescription: 900,
  itemNote: 600,
  specialInstructions: 900,
  rejectionReason: 900,
  ratingComment: 300,
};

export function countCharacters(text) {
  return typeof text === 'string' ? Array.from(text).length : 0;
}

const WORD_CHARACTER = /[\p{L}\p{N}]/u;

export function countWords(text) {
  if (typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter((token) => WORD_CHARACTER.test(token)).length;
}

export function isWithinCharacterLimit(text, limit = MAX_TEXT_LENGTH) {
  return countCharacters(text) <= limit;
}

export function isWithinMessageLimits(text) {
  return isWithinCharacterLimit(text, MAX_TEXT_LENGTH) && countWords(text) <= MAX_WORD_COUNT;
}

export function findCharacterLimitViolation(values, limits = FIELD_CHAR_LIMITS) {
  for (const [field, limit] of Object.entries(limits)) {
    if (typeof values?.[field] === 'string' && !isWithinCharacterLimit(values[field], limit)) {
      return { field, limit };
    }
  }
  return null;
}

export function characterLimitMessage(limit = MAX_TEXT_LENGTH) {
  return `Please keep it to ${limit} characters or fewer.`;
}

export function messageLimitMessage() {
  return `Please keep it to ${MAX_WORD_COUNT} words and ${MAX_TEXT_LENGTH} characters or fewer.`;
}
