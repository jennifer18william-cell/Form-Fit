import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import {
  IndianRupee,
  ShoppingBag,
  Package,
  AlertTriangle,
  PlusCircle,
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const { products, orders } = useStore();

  // Metrics
  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.payment_status === 'paid');
  const grossSales = paidOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const pendingFulfillment = orders.filter((o) => o.status === 'pending').length;

  // Inventory stats
  const allVariants = products.flatMap((p) => p.variants || []);
  const outOfStockCount = allVariants.filter((v) => v.stock_quantity === 0).length;
  const lowStockCount = allVariants.filter((v) => v.stock_quantity > 0 && v.stock_quantity <= 5).length;

  return (
    <OwnerLayout>
      <div className="space-y-8">
        <div className="border-b border-[#E5E4DF] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Business Analytics
            </p>
            <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B]">
              Store Performance Overview
            </h1>
          </div>
          <Link
            to="/owner/products/new"
            className="px-4 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircle size={15} /> Add New Product
          </Link>
        </div>

        {/* Business Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-5 space-y-2">
            <div className="flex justify-between items-center text-[#64748B] text-xs font-medium">
              <span>Gross Sales (Paid)</span>
              <IndianRupee size={16} className="text-[#4D7C0F]" />
            </div>
            <p className="font-space font-bold text-2xl text-[#18181B] tabular-nums">
              ₹{grossSales.toLocaleString('en-IN')}
            </p>
            <p className="text-xs text-[#64748B] font-mono tabular-nums">
              From {paidOrders.length} paid order(s)
            </p>
          </div>

          <div className="bg-white border border-[#E5E4DF] rounded-xl p-5 space-y-2">
            <div className="flex justify-between items-center text-[#64748B] text-xs font-medium">
              <span>Total Orders</span>
              <ShoppingBag size={16} className="text-[#4D7C0F]" />
            </div>
            <p className="font-space font-bold text-2xl text-[#18181B] tabular-nums">{totalOrders}</p>
            <p className="text-xs text-[#B45309] font-mono font-medium tabular-nums">
              {pendingFulfillment} pending fulfillment
            </p>
          </div>

          <div className="bg-white border border-[#E5E4DF] rounded-xl p-5 space-y-2">
            <div className="flex justify-between items-center text-[#64748B] text-xs font-medium">
              <span>Published Catalog</span>
              <Package size={16} className="text-[#4D7C0F]" />
            </div>
            <p className="font-space font-bold text-2xl text-[#18181B] tabular-nums">
              {products.filter((p) => p.status === 'published').length} / {products.length}
            </p>
            <p className="text-xs text-[#64748B] font-mono">Active on storefront</p>
          </div>

          <div className="bg-white border border-[#E5E4DF] rounded-xl p-5 space-y-2">
            <div className="flex justify-between items-center text-[#64748B] text-xs font-medium">
              <span>Inventory Alerts</span>
              <AlertTriangle
                size={16}
                className={outOfStockCount > 0 ? 'text-[#DC2626]' : 'text-[#64748B]'}
              />
            </div>
            <p className="font-space font-bold text-2xl text-[#18181B] tabular-nums">
              {lowStockCount + outOfStockCount}
            </p>
            <p className="text-xs text-[#DC2626] font-mono font-medium tabular-nums">
              {outOfStockCount} out · {lowStockCount} low stock
            </p>
          </div>
        </div>

        {/* Recent Customer Orders Table */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl overflow-hidden">
          <div className="p-5 flex justify-between items-center border-b border-[#E5E4DF]">
            <h2 className="font-space font-semibold text-base text-[#18181B]">
              Recent Customer Orders
            </h2>
            <Link
              to="/owner/orders"
              className="text-xs font-semibold text-[#4D7C0F] hover:text-[#3F6212] transition-colors whitespace-nowrap"
            >
              Manage All Orders →
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 px-6 text-sm text-[#52525B] font-sans">
              No orders placed yet. Orders appear here automatically when customers complete checkout.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3F2EE] text-[#475569] border-b border-[#E5E4DF] font-semibold">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Fulfillment</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E4DF]">
                  {orders.slice(0, 6).map((ord) => (
                    <tr key={ord.id} className="hover:bg-[#FAF9F6] transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#18181B] tabular-nums">
                        {ord.order_number}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#18181B]">{ord.shipping_address.full_name}</p>
                        <p className="text-[11px] text-[#64748B] truncate max-w-[160px]">
                          {ord.customer_email}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#52525B] tabular-nums">
                        {new Date(ord.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#18181B] tabular-nums">
                        ₹{ord.total_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium capitalize ${
                            ord.payment_status === 'paid'
                              ? 'text-[#15803D]'
                              : ord.payment_status === 'refunded'
                              ? 'text-[#64748B]'
                              : 'text-[#B45309]'
                          }`}
                        >
                          {ord.payment_status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium capitalize ${
                            ord.status === 'delivered'
                              ? 'text-[#15803D]'
                              : ord.status === 'cancelled'
                              ? 'text-[#DC2626]'
                              : ord.status === 'shipped'
                              ? 'text-[#4D7C0F]'
                              : 'text-[#B45309]'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to="/owner/orders"
                          className="inline-block px-3 py-1.5 bg-[#FAF9F6] hover:bg-[#F4FBE1] text-[#18181B] hover:text-[#3F6212] border border-[#E5E4DF] hover:border-[#BEF264] rounded-md font-medium transition-colors whitespace-nowrap"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </OwnerLayout>
  );
};
