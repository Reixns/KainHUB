import { useState, useMemo } from 'react';
import { Search, Eye, Store, Truck } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, StatusBadge, formatPeso, formatDateTime, Input, Modal, Tabs, formatQueue, LogoMark } from '@/components/UI';

export default function AdminOrders() {
  const { orders, vendors } = useApp();
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [viewOrder, setViewOrder] = useState(null);

  const allStatuses = ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY', 'COMPLETED', 'REJECTED', 'CANCELLED'];

  const filtered = useMemo(() => {
    return orders
      .filter((o) => vendorFilter === 'all' || o.vendorId === Number(vendorFilter))
      .filter((o) => statusFilter === 'all' || o.status === statusFilter)
      .filter((o) => fulfillmentFilter === 'all' || o.fulfillment === fulfillmentFilter)
      .filter((o) =>
        !search ||
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        (o.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.vendorName || '').toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, search, vendorFilter, statusFilter, fulfillmentFilter]);

  const tabList = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled/Rejected' },
  ];
  const [tab, setTab] = useState('all');

  const displayed = filtered.filter((o) => {
    if (tab === 'all') return true;
    if (tab === 'active') return ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY'].includes(o.status);
    if (tab === 'completed') return o.status === 'COMPLETED';
    if (tab === 'cancelled') return ['REJECTED', 'CANCELLED'].includes(o.status);
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">All Orders</h1>
      <div className="mb-4"><Input icon={Search} placeholder="Search orders, customers, vendors..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>

      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="px-3 py-2 border border-hairline-strong rounded-lg text-sm bg-white">
          <option value="all">All Vendors</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-hairline-strong rounded-lg text-sm bg-white">
          <option value="all">All Statuses</option>
          {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fulfillmentFilter} onChange={(e) => setFulfillmentFilter(e.target.value)} className="px-3 py-2 border border-hairline-strong rounded-lg text-sm bg-white">
          <option value="all">All Fulfillment</option>
          <option value="DELIVERY">Delivery</option>
          <option value="PICKUP">Pickup</option>
        </select>
      </div>

      <Tabs tabs={tabList} activeTab={tab} onChange={setTab} />

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Order ID</th>
                <th className="px-3 py-2">Queue</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Fulfillment</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-muted">No orders match your filters.</td></tr>
              ) : displayed.map((o) => (
                <tr key={o.id} className="border-t border-hairline hover:bg-surface-sunken">
                  <td className="px-3 py-2 font-medium">{o.id}</td>
                  <td className="px-3 py-2"><Badge color="orange">{formatQueue(o.queueNumber)}</Badge></td>
                  <td className="px-3 py-2">{o.customerName}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <LogoMark name={o.vendorName} logo={vendors.find((v) => String(v.id) === String(o.vendorId))?.logo} size="xs" />
                      <span className="truncate">{o.vendorName}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold">{formatPeso(o.total)}</td>
                  <td className="px-3 py-2 text-xs">{o.paymentMethod}</td>
                  <td className="px-3 py-2 text-xs">
                    {/* Matches customer/Orders.jsx, which renders the same two
                        values with lucide icons. Emoji here made the admin table
                        and the customer list look like different products. */}
                    <span className="flex items-center gap-1">
                      {o.fulfillment === 'DELIVERY'
                        ? <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        : <Store className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                      {o.fulfillment === 'DELIVERY' ? 'Delivery' : 'Pickup'}
                    </span>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2 text-xs text-muted">{formatDateTime(o.createdAt)}</td>
                  {/* Was a 28px icon-only button with no accessible name. */}
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setViewOrder(o)} aria-label={`View order ${o.id}`} className="p-2 min-w-11 min-h-11 inline-flex items-center justify-center hover:bg-surface-hover rounded-control"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {viewOrder && (
        <Modal open={true} onClose={() => setViewOrder(null)} title={`Order ${viewOrder.id}`} size="lg">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color="orange">PILA {formatQueue(viewOrder.queueNumber)}</Badge>
              <StatusBadge status={viewOrder.status} />
              <Badge color={viewOrder.fulfillment === 'DELIVERY' ? 'purple' : 'blue'}>{viewOrder.fulfillment}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">Customer:</span> {viewOrder.customerName}</div>
              <div><span className="text-muted">Mobile:</span> {viewOrder.customerMobile}</div>
              <div className="flex items-center gap-1.5">
                <span className="text-muted">Vendor:</span>
                <LogoMark name={viewOrder.vendorName} logo={vendors.find((v) => String(v.id) === String(viewOrder.vendorId))?.logo} size="xs" />
                <span className="truncate">{viewOrder.vendorName}</span>
              </div>
              <div><span className="text-muted">Payment:</span> {viewOrder.paymentMethod} ({viewOrder.paymentStatus})</div>
            </div>
            {viewOrder.fulfillment === 'DELIVERY' && <div className="text-sm"><span className="text-muted">Address:</span> {viewOrder.customerAddress}</div>}
            <div>
              <h4 className="font-medium text-sm mb-2">Items</h4>
              <div className="space-y-1 bg-surface-sunken rounded-lg p-3">
                {viewOrder.items.map((i, idx) => (
                  <div key={idx} className="text-sm flex justify-between">
                    <span>{i.quantity}× {i.name}</span>
                    <span>{formatPeso(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t pt-2 space-y-1 text-sm">

              <div className="flex justify-between font-bold"><span>Total</span><span className="text-brand-strong">{formatPeso(viewOrder.total)}</span></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
