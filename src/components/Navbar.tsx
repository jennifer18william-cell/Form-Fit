import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { CartDrawer } from './CartDrawer';
import { BrandLogo } from './BrandLogo';
import {
  CANONICAL_DEFAULT_SLUGS,
  getCategoryCanonicalKey,
} from '../lib/categoryMapping';
import {
  ShoppingBag,
  Heart,
  User,
  Search,
  Menu,
  X,
  ShieldCheck,
  Settings,
  ChevronRight,
  ChevronDown,
  LogOut,
  Truck,
  Bell,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { cart, wishlist, storeSettings, categories } = useStore();
  const { user, isAdmin, logout } = useAuth();
  const { unreadCount, setIsDrawerOpen: setIsNotificationsOpen } = useNotifications();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFootwearMenuOpen, setIsFootwearMenuOpen] = useState(false);
  const [isCollectionsMenuOpen, setIsCollectionsMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const isFootwearActive =
    location.search.includes('category=cat-9') ||
    location.search.includes('gender=Footwear');
  const isAccessoriesActive =
    location.search.includes('category=cat-10') || location.search.includes('gender=Accessories');

  const customOwnerCollections = categories.filter(
    (c) =>
      !c.parent_id &&
      !CANONICAL_DEFAULT_SLUGS.has(getCategoryCanonicalKey(c.id, categories, c))
  );

  const mobileCategoryLinks = categories.filter((c) => {
    if (c.parent_id) return false;
    const key = getCategoryCanonicalKey(c.id, categories, c);
    return !['mens-fashion', 'womens-fashion', 'unisex', 'footwear', 'accessories'].includes(key);
  });

  const hasCustomAnnouncement =
    Boolean(storeSettings.announcement_text?.trim()) &&
    storeSettings.announcement_text?.trim() !==
      'Free Shipping on All Orders Over ₹1,999 across India | Use Code: FORM10 for 10% Off';

  return (
    <header className="sticky top-0 z-40 bg-[#FCF9F5]/95 backdrop-blur-md border-b border-[#E6E0D6]">
      {/* Top Announcement Bar */}
      {storeSettings.announcement_enabled && (
        <div className="bg-[#111111] text-white py-2 px-4 text-[10px] sm:text-[11px] font-space font-bold uppercase tracking-wider">
          <div className="max-w-[1440px] mx-auto flex items-center justify-center">
            {hasCustomAnnouncement ? (
              <div className="flex items-center justify-center gap-2 truncate text-center">
                <Truck size={13} className="text-[#B8F130] shrink-0" />
                <span className="truncate">{storeSettings.announcement_text}</span>
              </div>
            ) : (
              <>
                <div className="hidden xl:flex items-center justify-center gap-5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <Truck size={13} className="text-white/85 shrink-0" />
                    <span>
                      ORDERS OVER ₹1,999 ACROSS INDIA | USE CODE:{' '}
                      <span className="text-[#B8F130]">FORM10</span> FOR 10% OFF
                    </span>
                  </span>
                  <span className="text-[#B8F130]" aria-hidden="true">|</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Truck size={13} className="text-white/85 shrink-0" />
                    <span>FREE EXPRESS COURIER SHIPPING OVER ₹1,999</span>
                  </span>
                  <span className="text-[#B8F130]" aria-hidden="true">|</span>
                  <span className="text-[#B8F130]">240 GSM HEAVYWEIGHT COMBED COTTON DROP</span>
                  <span className="text-[#B8F130]" aria-hidden="true">|</span>
                  <span>INTERACTIVE 2D CUSTOM STUDIO LIVE</span>
                </div>

                <div className="xl:hidden flex items-center justify-center gap-2 truncate text-center">
                  <Truck size={13} className="text-[#B8F130] shrink-0" />
                  <span className="truncate">
                    {storeSettings.announcement_text ||
                      'ORDERS OVER ₹1,999 ACROSS INDIA | USE CODE: FORM10 FOR 10% OFF'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Header Row */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 xl:gap-6 h-18 sm:h-20">
          {/* Mobile Menu Toggle & Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 text-[#111111] hover:text-[#65A30D] transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <Link
              to="/"
              className="flex items-center whitespace-nowrap shrink-0 group"
              aria-label="PatanaKart Home"
            >
              <BrandLogo size="md" subtitle="FASHION FOR EVERY YOU" />
            </Link>
          </div>

          {/* Desktop Navigation Links (including Footwear & Accessories) */}
          <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs font-space font-bold uppercase tracking-wider text-[#111111]">
            <Link
              to="/"
              className={`hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                location.pathname === '/'
                  ? 'border-[#9ED912] text-[#111111]'
                  : 'border-transparent'
              }`}
            >
              HOME
            </Link>
            <Link
              to="/shop"
              className={`hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                location.pathname === '/shop' && !location.search
                  ? 'border-[#9ED912] text-[#111111]'
                  : 'border-transparent'
              }`}
            >
              SHOP ALL
            </Link>
            <Link
              to="/shop?gender=Men"
              className={`hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                location.search.includes('gender=Men')
                  ? 'border-[#9ED912] text-[#111111]'
                  : 'border-transparent'
              }`}
            >
              MEN
            </Link>
            <Link
              to="/shop?gender=Women"
              className={`hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                location.search.includes('gender=Women')
                  ? 'border-[#9ED912] text-[#111111]'
                  : 'border-transparent'
              }`}
            >
              WOMEN
            </Link>
            <Link
              to="/shop?gender=Unisex"
              className={`hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                location.search.includes('gender=Unisex')
                  ? 'border-[#9ED912] text-[#111111]'
                  : 'border-transparent'
              }`}
            >
              UNISEX
            </Link>
            <div
              className="relative"
              onMouseEnter={() => setIsFootwearMenuOpen(true)}
              onMouseLeave={() => setIsFootwearMenuOpen(false)}
            >
              <Link
                to="/shop?category=cat-9"
                onClick={() => setIsFootwearMenuOpen(false)}
                className={`hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 inline-flex items-center gap-1 ${
                  isFootwearActive
                    ? 'border-[#9ED912] text-[#111111]'
                    : 'border-transparent'
                }`}
              >
                <span>FOOTWEAR</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-150 ${isFootwearMenuOpen ? 'rotate-180 text-[#65A30D]' : ''}`}
                />
              </Link>

              {isFootwearMenuOpen && (
                <div className="absolute left-0 top-full pt-2 w-56 z-50">
                  <div className="bg-white border border-[#E5E4DF] rounded-lg shadow-lg py-2 text-xs font-sans normal-case tracking-normal text-[#18181B]">
                    <div className="px-3.5 py-1.5 text-[10px] font-space font-bold uppercase tracking-wider text-[#65A30D] border-b border-[#F3F2EE]">
                      Footwear Zone
                    </div>
                    <Link
                      to="/shop?category=cat-9"
                      onClick={() => setIsFootwearMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F4FBE1] transition-colors ${
                        location.search === '?category=cat-9' ? 'font-semibold text-[#3F6212] bg-[#FAF9F6]' : 'font-medium text-[#18181B]'
                      }`}
                    >
                      <span>All Footwear Zone</span>
                      <ChevronRight size={13} className="text-[#94A3B8]" />
                    </Link>
                    <Link
                      to="/shop?category=cat-9-men"
                      onClick={() => setIsFootwearMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F4FBE1] transition-colors ${
                        location.search.includes('category=cat-9-men') ? 'font-semibold text-[#3F6212] bg-[#FAF9F6]' : 'font-medium text-[#18181B]'
                      }`}
                    >
                      <span>Men's Footwear</span>
                      <ChevronRight size={13} className="text-[#94A3B8]" />
                    </Link>
                    <Link
                      to="/shop?category=cat-9-women"
                      onClick={() => setIsFootwearMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F4FBE1] transition-colors ${
                        location.search.includes('category=cat-9-women') ? 'font-semibold text-[#3F6212] bg-[#FAF9F6]' : 'font-medium text-[#18181B]'
                      }`}
                    >
                      <span>Women's Footwear</span>
                      <ChevronRight size={13} className="text-[#94A3B8]" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Link
              to="/shop?category=cat-10"
              className={`hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                isAccessoriesActive
                  ? 'border-[#9ED912] text-[#111111]'
                  : 'border-transparent'
              }`}
            >
              ACCESSORIES
            </Link>

            {customOwnerCollections.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() => setIsCollectionsMenuOpen(true)}
                onMouseLeave={() => setIsCollectionsMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsCollectionsMenuOpen(!isCollectionsMenuOpen)}
                  className="hover:text-[#65A30D] transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent inline-flex items-center gap-1 uppercase cursor-pointer"
                >
                  <span>COLLECTIONS</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-150 ${
                      isCollectionsMenuOpen ? 'rotate-180 text-[#65A30D]' : ''
                    }`}
                  />
                </button>

                {isCollectionsMenuOpen && (
                  <div className="absolute left-0 top-full pt-2 w-56 z-50">
                    <div className="bg-white border border-[#E5E4DF] rounded-lg shadow-lg py-2 text-xs font-sans normal-case tracking-normal text-[#18181B]">
                      <div className="px-3.5 py-1.5 text-[10px] font-space font-bold uppercase tracking-wider text-[#65A30D] border-b border-[#F3F2EE]">
                        Featured Collections
                      </div>
                      {customOwnerCollections.map((col) => (
                        <Link
                          key={col.id}
                          to={`/shop?category=${encodeURIComponent(col.id)}`}
                          onClick={() => setIsCollectionsMenuOpen(false)}
                          className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F4FBE1] font-medium text-[#18181B] transition-colors"
                        >
                          <span className="truncate">{col.name}</span>
                          <ChevronRight size={13} className="text-[#94A3B8] shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Link
              to="/custom-studio"
              className="ml-1 px-4 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-md font-space font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-2xs"
            >
              <Settings size={14} className="shrink-0" />
              <span>CUSTOM STUDIO</span>
            </Link>
          </nav>

          {/* Right Storefront Affordances */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Search Toggle */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-[#111111] hover:bg-[#F3EFE8] rounded-md transition-colors cursor-pointer"
              aria-label="Search store"
            >
              <Search size={19} strokeWidth={2} />
            </button>

            {/* Notifications Bell Icon */}
            <button
              type="button"
              onClick={() => setIsNotificationsOpen(true)}
              className="p-2 text-[#111111] hover:bg-[#F3EFE8] rounded-md transition-colors relative cursor-pointer"
              aria-label="Open notifications"
              title="Notifications & Alerts"
            >
              <Bell size={19} strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-[#B8F130] text-[#111111] text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center pointer-events-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Wishlist Icon */}
            <Link
              to="/wishlist"
              className="p-2 text-[#111111] hover:bg-[#F3EFE8] rounded-md transition-colors relative"
              aria-label="Wishlist"
            >
              <Heart size={19} strokeWidth={2} />
              {wishlist.length > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-[#B8F130] text-[#111111] text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>

            {/* Shopping Bag Icon */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsCartOpen(true);
              }}
              className="p-2 text-[#111111] hover:bg-[#F3EFE8] rounded-md active:scale-95 transition-all duration-150 relative cursor-pointer touch-manipulation select-none"
              aria-label="Open shopping bag"
              title="Shopping Bag"
            >
              <ShoppingBag size={19} strokeWidth={2} />
              {totalCartCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-[#B8F130] text-[#111111] text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center pointer-events-none">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Account / Admin Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`p-2 rounded-md transition-colors cursor-pointer border ${
                  isAdmin
                    ? 'border-[#9ED912] bg-[#B8F130]/25 text-[#111111]'
                    : 'border-transparent text-[#111111] hover:bg-[#F3EFE8]'
                }`}
                title={user ? `${user.full_name || user.email}` : 'Account'}
                aria-label="Account menu"
              >
                {isAdmin ? <ShieldCheck size={19} /> : <User size={19} strokeWidth={2} />}
              </button>

              {/* User Menu Popup */}
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 bg-white border border-[#E5E4DF] rounded-lg shadow-lg py-2 z-50 text-xs font-sans text-[#18181B]"
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  {isAdmin && (
                    <div className="px-3.5 py-2 bg-[#B8F130]/30 text-[#111111] font-semibold text-[11px] flex items-center justify-between mb-1">
                      <span>Store Owner Access</span>
                      <ShieldCheck size={13} />
                    </div>
                  )}

                  {user ? (
                    <div className="px-3.5 py-2 border-b border-[#E5E4DF]">
                      <p className="font-semibold text-[#18181B] truncate">{user.full_name || 'Customer'}</p>
                      <p className="text-[11px] text-[#71717A] truncate">{user.email}</p>
                    </div>
                  ) : null}

                  {isAdmin && (
                    <Link
                      to="/owner/dashboard"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F3F2EE] font-semibold text-[#18181B] transition-colors"
                    >
                      <span>Owner Dashboard</span>
                      <ChevronRight size={14} />
                    </Link>
                  )}

                  <Link
                    to="/account"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block px-3.5 py-2.5 hover:bg-[#F3F2EE] text-[#18181B] font-medium transition-colors"
                  >
                    My Account &amp; Orders
                  </Link>

                  <Link
                    to="/account?tab=notifications"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F3F2EE] text-[#18181B] font-medium transition-colors"
                  >
                    <span>Notifications &amp; SMS Alerts</span>
                    {unreadCount > 0 && (
                      <span className="font-mono font-bold text-[11px] text-[#3F6212]">
                        {unreadCount} new
                      </span>
                    )}
                  </Link>

                  {!user && (
                    <Link
                      to="/owner/login"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-3.5 py-2.5 hover:bg-[#B8F130]/20 font-semibold text-[#18181B] transition-colors"
                    >
                      Owner / Admin Login
                    </Link>
                  )}

                  {user && (
                    <button
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        await logout();
                        navigate('/login', { replace: true });
                      }}
                      className="w-full text-left flex items-center gap-2 px-3.5 py-2.5 text-red-600 hover:bg-red-50 font-medium border-t border-[#E5E4DF] mt-1 cursor-pointer"
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Search Input Bar */}
      {isSearchOpen && (
        <div className="border-t border-[#E5E4DF] bg-[#FAF9F6] p-4 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex gap-2">
            <input
              type="text"
              placeholder="Search products by title, fabric, category, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-white border border-[#D6D5CE] px-4 py-2.5 text-sm text-[#18181B] placeholder-[#71717A] focus:outline-none focus:border-[#111111] rounded-md"
              autoFocus
            />
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer rounded-md whitespace-nowrap shrink-0"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E5E4DF] bg-white px-4 pt-4 pb-6 space-y-2.5 font-space text-xs font-bold uppercase tracking-wider text-[#111111] shadow-lg">
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 border-b border-[#E5E4DF] hover:text-[#65A30D] transition-colors"
          >
            Home
          </Link>
          <Link
            to="/shop"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 border-b border-[#E5E4DF] hover:text-[#65A30D] transition-colors"
          >
            Shop All
          </Link>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Link
              to="/shop?gender=Men"
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 px-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-md hover:border-[#9ED912]"
            >
              Men
            </Link>
            <Link
              to="/shop?gender=Women"
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 px-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-md hover:border-[#9ED912]"
            >
              Women
            </Link>
            <Link
              to="/shop?gender=Unisex"
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 px-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-md hover:border-[#9ED912]"
            >
              Unisex
            </Link>
            <Link
              to="/shop?category=cat-10"
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2 px-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-md hover:border-[#9ED912]"
            >
              Accessories
            </Link>
          </div>

          {/* Dedicated Mobile Footwear Zone Subcategories */}
          <div className="p-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-space font-bold uppercase tracking-wider text-[#4D7C0F]">
                Footwear Zone
              </span>
              <Link
                to="/shop?category=cat-9"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-[10px] font-sans font-semibold normal-case tracking-normal text-[#52525B] hover:text-[#111111]"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/shop?category=cat-9-men"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-2.5 bg-white border border-[#E5E4DF] rounded-md hover:border-[#9ED912] text-[11px] truncate"
              >
                Men's Footwear
              </Link>
              <Link
                to="/shop?category=cat-9-women"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-2.5 bg-white border border-[#E5E4DF] rounded-md hover:border-[#9ED912] text-[11px] truncate"
              >
                Women's Footwear
              </Link>
            </div>
          </div>

          <Link
            to="/custom-studio"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-center gap-2 py-3 px-4 text-[#111111] bg-[#B8F130] font-extrabold rounded-md hover:bg-[#AAE422] transition-colors mt-2"
          >
            <Settings size={15} /> Custom Studio
          </Link>

          <div className="pt-2 text-[10px] text-[#71717A] font-sans font-semibold normal-case tracking-normal">
            Collections &amp; Categories
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-sans font-medium normal-case tracking-normal">
            {mobileCategoryLinks.map((cat) => (
              <Link
                key={cat.id}
                to={`/shop?category=${encodeURIComponent(cat.id)}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 px-3 bg-[#FAF9F6] border border-[#E5E4DF] text-[#18181B] hover:border-[#9ED912] transition-colors rounded-md truncate"
              >
                {cat.name}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-[#E5E4DF] space-y-2">
            {user && (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/account"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="py-2.5 px-3 bg-[#FAF9F6] text-[#111111] border border-[#E5E4DF] font-semibold text-center text-xs flex items-center justify-center gap-1.5 rounded-md hover:border-[#9ED912] transition-colors"
                >
                  <User size={14} /> My Account
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setIsMobileMenuOpen(false);
                    await logout();
                    navigate('/login', { replace: true });
                  }}
                  className="py-2.5 px-3 bg-red-50 text-red-700 border border-red-200 font-semibold text-center text-xs flex items-center justify-center gap-1.5 rounded-md hover:bg-red-100 transition-colors cursor-pointer uppercase"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
            <Link
              to="/owner/dashboard"
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2.5 bg-[#FAF9F6] text-[#111111] border border-[#D6D5CE] font-semibold text-center text-xs flex items-center justify-center gap-2 rounded-md hover:bg-[#F3F2EE] transition-colors"
            >
              <ShieldCheck size={15} /> Owner Admin Panel
            </Link>
          </div>
        </div>
      )}

      {/* Cart Slide-over */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>
  );
};
