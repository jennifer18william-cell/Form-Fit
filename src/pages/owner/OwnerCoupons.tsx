import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { Ticket, Copy, Check, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export const OwnerCoupons: React.FC = () => {
  const { coupons, saveCoupon, deleteCoupon } = useStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(999);
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCopy = (id: string, couponCode: string) => {
    navigator.clipboard?.writeText(couponCode).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsSaving(true);
    setBanner(null);
    try {
      const saved = await saveCoupon({
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue) || 10,
        min_order_amount: Number(minOrderAmount) || 0,
        is_active: true,
      });
      setBanner({
        type: 'success',
        text: `Promo code "${saved.code}" saved and active at customer checkout.`,
      });
      setCode('');
    } catch (err: any) {
      setBanner({
        type: 'error',
        text: err?.message || 'Failed to save promo code.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCoupon = async (id: string, couponCode: string) => {
    setBanner(null);
    try {
      await deleteCoupon(id);
      setBanner({ type: 'success', text: `Promo code "${couponCode}" deleted.` });
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to delete promo code.' });
    }
  };

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="border-b border-[#E5E4DF] pb-4">
          <p className="text-xs font-medium text-[#64748B]">Promotions &amp; Discounts</p>
          <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B]">
            Promo Coupon Codes
          </h1>
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
          {/* Create Promo Code Form */}
          <div className="md:col-span-4 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3 flex items-center gap-2">
              <Plus size={16} className="text-[#4D7C0F]" />
              <span>Create Promo Code</span>
            </h2>

            <form onSubmit={handleCreateCoupon} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER15"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-mono uppercase text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                    className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:outline-none cursor-pointer"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Flat (₹ INR)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">Value *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-mono text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">Min Order Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={minOrderAmount}
                  onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-mono text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Publish Promo Code'}
              </button>
            </form>
          </div>

          {/* Active Coupons List */}
          <div className="md:col-span-8 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] flex items-center gap-2 border-b border-[#E5E4DF] pb-3 tabular-nums">
              <Ticket size={16} className="text-[#4D7C0F]" /> Active Promo Codes ({coupons.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="p-4 bg-[#FAF9F6] border border-[#E5E4DF] rounded-xl space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono font-bold text-base text-[#18181B] tracking-tight">
                        {c.code}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#15803D]">Active</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCoupon(c.id, c.code)}
                          className="p-1 text-[#DC2626] hover:bg-[#FEF2F2] rounded cursor-pointer"
                          title="Delete Promo Code"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-[#4D7C0F] tabular-nums">
                      {c.discount_type === 'percentage'
                        ? `${c.discount_value}% Off Order`
                        : `₹${c.discount_value.toLocaleString('en-IN')} Off Order`}
                    </p>
                    <p className="text-[11px] text-[#52525B] font-sans tabular-nums">
                      Min order: ₹{c.min_order_amount.toLocaleString('en-IN')} · Used {c.times_used} times
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(c.id, c.code)}
                    className="w-full py-1.5 px-3 bg-white hover:bg-[#F4FBE1] border border-[#D6D5CE] hover:border-[#BEF264] text-[#18181B] hover:text-[#3F6212] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedId === c.id ? (
                      <>
                        <Check size={13} className="text-[#16A34A]" /> Copied Code
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy Code
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
};
