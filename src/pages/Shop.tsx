import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { EmptyCatalogState } from '../components/EmptyCatalogState';
import { Filter, SlidersHorizontal, Search, X } from 'lucide-react';

export const Shop: React.FC = () => {
  const { products, categories } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state synchronized with URL searchParams
  const selectedCategory = searchParams.get('category') || '';
  const selectedGender = searchParams.get('gender') || '';
  const searchQuery = searchParams.get('search') || '';
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [priceMax, setPriceMax] = useState<number>(10000);
  const [sortBy, setSortBy] = useState<string>('newest');
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  const allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'UK 7', 'UK 8', 'UK 9', 'UK 10'];

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.status === 'published')
      .filter((p) => {
        if (selectedCategory && p.category_id !== selectedCategory) return false;
        if (selectedGender) {
          if (selectedGender === 'Footwear') {
            if (p.gender_collection !== 'Footwear' && p.category_id !== 'cat-9') return false;
          } else if (selectedGender === 'Accessories') {
            if (p.gender_collection !== 'Accessories' && p.category_id !== 'cat-10') return false;
          } else if (
            p.gender_collection !== selectedGender &&
            p.gender_collection !== 'Unisex'
          ) {
            return false;
          }
        }
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
  }, [
    products,
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
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams);
  };

  const handleGenderChange = (gender: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (gender) {
      newParams.set('gender', gender);
    } else {
      newParams.delete('gender');
    }
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setSearchParams({});
    setSelectedSize('');
    setPriceMax(10000);
    setSortBy('newest');
  };

  const renderFilterControls = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-[#E5E4DF] pb-3">
        <h3 className="font-space font-semibold text-xs uppercase tracking-wider flex items-center gap-2 text-[#18181B]">
          <Filter size={14} className="text-[#1D4ED8]" /> Filter Catalog
        </h3>
        {(selectedCategory || selectedGender || selectedSize || searchQuery || priceMax < 10000) && (
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
          {['', 'Men', 'Women', 'Unisex', 'Footwear', 'Accessories'].map((g) => (
            <button
              key={g || 'all'}
              onClick={() => handleGenderChange(g)}
              className={`block w-full text-left py-1.5 px-2.5 font-medium transition-colors cursor-pointer rounded-md ${
                selectedGender === g
                  ? 'bg-[#EEF2FF] text-[#1D4ED8] font-semibold'
                  : 'hover:bg-[#F3F2EE] text-[#52525B]'
              }`}
            >
              {g || 'All Collections'}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="space-y-2 pt-3 border-t border-[#E5E4DF]">
        <h4 className="font-space font-semibold text-xs text-[#18181B]">Categories</h4>
        <div className="space-y-1 text-xs max-h-52 overflow-y-auto pr-1">
          <button
            onClick={() => handleCategoryChange('')}
            className={`block w-full text-left py-1.5 px-2.5 font-medium cursor-pointer rounded-md transition-colors ${
              !selectedCategory
                ? 'bg-[#EEF2FF] text-[#1D4ED8] font-semibold'
                : 'hover:bg-[#F3F2EE] text-[#52525B]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={`block w-full text-left py-1.5 px-2.5 font-medium cursor-pointer rounded-md transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[#EEF2FF] text-[#1D4ED8] font-semibold'
                  : 'hover:bg-[#F3F2EE] text-[#52525B]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Size Filter */}
      <div className="space-y-2 pt-3 border-t border-[#E5E4DF]">
        <h4 className="font-space font-semibold text-xs text-[#18181B]">Available Size</h4>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedSize('')}
            className={`px-2.5 py-1 text-[11px] font-mono border cursor-pointer rounded-md transition-colors ${
              !selectedSize
                ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] font-semibold'
                : 'bg-white border-[#D6D5CE] text-[#52525B] hover:border-[#94A3B8]'
            }`}
          >
            All
          </button>
          {allSizes.map((sz) => (
            <button
              key={sz}
              onClick={() => setSelectedSize(sz === selectedSize ? '' : sz)}
              className={`px-2.5 py-1 text-[11px] font-mono border cursor-pointer rounded-md transition-colors ${
                selectedSize === sz
                  ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] font-semibold'
                  : 'bg-white border-[#D6D5CE] text-[#52525B] hover:border-[#94A3B8]'
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
          <span className="text-[#1D4ED8] font-mono tabular-nums">
            ₹{priceMax.toLocaleString('en-IN')}
          </span>
        </div>
        <input
          type="range"
          min="499"
          max="15000"
          step="500"
          value={priceMax}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          className="w-full accent-[#1D4ED8] cursor-pointer"
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 text-[#18181B]">
      {/* Header */}
      <div className="border-b border-[#E5E4DF] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#1D4ED8]">
            Form &amp; Fit Collection
          </span>
          <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
            {selectedGender
              ? `${selectedGender}'s Fashion`
              : selectedCategory
              ? categories.find((c) => c.id === selectedCategory)?.name || 'Category'
              : 'Shop All Catalog'}
          </h1>
          {searchQuery && (
            <p className="text-xs text-[#64748B] mt-1 font-sans">
              Search results for:{' '}
              <span className="font-semibold text-[#18181B]">"{searchQuery}"</span>
            </p>
          )}
        </div>

        {/* Sort Controls & Mobile Filter Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="md:hidden flex items-center gap-2 px-3.5 py-2 bg-white border border-[#D6D5CE] font-space text-xs font-semibold text-[#18181B] hover:border-[#1D4ED8] cursor-pointer rounded-md whitespace-nowrap"
          >
            <SlidersHorizontal size={14} className="text-[#1D4ED8]" /> Filters
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#64748B] shrink-0">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-[#D6D5CE] px-3 py-2 font-sans text-xs font-medium text-[#18181B] focus:outline-none focus:border-[#1D4ED8] cursor-pointer rounded-md"
            >
              <option value="newest">Newest Drops</option>
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/25"
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
              className="w-full py-2.5 bg-[#1D4ED8] text-white font-space font-semibold text-xs rounded-md hover:bg-[#1E40AF] cursor-pointer"
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

        {/* Main Products Grid */}
        <div className="md:col-span-3 space-y-6">
          <div className="flex items-center justify-between text-xs font-medium text-[#64748B]">
            <span className="tabular-nums">Showing {filteredProducts.length} items</span>
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

          {filteredProducts.length === 0 ? (
            products.filter((p) => p.status === 'published').length === 0 ? (
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
                  className="px-6 py-2.5 bg-[#1D4ED8] text-white font-space font-semibold text-xs cursor-pointer rounded-md hover:bg-[#1E40AF] transition-colors"
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
