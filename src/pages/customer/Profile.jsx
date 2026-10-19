import { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Save, ShoppingBag, Heart, LogOut, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input, Avatar, Badge, CARD_FOCUS_RING } from '@/components/UI';
import { InfoRow } from '@/components/ProfileParts';
import { isValidMobile, mobileValidationMessage, sanitizeMobile, MOBILE_LENGTH } from '@/lib/mobile';
import { Link, useNavigate } from 'react-router-dom';

export default function CustomerProfile() {
  // `uploadMediaFile`, `showToast`, `uploading` and `setUploading` went out with
  // the cover strip -- a customer has no image control on this page at all, the
  // avatar is initials-only by design.
  const { auth, updateProfile, orders, posts, logout, showToast } = useApp();
  const navigate = useNavigate();
  const user = auth.user;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user.fullName,
    mobile: user.mobile,
    email: user.email,
    address: user.address || '',
  });

  /*
    auth.user is replaced wholesale in several places (remote hydration, the
    sign-in and OTP paths, updateProfile itself), so the form has to follow it.
    Initialised once, it showed stale values on Edit and then wrote those old
    values back over the newer ones on save.
  */
  useEffect(() => {
    setForm({
      fullName: user.fullName ?? '',
      mobile: user.mobile ?? '',
      email: user.email ?? '',
      address: user.address || '',
    });
  }, [user.fullName, user.mobile, user.email, user.address]);

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
    navigate('/customer/login');
  };

  const myOrdersCount = orders.filter((o) => String(o.customerId) === String(user.id)).length;
  const myPostCount = posts.filter((p) => String(p.authorId) === String(user.id)).length;

  return (
    <div>
      {/*
        The cover strip and the last upload button on this page are gone. The
        customer's avatar is initials-only and stays that way, so with no cover
        there was nothing left to upload here -- the button wrote a
        `coverImage` that no customer-facing surface rendered any more.

        `mt-8` existed only to clear the absolutely-positioned strip above, and
        `relative`/`overflow-hidden` only served it, so all three go too.
      */}
      <Card className="p-6 mb-4 text-center">
        <div>
          <Avatar
            name={user.fullName}
            size="xl"
            className="mx-auto border-4 border-white"
          />
          <h2 className="text-xl font-bold text-ink mt-3">{user.fullName}</h2>
          <p className="text-sm text-muted">{user.email}</p>
          <BadgeSm />
        </div>
      </Card>

      {/*
        Order count is real; post count is computed from the feed rather than
        hardcoded. "Saved" is omitted because bookmarking is not implemented --
        showing a permanent 0 there would claim a feature that does nothing.
        Both tiles navigate, since a number you cannot act on is decoration.
        The value stays neutral: orange is reserved for the primary action.
      */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatTile to="/customer/orders" value={myOrdersCount} label={myOrdersCount === 1 ? 'Order' : 'Orders'} />
        <StatTile to="/customer/community" value={myPostCount} label={myPostCount === 1 ? 'Post' : 'Posts'} />
      </div>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold text-ink">Account information</h3>
          {!editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Input label="Full Name" icon={User} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
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
            <InfoRow icon={<User className="w-4 h-4" />} label="Full Name" value={user.fullName} />
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Mobile" value={user.mobile} />
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={user.address || 'Not set'} />
          </div>
        )}
      </Card>

      {/*
        "My Orders" and "Marketplace" are the only customer destinations that
        exist as routes. The previous "Saved Posts" row pointed at
        /customer/marketplace, which is not a registered route, so it landed on
        the 404 page -- and a "Settings" row pointed at "#" and did nothing at
        all (there is no customer settings screen).
      */}
      <Card className="p-2 mb-4">
        <MenuItemLink icon={<ShoppingBag className="w-5 h-5" />} label="My orders" to="/customer/orders" />
        <MenuItemLink icon={<Heart className="w-5 h-5" />} label="Community marketplace" to="/customer/community" />
      </Card>

      <Button variant="outline" className="w-full text-danger border-danger/30 hover:bg-danger-soft" onClick={handleLogout}>
        <LogOut className="w-4 h-4" /> Log out
      </Button>
    </div>
  );
}

function StatTile({ to, value, label }) {
  return (
    <Link
      to={to}
className={`rounded-card ${CARD_FOCUS_RING}`}
    >
      <Card interactive className="p-4 text-center">
        <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
        <div className="text-xs text-muted mt-0.5">{label}</div>
      </Card>
    </Link>
  );
}

function MenuItemLink({ icon, label, to }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-3 min-h-11 rounded-control hover:bg-surface-sunken focus-visible:outline-2 -outline-offset-2 focus-visible:outline-brand-strong">
      <span className="text-muted" aria-hidden="true">{icon}</span>
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
      <ChevronRight className="w-4 h-4 text-subtle" aria-hidden="true" />
    </Link>
  );
}

function BadgeSm() {
  return (
    <span className="inline-block mt-1.5">
      <Badge color="orange">Customer</Badge>
    </span>
  );
}
