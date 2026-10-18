import { useState } from 'react';
import { Plus, Pencil, Trash2, PackageX, Package, Megaphone, Share2, UtensilsCrossed, ImagePlus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Button, Input, formatPeso, Modal, Textarea, Badge, ConfirmDialog, EmptyState, getProductImage } from '@/components/UI';
import ProductCategoryField from '@/components/ProductCategoryField';

export default function VendorMenu() {
  const { auth, addVendorMenu, updateVendorMenu, deleteVendorMenu, postVendorProduct, uploadMediaFile, showToast } = useApp();
  const vendorId = auth.user.id;
  const menu = auth.user.menu || [];

  const [editingItem, setEditingItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [postingItem, setPostingItem] = useState(null);
  const [postError, setPostError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const initialForm = { name: '', description: '', price: '', category: '', stock: 20, image: '', available: true };
  const [form, setForm] = useState(initialForm);

  const openAdd = () => {
    setForm(initialForm);
    setEditingItem(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({ ...item, price: String(item.price), stock: String(item.stock) });
    setEditingItem(item);
    setShowForm(true);
  };

  const openPost = (item) => {
    setPostingItem(item);
    setPostError('');
  };

  const handlePost = () => {
    const result = postVendorProduct(vendorId, postingItem.id);
    if (result.success) {
      setPostingItem(null);
    } else {
      setPostError(result.message || 'Unable to share right now.');
    }
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (uploadingImage) return;
    const data = {
      name: form.name,
      description: form.description,
      price: Number(form.price) || 0,
      category: form.category,
      stock: Number(form.stock) || 0,
      image: form.image,
      available: form.available && (Number(form.stock) > 0),
    };
    if (editingItem) {
      updateVendorMenu(vendorId, editingItem.id, data);
    } else {
      addVendorMenu(vendorId, data);
    }
    setShowForm(false);
  };

  const toggleAvailable = (item) => {
    updateVendorMenu(vendorId, item.id, { available: !item.available, stock: !item.available ? 10 : 0 });
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Menu Management</h1>
          <p className="text-sm text-muted">{menu.length} items on your menu.</p>
        </div>
        <div className="flex w-full items-stretch gap-2 sm:w-auto sm:items-center">
          <Button className="flex-1 sm:flex-none" onClick={openAdd}><Plus className="w-4 h-4" /> Add Item</Button>
        </div>
      </div>

      {menu.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No menu items yet"
          description="Add your first menu item to start receiving orders."
          action={<Button onClick={openAdd}><Plus className="w-4 h-4" /> Add first item</Button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {menu.map((item) => {
            const image = getProductImage(item.image);
            return (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex">
                {/* Without a fallback an item with no photo rendered as an empty
                    gray rectangle in the editor, which looked like a broken
                    image rather than an absent one. */}
                <div className="w-28 min-h-32 bg-surface-hover flex items-center justify-center shrink-0 overflow-hidden relative">
                  {image ? (
                    <img src={image} alt={item.name} loading="lazy" decoding="async" className="relative z-10 w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="w-7 h-7 text-subtle" aria-hidden="true" />
                  )}
                </div>
                <div className="p-4 flex-1 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-ink truncate">{item.name}</h3>
                      <Badge color="gray">{item.category}</Badge>
                    </div>
                    <p className="text-sm text-muted line-clamp-2 mt-1">{item.description || 'No description added.'}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-lg font-bold text-ink whitespace-nowrap tabular-nums">{formatPeso(item.price)}</span>
                      <Badge color={item.stock > 0 ? 'green' : 'red'}>{item.stock} in stock</Badge>
                    </div>
                    {/* Four 44px tap targets need 188px, which is wider than the
                        space left beside the 112px thumbnail on a 320px screen.
                        Wrapping onto a second row keeps the delete button
                        reachable instead of clipped by overflow-x: hidden. */}
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleAvailable(item)}
                        aria-pressed={item.available}
                        className={`tap-target flex items-center gap-1.5 px-3 rounded-control text-xs font-medium transition-colors ${item.available ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}
                      >
                        {item.available ? <Package className="w-3.5 h-3.5" /> : <PackageX className="w-3.5 h-3.5" />}
                        {item.available ? 'In stock' : 'Out of stock'}
                      </button>
                      <button type="button" aria-label={`Post ${item.name} to marketplace`} onClick={() => openPost(item)} className="tap-target hover:bg-brand-soft rounded-control" title="Post to marketplace"><Megaphone className="w-4 h-4 text-brand-strong" /></button>
                      <button type="button" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)} className="tap-target hover:bg-surface-hover rounded-control text-body"><Pencil className="w-4 h-4" /></button>
                      <button type="button" aria-label={`Delete ${item.name}`} onClick={() => setDeleteId(item.id)} className="tap-target hover:bg-danger-soft rounded-control text-danger"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'} size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingItem ? 'Save Changes' : 'Add Item'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            {/*
              The label used to sit next to the file input rather than wrapping
              it, so clicking the words did nothing and a screen reader read an
              unlabelled file field. It is now the input's label element, with
              the input kept in the a11y tree via sr-only.
            */}
            <label htmlFor="menu-item-image" className="block text-sm font-medium text-body mb-1.5">Item picture</label>
            <input
              id="menu-item-image"
              type="file"
              accept="image/*"
              disabled={uploadingImage}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                  showToast('Please choose an image file.', 'error');
                  return;
                }
                setUploadingImage(true);
                const result = await uploadMediaFile(file, 'menu');
                if (result.success) setForm((current) => ({ ...current, image: result.url }));
                else showToast(result.message || 'Unable to upload menu image.', 'error');
                setUploadingImage(false);
              }}
              className="w-full px-3 py-2.5 min-h-11 text-sm bg-white border border-hairline-strong rounded-control hover:border-hairline-hover file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:bg-surface-hover file:text-xs file:font-medium file:text-body disabled:opacity-50"
            />
            {uploadingImage && <p className="mt-1 text-xs text-muted">Uploading image...</p>}
            {getProductImage(form.image) && (
              <img src={getProductImage(form.image)} alt="" loading="lazy" decoding="async" className="mt-2 h-24 w-full rounded-control object-cover" />
            )}
            {!getProductImage(form.image) && !uploadingImage && (
              <p className="mt-1 text-xs text-subtle">Optional. Items with a photo get more orders.</p>
            )}
          </div>
          <Input label="Item Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price (₱)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input label="Stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
          <ProductCategoryField
            value={form.category}
            onChange={(category) => setForm((current) => ({ ...current, category }))}
            categories={menu.map((item) => item.category)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
            Available for ordering
          </label>
        </div>
      </Modal>

      <Modal
        open={!!postingItem}
        onClose={() => setPostingItem(null)}
        title={`Post ${postingItem?.name || 'product'} to marketplace`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPostingItem(null)}>Cancel</Button>
            <Button onClick={handlePost}><Share2 className="w-4 h-4" /> Publish Product</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-brand-soft border border-brand-line p-3 text-sm text-brand-deep">
            This product will be shared to the marketplace immediately.
          </div>
          {postError && <p className="text-sm text-danger">{postError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { deleteVendorMenu(vendorId, deleteId); setDeleteId(null); }}
        title="Delete menu item?"
        message="This will remove the item from your menu."
        confirmText="Delete"
      />
    </div>
  );
}
