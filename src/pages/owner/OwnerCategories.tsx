import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { Category } from '../../types';
import {
  FolderTree,
  Trash2,
  Edit,
  PlusCircle,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

export const OwnerCategories: React.FC = () => {
  const { categories, products, saveCategory, deleteCategory } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setBanner(null);
    try {
      const saved = await saveCategory({
        id: editingId || undefined,
        name: name.trim(),
        slug: name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
        description: description.trim(),
        image_url: imageUrl.trim() || undefined,
        parent_id: parentId || undefined,
      });

      setBanner({
        type: 'success',
        text: `Collection "${saved.name}" saved and published live to customer storefront.`,
      });
      setName('');
      setDescription('');
      setImageUrl('');
      setParentId('');
      setEditingId(null);
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Failed to save collection in database.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
    setImageUrl(cat.image_url || '');
    setParentId(cat.parent_id || '');
    setBanner(null);
  };

  const handleDelete = async (id: string, catName: string) => {
    setBanner(null);
    try {
      await deleteCategory(id);
      setConfirmDeleteId(null);
      setBanner({
        type: 'success',
        text: `Collection "${catName}" removed from storefront.`,
      });
    } catch (err: any) {
      setConfirmDeleteId(null);
      setBanner({
        type: 'error',
        text: err?.message || 'Failed to delete collection from database.',
      });
    }
  };

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="border-b border-[#E5E4DF] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <p className="text-xs font-medium text-[#64748B]">Catalog Structure &amp; Collections</p>
            <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B] tabular-nums">
              Collections &amp; Categories ({categories.length})
            </h1>
          </div>
          <Link
            to="/shop"
            className="text-xs font-space font-semibold text-[#4D7C0F] hover:underline inline-flex items-center gap-1"
          >
            Preview Customer Storefront <ExternalLink size={13} />
          </Link>
        </div>

        {banner && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 border ${
              banner.type === 'success'
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
            }`}
          >
            {banner.type === 'success' ? (
              <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-[#DC2626] shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Create / Edit Form */}
          <div className="md:col-span-4 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3 flex items-center gap-2">
              <FolderTree size={16} className="text-[#4D7C0F]" />
              <span>{editingId ? 'Edit Collection' : 'Create New Collection'}</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">
                  Collection / Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Resort Linen Drop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">
                  Parent Zone / Category (Optional)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="">None (Top-Level Homepage Collection)</option>
                  {categories
                    .filter((c) => !c.parent_id && c.id !== editingId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B] flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-[#4D7C0F]" />
                  <span>Cover Image URL (Optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://images.pexels.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-mono text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-[#64748B]">
                  Used on Homepage &ldquo;Explore Collections&rdquo; cards. Automatically uses your collection&apos;s product photo if left blank.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">Description</label>
                <textarea
                  rows={3}
                  placeholder="Breathable summer linen shirts and relaxed resort silhouettes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                />
              </div>

              <div className="flex gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setName('');
                      setDescription('');
                      setImageUrl('');
                      setParentId('');
                    }}
                    className="px-4 py-2.5 bg-[#FAF9F6] hover:bg-[#F3F2EE] border border-[#D6D5CE] rounded-lg text-xs font-medium text-[#52525B] cursor-pointer transition-colors whitespace-nowrap"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingId
                    ? 'Update Collection'
                    : 'Save & Publish Collection'}
                </button>
              </div>
            </form>
          </div>

          {/* Categories Grid List */}
          <div className="md:col-span-8 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3">
              Live Storefront Collections &amp; Categories
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const isConfirming = confirmDeleteId === cat.id;
                const itemCount = products.filter(
                  (p) => p.category_id === cat.id || p.category?.slug === cat.slug
                ).length;

                return (
                  <div
                    key={cat.id}
                    className="p-4 bg-[#FAF9F6] border border-[#E5E4DF] rounded-xl flex flex-col justify-between gap-3"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        {cat.parent_id && (
                          <p className="text-[10px] font-space font-bold uppercase tracking-wider text-[#4D7C0F] mb-0.5">
                            {categories.find((p) => p.id === cat.parent_id)?.name || 'Parent Zone'} Zone
                          </p>
                        )}
                        <h3 className="font-space font-semibold text-sm text-[#18181B] truncate">
                          {cat.name}
                        </h3>
                        <p className="text-[11px] font-mono text-[#64748B] truncate tabular-nums">
                          Slug: {cat.slug} · {itemCount} product{itemCount === 1 ? '' : 's'}
                        </p>
                        {cat.description && (
                          <p className="text-xs text-[#52525B] font-sans mt-1 line-clamp-2">
                            {cat.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDelete(cat.id, cat.name)}
                              className="px-2 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-md text-[11px] font-semibold cursor-pointer transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-white border border-[#D6D5CE] text-[#52525B] rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(cat)}
                              className="p-1.5 bg-white border border-[#D6D5CE] rounded-md text-[#18181B] hover:border-[#65A30D] hover:text-[#3F6212] hover:bg-[#F4FBE1] transition-colors cursor-pointer"
                              title="Edit Collection"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(cat.id)}
                              className="p-1.5 bg-white border border-[#FECACA] rounded-md text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                              title="Delete Collection"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#E5E4DF] flex items-center justify-between gap-2 text-[11px] font-space font-semibold">
                      <Link
                        to={`/owner/products/new?category=${encodeURIComponent(cat.id)}`}
                        className="text-[#3F6212] hover:text-[#111111] inline-flex items-center gap-1 transition-colors"
                      >
                        <PlusCircle size={12} /> Add Product Here
                      </Link>
                      <Link
                        to={`/shop?category=${encodeURIComponent(cat.id)}`}
                        className="text-[#52525B] hover:text-[#111111] inline-flex items-center gap-1 transition-colors"
                      >
                        View in Store <ExternalLink size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
};
