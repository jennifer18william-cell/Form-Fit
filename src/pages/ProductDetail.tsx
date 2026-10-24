import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { ProductVariant } from '../types';
import { getFashionFallbackImage } from '../lib/imageOptimization';
import {
  Heart,
  ShoppingBag,
  Truck,
  RotateCcw,
  Shield,
  Ruler,
} from 'lucide-react';

export const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { products, addToCart, toggleWishlist, isInWishlist, addReview } = useStore();
  const navigate = useNavigate();

  const product = products.find((p) => p.slug === slug);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => {
    return (
      product?.variants?.find((v) => v.is_active && v.stock_quantity > 0) ||
      product?.variants?.[0] ||
      null
    );
  });
  const [quantity, setQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'details' | 'care' | 'shipping'>('details');

  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto my-20 p-10 bg-white border border-[#E5E4DF] rounded-xl text-center space-y-4">
        <h2 className="font-space font-bold text-2xl text-[#18181B]">Product Not Found</h2>
        <p className="text-xs text-[#64748B] font-sans">
          The requested fashion item does not exist or has been unpublished by the store owner.
        </p>
        <Link
          to="/shop"
          className="inline-block px-6 py-2.5 bg-[#1D4ED8] text-white font-space font-semibold text-xs rounded-md hover:bg-[#1E40AF] transition-colors"
        >
          Return to Shop Catalog
        </Link>
      </div>
    );
  }

  const inWishlist = isInWishlist(product.id);
  const images = product.images || [];
  const fallbackUrl = getFashionFallbackImage(product.name, product.category?.name);
  const currentImage =
    images[selectedImageIndex]?.url ||
    selectedVariant?.variant_image_url ||
    images[0]?.url ||
    fallbackUrl;

  const currentPrice =
    selectedVariant?.price_override || product.sale_price || product.regular_price;
  const originalPrice = product.regular_price;
  const isSale = Boolean(product.sale_price && product.sale_price < product.regular_price);

  const currentStock = selectedVariant?.stock_quantity || 0;
  const isOutOfStock = currentStock === 0;

  const sizes = Array.from(new Set(product.variants?.map((v) => v.size).filter(Boolean)));
  const colors = Array.from(new Set(product.variants?.map((v) => v.color).filter(Boolean)));

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addToCart(product, selectedVariant, quantity);
  };

  const handleBuyNow = () => {
    if (!selectedVariant) return;
    addToCart(product, selectedVariant, quantity);
    navigate('/checkout');
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewerName.trim() && reviewComment.trim()) {
      addReview(product.id, reviewRating, reviewComment, reviewerName.trim());
      setShowReviewModal(false);
      setReviewerName('');
      setReviewComment('');
    }
  };

  const relatedProducts = products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.status === 'published' &&
        p.category_id === product.category_id
    )
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16 text-[#18181B]">
      {/* Breadcrumb */}
      <div className="text-xs font-medium text-[#64748B] flex items-center gap-2">
        <Link to="/" className="hover:text-[#1D4ED8] transition-colors">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/shop" className="hover:text-[#1D4ED8] transition-colors">
          Shop
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-[#18181B] font-semibold truncate">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left Sticky Gallery */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="aspect-[3/4] bg-[#F3F2EE] border border-[#E5E4DF] rounded-xl relative overflow-hidden">
            <img
              src={currentImage}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-opacity duration-300"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = fallbackUrl;
              }}
            />

            {isSale && (
              <span className="absolute top-4 left-4 bg-[#EEF2FF]/95 text-[#1D4ED8] font-space font-semibold text-xs px-3 py-1 rounded border border-[#C7D2FE]">
                Sale
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-20 aspect-[3/4] bg-[#F3F2EE] border rounded-lg shrink-0 overflow-hidden cursor-pointer transition-all ${
                    selectedImageIndex === idx
                      ? 'border-2 border-[#1D4ED8]'
                      : 'border-[#E5E4DF] opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url}
                    alt="Thumbnail"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = fallbackUrl;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Contiguous Purchase Module */}
        <div className="bg-white border border-[#E5E4DF] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2 border-b border-[#E5E4DF] pb-6">
            <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#1D4ED8]">
              {product.category?.name || product.gender_collection}
            </span>
            <h1 className="font-space font-bold text-3xl sm:text-4xl tracking-tight text-[#18181B]">
              {product.name}
            </h1>
            {product.sku && (
              <p className="text-xs font-mono text-[#71717A]">SKU: {product.sku}</p>
            )}

            {/* Price */}
            <div className="pt-3 flex items-baseline gap-3 tabular-nums">
              <span className="font-space font-bold text-3xl text-[#18181B]">
                ₹{currentPrice.toLocaleString('en-IN')}
              </span>
              {isSale && (
                <span className="font-sans text-base text-[#94A3B8] line-through">
                  ₹{originalPrice.toLocaleString('en-IN')}
                </span>
              )}
              <span className="text-xs text-[#64748B] font-sans">Inclusive of all taxes</span>
            </div>
          </div>

          {/* Variant Selectors */}
          <div className="space-y-5">
            {colors.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-space font-semibold text-[#18181B]">
                  Color:{' '}
                  <span className="font-normal text-[#64748B]">
                    {selectedVariant?.color || 'Select Color'}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => {
                    const matchingVariant = product.variants?.find(
                      (v) => v.color === color && v.is_active
                    );
                    const isSelected = selectedVariant?.color === color;

                    return (
                      <button
                        key={color}
                        onClick={() => matchingVariant && setSelectedVariant(matchingVariant)}
                        className={`px-3.5 py-2 text-xs font-medium border rounded-md cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] font-semibold'
                            : 'bg-[#FAF9F6] text-[#18181B] border-[#D6D5CE] hover:border-[#1D4ED8]'
                        }`}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-space font-semibold text-[#18181B]">
                    Size:{' '}
                    <span className="font-normal text-[#64748B]">
                      {selectedVariant?.size || 'Select Size'}
                    </span>
                  </label>
                  <Link
                    to="/size-guide"
                    className="flex items-center gap-1 text-[#1D4ED8] hover:underline font-medium"
                  >
                    <Ruler size={13} /> Size Guide
                  </Link>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {sizes.map((size) => {
                    const matchingVariant = product.variants?.find(
                      (v) =>
                        v.size === size &&
                        (selectedVariant ? v.color === selectedVariant.color : true)
                    );
                    const isSelected = selectedVariant?.size === size;
                    const isAvailable = matchingVariant && matchingVariant.stock_quantity > 0;

                    return (
                      <button
                        key={size}
                        disabled={!isAvailable}
                        onClick={() => matchingVariant && setSelectedVariant(matchingVariant)}
                        className={`py-2.5 text-xs font-mono border rounded-md transition-colors cursor-pointer font-semibold ${
                          isSelected
                            ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]'
                            : isAvailable
                            ? 'bg-[#FAF9F6] text-[#18181B] border-[#D6D5CE] hover:border-[#1D4ED8]'
                            : 'bg-[#F3F2EE] text-[#A1A1AA] border-[#E5E4DF] cursor-not-allowed line-through'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stock status text */}
            <div className="text-xs font-medium">
              {isOutOfStock ? (
                <span className="text-red-600 font-semibold">Currently Out of Stock</span>
              ) : currentStock <= 5 ? (
                <span className="text-amber-700 font-semibold">
                  Low Stock · Only {currentStock} left
                </span>
              ) : (
                <span className="text-[#15803D] font-semibold">
                  In Stock · Ready for Express Dispatch ({currentStock} available)
                </span>
              )}
            </div>

            {/* Quantity Selector & Action Buttons */}
            <div className="pt-2 space-y-3">
              <div className="flex gap-3 items-center">
                <div className="flex items-center border border-[#D6D5CE] bg-[#FAF9F6] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3.5 py-3 text-base text-[#18181B] hover:bg-[#F3F2EE] font-semibold cursor-pointer transition-colors rounded-l-lg"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="px-4 py-3 text-sm font-mono font-semibold text-[#18181B] min-w-[2.5rem] text-center tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(currentStock || 1, quantity + 1))}
                    className="px-3.5 py-3 text-base text-[#18181B] hover:bg-[#F3F2EE] font-semibold cursor-pointer transition-colors rounded-r-lg"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <button
                  disabled={isOutOfStock || !selectedVariant}
                  onClick={handleAddToCart}
                  className="flex-1 py-3.5 bg-[#1D4ED8] text-white font-space font-semibold text-sm rounded-lg hover:bg-[#1E40AF] transition-colors disabled:bg-[#E5E4DF] disabled:text-[#94A3B8] disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag size={17} /> Add to Bag
                </button>

                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  className="p-3.5 border border-[#D6D5CE] bg-[#FAF9F6] text-[#3F3F46] hover:border-[#1D4ED8] hover:text-[#1D4ED8] rounded-lg transition-colors cursor-pointer"
                  title="Save to Wishlist"
                  aria-label="Save to Wishlist"
                >
                  <Heart
                    size={18}
                    fill={inWishlist ? '#1D4ED8' : 'none'}
                    className={inWishlist ? 'text-[#1D4ED8]' : ''}
                  />
                </button>
              </div>

              {!isOutOfStock && selectedVariant && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full py-3.5 bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] font-space font-semibold text-sm rounded-lg hover:border-[#1D4ED8] hover:text-[#1D4ED8] transition-colors cursor-pointer"
                >
                  Buy It Now
                </button>
              )}
            </div>
          </div>

          {/* Value Guarantees */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-[#E5E4DF] text-center text-xs">
            <div className="p-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg">
              <Truck size={17} className="mx-auto mb-1 text-[#1D4ED8]" />
              <span className="text-[#18181B] font-medium block">Fast Shipping</span>
            </div>
            <div className="p-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg">
              <RotateCcw size={17} className="mx-auto mb-1 text-[#1D4ED8]" />
              <span className="text-[#18181B] font-medium block">7-Day Return</span>
            </div>
            <div className="p-3 bg-[#FAF9F6] border border-[#E5E4DF] rounded-lg">
              <Shield size={17} className="mx-auto mb-1 text-[#1D4ED8]" />
              <span className="text-[#18181B] font-medium block">Verified Quality</span>
            </div>
          </div>

          {/* Product Specifications & Tabs */}
          <div className="border-t border-[#E5E4DF] pt-5 space-y-4 font-sans text-xs">
            <div className="flex border-b border-[#E5E4DF] gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`pb-2.5 px-3 font-space font-semibold text-xs border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'details'
                    ? 'border-[#1D4ED8] text-[#1D4ED8]'
                    : 'border-transparent text-[#64748B] hover:text-[#18181B]'
                }`}
              >
                Fabric &amp; Specs
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('care')}
                className={`pb-2.5 px-3 font-space font-semibold text-xs border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'care'
                    ? 'border-[#1D4ED8] text-[#1D4ED8]'
                    : 'border-transparent text-[#64748B] hover:text-[#18181B]'
                }`}
              >
                Care Guide
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('shipping')}
                className={`pb-2.5 px-3 font-space font-semibold text-xs border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === 'shipping'
                    ? 'border-[#1D4ED8] text-[#1D4ED8]'
                    : 'border-transparent text-[#64748B] hover:text-[#18181B]'
                }`}
              >
                Delivery Policies
              </button>
            </div>

            <div className="pt-1 leading-relaxed text-[#52525B]">
              {activeTab === 'details' && (
                <div className="space-y-2">
                  <p>{product.description || 'Crafted with attention to detail and modern fit.'}</p>
                  {product.fabric_material && (
                    <p>
                      <strong className="text-[#18181B] font-semibold">Fabric:</strong>{' '}
                      <span>{product.fabric_material}</span>
                    </p>
                  )}
                  {product.fit && (
                    <p>
                      <strong className="text-[#18181B] font-semibold">Fit Profile:</strong>{' '}
                      <span>{product.fit}</span>
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'care' && (
                <p>
                  {product.care_instructions ||
                    'Machine wash cold with like colors. Do not bleach. Tumble dry low. Cool iron if needed. Do not iron directly on prints.'}
                </p>
              )}

              {activeTab === 'shipping' && (
                <p>
                  Dispatched within 24–48 business hours. Delivered across India via Express Courier (Delhivery, BlueDart, XpressBees). Cash on Delivery and UPI available.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <div className="bg-white border border-[#E5E4DF] rounded-2xl p-6 sm:p-8 space-y-6 text-[#18181B]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E4DF] pb-4">
          <div>
            <h3 className="font-space font-bold text-xl text-[#18181B]">
              Verified Customer Reviews
            </h3>
            <p className="text-xs text-[#64748B] font-sans">Ratings from confirmed buyers</p>
          </div>

          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="px-5 py-2.5 bg-[#1D4ED8] text-white font-space font-semibold text-xs rounded-md hover:bg-[#1E40AF] transition-colors cursor-pointer whitespace-nowrap"
          >
            Write a Review
          </button>
        </div>

        {showReviewModal && (
          <form
            onSubmit={handleReviewSubmit}
            className="p-5 bg-[#FAF9F6] border border-[#E5E4DF] rounded-xl space-y-4"
          >
            <h4 className="font-space font-semibold text-sm text-[#18181B]">
              Submit Product Review
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#52525B] block">Your Name</label>
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full bg-white border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#1D4ED8]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#52525B] block">Rating</label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="w-full bg-white border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#1D4ED8]"
                >
                  <option value={5}>5 / 5 — Excellent</option>
                  <option value={4}>4 / 5 — Very Good</option>
                  <option value={3}>3 / 5 — Average</option>
                  <option value={2}>2 / 5 — Fair</option>
                  <option value={1}>1 / 5 — Poor</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#52525B] block">Feedback Details</label>
              <textarea
                required
                rows={3}
                placeholder="Share your feedback on fabric weight, sizing accuracy, and comfort..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full bg-white border border-[#D6D5CE] text-[#18181B] rounded-md p-2.5 text-xs focus:outline-none focus:border-[#1D4ED8]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 bg-white border border-[#D6D5CE] text-[#52525B] hover:text-[#18181B] text-xs font-medium rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#1D4ED8] text-white text-xs font-space font-semibold rounded-md hover:bg-[#1E40AF] transition-colors cursor-pointer"
              >
                Post Review
              </button>
            </div>
          </form>
        )}

        <div className="text-xs text-[#64748B] font-sans">
          No reviews yet. Be the first to share your Form &amp; Fit experience.
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="space-y-6 pt-6 border-t border-[#E5E4DF]">
          <h3 className="font-space font-bold text-2xl tracking-tight text-[#18181B]">
            You May Also Like
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((rel) => (
              <ProductCard key={rel.id} product={rel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
