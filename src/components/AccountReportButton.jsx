import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button, Modal } from '@/components/UI';

const REASONS = ['Spam', 'Scam', 'Inappropriate', 'Impersonation', 'Harassment', 'Other'];

export default function AccountReportButton({ accountId, accountType, accountName, className = '' }) {
  const { auth, reportAccount } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const viewerId = auth.user?.ownerId || auth.user?.id;

  if (!auth.user || !['customer', 'vendor'].includes(auth.role) || !accountId || String(viewerId) === String(accountId)) {
    return null;
  }

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      if (await reportAccount(accountId, accountType, reason)) {
        setOpen(false);
        setReason('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`border-brand-line text-brand-strong hover:bg-brand-soft ${className}`}
        onClick={() => setOpen(true)}
      >
        <Flag className="h-4 w-4" /> Report account
      </Button>
      <Modal
        open={open}
        onClose={() => {
          if (!submitting) setOpen(false);
        }}
        title={`Report ${accountType} account`}
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={!reason || submitting} loading={submitting}>Submit report</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-line bg-brand-soft/50 p-3.5">
            <p className="text-sm font-semibold text-ink">{accountName || 'This account'}</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Reports are reviewed by the admin team. Choose the reason that best describes your concern.
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-body">Reason for reporting</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {REASONS.map((option) => (
                <label
                  key={option}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                    reason === option
                      ? 'border-brand-line bg-brand-soft text-ink ring-1 ring-inset ring-brand-line'
                      : 'border-hairline bg-white text-body hover:border-brand-line hover:bg-brand-soft/40'
                  }`}
                >
                  <input
                    type="radio"
                    name={`account-report-reason-${accountType}`}
                    value={option}
                    checked={reason === option}
                    onChange={() => setReason(option)}
                    className="h-4 w-4 shrink-0 accent-violet-400"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs leading-5 text-muted">
            Please only report accounts that may have violated the community rules.
          </p>
        </div>
      </Modal>
    </>
  );
}
