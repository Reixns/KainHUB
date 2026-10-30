import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Store, User } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import AccountReportButton from '@/components/AccountReportButton';
import { Card, EmptyState, formatPeso, getProductImage, LogoMark } from '@/components/UI';

function portalBase(role) {
  if (role === 'admin') return '/admin';
  if (role === 'vendor') return '/vendor';
  return '/customer';
}

function shopPath(role, vendorId) {
  if (role === 'admin') return `/admin/vendors/${vendorId}`;
  if (role === 'vendor') return '/vendor/marketplace';
  return `/customer/shops/${vendorId}`;
}

export function PublicProfileRedirect() {
  const { auth, authReady } = useApp();
  const { profileType, profileId } = useParams();
  if (!authReady) return null;
  if (!auth.user || !auth.role) return <Navigate to="/" replace />;
  return <Navigate to={`${portalBase(auth.role)}/profile/${profileType}/${profileId}`} replace />;
}

export default function PublicProfile() {
  const { profileType, profileId } = useParams();
  const { auth, vendors, customers, posts } = useApp();
  const profile = profileType === 'vendor'
    ? vendors.find((vendor) => String(vendor.id) === String(profileId))
    : customers.find((customer) => String(customer.id) === String(profileId));

  if (!profile) return <EmptyState title="Profile not found" description="This profile may no longer be available." />;

  if (profileType === 'vendor') {
    if (auth.role === 'customer') {
      return <Navigate to={`/customer/shops/${profile.id}`} replace />;
    }
    return <VendorPublicProfile vendor={profile} role={auth.role} />;
  }

  const customerPosts = posts.filter((post) => post.authorRole === 'customer' && post.authorId === profile.id);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <BackLink role={auth.role} profileType="customer" />
      <Card className="overflow-hidden p-0 text-center">
        <div className="p-5 sm:p-7">
          <div className="w-24 h-24 rounded-full bg-brand-muted mx-auto flex items-center justify-center text-5xl">
            {(profile.fullName || '?').slice(0, 1).toUpperCase()}
          </div>
          <h1 className="text-xl font-bold text-ink mt-3 break-words">{profile.fullName}</h1>
          <p className="text-sm text-muted flex items-center justify-center gap-1 mt-1">
            <User className="w-4 h-4" /> Community member
          </p>
          {profile.address && (
            <p className="text-sm text-muted flex items-center justify-center gap-1 mt-2 break-words">
              <MapPin className="w-4 h-4 shrink-0" /> {profile.address}
            </p>
          )}
        </div>
        <div className="border-t border-hairline bg-surface-sunken/50 px-4 py-3">
          <AccountReportButton
            accountId={profile.id}
            accountType="customer"
            accountName={profile.fullName}
            className="w-full sm:w-auto"
          />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-ink mb-3">Community Activity</h2>
        <div className="text-center py-4">
          <div className="text-2xl font-bold text-brand-strong">{customerPosts.length}</div>
          <div className="text-xs text-muted">Posts</div>
        </div>
      </Card>
    </div>
  );
}

function VendorPublicProfile({ vendor, role }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <BackLink role={role} profileType="vendor" />
      <Card className="overflow-hidden">
        {/*
          The cover banner is gone, and with it the `-mt-10` pull that used to
          overlap the logo onto it. Without a banner to overlap, the logo starts
          the card directly, so it reads as the shop's face instead of a badge
          hanging off a photo.

          Also replaces a raw `<img>` plus `{vendor.logo}` in the else, which had
          no fallback either way: a dead URL painted the browser's broken-image
          glyph, and a missing logo rendered an empty white square.
        */}
        <div className="p-4">
          <LogoMark name={vendor.name} logo={vendor.logo} size="xl" className="border-4 border-white" />
          <div className="flex items-start justify-between gap-3 mt-3">
            <div>
              <h1 className="text-xl font-bold text-ink">{vendor.name}</h1>
              <p className="text-sm text-muted">Owned by {vendor.ownerName}</p>
            </div>
            <span className="text-xs font-medium text-success bg-success-soft px-2 py-1 rounded-full">VERIFIED VENDOR</span>
          </div>
          <AccountReportButton
            accountId={vendor.ownerId || vendor.id}
            accountType="vendor"
            accountName={vendor.name}
          />
          <div className="flex items-center gap-3 text-sm text-body mt-3 flex-wrap">
            <span className="flex items-center gap-1"><Star className="w-4 h-4 text-rating fill-rating" /> {Number(vendor.rating || 0).toFixed(1)}</span>
            <span className="flex items-center gap-1"><Store className="w-4 h-4" /> {vendor.category}</span>
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {vendor.address}</span>
          </div>
          {vendor.description && <p className="text-sm text-body mt-3">{vendor.description}</p>}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink">Menu</h2>
          <Link to={shopPath(role, vendor.id)} className="text-sm text-brand-strong font-medium">View shop</Link>
        </div>
        {(vendor.menu || []).length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No menu items yet.</p>
        ) : (
          <div className="space-y-2">
            {(vendor.menu || []).map((item) => (
              <Link key={item.id} to={shopPath(role, vendor.id)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-sunken border border-hairline">
                <div className="w-11 h-11 rounded-lg bg-brand-soft flex items-center justify-center text-2xl overflow-hidden relative">
                  {getProductImage(item.image) && <img src={getProductImage(item.image)} alt={item.name} className="relative z-10 w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink truncate">{item.name}</div>
                  <div className="text-xs text-muted truncate">{item.description}</div>
                </div>
                <div className="text-sm font-semibold text-brand-strong">{formatPeso(item.price)}</div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function BackLink({ role, profileType }) {
  let path = '/customer/community';
  if (role === 'admin') path = profileType === 'vendor' ? '/admin/vendors' : '/admin/customers';
  else if (role === 'vendor') path = '/vendor/marketplace';
  return (
    <Link to={path} className="inline-flex items-center gap-1 text-sm text-body hover:text-brand-strong">
      <ArrowLeft className="w-4 h-4" /> Back
    </Link>
  );
}