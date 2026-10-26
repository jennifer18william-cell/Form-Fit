import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { ProductCard } from '../components/ProductCard';
import { EmptyCatalogState } from '../components/EmptyCatalogState';
import { Product } from '../types';
import {
  Filter,
  SlidersHorizontal,
  Search,
  X,
  ArrowRight,
  PlusCircle,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  getCategoryCanonicalKey,
  isAccessoriesCategoryKey,
  isFootwearCategoryKey,
  isMensFootwearCategoryKey,
  isProductFootwearItem,
  isProductMensFootwearItem,
  isProductWomensFootwearItem,
  isWomensFootwearCategoryKey,
  matchesProductCategoryFilter,
} from '../lib/categoryMapping';

import mensFootwearStudioImg from '../assets/images/mens_footwear_studio_poster_1792850976169.jpg';
import womensFootwearStudioImg from '../assets/images/womens_footwear_studio_poster_1792850976435.jpg';
import footwearFallbackImg from '../assets/images/footwear_leather_sneakers_studio_1792835303853.jpg';

export const Shop: React.FC = () => {
  const { products, categories, loading, catalogError, refreshCatalog } = useStore();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state synchronized with URL searchParams
  const selectedCategory = searchParams.get('category') || '';
  const selectedGender = searchParams.get('gender') || '';
  const searchQuery = searchParams.get('search') || '';
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [customPriceMax, setCustomPriceMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  const sliderMax = useMemo(() => {
    const highest = products.reduce(
      (max, p) => Math.max(max, Number(p.sale_price || p.regular_price || 0)),
      0
    );
    return Math.max(25000, Math.ceil(highest / 1000) * 1000);
  }, [products]);

  const priceMax = customPriceMax !== null ? customPriceMax : sliderMax;

  const selectedCategoryKey = getCategoryCanonicalKey(selectedCategory, categories);
  const selectedCategoryObj =
    categories.find((c) => c.id === selectedCategory || c.slug === selectedCategory) ||
    categories.find((c) => getCategoryCanonicalKey(c.id, categories, c) === selectedCategoryKey);

  const isFootwearCategoryId = (catId?: string) => isFootwearCategoryKey(catId, categories);

  const isFootwearZone =
    isFootwearCategoryId(selectedCategory) || selectedGender === 'Footwear';

  const isMensFootwearSelected = isMensFootwearCategoryKey(selectedCategory, categories);
  const isWomensFootwearSelected = isWomensFootwearCategoryKey(selectedCategory, categories);

  const isAllFootwearZone =
    isFootwearZone &&
    !isMensFootwearSelected &&
    !isWomensFootwearSelected &&
    getCategoryCanonicalKey(selectedCategoryObj?.parent_id, categories) !== 'footwear';

  const apparelSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  const footwearSizes = ['UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'];
  const activeSizeOptions = isFootwearZone ? footwearSizes : [...apparelSizes, 'UK 7', 'UK 8', 'UK 9', 'UK 10'];

  const isProductFootwear = (p: Product) => isProductFootwearItem(p, categories);
  const isProductMensFootwear = (p: Product) => isProductMensFootwearItem(p, categories);
  const isProductWomensFootwear = (p: Product) => isProductWomensFootwearItem(p, categories);

  const applyCommonFiltersAndSort = (list: Product[]) => {
    return list
      .filter((p) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(query);
          const matchDesc = (p.description || '').toLowerCase().includes(query);
          const matchFabric = (p.fabric_material || '').toLowerCase().includes(query);
          const matchSku = (p.sku || '').toLowerCase().includes(query);
          if (!matchName && !matchDesc && !matchFabric && !matchSku) return false;
        }
        if (selectedSize) {
          const hasSize = p.variants?.some(
            (v) => v.size === selectedSize && v.stock_quantity > 0
          );
          if (!hasSize) return false;
        }
        const effectivePrice = p.sale_price || p.regular_price;
        if (effectivePrice > priceMax) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') {
          return (a.sale_price || a.regular_price) - (b.sale_price || b.regular_price);
        }
        if (sortBy === 'price-high') {
          return (b.sale_price || b.regular_price) - (a.sale_price || a.regular_price);
        }
        if (sortBy === 'recommended') {
          return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  };

  const publishedProducts = useMemo(
    () => products.filter((p) => p.status === 'published'),
    [products]
  );

  // Total counts for Footwear Zone cards
  const totalMensFootwearCount = useMemo(
    () => publishedProducts.filter(isProductMensFootwear).length,
    [publishedProducts, categories]
  );
  const totalWomensFootwearCount = useMemo(
    () => publishedProducts.filter(isProductWomensFootwear).length,
    [publishedProducts, categories]
  );

  // Filtered Footwear Zone sub-lists
  const mensFootwearFiltered = useMemo(
    () => applyCommonFiltersAndSort(publishedProducts.filter(isProductMensFootwear)),
    [publishedProducts, categories, searchQuery, selectedSize, priceMax, sortBy]
  );

  const womensFootwearFiltered = useMemo(
    () => applyCommonFiltersAndSort(publishedProducts.filter(isProductWomensFootwear)),
    [publishedProducts, categories, searchQuery, selectedSize, priceMax, sortBy]
  );

  const unisexFootwearFiltered = useMemo(
    () =>
      applyCommonFiltersAndSort(
        publishedProducts.filter(
          (p) =>
            isProductFootwear(p) &&
            !isProductMensFootwear(p) &&
            !isProductWomensFootwear(p)
        )
      ),
    [publishedProducts, categories, searchQuery, selectedSize, priceMax, sortBy]
  );

  const filteredProducts = useMemo(() => {
    const baseMatched = publishedProducts.filter((p) => {
      if (selectedCategory) {
        if (!matchesProductCategoryFilter(p, selectedCategory, categories)) {
          return false;
        }
      }

      if (selectedGender) {
        if (selectedGender === 'Footwear') {
          if (!isProductFootwear(p)) return false;
        } else if (selectedGender === 'Accessories') {
          if (
            p.gender_collection !== 'Accessories' &&
            !isAccessoriesCategoryKey(p.category_id, categories, p.category)
          ) {
            return false;
          }
        } else if (
          !isMensFootwearSelected &&
          !isWomensFootwearSelected &&
          p.gender_collection !== selectedGender &&
          p.gender_collection !== 'Unisex'
        ) {
          const prodCatKey = getCategoryCanonicalKey(p.category_id, categories, p.category);
          const matchesMenCat =
            selectedGender === 'Men' &&
            (prodCatKey === 'mens-fashion' || prodCatKey === 'mens-footwear');
          const matchesWomenCat =
            selectedGender === 'Women' &&
            (prodCatKey === 'womens-fashion' ||
              prodCatKey === 'womens-footwear' ||
              prodCatKey === 'dresses-coords');
          if (!matchesMenCat && !matchesWomenCat) {
            return false;
          }
        }
      }

      return true;
    });

    return applyCommonFiltersAndSort(baseMatched);
  }, [
    publishedProducts,
    categories,
    selectedCategory,
    selectedGender,
    searchQuery,
    selectedSize,
    priceMax,
    sortBy,
  ]);

  const handleCategoryChange = (catId: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (catId) {
      newParams.set('category', catId);
      if (isFootwearCategoryId(catId)) {
        newParams.delete('gender');
      }
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams);
  };

  const handleGenderChange = (gender: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (gender === 'Footwear') {
      newParams.delete('gender');
      newParams.set('category', 'cat-9');
    } else if (gender) {
      newParams.set('gender', gender);
      if (isFootwearCategoryId(selectedCategory)) {
        newParams.delete('category');
      }
    } else {
      newParams.delete('gender');
    }
    setSearchParams(newParams);
  };

  const handleFootwearZoneSelect = (targetCatId: 'cat-9' | 'cat-9-men' | 'cat-9-women') => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('gender');
    newParams.set('category', targetCatId);
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setSelectedSize('');
    setCustomPriceMax(null);
    setSortBy('newest');
  };

  const topLevelCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories]
  );

  const getChildCategories = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  const renderFilterControls = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-[#E5E4DF] pb-3">
        <h3 className="font-space font-semibold text-xs uppercase tracking-wider flex items-center gap-2 text-[#18181B]">
          <Filter size={14} className="text-[#4D7C0F]" /> Filter Catalog
        </h3>
        {(selectedCategory || selectedGender || selectedSize || searchQuery || customPriceMax !== null) && (
          <button
            onClick={clearAllFilters}
            className="text-xs font-medium text-red-600 hover:underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* Gender / Collection Filter */}
      <div className="space-y-2">
        <h4 className="font-space font-semibold text-xs text-[#18181B]">Collection</h4>
        <div className="space-y-1 text-xs">
          {['', 'Men', 'Women', 'Unisex', 'Footwear', 'Accessories'].map((g) => {
            const isActive =
              g === 'Footwear'
                ? isFootwearZone
                : !isFootwearZone && selectedGender === g && (g !== '' || !selectedCategory);

            return (
              <button
                key={g || 'all'}
                onClick={() => (g === '' ? clearAllFilters() : handleGenderChange(g))}
                className={`block w-full text-left py-1.5 px-2.5 font-medium transition-colors cursor-pointer rounded-md ${
                  isActive
                    ? 'bg-[#F4FBE1] text-[#111111] font-semibold border border-[#BEF264]'
                    : 'hover:bg-[#F3F2EE] text-[#52525B]'
                }`}
              >
                {g === 'Footwear' ? 'Footwear Zone' : g || 'All Collections'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter with Footwear Subcategories */}
      <div className="space-y-2 pt-3 border-t border-[#E5E4DF]">
        <h4 className="font-space font-semibold text-xs text-[#18181B]">Categories</h4>
        <div className="space-y-1 text-xs max-h-64 overflow-y-auto pr-1">
          <button
            onClick={() => handleCategoryChange('')}
            className={`block w-full text-left py-1.5 px-2.5 font-medium cursor-pointer rounded-md transition-colors ${
              !selectedCategory && selectedGender !== 'Footwear'
                ? 'bg-[#F4FBE1] text-[#111111] font-semibold border border-[#BEF264]'
                : 'hover:bg-[#F3F2EE] text-[#52525B]'
            }`}
          >
            All Categories
          </button>
          {topLevelCategories.map((cat) => {
            const catKey = getCategoryCanonicalKey(cat.id, categories, cat);
            const children = getChildCategories(cat.id);
            const isParentSelected =
              (Boolean(selectedCategoryKey) && selectedCategoryKey === catKey) ||
              (catKey === 'footwear' && isAllFootwearZone);

            return (
              <React.Fragment key={cat.id}>
                <button
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`block w-full text-left py-1.5 px-2.5 font-medium cursor-pointer rounded-md transition-colors ${
                    isParentSelected
                      ? 'bg-[#F4FBE1] text-[#111111] font-semibold border border-[#BEF264]'
                      : 'hover:bg-[#F3F2EE] text-[#52525B]'
                  }`}
                >
                  {catKey === 'footwear' ? 'Footwear Zone' : cat.name}
                </button>

                {children.length > 0 && (
                  <div className="pl-3 ml-2 border-l border-[#E5E4DF] space-y-1 my-1">
                    {children.map((sub) => {
                      const subKey = getCategoryCanonicalKey(sub.id, categories, sub);
                      const isSubSelected = Boolean(selectedCategoryKey) && selectedCategoryKey === subKey;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleCategoryChange(sub.id)}
                          className={`block w-full text-left py-1.5 px-2.5 text-[11px] font-medium cursor-pointer rounded-md transition-colors ${
                            isSubSelected
                              ? 'bg-[#B8F130]/40 text-[#111111] font-semibold border border-[#9ED912]'
                              : 'hover:bg-[#F3F2EE] text-[#52525B]'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Size Filter */}
      <div className="space-y-2 pt-3 border-t border-[#E5E4DF]">
        <h4 className="font-space font-semibold text-xs text-[#18181B]">
          {isFootwearZone ? 'Footwear Size (UK)' : 'Available Size'}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedSize('')}
            className={`px-2.5 py-1 text-[11px] font-mono border cursor-pointer rounded-md transition-colors ${
              !selectedSize
                ? 'bg-[#B8F130] text-[#111111] border-[#9ED912] font-bold'
                : 'bg-white border-[#D6D5CE] text-[#52525B] hover:border-[#65A30D]'
            }`}
          >
            All
          </button>
          {activeSizeOptions.map((sz) => (
            <button
              key={sz}
              onClick={() => setSelectedSize(sz === selectedSize ? '' : sz)}
              className={`px-2.5 py-1 text-[11px] font-mono border cursor-pointer rounded-md transition-colors ${
                selectedSize === sz
                  ? 'bg-[#B8F130] text-[#111111] border-[#9ED912] font-bold'
                  : 'bg-white border-[#D6D5CE] text-[#52525B] hover:border-[#65A30D]'
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range Slider */}
      <div className="space-y-2 pt-3 border-t border-[#E5E4DF]">
        <div className="flex justify-between items-center text-xs font-space font-semibold text-[#18181B]">
          <span>Max Price</span>
          <span className="text-[#3F6212] font-mono tabular-nums font-bold">
            {customPriceMax === null
              ? `Any (Up to ₹${sliderMax.toLocaleString('en-IN')})`
              : `₹${priceMax.toLocaleString('en-IN')}`}
          </span>
        </div>
        <input
          type="range"
          min="499"
          max={sliderMax}
          step="500"
          value={priceMax}
          onChange={(e) => setCustomPriceMax(Number(e.target.value))}
          className="w-full accent-[#65A30D] cursor-pointer"
        />
      </div>
    </div>
  );

  const renderFootwearEmptyDepartment = (
    deptTitle: string,
    deptDesc: string,
    targetCategoryId: 'cat-9-men' | 'cat-9-women'
  ) => (
    <div className="bg-white border border-[#E5E4DF] rounded-xl p-8 text-center space-y-3">
      <p className="text-xs font-space font-bold uppercase tracking-wider text-[#65A30D]">
        {deptTitle}
      </p>
      <h4 className="font-space font-bold text-lg text-[#18181B]">
        {deptTitle} Under Curation
      </h4>
      <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed font-sans">
        {deptDesc}
      </p>
      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
        {isAdmin ? (
          <Link
            to={`/owner/products/new?category=${targetCategoryId}`}
            className="px-5 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <PlusCircle size={14} /> Add {deptTitle}
          </Link>
        ) : (
          <Link
            to="/owner/login"
            className="px-5 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <ShieldCheck size={14} /> Owner Login to Add {deptTitle}
          </Link>
        )}
      </div>
    </div>
  );

  const pageHeading = useMemo(() => {
    if (isMensFootwearSelected) return "Men's Footwear";
    if (isWomensFootwearSelected) return "Women's Footwear";
    if (isFootwearZone) return 'Footwear Zone';
    if (selectedGender) {
      if (['Accessories', 'Unisex'].includes(selectedGender)) {
        return selectedGender === 'Unisex' ? 'Unisex Streetwear' : selectedGender;
      }
      return `${selectedGender}'s Fashion`;
    }
    if (selectedCategory) {
      return selectedCategoryObj?.name || 'Category';
    }
    return 'Shop All Catalog';
  }, [selectedCategory, selectedGender, isFootwearZone, isMensFootwearSelected, isWomensFootwearSelected, selectedCategoryObj]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 text-[#18181B]">
      {/* Header */}
      <div className="border-b border-[#E5E4DF] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-space font-bold uppercase tracking-wider text-[#4D7C0F]">
            {isFootwearZone ? 'Form & Fit · Footwear Zone' : 'Form & Fit Collection'}
          </span>
          <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5 [text-wrap:balance]">
            {pageHeading}
          </h1>
          {isFootwearZone && (
            <p className="text-xs sm:text-sm text-[#57534E] mt-1 font-sans max-w-2xl">
              Explore dedicated Men&apos;s Footwear and Women&apos;s Footwear departments crafted on Italian-inspired lasts and full-grain leathers.
            </p>
          )}
          {searchQuery && (
            <p className="text-xs text-[#64748B] mt-1 font-sans">
              Search results for:{' '}
              <span className="font-semibold text-[#18181B]">&ldquo;{searchQuery}&rdquo;</span>
            </p>
          )}
        </div>

        {/* Sort Controls & Mobile Filter Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="md:hidden flex items-center gap-2 px-3.5 py-2 bg-white border border-[#D6D5CE] font-space text-xs font-semibold text-[#18181B] hover:border-[#65A30D] cursor-pointer rounded-md whitespace-nowrap"
          >
            <SlidersHorizontal size={14} className="text-[#4D7C0F]" /> Filters
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#64748B] shrink-0">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-[#D6D5CE] px-3 py-2 font-sans text-xs font-medium text-[#18181B] focus:outline-none focus:border-[#65A30D] cursor-pointer rounded-md"
            >
              <option value="newest">Newest Drops</option>
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dedicated Footwear Zone Banner: Separate Men's Footwear & Women's Footwear Categories */}
      {isFootwearZone && (
        <section className="space-y-5">
          {/* Interactive Department Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1.5 p-1.5 bg-[#F3F2EE] border border-[#E5E4DF] rounded-lg">
              <button
                type="button"
                onClick={() => handleFootwearZoneSelect('cat-9')}
                className={`px-4 py-2 text-xs font-space font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  isAllFootwearZone
                    ? 'bg-[#B8F130] text-[#111111] shadow-2xs'
                    : 'text-[#52525B] hover:text-[#111111] hover:bg-white/70'
                }`}
              >
                All Footwear Zone
              </button>
              <button
                type="button"
                onClick={() => handleFootwearZoneSelect('cat-9-men')}
                className={`px-4 py-2 text-xs font-space font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  isMensFootwearSelected
                    ? 'bg-[#B8F130] text-[#111111] shadow-2xs'
                    : 'text-[#52525B] hover:text-[#111111] hover:bg-white/70'
                }`}
              >
                Men&apos;s Footwear ({totalMensFootwearCount})
              </button>
              <button
                type="button"
                onClick={() => handleFootwearZoneSelect('cat-9-women')}
                className={`px-4 py-2 text-xs font-space font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  isWomensFootwearSelected
                    ? 'bg-[#B8F130] text-[#111111] shadow-2xs'
                    : 'text-[#52525B] hover:text-[#111111] hover:bg-white/70'
                }`}
              >
                Women&apos;s Footwear ({totalWomensFootwearCount})
              </button>
            </div>

            {!isAllFootwearZone && (
              <button
                type="button"
                onClick={() => handleFootwearZoneSelect('cat-9')}
                className="text-xs font-space font-bold uppercase tracking-wider text-[#3F6212] hover:text-[#111111] transition-colors cursor-pointer whitespace-nowrap"
              >
                ← Back to Both Footwear Categories
              </button>
            )}
          </div>

          {/* Two Separate Category Cards Inside the Footwear Zone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category 1: Men's Footwear */}
            <button
              type="button"
              onClick={() => handleFootwearZoneSelect('cat-9-men')}
              className={`group text-left bg-white rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-stretch ${
                isMensFootwearSelected
                  ? 'border-[#65A30D] ring-2 ring-[#B8F130]/60'
                  : 'border-[#E5E4DF] hover:border-[#9ED912]'
              }`}
            >
              <div className="sm:w-48 md:w-52 lg:w-60 aspect-[4/3] sm:aspect-auto bg-[#F3ECE2] overflow-hidden shrink-0">
                <img
                  src={mensFootwearStudioImg}
                  alt="Men's Footwear Category"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    const imgEl = e.currentTarget;
                    imgEl.onerror = null;
                    imgEl.src = footwearFallbackImg;
                  }}
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-space font-bold uppercase tracking-wider text-[#4D7C0F] tabular-nums">
                    <span>Category 01</span>
                    <span aria-hidden="true">·</span>
                    <span>{totalMensFootwearCount} Styles</span>
                  </div>
                  <h2 className="font-space font-bold text-xl text-[#111111] group-hover:text-[#4D7C0F] transition-colors">
                    Men&apos;s Footwear
                  </h2>
                  <p className="text-xs text-[#57534E] font-sans leading-relaxed">
                    Minimalist leather court sneakers, espresso suede loafers, and structured everyday silhouettes built for men.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-space font-bold uppercase tracking-wider text-[#111111] group-hover:text-[#4D7C0F] transition-colors">
                  <span>
                    {isMensFootwearSelected ? "Viewing Men's Footwear" : "Shop Men's Footwear"}
                  </span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>

            {/* Category 2: Women's Footwear */}
            <button
              type="button"
              onClick={() => handleFootwearZoneSelect('cat-9-women')}
              className={`group text-left bg-white rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-stretch ${
                isWomensFootwearSelected
                  ? 'border-[#65A30D] ring-2 ring-[#B8F130]/60'
                  : 'border-[#E5E4DF] hover:border-[#9ED912]'
              }`}
            >
              <div className="sm:w-48 md:w-52 lg:w-60 aspect-[4/3] sm:aspect-auto bg-[#F3ECE2] overflow-hidden shrink-0">
                <img
                  src={womensFootwearStudioImg}
                  alt="Women's Footwear Category"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    const imgEl = e.currentTarget;
                    imgEl.onerror = null;
                    imgEl.src = footwearFallbackImg;
                  }}
                />
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] font-space font-bold uppercase tracking-wider text-[#4D7C0F] tabular-nums">
                    <span>Category 02</span>
                    <span aria-hidden="true">·</span>
                    <span>{totalWomensFootwearCount} Styles</span>
                  </div>
                  <h2 className="font-space font-bold text-xl text-[#111111] group-hover:text-[#4D7C0F] transition-colors">
                    Women&apos;s Footwear
                  </h2>
                  <p className="text-xs text-[#57534E] font-sans leading-relaxed">
                    Sculpted warm-ivory leather sneakers, cognac horsebit loafers, and refined daily footwear designed for women.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-space font-bold uppercase tracking-wider text-[#111111] group-hover:text-[#4D7C0F] transition-colors">
                  <span>
                    {isWomensFootwearSelected ? "Viewing Women's Footwear" : "Shop Women's Footwear"}
                  </span>
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/25"
            onClick={() => setIsMobileFilterOpen(false)}
          />
          <div className="relative w-full max-w-xs bg-white h-full p-5 overflow-y-auto shadow-xl z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E4DF] pb-3">
              <span className="font-space font-bold text-sm text-[#18181B]">Filters</span>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-1.5 text-[#64748B] hover:text-[#18181B] rounded-md cursor-pointer"
                aria-label="Close filters"
              >
                <X size={18} />
              </button>
            </div>
            {renderFilterControls()}
            <button
              onClick={() => setIsMobileFilterOpen(false)}
              className="w-full py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider rounded-md cursor-pointer transition-colors"
            >
              Apply Filters ({filteredProducts.length})
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Desktop Sidebar Filters */}
        <div className="hidden md:block bg-white p-5 border border-[#E5E4DF] rounded-xl self-start">
          {renderFilterControls()}
        </div>

        {/* Main Products Content */}
        <div className="md:col-span-3 space-y-8">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B]">
            <span className="tabular-nums">
              {isAllFootwearZone
                ? `Showing ${mensFootwearFiltered.length + womensFootwearFiltered.length + unisexFootwearFiltered.length} footwear items across Men's & Women's zones`
                : `Showing ${filteredProducts.length} items`}
            </span>
            {searchQuery && (
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('search');
                  setSearchParams(newParams);
                }}
                className="flex items-center gap-1 text-red-600 hover:underline cursor-pointer"
              >
                Clear search <X size={12} />
              </button>
            )}
          </div>

          {loading && publishedProducts.length === 0 ? (
            <div
              className="grid grid-cols-2 lg:grid-cols-3 gap-6"
              aria-label="Loading Catalog"
            >
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className="bg-white border border-[#E5E4DF] rounded-lg overflow-hidden animate-pulse"
                >
                  <div className="aspect-[3/4] bg-[#EFECE6]" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-3 w-20 bg-[#E5E4DF] rounded" />
                    <div className="h-4 w-3/4 bg-[#E5E4DF] rounded" />
                    <div className="h-4 w-1/3 bg-[#E5E4DF] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : catalogError && publishedProducts.length === 0 ? (
            <div className="bg-white border border-[#FECACA] p-10 text-center space-y-4 rounded-xl">
              <AlertCircle size={30} className="mx-auto text-[#DC2626]" />
              <h3 className="font-space font-bold text-xl text-[#18181B]">
                Unable to Load Catalog
              </h3>
              <p className="text-xs text-[#52525B] max-w-md mx-auto leading-relaxed">
                {catalogError}
              </p>
              <button
                type="button"
                onClick={() => refreshCatalog()}
                className="px-6 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider cursor-pointer rounded-md inline-flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={14} /> Retry Loading Catalog
              </button>
            </div>
          ) : isAllFootwearZone ? (
            /* Separated Men's Footwear & Women's Footwear Sections Inside Footwear Zone */
            <div className="space-y-12">
              {/* Separate Section 1: Men's Footwear */}
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#E5E4DF] pb-3">
                  <div>
                    <span className="text-[11px] font-space font-bold uppercase tracking-wider text-[#4D7C0F]">
                      Footwear Zone · Men
                    </span>
                    <h2 className="font-space font-bold text-2xl tracking-tight text-[#111111] mt-0.5 tabular-nums">
                      Men&apos;s Footwear ({mensFootwearFiltered.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFootwearZoneSelect('cat-9-men')}
                    className="text-xs font-space font-bold uppercase tracking-wider text-[#111111] hover:text-[#4D7C0F] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Open Men&apos;s Footwear</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                {mensFootwearFiltered.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    {mensFootwearFiltered.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  renderFootwearEmptyDepartment(
                    "Men's Footwear",
                    "Minimalist court sneakers, suede loafers, and leather boots for men appear exclusively in this section once published.",
                    'cat-9-men'
                  )
                )}
              </div>

              {/* Separate Section 2: Women's Footwear */}
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#E5E4DF] pb-3">
                  <div>
                    <span className="text-[11px] font-space font-bold uppercase tracking-wider text-[#4D7C0F]">
                      Footwear Zone · Women
                    </span>
                    <h2 className="font-space font-bold text-2xl tracking-tight text-[#111111] mt-0.5 tabular-nums">
                      Women&apos;s Footwear ({womensFootwearFiltered.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFootwearZoneSelect('cat-9-women')}
                    className="text-xs font-space font-bold uppercase tracking-wider text-[#111111] hover:text-[#4D7C0F] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Open Women&apos;s Footwear</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                {womensFootwearFiltered.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    {womensFootwearFiltered.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  renderFootwearEmptyDepartment(
                    "Women's Footwear",
                    "Sculpted leather sneakers, cognac loafers, and everyday silhouettes for women appear exclusively in this section once published.",
                    'cat-9-women'
                  )
                )}
              </div>

              {/* Optional Unisex / General Footwear Section (only shown if such products exist) */}
              {unisexFootwearFiltered.length > 0 && (
                <div className="space-y-5">
                  <div className="border-b border-[#E5E4DF] pb-3">
                    <span className="text-[11px] font-space font-bold uppercase tracking-wider text-[#4D7C0F]">
                      Footwear Zone · Unisex
                    </span>
                    <h2 className="font-space font-bold text-2xl tracking-tight text-[#111111] mt-0.5 tabular-nums">
                      Unisex Footwear ({unisexFootwearFiltered.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    {unisexFootwearFiltered.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isMensFootwearSelected && filteredProducts.length === 0 ? (
            renderFootwearEmptyDepartment(
              "Men's Footwear",
              "No Men's Footwear styles match your current filters or none have been published yet.",
              'cat-9-men'
            )
          ) : isWomensFootwearSelected && filteredProducts.length === 0 ? (
            renderFootwearEmptyDepartment(
              "Women's Footwear",
              "No Women's Footwear styles match your current filters or none have been published yet.",
              'cat-9-women'
            )
          ) : filteredProducts.length === 0 ? (
            publishedProducts.length === 0 ? (
              <EmptyCatalogState />
            ) : (
              <div className="bg-white border border-[#E5E4DF] p-12 text-center space-y-4 rounded-xl">
                <Search size={32} className="mx-auto text-[#94A3B8]" />
                <h3 className="font-space font-bold text-xl text-[#18181B]">
                  No Matching Products
                </h3>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto font-sans">
                  Try adjusting your collection filters, price range, or search query.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="px-6 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider cursor-pointer rounded-md transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
