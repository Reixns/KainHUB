import { useState } from 'react';
import { Package, AlertTriangle, Plus, Minus, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Badge, formatPeso, EmptyState, getProductImage } from '@/components/UI';

export default function VendorInventory() {
  const { auth, updateStock, updateVendorMenu } = useApp();
  const vendorId = auth.user.id;
  const menu = auth.user.menu || [];
  const [editStock, setEditStock] = useState({});

  const lowStockItems = menu.filter((m) => m.available && m.stock > 0 && m.stock < 6);
  const oosItems = menu.filter((m) => !m.available || m.stock === 0);

  const handleStockChange = (itemId, value) => {
    const n = Math.max(0, Number(value) || 0);
    setEditStock((p) => ({ ...p, [itemId]: n }));
  };

  const saveStock = (itemId) => {
    // `.find(...)` returned no match for a stale itemId, and reading `.stock`
    // off undefined threw while saving stock.
    const existing = editStock[itemId] !== undefined ? editStock[itemId] : menu.find((m) => m.id === itemId)?.stock;
    if (existing === undefined || existing === null) return;
    updateStock(vendorId, itemId, existing);
    setEditStock((p) => {
      const n = { ...p };
      delete n[itemId];
      return n;
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-2">Inventory</h1>
      <p className="text-sm text-muted mb-6">Manage stock levels for your menu items.</p>

      {lowStockItems.length > 0 && (
        <div className="bg-warning-soft border border-warning/30 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-warning text-sm">{lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} running low on stock</div>
            <div className="text-xs text-warning mt-0.5">{lowStockItems.map((i) => i.name).join(', ')}</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cat-blue/10 rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-brand-strong" /></div>
            <div>
              <div className="text-2xl font-bold">{menu.filter((m) => m.available).length}</div>
              <div className="text-xs text-muted">In Stock</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-soft rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-warning" /></div>
            <div>
              <div className="text-2xl font-bold">{lowStockItems.length}</div>
              <div className="text-xs text-muted">Low Stock</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger-soft rounded-lg flex items-center justify-center"><Package className="w-5 h-5 text-danger" /></div>
            <div>
              <div className="text-2xl font-bold">{oosItems.length}</div>
              <div className="text-xs text-muted">Out of Stock</div>
            </div>
          </div>
        </Card>
      </div>

      {menu.length === 0 ? (
        <EmptyState title="No inventory" description="Add menu items first." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken text-left">
                <tr>
                  <th className="px-4 py-2 font-medium text-body">Item</th>
                  <th className="px-4 py-2 font-medium text-body">Price</th>
                  <th className="px-4 py-2 font-medium text-body">Stock</th>
                  <th className="px-4 py-2 font-medium text-body">Status</th>
                  <th className="px-4 py-2 font-medium text-body">Actions</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((item) => (
                  <tr key={item.id} className="border-t border-hairline">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getProductImage(item.image) && <img src={getProductImage(item.image)} alt={item.name} loading="lazy" decoding="async" className="w-10 h-10 rounded-lg object-cover" />}
                        <div>
                          <div className="font-medium text-ink">{item.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatPeso(item.price)}</td>
                    <td className="px-4 py-3">
                      {/* The identical stepper in vendor/ShopDetail and
                          customer/Cart is w-10 h-10 with a type and an
                          aria-label. This one was w-7 h-7 (28px, under the 44px
                          rule) with neither. */}
                      <div className="flex items-center gap-1">
                        <button type="button"
                          aria-label={`Decrease stock for ${item.name}`}
                          onClick={() => updateStock(vendorId, item.id, Math.max(0, (editStock[item.id] ?? item.stock) - 1))}
                          className="w-10 h-10 rounded-control bg-surface-hover hover:bg-hairline flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={editStock[item.id] ?? item.stock}
                          onChange={(e) => handleStockChange(item.id, e.target.value)}
                          className="w-14 text-center border border-hairline rounded py-1 text-sm"
                        />
                        <button type="button"
                          aria-label={`Increase stock for ${item.name}`}
                          onClick={() => updateStock(vendorId, item.id, (editStock[item.id] ?? item.stock) + 1)}
                          className="w-10 h-10 rounded-control bg-surface-hover hover:bg-hairline flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={item.available ? (item.stock < 6 ? 'yellow' : 'green') : 'red'}>
                        {!item.available || item.stock === 0 ? 'Out of Stock' : item.stock < 6 ? 'Low' : 'In Stock'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="success" onClick={() => saveStock(item.id)}><Check className="w-3 h-3" /> Save</Button>
                        <Button size="sm" variant="outline" onClick={() => updateVendorMenu(vendorId, item.id, { available: !item.available, stock: !item.available ? (editStock[item.id] ?? 10) : 0 })}>
                          {item.available ? 'Mark OOS' : 'Restock'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
