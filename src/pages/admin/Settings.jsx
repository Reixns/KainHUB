import { useState } from 'react';
import { AlertTriangle, Settings as SettingsIcon, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Modal, PlatformLogo } from '@/components/UI';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import LoginSessionsCard from '@/components/LoginSessionsCard';

export default function AdminSettings() {
  const { platformSettings, resetData } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [activeTab, setActiveTab] = useState('platform');

  const handleReset = async () => {
    if (resetting) return;
    setResetting(true);
    setResetError('');
    try {
      const result = await resetData();
      if (!result.success) setResetError(result.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">System Settings</h1>
        <p className="mt-1 text-sm text-muted">Platform information, account security, and maintenance.</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-hairline bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('platform')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === 'platform' ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-surface-sunken hover:text-ink'
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          Platform
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

      {activeTab === 'platform' && (
        <Card className="overflow-hidden p-0">
        <div className="flex items-start gap-3 border-b border-hairline bg-surface-sunken px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-hairline bg-white text-muted">
            <SettingsIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Platform information</h2>
            <p className="mt-0.5 text-sm text-muted">Read-only details about this deployment.</p>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 border-b border-hairline pb-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-control border border-hairline bg-brand-muted text-xl">
              <PlatformLogo src={platformSettings.logo} alt="KainHUB logo" />
            </span>
            <div>
              <div className="font-semibold text-ink">KainHUB</div>
              <p className="mt-0.5 text-xs text-muted">Brand logo is bundled with the app from the public folder.</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Platform name</dt>
              <dd className="mt-1 text-sm font-medium text-ink">KainHUB</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Location</dt>
              <dd className="mt-1 text-sm font-medium text-ink">Lancaster</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Version</dt>
              <dd className="mt-1 text-sm font-medium text-ink">1.0.0</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Environment</dt>
              <dd className="mt-1 text-sm font-medium text-ink">Prototype</dd>
            </div>
          </dl>
        </div>
      </Card>
      )}

      {activeTab === 'security' && (
        <>
          <LoginSessionsCard role="admin" />
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
          <ChangePasswordCard role="admin" />
        </>
      )}

      <Card className="overflow-hidden border-danger/30 p-0">
        <div className="flex items-start gap-3 border-b border-danger/20 bg-danger-soft px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-danger/20 bg-white text-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-danger">Danger zone</h2>
            <p className="mt-0.5 text-sm text-body">Irreversible maintenance actions for this platform.</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <p className="text-sm text-body">
              Delete non-admin accounts, platform records, and uploaded media. Admin accounts are kept.
            </p>
          </div>
          <Button
            variant="danger"
            className="shrink-0"
            onClick={() => { setResetError(''); setConfirmReset(true); }}
          >
            Reset all data
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmReset}
        onClose={() => { if (!resetting) setConfirmReset(false); }}
        title="Reset all data?"
        size="sm"
        footer={(
          <>
            <Button variant="ghost" disabled={resetting} onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" loading={resetting} onClick={handleReset}>Reset everything</Button>
          </>
        )}
      >
        <p className="text-body text-sm">
          This permanently deletes all non-admin accounts, platform records, and uploaded marketplace media from the database. Admin accounts will remain. This cannot be undone.
        </p>
        {resetError && (
          <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
            {resetError}
          </p>
        )}
      </Modal>
    </div>
  );
}
