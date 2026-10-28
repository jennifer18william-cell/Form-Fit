import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  X,
  ShoppingBag,
  Heart,
  PackageCheck,
  Truck,
  CheckCheck,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { CustomerNotification, NotificationEventType } from '../types';

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getEventIcon(eventType: NotificationEventType) {
  switch (eventType) {
    case 'cart_added':
      return ShoppingBag;
    case 'wishlist_added':
      return Heart;
    case 'order_placed':
      return PackageCheck;
    case 'order_status_updated':
      return Truck;
  }
}

function formatChannelLine(item: CustomerNotification): string {
  const parts: string[] = [];
  if (item.channels.email.status === 'sent') {
    parts.push(`Email sent to ${item.recipient_email}`);
  } else if (item.channels.email.status === 'logged') {
    parts.push(`Email alert for ${item.recipient_email}`);
  }

  if (item.recipient_phone) {
    if (item.channels.sms.status === 'sent') {
      parts.push(`SMS sent to ${item.recipient_phone}`);
    } else if (item.channels.sms.status === 'logged') {
      parts.push(`SMS alert for ${item.recipient_phone}`);
    }
  }
  return parts.join(' · ') || `Alert for ${item.recipient_email}`;
}

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isDrawerOpen,
    setIsDrawerOpen,
    activeToast,
    dismissToast,
    markAsRead,
  } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!user) return null;

  const handleOpenDestination = (item: CustomerNotification) => {
    markAsRead(item.id);
    setIsDrawerOpen(false);
    dismissToast();
    if (item.action_url) {
      navigate(item.action_url);
    }
  };

  return (
    <>
      {/* Live Top-Right Alert Toast */}
      <AnimatePresence>
        {activeToast && !isDrawerOpen && (
          <motion.div
            key={activeToast.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed top-22 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm bg-white border border-[#D6D5CE] rounded-xl shadow-lg p-4 font-sans text-[#18181B]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#F4FBE1] text-[#3F6212] flex items-center justify-center shrink-0 mt-0.5">
                  {React.createElement(getEventIcon(activeToast.event_type), { size: 16 })}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-space font-bold text-xs text-[#18181B] leading-snug">
                    {activeToast.title}
                  </p>
                  <p className="text-[11px] text-[#52525B] leading-relaxed break-words">
                    {formatChannelLine(activeToast)}
                  </p>
                  {!activeToast.recipient_phone && (
                    <button
                      type="button"
                      onClick={() => {
                        dismissToast();
                        navigate('/account?tab=notifications');
                      }}
                      className="text-[11px] font-semibold text-[#4D7C0F] hover:underline cursor-pointer block"
                    >
                      + Add mobile number for SMS alerts
                    </button>
                  )}
                  <div className="pt-1 flex items-center gap-3 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        markAsRead(activeToast.id);
                        setExpandedId(activeToast.id);
                        dismissToast();
                        setIsDrawerOpen(true);
                      }}
                      className="text-[#18181B] hover:text-[#4D7C0F] underline cursor-pointer"
                    >
                      View Message
                    </button>
                    {activeToast.action_url && (
                      <>
                        <span className="text-[#D6D5CE]" aria-hidden="true">
                          ·
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenDestination(activeToast)}
                          className="text-[#4D7C0F] hover:underline cursor-pointer"
                        >
                          Open
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissToast}
                className="p-1 text-[#71717A] hover:text-[#18181B] rounded-md cursor-pointer shrink-0"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-Over Notification Inbox Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-[#111111]/40 backdrop-blur-[2px] z-50"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.24 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#E5E4DF] shadow-2xl flex flex-col font-sans text-[#18181B]"
              aria-label="Customer notifications"
            >
              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-[#E5E4DF] flex items-center justify-between">
                <div>
                  <h2 className="font-space font-bold text-base text-[#18181B]">
                    Notifications &amp; Alerts
                  </h2>
                  <p className="text-[11px] text-[#64748B] mt-0.5 truncate max-w-[260px]">
                    {user.email}
                    {user.phone ? ` · ${user.phone}` : ' · No mobile number added'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAsRead()}
                      className="px-2.5 py-1.5 text-xs font-medium text-[#4D7C0F] hover:bg-[#F4FBE1] rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck size={14} />
                      <span>Mark read</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-2 text-[#52525B] hover:text-[#18181B] hover:bg-[#F3F2EE] rounded-md cursor-pointer"
                    aria-label="Close notifications"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Prompt to add registered phone number if missing */}
              {!user.phone && (
                <div className="px-5 py-3 bg-[#FAF9F6] border-b border-[#E5E4DF] flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#52525B]">
                    Add your mobile number to receive SMS alerts alongside email.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      navigate('/account?tab=notifications');
                    }}
                    className="font-space font-bold text-[#3F6212] hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Add Number →
                  </button>
                </div>
              )}

              {/* Notification Feed */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#E5E4DF]">
                {notifications.length === 0 ? (
                  <div className="py-16 px-6 text-center space-y-2">
                    <div className="w-11 h-11 rounded-full bg-[#F3F2EE] text-[#71717A] flex items-center justify-center mx-auto">
                      <Bell size={20} />
                    </div>
                    <p className="font-space font-semibold text-sm text-[#18181B]">
                      No notifications yet
                    </p>
                    <p className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
                      Whenever you add products to your bag, save items to your wishlist, or place
                      an order, your Email and SMS alerts will appear right here.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => {
                    const Icon = getEventIcon(item.event_type);
                    const isExpanded = expandedId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`px-5 py-4 transition-colors ${
                          item.is_read ? 'bg-white' : 'bg-[#F4FBE1]/35'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#E5E4DF] text-[#3F6212] flex items-center justify-center shrink-0 mt-0.5">
                            <Icon size={15} />
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="font-space font-semibold text-xs sm:text-sm text-[#18181B] leading-snug">
                                {item.title}
                              </p>
                              <span className="text-[11px] text-[#71717A] whitespace-nowrap shrink-0 tabular-nums">
                                {formatRelativeTime(item.created_at)}
                              </span>
                            </div>

                            <p className="text-[11px] text-[#52525B] leading-relaxed">
                              {formatChannelLine(item)}
                            </p>

                            <div className="pt-1 flex items-center gap-3 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  markAsRead(item.id);
                                  setExpandedId(isExpanded ? null : item.id);
                                }}
                                className="font-medium text-[#52525B] hover:text-[#18181B] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide message' : 'Read Email & SMS'}</span>
                                <ChevronDown
                                  size={13}
                                  className={`transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {item.action_url && (
                                <>
                                  <span className="text-[#D6D5CE]" aria-hidden="true">
                                    ·
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDestination(item)}
                                    className="font-semibold text-[#4D7C0F] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span>View Item</span>
                                    <ChevronRight size={13} />
                                  </button>
                                </>
                              )}
                            </div>

                            {isExpanded && (
                              <div className="mt-2.5 pt-2.5 border-t border-[#E5E4DF] space-y-2.5 text-xs text-[#3F3F46]">
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold text-[#18181B]">
                                    Email Subject: {item.subject}
                                  </p>
                                  <p className="text-xs text-[#52525B] whitespace-pre-line leading-relaxed">
                                    {item.email_body_text}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-[#F3F2EE] space-y-0.5">
                                  <p className="text-[11px] font-semibold text-[#18181B]">
                                    Mobile SMS Copy{' '}
                                    {item.recipient_phone
                                      ? `(${item.recipient_phone})`
                                      : '(No mobile number saved)'}
                                  </p>
                                  <p className="text-xs text-[#52525B] leading-relaxed">
                                    {item.sms_body}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[#E5E4DF] bg-[#FAF9F6]">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrawerOpen(false);
                    navigate('/account?tab=notifications');
                  }}
                  className="w-full py-2.5 px-4 bg-white hover:bg-[#F3F2EE] border border-[#D6D5CE] text-[#18181B] rounded-lg text-xs font-space font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Settings size={14} />
                  <span>Manage Registered Number &amp; Alert Preferences</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
