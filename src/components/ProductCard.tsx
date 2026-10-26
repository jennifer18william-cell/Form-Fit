import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { Heart } from 'lucide-react';
import { getFashionFallbackImage, resolvePublicImageUrl } from '../lib/imageOptimization';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { toggleWishlist, isInWishlist } = useStore();
  const inWishlist = isInWishlist(product.id);

  // Main & hover images
  const fallbackUrl = getFashionFallbackImage(product.name, product.category?.name);
  const rawMainUrl =
    product.images?.find((i) => i.is_main)?.url ||
    product.images?.[0]?.url ||
    product.variants?.find((v) => v.variant_image_url)?.variant_image_url;
  const mainImage = resolvePublicImageUrl(rawMainUrl, product.name, product.category?.name);
  const secondaryImage = product.images?.[1]?.url
    ? resolvePublicImageUrl(product.images[1].url, product.name, product.category?.name)
    : undefined;

  // Available stock
  const totalStock =
    product.variants?.reduce((acc, v) => acc + (v.is_active ? v.stock_quantity : 0), 0) || 0;
  const isOutOfStock = totalStock === 0;
  const isOnSale = Boolean(product.sale_price && product.sale_price < product.regular_price);

  // Sizes available
  const availableSizes = Array.from(
    new Set(
      product.variants
        ?.filter((v) => v.is_active && v.stock_quantity > 0 && v.size)
        .map((v) => v.size)
    )
  );

  // Maximum 1 subtle tag per card (No Badge Spam)
  const statusTag = isOutOfStock
    ? { label: 'Sold Out', classes: 'bg-white/95 text-red-700 border-[#FECACA]' }
    : isOnSale
    ? { label: 'Sale', classes: 'bg-[#B8F130]/95 text-[#111111] border-[#9ED912] font-semibold' }
    : product.featured
    ? { label: 'Featured', classes: 'bg-white/95 text-[#18181B] border-[#E5E4DF]' }
    : null;

  return (
    <div className="group relative bg-white border border-[#E5E4DF] hover:border-[#CBD5E1] transition-all duration-200 flex flex-col justify-between rounded-lg overflow-hidden hover:shadow-[0_8px_24px_rgba(24,24,27,0.06)] hover:-translate-y-0.5">
      <div>
        {/* Image Container */}
        <div className="relative aspect-[3/4] bg-[#F3F2EE] overflow-hidden">
          <Link to={`/product/${product.slug}`} className="block w-full h-full">
            <img
              src={mainImage}
              alt={product.name}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-103 ${
                secondaryImage ? 'group-hover:opacity-0' : ''
              }`}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = fallbackUrl;
              }}
            />

            {secondaryImage && (
              <img
                src={secondaryImage}
                alt={`${product.name} alternate view`}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = fallbackUrl;
                }}
              />
            )}
          </Link>

          {/* Single Subtle Status Tag */}
          {statusTag && (
            <div className="absolute top-2.5 left-2.5 z-10">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded border backdrop-blur-xs ${statusTag.classes}`}
              >
                {statusTag.label}
              </span>
            </div>
          )}

          {/* Wishlist Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist(product);
            }}
            className="absolute top-2.5 right-2.5 p-2 bg-white/90 hover:bg-white text-[#3F3F46] hover:text-[#4D7C0F] backdrop-blur-xs transition-colors rounded-full z-10 cursor-pointer border border-[#E5E4DF] shadow-2xs"
            aria-label="Save to Wishlist"
          >
            <Heart
              size={15}
              fill={inWishlist ? '#B8F130' : 'none'}
              className={inWishlist ? 'text-[#3F6212]' : ''}
            />
          </button>

          {/* Quick sizes overlay on hover */}
          {availableSizes.length > 0 && !isOutOfStock && (
            <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-xs text-[#18181B] px-3 py-2 text-[11px] font-mono flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 border-t border-[#E5E4DF]">
              <span className="text-[#64748B] font-sans font-medium mr-1">Sizes:</span>
              <span className="text-[#18181B] truncate">{availableSizes.join(' · ')}</span>
            </div>
          )}
        </div>

        {/* Clean Unboxed Metadata */}
        <div className="p-4 space-y-1 bg-white">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[#64748B]">
            {product.category?.name || product.gender_collection}
          </div>

          <Link
            to={`/product/${product.slug}`}
            className="font-space font-semibold text-base text-[#18181B] group-hover:text-[#4D7C0F] transition-colors line-clamp-1 block"
          >
            {product.name}
          </Link>

          {product.fabric_material && (
            <p className="text-xs text-[#71717A] truncate font-sans">
              {product.fabric_material}
            </p>
          )}

          {/* Tabular Price */}
          <div className="pt-2 flex items-baseline gap-2 tabular-nums">
            {product.sale_price ? (
              <>
                <span className="font-space font-bold text-[15px] text-[#4D7C0F]">
                  ₹{product.sale_price.toLocaleString('en-IN')}
                </span>
                <span className="font-sans text-xs text-[#94A3B8] line-through">
                  ₹{product.regular_price.toLocaleString('en-IN')}
                </span>
              </>
            ) : (
              <span className="font-space font-bold text-[15px] text-[#18181B]">
                ₹{product.regular_price.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
