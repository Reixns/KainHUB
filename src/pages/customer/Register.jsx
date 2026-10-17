import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  User,
  Utensils,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Input, PlatformLogo } from '@/components/UI';
import { validatePassword } from '@/lib/supabase';

export default function CustomerRegister() {
  const { registerCustomer, platformSettings } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    email: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    const emailValue = form.email.trim();
    const emailParts = emailValue.split('@');
    if (!form.fullName.trim()) errs.fullName = 'Full name required';
    if (!form.mobile.trim()) errs.mobile = 'Mobile number required';
    if (!emailValue || emailParts.length !== 2 || !emailParts.every((part) => part.trim().length > 0)) {
      errs.email = 'Email required';
    }
    if (!form.address.trim()) errs.address = 'Zone 1 address required';
    const passwordCheck = validatePassword(form.password, {
      email: form.email,
      fullName: form.fullName,
    });
    if (!passwordCheck.valid) errs.password = passwordCheck.message;
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    setNotice({ type: '', text: '' });
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await registerCustomer(form);
      if (res.success) {
        if (res.message) {
          setNotice({ type: 'success', text: res.message });
          return;
        }
        navigate('/customer', { replace: true });
      } else {
        if (res.redirectToLogin) {
          setNotice({ type: 'info', text: res.message });
          navigate('/customer/login', { replace: true });
          return;
        }
        setErrors({ email: res.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101014] px-4 py-3 text-white sm:px-6 sm:py-5 lg:px-8 lg:py-0">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-violet-900/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full bg-fuchsia-950/15 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-5xl">
        <header className="mb-3 flex items-center justify-between lg:mb-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-white">
              <PlatformLogo src={platformSettings.logo} alt="" />
            </span>
          </Link>
          <span className="hidden items-center gap-2 rounded-full border border-violet-300/15 bg-violet-400/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-200 sm:inline-flex">
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
            Customer portal
          </span>
        </header>

        <div>
          <section className="min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1b1a21] to-[#15151a] p-4 sm:p-5 lg:p-5">
            <div className="mb-3 lg:hidden">
              <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Customer registration
              </p>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Create your account</h1>
              <p className="mt-1.5 text-sm text-white/55">Join the Zone 1 food community.</p>
            </div>

            <div className="mb-2 hidden lg:block">
              <h2 className="text-xl font-bold tracking-tight">Create your account</h2>
            </div>

            <form onSubmit={handleSubmit} className="register-form grid gap-4 lg:grid-cols-2 lg:gap-5">
              <section aria-labelledby="customer-details-heading">
                <div className="mb-2 flex items-center gap-2.5 border-b border-white/10 pb-1.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 id="customer-details-heading" className="text-sm font-semibold text-white">Your details</h3>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Full name" icon={User} value={form.fullName} onChange={updateField('fullName')} error={errors.fullName} placeholder="Juan Dela Cruz" autoComplete="name" required className="register-input lg:!py-2" />
                  <Input label="Mobile number" icon={Phone} type="tel" value={form.mobile} onChange={updateField('mobile')} error={errors.mobile} placeholder="0917XXXXXXX" autoComplete="tel" required className="register-input lg:!py-2" />
                  <Input label="Email address" icon={Mail} type="email" value={form.email} onChange={updateField('email')} error={errors.email} placeholder="you@example.com" autoComplete="email" required className="register-input sm:col-span-2 lg:col-span-1 lg:!py-2" />
                  <Input label="Zone 1 address" icon={MapPin} value={form.address} onChange={updateField('address')} error={errors.address} placeholder="Block X Lot Y, Lancaster Zone 1" autoComplete="street-address" required className="register-input sm:col-span-2 lg:col-span-1 lg:!py-2" />
                </div>
              </section>

              <section aria-labelledby="customer-security-heading">
                <div className="mb-3 flex items-center gap-2.5 border-b border-white/10 pb-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 id="customer-security-heading" className="text-sm font-semibold text-white">Secure your account</h3>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-2">
                  <Input label="Password" icon={Lock} type={showPassword ? 'text' : 'password'} value={form.password} onChange={updateField('password')} error={errors.password} autoComplete="new-password" placeholder="Create a strong password" required className="register-input lg:!py-2" endAdornment={<button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} className="inline-flex h-10 w-10 items-center justify-center rounded-control text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">{showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>} />
                  <Input label="Confirm password" icon={Lock} type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={updateField('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" placeholder="Enter it again" required className="register-input lg:!py-2" endAdornment={<button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-pressed={showConfirmPassword} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} className="inline-flex h-10 w-10 items-center justify-center rounded-control text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">{showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>} />
                  <p className="text-xs leading-5 text-white/45 sm:col-span-2">
                    Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.
                  </p>
                </div>
              </section>

              {notice.text && (
                <div
                  role={notice.type === 'success' ? 'status' : 'alert'}
                  className={`rounded-xl border px-4 py-3 text-sm lg:col-span-2 ${
                    notice.type === 'success'
                      ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
                      : 'border-violet-300/20 bg-violet-400/10 text-violet-200'
                  }`}
                >
                  {notice.text}
                </div>
              )}

              <Button type="submit" full size="md" loading={loading} className="group lg:col-span-2">
                Create account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-white/45">
              Already have an account?{' '}
              <Link to="/customer/login" className="font-semibold text-violet-300 hover:text-violet-200 hover:underline">
                Sign in
              </Link>
            </p>
            <Link
              to="/"
              className="mt-1 inline-flex min-h-8 w-full items-center justify-center gap-1 rounded-control text-xs font-medium text-white/50 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
              Back to home
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
