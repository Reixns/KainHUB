import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Modal, PlatformLogo } from '@/components/UI';

export default function AdminSettings() {
  const { platformSettings, resetData } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');

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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">System Settings</h1>
        <p className="text-sm text-muted">Platform-wide configuration.</p>
      </div>
      <Card className="p-5">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> Platform Information</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl bg-brand-muted flex items-center justify-center overflow-hidden text-xl">
              <PlatformLogo src={platformSettings.logo} alt="App logo" />
            </span>
            <p className="text-sm text-muted">Brand logo is bundled with the app from the project’s <code>public</code> folder.</p>
          </div>
          <div><span className="text-muted">Platform Name:</span> KainHUB</div>
          <div><span className="text-muted">Location:</span> Lancaster</div>
          <div><span className="text-muted">Version:</span> 1.0.0 (Prototype)</div>
        </div>
      </Card>
      <Card className="p-5 border-danger/30 bg-danger-soft">
        <h2 className="font-semibold mb-3 text-danger">Danger Zone</h2>
        <p className="text-sm text-body mb-3">Permanently delete non-admin accounts, all platform records, and uploaded marketplace media from the database. Admin accounts are kept.</p>
        <Button variant="danger" onClick={() => { setResetError(''); setConfirmReset(true); }}>Reset All Data</Button>
      </Card>
      <Modal
        open={confirmReset}
        onClose={() => { if (!resetting) setConfirmReset(false); }}
        title="Reset all data?"
        size="sm"
        footer={(
          <>
            <Button variant="ghost" disabled={resetting} onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" loading={resetting} onClick={handleReset}>Reset Everything</Button>
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
