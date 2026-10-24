import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ShippingAddress, PaymentMethod } from '../types';
import { Truck, CreditCard, Lock, ArrowRight } from 'lucide-react';

export const Checkout: React.FC = () => {
  const { cart, createOrder, appliedCoupon, storeSettings } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [fullName, setFullName] = useState(user?.full_name || '');

  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-20 p-10 bg-white border border-[#E5E4DF] rounded-xl text-center space-y-4">
        <h2 className="font-space font-bold text-2xl text-[#18181B]">No Items to Checkout</h2>
        <p className="text-xs text-[#64748B] font-sans">
          Your shopping bag is empty. Please add items before proceeding to checkout.
        </p>
        <Link
          to="/shop"
          className="inline-block px-6 py-2.5 bg-[#B8F130] text-[#111111] font-space font-bold text-xs rounded-md hover:bg-[#AAE422] transition-colors"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

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

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !customerEmail.trim() ||
      !customerPhone.trim() ||
      !fullName.trim() ||
      !line1.trim() ||
      !city.trim() ||
      !postalCode.trim()
    ) {
      setErrorMsg('Please fill in all required contact and shipping address fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const shippingAddress: ShippingAddress = {
      full_name: fullName.trim(),
      phone: customerPhone.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      city: city.trim(),
      state: state.trim() || 'Maharashtra',
      postal_code: postalCode.trim(),
      country: 'India',
    };

    const res = await createOrder({
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      shippingAddress,
      paymentMethod,
    });

    setIsSubmitting(false);

    if (res.success && res.orderNumber) {
      navigate(`/account/orders/${res.orderNumber}`, { state: { newOrder: true } });
    } else {
      setErrorMsg(res.message || 'Failed to place order. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#18181B]">
      <div className="border-b border-[#E5E4DF] pb-4">
        <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#4D7C0F]">
          Form &amp; Fit Checkout
        </span>
        <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
          Express Checkout
        </h1>
      </div>

      <form
        onSubmit={handleSubmitOrder}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left Form Column */}
        <div className="lg:col-span-7 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Contact Details */}
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h3 className="font-space font-bold text-sm border-b border-[#E5E4DF] pb-3 text-[#18181B]">
              01. Contact Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#52525B]">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#52525B]">
                  Phone Number (for Courier SMS) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Shipping Address */}
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h3 className="font-space font-bold text-sm flex items-center gap-2 border-b border-[#E5E4DF] pb-3 text-[#18181B]">
              <Truck size={16} className="text-[#4D7C0F]" /> 02. Shipping Address Across India
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#52525B]">
                  Recipient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#52525B]">
                  Flat / House / Building Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Flat 402, Sunshine Heights"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-[#52525B]">
                  Street / Area / Landmark
                </label>
                <input
                  type="text"
                  placeholder="Near Metro Station"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#52525B]">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="Mumbai / Delhi"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#52525B]">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="Maharashtra"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-[#52525B]">PIN Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="400001"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#65A30D] focus:bg-white font-mono transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Payment Method Selection */}
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h3 className="font-space font-bold text-sm flex items-center gap-2 border-b border-[#E5E4DF] pb-3 text-[#18181B]">
              <CreditCard size={16} className="text-[#4D7C0F]" /> 03. Payment Method
            </h3>

            <div className="space-y-3">
              <label
                className={`flex items-center justify-between p-3.5 border rounded-lg cursor-pointer transition-colors ${
                  paymentMethod === 'upi'
                    ? 'border-[#84CC16] bg-[#F4FBE1]/70'
                    : 'border-[#E5E4DF] hover:border-[#CBD5E1] bg-[#FAF9F6]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="upi"
                    checked={paymentMethod === 'upi'}
                    onChange={() => setPaymentMethod('upi')}
                    className="accent-[#65A30D]"
                  />
                  <div>
                    <span className="font-space font-semibold text-xs block text-[#18181B]">
                      UPI / QR (Google Pay, PhonePe, Paytm)
                    </span>
                    <span className="text-[11px] text-[#64748B]">Instant payment verification</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-[#3F6212]">Instant</span>
              </label>

              <label
                className={`flex items-center justify-between p-3.5 border rounded-lg cursor-pointer transition-colors ${
                  paymentMethod === 'razorpay'
                    ? 'border-[#84CC16] bg-[#F4FBE1]/70'
                    : 'border-[#E5E4DF] hover:border-[#CBD5E1] bg-[#FAF9F6]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    value="razorpay"
                    checked={paymentMethod === 'razorpay'}
                    onChange={() => setPaymentMethod('razorpay')}
                    className="accent-[#65A30D]"
                  />
                  <div>
                    <span className="font-space font-semibold text-xs block text-[#18181B]">
                      Razorpay Gateway (Cards &amp; NetBanking)
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      Visa, Mastercard, RuPay &amp; NetBanking
                    </span>
                  </div>
                </div>
              </label>

              {storeSettings.cod_enabled && (
                <label
                  className={`flex items-center justify-between p-3.5 border rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'cod'
                      ? 'border-[#84CC16] bg-[#F4FBE1]/70'
                      : 'border-[#E5E4DF] hover:border-[#CBD5E1] bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="accent-[#65A30D]"
                    />
                    <div>
                      <span className="font-space font-semibold text-xs block text-[#18181B]">
                        Cash on Delivery (COD)
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Pay cash upon delivery to courier agent
                      </span>
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right Order Review Column */}
        <div className="lg:col-span-5 bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-6 text-[#18181B] lg:sticky lg:top-24">
          <h3 className="font-space font-bold text-base border-b border-[#E5E4DF] pb-3 text-[#18181B]">
            Review Bag Items ({cart.reduce((a, b) => a + b.quantity, 0)})
          </h3>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 text-xs justify-between items-center border-b border-[#E5E4DF] pb-2.5"
              >
                <div className="flex gap-2.5 items-center min-w-0">
                  <span className="font-mono font-semibold bg-[#F4FBE1] border border-[#BEF264] text-[#3F6212] px-1.5 py-0.5 rounded text-[11px] shrink-0">
                    {item.quantity}x
                  </span>
                  <div className="min-w-0">
                    <p className="font-space font-semibold truncate text-[#18181B]">
                      {item.product.name}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {item.variant.size ? `Size: ${item.variant.size}` : ''}{' '}
                      {item.variant.color ? `· ${item.variant.color}` : ''}
                    </p>
                  </div>
                </div>
                <span className="font-space font-bold text-[#18181B] tabular-nums shrink-0">
                  ₹
                  {(
                    (item.custom_design_data?.total_price ||
                      item.variant.price_override ||
                      item.product.sale_price ||
                      item.product.regular_price) * item.quantity
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 pt-2 text-xs tabular-nums">
            <div className="flex justify-between text-[#52525B]">
              <span>Subtotal</span>
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
              <span>Shipping Fee</span>
              <span>
                {shippingFee === 0 ? (
                  <span className="text-[#15803D] font-semibold">Free</span>
                ) : (
                  `₹${shippingFee}`
                )}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-lg font-bold text-[#18181B] pt-3 border-t border-[#E5E4DF]">
              <span>Final Total</span>
              <span className="text-2xl text-[#111111] font-space font-bold">
                ₹{finalTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-[#B8F130] text-[#111111] font-space font-bold text-sm rounded-lg hover:bg-[#AAE422] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Processing Order...' : 'Place Order & Pay Now'}{' '}
            <ArrowRight size={16} />
          </button>

          <div className="text-center text-xs text-[#64748B]">
            <p className="flex items-center justify-center gap-1.5">
              <Lock size={13} className="text-[#4D7C0F]" /> 256-Bit Encrypted Secure Checkout
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};
