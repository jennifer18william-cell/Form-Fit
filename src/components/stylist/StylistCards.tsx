import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  ShoppingBag,
  ArrowUpRight,
  Check,
  Layers,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ProductVariant } from '../../types';
import {
  MatchTier,
  StylistOutfitSuggestion,
  StylistProductRecommendation,
  VisualGarmentAnalysis,
} from '../../types/stylist';

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatMatchTierLabel(tier?: MatchTier): { text: string; toneClass: string } | null {
  if (!tier) return null;
  if (tier === 'exact_match') {
    return { text: 'Exact match', toneClass: 'text-[#3F6212] font-semibold' };
  }
  if (tier === 'very_similar') {
    return { text: 'Very similar match', toneClass: 'text-[#18181B] font-semibold' };
  }
  return { text: 'Alternative style', toneClass: 'text-[#64748B] font-medium' };
}

export const VisualAnalysisSummary: React.FC<{ analysis: VisualGarmentAnalysis }> = ({
  analysis,
}) => {
  if (!analysis.isClothingDetected) return null;

  return (
    <div className="mt-2.5 rounded-xl border border-[#E5E4DF] bg-[#FAF9F6] p-3 text-xs text-[#3F3F46]">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E4DF]">
        <span className="font-semibold text-[#18181B]">Detected garment profile</span>
        <span className="text-[#64748B]">
          {analysis.genderFit} · {analysis.styleCategory}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 leading-snug">
        <div>
          <dt className="text-[11px] text-[#71717A]">Garment</dt>
          <dd className="font-medium text-[#18181B]">{analysis.garmentType}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[#71717A]">Colors</dt>
          <dd className="font-medium text-[#18181B]">
            {analysis.dominantColors.length > 0 ? analysis.dominantColors.join(', ') : analysis.colorCombination}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-[#71717A]">Silhouette & cut</dt>
          <dd className="text-[#27272A]">{analysis.silhouetteAndFit}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-[#71717A]">Pattern & fabric</dt>
          <dd className="text-[#27272A]">
            {analysis.patternOrPrint} · {analysis.fabricAppearance}
          </dd>
        </div>
      </dl>

      {analysis.designDetails && analysis.designDetails.length > 0 && (
        <p className="mt-2 pt-1.5 border-t border-[#E5E4DF]/70 text-[11px] text-[#52525B]">
          Details: {analysis.designDetails.join(' · ')}
        </p>
      )}
    </div>
  );
};

interface ProductRecommendationCardProps {
  recommendation: StylistProductRecommendation;
  preferredSize?: string;
  onNavigateProduct?: () => void;
}

export const ProductRecommendationCard: React.FC<ProductRecommendationCardProps> = ({
  recommendation,
  preferredSize,
  onNavigateProduct,
}) => {
  const { addToCart, toggleWishlist, isInWishlist } = useStore();
  const { product, matchTier, matchReason, inStock, effectivePrice, availableSizes, availableColors } =
    recommendation;

  const variants: ProductVariant[] = Array.isArray(product.variants) ? product.variants : [];
  const inStockVariants = variants.filter((v) => v.is_active !== false && v.stock_quantity > 0);

  const initialVariantId = (() => {
    if (preferredSize) {
      const matchPref = inStockVariants.find(
        (v) => (v.size || '').toLowerCase() === preferredSize.toLowerCase()
      );
      if (matchPref) return matchPref.id;
    }
    return inStockVariants[0]?.id || variants[0]?.id || '';
  })();

  const [selectedVariantId, setSelectedVariantId] = useState<string>(initialVariantId);
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant =
    inStockVariants.find((v) => v.id === selectedVariantId) ||
    inStockVariants[0] ||
    variants[0] ||
    null;

  const wishlisted = isInWishlist(product.id);
  const mainImage = product.images?.[0]?.url || '';
  const hasDiscount =
    typeof product.sale_price === 'number' &&
    product.sale_price > 0 &&
    product.sale_price < product.regular_price;

  const tierInfo = formatMatchTierLabel(matchTier);

  const handleAddToBag = () => {
    if (!inStock || !selectedVariant || selectedVariant.stock_quantity <= 0) return;
    addToCart(product, selectedVariant, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <div className="rounded-xl border border-[#E5E4DF] bg-white p-3 transition-colors hover:border-[#D6D5CE]">
      <div className="flex gap-3">
        <Link
          to={`/product/${product.slug}`}
          onClick={onNavigateProduct}
          className="relative w-20 h-24 shrink-0 overflow-hidden rounded-lg bg-[#F4F3EF] border border-[#E5E4DF]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
        >
          {mainImage ? (
            <img
              src={mainImage}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover object-center transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[11px] text-[#71717A]">
              Form &amp; Fit
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          {/* Unboxed clean metadata line */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
            {tierInfo && (
              <>
                <span className={tierInfo.toneClass}>{tierInfo.text}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{product.category?.name || product.gender_collection}</span>
            {!inStock && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-600 font-medium">Out of stock</span>
              </>
            )}
          </div>

          <Link
            to={`/product/${product.slug}`}
            onClick={onNavigateProduct}
            className="mt-0.5 block font-space text-sm font-semibold text-[#18181B] hover:text-[#3F6212] truncate focus-visible:outline-none focus-visible:underline"
          >
            {product.name}
          </Link>

          {/* Price row with tabular numerals */}
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-sm font-bold text-[#18181B]">{formatInr(effectivePrice)}</span>
            {hasDiscount && (
              <span className="text-xs text-[#71717A] line-through">
                {formatInr(product.regular_price)}
              </span>
            )}
          </div>

          {/* Available colors & sizes unboxed */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#52525B]">
            {availableColors.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {availableColors.slice(0, 3).map((c) =>
                  c.hex ? (
                    <span
                      key={c.name}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className="inline-block w-2.5 h-2.5 rounded-full border border-black/15"
                    />
                  ) : null
                )}
                <span>{availableColors.map((c) => c.name).slice(0, 3).join(', ')}</span>
              </span>
            )}
            {availableColors.length > 0 && availableSizes.length > 0 && (
              <span aria-hidden="true">·</span>
            )}
            {availableSizes.length > 0 && <span>Sizes: {availableSizes.join(', ')}</span>}
          </div>
        </div>
      </div>

      {/* Match explanation */}
      <p className="mt-2 text-xs leading-relaxed text-[#52525B]">{matchReason}</p>

      {/* Variant selector when multiple in-stock variants exist */}
      {inStockVariants.length > 1 && (
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[11px] text-[#71717A] shrink-0">Select size:</span>
          {inStockVariants.slice(0, 6).map((v) => {
            const label = v.color && v.color !== 'Standard' && inStockVariants.some((x) => x.size === v.size && x.id !== v.id)
              ? `${v.size} / ${v.color}`
              : v.size || 'OS';
            const active = selectedVariant?.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariantId(v.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] ${
                  active
                    ? 'border-[#18181B] bg-[#18181B] text-white'
                    : 'border-[#E5E4DF] bg-[#FAF9F6] text-[#3F3F46] hover:border-[#A1A1AA]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Action buttons: View Product, Add to Wishlist, Add to Bag */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleAddToBag}
          disabled={!inStock || !selectedVariant}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] ${
            !inStock || !selectedVariant
              ? 'bg-[#F4F3EF] text-[#A1A1AA] cursor-not-allowed'
              : justAdded
              ? 'bg-[#18181B] text-[#B8F130] cursor-pointer'
              : 'bg-[#B8F130] text-[#111111] hover:bg-[#AAE422] cursor-pointer'
          }`}
        >
          {justAdded ? (
            <>
              <Check size={14} />
              <span>Added to Bag</span>
            </>
          ) : (
            <>
              <ShoppingBag size={14} />
              <span>{inStock ? 'Add to Bag' : 'Out of Stock'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => toggleWishlist(product)}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          title={wishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}
          className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] ${
            wishlisted
              ? 'border-[#65A30D] bg-[#F4FBE1] text-[#3F6212]'
              : 'border-[#E5E4DF] bg-white text-[#3F3F46] hover:bg-[#FAF9F6]'
          }`}
        >
          <Heart size={14} className={wishlisted ? 'fill-[#4D7C0F] text-[#4D7C0F]' : ''} />
        </button>

        <Link
          to={`/product/${product.slug}`}
          onClick={onNavigateProduct}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#E5E4DF] bg-white px-2.5 py-2 text-xs font-medium text-[#18181B] hover:bg-[#FAF9F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
        >
          <span>View</span>
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
};

interface CompleteOutfitCardProps {
  outfit: StylistOutfitSuggestion;
  preferredSize?: string;
  budgetInr?: number;
  onNavigateProduct?: () => void;
}

export const CompleteOutfitCard: React.FC<CompleteOutfitCardProps> = ({
  outfit,
  preferredSize,
  budgetInr,
  onNavigateProduct,
}) => {
  const { addToCart } = useStore();
  const [addedAll, setAddedAll] = useState(false);

  const inStockPieces = outfit.pieces.filter((p) => p.inStock);

  const handleAddOutfitToBag = () => {
    let addedCount = 0;
    for (const piece of outfit.pieces) {
      if (!piece.inStock) continue;
      const variants = piece.product.variants || [];
      const stockVariants = variants.filter((v) => v.is_active !== false && v.stock_quantity > 0);
      const chosen =
        (preferredSize
          ? stockVariants.find((v) => (v.size || '').toLowerCase() === preferredSize.toLowerCase())
          : undefined) || stockVariants[0];
      if (chosen) {
        addToCart(piece.product, chosen, 1);
        addedCount++;
      }
    }
    if (addedCount > 0) {
      setAddedAll(true);
      window.setTimeout(() => setAddedAll(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-[#D6D5CE] bg-[#FAF9F6] p-3.5">
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#E5E4DF]">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#3F6212] font-medium">
            <Layers size={13} />
            <span>Complete Look</span>
            <span aria-hidden="true">·</span>
            <span>{outfit.occasion}</span>
          </div>
          <h4 className="mt-0.5 font-space text-sm font-bold text-[#18181B]">{outfit.title}</h4>
        </div>
        <div className="text-right font-mono tabular-nums shrink-0">
          <div className="text-[11px] text-[#71717A]">Total look</div>
          <div className="text-sm font-bold text-[#18181B]">{formatInr(outfit.totalPrice)}</div>
        </div>
      </div>

      <p className="mt-2 text-xs text-[#52525B] leading-relaxed">{outfit.colorCoordination}</p>

      <div className="mt-2.5 divide-y divide-[#E5E4DF] rounded-lg border border-[#E5E4DF] bg-white">
        {outfit.pieces.map((piece) => {
          const thumb = piece.product.images?.[0]?.url || '';
          return (
            <div key={piece.product.id} className="flex items-center gap-2.5 p-2.5">
              <Link
                to={`/product/${piece.product.slug}`}
                onClick={onNavigateProduct}
                className="w-12 h-14 rounded-md overflow-hidden bg-[#F4F3EF] shrink-0 border border-[#E5E4DF]/60"
              >
                {thumb && (
                  <img
                    src={thumb}
                    alt={piece.product.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-[#64748B]">
                  {piece.role}
                  {piece.availableSizes.length > 0 && ` · ${piece.availableSizes.slice(0, 4).join(', ')}`}
                </div>
                <Link
                  to={`/product/${piece.product.slug}`}
                  onClick={onNavigateProduct}
                  className="block text-xs font-semibold text-[#18181B] hover:text-[#3F6212] truncate"
                >
                  {piece.product.name}
                </Link>
                <p className="text-[11px] text-[#71717A] line-clamp-1">{piece.stylingNote}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono tabular-nums text-xs font-semibold text-[#18181B]">
                  {formatInr(piece.unitPrice)}
                </div>
                <Link
                  to={`/product/${piece.product.slug}`}
                  onClick={onNavigateProduct}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#3F6212] hover:underline"
                >
                  <span>View</span>
                  <ArrowUpRight size={11} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {budgetInr && (
        <p className="mt-2 text-[11px] text-[#52525B]">
          {outfit.withinBudget
            ? `Fits within your ${formatInr(budgetInr)} budget (${formatInr(budgetInr - outfit.totalPrice)} under budget).`
            : `Note: Total look is ${formatInr(outfit.totalPrice - budgetInr)} above your ${formatInr(budgetInr)} target; you can also shop individual pieces above.`}
        </p>
      )}

      {outfit.missingCategoryNote && (
        <p className="mt-1.5 text-[11px] text-[#71717A] leading-relaxed">
          {outfit.missingCategoryNote}
        </p>
      )}

      {inStockPieces.length > 0 && (
        <button
          type="button"
          onClick={handleAddOutfitToBag}
          className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] ${
            addedAll
              ? 'bg-[#18181B] text-[#B8F130]'
              : 'bg-[#18181B] text-white hover:bg-[#27272A]'
          }`}
        >
          {addedAll ? (
            <>
              <Check size={14} />
              <span>Added Available Look Pieces to Bag</span>
            </>
          ) : (
            <>
              <ShoppingBag size={14} />
              <span>
                Add {inStockPieces.length === 1 ? 'Piece' : `All ${inStockPieces.length} Pieces`} to Bag ·{' '}
                <span className="font-mono tabular-nums">{formatInr(outfit.totalPrice)}</span>
              </span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
