import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { Product, ProductImage, ProductVariant, GenderCollection, ProductStatus } from '../../types';
import { uploadProductImage } from '../../lib/supabase';
import {
  generateUUID,
  FASHION_PRESETS,
  getFashionFallbackImage,
} from '../../lib/imageOptimization';
import {
  getCategoryCanonicalKey,
} from '../../lib/categoryMapping';
import {
  Upload,
  Plus,
  Trash2,
  Star,
  ArrowLeft,
  Image as ImageIcon,
  Save,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';

export const OwnerProductForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const preselectedCatId = searchParams.get('category') || '';
  const { products, saveProduct, categories } = useStore();
  const navigate = useNavigate();

  const existingProduct = id ? products.find((p) => p.id === id) : null;

  const matchedPreselectedCat = preselectedCatId
    ? categories.find(
        (c) =>
          c.id === preselectedCatId ||
          getCategoryCanonicalKey(c.id, categories, c) ===
            getCategoryCanonicalKey(preselectedCatId, categories)
      )
    : undefined;

  const initialCatId =
    existingProduct?.category_id ||
    matchedPreselectedCat?.id ||
    categories[0]?.id ||
    '';

  const initialCatKey = getCategoryCanonicalKey(initialCatId, categories);

  const deriveGenderForCategoryKey = (key: string): GenderCollection => {
    if (key === 'mens-fashion' || key === 'mens-footwear') return 'Men';
    if (key === 'womens-fashion' || key === 'womens-footwear' || key === 'dresses-coords') return 'Women';
    if (key === 'footwear') return 'Footwear';
    if (key === 'accessories') return 'Accessories';
    if (key === 'custom-apparel') return 'Custom Apparel';
    return 'Unisex';
  };

  const initialGender: GenderCollection = existingProduct?.gender_collection
    ? existingProduct.gender_collection
    : deriveGenderForCategoryKey(initialCatKey);

  const getDefaultVariantsForCategory = (catId: string): ProductVariant[] => {
    const key = getCategoryCanonicalKey(catId, categories);
    const seed = Math.floor(1000 + Math.random() * 9000);
    if (key === 'mens-footwear' || key === 'footwear') {
      return [
        { id: generateUUID(), product_id: '', sku: `FF-${seed}-UK7`, size: 'UK 7', color: 'Ivory', stock_quantity: 10, is_active: true },
        { id: generateUUID(), product_id: '', sku: `FF-${seed}-UK8`, size: 'UK 8', color: 'Ivory', stock_quantity: 15, is_active: true },
        { id: generateUUID(), product_id: '', sku: `FF-${seed}-UK9`, size: 'UK 9', color: 'Ivory', stock_quantity: 15, is_active: true },
      ];
    }
    if (key === 'womens-footwear') {
      return [
        { id: generateUUID(), product_id: '', sku: `FF-${seed}-UK5`, size: 'UK 5', color: 'Ivory', stock_quantity: 10, is_active: true },
        { id: generateUUID(), product_id: '', sku: `FF-${seed}-UK6`, size: 'UK 6', color: 'Ivory', stock_quantity: 15, is_active: true },
        { id: generateUUID(), product_id: '', sku: `FF-${seed}-UK7`, size: 'UK 7', color: 'Ivory', stock_quantity: 15, is_active: true },
      ];
    }
    return [
      { id: generateUUID(), product_id: '', sku: `FF-${seed}-S`, size: 'S', color: 'Ivory', stock_quantity: 10, is_active: true },
      { id: generateUUID(), product_id: '', sku: `FF-${seed}-M`, size: 'M', color: 'Ivory', stock_quantity: 15, is_active: true },
      { id: generateUUID(), product_id: '', sku: `FF-${seed}-L`, size: 'L', color: 'Ivory', stock_quantity: 20, is_active: true },
    ];
  };

  // Form states
  const [name, setName] = useState(existingProduct?.name || '');
  const [slug, setSlug] = useState(existingProduct?.slug || '');
  const [sku, setSku] = useState(existingProduct?.sku || '');
  const [shortDesc, setShortDesc] = useState(existingProduct?.short_desc || '');
  const [description, setDescription] = useState(existingProduct?.description || '');
  const [categoryId, setCategoryId] = useState(initialCatId);
  const [genderCollection, setGenderCollection] = useState<GenderCollection>(initialGender);
  const [regularPrice, setRegularPrice] = useState<number>(existingProduct?.regular_price || 999);
  const [salePrice, setSalePrice] = useState<number | undefined>(existingProduct?.sale_price);
  const [costPrice, setCostPrice] = useState<number | undefined>(existingProduct?.cost_price);
  const [fabricMaterial, setFabricMaterial] = useState(existingProduct?.fabric_material || '');
  const [fit, setFit] = useState(existingProduct?.fit || '');
  const [careInstructions, setCareInstructions] = useState(existingProduct?.care_instructions || '');
  const [status, setStatus] = useState<ProductStatus>(existingProduct?.status || 'published');
  const [featured, setFeatured] = useState<boolean>(existingProduct?.featured || false);
  const [seoTitle, setSeoTitle] = useState(existingProduct?.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(existingProduct?.seo_description || '');

  // Images & Variants
  const [images, setImages] = useState<ProductImage[]>(existingProduct?.images || []);
  const [variants, setVariants] = useState<ProductVariant[]>(
    existingProduct?.variants || getDefaultVariantsForCategory(initialCatId)
  );

  // Image Upload & URL states
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if existingProduct or Supabase categories load asynchronously
  useEffect(() => {
    if (existingProduct) {
      setName(existingProduct.name || '');
      setSlug(existingProduct.slug || '');
      setSku(existingProduct.sku || '');
      setShortDesc(existingProduct.short_desc || '');
      setDescription(existingProduct.description || '');
      const matchedCat =
        categories.find(
          (c) =>
            c.id === existingProduct.category_id ||
            getCategoryCanonicalKey(c.id, categories, c) ===
              getCategoryCanonicalKey(existingProduct.category_id, categories, existingProduct.category)
        ) || categories[0];
      setCategoryId(matchedCat?.id || existingProduct.category_id || '');
      setGenderCollection(existingProduct.gender_collection || 'Unisex');
      setRegularPrice(existingProduct.regular_price || 999);
      setSalePrice(existingProduct.sale_price);
      setCostPrice(existingProduct.cost_price);
      setFabricMaterial(existingProduct.fabric_material || '');
      setFit(existingProduct.fit || '');
      setCareInstructions(existingProduct.care_instructions || '');
      setStatus(existingProduct.status || 'published');
      setFeatured(existingProduct.featured || false);
      setSeoTitle(existingProduct.seo_title || '');
      setSeoDescription(existingProduct.seo_description || '');
      if (existingProduct.images && existingProduct.images.length > 0) {
        setImages(existingProduct.images);
      }
      if (existingProduct.variants && existingProduct.variants.length > 0) {
        setVariants(existingProduct.variants);
      }
    } else if (categories.length > 0) {
      // Ensure new product form `categoryId` resolves to the live UUID in `categories`
      const directMatch = categories.find((c) => c.id === categoryId);
      if (!directMatch) {
        const keyToFind = getCategoryCanonicalKey(preselectedCatId || categoryId, categories);
        const byCanonical = categories.find(
          (c) => getCategoryCanonicalKey(c.id, categories, c) === keyToFind
        );
        const resolvedId = byCanonical?.id || categories[0].id;
        setCategoryId(resolvedId);
        if (preselectedCatId) {
          setGenderCollection(
            deriveGenderForCategoryKey(getCategoryCanonicalKey(resolvedId, categories))
          );
        }
      }
    }
  }, [existingProduct, categories, preselectedCatId]);

  // Auto slug generation from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!existingProduct) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  // Image File Upload with optimization & fallback
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadFeedback({ type: 'info', text: 'Optimizing and uploading photography...' });

    const newImagesList: ProductImage[] = [];
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const res = await uploadProductImage(file);
        if (res && res.url) {
          const newImg: ProductImage = {
            id: generateUUID(),
            product_id: existingProduct?.id || '',
            url: res.url,
            storage_path: res.path,
            is_main: images.length === 0 && newImagesList.length === 0,
            display_order: images.length + newImagesList.length,
          };
          newImagesList.push(newImg);
          successCount++;
        }
      } catch (err) {
        console.error('File upload error:', err);
      }
    }

    if (newImagesList.length > 0) {
      setImages((prev) => {
        const updated = [...prev, ...newImagesList];
        if (!updated.some((img) => img.is_main)) {
          updated[0].is_main = true;
        }
        return updated;
      });

      setVariants((prev) =>
        prev.map((v, idx) =>
          idx === 0 && !v.variant_image_url ? { ...v, variant_image_url: newImagesList[0].url } : v
        )
      );

      setUploadFeedback({
        type: 'success',
        text: `Added ${successCount} high-resolution product photo(s).`,
      });
    } else {
      setUploadFeedback({
        type: 'error',
        text: 'Could not process selected image file(s). Please try another format or URL.',
      });
    }

    setIsUploading(false);
    setTimeout(() => setUploadFeedback(null), 5000);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Add Image via Direct Web URL
  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image')) {
      setUploadFeedback({ type: 'error', text: 'Please enter a valid HTTP/HTTPS image URL.' });
      return;
    }

    const newImg: ProductImage = {
      id: generateUUID(),
      product_id: existingProduct?.id || '',
      url: trimmed,
      is_main: images.length === 0,
      display_order: images.length,
    };

    setImages((prev) => [...prev, newImg]);
    setImageUrlInput('');
    setUploadFeedback({ type: 'success', text: 'Image URL added to gallery.' });
    setTimeout(() => setUploadFeedback(null), 4000);
  };

  // Add Curated Preset Image
  const handleSelectPreset = (presetUrl: string) => {
    const newImg: ProductImage = {
      id: generateUUID(),
      product_id: existingProduct?.id || '',
      url: presetUrl,
      is_main: images.length === 0,
      display_order: images.length,
    };
    setImages((prev) => [...prev, newImg]);
    setShowPresets(false);
    setUploadFeedback({ type: 'success', text: 'Studio fashion photo added to gallery.' });
    setTimeout(() => setUploadFeedback(null), 4000);
  };

  const setMainImage = (imgId: string) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        is_main: img.id === imgId,
      }))
    );
    const targetImg = images.find((i) => i.id === imgId);
    if (targetImg) {
      setVariants((prev) =>
        prev.map((v, idx) => (idx === 0 ? { ...v, variant_image_url: targetImg.url } : v))
      );
    }
  };

  const removeImage = (imgId: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== imgId);
      if (filtered.length > 0 && !filtered.some((i) => i.is_main)) {
        filtered[0].is_main = true;
      }
      return filtered;
    });
  };

  // Variant operations
  const addVariantRow = () => {
    const newV: ProductVariant = {
      id: generateUUID(),
      product_id: existingProduct?.id || '',
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      size: 'M',
      color: 'Ivory',
      stock_quantity: 10,
      is_active: true,
      variant_image_url: images.find((i) => i.is_main)?.url || images[0]?.url,
    };
    setVariants((prev) => [...prev, newV]);
  };

  const updateVariantRow = (index: number, updates: Partial<ProductVariant>) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const removeVariantRow = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);

    let finalImages = [...images];
    if (finalImages.length === 0) {
      const fallbackUrl = getFashionFallbackImage(name, categories.find((c) => c.id === categoryId)?.name);
      finalImages = [
        {
          id: generateUUID(),
          product_id: existingProduct?.id || '',
          url: fallbackUrl,
          is_main: true,
          display_order: 0,
        },
      ];
    }

    const mainImageUrl = finalImages.find((i) => i.is_main)?.url || finalImages[0]?.url;
    const syncedVariants = variants.map((v, idx) => ({
      ...v,
      variant_image_url: v.variant_image_url || (idx === 0 ? mainImageUrl : undefined),
    }));

    const productPayload: Partial<Product> = {
      id: existingProduct?.id,
      name: name.trim(),
      slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      sku: sku.trim() || `FF-${Math.floor(100000 + Math.random() * 900000)}`,
      short_desc: shortDesc.trim(),
      description: description.trim(),
      category_id: categoryId,
      gender_collection: genderCollection,
      regular_price: Number(regularPrice) || 0,
      sale_price: salePrice ? Number(salePrice) : undefined,
      cost_price: costPrice ? Number(costPrice) : undefined,
      fabric_material: fabricMaterial.trim(),
      fit: fit.trim(),
      care_instructions: careInstructions.trim(),
      status,
      featured,
      seo_title: seoTitle.trim() || name.trim(),
      seo_description: seoDescription.trim() || shortDesc.trim(),
      images: finalImages,
      variants: syncedVariants,
    };

    try {
      await saveProduct(productPayload);
      setIsSaving(false);
      navigate('/owner/products');
    } catch (err: any) {
      setIsSaving(false);
      setUploadFeedback({
        type: 'error',
        text:
          err?.message ||
          'Database save failed. Product was not published yet—please check your connection or Supabase RLS policies.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const inputClass =
    'w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors';

  return (
    <OwnerLayout>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E4DF] pb-4">
          <div className="flex items-center gap-3">
            <Link
              to="/owner/products"
              className="p-2 bg-white border border-[#D6D5CE] rounded-lg text-[#18181B] hover:border-[#65A30D] hover:text-[#3F6212] hover:bg-[#F4FBE1] transition-colors"
              aria-label="Back to catalog"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <p className="text-xs font-medium text-[#64748B]">
                {existingProduct ? 'Edit Apparel Item' : 'New Apparel Upload'}
              </p>
              <h1 className="font-space font-bold text-2xl tracking-tight text-[#18181B]">
                {name || 'New Fashion Piece'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
              className="bg-white border border-[#D6D5CE] rounded-lg px-3 py-2.5 text-xs font-semibold text-[#18181B] focus:border-[#65A30D] focus:outline-none cursor-pointer"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Save size={15} /> {isSaving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {uploadFeedback && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all ${
              uploadFeedback.type === 'success'
                ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                : uploadFeedback.type === 'error'
                ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                : 'bg-[#F4FBE1] border-[#BEF264] text-[#3F6212]'
            }`}
          >
            {uploadFeedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
            ) : (
              <AlertCircle
                size={16}
                className={uploadFeedback.type === 'error' ? 'text-[#DC2626] shrink-0' : 'text-[#4D7C0F] shrink-0'}
              />
            )}
            <span>{uploadFeedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Details */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
              <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3">
                General Product Details
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Heavyweight Boxy Fit Tee / Oxford Shirt"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#18181B]">
                      URL Slug
                    </label>
                    <input
                      type="text"
                      placeholder="heavyweight-boxy-fit-tee"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#18181B]">
                      Parent SKU
                    </label>
                    <input
                      type="text"
                      placeholder="FF-TEE-001"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">
                    Short Summary (Shown in card &amp; quick views)
                  </label>
                  <input
                    type="text"
                    placeholder="240 GSM combed cotton structured relaxed fit t-shirt."
                    value={shortDesc}
                    onChange={(e) => setShortDesc(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">
                    Full Description &amp; Design Notes
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Detailed explanation of tailoring, fabric density, drop shoulders, stitch reinforcement..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Product Photography Uploader & Media Hub */}
            <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E5E4DF] pb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-[#4D7C0F]" />
                  <h2 className="font-space font-semibold text-sm text-[#18181B] tabular-nums">
                    Product Photography ({images.length})
                  </h2>
                  {images.length > 0 && (
                    <span className="text-xs text-[#15803D] font-medium">
                      · Ready for Storefront
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPresets(!showPresets)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D6D5CE] bg-[#FAF9F6] hover:bg-[#F4FBE1] hover:border-[#BEF264] hover:text-[#3F6212] text-[#18181B] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FolderOpen size={13} /> {showPresets ? 'Hide Studio Presets' : 'Studio Preset Library'}
                </button>
              </div>

              {/* Curated Studio Presets Drawer (Light Theme) */}
              {showPresets && (
                <div className="p-4 bg-[#FAF9F6] border border-[#E5E4DF] rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-[#18181B]">
                      Select Studio Fashion Photography
                    </p>
                    <span className="text-[11px] text-[#64748B] font-mono">Click to add</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {FASHION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.url)}
                        className="group relative aspect-[3/4] bg-white border border-[#E5E4DF] hover:border-[#65A30D] rounded-lg overflow-hidden text-left cursor-pointer transition-all"
                      >
                        <img
                          src={preset.thumb}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent">
                          <p className="text-[10px] text-white font-semibold truncate">{preset.name}</p>
                          <p className="text-[9px] text-slate-200 font-mono">{preset.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-colors ${
                  isDragOver ? 'border-[#65A30D] bg-[#F4FBE1]/70' : 'border-[#D6D5CE] bg-[#FAF9F6]'
                }`}
              >
                <Upload
                  size={28}
                  className={`mx-auto ${isDragOver ? 'text-[#4D7C0F]' : 'text-[#64748B]'}`}
                />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#18181B]">
                    {isUploading ? 'Optimizing & Uploading Photos...' : 'Drag & Drop Device Photos or Browse'}
                  </p>
                  <p className="text-[11px] text-[#64748B] font-sans">
                    Automatically optimized to 1200×1600 WebP for fast catalog loading
                  </p>
                </div>

                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="image-upload-input"
                  disabled={isUploading}
                />
                <label
                  htmlFor="image-upload-input"
                  className="inline-block px-4 py-2 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space text-xs font-bold cursor-pointer transition-colors"
                >
                  {isUploading ? 'Processing...' : 'Browse Device Photos'}
                </label>
              </div>

              {/* Add via Direct Web URL */}
              <div className="bg-[#FAF9F6] border border-[#E5E4DF] rounded-xl p-3 flex flex-col sm:flex-row gap-2.5 items-center">
                <div className="relative flex-1 w-full">
                  <input
                    type="url"
                    placeholder="Or paste direct image URL (https://...)"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddImageUrl();
                      }
                    }}
                    className="w-full bg-white border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs font-mono pl-9 text-[#18181B] focus:border-[#65A30D] focus:outline-none"
                  />
                  <LinkIcon size={14} className="absolute left-3 top-2.5 text-[#64748B]" />
                </div>
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="px-4 py-2 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space text-xs font-bold transition-colors shrink-0 w-full sm:w-auto cursor-pointer whitespace-nowrap"
                >
                  Add Image URL
                </button>
              </div>

              {/* Uploaded Images Gallery Grid */}
              {images.length > 0 ? (
                <div className="space-y-2.5 pt-2">
                  <p className="text-xs font-semibold text-[#52525B] tabular-nums">
                    Product Gallery ({images.length} photo{images.length > 1 ? 's' : ''})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {images.map((img, idx) => (
                      <div
                        key={img.id || idx}
                        className={`relative aspect-[3/4] bg-[#F3F2EE] rounded-lg border group overflow-hidden ${
                          img.is_main
                            ? 'border-2 border-[#65A30D] ring-2 ring-[#ECFCCB]'
                            : 'border-[#E5E4DF]'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt="Product thumbnail"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = getFashionFallbackImage(name);
                          }}
                        />

                        {img.is_main && (
                          <div className="absolute top-2 left-2 bg-white/95 border border-[#BEF264] text-[#3F6212] text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                            <Star size={10} className="fill-[#B8F130] text-[#3F6212]" /> Main
                          </div>
                        )}

                        <div className="absolute inset-0 bg-white/85 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                          <button
                            type="button"
                            onClick={() => removeImage(img.id)}
                            className="self-end p-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-[#DC2626] rounded-md cursor-pointer transition-colors"
                            title="Remove image"
                          >
                            <Trash2 size={13} />
                          </button>

                          {!img.is_main && (
                            <button
                              type="button"
                              onClick={() => setMainImage(img.id)}
                              className="w-full py-1.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-md font-space text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              Set as Main
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[#92400E] text-xs font-sans flex items-center gap-2">
                  <AlertCircle size={16} className="text-[#D97706] shrink-0" />
                  <span>
                    No photos added yet. Upload files, paste a link, or select from the Studio Preset Library above.
                  </span>
                </div>
              )}
            </div>

            {/* Variants & Stock Matrix */}
            <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-[#E5E4DF] pb-3">
                <h2 className="font-space font-semibold text-sm text-[#18181B]">
                  Size, Color &amp; Stock Variants
                </h2>
                <button
                  type="button"
                  onClick={addVariantRow}
                  className="px-3 py-1.5 bg-[#F4FBE1] hover:bg-[#ECFCCB] border border-[#BEF264] text-[#3F6212] rounded-lg font-space text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Plus size={14} /> Add Variant
                </button>
              </div>

              <div className="space-y-3">
                {variants.map((v, idx) => (
                  <div
                    key={v.id || idx}
                    className="grid grid-cols-12 gap-2.5 items-center bg-[#FAF9F6] p-3 rounded-lg border border-[#E5E4DF] text-xs"
                  >
                    <div className="col-span-3">
                      <label className="text-[10px] font-medium block text-[#64748B] mb-1">Variant SKU</label>
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => updateVariantRow(idx, { sku: e.target.value })}
                        className="w-full bg-white border border-[#D6D5CE] rounded-md px-2 py-1.5 font-mono text-xs text-[#18181B] focus:border-[#65A30D] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-medium block text-[#64748B] mb-1">Size</label>
                      <input
                        type="text"
                        placeholder="S, M, L"
                        value={v.size || ''}
                        onChange={(e) => updateVariantRow(idx, { size: e.target.value })}
                        className="w-full bg-white border border-[#D6D5CE] rounded-md px-2 py-1.5 font-mono text-xs uppercase text-[#18181B] focus:border-[#65A30D] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-medium block text-[#64748B] mb-1">Color</label>
                      <input
                        type="text"
                        placeholder="Ivory, Slate..."
                        value={v.color || ''}
                        onChange={(e) => updateVariantRow(idx, { color: e.target.value })}
                        className="w-full bg-white border border-[#D6D5CE] rounded-md px-2 py-1.5 text-xs text-[#18181B] focus:border-[#65A30D] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-medium block text-[#64748B] mb-1">Stock Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={v.stock_quantity}
                        onChange={(e) => updateVariantRow(idx, { stock_quantity: Number(e.target.value) })}
                        className="w-full bg-white border border-[#D6D5CE] rounded-md px-2 py-1.5 font-mono text-xs tabular-nums text-[#18181B] focus:border-[#65A30D] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeVariantRow(idx)}
                        className="text-[#DC2626] hover:text-[#991B1B] cursor-pointer pt-4"
                        title="Remove Variant"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar Details: Pricing, Category, Fabric */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
              <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3">
                Pricing &amp; Private Costs
              </h2>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">
                    Regular Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(Number(e.target.value))}
                    className={`${inputClass} font-mono font-semibold tabular-nums`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#18181B]">
                    Sale Discount Price (₹ INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional sale price..."
                    value={salePrice || ''}
                    onChange={(e) => setSalePrice(e.target.value ? Number(e.target.value) : undefined)}
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </div>

                <div className="space-y-1.5 pt-3 border-t border-[#E5E4DF]">
                  <label className="block text-xs font-semibold text-[#991B1B]">
                    Private Owner Cost Price (₹ INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Private manufacturing cost..."
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-[#18181B] focus:bg-white focus:border-[#DC2626] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#64748B]">Never visible to store customers.</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
              <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3">
                Category &amp; Fabric Profile
              </h2>

              <div className="space-y-3 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">Store Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      const nextCatId = e.target.value;
                      setCategoryId(nextCatId);
                      const nextKey = getCategoryCanonicalKey(nextCatId, categories);
                      if (
                        [
                          'mens-fashion',
                          'mens-footwear',
                          'womens-fashion',
                          'womens-footwear',
                          'dresses-coords',
                          'footwear',
                          'accessories',
                          'custom-apparel',
                          'unisex',
                        ].includes(nextKey)
                      ) {
                        setGenderCollection(deriveGenderForCategoryKey(nextKey));
                      }
                    }}
                    className={`${inputClass} cursor-pointer`}
                  >
                    {categories
                      .filter((c) => !c.parent_id)
                      .map((c) => {
                        const subcats = categories.filter((sub) => sub.parent_id === c.id);
                        const isFw = getCategoryCanonicalKey(c.id, categories, c) === 'footwear';
                        return (
                          <React.Fragment key={c.id}>
                            <option value={c.id}>
                              {isFw ? 'Footwear (Footwear Zone)' : c.name}
                            </option>
                            {subcats.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                &nbsp;&nbsp;↳ {sub.name}
                              </option>
                            ))}
                          </React.Fragment>
                        );
                      })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">Gender Collection</label>
                  <select
                    value={genderCollection}
                    onChange={(e) => setGenderCollection(e.target.value as GenderCollection)}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                    <option value="Unisex">Unisex</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Custom Apparel">Custom Apparel</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">Fabric &amp; Material</label>
                  <input
                    type="text"
                    placeholder="e.g. 100% Combed Cotton 240 GSM"
                    value={fabricMaterial}
                    onChange={(e) => setFabricMaterial(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">Fit Profile</label>
                  <input
                    type="text"
                    placeholder="e.g. Oversized Relaxed Fit"
                    value={fit}
                    onChange={(e) => setFit(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="accent-[#65A30D] w-4 h-4 rounded"
                    />
                    <span className="font-semibold text-xs text-[#18181B]">Feature on Homepage Grid</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </OwnerLayout>
  );
};
