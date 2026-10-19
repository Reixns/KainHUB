import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, KeyRound, Lock, Save } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Input } from '@/components/UI';
import { validatePassword } from '@/lib/supabase';
import PasswordFlowLayout from '@/components/PasswordFlowLayout';

const ROLE_LOGIN_PATH = {
  admin: '/admin/login',
  vendor: '/vendor/login',
  customer: '/customer/login',
};

export default function ResetPassword() {
  const { updatePassword, unlockAccount, auth, authReady, logout } = useApp();
  const location = useLocation();
  const requestedRole = new URLSearchParams(location.search).get('role');
  const role = Object.hasOwn(ROLE_LOGIN_PATH, requestedRole) ? requestedRole : 'customer';
  const hasRecoverySession = authReady && Boolean(auth?.user) && auth?.role === role;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordCheck = validatePassword(password, {
    email: auth?.user?.email,
    fullName: auth?.user?.fullName || auth?.user?.ownerName,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!hasRecoverySession) {
      setError('This password reset link is no longer valid. Request a new link from your sign-in page.');
      return;
    }
    if (!passwordCheck.valid) {
      setError(passwordCheck.message);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    let result;
    try {
      result = await updatePassword(password, role);
    } catch (err) {
      result = { success: false, message: err?.message || 'Unable to update your password.' };
    }
    setLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    // The recovery link proves the mailbox was reached, so this is also the point
    // that clears a failed-login lock. Done before logout because the unlock RPC
    // needs the session. Best effort: a database without the RPC has nothing to
    // unlock and sign-in will still work the first time.
    try {
      await unlockAccount(role);
    } catch {
      // Ignore: unlocking is a convenience on top of the password change.
    }
    logout();
    setSuccess(true);
  };

  return (
    <PasswordFlowLayout role={role}>
      <div className="w-full">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
          <KeyRound className="h-3.5 w-3.5" /> Account Security
        </div>
        {success ? (
          <div role="status" className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-emerald-200">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h1 className="font-semibold text-white">Password updated</h1>
                <p className="mt-1 text-sm">Your new password is ready and your account is unlocked. Sign in using it to continue.</p>
              </div>
            </div>
            <Button as={Link} to={ROLE_LOGIN_PATH[role]} className="w-full" size="lg">
              Continue to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Set a new password</h1>
            <p className="text-sm text-white/55 mb-6">Choose a strong password for your {role} account.</p>
            {!authReady ? (
              <p role="status" className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-white/60">
                Verifying your secure reset link…
              </p>
            ) : !hasRecoverySession ? (
              <div role="alert" className="space-y-4">
                <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-red-300">
                  This reset link is invalid, expired, or already used. Request a new link to continue.
                </p>
                <p className="text-sm leading-6 text-white/60">
                  Return to your sign-in page, enter your email, then choose <strong>Forgot password?</strong>
                </p>
                <Button as={Link} to={ROLE_LOGIN_PATH[role]} className="w-full" size="lg">
                  Go to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="New password"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  autoComplete="new-password"
                  aria-label="New password"
                  hint={password
                    ? (passwordCheck.valid ? 'Password meets the security requirements.' : passwordCheck.message)
                    : 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.'}
                  endAdornment={(
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="rounded p-1 text-subtle hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                  required
                  labelClassName="text-white/75"
                  hintClassName="text-white/45"
                  className="border-white/15 placeholder:text-white/35"
                  style={{ backgroundColor: '#101014', color: '#fff' }}
                />
                <Input
                  label="Confirm new password"
                  icon={Lock}
                  type={showConfirmation ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => { setConfirmPassword(event.target.value); setError(''); }}
                  autoComplete="new-password"
                  aria-label="Confirm new password"
                  error={confirmPassword && password !== confirmPassword ? 'Passwords do not match.' : ''}
                  endAdornment={(
                    <button
                      type="button"
                      onClick={() => setShowConfirmation((visible) => !visible)}
                      className="rounded p-1 text-subtle hover:text-ink"
                      aria-label={showConfirmation ? 'Hide confirmation' : 'Show confirmation'}
                    >
                      {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                  required
                  labelClassName="text-white/75"
                  className="border-white/15 placeholder:text-white/35"
                  style={{ backgroundColor: '#101014', color: '#fff' }}
                />
                {error && <div role="alert" className="bg-danger/10 border border-danger/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}
                <Button type="submit" className="w-full" size="lg" loading={loading} disabled={loading}>
                  <Save className="w-4 h-4" /> Update Password
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </PasswordFlowLayout>
  );
}
