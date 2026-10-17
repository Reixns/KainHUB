export function validatePassword(password, context = {}) {
  const value = String(password || '');
  const lowerValue = value.toLowerCase();
  const emailPrefix = String(context.email || '').split('@')[0]?.toLowerCase() || '';
  const nameFragment = String(context.fullName || context.ownerName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const checks = [
    { test: value.length >= 8, message: 'Use at least 8 characters.' },
    { test: /[a-z]/.test(value), message: 'Include at least one lowercase letter.' },
    { test: /[A-Z]/.test(value), message: 'Include at least one uppercase letter.' },
    { test: /\d/.test(value), message: 'Include at least one number.' },
    { test: /[^A-Za-z0-9]/.test(value), message: 'Include at least one symbol.' },
    { test: !emailPrefix || emailPrefix.length < 4 || !lowerValue.includes(emailPrefix), message: 'Do not include your email name in the password.' },
    { test: !nameFragment || nameFragment.length < 3 || !lowerValue.includes(nameFragment), message: 'Do not include your name in the password.' },
    { test: !/(.)\1{2,}/.test(value), message: 'Avoid repeating the same character too often.' },
  ];

  const failed = checks.find((check) => !check.test);
  return failed
    ? { valid: false, message: `Password too weak: ${failed.message}` }
    : { valid: true, message: 'Strong password.' };
}
