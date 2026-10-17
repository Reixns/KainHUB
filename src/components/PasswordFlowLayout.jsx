import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, KeyRound, ShieldCheck, Store, UserRound } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PlatformLogo } from '@/components/UI';

const PORTALS = {
  customer: {
    label: 'Customer Portal',
    loginPath: '/customer/login',
    Icon: UserRound,
    heading: 'Back to the food you love.',
    description: 'Securely recover your account and get back to discovering local kitchens.',
  },
  vendor: {
    label: 'Vendor Portal',
    loginPath: '/vendor/login',
    Icon: Store,
    heading: 'Your shop is waiting.',
    description: 'Recover access to your shop account with a secure password reset.',
  },
  admin: {
    label: 'Admin Portal',
    loginPath: '/admin/login',
    Icon: ShieldCheck,
    heading: 'Secure platform access.',
    description: 'Use a verified reset link to regain access to the admin console.',
  },
};

export default function PasswordFlowLayout({ role = 'customer', children }) {
  const { platformSettings } = useApp();
  const portal = PORTALS[role] || PORTALS.customer;
  const PortalIcon = portal.Icon;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101014] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-violet-900/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full bg-fuchsia-950/15 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            aria-label="KainHUB home"
            className="inline-flex h-12 w-12 items-center justify-center rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
          >
            <PlatformLogo src={platformSettings.logo} alt="" />
          </Link>
          <Link
            to={portal.loginPath}
            className="inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </header>

        <div className="my-auto grid items-center gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <aside className="hidden lg:block">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-violet-300/20 bg-violet-400/10 px-4 py-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200">
                <PortalIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-200">{portal.label}</p>
                <p className="mt-1 text-xs text-white/45">Account recovery</p>
              </div>
            </div>

            <h1 className="mt-7 max-w-md text-4xl font-extrabold leading-tight tracking-tight text-white">
              {portal.heading}
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-white/60">{portal.description}</p>

            <div className="mt-8 space-y-4">
              {[
                'Request a private reset link by email',
                'Choose a new password that meets security requirements',
                'Sign in again with your updated password',
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-3 text-sm text-white/70">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-300/25 bg-violet-400/10 text-xs font-semibold text-violet-200">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>

            <p className="mt-8 flex max-w-md items-start gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs leading-5 text-white/50">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
              For your security, reset links are time-limited and can only be used once.
            </p>
          </aside>

          <section className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#19191f]/95 p-5 sm:p-8">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-violet-200 lg:hidden">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {portal.label} · Account recovery
            </div>
            {children}
          </section>
        </div>

        <footer className="pb-2 text-center text-xs text-white/35">
          Keep your reset link private. KainHUB will never ask you to share it.
        </footer>
      </div>
    </main>
  );
}
