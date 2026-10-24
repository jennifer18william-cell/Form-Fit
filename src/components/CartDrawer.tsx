import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';
import { X, Trash2, ShoppingBag, ArrowRight, Plus, Minus, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFashionFallbackImage } from '../lib/imageOptimization';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { cart, updateCartQuantity, removeFromCart, storeSettings } = useStore();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const itemPrice = item.custom_design_data?.total_price
        ? item.custom_design_data.total_price
        : item.variant.price_override || item.product.sale_price || item.product.regular_price;
      return acc + itemPrice * item.quantity;
    }, 0);
  }, [cart]);

  const totalQuantity = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const freeShippingThreshold = storeSettings.free_shipping_threshold || 1999;
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end animate-fadeIn select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag Drawer"
    >
      {/* Light-friendly Subtle Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/25 transition-opacity duration-200 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-white border-l border-[#E5E4DF] flex flex-col h-full shadow-2xl z-10 animate-slideLeft text-[#18181B]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5E4DF] flex items-center justify-between bg-[#FAF9F6]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F4FBE1] border border-[#BEF264] text-[#3F6212] flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
            <div>
              <h2 className="font-space font-bold text-base tracking-tight text-[#18181B]">
                Shopping Bag
              </h2>
              <p className="text-xs text-[#64748B]">
                {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#18181B] hover:bg-[#F3F2EE] transition-colors rounded-md cursor-pointer touch-manipulation active:scale-95"
            aria-label="Close Shopping Bag"
          >
            <X size={20} />
          </button>
        </div>

        {/* Free Shipping Progress Indicator */}
        <div className="bg-[#FAF9F6] border-b border-[#E5E4DF] px-4 py-3 text-xs">
          {remainingForFreeShipping > 0 ? (
            <p className="mb-2 text-center text-xs text-[#52525B]">
              Add <span className="font-semibold text-[#4D7C0F] font-mono">₹{remainingForFreeShipping.toLocaleString('en-IN')}</span> more for <span className="text-[#18181B] font-semibold">Free Express Delivery</span>
            </p>
          ) : (
            <p className="mb-2 text-center text-[#15803D] font-semibold text-xs flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#16A34A]" /> Free Express Courier Shipping Unlocked
            </p>
          )}
          <div className="w-full bg-[#E5E4DF] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#84CC16] h-full transition-all duration-300 rounded-full"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#F3F2EE] border border-[#E5E4DF] flex items-center justify-center text-[#64748B]">
                <ShoppingBag size={26} />
              </div>
              <div className="space-y-1">
                <p className="font-space font-bold text-base text-[#18181B]">Your Bag is Empty</p>
                <p className="text-xs text-[#64748B] max-w-xs font-sans leading-relaxed">
                  Explore our 240 GSM combed cotton tees, tailored silhouettes, and custom prints.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-6 py-2.5 bg-[#B8F130] text-[#111111] font-space font-bold text-xs rounded-md hover:bg-[#AAE422] transition-colors cursor-pointer touch-manipulation active:scale-95"
              >
                Shop New Arrivals
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const itemPrice = item.custom_design_data?.total_price
                ? item.custom_design_data.total_price
                : item.variant.price_override || item.product.sale_price || item.product.regular_price;
              const fallbackImg = getFashionFallbackImage(item.product?.name, item.product?.category?.name);
              const imageSrc =
                item.variant?.variant_image_url ||
                item.product?.images?.find((i) => i.is_main)?.url ||
                item.product?.images?.[0]?.url ||
                fallbackImg;

              return (
                <div
                  key={item.id}
                  className="flex gap-3 sm:gap-4 p-3 bg-[#FAF9F6] border border-[#E5E4DF] hover:border-[#CBD5E1] transition-colors rounded-lg relative group"
                >
                  <div className="w-20 h-24 bg-[#F3F2EE] border border-[#E5E4DF] shrink-0 overflow-hidden relative rounded-md">
                    <img
                      src={imageSrc}
                      alt={item.product?.name || 'Product'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = fallbackImg;
                      }}
                    />
                    {item.custom_design_data && (
                      <span className="absolute top-1 left-1 bg-[#B8F130] text-[#111111] text-[9px] font-space font-bold px-1.5 py-0.5 rounded">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-space font-semibold text-sm text-[#18181B] line-clamp-1">
                          {item.product.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-[#94A3B8] hover:text-red-600 p-1 transition-colors cursor-pointer touch-manipulation shrink-0"
                          aria-label="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-1">
                        {item.variant.size && <span>Size {item.variant.size}</span>}
                        {item.variant.size && item.variant.color && <span aria-hidden="true">·</span>}
                        {item.variant.color && <span>{item.variant.color}</span>}
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-3">
                      {/* Quantity Controls */}
                      <div className="flex items-center border border-[#D6D5CE] bg-white rounded-md">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-xs text-[#52525B] hover:text-[#18181B] hover:bg-[#F3F2EE] cursor-pointer touch-manipulation rounded-l-md"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-semibold text-[#18181B] tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-xs text-[#52525B] hover:text-[#18181B] hover:bg-[#F3F2EE] cursor-pointer touch-manipulation rounded-r-md"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <span className="font-space font-bold text-sm text-[#18181B] tabular-nums">
                        ₹{(itemPrice * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Subtotal & Actions */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-[#E5E4DF] bg-[#FAF9F6] space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#52525B] font-medium text-xs">Estimated Subtotal</span>
              <span className="font-space font-bold text-lg text-[#18181B] tabular-nums">
                ₹{subtotal.toLocaleString('en-IN')}
              </span>
            </div>

            <p className="text-[11px] text-[#64748B] font-sans">
              Taxes calculated at checkout. Free shipping over ₹{freeShippingThreshold.toLocaleString('en-IN')}.
            </p>

            <div className="space-y-2 pt-1">
              <Link
                to="/checkout"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#B8F130] text-[#111111] font-space font-bold text-xs rounded-md hover:bg-[#AAE422] transition-colors cursor-pointer touch-manipulation"
              >
                Proceed to Checkout <ArrowRight size={16} />
              </Link>

              <Link
                to="/cart"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#D6D5CE] text-[#18181B] font-space font-semibold text-xs rounded-md hover:bg-[#F3F2EE] transition-colors cursor-pointer touch-manipulation"
              >
                View Full Bag
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
