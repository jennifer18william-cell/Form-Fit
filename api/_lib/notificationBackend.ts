import { createClient, SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  applyNoStoreHeaders,
  getSupabaseEnvConfig,
  SupabaseEnvConfig,
  verifyAdminRequest,
} from './catalogBackend';
import {
  ChannelDeliveryStatus,
  CustomerNotification,
  CustomerNotificationPreferences,
  NotificationEventType,
} from '../../src/types';

const PRIVATE_NOTIFICATION_BUCKET = 'customer-notifications';
const MAX_STORED_NOTIFICATIONS = 60;

export const DEFAULT_NOTIFICATION_PREFERENCES: CustomerNotificationPreferences = {
  email_enabled: true,
  sms_enabled: true,
  notify_cart: true,
  notify_wishlist: true,
  notify_orders: true,
};

interface CustomerInboxRecord {
  email: string;
  phone?: string;
  preferences: CustomerNotificationPreferences;
  notifications: CustomerNotification[];
  updated_at: string;
}

function cleanVal(val?: string | null): string {
  if (!val) return '';
  return String(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

function isRealSecret(val?: string | null): boolean {
  const cleaned = cleanVal(val);
  if (!cleaned) return false;
  if (cleaned.startsWith('YOUR_') || cleaned.includes('placeholder')) return false;
  return true;
}

function getHeader(req: any, name: string): string {
  const lower = name.toLowerCase();
  const val = req.headers?.[lower] ?? req.headers?.[name];
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}

async function parseJsonBody(req: any): Promise<any> {
  if (!req) return {};
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    return req.body && typeof req.body === 'object' ? req.body : {};
  }
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return req.body.trim() ? JSON.parse(req.body.trim()) : {};
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (typeof req.on === 'function') {
    try {
      const raw = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', () => resolve(''));
      });
      if (raw.trim()) return JSON.parse(raw.trim());
    } catch {
      return {};
    }
  }
  return {};
}

function createAnonClient(cfg: SupabaseEnvConfig, bearerToken?: string): SupabaseClient {
  return createClient(cfg.url, cfg.anonKey || cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: bearerToken
      ? { headers: { Authorization: `Bearer ${bearerToken}` } }
      : undefined,
  });
}

function createServiceClient(cfg: SupabaseEnvConfig): SupabaseClient {
  return createClient(cfg.url, cfg.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ============================================================================
// Gateway Configuration Inspection (No secrets ever exposed to client)
// ============================================================================

export interface NotificationGatewayStatus {
  emailConfigured: boolean;
  emailProvider: 'smtp' | 'resend' | 'inbox-only';
  smsConfigured: boolean;
  smsProvider: 'twilio' | 'fast2sms' | 'inbox-only';
}

export function getGatewayStatus(): NotificationGatewayStatus {
  const hasSmtp =
    isRealSecret(process.env.SMTP_HOST) &&
    isRealSecret(process.env.SMTP_USER) &&
    isRealSecret(process.env.SMTP_PASS);
  const hasResend = isRealSecret(process.env.RESEND_API_KEY);

  const hasTwilio =
    isRealSecret(process.env.TWILIO_ACCOUNT_SID) &&
    isRealSecret(process.env.TWILIO_AUTH_TOKEN) &&
    isRealSecret(process.env.TWILIO_FROM_NUMBER);
  const hasFast2Sms = isRealSecret(process.env.FAST2SMS_API_KEY);

  return {
    emailConfigured: hasSmtp || hasResend,
    emailProvider: hasSmtp ? 'smtp' : hasResend ? 'resend' : 'inbox-only',
    smsConfigured: hasTwilio || hasFast2Sms,
    smsProvider: hasTwilio ? 'twilio' : hasFast2Sms ? 'fast2sms' : 'inbox-only',
  };
}

// ============================================================================
// Private Customer Inbox Persistence (Supabase Private Bucket + Local Fallback)
// ============================================================================

let bucketVerified = false;

async function ensurePrivateNotificationBucket(svc: SupabaseClient): Promise<void> {
  if (bucketVerified) return;
  try {
    const { data: buckets } = await svc.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === PRIVATE_NOTIFICATION_BUCKET);
    if (!exists) {
      await svc.storage.createBucket(PRIVATE_NOTIFICATION_BUCKET, {
        public: false,
        fileSizeLimit: 2 * 1024 * 1024,
      });
    }
    bucketVerified = true;
  } catch {
    // Fall back gracefully if bucket listing fails
  }
}

function emailToStorageKey(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  return `inboxes/${hash}.json`;
}

function getLocalNotificationsFilePath(): string {
  const isVercel = Boolean(process.env.VERCEL);
  const baseDir = isVercel ? '/tmp' : path.join(process.cwd(), '.data');
  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
  } catch {
    // ignore
  }
  return path.join(baseDir, 'patanakart_notifications.json');
}

function readLocalInboxMap(): Record<string, CustomerInboxRecord> {
  try {
    const fp = getLocalNotificationsFilePath();
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, 'utf8')) || {};
    }
  } catch {
    // ignore
  }
  return {};
}

function writeLocalInboxMap(map: Record<string, CustomerInboxRecord>): void {
  try {
    const fp = getLocalNotificationsFilePath();
    fs.writeFileSync(fp, JSON.stringify(map, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

async function readCustomerInbox(
  cfg: SupabaseEnvConfig,
  email: string
): Promise<CustomerInboxRecord> {
  const cleanEmail = email.trim().toLowerCase();
  const emptyRecord: CustomerInboxRecord = {
    email: cleanEmail,
    preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    notifications: [],
    updated_at: new Date().toISOString(),
  };

  if (cfg.isConfigured && cfg.hasServiceRole) {
    try {
      const svc = createServiceClient(cfg);
      await ensurePrivateNotificationBucket(svc);
      const objectKey = emailToStorageKey(cleanEmail);
      const { data, error } = await svc.storage
        .from(PRIVATE_NOTIFICATION_BUCKET)
        .download(objectKey);

      if (!error && data) {
        const rawText = await data.text();
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === 'object') {
          return {
            email: cleanEmail,
            phone: parsed.phone,
            preferences: {
              ...DEFAULT_NOTIFICATION_PREFERENCES,
              ...(parsed.preferences || {}),
            },
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
            updated_at: parsed.updated_at || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fall through to local file fallback
    }
  }

  const localMap = readLocalInboxMap();
  return localMap[cleanEmail] || emptyRecord;
}

async function writeCustomerInbox(
  cfg: SupabaseEnvConfig,
  email: string,
  record: CustomerInboxRecord
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const trimmed: CustomerInboxRecord = {
    ...record,
    email: cleanEmail,
    notifications: (record.notifications || []).slice(0, MAX_STORED_NOTIFICATIONS),
    updated_at: new Date().toISOString(),
  };

  // Always keep local cache synced in dev/single-node runtime
  const localMap = readLocalInboxMap();
  localMap[cleanEmail] = trimmed;
  writeLocalInboxMap(localMap);

  if (cfg.isConfigured && cfg.hasServiceRole) {
    try {
      const svc = createServiceClient(cfg);
      await ensurePrivateNotificationBucket(svc);
      const objectKey = emailToStorageKey(cleanEmail);
      const payloadBuffer = Buffer.from(JSON.stringify(trimmed), 'utf8');
      await svc.storage.from(PRIVATE_NOTIFICATION_BUCKET).upload(objectKey, payloadBuffer, {
        contentType: 'application/json',
        upsert: true,
      });
    } catch (err) {
      console.warn('Supabase notification storage sync notice:', err);
    }
  }
}

// ============================================================================
// Phone Normalization & Real Email / SMS Provider Dispatchers
// ============================================================================

function normalizePhoneNumbers(rawPhone?: string | null): {
  display: string;
  e164: string;
  indian10Digit: string;
} {
  const cleaned = cleanVal(rawPhone);
  if (!cleaned) return { display: '', e164: '', indian10Digit: '' };

  const digitsOnly = cleaned.replace(/\D/g, '');
  if (!digitsOnly || digitsOnly.length < 10) {
    return { display: cleaned, e164: '', indian10Digit: '' };
  }

  if (digitsOnly.length === 10) {
    return {
      display: `+91 ${digitsOnly.slice(0, 5)} ${digitsOnly.slice(5)}`,
      e164: `+91${digitsOnly}`,
      indian10Digit: digitsOnly,
    };
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const ten = digitsOnly.slice(2);
    return {
      display: `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`,
      e164: `+${digitsOnly}`,
      indian10Digit: ten,
    };
  }

  const e164 = cleaned.startsWith('+') ? `+${digitsOnly}` : `+${digitsOnly}`;
  return {
    display: e164,
    e164,
    indian10Digit: digitsOnly.length === 10 ? digitsOnly : '',
  };
}

function buildBrandedHtmlEmail(params: {
  customerName: string;
  headline: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const safeParagraphs = params.bodyLines
    .map(
      (line) =>
        `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#27272A;">${line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</p>`
    )
    .join('');

  const ctaHtml =
    params.ctaLabel && params.ctaUrl
      ? `<div style="margin:24px 0 8px 0;">
           <a href="${params.ctaUrl}" style="display:inline-block;padding:12px 24px;background-color:#B8F130;color:#111111;text-decoration:none;font-weight:700;font-size:13px;border-radius:8px;">
             ${params.ctaLabel}
           </a>
         </div>`
      : '';

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background-color:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background-color:#FFFFFF;border:1px solid #E5E4DF;border-radius:16px;padding:32px;">
      <div style="border-bottom:1px solid #E5E4DF;padding-bottom:16px;margin-bottom:24px;">
        <span style="font-size:20px;font-weight:800;color:#111111;letter-spacing:-0.02em;">Patana<span style="color:#65A30D;">Kart</span></span>
        <span style="display:block;font-size:11px;color:#71717A;margin-top:2px;">Fashion For Every You</span>
      </div>
      <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#18181B;">${params.headline}</h1>
      <p style="margin:0 0 14px 0;font-size:14px;color:#18181B;font-weight:600;">Hi ${params.customerName},</p>
      ${safeParagraphs}
      ${ctaHtml}
      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #E5E4DF;font-size:11px;color:#71717A;">
        You received this transactional alert for your registered PatanaKart account.
      </div>
    </div>
  </body>
</html>`;
}

async function dispatchRealEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ status: ChannelDeliveryStatus; provider: string; detail: string }> {
  const smtpHost = cleanVal(process.env.SMTP_HOST);
  const smtpPort = Number(cleanVal(process.env.SMTP_PORT) || '465');
  const smtpUser = cleanVal(process.env.SMTP_USER);
  const smtpPass = cleanVal(process.env.SMTP_PASS);
  const fromAddress =
    cleanVal(process.env.SMTP_FROM) ||
    cleanVal(process.env.NOTIFICATION_FROM_EMAIL) ||
    (isRealSecret(smtpUser) ? `PatanaKart <${smtpUser}>` : 'PatanaKart <onboarding@resend.dev>');

  // 1. SMTP (Gmail App Password, Brevo, SendGrid SMTP, Zoho, SES)
  if (isRealSecret(smtpHost) && isRealSecret(smtpUser) && isRealSecret(smtpPass)) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      return {
        status: 'sent',
        provider: 'smtp',
        detail: `Delivered to ${params.to} (${info.messageId || 'SMTP OK'})`,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        provider: 'smtp',
        detail: err?.message || 'SMTP transmission failed',
      };
    }
  }

  // 2. Resend HTTP API
  const resendKey = cleanVal(process.env.RESEND_API_KEY);
  if (isRealSecret(resendKey)) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [params.to],
          subject: params.subject,
          text: params.text,
          html: params.html,
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          status: 'sent',
          provider: 'resend',
          detail: `Delivered to ${params.to} (${json?.id || 'Resend OK'})`,
        };
      }
      return {
        status: 'failed',
        provider: 'resend',
        detail: json?.message || `Resend returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        provider: 'resend',
        detail: err?.message || 'Resend request failed',
      };
    }
  }

  // 3. Persistent PatanaKart Inbox Fallback when SMTP / Resend env vars are not yet set
  return {
    status: 'logged',
    provider: 'patanakart-inbox',
    detail: `Queued in PatanaKart Inbox for ${params.to}`,
  };
}

async function dispatchRealSms(params: {
  rawPhone?: string;
  body: string;
}): Promise<{ status: ChannelDeliveryStatus; provider: string; detail: string }> {
  const normalized = normalizePhoneNumbers(params.rawPhone);
  if (!normalized.e164) {
    return {
      status: 'skipped',
      provider: 'none',
      detail: 'No valid mobile number saved on profile yet',
    };
  }

  // 1. Twilio SMS API
  const twilioSid = cleanVal(process.env.TWILIO_ACCOUNT_SID);
  const twilioToken = cleanVal(process.env.TWILIO_AUTH_TOKEN);
  const twilioFrom = cleanVal(process.env.TWILIO_FROM_NUMBER);

  if (isRealSecret(twilioSid) && isRealSecret(twilioToken) && isRealSecret(twilioFrom)) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const form = new URLSearchParams();
      form.set('To', normalized.e164);
      form.set('From', twilioFrom);
      form.set('Body', params.body);

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        }
      );
      const json: any = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          status: 'sent',
          provider: 'twilio',
          detail: `SMS delivered to ${normalized.display} (${json?.sid || 'Twilio OK'})`,
        };
      }
      return {
        status: 'failed',
        provider: 'twilio',
        detail: json?.message || `Twilio returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        provider: 'twilio',
        detail: err?.message || 'Twilio SMS request failed',
      };
    }
  }

  // 2. Fast2SMS API (India 10-digit mobile numbers)
  const fast2SmsKey = cleanVal(process.env.FAST2SMS_API_KEY);
  if (isRealSecret(fast2SmsKey) && normalized.indian10Digit) {
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: fast2SmsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: params.body,
          language: 'english',
          flash: 0,
          numbers: normalized.indian10Digit,
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (res.ok && json?.return) {
        return {
          status: 'sent',
          provider: 'fast2sms',
          detail: `SMS delivered to ${normalized.display}`,
        };
      }
      return {
        status: 'failed',
        provider: 'fast2sms',
        detail: json?.message || `Fast2SMS returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        provider: 'fast2sms',
        detail: err?.message || 'Fast2SMS request failed',
      };
    }
  }

  // 3. Persistent PatanaKart Inbox Fallback when SMS gateway env vars are not yet set
  return {
    status: 'logged',
    provider: 'patanakart-inbox',
    detail: `Alert logged for ${normalized.display}`,
  };
}

// ============================================================================
// Notification Message Composer
// ============================================================================

function composeNotificationContent(params: {
  eventType: NotificationEventType;
  customerName: string;
  originUrl: string;
  payload: any;
}): {
  title: string;
  subject: string;
  bodyLines: string[];
  smsBody: string;
  actionUrl: string;
  ctaLabel: string;
  metadata: CustomerNotification['metadata'];
} {
  const { eventType, originUrl, payload } = params;

  if (eventType === 'cart_added') {
    const productName = String(payload?.productName || 'Apparel Item');
    const size = payload?.size ? String(payload.size) : '';
    const color = payload?.color ? String(payload.color) : '';
    const quantity = Math.max(1, Number(payload?.quantity) || 1);
    const price = Number(payload?.price) || 0;
    const formattedPrice = `₹${price.toLocaleString('en-IN')}`;
    const variantSpec = [size ? `Size ${size}` : '', color].filter(Boolean).join(' · ');

    return {
      title: `Added to Shopping Bag: ${productName}`,
      subject: `${productName} is waiting in your PatanaKart Bag`,
      bodyLines: [
        `You just added "${productName}"${variantSpec ? ` (${variantSpec})` : ''} — Qty: ${quantity} at ${formattedPrice} to your PatanaKart shopping bag.`,
        `Items in your bag remain easy to review whenever you are ready to complete express checkout.`,
      ],
      smsBody: `PatanaKart: "${productName}"${variantSpec ? ` (${variantSpec})` : ''} at Rs.${price.toLocaleString('en-IN')} was added to your shopping bag.`,
      actionUrl: '/cart',
      ctaLabel: 'View Shopping Bag',
      metadata: {
        product_name: productName,
        product_image: payload?.productImage,
        price,
        size,
        color,
        quantity,
      },
    };
  }

  if (eventType === 'wishlist_added') {
    const productName = String(payload?.productName || 'Saved Style');
    const price = Number(payload?.price) || 0;
    const formattedPrice = `₹${price.toLocaleString('en-IN')}`;

    return {
      title: `Saved to Wishlist: ${productName}`,
      subject: `Saved to your PatanaKart Wishlist: ${productName}`,
      bodyLines: [
        `"${productName}" (${formattedPrice}) has been saved to your personal PatanaKart Wishlist.`,
        `Visit your wishlist anytime to check available sizes and move this piece directly to your shopping bag.`,
      ],
      smsBody: `PatanaKart: "${productName}" (Rs.${price.toLocaleString('en-IN')}) has been saved to your Wishlist.`,
      actionUrl: '/wishlist',
      ctaLabel: 'Open My Wishlist',
      metadata: {
        product_name: productName,
        product_image: payload?.productImage,
        price,
      },
    };
  }

  if (eventType === 'order_placed') {
    const orderNumber = String(payload?.orderNumber || 'PK-ORDER');
    const totalAmount = Number(payload?.totalAmount) || 0;
    const paymentMethod = String(payload?.paymentMethod || 'online').toUpperCase();
    const itemCount = Math.max(1, Number(payload?.itemCount) || 1);
    const itemsSummary = Array.isArray(payload?.items)
      ? payload.items
          .slice(0, 4)
          .map(
            (it: any) =>
              `${it.product_name}${it.size ? ` (${it.size})` : ''} x${it.quantity} — ₹${Number(
                it.total_price || 0
              ).toLocaleString('en-IN')}`
          )
          .join('; ')
      : `${itemCount} item(s)`;
    const city = payload?.city ? String(payload.city) : 'your delivery address';

    return {
      title: `Order Confirmed: #${orderNumber}`,
      subject: `PatanaKart Order Confirmed #${orderNumber} (₹${totalAmount.toLocaleString('en-IN')})`,
      bodyLines: [
        `Thank you for your order! Your PatanaKart order #${orderNumber} for ₹${totalAmount.toLocaleString('en-IN')} (${paymentMethod}) has been confirmed.`,
        `Items Ordered: ${itemsSummary}.`,
        `Shipping Destination: ${city}. Orders are dispatched within 24–48 business hours across India.`,
      ],
      smsBody: `PatanaKart: Order #${orderNumber} for Rs.${totalAmount.toLocaleString('en-IN')} (${paymentMethod}) is confirmed! Track live at ${originUrl}/account/orders/${orderNumber}`,
      actionUrl: `/account/orders/${orderNumber}`,
      ctaLabel: 'Track Your Order',
      metadata: {
        order_number: orderNumber,
        price: totalAmount,
        item_count: itemCount,
        order_status: 'pending',
      },
    };
  }

  // order_status_updated
  const orderNumber = String(payload?.orderNumber || 'PK-ORDER');
  const orderStatus = String(payload?.status || 'processing');
  const statusLabel = orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1);
  const trackingNumber = payload?.trackingNumber ? String(payload.trackingNumber) : '';

  return {
    title: `Order #${orderNumber} is now ${statusLabel}`,
    subject: `PatanaKart Order #${orderNumber} Update: ${statusLabel}`,
    bodyLines: [
      `Your PatanaKart order #${orderNumber} status has been updated to: ${statusLabel}.`,
      ...(trackingNumber ? [`Courier Tracking ID: ${trackingNumber}.`] : []),
      `You can view real-time delivery progress anytime from your PatanaKart account.`,
    ],
    smsBody: `PatanaKart Update: Order #${orderNumber} is now ${statusLabel}${
      trackingNumber ? ` (Tracking: ${trackingNumber})` : ''
    }.`,
    actionUrl: `/account/orders/${orderNumber}`,
    ctaLabel: 'View Order Status',
    metadata: {
      order_number: orderNumber,
      order_status: orderStatus,
      tracking_number: trackingNumber || undefined,
    },
  };
}

// ============================================================================
// Main HTTP Handler (`/api/notifications`)
// ============================================================================

export async function handleNotificationsApi(req: any, res: any) {
  applyNoStoreHeaders(res);
  const method = (req.method || 'GET').toUpperCase();
  const cfg = getSupabaseEnvConfig();
  const gatewayStatus = getGatewayStatus();

  const authHeader = getHeader(req, 'authorization');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  // Resolve authenticated user from Supabase JWT if present
  let authedUser: { id: string; email: string; full_name?: string; phone?: string } | null = null;

  if (bearerToken && cfg.isConfigured) {
    try {
      const userClient = createAnonClient(cfg, bearerToken);
      const { data: userData } = await userClient.auth.getUser(bearerToken);
      if (userData?.user?.email) {
        const u = userData.user;
        const db = cfg.hasServiceRole ? createServiceClient(cfg) : userClient;
        const { data: prof } = await db
          .from('profiles')
          .select('id, email, full_name, phone')
          .eq('id', u.id)
          .maybeSingle();

        authedUser = {
          id: u.id,
          email: (prof?.email || u.email || '').toLowerCase(),
          full_name: prof?.full_name || u.user_metadata?.full_name,
          phone: prof?.phone || u.user_metadata?.phone,
        };
      }
    } catch {
      // Fall through
    }
  }

  const adminCheck = await verifyAdminRequest(req, cfg);
  const body = await parseJsonBody(req);

  // Fallback for local/owner session if Supabase JWT wasn't minted
  if (!authedUser && adminCheck.authorized) {
    const hdrEmail = cleanVal(getHeader(req, 'x-formfit-admin-email')).toLowerCase();
    authedUser = {
      id: 'owner_primary_account',
      email: hdrEmail || 'admin@patanakart.in',
      full_name: 'Store Owner Admin',
    };
  }

  if (method === 'GET') {
    if (!authedUser?.email) {
      return res.status(401).json({
        success: false,
        error: 'Sign in required to view notifications.',
      });
    }

    const inbox = await readCustomerInbox(cfg, authedUser.email);
    return res.status(200).json({
      success: true,
      notifications: inbox.notifications,
      preferences: inbox.preferences,
      registeredEmail: authedUser.email,
      registeredPhone: authedUser.phone || inbox.phone || '',
      gatewayStatus,
    });
  }

  if (method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const action = String(body?.action || 'dispatch').trim();

  // 1. Mark notifications as read
  if (action === 'mark-read') {
    if (!authedUser?.email) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const notificationId = cleanVal(body?.notificationId);
    const inbox = await readCustomerInbox(cfg, authedUser.email);
    inbox.notifications = inbox.notifications.map((n) =>
      !notificationId || n.id === notificationId ? { ...n, is_read: true } : n
    );
    await writeCustomerInbox(cfg, authedUser.email, inbox);
    return res.status(200).json({
      success: true,
      notifications: inbox.notifications,
    });
  }

  // 2. Update customer notification preferences
  if (action === 'update-preferences') {
    if (!authedUser?.email) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const inbox = await readCustomerInbox(cfg, authedUser.email);
    const incoming = body?.preferences || {};
    inbox.preferences = {
      email_enabled:
        typeof incoming.email_enabled === 'boolean'
          ? incoming.email_enabled
          : inbox.preferences.email_enabled,
      sms_enabled:
        typeof incoming.sms_enabled === 'boolean'
          ? incoming.sms_enabled
          : inbox.preferences.sms_enabled,
      notify_cart:
        typeof incoming.notify_cart === 'boolean'
          ? incoming.notify_cart
          : inbox.preferences.notify_cart,
      notify_wishlist:
        typeof incoming.notify_wishlist === 'boolean'
          ? incoming.notify_wishlist
          : inbox.preferences.notify_wishlist,
      notify_orders:
        typeof incoming.notify_orders === 'boolean'
          ? incoming.notify_orders
          : inbox.preferences.notify_orders,
    };
    await writeCustomerInbox(cfg, authedUser.email, inbox);
    return res.status(200).json({
      success: true,
      preferences: inbox.preferences,
    });
  }

  // 3. Dispatch a real notification (`cart_added`, `wishlist_added`, `order_placed`, `order_status_updated`)
  if (action === 'dispatch') {
    const eventType = String(body?.eventType || '') as NotificationEventType;
    if (
      !['cart_added', 'wishlist_added', 'order_placed', 'order_status_updated'].includes(eventType)
    ) {
      return res.status(400).json({ success: false, error: 'Invalid notification eventType.' });
    }

    // Determine target recipient:
    // - Admins updating an order can target that order's `recipientEmail` & `recipientPhone`.
    // - Regular customers always dispatch to their own authenticated account email & registered phone.
    let targetEmail = '';
    let targetPhone = '';
    let customerName = 'Valued Member';

    if (eventType === 'order_status_updated' && adminCheck.authorized && body?.recipientEmail) {
      targetEmail = cleanVal(body.recipientEmail).toLowerCase();
      targetPhone = cleanVal(body.recipientPhone);
      customerName = cleanVal(body.customerName) || targetEmail.split('@')[0];
    } else if (authedUser?.email) {
      targetEmail = authedUser.email;
      targetPhone = cleanVal(authedUser.phone) || cleanVal(body?.recipientPhone);
      customerName =
        cleanVal(authedUser.full_name) ||
        cleanVal(body?.customerName) ||
        targetEmail.split('@')[0];
    } else if (!cfg.isConfigured && body?.recipientEmail) {
      targetEmail = cleanVal(body.recipientEmail).toLowerCase();
      targetPhone = cleanVal(body.recipientPhone);
      customerName = cleanVal(body.customerName) || targetEmail.split('@')[0];
    } else {
      return res.status(401).json({
        success: false,
        error: 'Customer authentication required to dispatch notifications.',
      });
    }

    const inbox = await readCustomerInbox(cfg, targetEmail);
    if (!targetPhone && inbox.phone) {
      targetPhone = inbox.phone;
    }
    if (targetPhone) {
      inbox.phone = targetPhone;
    }

    const prefs = inbox.preferences;
    const eventEnabled =
      (eventType === 'cart_added' && prefs.notify_cart) ||
      (eventType === 'wishlist_added' && prefs.notify_wishlist) ||
      ((eventType === 'order_placed' || eventType === 'order_status_updated') &&
        prefs.notify_orders);

    if (!eventEnabled) {
      return res.status(200).json({
        success: true,
        skippedByPreference: true,
        gatewayStatus,
      });
    }

    const proto = getHeader(req, 'x-forwarded-proto') || 'https';
    const host = getHeader(req, 'host') || 'localhost:3000';
    const originUrl = `${proto}://${host}`;

    const composed = composeNotificationContent({
      eventType,
      customerName,
      originUrl,
      payload: body?.payload || {},
    });

    const fullCtaUrl = `${originUrl}${composed.actionUrl}`;
    const htmlEmail = buildBrandedHtmlEmail({
      customerName,
      headline: composed.title,
      bodyLines: composed.bodyLines,
      ctaLabel: composed.ctaLabel,
      ctaUrl: fullCtaUrl,
    });
    const plainTextEmail = [
      `Hi ${customerName},`,
      '',
      ...composed.bodyLines,
      '',
      `${composed.ctaLabel}: ${fullCtaUrl}`,
      '',
      '— PatanaKart (Fashion For Every You)',
    ].join('\n');

    const [emailResult, smsResult] = await Promise.all([
      prefs.email_enabled
        ? dispatchRealEmail({
            to: targetEmail,
            subject: composed.subject,
            text: plainTextEmail,
            html: htmlEmail,
          })
        : Promise.resolve({
            status: 'skipped' as ChannelDeliveryStatus,
            provider: 'none',
            detail: 'Email alerts paused in preferences',
          }),
      prefs.sms_enabled
        ? dispatchRealSms({
            rawPhone: targetPhone,
            body: composed.smsBody,
          })
        : Promise.resolve({
            status: 'skipped' as ChannelDeliveryStatus,
            provider: 'none',
            detail: 'SMS alerts paused in preferences',
          }),
    ]);

    const normalizedPhone = normalizePhoneNumbers(targetPhone);

    const record: CustomerNotification = {
      id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: authedUser?.id,
      recipient_email: targetEmail,
      recipient_phone: normalizedPhone.display || targetPhone || undefined,
      event_type: eventType,
      title: composed.title,
      subject: composed.subject,
      email_body_text: composed.bodyLines.join('\n\n'),
      sms_body: composed.smsBody,
      action_url: composed.actionUrl,
      metadata: composed.metadata,
      channels: {
        email: emailResult,
        sms: smsResult,
      },
      is_read: false,
      created_at: new Date().toISOString(),
    };

    inbox.notifications = [record, ...inbox.notifications];
    await writeCustomerInbox(cfg, targetEmail, inbox);

    return res.status(200).json({
      success: true,
      notification: record,
      gatewayStatus,
    });
  }

  return res.status(400).json({ success: false, error: `Unknown notification action: ${action}` });
}
