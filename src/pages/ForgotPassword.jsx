import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CheckCircle, KeyRound, Mail, Send } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Input } from '@/components/UI';
import PasswordFlowLayout from '@/components/PasswordFlowLayout';

const ROLE_LOGIN_PATH = {
  admin: '/admin/login',
  vendor: '/vendor/login',
  customer: '/customer/login',
};

export default function ForgotPassword() {
  const location = useLocation();
  const requestedRole = new URLSearchParams(location.search).get('role');
  const role = Object.hasOwn(ROLE_LOGIN_PATH, requestedRole) ? requestedRole : 'customer';
  const { resetPassword } = useApp();
  const [email, setEmail] = useState(location.state?.email || '');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await resetPassword(email, role);
      if (!result.success) {
        setError(result.message || 'Unable to request a reset link right now.');
        return;
      }
      setSent(true);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to request a reset link right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PasswordFlowLayout role={role}>
      {sent ? (
        <div role="status" className="space-y-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-300">
            <CheckCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Check your email</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              {`If an account matches ${email.trim()}, password reset instructions will arrive shortly.`}
              {' '}Check your inbox and spam folder.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
              onClick={() => setSent(false)}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Send another link
            </Button>
            <Button as={Link} to={ROLE_LOGIN_PATH[role]} className="w-full">
              Back to sign in
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Forgot your password?</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Enter the email address linked to your {role} account. We’ll send a secure link to set a new password.
            {' '}If your account was locked after too many failed sign-in attempts, this same link unlocks it.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              label="Email address"
              icon={Mail}
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError(''); }}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={loading}
              labelClassName="text-white/75"
              className="border-white/15 placeholder:text-white/35"
              style={{ backgroundColor: '#101014', color: '#fff' }}
            />
            {error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" loading={loading} disabled={loading}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send reset link
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-white/50">
            Remember your password?{' '}
            <Link className="font-semibold text-violet-300 hover:text-violet-200" to={ROLE_LOGIN_PATH[role]}>
              Sign in
            </Link>
          </p>
        </>
      )}
    </PasswordFlowLayout>
  );
}
