import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Card, Input } from '@/components/UI';
import PasswordRequirements from '@/components/PasswordRequirements';
import { validatePassword } from '@/lib/supabase';
import { isPasswordReused } from '@/lib/passwordHistory';

const EMPTY_FORM = { current: '', next: '', confirm: '' };

export default function ChangePasswordCard({ role }) {
  const { auth, changePassword, showToast } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const accountRole = role || auth.role || 'customer';
  const passwordCheck = validatePassword(form.next, {
    email: auth.user?.email,
    fullName: auth.user?.fullName || auth.user?.ownerName,
  });
  const reusesCurrent = Boolean(form.current) && form.current === form.next;
  const historyKey = String(auth.user?.email || '').toLowerCase().trim() || auth.user?.id;
  const [reusedPassword, setReusedPassword] = useState(false);

  useEffect(() => {
    let active = true;
    if (!form.next || !historyKey) {
      setReusedPassword(false);
      return () => { active = false; };
    }
    isPasswordReused(historyKey, form.next)
      .then((reused) => { if (active) setReusedPassword(reused); })
      .catch(() => { if (active) setReusedPassword(false); });
    return () => { active = false; };
  }, [form.next, historyKey]);

  const requirementExtras = [
    { id: 'not-current', label: 'Different from your current password', valid: !reusesCurrent },
    { id: 'not-reused', label: "Can't reuse a recently used password", valid: !reusedPassword },
  ];
  const canSubmit = !saving && !reusesCurrent && !reusedPassword;
  const currentPasswordError = Boolean(error)
    && /current password/i.test(error)
    && !/new password/i.test(error);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError('');
    setChanged(false);
  };

  const toggleVisibility = (field) => {
    setVisible((current) => ({ ...current, [field]: !current[field] }));
  };

  const visibilityButton = (field, label) => (
    <button
      type="button"
      onClick={() => toggleVisibility(field)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-control text-subtle transition-colors hover:bg-surface-sunken hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-strong"
      aria-label={visible[field] ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={visible[field]}
    >
      {visible[field] ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setChanged(false);
    if (!form.current) {
      setError('Enter your current password.');
      return;
    }
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }
    if (form.current === form.next) {
      setError('Your new password must be different from your current password.');
      return;
    }
    if (await isPasswordReused(historyKey, form.next)) {
      setReusedPassword(true);
      setError('You cannot reuse a recently used password. Choose a new one.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const result = await changePassword(form.current, form.next, accountRole);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setForm(EMPTY_FORM);
      setChanged(true);
      showToast('Password changed successfully.', 'success');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to change your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-start gap-3 border-b border-hairline bg-surface-sunken px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-brand-muted bg-brand-soft text-brand-strong">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            Change password <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Update the password used to sign in to this account.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-5">
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Verify your identity</h3>
            <p className="mt-0.5 text-xs text-muted">Enter your current password before choosing a new one.</p>
          </div>
          <Input
            label="Current password"
            icon={Lock}
            type={visible.current ? 'text' : 'password'}
            value={form.current}
            onChange={updateField('current')}
            autoComplete="current-password"
            endAdornment={visibilityButton('current', 'current password')}
            disabled={saving}
            required
            error={currentPasswordError ? error : ''}
            hint="Enter your existing password to verify your identity."
          />
        </div>

        <div className="space-y-3 border-t border-hairline pt-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">Choose a new password</h3>
            <p className="mt-0.5 text-xs text-muted">Use a password you do not use on another account.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="New password"
              icon={Lock}
              type={visible.next ? 'text' : 'password'}
              value={form.next}
              onChange={updateField('next')}
              autoComplete="new-password"
              endAdornment={visibilityButton('next', 'new password')}
              disabled={saving}
              required
              error={reusesCurrent
                ? 'Your new password must be different from your current password.'
                : reusedPassword
                  ? 'You cannot reuse a recently used password.'
                  : ''}
            />
            <Input
              label="Confirm new password"
              icon={Lock}
              type={visible.confirm ? 'text' : 'password'}
              value={form.confirm}
              onChange={updateField('confirm')}
              autoComplete="new-password"
              error={form.confirm && form.next !== form.confirm ? 'Passwords do not match.' : ''}
              endAdornment={visibilityButton('confirm', 'confirmation')}
              disabled={saving}
              required
            />
          </div>
          {form.next && (
            <div className="rounded-control border border-hairline bg-surface-sunken p-3">
              <PasswordRequirements
                password={form.next}
                email={auth.user?.email}
                fullName={auth.user?.fullName || auth.user?.ownerName}
                theme="light"
                extraRequirements={requirementExtras}
              />
            </div>
          )}
        </div>

        <div aria-live="polite">
          {error && (
            <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {changed && !error && (
            <p role="status" className="rounded-control border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
              Password changed successfully.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            You will stay signed in on this device after changing your password.
          </p>
          <Button type="submit" loading={saving} disabled={!canSubmit} className="w-full sm:w-auto">
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}
