import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Mail, Phone, Settings as SettingsIcon, ShieldCheck, User, UserRound } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Card, PageHeader } from '@/components/UI';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import LoginSessionsCard from '@/components/LoginSessionsCard';
import { InfoRow } from '@/components/ProfileParts';

export default function CustomerSettings() {
  const { auth, logout } = useApp();
  const navigate = useNavigate();
  const user = auth.user;
  const [activeTab, setActiveTab] = useState('profile');

  const handleLogout = () => {
    logout();
    navigate('/customer/login');
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow="Account"
        icon={SettingsIcon}
        title="Settings"
        description="Manage your account details, password, and session."
      />

      <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-hairline bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'profile' ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-surface-sunken hover:text-ink'
          }`}
        >
          <UserRound className="h-4 w-4" />
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
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-hairline bg-white text-muted">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-ink">Account details</h2>
              <p className="mt-0.5 text-sm text-muted">Your contact information used for orders and updates.</p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<User className="h-4 w-4" />} label="Full name" value={user.fullName} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Mobile" value={user.mobile} />
            </div>
            <div className="flex justify-end border-t border-hairline pt-4">
              <Button as={Link} to="/customer/profile" variant="outline" size="sm">
                Edit profile
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'security' && (
        <>
          <LoginSessionsCard role="customer" />
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
          <ChangePasswordCard role="customer" />
        </>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b border-hairline bg-surface-sunken px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-hairline bg-white text-muted">
            <SettingsIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Session</h2>
            <p className="mt-0.5 text-sm text-muted">Sign out when using a shared or public device.</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-body">You are signed in as <span className="font-medium text-ink">{user.email}</span>.</p>
          <Button variant="outline" className="shrink-0 text-danger border-danger/30 hover:bg-danger-soft" onClick={handleLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </Card>
      </div>
    </div>
  );
}
