import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, Eye, CheckCircle, XCircle, Ban, Play, ChevronRight, Store, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input, Badge, StatusBadge, Tabs, EmptyState, formatPeso, formatDateTime, Modal, LogoMark, formatQueue } from '@/components/UI';

export default function AdminVendors() {
  const { vendors, orders, approveVendor, rejectVendor, suspendVendor, activateVendor, deleteVendorAccount } = useApp();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [actionVendor, setActionVendor] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const tabs = [
    { id: 'all', label: 'All', count: vendors.length },
    { id: 'approved', label: 'Approved', count: vendors.filter((v) => v.status === 'approved').length },
    { id: 'pending', label: 'Pending', count: vendors.filter((v) => v.status === 'pending').length },
    { id: 'suspended', label: 'Suspended', count: vendors.filter((v) => v.status === 'suspended').length },
    { id: 'rejected', label: 'Rejected', count: vendors.filter((v) => v.status === 'rejected').length },
  ];

  const filtered = vendors
    .filter((v) => tab === 'all' || v.status === tab)
    .filter((v) => `${v.name || ''} ${v.ownerName || ''} ${v.category || ''}`.toLowerCase().includes(search.toLowerCase()))
    // The previous comparator took only `a` and returned -1 or 1, so it never
    // actually compared two vendors. Pending applications now reliably sort
    // to the top, with the rest alphabetical.
    .sort((a, b) => {
      const rank = (v) => (v.status === 'pending' ? 0 : 1);
      return rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || ''));
    });

  const ACTIONS = {
    approve: { title: 'Approve vendor', verb: 'approve', variant: 'success' },
    reject: { title: 'Reject vendor', verb: 'reject', variant: 'danger' },
    suspend: { title: 'Suspend vendor', verb: 'suspend', variant: 'danger' },
    activate: { title: 'Reactivate vendor', verb: 'reactivate', variant: 'success' },
  };
  const action = ACTIONS[actionType] || ACTIONS.approve;

  const executeAction = async () => {
    if (!actionVendor || !actionType || deleting) return;
    if (actionType === 'approve') await approveVendor(actionVendor.id);
    if (actionType === 'reject') await rejectVendor(actionVendor.id);
    if (actionType === 'suspend') await suspendVendor(actionVendor.id);
    if (actionType === 'activate') await activateVendor(actionVendor.id);
    if (actionType === 'delete') {
      setDeleting(true);
      try {
        if (!await deleteVendorAccount(actionVendor.id)) return;
      } finally {
        setDeleting(false);
      }
    }
    setActionVendor(null);
    setActionType(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">Vendors</h1>

      <div className="mb-4">
        <Input icon={Search} placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title={search ? 'No vendors match your search' : tab === 'all' ? 'No vendors yet' : `No ${tab} vendors`}
            description={search ? 'Try a different name, owner, or category.' : 'Vendors appear here once they apply to join.'}
          />
        ) : (
          filtered.map((v) => {
            const vendorOrders = orders.filter((o) => o.vendorId === v.id);
            const vendorSales = vendorOrders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + (o.total || 0), 0);
            return (
              <Card key={v.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <LogoMark name={v.name} logo={v.logo} size="md" tone="gray" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-ink">{v.name}</h3>
                        <Badge color={
                          v.status === 'approved' ? 'green' :
                          v.status === 'pending' ? 'yellow' :
                          v.status === 'suspended' ? 'red' : 'gray'
                        }>{v.status.toUpperCase()}</Badge>
                      </div>
                      <div className="text-xs text-muted mt-0.5">{v.ownerName} · {v.category}</div>
                      <div className="text-xs text-muted">{v.email} · {vendorOrders.length} orders · {formatPeso(vendorSales)}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button as={Link} to={`/admin/vendors/${v.id}`} size="sm" variant="outline"><Eye className="w-4 h-4" /> View</Button>
                    {v.status === 'pending' && (
                      <>
                        <Button size="sm" variant="success" onClick={() => { setActionVendor(v); setActionType('approve'); }}>
                          <CheckCircle className="w-4 h-4" /> Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => { setActionVendor(v); setActionType('reject'); }}>
                          <XCircle className="w-4 h-4" /> Reject
                        </Button>
                      </>
                    )}
                    {v.status === 'approved' && (
                      <Button size="sm" variant="danger" onClick={() => { setActionVendor(v); setActionType('suspend'); }}>
                        <Ban className="w-4 h-4" /> Suspend
                      </Button>
                    )}
                    {v.status === 'suspended' && (
                      <Button size="sm" variant="success" onClick={() => { setActionVendor(v); setActionType('activate'); }}>
                        <Play className="w-4 h-4" /> Activate
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => { setActionVendor(v); setActionType('delete'); }}>
                      <Trash2 className="w-4 h-4" /> Delete account
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal open={!!actionVendor} onClose={() => { if (!deleting) { setActionVendor(null); setActionType(null); } }} title={actionType === 'delete' ? 'Delete vendor account' : action.title} size="sm"
        footer={
          <>
            <Button variant="ghost" disabled={deleting} onClick={() => { setActionVendor(null); setActionType(null); }}>Cancel</Button>
            <Button variant={actionType === 'delete' ? 'danger' : action.variant} loading={deleting} onClick={executeAction}>
              {actionType === 'approve' && <CheckCircle className="w-4 h-4" />}
              {actionType === 'activate' && <Play className="w-4 h-4" />}
              {actionType === 'reject' && <XCircle className="w-4 h-4" />}
              {actionType === 'suspend' && <Ban className="w-4 h-4" />}
              {actionType === 'delete' ? 'Permanently delete' : `Yes, ${action.verb}`}
            </Button>
          </>
        }
      >
        {actionVendor && (
          actionType === 'delete' ? (
            <p className="text-sm text-muted">
              Permanently delete vendor <strong className="text-ink">{actionVendor.name}</strong>?
              Their account, shop, menu, orders, posts, and related records will be deleted. This cannot be undone.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Are you sure you want to <strong className={action.variant === 'success' ? 'text-success' : 'text-danger'}>{action.verb}</strong> vendor <strong className="text-ink">{actionVendor.name}</strong>?
              {actionType === 'suspend' && ' Suspended vendors are hidden from customers but keep their data.'}
              {actionType === 'reject' && ' The applicant can reapply later.'}
            </p>
          )
        )}
      </Modal>
    </div>
  );
}

export function AdminVendorDetail() {
  const { vendorId } = useParams();
  const { vendors, orders, approveVendor, rejectVendor, suspendVendor, activateVendor } = useApp();
  const vendor = vendors.find((v) => String(v.id) === String(vendorId));

  if (!vendor) return <EmptyState icon={Store} title="Vendor not found" description="This vendor may have been removed." />;

  const vendorOrders = orders.filter((o) => o.vendorId === vendor.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const completed = vendorOrders.filter((o) => o.status === 'COMPLETED');
  const totalSales = completed.reduce((s, o) => s + (o.total || 0), 0);
  // Admin vendor rows can arrive without an embedded menu, so this used to throw.
  const menuCount = vendor.menu?.length ?? 0;

  return (
    <div>
      <Link to="/admin/vendors" className="inline-flex items-center gap-1 text-sm font-medium text-info hover:underline mb-4">
        <ChevronRight className="w-4 h-4 rotate-180" aria-hidden="true" /> Back to vendors
      </Link>

      <Card className="p-6 mb-4">
        <div className="flex items-start gap-4 flex-wrap">
          <LogoMark name={vendor.name} logo={vendor.logo} size="xl" tone="gray" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-ink">{vendor.name}</h1>
              <Badge color={
                vendor.status === 'approved' ? 'green' :
                vendor.status === 'pending' ? 'yellow' : 'red'
              }>{vendor.status.toUpperCase()}</Badge>
            </div>
            <p className="text-sm text-muted mt-1">{vendor.description || 'No description'}</p>
            <div className="grid sm:grid-cols-2 gap-2 mt-4 text-sm">
              <div><span className="text-muted">Owner:</span> {vendor.ownerName}</div>
              <div><span className="text-muted">Email:</span> {vendor.email}</div>
              <div><span className="text-muted">Mobile:</span> {vendor.mobile}</div>
              <div><span className="text-muted">Category:</span> {vendor.category}</div>
              <div className="sm:col-span-2"><span className="text-muted">Address:</span> {vendor.address}</div>
              <div><span className="text-muted">Hours:</span> {vendor.operatingHours}</div>
              <div><span className="text-muted">Delivery:</span> {vendor.deliveryAvailable ? 'Available' : 'Pick-up only'}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {vendor.status === 'pending' && (
            <>
              <Button variant="success" onClick={() => approveVendor(vendor.id)}><CheckCircle className="w-4 h-4" /> Approve</Button>
              <Button variant="danger" onClick={() => rejectVendor(vendor.id)}><XCircle className="w-4 h-4" /> Reject</Button>
            </>
          )}
          {vendor.status === 'approved' && (
            <Button variant="danger" onClick={() => suspendVendor(vendor.id)}><Ban className="w-4 h-4" /> Suspend</Button>
          )}
          {vendor.status === 'suspended' && (
            <Button variant="success" onClick={() => activateVendor(vendor.id)}><Play className="w-4 h-4" /> Activate</Button>
          )}
        </div>
      </Card>

      {/* Stacks on phones: three tiles side by side left each card only ~72px of
          content width, which could not fit a peso amount at text-2xl. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-ink tabular-nums">{vendorOrders.length}</div>
          <div className="text-xs text-muted">Total Orders</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-ink tabular-nums break-words">{formatPeso(totalSales)}</div>
          <div className="text-xs text-muted">Total Sales</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-ink tabular-nums">{menuCount}</div>
          <div className="text-xs text-muted">Menu Items</div>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Recent Orders</h2>
        {vendorOrders.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No orders yet.</p>
        ) : (
          <div className="space-y-2">
            {vendorOrders.slice(0, 10).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 p-3 bg-surface-sunken rounded-control text-sm">
                <div className="min-w-0">
                  <div className="font-medium">PILA {formatQueue(o.queueNumber)}</div>
                  <div className="text-xs text-muted truncate">{o.customerName} · {formatDateTime(o.createdAt)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums">{formatPeso(o.total)}</div>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
