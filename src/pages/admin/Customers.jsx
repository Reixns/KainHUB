import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Search, Ban, Play, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input, Badge, EmptyState, StatusBadge, Avatar, isEmojiSource, isImageSource, formatPeso, Tabs, LogoMark, Modal } from '@/components/UI';

export default function AdminCustomers() {
  const { customers, orders, suspendCustomer, activateCustomer, deleteCustomerAccount } = useApp();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!customerToDelete || deleting) return;
    setDeleting(true);
    try {
      if (await deleteCustomerAccount(customerToDelete.id)) setCustomerToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const tabs = [
    { id: 'all', label: 'All', count: customers.length },
    { id: 'active', label: 'Active', count: customers.filter((c) => c.status === 'active').length },
    { id: 'suspended', label: 'Suspended', count: customers.filter((c) => c.status === 'suspended').length },
  ];

  const filtered = customers
    .filter((c) => tab === 'all' || c.status === tab)
    .filter((c) => (
      String(c.fullName || '').toLowerCase().includes(search.toLowerCase())
      || String(c.email || '').toLowerCase().includes(search.toLowerCase())
    ));

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">Customers</h1>
      <div className="mb-4">
        <Input icon={Search} placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? <EmptyState title="No customers" /> : filtered.map((c) => {
          const custOrders = orders.filter((o) => String(o.customerId) === String(c.id));
          const totalSpent = custOrders.filter((o) => o.status === 'COMPLETED').reduce((s, o) => s + o.total, 0);
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar name={c.fullName} emoji={isEmojiSource(c.avatar) ? c.avatar : undefined} src={isImageSource(c.avatar) ? c.avatar : undefined} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink">{c.fullName}</h3>
                      <Badge color={c.status === 'active' ? 'green' : 'red'}>{c.status}</Badge>
                    </div>
                    <div className="text-xs text-muted">{c.email} · {c.mobile}</div>
                    <div className="text-xs text-muted">{custOrders.length} orders · {formatPeso(totalSpent)} spent</div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {c.status === 'active' ? (
                    <Button size="sm" variant="danger" onClick={() => suspendCustomer(c.id)}><Ban className="w-4 h-4" /> Suspend</Button>
                  ) : (
                    <Button size="sm" variant="success" onClick={() => activateCustomer(c.id)}><Play className="w-4 h-4" /> Activate</Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => setCustomerToDelete(c)}><Trash2 className="w-4 h-4" /> Delete account</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal
        open={!!customerToDelete}
        onClose={() => { if (!deleting) setCustomerToDelete(null); }}
        title="Delete customer account"
        size="sm"
        footer={(
          <>
            <Button variant="ghost" disabled={deleting} onClick={() => setCustomerToDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Permanently delete</Button>
          </>
        )}
      >
        {customerToDelete && (
          <p className="text-sm text-muted">
            Permanently delete <strong className="text-ink">{customerToDelete.fullName || customerToDelete.email}</strong>?
            Their account, orders, posts, and related records will be deleted. This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}

export function AdminCustomerDetail() {
  const { customerId } = useParams();
  const { customers, orders, vendors } = useApp();
  const customer = customers.find((c) => String(c.id) === String(customerId));
  if (!customer) return <EmptyState title="Customer not found" />;
  const custOrders = orders.filter((o) => o.customerId === customer.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div>
      <Link to="/admin/customers" className="text-sm text-brand-strong mb-4 inline-block">← Back to customers</Link>
      <Card className="p-6 mb-4">
        <div className="flex items-center gap-4">
          <Avatar name={customer.fullName} emoji={isEmojiSource(customer.avatar) ? customer.avatar : undefined} src={isImageSource(customer.avatar) ? customer.avatar : undefined} size="xl" />
          <div>
            <h1 className="text-2xl font-bold">{customer.fullName}</h1>
            <p className="text-sm text-muted">{customer.email}</p>
            <p className="text-sm text-muted">{customer.mobile}</p>
            <p className="text-sm text-muted">{customer.address}</p>
            <Badge color={customer.status === 'active' ? 'green' : 'red'}>{customer.status}</Badge>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Order History ({custOrders.length})</h2>
        {custOrders.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No orders.</p>
        ) : (
          <div className="space-y-2">
            {custOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-2 bg-surface-sunken rounded-lg text-sm">
                <div>
                  <div className="font-medium">{o.id}</div>
                  <div className="flex items-center gap-1.5">
                    <LogoMark name={o.vendorName} logo={vendors.find((v) => String(v.id) === String(o.vendorId))?.logo} size="xs" />
                    <div className="text-xs text-muted">{o.vendorName}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatPeso(o.total)}</div>
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
