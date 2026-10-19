/*
  Mobile numbers are entered in local format: eleven digits, no spaces or
  symbols (for example 09171234567).

  The rules are enforced in two places on purpose. `sanitizeMobile` runs on every
  keystroke, so the field physically cannot hold a non-digit or a twelfth digit,
  and `isValidMobile` gates submission so a half-typed number is never saved.
  Keeping both in one module means the register, checkout and profile forms
  cannot drift apart on what a valid number is.
*/

export const MOBILE_LENGTH = 11;

// Keep only digits, capped at MOBILE_LENGTH.
export const sanitizeMobile = (value) => String(value ?? '').replace(/\D/g, '').slice(0, MOBILE_LENGTH);

export const isValidMobile = (value) => sanitizeMobile(value).length === MOBILE_LENGTH;

export const mobileValidationMessage = (label = 'Mobile number') => `${label} must be ${MOBILE_LENGTH} digits.`;
