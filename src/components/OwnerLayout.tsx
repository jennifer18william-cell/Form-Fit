import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { SupabaseBanner } from './SupabaseBanner';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  FolderTree,
  ShoppingBag,
  Ticket,
  Sliders,
  ExternalLink,
  ShieldCheck,
  LogOut,
  PlusCircle,
  Menu,
  X,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

export const OwnerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const { products, orders } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const navLinks = [
    { label: 'Overview', path: '/owner/dashboard', icon: LayoutDashboard },
    { label: 'Products Catalog', path: '/owner/products', icon: Package, badge: products.length },
    { label: 'Inventory Stock', path: '/owner/inventory', icon: Boxes },
    { label: 'Categories', path: '/owner/categories', icon: FolderTree },
    {
      label: 'Orders & Fulfillment',
      path: '/owner/orders',
      icon: ShoppingBag,
      badge: orders.filter((o) => o.status === 'pending').length,
    },
    { label: 'Promo Coupons', path: '/owner/coupons', icon: Ticket },
    { label: 'Content & Settings', path: '/owner/settings', icon: Sliders },
  ];

  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
  const lowStockCount = products
    .flatMap((p) => p.variants || [])
    .filter((v) => v.stock_quantity <= 5).length;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#18181B] font-sans flex flex-col selection:bg-[#B8F130] selection:text-[#111111]">
      {/* Supabase / Storage status strip */}
      <SupabaseBanner />

      {/* Top Header */}
      <header className="bg-white text-[#18181B] border-b border-[#E5E4DF] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            <div className="flex items-center gap-3">
              {/* Mobile Sidebar Toggle */}
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="lg:hidden p-2 text-[#18181B] hover:text-[#4D7C0F] hover:bg-[#FAF9F6] rounded-lg transition-colors cursor-pointer"
                aria-label="Toggle navigation"
              >
                {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>

              <Link
                to="/owner/dashboard"
                className="flex items-center gap-2 font-space font-bold text-base sm:text-lg tracking-tight text-[#18181B] whitespace-nowrap shrink-0"
              >
                <ShieldCheck size={20} className="text-[#4D7C0F]" />
                <span>Form &amp; Fit Admin</span>
              </Link>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex items-center gap-3 text-xs">
              {pendingOrdersCount > 0 && (
                <Link
                  to="/owner/orders"
                  className="hidden sm:flex items-center gap-1.5 text-[#B45309] hover:text-[#92400E] font-medium whitespace-nowrap shrink-0 tabular-nums"
                >
                  <ShoppingBag size={14} />
                  <span>{pendingOrdersCount} Pending</span>
                </Link>
              )}

              {lowStockCount > 0 && (
                <Link
                  to="/owner/inventory"
                  className="hidden sm:flex items-center gap-1.5 text-[#DC2626] hover:text-[#991B1B] font-medium whitespace-nowrap shrink-0 tabular-nums"
                >
                  <AlertTriangle size={14} />
                  <span>{lowStockCount} Low Stock</span>
                </Link>
              )}

              <Link
                to="/owner/products/new"
                className="px-3.5 py-2 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <PlusCircle size={14} /> New Product
              </Link>

              <Link
                to="/"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-[#FAF9F6] hover:bg-[#F3F2EE] border border-[#E5E4DF] text-[#18181B] rounded-lg font-medium text-xs transition-colors whitespace-nowrap shrink-0"
                title="Open customer storefront"
              >
                <ExternalLink size={13} /> View Store
              </Link>

              <button
                onClick={() => {
                  logout();
                  navigate('/owner/login');
                }}
                className="p-2 text-[#52525B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer shrink-0"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 space-y-4">
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-4 space-y-3">
            <div className="px-2 pb-2 border-b border-[#E5E4DF] text-[#64748B] font-space font-semibold text-xs flex items-center justify-between">
              <span>Store Management</span>
              <ShieldCheck size={14} className="text-[#4D7C0F]" />
            </div>

            <nav className="space-y-1 text-sm">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                  location.pathname === link.path ||
                  (link.path === '/owner/products' && location.pathname.startsWith('/owner/products'));
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#F4FBE1] text-[#3F6212] border border-[#BEF264] font-semibold'
                        : 'text-[#52525B] hover:text-[#18181B] hover:bg-[#FAF9F6] font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon size={16} className="shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </span>
                    {link.badge !== undefined && link.badge > 0 && (
                      <span
                        className={`font-mono text-xs tabular-nums shrink-0 ${
                          isActive ? 'text-[#3F6212] font-bold' : 'text-[#64748B]'
                        }`}
                      >
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="bg-white border border-[#E5E4DF] rounded-xl p-4 space-y-2 text-xs font-sans">
            <p className="font-space font-semibold text-[#64748B]">Catalog Summary</p>
            <p className="text-sm font-semibold text-[#18181B]">Form &amp; Fit Live Storefront</p>
            <p className="text-xs text-[#52525B] tabular-nums">
              {products.filter((p) => p.status === 'published').length} published products online
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-[#4D7C0F] hover:text-[#3F6212] transition-colors"
            >
              Open Customer Storefront →
            </Link>
          </div>
        </aside>

        {/* Mobile Nav Drawer */}
        {isMobileSidebarOpen && (
          <div className="lg:hidden col-span-12 bg-white border border-[#E5E4DF] rounded-xl p-3 space-y-1 text-sm">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#F4FBE1] text-[#3F6212] border border-[#BEF264] font-semibold'
                      : 'text-[#52525B] hover:bg-[#FAF9F6] hover:text-[#18181B] font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon size={16} /> {link.label}
                  </span>
                  <ChevronRight size={14} />
                </Link>
              );
            })}
            <div className="pt-2 mt-2 border-t border-[#E5E4DF]">
              <Link
                to="/"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-[#3F6212] font-semibold hover:bg-[#F4FBE1]"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink size={15} /> Open Customer Storefront
                </span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* Content Panel */}
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="col-span-12 lg:col-span-9"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};
