import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { Ticket, Copy, Check } from 'lucide-react';

export const OwnerCoupons: React.FC = () => {
  const { coupons } = useStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="border-b border-[#E5E4DF] pb-4">
          <p className="text-xs font-medium text-[#64748B]">
            Promotions &amp; Discounts
          </p>
          <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B]">
            Promo Coupon Codes
          </h1>
        </div>

        <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
          <h2 className="font-space font-semibold text-sm text-[#18181B] flex items-center gap-2 border-b border-[#E5E4DF] pb-3 tabular-nums">
            <Ticket size={16} className="text-[#1D4ED8]" /> Active Promo Codes ({coupons.length})
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    <span className="text-xs font-medium text-[#15803D]">
                      Active
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#1D4ED8] tabular-nums">
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
                  className="w-full py-1.5 px-3 bg-white hover:bg-[#EEF2FF] border border-[#D6D5CE] hover:border-[#C7D2FE] text-[#18181B] hover:text-[#1D4ED8] rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
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
    </OwnerLayout>
  );
};
