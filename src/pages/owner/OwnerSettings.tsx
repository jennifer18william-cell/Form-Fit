import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { OwnerLayout } from '../../components/OwnerLayout';
import { isSupabaseConfigured } from '../../lib/supabase';
import { Save, Database } from 'lucide-react';

export const OwnerSettings: React.FC = () => {
  const { storeSettings, updateStoreSettings } = useStore();

  const [announcementText, setAnnouncementText] = useState(storeSettings.announcement_text || '');
  const [announcementEnabled, setAnnouncementEnabled] = useState(storeSettings.announcement_enabled);
  const [heroHeadline, setHeroHeadline] = useState(storeSettings.hero_headline || '');
  const [heroSubtitle, setHeroSubtitle] = useState(storeSettings.hero_subtitle || '');
  const [heroImageUrl, setHeroImageUrl] = useState(storeSettings.hero_image_url || '');
  const [contactEmail, setContactEmail] = useState(storeSettings.contact_email || '');
  const [contactPhone, setContactPhone] = useState(storeSettings.contact_phone || '');
  const [shippingFeeFlat, setShippingFeeFlat] = useState(storeSettings.shipping_fee_flat);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(storeSettings.free_shipping_threshold);
  const [codEnabled, setCodEnabled] = useState(storeSettings.cod_enabled);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateStoreSettings({
      announcement_text: announcementText.trim(),
      announcement_enabled: announcementEnabled,
      hero_headline: heroHeadline.trim(),
      hero_subtitle: heroSubtitle.trim(),
      hero_image_url: heroImageUrl.trim(),
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim(),
      shipping_fee_flat: Number(shippingFeeFlat),
      free_shipping_threshold: Number(freeShippingThreshold),
      cod_enabled: codEnabled,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const configured = isSupabaseConfigured();
  const inputClass =
    'w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2 text-xs text-[#18181B] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors';

  return (
    <OwnerLayout>
      <form onSubmit={handleSave} className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E4DF] pb-4">
          <div>
            <p className="text-xs font-medium text-[#64748B]">
              Store Customization
            </p>
            <h1 className="font-space font-bold text-2xl sm:text-3xl tracking-tight text-[#18181B]">
              Content &amp; Settings Editor
            </h1>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] rounded-lg font-space text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Save size={15} /> {savedSuccess ? 'Settings Saved' : 'Save Store Changes'}
          </button>
        </div>

        {/* Database Status Notice */}
        <div
          className={`p-4 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
            configured
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : 'bg-[#FAF9F6] border-[#E5E4DF] text-[#3F3F46]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Database size={16} className={configured ? 'text-[#16A34A]' : 'text-[#4D7C0F]'} />
            <span className="font-semibold">
              {configured ? 'Live Supabase Database Connected' : 'Local Browser Storage Mode Active'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#64748B]">
            {configured
              ? 'Host: Cloud PostgreSQL'
              : 'Configure VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY to sync with Cloud DB'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Homepage Hero & Banner Controls */}
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3">
              Store Header &amp; Hero Content
            </h2>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                  <input
                    type="checkbox"
                    checked={announcementEnabled}
                    onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                    className="accent-[#65A30D] w-4 h-4 rounded"
                  />
                  <span className="font-semibold text-[#18181B]">Enable Top Announcement Bar</span>
                </label>
                <input
                  type="text"
                  placeholder="Free Shipping on All Orders Over ₹1,999 across India"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[#E5E4DF]">
                <label className="block font-semibold text-[#18181B]">
                  Hero Section Headline
                </label>
                <input
                  type="text"
                  placeholder="Find your fit. Define your form."
                  value={heroHeadline}
                  onChange={(e) => setHeroHeadline(e.target.value)}
                  className={`${inputClass} font-space font-semibold`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">
                  Hero Subtitle Copy
                </label>
                <textarea
                  rows={2}
                  placeholder="Everyday essentials, statement pieces, and custom creations..."
                  value={heroSubtitle}
                  onChange={(e) => setHeroSubtitle(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">
                  Custom Hero Image URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  className={`${inputClass} font-mono`}
                />
                <p className="text-[11px] text-[#64748B]">
                  Leave blank to display the default sunlit atelier lookbook photography.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Shipping, Payment & Support */}
          <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4">
            <h2 className="font-space font-semibold text-sm text-[#18181B] border-b border-[#E5E4DF] pb-3">
              Shipping Rules &amp; Payment Settings
            </h2>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">
                    Flat Shipping Fee (₹ INR)
                  </label>
                  <input
                    type="number"
                    value={shippingFeeFlat}
                    onChange={(e) => setShippingFeeFlat(Number(e.target.value))}
                    className={`${inputClass} font-mono font-semibold tabular-nums`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-[#18181B]">
                    Free Shipping Threshold (₹)
                  </label>
                  <input
                    type="number"
                    value={freeShippingThreshold}
                    onChange={(e) => setFreeShippingThreshold(Number(e.target.value))}
                    className={`${inputClass} font-mono font-semibold tabular-nums`}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[#E5E4DF]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={codEnabled}
                    onChange={(e) => setCodEnabled(e.target.checked)}
                    className="accent-[#65A30D] w-4 h-4 rounded"
                  />
                  <span className="font-semibold text-[#18181B]">
                    Enable Cash on Delivery (COD) Option
                  </span>
                </label>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[#E5E4DF]">
                <label className="block font-semibold text-[#18181B]">
                  Official Support Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-[#18181B]">
                  Official Support Contact Phone
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </OwnerLayout>
  );
};
