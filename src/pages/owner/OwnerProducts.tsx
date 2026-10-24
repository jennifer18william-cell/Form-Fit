import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { PlusCircle, Edit3, Trash2, Search, Package } from 'lucide-react';
import { getFashionFallbackImage } from '../../lib/imageOptimization';

export const OwnerProducts: React.FC = () => {
  const { products, toggleProductStatus, deleteProduct, categories } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (selectedStatus && p.status !== selectedStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = (p.sku || '').toLowerCase().includes(q);
      if (!matchName && !matchSku) return false;
    }
    return true;
  });

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E4DF] pb-4">
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Product Management
            </p>
            <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B] tabular-nums">
              Apparel Catalog ({products.length})
            </h1>
          </div>

          <Link
            to="/owner/products/new"
            className="px-4 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-space text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle size={16} /> Create New Product
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 pl-9 text-xs text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none transition-colors"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-[#64748B]" />
          </div>

          <div className="flex gap-2.5 w-full sm:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 sm:flex-none bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-medium text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:outline-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 sm:flex-none bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-medium text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Product Table */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl overflow-hidden">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 space-y-3 p-6">
              <Package size={36} className="mx-auto text-[#94A3B8]" />
              <h3 className="font-space font-semibold text-base text-[#18181B]">No Products Found</h3>
              <p className="text-xs text-[#52525B] font-sans max-w-sm mx-auto">
                {products.length === 0
                  ? 'Your store catalog is currently empty. Create a new product to publish your first fashion piece.'
                  : 'No products match your current search or filter criteria.'}
              </p>
              <Link
                to="/owner/products/new"
                className="inline-block px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-space text-xs font-semibold transition-colors"
              >
                Upload First Product
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3F2EE] text-[#475569] border-b border-[#E5E4DF] font-semibold">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Regular Price</th>
                    <th className="py-3 px-4 text-right">Sale Price</th>
                    <th className="py-3 px-4">Variants / Stock</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E4DF]">
                  {filteredProducts.map((p) => {
                    const totalStock = p.variants?.reduce((s, v) => s + v.stock_quantity, 0) || 0;
                    const fallbackImg = getFashionFallbackImage(p.name, p.category?.name);
                    const mainImg = p.images?.find((i) => i.is_main)?.url || p.images?.[0]?.url || fallbackImg;
                    const isConfirming = confirmDeleteId === p.id;

                    return (
                      <tr key={p.id} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-12 bg-[#F3F2EE] border border-[#E5E4DF] rounded-md shrink-0 overflow-hidden">
                              <img
                                src={mainImg}
                                alt={p.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = fallbackImg;
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-space font-semibold text-sm text-[#18181B] truncate">
                                {p.name}
                              </p>
                              <p className="text-[11px] font-mono text-[#64748B] tabular-nums">
                                {p.sku || 'No SKU'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#52525B] font-medium">
                          {p.category?.name || p.gender_collection}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-[#18181B] tabular-nums">
                          ₹{p.regular_price.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#52525B] tabular-nums">
                          {p.sale_price ? `₹${p.sale_price.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <span className={totalStock === 0 ? 'text-[#DC2626] font-semibold' : 'text-[#18181B]'}>
                            {p.variants?.length || 0} var · {totalStock} pcs
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleProductStatus(p.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                              p.status === 'published'
                                ? 'bg-[#EEF2FF] text-[#1D4ED8] border-[#C7D2FE] hover:bg-[#DBEAFE]'
                                : 'bg-[#FAF9F6] text-[#52525B] border-[#D6D5CE] hover:bg-[#F3F2EE]'
                            }`}
                          >
                            {p.status === 'published' ? 'Published' : 'Draft'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isConfirming ? (
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteProduct(p.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2.5 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-[#F3F2EE] text-[#52525B] border border-[#D6D5CE] rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-2">
                              <Link
                                to={`/owner/products/${p.id}`}
                                className="p-1.5 border border-[#D6D5CE] rounded-md text-[#18181B] hover:border-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-[#EEF2FF] transition-colors"
                                title="Edit Product"
                              >
                                <Edit3 size={14} />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(p.id)}
                                className="p-1.5 border border-[#FECACA] rounded-md text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                                title="Delete Product"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </OwnerLayout>
  );
};
