import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff, Lock, Mail, RefreshCw, ShieldCheck, Utensils, UserRound, Store } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Input, PlatformLogo } from '@/components/UI';
import {
  CAPTCHA_TTL_SECONDS,
  MAX_LOGIN_ATTEMPTS,
  clearLockout,
  lockoutSecondsForTier,
  lockoutSecondsRemaining,
  readLockout,
  registerFailedAttempt,
} from '@/lib/loginLockout';

/*
  Copy for the branded panel beside the form. Derived from the role so the three
  portals each read as their own product without every login page having to
  repeat it; a portal can still override it with a `panel` key in `config`.
*/
const PANEL_COPY = {
  customer: {
    headline: 'Order from the kitchens around you.',
    points: ['Browse nearby shops and build a cart', 'Chat directly with the shop', 'Pick up or have it delivered'],
  },
  vendor: {
    headline: 'Run your shop from one place.',
    points: ['Publish your menu in minutes', 'Accept and track every order', 'Message your customers directly'],
  },
  admin: {
    headline: 'Platform management console.',
    points: ['Approve vendors and moderate posts', 'Review every order end to end', 'Watch security alerts as they happen'],
  },
};

const SIGN_IN_PORTALS = [
  { role: 'customer', label: 'Customer', path: '/customer/login', Icon: UserRound },
  { role: 'vendor', label: 'Vendor', path: '/vendor/login', Icon: Store },
];

function createCaptcha() {
  const left = Math.floor(Math.random() * 9) + 1;
  const right = Math.floor(Math.random() * 10);
  return {
    left,
    right,
    answer: left + right,
    label: `${left} + ${right}`,
  };
}

const formatClock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Shared by the customer, vendor, and admin login pages. Each portal supplies
// only its own branding, copy, and post-login redirect via `config`.
//
// The lockout is deliberately client-side and documented as such: the streak
// lives in localStorage (src/lib/loginLockout.js) so a reload cannot wipe it,
// and every further tier of consecutive wrong passwords adds five minutes.
// Real rate limiting still has to be enforced by Supabase Auth or an edge
// function.
export default function RoleLogin({ config }) {
  const {
    role,
    redirectTo,
    redirectIfSignedIn,
    BadgeIcon,
    badgeLabel,
    title,
    subtitle,
    emailLabel,
    SubmitIcon = ShieldCheck,
    submitLabel,
    footer,
  } = config;

  const { auth, login, notifyFailedLogin, platformSettings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const panel = config.panel || PANEL_COPY[role] || PANEL_COPY.customer;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState(createCaptcha);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaBornAt, setCaptchaBornAt] = useState(() => Date.now());
  const [captchaRemaining, setCaptchaRemaining] = useState(CAPTCHA_TTL_SECONDS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [lockRemaining, setLockRemaining] = useState(0);

  /*
    Re-read the stored streak whenever the account being typed changes, which is
    what makes the lockout survive a reload: on mount it comes back from
    localStorage instead of starting again at zero.
  */
  useEffect(() => {
    const stored = readLockout(role, email);
    setFailedAttempts(stored.fails);
    setLockUntil(stored.lockUntil);
  }, [email, role]);

  // Counts the lock down from wall-clock time, so it cannot drift or be reset by
  // a reload. The streak is deliberately left alone when it reaches zero: only a
  // successful sign-in clears it, otherwise no tier could ever grow.
  useEffect(() => {
    if (!lockUntil) {
      setLockRemaining(0);
      return undefined;
    }

    const updateRemaining = () => setLockRemaining(lockoutSecondsRemaining(lockUntil));
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [lockUntil]);

  // The challenge is only good for so long, so a tab left open cannot be
  // answered hours later by someone who walks back to it. Ticked on a timer
  // because nothing else re-renders this component on its own.
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((captchaBornAt + CAPTCHA_TTL_SECONDS * 1000 - Date.now()) / 1000));
      setCaptchaRemaining(left);
      if (left > 0) return;
      setCaptcha(createCaptcha());
      setCaptchaAnswer('');
      setCaptchaBornAt(Date.now());
      setCaptchaRemaining(CAPTCHA_TTL_SECONDS);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [captchaBornAt]);

  useEffect(() => {
    if (!redirectIfSignedIn) return;
    if (auth.user && auth.role === role) {
      navigate(location.state?.from || redirectTo, { replace: true });
    }
  }, [auth, location.state, navigate, redirectIfSignedIn, role, redirectTo]);

  const resetCaptcha = () => {
    setCaptcha(createCaptcha());
    setCaptchaAnswer('');
    setCaptchaBornAt(Date.now());
    setCaptchaRemaining(CAPTCHA_TTL_SECONDS);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const lockedFor = lockoutSecondsRemaining(lockUntil);
    if (lockedFor > 0) {
      setError(`Too many failed attempts. Please wait ${formatClock(lockedFor)} before trying again.`);
      return;
    }

    // Checked here as well as on the timer, because the interval has not
    // necessarily fired yet on the submit that lands just after the expiry.
    const captchaExpired = Date.now() - captchaBornAt >= CAPTCHA_TTL_SECONDS * 1000;
    if (captchaExpired || Number(captchaAnswer) !== captcha.answer) {
      setError(captchaExpired
        ? 'Security check expired. Please solve the new challenge.'
        : 'Captcha answer is incorrect. Please solve the math challenge.');
      resetCaptcha();
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password, role);
      if (result.success) {
        clearLockout(role, email);
        setFailedAttempts(0);
        setLockUntil(0);
        navigate(location.state?.from || redirectTo, { replace: true });
      } else if (!result.countAttempt) {
        setError(`${result.message || 'Unable to sign in.'} This did not count as a failed password attempt.`);
        resetCaptcha();
      } else {
        const attempt = registerFailedAttempt(role, email);
        setFailedAttempts(attempt.fails);
        setLockUntil(attempt.lockUntil);

        if (attempt.lockedOut) {
          notifyFailedLogin(email, role);
          setError(
            `Too many failed attempts. This account is now locked for ${formatClock(lockoutSecondsForTier(attempt.tier))}. `
            + 'Every further set of wrong answers adds five more minutes.'
          );
        } else {
          setError(`${result.message || 'Unable to sign in.'} ${attempt.attemptsRemaining} attempt${attempt.attemptsRemaining === 1 ? '' : 's'} remaining.`);
        }

        resetCaptcha();
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  // Filled dots for wrong answers already spent in this tier. While locked the
  // tier is always shown full, because the stored streak has just wrapped to a
  // multiple of the limit and would otherwise render as zero.
  const strikes = lockRemaining > 0
    ? MAX_LOGIN_ATTEMPTS
    : failedAttempts % MAX_LOGIN_ATTEMPTS;
  const locked = lockRemaining > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#101014] text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-violet-900/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full bg-fuchsia-950/15 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-3 sm:px-6 sm:py-3 lg:px-8 lg:py-2">
        <div className="mb-2 flex items-center justify-between">
          <Link to="/" aria-label="KainHUB home" className="inline-flex items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-white">
              <PlatformLogo src={platformSettings.logo} alt="" />
            </span>
          </Link>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:gap-5">
          {/*
            Branded panel. Hidden on small screens, where the same identity is
            repeated as a compact header above the card instead of pushing the
            form below a screenful of marketing copy.
          */}
          <aside className="hidden lg:block">
            <div className="flex items-center gap-3">
              {/* Dropped `shadow-raised`: rule 2 keeps elevation off at-rest
                  surfaces. The badge already separates from the flat canvas on
                  its solid fill. */}
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
                <BadgeIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">{badgeLabel}</p>
                <p className="mt-1 text-sm text-white/45">Lancaster, Philippines</p>
              </div>
            </div>

            <h2 className="mt-3 max-w-lg text-2xl font-extrabold leading-[1.08] tracking-tight text-white xl:text-3xl">{panel.headline}</h2>

            <ul className="mt-3 space-y-1.5">
              {panel.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-white/65">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <p className="mt-4 max-w-md rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs leading-4 text-white/55">
              Repeated wrong passwords lock an account for five more minutes each time, and every
              lockout is recorded for the platform owner.
            </p>
            <Link
              to="/"
              className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-control px-1 text-xs font-medium text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
              Back to home
            </Link>
          </aside>

          <div className="mx-auto w-full max-w-lg lg:max-w-none">
            <div className="rounded-2xl border border-white/10 bg-[#19191f]/95 p-3 sm:p-4 lg:p-3">
              {SIGN_IN_PORTALS.some((portal) => portal.role === role) && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                    Sign in as
                  </p>
                  <nav
                    aria-label="Choose sign-in portal"
                    className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
                  >
                    {SIGN_IN_PORTALS.map(({ role: portalRole, label, path, Icon }) => {
                      const active = role === portalRole;
                      return (
                        <Link
                          key={portalRole}
                          to={path}
                          aria-current={active ? 'page' : undefined}
                          className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
                            active
                              ? 'bg-violet-500 text-white'
                              : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {label}
                          {active && <span className="sr-only">, selected</span>}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              )}
              {role === 'admin' && (
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
                  <BadgeIcon className="h-3.5 w-3.5" /> {badgeLabel}
                </div>
              )}
              <h1 className="mb-1 text-xl font-bold tracking-tight text-white">{title}</h1>
              <p className="mb-3 text-sm text-white/50">{subtitle}</p>

              <form onSubmit={handleSubmit} className="auth-form space-y-2">
                <Input
                  label={emailLabel}
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                  required
                  className="auth-input !py-2"
                />

                <div className="relative">
                  <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-white/70">Password</label>
                  <Input
                    id="login-password"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                    className="auth-input !py-2"
                    endAdornment={(
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-pressed={showPassword}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-control text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                      >
                        {showPassword
                          ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                          : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    )}
                  />
                  <div className="mt-1 flex justify-end">
                    <Link
                      to={`/forgot-password?role=${role}`}
                      state={{ email }}
                      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-control px-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-400/10 hover:text-violet-200"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-violet-200">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Security check
                    </div>
                    <span className="text-[11px] tabular-nums text-white/40" aria-hidden="true">
                      {formatClock(captchaRemaining)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex h-9 items-center justify-center rounded-control border border-white/10 bg-black/20 px-3 text-sm font-semibold tabular-nums text-violet-200">
                      {captcha.label} =
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      className={`h-9 w-20 rounded-control border bg-[#101014] px-3 text-sm tabular-nums text-white transition-colors focus:outline-none ${
                        captchaAnswer.trim() === ''
                          ? 'border-white/15 focus:ring-2 focus:ring-violet-400/30'
                          : Number(captchaAnswer) === captcha.answer
                            ? 'border-success/60 focus:ring-2 focus:ring-success/20'
                            : 'border-danger/60 focus:ring-2 focus:ring-danger/20'
                      }`}
                      placeholder="?"
                      aria-label="captcha answer"
                      disabled={locked}
                    />
                    <button
                      type="button"
                      onClick={resetCaptcha}
                      aria-label="Get a new security question"
                      className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-control text-violet-200 hover:bg-violet-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/40"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-1 hidden text-[10px] leading-3 text-white/40 sm:block">
                    A new question appears every {Math.round(CAPTCHA_TTL_SECONDS / 60)} minutes.
                  </p>
                </div>

                {!locked && (
                  <div className="flex items-center gap-2 text-[11px] text-white/45">
                    <span className="flex items-center gap-1" aria-hidden="true">
                      {Array.from({ length: MAX_LOGIN_ATTEMPTS }).map((_, index) => (
                        <span
                          key={index}
                          className={`h-1.5 w-4 rounded-full ${index < strikes ? 'bg-danger' : 'bg-white/15'}`}
                        />
                      ))}
                    </span>
                    <span>
                      {strikes === 0
                        ? `${MAX_LOGIN_ATTEMPTS} wrong answers lock this account`
                        : `${MAX_LOGIN_ATTEMPTS - strikes} more wrong answer${MAX_LOGIN_ATTEMPTS - strikes === 1 ? '' : 's'} and this account locks`}
                    </span>
                  </div>
                )}

                {/*
                  role="alert" so a failed sign-in is announced rather than
                  appearing silently below the fold.
                */}
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-red-300"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {locked && (
                  <div
                    role="status"
                    className="flex items-start gap-2 rounded-control border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-sm font-medium text-violet-200"
                  >
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Login locked. Try again in {formatClock(lockRemaining)}.</span>
                  </div>
                )}

                <Button type="submit" full size="md" loading={loading} disabled={locked}>
                  <SubmitIcon className="h-4 w-4" /> {submitLabel}
                </Button>
              </form>

              {footer.type !== 'register' && (
                <div className="mt-3 rounded-control border border-white/10 bg-white/[0.04] p-2 text-center text-xs text-white/50">
                  {footer.text}
                </div>
              )}
              {footer.type === 'register' && (
                <p className="mt-3 text-center text-xs text-white/45">
                  {footer.prompt}{' '}
                  <Link to={footer.to} className="font-semibold text-violet-300 hover:text-violet-200 hover:underline">
                    {footer.linkLabel}
                  </Link>
                </p>
              )}
            </div>
            <Link
              to="/"
              className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-control px-1 text-xs font-medium text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 lg:hidden"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
