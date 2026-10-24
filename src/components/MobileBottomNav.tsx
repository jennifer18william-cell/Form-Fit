import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import {
  Home,
  ShoppingBag,
  Palette,
  Heart,
  User,
  ShieldCheck,
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { wishlist } = useStore();
  const { user, isAdmin } = useAuth();

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/',
      icon: Home,
      exact: true,
      badge: null,
    },
    {
      id: 'shop',
      label: 'Shop',
      path: '/shop',
      icon: ShoppingBag,
      badge: null,
    },
    {
      id: 'custom',
      label: 'Custom',
      path: '/custom-studio',
      icon: Palette,
      highlight: true,
      badge: null,
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      path: '/wishlist',
      icon: Heart,
      badge: wishlist.length > 0 ? wishlist.length : null,
    },
    {
      id: 'account',
      label: user ? 'Account' : 'Sign In',
      path: isAdmin ? '/owner/dashboard' : '/account',
      icon: isAdmin ? ShieldCheck : User,
      badge: null,
    },
  ];

  const isActivePath = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-[#E5E4DF] shadow-[0_-2px_12px_rgba(24,24,27,0.05)] pb-[env(safe-area-inset-bottom,4px)]">
      <div className="grid grid-cols-5 h-15 items-center px-1">
        {navItems.map((item) => {
          const active = isActivePath(item.path, item.exact);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              to={item.path}
              className="relative flex flex-col items-center justify-center h-full w-full py-1 text-center group cursor-pointer"
            >
              {active && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute top-0 w-8 h-0.5 rounded-full bg-[#1D4ED8]"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}

              <div className="relative">
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    active
                      ? item.highlight
                        ? 'bg-[#1D4ED8] text-white'
                        : 'text-[#1D4ED8]'
                      : item.highlight
                      ? 'bg-[#EEF2FF] text-[#1D4ED8]'
                      : 'text-[#64748B] group-hover:text-[#18181B]'
                  }`}
                >
                  <Icon size={18} />
                </motion.div>

                {item.badge !== null && (
                  <span className="absolute -top-1 -right-1.5 bg-[#1D4ED8] text-white text-[9px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] font-medium mt-0.5 transition-colors whitespace-nowrap ${
                  active ? 'text-[#1D4ED8] font-semibold' : 'text-[#64748B]'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
