import { AlertTriangle, Check, Eye, EyeOff, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Button, Card, Badge, EmptyState } from '@/components/UI';

export default function AdminReports() {
  const { posts, customers, vendors, accountReports, resolvePostReport, resolveAccountReport, toggleHidePost } = useApp();
  const reported = posts
    .filter((post) => post.reported)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const reportedAccounts = accountReports
    .filter((report) => report.status === 'open')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const openCount = reported.length + reportedAccounts.length;

  const accountName = (report) => {
    if (report.accountType === 'vendor') {
      const vendor = vendors.find((item) => (
        String(item.ownerId) === String(report.accountId) || String(item.id) === String(report.accountId)
      ));
      return vendor ? vendor.name : 'Deleted vendor account';
    }
    return customers.find((item) => String(item.id) === String(report.accountId))?.fullName || 'Deleted customer account';
  };
  const reporterName = (report) => (
    customers.find((item) => String(item.id) === String(report.reporterId))?.fullName
    || vendors.find((item) => (
      String(item.ownerId) === String(report.reporterId) || String(item.id) === String(report.reporterId)
    ))?.ownerName
    || 'Deleted account'
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Moderation queue
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">Review reported Marketplace posts and customer/vendor accounts.</p>
        </div>
        <div className="rounded-xl border border-hairline bg-white px-4 py-3 text-right shadow-card">
          <div className="text-2xl font-bold leading-none tabular-nums text-ink">{openCount}</div>
          <div className="mt-1 text-xs text-muted">open reports</div>
        </div>
      </header>

      {openCount === 0 ? (
        <Card className="p-6 sm:p-8">
          <EmptyState title="No open reports" description="New Marketplace and account reports will appear here for review." icon={AlertTriangle} />
          <div className="mt-4 text-center">
            <Link to="/admin/marketplace" className="text-sm font-semibold text-brand-strong hover:text-brand-deep">
              Back to Marketplace
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {reportedAccounts.map((report) => (
            <Card key={`account-report-${report.id}`} className="overflow-hidden">
              <div className="border-b border-brand-line bg-brand-soft/50 px-4 py-2.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Account report: {report.reason || 'Other'}
                  </div>
                  <Badge color={report.accountType === 'vendor' ? 'green' : 'blue'}>
                    {report.accountType}
                  </Badge>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="space-y-1 text-sm">
                  <p className="text-ink"><span className="font-semibold">Reported account:</span> {accountName(report)}</p>
                  <p className="text-muted"><span className="font-semibold">Reported by:</span> {reporterName(report)}</p>
                  <p className="text-xs text-muted">
                    Submitted {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'at an unknown time'}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
                  <Button size="sm" onClick={() => resolveAccountReport(report)}>
                    <Check className="h-4 w-4" /> Resolve report
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {reported.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="border-b border-brand-line bg-brand-soft/50 px-4 py-2.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-strong">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Reported for {p.reportReason || 'Other'}
                  </div>
                  {p.hidden && <Badge color="red">Hidden from feed</Badge>}
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{p.authorName || 'Unknown author'}</span>
                  <Badge color={p.authorRole === 'admin' ? 'blue' : p.authorRole === 'vendor' ? 'green' : 'gray'}>
                    {p.authorRole || 'account'}
                  </Badge>
                  <span className="text-xs text-muted">
                    Posted {p.createdAt ? new Date(p.createdAt).toLocaleString() : 'at an unknown time'}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-body">
                  {p.content || 'This post has no text.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleHidePost(p, !p.hidden)}
                  >
                    {p.hidden
                      ? <><Eye className="h-4 w-4" /> Restore post</>
                      : <><EyeOff className="h-4 w-4" /> Hide post</>}
                  </Button>
                  <Button size="sm" onClick={() => resolvePostReport(p)}>
                    <Check className="h-4 w-4" /> Resolve report
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
