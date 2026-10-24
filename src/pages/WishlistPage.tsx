import React from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export const WishlistPage: React.FC = () => {
  const { wishlist } = useStore();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#18181B]">
      <div className="border-b border-[#E5E4DF] pb-4 flex justify-between items-end">
        <div>
          <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#4D7C0F]">
            Saved Preferences
          </span>
          <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
            My Wishlist ({wishlist.length})
          </h1>
        </div>
      </div>

      {wishlist.length === 0 ? (
        <div className="max-w-2xl mx-auto my-12 p-12 bg-white border border-[#E5E4DF] rounded-xl text-center space-y-4">
          <Heart size={44} className="mx-auto text-[#94A3B8]" />
          <h2 className="font-space font-bold text-xl text-[#18181B]">
            Your Wishlist is Empty
          </h2>
          <p className="text-xs text-[#64748B] font-sans max-w-sm mx-auto">
            Save your favorite tailored pieces, custom tees, and essentials to review them anytime.
          </p>
          <Link
            to="/shop"
            className="inline-block px-6 py-3 bg-[#B8F130] text-[#111111] font-space font-bold text-xs rounded-md hover:bg-[#AAE422] transition-colors"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {wishlist.map((item) => (
            <ProductCard key={item.id} product={item.product} />
          ))}
        </div>
      )}
    </div>
  );
};
