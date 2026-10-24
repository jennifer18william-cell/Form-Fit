import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { Boxes, Search, History } from 'lucide-react';

export const OwnerInventory: React.FC = () => {
  const { products, adjustVariantStock, inventoryLogs } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Collect all variants
  const variantRows = products.flatMap((p) =>
    (p.variants || []).map((v) => ({
      productId: p.id,
      productName: p.name,
      variantId: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock: v.stock_quantity,
    }))
  );

  const filteredVariants = variantRows.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return v.productName.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q);
  });

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="border-b border-[#E5E4DF] pb-4">
          <p className="text-xs font-medium text-[#64748B]">
            Stock Control
          </p>
          <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B]">
            Inventory Matrix &amp; Movement Logs
          </h1>
        </div>

        {/* Search */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl p-4">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search inventory by product name or variant SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 pl-9 text-xs text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none transition-colors"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-[#64748B]" />
          </div>
        </div>

        {/* Variants Inventory Table */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#E5E4DF] flex justify-between items-center">
            <h2 className="font-space font-semibold text-sm text-[#18181B] flex items-center gap-2 tabular-nums">
              <Boxes size={16} className="text-[#1D4ED8]" /> All Active Product Variants ({filteredVariants.length})
            </h2>
          </div>

          {filteredVariants.length === 0 ? (
            <div className="text-center py-12 px-6 text-xs text-[#52525B] font-sans">
              No product variants found. Create products with size and color variants to manage inventory.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3F2EE] text-[#475569] border-b border-[#E5E4DF] font-semibold">
                    <th className="py-3 px-4">Product Title</th>
                    <th className="py-3 px-4">Variant SKU</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Stock Level</th>
                    <th className="py-3 px-4 text-right">Inline Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E4DF]">
                  {filteredVariants.map((v) => {
                    const isOut = v.stock === 0;
                    const isLow = v.stock > 0 && v.stock <= 5;

                    return (
                      <tr key={v.variantId} className="hover:bg-[#FAF9F6] transition-colors">
                        <td className="py-3 px-4 font-space font-semibold text-[#18181B]">
                          {v.productName}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#52525B] tabular-nums">{v.sku}</td>
                        <td className="py-3 px-4 font-mono uppercase text-[#18181B]">{v.size || '—'}</td>
                        <td className="py-3 px-4 text-[#52525B]">{v.color || '—'}</td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <span
                            className={`font-semibold ${
                              isOut
                                ? 'text-[#DC2626]'
                                : isLow
                                ? 'text-[#B45309]'
                                : 'text-[#15803D]'
                            }`}
                          >
                            {v.stock} pcs {isOut ? '· Out of stock' : isLow ? '· Low stock' : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5 font-mono tabular-nums">
                            <button
                              type="button"
                              onClick={() => adjustVariantStock(v.variantId, -1, 'Manual owner reduction')}
                              className="px-2.5 py-1 bg-[#FAF9F6] hover:bg-[#F3F2EE] border border-[#D6D5CE] text-[#18181B] rounded-md font-semibold cursor-pointer transition-colors"
                              title="Decrease 1"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustVariantStock(v.variantId, 1, 'Manual owner restock')}
                              className="px-2.5 py-1 bg-[#EEF2FF] hover:bg-[#DBEAFE] border border-[#C7D2FE] text-[#1D4ED8] rounded-md font-semibold cursor-pointer transition-colors"
                              title="Add 1"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustVariantStock(v.variantId, 10, 'Batch restock (+10)')}
                              className="px-2.5 py-1 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-md font-semibold cursor-pointer transition-colors"
                              title="Batch Restock 10"
                            >
                              +10
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inventory Audit Movement Log */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
          <h2 className="font-space font-semibold text-sm text-[#18181B] flex items-center gap-2 border-b border-[#E5E4DF] pb-3">
            <History size={16} className="text-[#1D4ED8]" /> Inventory Audit Logs
          </h2>

          {inventoryLogs.length === 0 ? (
            <p className="text-xs text-[#52525B] font-sans">No stock movements recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {inventoryLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-space font-semibold text-[#18181B]">{log.productName}</span>{' '}
                    <span className="font-mono text-[11px] text-[#64748B]">({log.variantSku})</span>
                    <p className="text-[11px] text-[#52525B]">{log.reason}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <span
                      className={`font-mono font-semibold ${
                        log.quantityChange > 0 ? 'text-[#15803D]' : 'text-[#DC2626]'
                      }`}
                    >
                      {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                    </span>
                    <p className="text-[10px] font-mono text-[#64748B]">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </OwnerLayout>
  );
};
