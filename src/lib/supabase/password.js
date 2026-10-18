export function getPasswordRequirements(password, context = {}) {
  const value = String(password || '');
  const lowerValue = value.toLowerCase();
  const emailPrefix = String(context.email || '').split('@')[0]?.toLowerCase() || '';
  const nameFragment = String(context.fullName || context.ownerName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return [
    { id: 'length', label: 'At least 8 characters', valid: value.length >= 8 },
    { id: 'uppercase', label: 'At least one uppercase letter', valid: /[A-Z]/.test(value) },
    { id: 'lowercase', label: 'At least one lowercase letter', valid: /[a-z]/.test(value) },
    { id: 'number', label: 'At least one number', valid: /\d/.test(value) },
    { id: 'symbol', label: 'At least one special character', valid: /[^A-Za-z0-9\s]/.test(value) },
    { id: 'spaces', label: 'No spaces', valid: !/\s/.test(value) },
    {
      id: 'personal-info',
      label: "Can't include your name or email address",
      valid: (!emailPrefix || emailPrefix.length < 4 || !lowerValue.includes(emailPrefix))
        && (!nameFragment || nameFragment.length < 3 || !lowerValue.includes(nameFragment)),
    },
    { id: 'repeated', label: 'Avoid repeating a character 3 or more times', valid: !/(.)\1{2,}/.test(value) },
  ];
}

export function validatePassword(password, context = {}) {
  const requirements = getPasswordRequirements(password, context);
  const failed = requirements.find((requirement) => !requirement.valid);
  return failed
    ? { valid: false, message: `Password too weak: ${failed.label}.` }
    : { valid: true, message: 'Strong password.' };
}
