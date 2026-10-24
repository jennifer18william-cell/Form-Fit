import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Trash2, ArrowRight, ShoppingBag, Tag } from 'lucide-react';
import { getFashionFallbackImage } from '../lib/imageOptimization';

export const CartPage: React.FC = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    applyCoupon,
    appliedCoupon,
    removeCoupon,
    storeSettings,
  } = useStore();
  const [couponInput, setCouponInput] = useState('');
  const [couponMessage, setCouponMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const navigate = useNavigate();

  const subtotal = cart.reduce((acc, item) => {
    const itemPrice = item.custom_design_data?.total_price
      ? item.custom_design_data.total_price
      : item.variant.price_override || item.product.sale_price || item.product.regular_price;
    return acc + itemPrice * item.quantity;
  }, 0);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percentage') {
      discount = (subtotal * appliedCoupon.discount_value) / 100;
    } else {
      discount = appliedCoupon.discount_value;
    }
  }

  const shippingFee =
    subtotal >= storeSettings.free_shipping_threshold ? 0 : storeSettings.shipping_fee_flat;
  const finalTotal = Math.max(0, subtotal - discount + shippingFee);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    const res = applyCoupon(couponInput);
    if (res.success) {
      setCouponMessage({ type: 'success', text: res.message });
      setCouponInput('');
    } else {
      setCouponMessage({ type: 'error', text: res.message });
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto my-20 p-12 bg-white border border-[#E5E4DF] rounded-xl text-center space-y-4">
        <ShoppingBag size={44} className="mx-auto text-[#94A3B8]" />
        <h2 className="font-space font-bold text-2xl text-[#18181B]">
          Your Shopping Bag is Empty
        </h2>
        <p className="text-xs text-[#64748B] font-sans max-w-md mx-auto">
          Explore our collection of modern clothing, structured outerwear, and bespoke t-shirt designs.
        </p>
        <Link
          to="/shop"
          className="inline-block px-7 py-3 bg-[#B8F130] text-[#111111] font-space font-bold text-xs rounded-md hover:bg-[#AAE422] transition-colors"
        >
          Browse Collection Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#18181B]">
      <div className="border-b border-[#E5E4DF] pb-4">
        <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B]">
          Shopping Bag ({cart.reduce((a, b) => a + b.quantity, 0)})
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Items Table */}
        <div className="lg:col-span-8 bg-white border border-[#E5E4DF] rounded-xl divide-y divide-[#E5E4DF]">
          {cart.map((item) => {
            const itemPrice = item.custom_design_data?.total_price
              ? item.custom_design_data.total_price
              : item.variant.price_override ||
                item.product.sale_price ||
                item.product.regular_price;
            const fallbackImg = getFashionFallbackImage(
              item.product?.name,
              item.product?.category?.name
            );
            const imageSrc =
              item.variant?.variant_image_url ||
              item.product?.images?.find((i) => i.is_main)?.url ||
              item.product?.images?.[0]?.url ||
              fallbackImg;

            return (
              <div
                key={item.id}
                className="p-4 sm:p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between"
              >
                <div className="flex gap-4 items-center flex-1">
                  <div className="w-20 h-24 bg-[#F3F2EE] shrink-0 overflow-hidden relative border border-[#E5E4DF] rounded-md">
                    <img
                      src={imageSrc}
                      alt={item.product?.name || 'Product'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = fallbackImg;
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-space font-semibold text-base text-[#18181B]">
                      {item.product.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-[#64748B]">
                      {item.variant.size && <span>Size: {item.variant.size}</span>}
                      {item.variant.size && item.variant.color && <span aria-hidden="true">·</span>}
                      {item.variant.color && <span>Color: {item.variant.color}</span>}
                    </div>
                    {item.custom_design_data && (
                      <span className="inline-block text-[#4D7C0F] text-xs font-semibold">
                        Custom Studio Print
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-6 pt-2 sm:pt-0">
                  <div className="flex items-center border border-[#D6D5CE] bg-[#FAF9F6] rounded-md">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                      className="px-3 py-1.5 text-xs text-[#18181B] hover:bg-[#F3F2EE] font-semibold cursor-pointer transition-colors rounded-l-md"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="px-3 py-1.5 text-xs font-mono font-semibold text-[#18181B] min-w-[2rem] text-center tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                      className="px-3 py-1.5 text-xs text-[#18181B] hover:bg-[#F3F2EE] font-semibold cursor-pointer transition-colors rounded-r-md"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right tabular-nums">
                    <span className="font-space font-bold text-base text-[#18181B] block">
                      ₹{(itemPrice * item.quantity).toLocaleString('en-IN')}
                    </span>
                    <span className="text-[11px] text-[#64748B]">₹{itemPrice} each</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="text-[#94A3B8] hover:text-red-600 transition-colors p-1 cursor-pointer"
                    aria-label="Remove item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-4 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-6 text-[#18181B]">
          <h3 className="font-space font-bold text-base border-b border-[#E5E4DF] pb-3 text-[#18181B]">
            Order Summary
          </h3>

          {/* Promo Code Input */}
          <div className="space-y-2">
            <label className="block text-xs font-medium flex items-center gap-1.5 text-[#52525B]">
              <Tag size={13} className="text-[#4D7C0F]" /> Promo Code or Coupon
            </label>
            {appliedCoupon ? (
              <div className="flex justify-between items-center bg-[#F4FBE1] border border-[#BEF264] text-[#3F6212] p-2.5 rounded-md text-xs font-semibold">
                <span>Code {appliedCoupon.code} Applied</span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs underline hover:text-red-600 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. FORM10"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="flex-1 bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[#65A30D] uppercase"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#B8F130] text-[#111111] font-space text-xs font-bold rounded-md hover:bg-[#AAE422] transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </form>
            )}

            {couponMessage && (
              <p
                className={`text-xs font-medium ${
                  couponMessage.type === 'success' ? 'text-[#15803D]' : 'text-red-600'
                }`}
              >
                {couponMessage.text}
              </p>
            )}
          </div>

          <div className="space-y-3 pt-3 border-t border-[#E5E4DF] text-xs tabular-nums">
            <div className="flex justify-between text-[#52525B]">
              <span>Bag Subtotal</span>
              <span className="font-semibold text-[#18181B]">
                ₹{subtotal.toLocaleString('en-IN')}
              </span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-[#15803D] font-semibold">
                <span>Discount</span>
                <span>-₹{discount.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between text-[#52525B]">
              <span>Estimated Shipping</span>
              <span>
                {shippingFee === 0 ? (
                  <span className="text-[#15803D] font-semibold">Free</span>
                ) : (
                  `₹${shippingFee}`
                )}
              </span>
            </div>

            <div className="flex justify-between items-baseline text-base font-bold text-[#18181B] pt-3 border-t border-[#E5E4DF]">
              <span>Total Payable</span>
              <span className="text-2xl text-[#111111] font-space font-bold">
                ₹{finalTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/checkout')}
            className="w-full py-3.5 bg-[#B8F130] text-[#111111] font-space font-bold text-sm rounded-lg hover:bg-[#AAE422] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            Proceed to Checkout <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
