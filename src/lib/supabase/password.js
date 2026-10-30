export function getPasswordRequirements(password, context = {}) {
  const value = String(password || '');
  const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedPassword = normalize(value);
  const email = String(context.email || '').trim().toLowerCase();
  const emailLocalPart = email.split('@')[0] || '';
  const personalInfo = [
    normalize(email),
    ...emailLocalPart.split(/[^a-z0-9]+/),
    ...String(context.fullName || context.ownerName || '').split(/[^a-z0-9]+/i).map(normalize),
  ].filter((fragment) => fragment.length >= 3);

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
      valid: !personalInfo.some((fragment) => normalizedPassword.includes(fragment)),
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
