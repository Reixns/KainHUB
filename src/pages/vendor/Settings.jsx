import { useState } from 'react';
import { CheckCircle2, Truck, Save, Clock, Info, ShieldCheck } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input, Textarea } from '@/components/UI';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import LoginSessionsCard from '@/components/LoginSessionsCard';
import FoodCategoryField from '@/components/FoodCategoryField';
import { FIELD_CHAR_LIMITS, findCharacterLimitViolation, characterLimitMessage } from '@/lib/textLimits';

export default function VendorSettings() {
  const { auth, updateVendor } = useApp();
  const vendor = auth.user;
  const [form, setForm] = useState({
    deliveryAvailable: vendor.deliveryAvailable,
    operatingHours: vendor.operatingHours,
    name: vendor.name,
    description: vendor.description || '',
    category: vendor.category || '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  const handleSave = (event) => {
    event.preventDefault();
    const violation = findCharacterLimitViolation({
      shopName: form.name,
      operatingHours: form.operatingHours,
      shopDescription: form.description,
      category: form.category,
    });
    if (violation) {
      setError(characterLimitMessage(violation.limit));
      return;
    }
    setError('');
    updateVendor(vendor.id, {
      deliveryAvailable: form.deliveryAvailable,
      operatingHours: form.operatingHours,
      name: form.name,
      description: form.description,
      categoryId: form.category.toLowerCase().trim().replace(/\s+/g, '-'),
      category: form.category.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Store Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your shop profile, delivery options, and account security.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-hairline bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'profile' ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-surface-sunken hover:text-ink'
          }`}
        >
          <Info className="h-4 w-4" />
          Edit profile
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'security' || activeTab === 'change-password' ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-surface-sunken hover:text-ink'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Security
        </button>
      </div>

      {activeTab === 'profile' && (
        <Card className="overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b border-hairline bg-surface-sunken px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-brand-muted bg-brand-soft text-brand-strong">
            <Info className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Store profile</h2>
            <p className="mt-0.5 text-sm text-muted">This information is shown to customers browsing your shop.</p>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="space-y-5 p-5">
            <div className="space-y-3">
              <Input label="Shop Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={FIELD_CHAR_LIMITS.shopName} />
              <FoodCategoryField
                value={form.category}
                onChange={(category) => setForm((current) => ({ ...current, category }))}
                theme="dark"
              />
              <Input label="Operating Hours" icon={Clock} value={form.operatingHours} onChange={(e) => setForm({ ...form, operatingHours: e.target.value })} maxLength={FIELD_CHAR_LIMITS.operatingHours} />
              <Textarea label="Description" rows={3} maxLength={FIELD_CHAR_LIMITS.shopDescription} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="space-y-3 border-t border-hairline pt-5">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Truck className="h-4 w-4 text-success" aria-hidden="true" />
                  Delivery
                </h3>
                <p className="mt-0.5 text-xs text-muted">Control whether customers can choose delivery at checkout.</p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-control border border-hairline bg-surface-sunken p-3">
                <div>
                  <div className="text-sm font-medium text-ink">Delivery available</div>
                  <div className="mt-0.5 text-xs text-muted">Offer delivery to customers in Zone 1.</div>
                </div>
                <Toggle
                  checked={form.deliveryAvailable}
                  onChange={(v) => setForm({ ...form, deliveryAvailable: v })}
                  label="Accept delivery orders"
                />
              </div>

              {form.deliveryAvailable && (
                <p className="rounded-control border border-brand-muted bg-brand-soft p-3 text-sm text-body">
                  Delivery details and payment will be discussed directly with the customer in chat.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-control border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-hairline bg-surface-sunken px-5 py-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Saved
              </span>
            )}
            <Button type="submit"><Save className="w-4 h-4" /> Save settings</Button>
          </div>
        </form>
      </Card>
      )}

      {activeTab === 'security' && (
        <>
          <LoginSessionsCard role="vendor" />
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-ink">Password</h2>
                <p className="mt-0.5 text-sm text-muted">Update your password regularly to keep your account secure.</p>
              </div>
              <Button type="button" onClick={() => setActiveTab('change-password')}>
                Change password
              </Button>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'change-password' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Change password</h2>
              <p className="text-sm text-muted">Update your password to keep your account secure.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab('security')}>
              Back to Security
            </Button>
          </div>
          <ChangePasswordCard role="vendor" />
        </>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-[''] ${checked ? 'bg-success' : 'bg-hairline-strong'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#fff] shadow transition-all ${checked ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'}`}></span>
    </button>
  );
}
