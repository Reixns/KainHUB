import { useState } from 'react';
import { User, Mail, Phone, MapPin, Save, Store, LogOut } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input } from '@/components/UI';
import { InfoRow, MediaButton, LogoAvatar } from '@/components/ProfileParts';
import { isValidMobile, mobileValidationMessage, sanitizeMobile, MOBILE_LENGTH } from '@/lib/mobile';
import { useNavigate } from 'react-router-dom';

export default function VendorProfile() {
  const { auth, updateProfile, uploadMediaFile, showToast, logout } = useApp();
  const navigate = useNavigate();
  const user = auth.user;
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState('');
  const [form, setForm] = useState({
    ownerName: user.ownerName,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    address: user.address,
  });

  const handleSave = async () => {
    if (!isValidMobile(form.mobile)) {
      showToast(mobileValidationMessage(), 'error');
      return;
    }
    const result = await updateProfile(form);
    if (result?.success !== false) setEditing(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/vendor/login');
  };

  return (
    <div className="max-w-2xl space-y-4">
      {/*
        Cover banner and its upload button are gone -- the shop logo is the only
        image now, on the vendor's own page and everywhere the customer portal
        renders a shop. The banner was a plain `bg-brand-soft` strip whenever the
        vendor had not uploaded one, and no customer-facing surface showed a cover
        anymore, so it was two controls writing a field nothing reads.

        `coverImage` is left in state and in the database so this stays
        reversible; nothing writes it any more.
      */}
      <Card className="text-center">
        <div className="p-6">
        <LogoAvatar user={user} />
        <h2 className="text-xl font-bold text-ink">{user.name}</h2>
        <p className="text-sm text-muted">Owned by {user.ownerName}</p>
        <span className="inline-block mt-2 bg-success-soft text-success text-xs px-2 py-0.5 rounded-full font-medium">
          VERIFIED VENDOR
        </span>
        <div className="flex justify-center gap-2 mt-3">
          <MediaButton label="Shop photo" folder="profile" loading={uploading === 'profile'} uploading={setUploading} uploadMediaFile={uploadMediaFile} onUploaded={(url) => updateProfile({ logo: url })} showToast={showToast} />
        </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-ink">Shop Information</h3>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-success font-medium">Edit</button>
          ) : null}
        </div>
        {editing ? (
          <div className="space-y-3">
            <Input label="Shop Name" icon={Store} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Owner Name" icon={User} value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            <Input label="Mobile" icon={Phone} type="tel" inputMode="numeric" maxLength={MOBILE_LENGTH} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: sanitizeMobile(e.target.value) })} />
            <Input label="Email" icon={Mail} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Address" icon={MapPin} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSave}><Save className="w-4 h-4" /> Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <InfoRow icon={<Store className="w-4 h-4" />} label="Shop Name" value={user.name} />
            <InfoRow icon={<User className="w-4 h-4" />} label="Owner" value={user.ownerName} />
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Mobile" value={user.mobile} />
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={user.address} />
          </div>
        )}
      </Card>

      <Button variant="outline" className="w-full text-danger border-danger/30 hover:bg-danger-soft" onClick={handleLogout}>
        <LogOut className="w-4 h-4" /> Logout
      </Button>
    </div>
  );
}

