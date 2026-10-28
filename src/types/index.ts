export type UserRole = 'customer' | 'admin' | 'owner';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  role: UserRole;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  display_order: number;
  parent_id?: string;
}

export type ProductStatus = 'draft' | 'published' | 'archived';
export type GenderCollection = 'Men' | 'Women' | 'Unisex' | 'Footwear' | 'Accessories' | 'Custom Apparel';

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path?: string;
  url: string;
  is_main: boolean;
  alt_text?: string;
  display_order: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  size?: string;
  color?: string;
  color_hex?: string;
  price_override?: number;
  stock_quantity: number;
  variant_image_url?: string;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  short_desc?: string;
  description?: string;
  category_id?: string;
  gender_collection: GenderCollection;
  regular_price: number;
  sale_price?: number;
  cost_price?: number;
  fabric_material?: string;
  fit?: string;
  care_instructions?: string;
  status: ProductStatus;
  featured: boolean;
  seo_title?: string;
  seo_description?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  images?: ProductImage[];
  variants?: ProductVariant[];
  average_rating?: number;
  review_count?: number;
}

export interface CartItem {
  id: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
  custom_design_data?: CustomDesignData;
}

export interface WishlistItem {
  id: string;
  product_id: string;
  product: Product;
  created_at: string;
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'upi' | 'razorpay' | 'cod' | 'card' | 'netbanking';

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id?: string;
  product_name: string;
  sku?: string;
  size?: string;
  color?: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  image_url?: string;
  custom_design_data?: CustomDesignData;
}

export interface Order {
  id: string;
  order_number: string;
  user_id?: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: ShippingAddress;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  tracking_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  min_order_amount: number;
  is_active: boolean;
  usage_limit?: number;
  times_used: number;
  expires_at?: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id?: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  is_verified: boolean;
  created_at: string;
}

export interface StoreSettings {
  store_name: string;
  logo_url?: string;
  announcement_text?: string;
  announcement_enabled: boolean;
  hero_headline: string;
  hero_subtitle: string;
  hero_image_url?: string;
  contact_email: string;
  contact_phone: string;
  currency: string;
  currency_symbol: string;
  shipping_fee_flat: number;
  free_shipping_threshold: number;
  tax_percentage: number;
  low_stock_threshold: number;
  razorpay_enabled: boolean;
  razorpay_key_id?: string;
  cod_enabled: boolean;
}

export interface CustomDesignData {
  tshirt_color: string;
  tshirt_size: string;
  front_elements?: Array<{
    id: string;
    type: 'text' | 'image';
    content: string; // text string or image dataUrl
    fontFamily?: string;
    color?: string;
    fontSize?: number;
    x: number;
    y: number;
    scale: number;
    rotation: number;
  }>;
  back_elements?: Array<{
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
  }>;
  total_price: number;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  created_at: string;
}

export type NotificationEventType =
  | 'cart_added'
  | 'wishlist_added'
  | 'order_placed'
  | 'order_status_updated';

export type ChannelDeliveryStatus = 'sent' | 'logged' | 'skipped' | 'failed';

export interface CustomerNotificationPreferences {
  email_enabled: boolean;
  sms_enabled: boolean;
  notify_cart: boolean;
  notify_wishlist: boolean;
  notify_orders: boolean;
}

export interface CustomerNotification {
  id: string;
  user_id?: string;
  recipient_email: string;
  recipient_phone?: string;
  event_type: NotificationEventType;
  title: string;
  subject: string;
  email_body_text: string;
  sms_body: string;
  action_url?: string;
  metadata?: {
    product_name?: string;
    product_image?: string;
    price?: number;
    size?: string;
    color?: string;
    quantity?: number;
    order_number?: string;
    order_status?: string;
    tracking_number?: string;
    item_count?: number;
  };
  channels: {
    email: {
      status: ChannelDeliveryStatus;
      provider?: string;
      detail?: string;
    };
    sms: {
      status: ChannelDeliveryStatus;
      provider?: string;
      detail?: string;
    };
  };
  is_read: boolean;
  created_at: string;
}

