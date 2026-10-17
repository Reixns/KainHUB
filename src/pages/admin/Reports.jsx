import { AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, EmptyState } from '@/components/UI';

export default function AdminReports() {
  const { posts } = useApp();
  const reported = posts.filter((p) => p.reported);
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">Reports</h1>
      <p className="text-sm text-muted mb-4">User-reported posts and content.</p>
      {reported.length === 0 ? (
        <EmptyState title="No reports" description="No content has been reported by users." icon={AlertTriangle} />
      ) : (
        <div className="space-y-3">
          {reported.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-danger-soft flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.authorName}</span>
                    <Badge color={p.authorRole === 'admin' ? 'blue' : p.authorRole === 'vendor' ? 'green' : 'gray'}>{p.authorRole}</Badge>
                  </div>
                  <p className="text-sm text-ink mt-1">{p.content}</p>
                  <div className="text-xs text-danger mt-1">Reason: {p.reportReason}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
