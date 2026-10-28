import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { BrandLogo } from './BrandLogo';
import { Instagram, Twitter, Facebook, ArrowRight, Check } from 'lucide-react';

export const Footer: React.FC = () => {
  const { categories } = useStore();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="bg-[#F3F2EE] text-[#18181B] pt-16 pb-12 border-t border-[#E5E4DF] font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-[#E5E4DF]">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-block" aria-label="PatanaKart Home">
              <BrandLogo size="md" subtitle="FASHION FOR EVERY YOU" />
            </Link>
            <p className="text-xs text-[#52525B] leading-relaxed max-w-sm">
              PatanaKart pairs 240 GSM combed cottons with contemporary tailoring. Designed for everyday comfort, enduring structure, and personal expression.
            </p>

            <div className="pt-2 flex items-center space-x-4 text-[#52525B]">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#4D7C0F] transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#4D7C0F] transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={18} />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#4D7C0F] transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={18} />
              </a>
            </div>
          </div>

          {/* Categories Col */}
          <div className="space-y-3">
            <h4 className="font-space font-semibold text-xs uppercase tracking-wider text-[#18181B]">
              Collections
            </h4>
            <ul className="space-y-2 text-xs text-[#52525B]">
              <li>
                <Link to="/shop?gender=Men" className="hover:text-[#4D7C0F] transition-colors">
                  Men's Fashion
                </Link>
              </li>
              <li>
                <Link to="/shop?gender=Women" className="hover:text-[#4D7C0F] transition-colors">
                  Women's Fashion
                </Link>
              </li>
              <li>
                <Link to="/shop?gender=Unisex" className="hover:text-[#4D7C0F] transition-colors">
                  Unisex Essentials
                </Link>
              </li>
              <li>
                <Link to="/shop?category=cat-9-men" className="hover:text-[#4D7C0F] transition-colors">
                  Men's Footwear
                </Link>
              </li>
              <li>
                <Link to="/shop?category=cat-9-women" className="hover:text-[#4D7C0F] transition-colors">
                  Women's Footwear
                </Link>
              </li>
              <li>
                <Link to="/custom-studio" className="text-[#3F6212] hover:text-[#111111] hover:underline transition-colors font-semibold">
                  Custom T-Shirt Studio
                </Link>
              </li>
              {categories.slice(3, 5).map((cat) => (
                <li key={cat.id}>
                  <Link to={`/shop?category=${cat.id}`} className="hover:text-[#4D7C0F] transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care Col */}
          <div className="space-y-3">
            <h4 className="font-space font-semibold text-xs uppercase tracking-wider text-[#18181B]">
              Customer Care
            </h4>
            <ul className="space-y-2 text-xs text-[#52525B]">
              <li>
                <Link to="/size-guide" className="hover:text-[#4D7C0F] transition-colors">
                  Size Guide &amp; Fit
                </Link>
              </li>
              <li>
                <Link to="/policies/shipping" className="hover:text-[#4D7C0F] transition-colors">
                  Shipping &amp; Delivery
                </Link>
              </li>
              <li>
                <Link to="/policies/returns" className="hover:text-[#4D7C0F] transition-colors">
                  Returns &amp; Exchanges
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#4D7C0F] transition-colors">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-[#4D7C0F] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[#4D7C0F] transition-colors">
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Col */}
          <div className="space-y-3">
            <h4 className="font-space font-semibold text-xs uppercase tracking-wider text-[#18181B]">
              Newsletter
            </h4>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Subscribe for seasonal drop alerts, restock notices, and member offers.
            </p>

            {subscribed ? (
              <div className="bg-[#F4FBE1] border border-[#BEF264] text-[#3F6212] p-3 rounded-md text-xs font-medium flex items-center gap-2">
                <Check size={16} className="shrink-0" /> Subscribed to PatanaKart drops!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="flex bg-white border border-[#D6D5CE] rounded-md overflow-hidden focus-within:border-[#65A30D]">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white px-3 py-2 text-xs text-[#18181B] placeholder-[#71717A] focus:outline-none w-full"
                  />
                  <button
                    type="submit"
                    className="bg-[#B8F130] text-[#111111] px-3.5 hover:bg-[#AAE422] transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                    aria-label="Subscribe"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] space-y-4 sm:space-y-0">
          <p>© {new Date().getFullYear()} PatanaKart. All rights reserved. Prices in INR (₹).</p>
          <div className="flex items-center space-x-6">
            <Link to="/about" className="hover:text-[#18181B] transition-colors">
              About Brand
            </Link>
            <Link to="/owner/login" className="hover:text-[#4D7C0F] transition-colors font-medium">
              Owner Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
