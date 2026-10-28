import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Product, ProductVariant, CustomDesignData } from '../types';
import { Palette, Upload, Type, Trash2, ShoppingBag } from 'lucide-react';

interface DesignElement {
  id: string;
  type: 'text' | 'image';
  content: string;
  fontFamily?: string;
  color?: string;
  fontSize?: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const CustomStudio: React.FC = () => {
  const { addToCart } = useStore();
  const navigate = useNavigate();

  const [shirtColor, setShirtColor] = useState<string>('White');
  const [shirtColorHex, setShirtColorHex] = useState<string>('#FFFFFF');
  const [selectedSize, setSelectedSize] = useState<string>('L');
  const [viewSide, setViewSide] = useState<'front' | 'back'>('front');

  const [frontElements, setFrontElements] = useState<DesignElement[]>([]);
  const [backElements, setBackElements] = useState<DesignElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const [newText, setNewText] = useState('');
  const [selectedFont, setSelectedFont] = useState('Outfit');
  const [textColor, setTextColor] = useState('#18181B');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeElements = viewSide === 'front' ? frontElements : backElements;
  const setActiveElements = viewSide === 'front' ? setFrontElements : setBackElements;

  const colorOptions = [
    { name: 'White', hex: '#FFFFFF' },
    { name: 'Red', hex: '#DC2626' },
    { name: 'Black', hex: '#18181B' },
    { name: 'Blue', hex: '#2563EB' },
    { name: 'Pink', hex: '#F472B6' },
    { name: 'Green', hex: '#16A34A' },
  ];

  const isDarkGarment = ['Black', 'Blue', 'Red', 'Green'].includes(shirtColor);

  const fonts = ['Outfit', 'Plus Jakarta Sans', 'Georgia', 'Impact'];

  const handleAddText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    const newElem: DesignElement = {
      id: `elem_${Date.now()}`,
      type: 'text',
      content: newText.trim(),
      fontFamily: selectedFont,
      color: textColor,
      fontSize: 24,
      x: 50,
      y: 40,
      scale: 1,
      rotation: 0,
    };

    setActiveElements((prev) => [...prev, newElem]);
    setSelectedElementId(newElem.id);
    setNewText('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newElem: DesignElement = {
        id: `elem_${Date.now()}`,
        type: 'image',
        content: dataUrl,
        x: 50,
        y: 45,
        scale: 1,
        rotation: 0,
      };
      setActiveElements((prev) => [...prev, newElem]);
      setSelectedElementId(newElem.id);
    };
    reader.readAsDataURL(file);
  };

  const updateSelectedElement = (updates: Partial<DesignElement>) => {
    if (!selectedElementId) return;
    setActiveElements((prev) =>
      prev.map((el) => (el.id === selectedElementId ? { ...el, ...updates } : el))
    );
  };

  const removeSelectedElement = () => {
    if (!selectedElementId) return;
    setActiveElements((prev) => prev.filter((el) => el.id !== selectedElementId));
    setSelectedElementId(null);
  };

  const basePrice = 799;
  const printFee =
    (frontElements.length > 0 ? 200 : 0) + (backElements.length > 0 ? 200 : 0);
  const totalPrice = basePrice + printFee;

  const handleAddToCart = () => {
    const customDesign: CustomDesignData = {
      tshirt_color: shirtColor,
      tshirt_size: selectedSize,
      front_elements: frontElements,
      back_elements: backElements,
      total_price: totalPrice,
    };

    const dummyProduct: Product = {
      id: `custom_tee_${Date.now()}`,
      name: `Custom Designed T-Shirt (${shirtColor})`,
      slug: `custom-tshirt-${Date.now()}`,
      gender_collection: 'Custom Apparel',
      regular_price: totalPrice,
      status: 'published',
      featured: false,
      fabric_material: '100% Combed Heavyweight Cotton (240 GSM)',
      fit: 'Relaxed Oversized Fit',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const dummyVariant: ProductVariant = {
      id: `custom_var_${Date.now()}`,
      product_id: dummyProduct.id,
      sku: `CUST-${shirtColor.substring(0, 3).toUpperCase()}-${selectedSize}`,
      size: selectedSize,
      color: shirtColor,
      color_hex: shirtColorHex,
      price_override: totalPrice,
      stock_quantity: 99,
      is_active: true,
    };

    addToCart(dummyProduct, dummyVariant, 1, customDesign);
    navigate('/cart');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-[#18181B]">
      <div className="border-b border-[#E5E4DF] pb-6">
        <span className="text-xs font-space font-bold uppercase tracking-wider text-[#4D7C0F]">
          PatanaKart Personalization
        </span>
        <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
          Interactive Custom T-Shirt Studio
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] font-sans mt-1">
          Customize your 240 GSM combed cotton t-shirt with live print preview, custom typography, and graphic uploads.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Studio Controls */}
        <div className="lg:col-span-4 bg-white border border-[#E5E4DF] p-6 space-y-6 rounded-xl shadow-2xs">
          <h3 className="font-space font-bold text-sm flex items-center gap-2 border-b border-[#E5E4DF] pb-3 text-[#18181B]">
            <Palette size={16} className="text-[#4D7C0F]" /> Customize Apparel Specs
          </h3>

          {/* Color Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-space font-semibold text-[#18181B]">
              01. Base Garment Color:{' '}
              <span className="font-normal text-[#64748B]">{shirtColor}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setShirtColor(c.name);
                    setShirtColorHex(c.hex);
                  }}
                  className={`p-2 text-xs font-medium border flex items-center gap-2 cursor-pointer rounded-md transition-colors ${
                    shirtColor === c.name
                      ? 'border-[#65A30D] bg-[#F4FBE1] text-[#111111] font-semibold'
                      : 'border-[#E5E4DF] bg-[#FAF9F6] hover:border-[#BEB2A2] text-[#52525B]'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-[#CBD5E1] shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="space-y-2 pt-3 border-t border-[#E5E4DF]">
            <label className="block text-xs font-space font-semibold text-[#18181B]">
              02. Select Size:{' '}
              <span className="font-normal text-[#64748B]">{selectedSize}</span>
            </label>
            <div className="flex gap-2">
              {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`flex-1 py-2 text-xs font-mono font-semibold border cursor-pointer rounded-md transition-colors ${
                    selectedSize === sz
                      ? 'bg-[#B8F130] text-[#111111] border-[#9ED912] font-bold'
                      : 'bg-[#FAF9F6] border-[#D6D5CE] text-[#18181B] hover:border-[#65A30D]'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Add Text */}
          <div className="space-y-3 pt-3 border-t border-[#E5E4DF]">
            <label className="block text-xs font-space font-semibold text-[#18181B]">
              03. Add Custom Text
            </label>
            <form onSubmit={handleAddText} className="space-y-2.5">
              <input
                type="text"
                placeholder="Type artwork text..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                className="w-full p-2.5 text-xs rounded-md bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] focus:outline-none focus:border-[#65A30D] focus:bg-white transition-colors"
              />
              <div className="flex gap-2">
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="flex-1 bg-[#FAF9F6] border border-[#D6D5CE] p-2 text-xs text-[#18181B] rounded-md focus:outline-none focus:border-[#65A30D]"
                >
                  {fonts.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-10 h-9 border border-[#D6D5CE] cursor-pointer bg-white rounded-md p-0.5"
                  title="Pick text color"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#FAF9F6] border border-[#D6D5CE] text-[#18181B] font-space text-xs font-semibold hover:border-[#65A30D] hover:text-[#3F6212] transition-colors cursor-pointer flex items-center justify-center gap-1.5 rounded-md"
              >
                <Type size={14} /> Add Text to {viewSide === 'front' ? 'Front' : 'Back'}
              </button>
            </form>
          </div>

          {/* Upload Custom Graphic */}
          <div className="space-y-2 pt-3 border-t border-[#E5E4DF]">
            <label className="block text-xs font-space font-semibold text-[#18181B]">
              04. Upload Graphic or Logo
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-[#FAF9F6] text-[#18181B] border border-[#D6D5CE] font-space text-xs font-semibold hover:border-[#65A30D] hover:text-[#3F6212] transition-colors flex items-center justify-center gap-2 cursor-pointer rounded-md"
            >
              <Upload size={14} /> Upload PNG / JPG Image
            </button>
          </div>

          {/* Controls for Selected Element */}
          {selectedElementId && (
            <div className="p-3.5 bg-[#FAF9F6] border border-[#BEF264] space-y-2.5 text-xs rounded-lg">
              <div className="flex justify-between items-center font-space font-semibold text-[#3F6212]">
                <span>Selected Element Controls</span>
                <button
                  type="button"
                  onClick={removeSelectedElement}
                  className="text-red-600 hover:underline cursor-pointer"
                  aria-label="Delete element"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[#52525B]">Scale Size</span>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={activeElements.find((e) => e.id === selectedElementId)?.scale || 1}
                  onChange={(e) => updateSelectedElement({ scale: Number(e.target.value) })}
                  className="w-full accent-[#65A30D]"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[#52525B]">Rotation</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="15"
                  value={activeElements.find((e) => e.id === selectedElementId)?.rotation || 0}
                  onChange={(e) => updateSelectedElement({ rotation: Number(e.target.value) })}
                  className="w-full accent-[#65A30D]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Center Light Studio Canvas */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 border border-[#E5E4DF] rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-space font-semibold text-[#52525B]">Garment Side:</span>
              <div className="flex items-center gap-1 p-1 bg-[#F3F2EE] rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewSide('front')}
                  className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                    viewSide === 'front'
                      ? 'bg-white text-[#18181B] shadow-2xs font-semibold'
                      : 'text-[#64748B] hover:text-[#18181B]'
                  }`}
                >
                  Front View
                </button>
                <button
                  type="button"
                  onClick={() => setViewSide('back')}
                  className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                    viewSide === 'back'
                      ? 'bg-white text-[#18181B] shadow-2xs font-semibold'
                      : 'text-[#64748B] hover:text-[#18181B]'
                  }`}
                >
                  Back View
                </button>
              </div>
            </div>

            <span className="text-xs font-mono font-medium text-[#64748B]">
              {activeElements.length} layer(s) on {viewSide}
            </span>
          </div>

          {/* Sunlit Stone Studio Canvas */}
          <div className="relative aspect-[4/5] bg-[#EDEDEA] border border-[#E5E4DF] flex items-center justify-center p-8 overflow-hidden select-none rounded-xl">
            <div className="w-full h-full max-w-md relative flex items-center justify-center z-10">
              {/* T-Shirt Base Silhouette SVG */}
              <svg
                viewBox="0 0 400 480"
                className="w-full h-full drop-shadow-[0_12px_28px_rgba(24,24,27,0.12)]"
              >
                <path
                  d="M130,40 C160,70 240,70 270,40 L350,90 L310,170 L280,150 L280,440 L120,440 L120,150 L90,170 L50,90 Z"
                  fill={shirtColorHex}
                  stroke="#CBD5E1"
                  strokeWidth="2.5"
                />
                {/* Collar seam */}
                <path
                  d="M130,40 C170,80 230,80 270,40"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  opacity="0.6"
                />
                {/* Print Boundary Box */}
                <rect
                  x="125"
                  y="110"
                  width="150"
                  height="260"
                  fill="none"
                  stroke={isDarkGarment ? '#B8F130' : '#65A30D'}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity={isDarkGarment ? '0.75' : '0.55'}
                />
                <text
                  x="200"
                  y="386"
                  textAnchor="middle"
                  fontSize="9"
                  fill={isDarkGarment ? '#F4F4F5' : '#475569'}
                  opacity="0.85"
                  fontFamily="Outfit"
                >
                  PRINT AREA ({viewSide.toUpperCase()})
                </text>
              </svg>

              {/* Render Design Elements inside Printable Area */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="w-[150px] h-[260px] relative pointer-events-auto">
                  {activeElements.map((el) => {
                    const isSelected = el.id === selectedElementId;
                    return (
                      <div
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`absolute cursor-move transition-transform ${
                          isSelected ? 'outline-2 outline-dashed outline-[#65A30D]' : ''
                        }`}
                        style={{
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          transform: `translate(-50%, -50%) scale(${el.scale}) rotate(${el.rotation}deg)`,
                        }}
                      >
                        {el.type === 'text' ? (
                          <span
                            style={{
                              fontFamily: el.fontFamily,
                              color: el.color,
                              fontSize: `${el.fontSize}px`,
                              fontWeight: 'bold',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {el.content}
                          </span>
                        ) : (
                          <img
                            src={el.content}
                            alt="Custom Artwork"
                            className="max-w-[120px] max-h-[120px] object-contain pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Add to Cart Summary */}
          <div className="bg-white border border-[#E5E4DF] text-[#18181B] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl">
            <div className="tabular-nums">
              <div className="flex items-baseline gap-2">
                <span className="font-space font-bold text-2xl text-[#18181B]">
                  ₹{totalPrice.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-[#64748B]">
                  (Base ₹{basePrice} + Print ₹{printFee})
                </span>
              </div>
              <p className="text-xs text-[#64748B] font-sans mt-0.5">
                Heavyweight 240 GSM Combed Cotton · Printed &amp; Dispatched in 48 Hours
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full sm:w-auto px-7 py-3.5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer rounded-md transition-colors shadow-2xs whitespace-nowrap"
            >
              <ShoppingBag size={16} /> Add Custom Tee to Bag
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
