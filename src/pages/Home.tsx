import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { ProductCard } from '../components/ProductCard';
import { EmptyCatalogState } from '../components/EmptyCatalogState';
import { fetchFashionImages } from '../services/fashionImageService';
import {
  ArrowRight,
  Zap,
  Shirt,
  CheckCircle2,
  ChevronRight,
  Palette,
} from 'lucide-react';

const EDITORIAL_HERO_ASSET = '/assets/aistudio/Form___Fit__Editorial_Essentials_b0cfeab9.png';
const FOOTWEAR_STUDIO_IMG = '/src/assets/images/footwear_leather_sneakers_studio_1792835303853.jpg';
const ACCESSORIES_STUDIO_IMG = '/src/assets/images/accessories_leather_goods_studio_1792835304388.jpg';

export const Home: React.FC = () => {
  const { products, storeSettings } = useStore();
  const [categoryPhotos, setCategoryPhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadCategoryPhotography() {
      const categoryKeys = [
        'mens-fashion',
        'womens-fashion',
        'unisex',
        'tshirts',
        'hoodies',
        'bottom-wear',
        'custom-studio',
      ];

      const photoMap: Record<string, string> = {};
      await Promise.all(
        categoryKeys.map(async (key) => {
          const res = await fetchFashionImages(key, 1);
          if (res.photos && res.photos[0]?.url) {
            photoMap[key] = res.photos[0].url;
          }
        })
      );
      setCategoryPhotos(photoMap);
    }

    loadCategoryPhotography();
  }, []);

  const publishedProducts = products.filter((p) => p.status === 'published');
  const newArrivals = publishedProducts.slice(0, 8);

  const categoryCards = [
    {
      id: 'mens',
      title: "Men's Fashion",
      desc: 'Structured jackets, tailored shirts, and daily essentials.',
      link: '/shop?gender=Men',
      imageKey: 'mens-fashion',
      fallbackImg: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: 'womens',
      title: "Women's Fashion",
      desc: 'Contemporary coats, refined tops, and modern co-ords.',
      link: '/shop?gender=Women',
      imageKey: 'womens-fashion',
      fallbackImg: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: 'unisex',
      title: 'Unisex Streetwear',
      desc: 'Heavyweight oversized tees, relaxed cuts, and clean basics.',
      link: '/shop?gender=Unisex',
      imageKey: 'unisex',
      fallbackImg: 'https://images.pexels.com/photos/1018911/pexels-photo-1018911.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: 'footwear',
      title: 'Footwear',
      desc: 'Minimalist court sneakers, suede runners, and daily loafers.',
      link: '/shop?category=cat-9',
      imageKey: 'footwear-local',
      fallbackImg: FOOTWEAR_STUDIO_IMG,
    },
    {
      id: 'accessories',
      title: 'Accessories',
      desc: 'Structured leather totes, brushed steel watches, and twill caps.',
      link: '/shop?category=cat-10',
      imageKey: 'accessories-local',
      fallbackImg: ACCESSORIES_STUDIO_IMG,
    },
    {
      id: 'tshirts',
      title: 'T-Shirts & Tops',
      desc: '240 GSM combed cotton tees and breathable basewear.',
      link: '/shop?category=cat-4',
      imageKey: 'tshirts',
      fallbackImg: 'https://images.pexels.com/photos/1656684/pexels-photo-1656684.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: 'hoodies',
      title: 'Hoodies & Sweatshirts',
      desc: '380 GSM brushed fleece pullovers and structured layers.',
      link: '/shop?category=cat-5',
      imageKey: 'hoodies',
      fallbackImg: 'https://images.pexels.com/photos/1183266/pexels-photo-1183266.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
    {
      id: 'custom',
      title: 'Custom T-Shirt Studio',
      desc: 'Personalize graphics, typography, and garment colors live.',
      link: '/custom-studio',
      imageKey: 'custom-studio',
      fallbackImg: 'https://images.pexels.com/photos/2294342/pexels-photo-2294342.jpeg?auto=compress&cs=tinysrgb&w=800',
    },
  ];

  const hasCustomHeadline =
    Boolean(storeSettings.hero_headline) &&
    storeSettings.hero_headline.trim().toUpperCase() !== 'FIND YOUR FIT. DEFINE YOUR FORM.';

  return (
    <div className="space-y-16 sm:space-y-20 pb-20 font-sans text-[#18181B]">
      {/* Section 1: Sunlit Warm-Sand Editorial Campaign Hero (Matches Reference Design) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#FBF2E6] via-[#F2E2CE] to-[#E6D3BC] border-b border-[#E3D6C5]">
        {/* Subtle Architectural Window Light Beams */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-12 w-72 h-[140%] rotate-[-28deg] bg-white/25 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-16 left-[28%] w-56 h-[130%] rotate-[-28deg] bg-white/20 blur-xl"
        />

        {/* Desktop Right-Side Editorial Studio Photography (Cleanly Framed from Reference Asset) */}
        <div className="hidden lg:flex absolute right-0 top-0 bottom-0 w-[56%] xl:w-[55%] max-w-[1040px] items-end justify-end pointer-events-none select-none">
          <div className="relative w-full aspect-[1050/664] overflow-hidden">
            {storeSettings.hero_image_url ? (
              <img
                src={storeSettings.hero_image_url}
                alt="Form & Fit Editorial Campaign"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <img
                src={EDITORIAL_HERO_ASSET}
                alt="Form & Fit 2026 Editorial Studio Campaign"
                className="absolute max-w-none w-[184.57%] h-[122.29%] -left-[84.57%] -top-[22.29%]"
              />
            )}
            {/* Smooth Warm-Sand Cyclorama Blend */}
            <div className="absolute inset-y-0 left-0 w-28 xl:w-36 bg-gradient-to-r from-[#F3E3CF] via-[#F3E3CF]/70 to-transparent z-10" />
            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#F1E1CD]/75 to-transparent z-10" />
          </div>
        </div>

        {/* Foreground Content Container */}
        <div className="relative z-20 max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 xl:py-24 min-h-[500px] xl:min-h-[560px] flex items-center">
          <div className="w-full lg:max-w-[54%] space-y-6">
            {/* Campaign Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#B8F130] text-[#111111] font-space font-extrabold text-[11px] uppercase tracking-wider shadow-2xs">
              <Zap size={13} className="shrink-0" />
              <span>2026 EDITORIAL CAMPAIGN</span>
            </div>

            {/* Bold Two-Line Editorial Headline */}
            {hasCustomHeadline ? (
              <h1 className="font-space font-extrabold text-4xl sm:text-5xl xl:text-[4rem] tracking-tight leading-[1.04] uppercase text-[#0F0F10] [text-wrap:balance]">
                {storeSettings.hero_headline}
              </h1>
            ) : (
              <h1 className="font-space font-extrabold text-4xl sm:text-5xl xl:text-[4.1rem] tracking-tight leading-[1.04] uppercase text-[#0F0F10]">
                <span className="block whitespace-nowrap">
                  FIND YOUR <span className="text-[#9ED912]">FIT</span>.
                </span>
                <span className="block whitespace-nowrap">
                  DEFINE YOUR <span className="text-[#9ED912]">FORM</span>.
                </span>
              </h1>
            )}

            {/* Editorial Subtitle */}
            <p className="text-base sm:text-lg text-[#57534E] font-medium max-w-lg leading-relaxed font-sans">
              {storeSettings.hero_subtitle ||
                'Everyday essentials, statement pieces, and custom creations designed around your style.'}
            </p>

            {/* Mobile Studio Campaign Preview */}
            <div className="lg:hidden relative aspect-[1050/664] rounded-xl overflow-hidden border border-[#DFCBB3] bg-[#EFE0CC]">
              {storeSettings.hero_image_url ? (
                <img
                  src={storeSettings.hero_image_url}
                  alt="Form & Fit Editorial Campaign"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <img
                  src={EDITORIAL_HERO_ASSET}
                  alt="Form & Fit 2026 Editorial Studio Campaign"
                  className="absolute max-w-none w-[184.57%] h-[122.29%] -left-[84.57%] -top-[22.29%]"
                />
              )}
            </div>

            {/* Dual Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3.5 sm:gap-4">
              <Link
                to="/shop"
                className="px-7 py-4 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-md font-space font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors shadow-2xs whitespace-nowrap"
              >
                <span>SHOP THE COLLECTION</span>
                <ArrowRight size={15} strokeWidth={2.5} />
              </Link>

              <Link
                to="/custom-studio"
                className="px-7 py-4 bg-[#FAF2E8]/60 hover:bg-white/90 text-[#111111] border border-[#BEB2A2] hover:border-[#111111] rounded-md font-space font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors whitespace-nowrap"
              >
                <Shirt size={16} strokeWidth={2} />
                <span>CREATE CUSTOM T-SHIRT</span>
              </Link>
            </div>

            {/* Bottom Trust Metadata Strip */}
            <div className="pt-3 flex flex-wrap items-center gap-3 text-[11px] font-space font-bold uppercase tracking-wider">
              <span className="inline-flex items-center gap-1.5 text-[#65A30D]">
                <CheckCircle2 size={15} className="fill-[#B8F130] text-[#4D7C0F] shrink-0" />
                <span>100% INSPECTED FIT</span>
              </span>
              <span className="text-[#C4B8A8]" aria-hidden="true">|</span>
              <span className="text-[#6B6661]">240 GSM COTTON</span>
              <span className="text-[#C4B8A8]" aria-hidden="true">|</span>
              <span className="text-[#6B6661]">EXPRESS DISPATCH</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: New Arrivals & Featured Catalog */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E5E4DF] pb-4">
          <div>
            <span className="text-xs font-space font-bold uppercase tracking-wider text-[#65A30D]">
              Curated Wardrobe
            </span>
            <h2 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#111111] mt-0.5">
              New Arrivals &amp; Drops
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-xs font-space font-bold uppercase tracking-wider text-[#111111] hover:text-[#65A30D] flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            Shop Full Catalog <ChevronRight size={14} />
          </Link>
        </div>

        {publishedProducts.length === 0 ? (
          <EmptyCatalogState />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Light Editorial Category Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E5E4DF] pb-4">
          <div>
            <span className="text-xs font-space font-bold uppercase tracking-wider text-[#64748B]">
              Browse By Silhouette
            </span>
            <h2 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#111111] mt-0.5">
              Explore Collections
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-xs font-space font-bold uppercase tracking-wider text-[#111111] hover:text-[#65A30D] flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            View All Categories <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categoryCards.map((card) => {
            const bgImage = categoryPhotos[card.imageKey] || card.fallbackImg;

            return (
              <Link
                key={card.id}
                to={card.link}
                className="group bg-white border border-[#E5E4DF] hover:border-[#CBD5E1] rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-[0_8px_24px_rgba(24,24,27,0.06)] hover:-translate-y-0.5"
              >
                <div className="aspect-[4/5] bg-[#F3F2EE] overflow-hidden relative">
                  <img
                    src={bgImage}
                    alt={card.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = card.fallbackImg;
                    }}
                  />
                </div>

                <div className="p-4 bg-white flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-space font-semibold text-base text-[#111111] group-hover:text-[#65A30D] transition-colors">
                        {card.title}
                      </h3>
                      <ArrowRight
                        size={15}
                        className="text-[#94A3B8] group-hover:text-[#65A30D] group-hover:translate-x-0.5 transition-all shrink-0"
                      />
                    </div>
                    <p className="text-xs text-[#64748B] font-sans line-clamp-2 leading-relaxed mt-1">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Section 5: Light Warm-Sand Custom Studio Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#FAF1E4] via-[#F4E6D3] to-[#ECDBC4] border border-[#E2D2BC] rounded-2xl p-8 lg:p-12 text-[#111111] flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <span className="inline-block px-3 py-1 rounded bg-[#B8F130] text-[#111111] text-[11px] font-space font-extrabold uppercase tracking-wider">
              Interactive 2D Personalization
            </span>
            <h3 className="font-space font-extrabold text-2xl sm:text-3xl tracking-tight text-[#111111] [text-wrap:balance]">
              Design Your Own Custom Heavyweight Tee
            </h3>
            <p className="text-sm text-[#57534E] font-sans leading-relaxed">
              Upload your own graphic or artwork, set custom typography, preview front and back placement on 240 GSM combed cotton, and order with express dispatch.
            </p>
          </div>

          <Link
            to="/custom-studio"
            className="shrink-0 px-7 py-4 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider rounded-md transition-colors flex items-center gap-2 shadow-2xs whitespace-nowrap"
          >
            <Palette size={16} /> Launch Custom Studio <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
};
