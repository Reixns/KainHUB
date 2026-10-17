import { useState } from 'react';
import { Truck, Save, Clock, Info } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input } from '@/components/UI';

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

  const handleSave = () => {
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Store Settings</h1>
        <p className="text-sm text-muted">Manage your store information and delivery options.</p>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold text-ink mb-4 flex items-center gap-2"><Info className="w-5 h-5" /> Store Information</h2>
        <div className="space-y-3">
          <Input label="Shop Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Category" placeholder="e.g. Filipino Meals, Desserts, Drinks" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input label="Operating Hours" icon={Clock} value={form.operatingHours} onChange={(e) => setForm({ ...form, operatingHours: e.target.value })} />
          <div>
            <label className="block text-sm font-medium text-body mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 border border-hairline-strong rounded-lg text-sm" />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-ink mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-success" /> Delivery Settings</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-lg">
            <div>
              <div className="font-medium text-sm text-ink">Delivery Available</div>
              <div className="text-xs text-muted">Offer delivery to customers in Zone 1.</div>
            </div>
            <Toggle
              checked={form.deliveryAvailable}
              onChange={(v) => setForm({ ...form, deliveryAvailable: v })}
              label="Accept delivery orders"
            />
          </div>

          {form.deliveryAvailable && (
            <p className="text-sm text-body bg-brand-soft border border-brand-muted rounded-lg p-3">
              Delivery details and payment will be discussed directly with the customer in chat.
            </p>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-success flex items-center gap-1">✓ Saved!</span>}
        <Button onClick={handleSave}><Save className="w-4 h-4" /> Save Settings</Button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    /* The visible pill is 24px tall, below the 44px rule in index.css, so a
       transparent hit area is stretched over it with pseudo-elements rather
       than making the control itself taller and misaligning the row.
       role="switch" + aria-checked is what makes this announce as on/off
       instead of as an unlabelled button. */
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-[''] ${checked ? 'bg-success' : 'bg-hairline-strong'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${checked ? 'left-[calc(100%-1.375rem)]' : 'left-0.5'}`}></span>
    </button>
  );
}
