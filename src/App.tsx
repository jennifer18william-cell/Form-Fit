import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { StoreProvider } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Customer Pages
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetail } from './pages/ProductDetail';
import { CustomStudio } from './pages/CustomStudio';
import { CartPage } from './pages/CartPage';
import { Checkout } from './pages/Checkout';
import { WishlistPage } from './pages/WishlistPage';
import { CustomerAccount } from './pages/CustomerAccount';
import { CustomerAuth } from './pages/CustomerAuth';
import { AboutPage, ContactPage, SizeGuidePage, PolicyPage } from './pages/InfoPages';

// Owner Pages
import { OwnerLogin } from './pages/owner/OwnerLogin';
import { OwnerDashboard } from './pages/owner/OwnerDashboard';
import { OwnerProducts } from './pages/owner/OwnerProducts';
import { OwnerProductForm } from './pages/owner/OwnerProductForm';
import { OwnerInventory } from './pages/owner/OwnerInventory';
import { OwnerCategories } from './pages/owner/OwnerCategories';
import { OwnerOrders } from './pages/owner/OwnerOrders';
import { OwnerCoupons } from './pages/owner/OwnerCoupons';
import { OwnerSettings } from './pages/owner/OwnerSettings';

import { BrandLogo } from './components/BrandLogo';
import { AnimatedBackground } from './components/AnimatedBackground';
import { MobileBottomNav } from './components/MobileBottomNav';
import { AiFashionStylist } from './components/AiFashionStylist';
import { NotificationCenter } from './components/NotificationCenter';

const AuthLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#FAF9F6] text-[#18181B] font-sans flex flex-col items-center justify-center gap-4 p-6">
    <BrandLogo variant="badge" size="lg" />
    <div className="flex items-center gap-2.5 text-xs font-medium text-[#52525B]">
      <span className="w-4 h-4 rounded-full border-2 border-[#D6D5CE] border-t-[#65A30D] animate-spin" />
      <span>Loading PatanaKart...</span>
    </div>
  </div>
);

const CustomerStylistHost: React.FC = () => {
  const location = useLocation();
  const { user, isOwner, isAdmin, initializing } = useAuth();

  if (
    initializing ||
    (!user && !isOwner && !isAdmin) ||
    location.pathname.startsWith('/owner') ||
    location.pathname === '/login' ||
    location.pathname === '/register'
  ) {
    return null;
  }
  return <AiFashionStylist />;
};

// Customer Entry Auth Guard
const CustomerProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isOwner, isAdmin, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <AuthLoadingScreen />;
  }

  if (!user && !isOwner && !isAdmin) {
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  return <>{children}</>;
};

// Owner Guard
const OwnerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOwner, isAdmin, initializing } = useAuth();

  if (initializing) {
    return <AuthLoadingScreen />;
  }

  if (!isAdmin && !isOwner) {
    return <Navigate to="/owner/login" replace />;
  }
  return <>{children}</>;
};

// Protected Customer Layout wrapper in clean light theme
const CustomerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <CustomerProtectedRoute>
    <div className="min-h-screen bg-[#FAF9F6] text-[#18181B] font-sans flex flex-col relative overflow-x-hidden selection:bg-[#B8F130] selection:text-[#111111] pb-16 md:pb-0">
      <AnimatedBackground />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
      <MobileBottomNav />
      <NotificationCenter />
    </div>
  </CustomerProtectedRoute>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <StoreProvider>
          <Routes>
            {/* Standalone Customer Sign In / Sign Up Entry Portal */}
            <Route path="/login" element={<CustomerAuth />} />
            <Route path="/register" element={<CustomerAuth />} />

            {/* Protected Customer Storefront Routes */}
            <Route path="/" element={<CustomerLayout><Home /></CustomerLayout>} />
            <Route path="/shop" element={<CustomerLayout><Shop /></CustomerLayout>} />
            <Route path="/product/:slug" element={<CustomerLayout><ProductDetail /></CustomerLayout>} />
            <Route path="/custom-studio" element={<CustomerLayout><CustomStudio /></CustomerLayout>} />
            <Route path="/cart" element={<CustomerLayout><CartPage /></CustomerLayout>} />
            <Route path="/checkout" element={<CustomerLayout><Checkout /></CustomerLayout>} />
            <Route path="/wishlist" element={<CustomerLayout><WishlistPage /></CustomerLayout>} />
            <Route path="/account" element={<CustomerLayout><CustomerAccount /></CustomerLayout>} />
            <Route path="/account/orders/:id" element={<CustomerLayout><CustomerAccount /></CustomerLayout>} />

            {/* Information & Policies */}
            <Route path="/about" element={<CustomerLayout><AboutPage /></CustomerLayout>} />
            <Route path="/contact" element={<CustomerLayout><ContactPage /></CustomerLayout>} />
            <Route path="/size-guide" element={<CustomerLayout><SizeGuidePage /></CustomerLayout>} />
            <Route
              path="/policies/shipping"
              element={
                <CustomerLayout>
                  <PolicyPage
                    title="Shipping & Delivery Policy"
                    subtitle="Express Logistics Across India"
                    content="PatanaKart dispatches orders within 24-48 business hours. Deliveries across tier-1 cities typically take 2-4 business days. Regional and rural pin codes take 4-7 business days via surface couriers (Delhivery, BlueDart, XpressBees). Cash on Delivery is supported for eligible PIN codes."
                  />
                </CustomerLayout>
              }
            />
            <Route
              path="/policies/returns"
              element={
                <CustomerLayout>
                  <PolicyPage
                    title="Returns & Exchanges Policy"
                    subtitle="7-Day Guarantee"
                    content="If your garment does not fit as expected or arrives damaged, request a hassle-free exchange within 7 days of delivery. Items must be unworn, with original tags intact. Custom printed t-shirts are non-refundable unless defective upon arrival."
                  />
                </CustomerLayout>
              }
            />
            <Route
              path="/privacy"
              element={
                <CustomerLayout>
                  <PolicyPage
                    title="Privacy Policy"
                    subtitle="Data Protection"
                    content="PatanaKart values customer confidentiality. Your personal information, delivery address, and contact details are stored securely on Supabase cloud database with strict Row-Level Security policies. We never sell customer records to third parties."
                  />
                </CustomerLayout>
              }
            />
            <Route
              path="/terms"
              element={
                <CustomerLayout>
                  <PolicyPage
                    title="Terms & Conditions"
                    subtitle="Store Usage Rules"
                    content="By browsing or purchasing from PatanaKart, you agree to our pricing terms, shipping conditions, and custom artwork usage rules. All monetary transactions are calculated in Indian Rupees (₹)."
                  />
                </CustomerLayout>
              }
            />

            {/* Owner / Admin Routes */}
            <Route path="/owner/login" element={<OwnerLogin />} />
            <Route path="/owner/dashboard" element={<OwnerRoute><OwnerDashboard /></OwnerRoute>} />
            <Route path="/owner/products" element={<OwnerRoute><OwnerProducts /></OwnerRoute>} />
            <Route path="/owner/products/new" element={<OwnerRoute><OwnerProductForm /></OwnerRoute>} />
            <Route path="/owner/products/:id" element={<OwnerRoute><OwnerProductForm /></OwnerRoute>} />
            <Route path="/owner/inventory" element={<OwnerRoute><OwnerInventory /></OwnerRoute>} />
            <Route path="/owner/categories" element={<OwnerRoute><OwnerCategories /></OwnerRoute>} />
            <Route path="/owner/orders" element={<OwnerRoute><OwnerOrders /></OwnerRoute>} />
            <Route path="/owner/coupons" element={<OwnerRoute><OwnerCoupons /></OwnerRoute>} />
            <Route path="/owner/settings" element={<OwnerRoute><OwnerSettings /></OwnerRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <CustomerStylistHost />
          </StoreProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
