import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  CustomerNotification,
  CustomerNotificationPreferences,
  NotificationEventType,
} from '../types';
import { useAuth } from './AuthContext';
import { getAdminRequestHeaders, getCustomerAuthHeaders } from '../lib/supabase';

export interface GatewayStatusInfo {
  emailConfigured: boolean;
  emailProvider: string;
  smsConfigured: boolean;
  smsProvider: string;
}

interface DispatchNotificationOptions {
  eventType: NotificationEventType;
  payload: Record<string, any>;
  recipientEmail?: string;
  recipientPhone?: string;
  customerName?: string;
  asAdmin?: boolean;
  silentToast?: boolean;
}

interface NotificationContextType {
  notifications: CustomerNotification[];
  unreadCount: number;
  preferences: CustomerNotificationPreferences;
  gatewayStatus: GatewayStatusInfo;
  loadingNotifications: boolean;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  activeToast: CustomerNotification | null;
  dismissToast: () => void;
  refreshNotifications: () => Promise<void>;
  dispatchNotification: (
    opts: DispatchNotificationOptions
  ) => Promise<CustomerNotification | null>;
  markAsRead: (notificationId?: string) => Promise<void>;
  updatePreferences: (next: Partial<CustomerNotificationPreferences>) => Promise<void>;
}

const DEFAULT_PREFS: CustomerNotificationPreferences = {
  email_enabled: true,
  sms_enabled: true,
  notify_cart: true,
  notify_wishlist: true,
  notify_orders: true,
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isOwner, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [preferences, setPreferences] = useState<CustomerNotificationPreferences>(DEFAULT_PREFS);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusInfo>({
    emailConfigured: false,
    emailProvider: 'inbox-only',
    smsConfigured: false,
    smsProvider: 'inbox-only',
  });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<CustomerNotification | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const buildHeaders = useCallback(
    async (forceAdmin = false) => {
      if (forceAdmin || isOwner || isAdmin) {
        return getAdminRequestHeaders();
      }
      return getCustomerAuthHeaders();
    },
    [isOwner, isAdmin]
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  const showToast = useCallback((item: CustomerNotification) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setActiveToast(item);
    toastTimerRef.current = window.setTimeout(() => {
      setActiveToast(null);
      toastTimerRef.current = null;
    }, 5500);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user?.email) {
      setNotifications([]);
      return;
    }

    setLoadingNotifications(true);
    try {
      const headers = await buildHeaders(false);
      const res = await fetch('/api/notifications', {
        method: 'GET',
        headers,
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          setNotifications(Array.isArray(json.notifications) ? json.notifications : []);
          if (json.preferences) {
            setPreferences({ ...DEFAULT_PREFS, ...json.preferences });
          }
          if (json.gatewayStatus) {
            setGatewayStatus(json.gatewayStatus);
          }
        }
      }
    } catch {
      // Keep local state if network transiently unavailable
    } finally {
      setLoadingNotifications(false);
    }
  }, [user?.email, buildHeaders]);

  useEffect(() => {
    if (user?.email) {
      refreshNotifications();
    } else {
      setNotifications([]);
      dismissToast();
      setIsDrawerOpen(false);
    }
  }, [user?.email, refreshNotifications, dismissToast]);

  const dispatchNotification = useCallback(
    async (opts: DispatchNotificationOptions): Promise<CustomerNotification | null> => {
      const recipientEmail = opts.recipientEmail || user?.email || '';
      const recipientPhone = opts.recipientPhone || user?.phone || '';
      const customerName = opts.customerName || user?.full_name || '';

      if (!recipientEmail) {
        return null;
      }

      try {
        const headers = await buildHeaders(Boolean(opts.asAdmin));
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'dispatch',
            eventType: opts.eventType,
            payload: opts.payload,
            recipientEmail,
            recipientPhone,
            customerName,
          }),
        });

        const json = await res.json().catch(() => null);
        if (json?.gatewayStatus) {
          setGatewayStatus(json.gatewayStatus);
        }

        if (res.ok && json?.success && json?.notification) {
          const created = json.notification as CustomerNotification;
          // Only append to current user's drawer if this alert belongs to the signed-in user
          if (
            user?.email &&
            created.recipient_email.toLowerCase() === user.email.toLowerCase()
          ) {
            setNotifications((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
            if (!opts.silentToast) {
              showToast(created);
            }
          }
          return created;
        }
      } catch (err) {
        console.warn('Notification dispatch warning:', err);
      }

      return null;
    },
    [user?.email, user?.phone, user?.full_name, buildHeaders, showToast]
  );

  const markAsRead = useCallback(
    async (notificationId?: string) => {
      setNotifications((prev) =>
        prev.map((n) =>
          !notificationId || n.id === notificationId ? { ...n, is_read: true } : n
        )
      );

      if (!user?.email) return;

      try {
        const headers = await buildHeaders(false);
        await fetch('/api/notifications', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'mark-read',
            notificationId,
          }),
        });
      } catch {
        // Optimistic update already applied
      }
    },
    [user?.email, buildHeaders]
  );

  const updatePreferences = useCallback(
    async (next: Partial<CustomerNotificationPreferences>) => {
      const merged = { ...preferences, ...next };
      setPreferences(merged);

      if (!user?.email) return;

      try {
        const headers = await buildHeaders(false);
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'update-preferences',
            preferences: merged,
          }),
        });
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.preferences) {
            setPreferences({ ...DEFAULT_PREFS, ...json.preferences });
          }
        }
      } catch {
        // Keep optimistic state
      }
    },
    [preferences, user?.email, buildHeaders]
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        gatewayStatus,
        loadingNotifications,
        isDrawerOpen,
        setIsDrawerOpen,
        activeToast,
        dismissToast,
        refreshNotifications,
        dispatchNotification,
        markAsRead,
        updatePreferences,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
