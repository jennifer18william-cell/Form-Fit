import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { Category } from '../../types';
import { FolderTree, Trash2, Edit } from 'lucide-react';

export const OwnerCategories: React.FC = () => {
  const { categories, saveCategory, deleteCategory } = useStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    saveCategory({
      id: editingId || undefined,
      name: name.trim(),
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: description.trim(),
    });

    setName('');
    setDescription('');
    setEditingId(null);
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
  };

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="border-b border-[#E5E4DF] pb-4">
          <p className="text-xs font-medium text-[#64748B]">
            Catalog Structure
          </p>
          <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B] tabular-nums">
            Category Manager ({categories.length})
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Create / Edit Form */}
          <div className="md:col-span-4 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3 flex items-center gap-2">
              <FolderTree size={16} className="text-[#1D4ED8]" />
              <span>{editingId ? 'Edit Category' : 'Create New Category'}</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hoodies & Sweatshirts"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Heavyweight fleece and relaxed outerwear..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none transition-colors"
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
                    }}
                    className="px-4 py-2.5 bg-[#FAF9F6] hover:bg-[#F3F2EE] border border-[#D6D5CE] rounded-lg text-xs font-medium text-[#52525B] cursor-pointer transition-colors whitespace-nowrap"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-space text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {editingId ? 'Update Category' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>

          {/* Categories Grid List */}
          <div className="md:col-span-8 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3">
              Configured Categories
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((cat) => {
                const isConfirming = confirmDeleteId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="p-4 bg-[#FAF9F6] border border-[#E5E4DF] rounded-xl flex justify-between items-start gap-3"
                  >
                    <div className="min-w-0">
                      <h3 className="font-space font-semibold text-sm text-[#18181B] truncate">
                        {cat.name}
                      </h3>
                      <p className="text-[11px] font-mono text-[#64748B] truncate">
                        Slug: {cat.slug}
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
                            onClick={() => {
                              deleteCategory(cat.id);
                              setConfirmDeleteId(null);
                            }}
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
                            className="p-1.5 bg-white border border-[#D6D5CE] rounded-md text-[#18181B] hover:border-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-[#EEF2FF] transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(cat.id)}
                            className="p-1.5 bg-white border border-[#FECACA] rounded-md text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
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
