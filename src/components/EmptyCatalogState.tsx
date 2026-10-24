import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, PlusCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EmptyCatalogStateProps {
  title?: string;
  description?: string;
}

export const EmptyCatalogState: React.FC<EmptyCatalogStateProps> = ({
  title = 'Catalog Under Curation',
  description = 'Our store owner is curating the seasonal collection. New garments appear here immediately once published.',
}) => {
  const { isAdmin } = useAuth();

  return (
    <div className="max-w-3xl mx-auto my-8 p-8 sm:p-12 bg-white border border-[#E5E4DF] rounded-xl text-center shadow-xs">
      <div className="w-14 h-14 mx-auto mb-4 bg-[#B8F130]/35 border border-[#9ED912]/40 text-[#111111] flex items-center justify-center rounded-xl">
        <ShoppingBag size={24} />
      </div>

      <span className="font-space font-bold tracking-wider text-xs uppercase text-[#65A30D] block mb-1">
        Form &amp; Fit Storefront
      </span>

      <h3 className="font-space font-bold text-2xl tracking-tight text-[#111111] mb-2.5">
        {title}
      </h3>

      <p className="text-sm text-[#57534E] max-w-lg mx-auto leading-relaxed mb-6 font-sans">
        {description}
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {isAdmin ? (
          <Link
            to="/owner/products/new"
            className="w-full sm:w-auto px-6 py-3 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <PlusCircle size={15} /> Upload First Product Now
          </Link>
        ) : (
          <Link
            to="/owner/login"
            className="w-full sm:w-auto px-6 py-3 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <ShieldCheck size={15} /> Owner Login to Add Products
          </Link>
        )}

        <Link
          to="/custom-studio"
          className="w-full sm:w-auto px-6 py-3 bg-[#FAF9F6] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider rounded-md hover:bg-[#F3F2EE] transition-colors border border-[#D6D5CE] whitespace-nowrap"
        >
          Try Custom T-Shirt Studio
        </Link>
      </div>
    </div>
  );
};
