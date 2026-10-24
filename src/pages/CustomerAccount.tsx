import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { CustomerAuth } from './CustomerAuth';
import { ShippingAddress } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  ShoppingBag,
  MapPin,
  Heart,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  LogOut,
  Plus,
  Save,
  ArrowRight,
} from 'lucide-react';

export const CustomerAccount: React.FC = () => {
  const { id: orderNumberParam } = useParams<{ id?: string }>();
  const { orders, wishlist } = useStore();
  const { user, logout, updateProfile, isOwner } = useAuth();

  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'addresses' | 'wishlist'>(
    'orders'
  );

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [savedAddresses, setSavedAddresses] = useState<ShippingAddress[]>([
    {
      full_name: user?.full_name || 'Valued Member',
      phone: user?.phone || '+91 98765 43210',
      line1: 'Flat 402, Sunshine Heights',
      line2: 'Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postal_code: '400050',
      country: 'India',
    },
  ]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState<ShippingAddress>({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    line1: '',
    line2: '',
    city: '',
    state: 'Maharashtra',
    postal_code: '',
    country: 'India',
  });

  if (!user) {
    return <CustomerAuth />;
  }

  const userOrders = orders.filter(
    (o) =>
      o.customer_email.toLowerCase() === user.email.toLowerCase() || o.user_id === user.id
  );

  const singleOrder = orderNumberParam
    ? orders.find((o) => o.order_number === orderNumberParam || o.id === orderNumberParam)
    : null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({ full_name: fullName.trim(), phone: phone.trim() });
    setProfileMessage('Profile updated successfully!');
    setTimeout(() => setProfileMessage(null), 3000);
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.line1 || !newAddress.city || !newAddress.postal_code) return;
    setSavedAddresses((prev) => [...prev, newAddress]);
    setShowAddressForm(false);
    setNewAddress({
      full_name: user.full_name || '',
      phone: user.phone || '',
      line1: '',
      line2: '',
      city: '',
      state: 'Maharashtra',
      postal_code: '',
      country: 'India',
    });
  };

  if (singleOrder) {
    const statusSteps = ['pending', 'processing', 'shipped', 'delivered'];
    const currentStepIndex = Math.max(0, statusSteps.indexOf(singleOrder.status));

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans text-[#18181B]">
        <div className="flex justify-between items-center border-b border-[#E5E4DF] pb-4">
          <div>
            <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#1D4ED8]">
              Order Confirmation &amp; Tracking
            </span>
            <h1 className="font-space font-bold text-2xl text-[#18181B] mt-0.5">
              Order #{singleOrder.order_number}
            </h1>
          </div>
          <Link
            to="/account"
            className="text-xs font-space font-semibold text-[#1D4ED8] hover:underline flex items-center gap-1"
          >
            ← Back to Orders
          </Link>
        </div>

        {/* Light Status Banner */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-xs font-medium text-[#64748B]">Fulfillment Status</span>
              <h2 className="font-space font-bold text-xl capitalize text-[#1D4ED8]">
                {singleOrder.status}
              </h2>
            </div>
            <div className="sm:text-right text-xs">
              <p className="text-[#64748B]">Placed on</p>
              <p className="font-mono font-semibold text-[#18181B]">
                {new Date(singleOrder.created_at).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>

          {/* Timeline Bar */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs capitalize pt-1">
            {statusSteps.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              return (
                <div key={step} className="space-y-1.5">
                  <div
                    className={`h-2 rounded-full transition-colors ${
                      isCompleted ? 'bg-[#1D4ED8]' : 'bg-[#E5E4DF]'
                    }`}
                  />
                  <span
                    className={
                      isCompleted ? 'text-[#1D4ED8] font-semibold' : 'text-[#94A3B8]'
                    }
                  >
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          {singleOrder.tracking_number && (
            <div className="p-3.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg text-xs font-mono flex items-center justify-between text-[#1E3A8A]">
              <span>
                Courier Tracking ID: <strong>{singleOrder.tracking_number}</strong>
              </span>
              <span className="font-sans font-semibold">Live Tracked</span>
            </div>
          )}
        </div>

        {/* Address & Payment Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-5 space-y-3">
            <h3 className="font-space font-bold text-xs uppercase tracking-wider border-b border-[#E5E4DF] pb-2 flex items-center gap-2 text-[#18181B]">
              <MapPin size={14} className="text-[#1D4ED8]" /> Shipping Destination
            </h3>
            <div className="text-xs text-[#52525B] space-y-1">
              <p className="font-semibold text-[#18181B]">
                {singleOrder.shipping_address.full_name}
              </p>
              <p>{singleOrder.shipping_address.line1}</p>
              {singleOrder.shipping_address.line2 && (
                <p>{singleOrder.shipping_address.line2}</p>
              )}
              <p>
                {singleOrder.shipping_address.city}, {singleOrder.shipping_address.state} -{' '}
                <span className="font-mono">{singleOrder.shipping_address.postal_code}</span>
              </p>
              <p className="pt-1 font-mono text-[#64748B]">
                Phone: {singleOrder.customer_phone}
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#E5E4DF] rounded-xl p-5 space-y-3">
            <h3 className="font-space font-bold text-xs uppercase tracking-wider border-b border-[#E5E4DF] pb-2 text-[#18181B]">
              Payment Breakdown
            </h3>
            <div className="text-xs space-y-2 tabular-nums">
              <div className="flex justify-between text-[#52525B]">
                <span>Payment Method</span>
                <span className="font-semibold uppercase text-[#18181B]">
                  {singleOrder.payment_method}
                </span>
              </div>
              <div className="flex justify-between text-[#52525B]">
                <span>Payment Status</span>
                <span
                  className={`font-semibold capitalize ${
                    singleOrder.payment_status === 'paid'
                      ? 'text-[#15803D]'
                      : 'text-amber-700'
                  }`}
                >
                  {singleOrder.payment_status}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E5E4DF] text-sm font-bold text-[#18181B]">
                <span>Total Amount</span>
                <span className="text-[#1D4ED8]">
                  ₹{singleOrder.total_amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
          <h3 className="font-space font-bold text-sm border-b border-[#E5E4DF] pb-3 text-[#18181B]">
            Purchased Apparel Items ({singleOrder.items?.length || 0})
          </h3>

          <div className="divide-y divide-[#E5E4DF]">
            {singleOrder.items?.map((item) => (
              <div
                key={item.id}
                className="py-3 flex justify-between items-center text-xs tabular-nums"
              >
                <div>
                  <p className="font-space font-semibold text-sm text-[#18181B]">
                    {item.product_name}
                  </p>
                  <p className="text-[#64748B] text-xs mt-0.5">
                    {item.size ? `Size: ${item.size}` : ''}{' '}
                    {item.color ? `· Color: ${item.color}` : ''} · Qty: {item.quantity}
                  </p>
                </div>
                <span className="font-space font-bold text-sm text-[#18181B]">
                  ₹{item.total_price.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans text-[#18181B]">
      {/* Header */}
      <div className="border-b border-[#E5E4DF] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#1D4ED8]">
            Form &amp; Fit Member Portal
          </span>
          <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
            Welcome, {user.full_name || 'Valued Member'}
          </h1>
        </div>

        {isOwner && (
          <Link
            to="/owner/dashboard"
            className="px-4 py-2 bg-[#1D4ED8] text-white font-space text-xs font-semibold rounded-md flex items-center gap-2 hover:bg-[#1E40AF] transition-colors"
          >
            <ShieldCheck size={16} /> Owner Admin Panel
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="md:col-span-3 bg-white border border-[#E5E4DF] rounded-xl p-5 space-y-4">
          <div className="border-b border-[#E5E4DF] pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#EEF2FF] text-[#1D4ED8] flex items-center justify-center font-space font-bold text-sm uppercase shrink-0">
                {(user.full_name || user.email).charAt(0)}
              </div>
              <div className="truncate">
                <p className="font-space font-semibold text-sm text-[#18181B] truncate">
                  {user.full_name || 'Member'}
                </p>
                <p className="text-xs text-[#64748B] truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full text-left py-2.5 px-3 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#EEF2FF] text-[#1D4ED8] font-semibold'
                  : 'text-[#52525B] hover:bg-[#F3F2EE]'
              }`}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag size={15} /> My Orders ({userOrders.length})
              </span>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left py-2.5 px-3 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#EEF2FF] text-[#1D4ED8] font-semibold'
                  : 'text-[#52525B] hover:bg-[#F3F2EE]'
              }`}
            >
              <span className="flex items-center gap-2">
                <User size={15} /> Profile &amp; Contact
              </span>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
              className={`w-full text-left py-2.5 px-3 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-[#EEF2FF] text-[#1D4ED8] font-semibold'
                  : 'text-[#52525B] hover:bg-[#F3F2EE]'
              }`}
            >
              <span className="flex items-center gap-2">
                <MapPin size={15} /> Saved Addresses
              </span>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => setActiveTab('wishlist')}
              className={`w-full text-left py-2.5 px-3 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                activeTab === 'wishlist'
                  ? 'bg-[#EEF2FF] text-[#1D4ED8] font-semibold'
                  : 'text-[#52525B] hover:bg-[#F3F2EE]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Heart size={15} /> Wishlist ({wishlist.length})
              </span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="pt-3 border-t border-[#E5E4DF]">
            <button
              onClick={logout}
              className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>

        {/* Content Panel */}
        <div className="md:col-span-9 space-y-6">
          <AnimatePresence mode="wait">
            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-6"
              >
                <div className="flex justify-between items-center border-b border-[#E5E4DF] pb-3">
                  <h3 className="font-space font-bold text-base text-[#18181B]">
                    My Orders &amp; Fulfillment
                  </h3>
                  <span className="text-xs font-mono text-[#64748B]">
                    {userOrders.length} record(s)
                  </span>
                </div>

                {userOrders.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <ShoppingBag size={40} className="mx-auto text-[#94A3B8]" />
                    <h4 className="font-space font-bold text-base text-[#18181B]">
                      No Orders Placed Yet
                    </h4>
                    <p className="text-xs text-[#64748B] font-sans max-w-xs mx-auto">
                      Explore our tailored cotton garments and custom printing studio to place your first order.
                    </p>
                    <Link
                      to="/shop"
                      className="inline-block px-6 py-2.5 bg-[#1D4ED8] text-white font-space text-xs font-semibold rounded-md hover:bg-[#1E40AF] transition-colors"
                    >
                      Shop Catalog
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E4DF]">
                    {userOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-[#FAF9F6] px-2 rounded-lg transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-space font-bold text-sm text-[#18181B]">
                              Order #{ord.order_number}
                            </span>
                            <span className="text-xs font-semibold capitalize text-[#1D4ED8]">
                              · {ord.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B]">
                            Placed {new Date(ord.created_at).toLocaleDateString('en-IN')} ·{' '}
                            {ord.items?.length || 0} item(s)
                          </p>
                        </div>

                        <div className="flex items-center gap-4 tabular-nums">
                          <span className="font-space font-bold text-base text-[#18181B]">
                            ₹{ord.total_amount.toLocaleString('en-IN')}
                          </span>
                          <Link
                            to={`/account/orders/${ord.order_number}`}
                            className="px-4 py-2 bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] font-space text-xs font-semibold rounded-md hover:border-[#1D4ED8] hover:text-[#1D4ED8] transition-colors flex items-center gap-1"
                          >
                            View Details <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-6"
              >
                <div className="border-b border-[#E5E4DF] pb-3">
                  <h3 className="font-space font-bold text-base text-[#18181B]">
                    Profile &amp; Contact Details
                  </h3>
                </div>

                {profileMessage && (
                  <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-xs font-medium text-[#166534] flex items-center gap-2">
                    <CheckCircle2 size={16} /> {profileMessage}
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md text-xs">
                  <div className="space-y-1">
                    <label className="block font-medium text-[#52525B]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-md p-2.5 focus:outline-none focus:border-[#1D4ED8]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-[#52525B]">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user.email}
                      className="w-full bg-[#F3F2EE] border border-[#E5E4DF] rounded-md p-2.5 text-[#71717A] font-mono cursor-not-allowed"
                    />
                    <p className="text-[11px] text-[#94A3B8]">
                      Email address is linked to your account credentials.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-medium text-[#52525B]">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-md p-2.5 focus:outline-none focus:border-[#1D4ED8] font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#1D4ED8] text-white font-space font-semibold text-xs rounded-md hover:bg-[#1E40AF] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Save size={15} /> Save Profile Changes
                  </button>
                </form>
              </motion.div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <motion.div
                key="addresses"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-6"
              >
                <div className="flex justify-between items-center border-b border-[#E5E4DF] pb-3">
                  <h3 className="font-space font-bold text-base text-[#18181B]">
                    Saved Shipping Addresses
                  </h3>
                  <button
                    onClick={() => setShowAddressForm(!showAddressForm)}
                    className="px-3.5 py-1.5 bg-[#1D4ED8] text-white font-space text-xs font-semibold rounded-md flex items-center gap-1 hover:bg-[#1E40AF] cursor-pointer"
                  >
                    <Plus size={14} /> Add Address
                  </button>
                </div>

                {showAddressForm && (
                  <form
                    onSubmit={handleAddAddress}
                    className="p-4 bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg space-y-3 text-xs"
                  >
                    <h4 className="font-space font-semibold text-sm text-[#18181B]">
                      New Delivery Address
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Recipient Name"
                        value={newAddress.full_name}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, full_name: e.target.value })
                        }
                        className="bg-white border border-[#D6D5CE] rounded-md p-2.5"
                      />
                      <input
                        type="tel"
                        required
                        placeholder="Phone Number"
                        value={newAddress.phone}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, phone: e.target.value })
                        }
                        className="bg-white border border-[#D6D5CE] rounded-md p-2.5"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Flat, House / Building Name"
                      value={newAddress.line1}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, line1: e.target.value })
                      }
                      className="w-full bg-white border border-[#D6D5CE] rounded-md p-2.5"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="City"
                        value={newAddress.city}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, city: e.target.value })
                        }
                        className="bg-white border border-[#D6D5CE] rounded-md p-2.5"
                      />
                      <input
                        type="text"
                        required
                        placeholder="State"
                        value={newAddress.state}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, state: e.target.value })
                        }
                        className="bg-white border border-[#D6D5CE] rounded-md p-2.5"
                      />
                      <input
                        type="text"
                        required
                        placeholder="PIN Code"
                        value={newAddress.postal_code}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, postal_code: e.target.value })
                        }
                        className="bg-white border border-[#D6D5CE] rounded-md p-2.5 font-mono"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddressForm(false)}
                        className="px-4 py-2 bg-white border border-[#D6D5CE] rounded-md text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#1D4ED8] text-white rounded-md font-space text-xs font-semibold cursor-pointer"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedAddresses.map((addr, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg space-y-1 text-xs text-[#52525B]"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-space font-semibold text-sm text-[#18181B]">
                          {addr.full_name}
                        </span>
                        {idx === 0 && (
                          <span className="text-[#1D4ED8] font-medium text-[11px]">
                            Default
                          </span>
                        )}
                      </div>
                      <p>{addr.line1}</p>
                      {addr.line2 && <p>{addr.line2}</p>}
                      <p>
                        {addr.city}, {addr.state} -{' '}
                        <span className="font-mono">{addr.postal_code}</span>
                      </p>
                      <p className="font-mono text-[#64748B] pt-1">Phone: {addr.phone}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Wishlist Tab */}
            {activeTab === 'wishlist' && (
              <motion.div
                key="wishlist"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-6"
              >
                <div className="border-b border-[#E5E4DF] pb-3">
                  <h3 className="font-space font-bold text-base text-[#18181B]">
                    My Saved Wishlist ({wishlist.length})
                  </h3>
                </div>

                {wishlist.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Heart size={40} className="mx-auto text-[#94A3B8]" />
                    <h4 className="font-space font-bold text-base text-[#18181B]">
                      Your Wishlist is Empty
                    </h4>
                    <p className="text-xs text-[#64748B] font-sans max-w-xs mx-auto">
                      Save items while browsing to compare styles and sizes.
                    </p>
                    <Link
                      to="/shop"
                      className="inline-block px-6 py-2.5 bg-[#1D4ED8] text-white font-space text-xs font-semibold rounded-md hover:bg-[#1E40AF] transition-colors"
                    >
                      Explore Catalog
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {wishlist.map((item) => (
                      <div
                        key={item.id}
                        className="bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg p-3.5 space-y-2"
                      >
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="block font-space font-semibold text-sm text-[#18181B] truncate hover:text-[#1D4ED8]"
                        >
                          {item.product.name}
                        </Link>
                        <p className="font-space font-bold text-xs text-[#18181B] tabular-nums">
                          ₹
                          {(
                            item.product.sale_price || item.product.regular_price
                          ).toLocaleString('en-IN')}
                        </p>
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="block text-center py-2 bg-[#1D4ED8] text-white font-space text-xs font-semibold rounded-md hover:bg-[#1E40AF] transition-colors"
                        >
                          View Product
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
