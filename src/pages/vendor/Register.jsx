import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  Utensils,
  User,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Input, PlatformLogo, Textarea } from '@/components/UI';
import { validatePassword } from '@/lib/supabase';
import { isValidMobile, mobileValidationMessage, sanitizeMobile, MOBILE_LENGTH } from '@/lib/mobile';
import FoodCategoryField from '@/components/FoodCategoryField';
import PasswordRequirements from '@/components/PasswordRequirements';

export default function VendorRegister() {
  const { registerVendor, platformSettings } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    ownerName: '',
    shopName: '',
    mobile: '',
    email: '',
    shopAddress: '',
    category: '',
    operatingHours: '8:00 AM - 9:00 PM',
    description: '',
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
    if (!form.ownerName.trim()) errs.ownerName = 'Required';
    if (!form.shopName.trim()) errs.shopName = 'Required';
    if (!form.mobile) errs.mobile = 'Required';
    else if (!isValidMobile(form.mobile)) errs.mobile = mobileValidationMessage();
    if (!emailValue || emailParts.length !== 2 || !emailParts.every((part) => part.trim().length > 0)) {
      errs.email = 'Email required';
    }
    if (!form.shopAddress.trim()) errs.shopAddress = 'Required';
    if (!form.category.trim()) errs.category = 'Required';
    const passwordCheck = validatePassword(form.password, {
      email: form.email,
      fullName: form.ownerName,
    });
    if (!passwordCheck.valid) errs.password = passwordCheck.message;
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    setNotice({ type: '', text: '' });
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await registerVendor(form);
      if (res.success) {
        setNotice({ type: 'success', text: res.message });
        if (!res.message || !res.message.toLowerCase().includes('confirm')) {
          navigate('/vendor/login', { replace: true });
        }
      } else {
        if (res.redirectToLogin) {
          setNotice({ type: 'info', text: res.message });
          navigate('/vendor/login', { replace: true });
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
            <Store className="h-3.5 w-3.5" aria-hidden="true" />
            Vendor portal
          </span>
        </header>

        <div>
          <section className="min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1b1a21] to-[#15151a] p-4 sm:p-5 lg:p-2">
            <div className="mb-3 lg:hidden">
              <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                <Store className="h-4 w-4" aria-hidden="true" />
                Vendor registration
              </p>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Register your shop</h1>
              <p className="mt-1.5 text-sm text-white/55">Tell us about your shop to get started.</p>
            </div>

            <div className="mb-2 hidden lg:block">
              <h2 className="text-xl font-bold tracking-tight">Register your shop</h2>
            </div>

            <form onSubmit={handleSubmit} className="register-form grid gap-2 lg:grid-cols-2">
              <section aria-labelledby="shop-details-heading">
                <div className="mb-2 flex items-center gap-2.5 border-b border-white/10 pb-1.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200">
                    <Store className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 id="shop-details-heading" className="text-sm font-semibold text-white">Shop details</h3>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Input label="Shop name" icon={Store} value={form.shopName} onChange={updateField('shopName')} error={errors.shopName} autoComplete="organization" required className="register-input lg:!py-2" />
                  <Input label="Owner name" icon={User} value={form.ownerName} onChange={updateField('ownerName')} error={errors.ownerName} autoComplete="name" required className="register-input lg:!py-2" />
                  <Input label="Mobile number" icon={Phone} type="tel" inputMode="numeric" maxLength={MOBILE_LENGTH} value={form.mobile} onChange={(e) => setForm((current) => ({ ...current, mobile: sanitizeMobile(e.target.value) }))} error={errors.mobile} autoComplete="tel" required className="register-input lg:!py-2" />
                  <Input label="Email address" icon={Mail} type="email" value={form.email} onChange={updateField('email')} error={errors.email} autoComplete="email" required className="register-input lg:!py-2" />
                  <Input label="Shop address (Zone 1)" icon={MapPin} value={form.shopAddress} onChange={updateField('shopAddress')} error={errors.shopAddress} autoComplete="street-address" required className="register-input sm:col-span-2 lg:!py-2" />
                  <FoodCategoryField value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} error={errors.category} />
                  <Input label="Operating hours" icon={Clock} value={form.operatingHours} onChange={updateField('operatingHours')} className="register-input lg:!py-2" />
                  <Textarea
                    label="About your shop"
                    placeholder="Describe your shop (optional)"
                    value={form.description}
                    onChange={updateField('description')}
                    rows={2}
                    className="register-input sm:col-span-2 lg:!py-2"
                  />
                </div>
              </section>

              <section aria-labelledby="account-security-heading">
                <div className="mb-2 flex items-center gap-2.5 border-b border-white/10 pb-1.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 id="account-security-heading" className="text-sm font-semibold text-white">Secure your account</h3>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Input label="Password" icon={Lock} type={showPassword ? 'text' : 'password'} value={form.password} onChange={updateField('password')} error={errors.password} autoComplete="new-password" placeholder="Create a strong password" required className="register-input lg:!py-2" endAdornment={<button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-pressed={showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'} className="inline-flex h-10 w-10 items-center justify-center rounded-control text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">{showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>} />
                  <Input label="Confirm password" icon={Lock} type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={updateField('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" placeholder="Enter it again" required className="register-input lg:!py-2" endAdornment={<button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-pressed={showConfirmPassword} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} className="inline-flex h-10 w-10 items-center justify-center rounded-control text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">{showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}</button>} />
                  <PasswordRequirements password={form.password} email={form.email} fullName={form.ownerName} />
                </div>
              </section>

              <div role="status" className="flex items-start gap-3 rounded-xl border border-violet-300/20 bg-violet-400/[0.07] p-2.5 lg:col-span-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
                <p className="text-xs leading-5 text-white/65">
                  Your shop will be <strong className="font-semibold text-violet-200">pending approval</strong> after registration. You can receive orders once an admin approves your shop.
                </p>
              </div>

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
                Register your shop
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Button>
            </form>

            <p className="mt-2 text-center text-sm text-white/45">
              Already registered?{' '}
              <Link to="/vendor/login" className="font-semibold text-violet-300 hover:text-violet-200 hover:underline">
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
