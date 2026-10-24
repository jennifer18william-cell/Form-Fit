import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { OrderStatus, PaymentStatus } from '../../types';
import { ShoppingBag, Search } from 'lucide-react';

export const OwnerOrders: React.FC = () => {
  const { orders, updateOrderStatus, updatePaymentStatus } = useStore();
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingInputs, setTrackingInputs] = useState<{ [orderId: string]: string }>({});
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);

  const filteredOrders = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNum = o.order_number.toLowerCase().includes(q);
      const matchEmail = o.customer_email.toLowerCase().includes(q);
      const matchName = o.shipping_address.full_name.toLowerCase().includes(q);
      if (!matchNum && !matchEmail && !matchName) return false;
    }
    return true;
  });

  const handleTrackingUpdate = (orderId: string, currentStatus: OrderStatus, existingTracking?: string) => {
    const trackingNum =
      trackingInputs[orderId] !== undefined ? trackingInputs[orderId] : existingTracking || '';
    updateOrderStatus(orderId, currentStatus === 'pending' ? 'shipped' : currentStatus, trackingNum);
    setSavedOrderId(orderId);
    setTimeout(() => setSavedOrderId(null), 2000);
  };

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div className="border-b border-[#E5E4DF] pb-4">
          <p className="text-xs font-medium text-[#64748B]">
            Fulfillment Center
          </p>
          <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B] tabular-nums">
            Customer Order Management ({orders.length})
          </h1>
        </div>

        {/* Filter Controls */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl p-4 flex flex-col sm:flex-row gap-3 justify-between items-center text-xs">
          <div className="relative flex-1 w-full max-w-md">
            <input
              type="text"
              placeholder="Search order number, customer email, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 pl-9 text-xs text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none transition-colors"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-[#64748B]" />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-medium text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:outline-none cursor-pointer"
          >
            <option value="">All Fulfillment Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Orders List */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-xs text-[#52525B] font-sans p-6">
              <ShoppingBag size={34} className="mx-auto text-[#94A3B8] mb-2" />
              No customer orders match your search filters.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E4DF]">
              {filteredOrders.map((ord) => (
                <div key={ord.id} className="p-6 space-y-4 hover:bg-[#FAF9F6]/60 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E5E4DF] pb-3">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-space font-bold text-base text-[#18181B] tabular-nums">
                          Order #{ord.order_number}
                        </span>
                        <span className="text-[#CBD5E1]" aria-hidden="true">·</span>
                        <span className="text-xs font-mono text-[#64748B] tabular-nums">
                          {new Date(ord.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-xs text-[#52525B] font-sans mt-0.5">
                        Customer:{' '}
                        <strong className="font-semibold text-[#18181B]">
                          {ord.shipping_address.full_name}
                        </strong>{' '}
                        ({ord.customer_email}) · Phone: {ord.customer_phone}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="font-space font-bold text-lg text-[#18181B] tabular-nums">
                        ₹{ord.total_amount.toLocaleString('en-IN')}
                      </span>
                      <span className="block text-[11px] font-mono text-[#64748B] uppercase">
                        Method: {ord.payment_method}
                      </span>
                    </div>
                  </div>

                  {/* Address & Line Items Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                    <div className="bg-[#FAF9F6] p-3.5 rounded-lg border border-[#E5E4DF] space-y-1">
                      <span className="font-semibold text-[11px] text-[#64748B] block">
                        Shipping Address
                      </span>
                      <p className="text-[#18181B]">
                        {ord.shipping_address.line1}, {ord.shipping_address.city},{' '}
                        {ord.shipping_address.state} - {ord.shipping_address.postal_code}
                      </p>
                    </div>

                    <div className="bg-[#FAF9F6] p-3.5 rounded-lg border border-[#E5E4DF] space-y-1">
                      <span className="font-semibold text-[11px] text-[#64748B] block tabular-nums">
                        Ordered Items ({ord.items?.length || 0})
                      </span>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {ord.items?.map((item, idx) => (
                          <p key={idx} className="font-medium text-[#18181B] truncate tabular-nums">
                            {item.quantity}× {item.product_name} {item.size ? `(${item.size})` : ''} — ₹
                            {item.total_price.toLocaleString('en-IN')}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <span className="text-xs font-semibold text-[#52525B]">Status:</span>
                      <select
                        value={ord.status}
                        onChange={(e) => updateOrderStatus(ord.id, e.target.value as OrderStatus)}
                        className="bg-white border border-[#D6D5CE] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#18181B] focus:border-[#1D4ED8] focus:outline-none cursor-pointer"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      <select
                        value={ord.payment_status}
                        onChange={(e) => updatePaymentStatus(ord.id, e.target.value as PaymentStatus)}
                        className={`border rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer focus:outline-none ${
                          ord.payment_status === 'paid'
                            ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                            : ord.payment_status === 'refunded'
                            ? 'bg-[#F8FAFC] border-[#CBD5E1] text-[#475569]'
                            : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                        }`}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </div>

                    {/* Courier Tracking */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Courier Tracking #"
                        defaultValue={ord.tracking_number || ''}
                        onChange={(e) =>
                          setTrackingInputs((prev) => ({ ...prev, [ord.id]: e.target.value }))
                        }
                        className="bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-1.5 text-xs font-mono text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:outline-none flex-1 sm:w-44"
                      />
                      <button
                        type="button"
                        onClick={() => handleTrackingUpdate(ord.id, ord.status, ord.tracking_number)}
                        className="px-3.5 py-1.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-space text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {savedOrderId === ord.id ? 'Saved' : 'Save Courier Info'}
                      </button>
                    </div>
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
