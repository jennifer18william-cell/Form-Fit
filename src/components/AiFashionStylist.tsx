import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  Upload,
  ImagePlus,
  Send,
  X,
  RotateCcw,
  RefreshCw,
  Shirt,
  ChevronDown,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { optimizeImage } from '../lib/imageOptimization';
import {
  StylistApiRequest,
  StylistApiResponse,
  StylistHistoryTurn,
  StylistImageInput,
  StylistOutfitSuggestion,
  StylistPreferences,
  StylistProductRecommendation,
  VisualGarmentAnalysis,
  VisualMatchGroups,
} from '../types/stylist';
import {
  CompleteOutfitCard,
  ProductRecommendationCard,
  VisualAnalysisSummary,
  VisualMatchResultsSection,
} from './stylist/StylistCards';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imagePreviewUrl?: string;
  visualAnalysis?: VisualGarmentAnalysis | null;
  visualMatchGroups?: VisualMatchGroups | null;
  recommendations?: StylistProductRecommendation[];
  outfit?: StylistOutfitSuggestion | null;
  followUpSuggestions?: string[];
  pagination?: {
    offset: number;
    limit: number;
    totalEligible: number;
    hasMore: boolean;
  };
  loadingMore?: boolean;
  timestamp: number;
}

const WELCOME_MESSAGE = "Hi! I'm your Form & Fit stylist. Let's find your perfect look.";

const QUICK_ACTIONS: Array<{
  id: string;
  label: string;
  prompt?: string;
  mode?: StylistApiRequest['mode'];
  opensVisualSearch?: boolean;
}> = [
  {
    id: 'find-style',
    label: 'Find my style',
    prompt: 'Help me find my personal fashion style from the Form & Fit collection.',
    mode: 'chat',
  },
  {
    id: 'style-outfit',
    label: 'Style an outfit',
    prompt: 'Style a complete coordinated outfit for me from Form & Fit.',
    mode: 'outfit_builder',
  },
  {
    id: 'photo-search',
    label: 'Find a product from a photo',
    opensVisualSearch: true,
  },
  {
    id: 'budget-outfit',
    label: 'Build an outfit under my budget',
    prompt: 'Help me build a complete outfit under my budget in Indian rupees.',
    mode: 'outfit_builder',
  },
  {
    id: 'occasion',
    label: 'Recommend products for an occasion',
    prompt: 'Recommend outfits and pieces for an upcoming occasion.',
    mode: 'chat',
  },
  {
    id: 'accessories',
    label: 'Find matching accessories',
    prompt: 'Show me matching accessories and footwear available in Form & Fit.',
    mode: 'chat',
  },
];

const SESSION_STORAGE_KEY = 'formfit_ai_stylist_session_v1';
const ALLOWED_CLIENT_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024; // 10 MB pre-compression limit

function createInitialGreetingMessage(): ChatMessageItem {
  return {
    id: 'welcome-msg',
    role: 'assistant',
    content: WELCOME_MESSAGE,
    timestamp: Date.now(),
  };
}

export const AiFashionStylist: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([createInitialGreetingMessage()]);
  const [preferences, setPreferences] = useState<StylistPreferences>({});
  const [inputValue, setInputValue] = useState('');
  const [visualTrayOpen, setVisualTrayOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Pending image state for "Find this style"
  const [pendingImage, setPendingImage] = useState<{
    previewUrl: string;
    payload: StylistImageInput;
  } | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Live Camera Modal state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Request & Retry state
  const [isSending, setIsSending] = useState(false);
  const [loadingHint, setLoadingHint] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    text: string;
    image: { previewUrl: string; payload: StylistImageInput } | null;
    mode: StylistApiRequest['mode'];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore lightweight session preferences & transcript on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
        }
        if (parsed.preferences && typeof parsed.preferences === 'object') {
          setPreferences(parsed.preferences);
        }
      }
    } catch {
      // Ignore storage parse issues
    }
  }, []);

  // Persist session preferences & transcript (retaining compact preview thumbnails under 90 KB)
  useEffect(() => {
    try {
      const compactMessages = messages.slice(-16).map((m) => ({
        ...m,
        imagePreviewUrl:
          m.imagePreviewUrl && m.imagePreviewUrl.length < 90_000
            ? m.imagePreviewUrl
            : undefined,
      }));
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          preferences,
          messages: compactMessages,
        })
      );
    } catch {
      // Ignore sessionStorage quota issues
    }
  }, [messages, preferences]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (!isOpen) return;
    const el = scrollContainerRef.current;
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [messages, isSending, visualTrayOpen, pendingImage, apiError, isOpen]);

  // Stop live camera stream safely
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeCameraModal = useCallback(() => {
    stopCameraStream();
    setCameraOpen(false);
    setCameraError(null);
  }, [stopCameraStream]);

  // Keyboard Escape handler
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (cameraOpen) {
          closeCameraModal();
        } else {
          setIsOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, cameraOpen, closeCameraModal]);

  // Start camera stream when cameraOpen or cameraFacing changes
  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;
    async function initCamera() {
      setCameraError(null);
      stopCameraStream();

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setCameraError('Live camera preview is not supported in this browser. Using device camera picker instead.');
        mobileCameraInputRef.current?.click();
        setCameraOpen(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1280 },
            height: { ideal: 1600 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            'Camera permission was declined or unavailable. You can still take a photo or choose one from your device.'
          );
        }
      }
    }

    initCamera();
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraOpen, cameraFacing, stopCameraStream]);

  // Validate, check dimensions, and optimize image file
  const processSelectedImageFile = async (file: File | Blob, fileName = 'style-photo.jpg') => {
    setValidationError(null);
    setApiError(null);

    const mime = (file.type || '').toLowerCase();
    if (!ALLOWED_CLIENT_MIMES.has(mime)) {
      setValidationError('Unsupported file format. Please choose a JPG, JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_RAW_FILE_BYTES) {
      setValidationError('Image is larger than 10 MB. Please choose a photo under 10 MB.');
      return;
    }

    setImageProcessing(true);
    try {
      // Verify natural dimensions first
      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Could not decode image file.'));
        };
        img.src = url;
      });

      if (dims.width < 60 || dims.height < 60) {
        setValidationError('Image resolution is too small (minimum 60×60 px). Please upload a clearer photo.');
        setImageProcessing(false);
        return;
      }

      if (dims.width > 8000 || dims.height > 8000) {
        setValidationError('Image dimensions exceed 8000×8000 px. Please crop or resize the image.');
        setImageProcessing(false);
        return;
      }

      const optimized = await optimizeImage(file, 1150, 1450, 0.85);
      const match = optimized.dataUrl.match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/);
      if (!match) {
        throw new Error('Could not prepare image for visual analysis.');
      }

      const outMime = match[1] as 'image/jpeg' | 'image/png' | 'image/webp';
      const base64Data = match[2];

      setPendingImage({
        previewUrl: optimized.dataUrl,
        payload: {
          base64Data,
          mimeType: outMime,
          width: optimized.width,
          height: optimized.height,
          fileName,
        },
      });
      setVisualTrayOpen(false);
    } catch (err: any) {
      setValidationError(err?.message || 'Unable to read this image. Please try another JPG, PNG, or WebP photo.');
    } finally {
      setImageProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedImageFile(file, file.name);
    }
    e.target.value = '';
  };

  const handleCaptureCameraFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          closeCameraModal();
          processSelectedImageFile(blob, `camera-${Date.now()}.jpg`);
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedImageFile(file, file.name);
    }
  };

  // Send message or visual product search to /api/stylist
  const submitStylistQuery = async (opts?: {
    overrideText?: string;
    overrideImage?: { previewUrl: string; payload: StylistImageInput } | null;
    mode?: StylistApiRequest['mode'];
    isRetry?: boolean;
  }) => {
    const textToSend = (opts?.overrideText !== undefined ? opts.overrideText : inputValue).trim();
    const imageToSend = opts?.overrideImage !== undefined ? opts.overrideImage : pendingImage;
    const requestMode: StylistApiRequest['mode'] =
      opts?.mode || (imageToSend ? 'visual_search' : 'chat');

    if (!textToSend && !imageToSend) return;
    if (isSending) return;

    setValidationError(null);
    setApiError(null);
    setRetryPayload(null);

    const displayUserText =
      textToSend || (imageToSend ? 'Find this style in Form & Fit' : '');

    // Append user turn unless retrying an already-added user message
    if (!opts?.isRetry) {
      const userTurn: ChatMessageItem = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: displayUserText,
        imagePreviewUrl: imageToSend?.previewUrl,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userTurn]);
      setInputValue('');
      setPendingImage(null);
      setVisualTrayOpen(false);
    }

    setIsSending(true);
    setLoadingHint(
      imageToSend
        ? 'Analyzing garment cut, colors, fabric & matching live catalog...'
        : requestMode === 'outfit_builder'
        ? 'Coordinating complete outfit & calculating live catalog prices...'
        : 'Checking live Form & Fit catalog for your preferences...'
    );

    const historyPayload: StylistHistoryTurn[] = messages
      .filter((m) => m.id !== 'welcome-msg')
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.content,
        hadImage: Boolean(m.imagePreviewUrl || m.visualAnalysis),
      }));

    const apiBody: StylistApiRequest = {
      message: textToSend,
      history: historyPayload,
      preferences,
      image: imageToSend ? imageToSend.payload : null,
      mode: requestMode,
      offset: 0,
      limit: 6,
    };

    try {
      const response = await fetch('/api/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiBody),
      });

      const data: StylistApiResponse = await response.json().catch(() => ({
        success: false,
        reply: '',
        preferences,
        followUpSuggestions: [],
        recommendations: [],
        error: 'Received an unexpected response from the stylist service.',
      }));

      if (!response.ok || !data.success) {
        setApiError(
          data.error || 'Could not reach the Form & Fit stylist right now. Please retry.'
        );
        setRetryPayload({
          text: textToSend,
          image: imageToSend,
          mode: requestMode,
        });
        return;
      }

      if (data.preferences) {
        setPreferences(data.preferences);
      }

      const assistantTurn: ChatMessageItem = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        visualAnalysis: data.visualAnalysis || null,
        visualMatchGroups: data.visualMatchGroups || null,
        recommendations: data.recommendations || [],
        outfit: data.outfit || null,
        followUpSuggestions: data.followUpSuggestions || [],
        pagination: data.pagination,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantTurn]);
    } catch {
      setApiError('Network connection interrupted while contacting the stylist. Please retry.');
      setRetryPayload({
        text: textToSend,
        image: imageToSend,
        mode: requestMode,
      });
    } finally {
      setIsSending(false);
      setLoadingHint('');
    }
  };

  // Pagination handler: "Show more matches"
  const handleLoadMoreMatches = async (messageId: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.pagination?.hasMore || !targetMsg.visualAnalysis || targetMsg.loadingMore) {
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, loadingMore: true } : m))
    );

    const nextOffset = targetMsg.pagination.offset + targetMsg.pagination.limit;
    try {
      const response = await fetch('/api/stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'load_more_matches',
          preferences,
          cachedAnalysis: targetMsg.visualAnalysis,
          offset: nextOffset,
          limit: targetMsg.pagination.limit,
        } satisfies StylistApiRequest),
      });

      const data: StylistApiResponse = await response.json();
      if (response.ok && data.success) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const existingIds = new Set((m.recommendations || []).map((r) => r.product.id));
            const fresh = (data.recommendations || []).filter((r) => !existingIds.has(r.product.id));
            return {
              ...m,
              recommendations: [...(m.recommendations || []), ...fresh],
              pagination: data.pagination,
              loadingMore: false,
            };
          })
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, loadingMore: false } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, loadingMore: false } : m))
      );
    }
  };

  const handleResetSession = () => {
    setMessages([createInitialGreetingMessage()]);
    setPreferences({});
    setPendingImage(null);
    setVisualTrayOpen(false);
    setValidationError(null);
    setApiError(null);
    setRetryPayload(null);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  // Format active session preferences cleanly as unboxed text
  const preferenceParts: string[] = [];
  if (preferences.gender) preferenceParts.push(preferences.gender);
  if (preferences.occasion) preferenceParts.push(preferences.occasion);
  if (preferences.style) preferenceParts.push(preferences.style);
  if (preferences.budgetInr) {
    preferenceParts.push(`Under ₹${preferences.budgetInr.toLocaleString('en-IN')}`);
  }
  if (preferences.preferredSize) preferenceParts.push(`Size ${preferences.preferredSize}`);

  const showStarterActions = messages.length <= 1 && !pendingImage && !visualTrayOpen;

  return (
    <>
      {/* Hidden File & Mobile Camera Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={mobileCameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Floating Bottom-Right Trigger Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(true)}
            aria-label="Open Form & Fit AI Fashion Stylist"
            className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 group flex items-center gap-2.5 rounded-full bg-[#18181B] pl-3.5 pr-4 py-3 text-white shadow-[0_12px_32px_rgba(24,24,27,0.22)] border border-[#27272A] hover:bg-[#27272A] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] focus-visible:ring-offset-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B8F130] text-[#111111] transition-transform duration-200 group-hover:scale-105">
              <Shirt size={16} strokeWidth={2.2} />
            </span>
            <span className="text-left leading-tight">
              <span className="block font-space text-xs font-bold tracking-tight text-white">
                AI Stylist
              </span>
              <span className="block text-[10px] text-[#A1A1AA]">
                Style &amp; Photo Match
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main Stylist Chat & Visual Finder Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.section
            role="dialog"
            aria-label="Form & Fit AI Fashion Stylist"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="fixed inset-x-2 bottom-2 top-14 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[432px] sm:h-[min(710px,calc(100vh-48px))] flex flex-col overflow-hidden rounded-2xl border border-[#D6D5CE] bg-[#FAF9F6] shadow-[0_24px_64px_rgba(24,24,27,0.18)]"
          >
            {/* Desktop Drag-and-Drop Overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#FAF9F6]/95 backdrop-blur-xs border-2 border-dashed border-[#65A30D] rounded-2xl p-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#B8F130] text-[#111111] mb-3">
                  <Upload size={22} />
                </div>
                <p className="font-space text-base font-bold text-[#18181B]">
                  Drop outfit photo to match
                </p>
                <p className="mt-1 text-xs text-[#52525B]">
                  Supports JPG, PNG, and WebP up to 10 MB
                </p>
              </div>
            )}

            {/* Header */}
            <header className="shrink-0 bg-white border-b border-[#E5E4DF] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#B8F130] text-[#111111]">
                    <Shirt size={18} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-space text-sm font-bold text-[#18181B] truncate">
                      Form &amp; Fit Personal Stylist
                    </h2>
                    <p className="text-[11px] text-[#64748B] truncate">
                      Live catalog styling · Visual photo search
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setVisualTrayOpen((v) => !v);
                      setValidationError(null);
                    }}
                    title="Find this style from a photo"
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D] ${
                      visualTrayOpen || pendingImage
                        ? 'bg-[#B8F130] text-[#111111]'
                        : 'bg-[#F4F3EF] text-[#18181B] hover:bg-[#E5E4DF]'
                    }`}
                  >
                    <Camera size={13} />
                    <span>Find this style</span>
                  </button>

                  {messages.length > 1 && (
                    <button
                      type="button"
                      onClick={handleResetSession}
                      title="Start new styling session"
                      aria-label="Start new styling session"
                      className="p-2 rounded-lg text-[#64748B] hover:text-[#18181B] hover:bg-[#F4F3EF] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                    >
                      <RotateCcw size={15} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Minimize AI Stylist"
                    className="p-2 rounded-lg text-[#64748B] hover:text-[#18181B] hover:bg-[#F4F3EF] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                  >
                    <ChevronDown size={17} />
                  </button>
                </div>
              </div>

              {/* Remembered Session Preferences Strip (Unboxed Typography) */}
              {preferenceParts.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#E5E4DF] flex items-center justify-between gap-2 text-[11px] text-[#52525B]">
                  <p className="truncate">
                    <span className="font-medium text-[#18181B]">Your profile: </span>
                    {preferenceParts.join(' · ')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreferences({})}
                    className="shrink-0 text-[#64748B] hover:text-[#18181B] underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </header>

            {/* Prominent "Find this style" Visual Search Tray */}
            <AnimatePresence>
              {visualTrayOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="shrink-0 overflow-hidden border-b border-[#E5E4DF] bg-white"
                >
                  <div className="p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-space text-xs font-bold text-[#18181B]">
                          Find this style by photo
                        </h3>
                        <p className="text-[11px] text-[#64748B]">
                          Snap an outfit or upload from Instagram, Pinterest, or your gallery
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVisualTrayOpen(false)}
                        aria-label="Close visual search options"
                        className="p-1 text-[#71717A] hover:text-[#18181B] cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E4DF] bg-[#FAF9F6] px-3 py-2.5 text-xs font-semibold text-[#18181B] hover:border-[#65A30D] hover:bg-[#F4FBE1] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                      >
                        <Camera size={15} className="text-[#3F6212]" />
                        <span>Take a photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 rounded-xl border border-[#E5E4DF] bg-[#FAF9F6] px-3 py-2.5 text-xs font-semibold text-[#18181B] hover:border-[#65A30D] hover:bg-[#F4FBE1] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                      >
                        <Upload size={15} className="text-[#3F6212]" />
                        <span>Upload image</span>
                      </button>
                    </div>

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 hidden sm:flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#D6D5CE] bg-[#FAF9F6]/60 px-3 py-2.5 text-[11px] text-[#64748B] hover:border-[#65A30D] hover:text-[#18181B] transition-colors cursor-pointer"
                    >
                      <ImagePlus size={14} />
                      <span>Or drag and drop JPG, PNG, or WebP anywhere here</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scrollable Conversation Area */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-[#18181B] text-white rounded-br-sm'
                          : 'bg-white text-[#18181B] border border-[#E5E4DF] rounded-bl-sm'
                      }`}
                    >
                      {msg.imagePreviewUrl && (
                        <div className="mb-2 overflow-hidden rounded-lg border border-white/15">
                          <img
                            src={msg.imagePreviewUrl}
                            alt="Uploaded style reference"
                            className="max-h-44 w-auto object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-line text-[13px] leading-relaxed">{msg.content}</p>
                    </div>

                    {/* Visual Garment Profile Summary */}
                    {!isUser && msg.visualAnalysis && (
                      <div className="w-full max-w-[96%]">
                        <VisualAnalysisSummary analysis={msg.visualAnalysis} />
                      </div>
                    )}

                    {/* Dedicated Visual Match Results ("Closest Matches" + Low-Confidence Options) */}
                    {!isUser && msg.visualMatchGroups ? (
                      <VisualMatchResultsSection
                        groups={msg.visualMatchGroups}
                        recommendations={msg.recommendations || []}
                        preferredSize={preferences.preferredSize}
                        pagination={msg.pagination}
                        loadingMore={msg.loadingMore}
                        onLoadMore={() => handleLoadMoreMatches(msg.id)}
                        onUploadAnother={() => {
                          setPendingImage(null);
                          setVisualTrayOpen(true);
                        }}
                      />
                    ) : (
                      /* Standard Conversational Product Recommendations */
                      !isUser &&
                      msg.recommendations &&
                      msg.recommendations.length > 0 && (
                        <div className="mt-2.5 w-full space-y-2.5">
                          {msg.recommendations.map((rec) => (
                            <ProductRecommendationCard
                              key={`${msg.id}-${rec.product.id}`}
                              recommendation={rec}
                              preferredSize={preferences.preferredSize}
                            />
                          ))}
                        </div>
                      )
                    )}

                    {/* Complete Outfit Builder Card */}
                    {!isUser && msg.outfit && (
                      <div className="mt-2.5 w-full">
                        <CompleteOutfitCard
                          outfit={msg.outfit}
                          preferredSize={preferences.preferredSize}
                          budgetInr={preferences.budgetInr}
                        />
                      </div>
                    )}

                    {/* Contextual Follow-Up Suggestions on Latest Assistant Message */}
                    {!isUser &&
                      msg.followUpSuggestions &&
                      msg.followUpSuggestions.length > 0 &&
                      msg.id === messages[messages.length - 1]?.id &&
                      !isSending && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {msg.followUpSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                if (/from a photo|upload a photo/i.test(suggestion)) {
                                  setVisualTrayOpen(true);
                                } else {
                                  submitStylistQuery({
                                    overrideText: suggestion,
                                    overrideImage: null,
                                  });
                                }
                              }}
                              className="rounded-lg border border-[#E5E4DF] bg-white px-2.5 py-1.5 text-xs font-medium text-[#27272A] hover:border-[#65A30D] hover:bg-[#F4FBE1] hover:text-[#18181B] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}

              {/* Initial Suggested Quick Actions */}
              {showStarterActions && !isSending && (
                <div className="pt-1">
                  <p className="mb-2 text-[11px] font-medium text-[#71717A]">
                    Suggested quick actions
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => {
                          if (action.opensVisualSearch) {
                            setVisualTrayOpen(true);
                          } else if (action.prompt) {
                            submitStylistQuery({
                              overrideText: action.prompt,
                              overrideImage: null,
                              mode: action.mode,
                            });
                          }
                        }}
                        className="flex items-center justify-between rounded-xl border border-[#E5E4DF] bg-white px-3.5 py-2.5 text-left text-xs font-medium text-[#18181B] hover:border-[#65A30D] hover:bg-[#F4FBE1] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                      >
                        <span>{action.label}</span>
                        {action.opensVisualSearch ? (
                          <Camera size={14} className="text-[#4D7C0F] shrink-0" />
                        ) : (
                          <span className="text-[#65A30D] font-semibold">→</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {isSending && (
                <div className="flex items-start">
                  <div className="rounded-2xl rounded-bl-sm border border-[#E5E4DF] bg-white px-3.5 py-3 text-xs text-[#3F3F46] flex items-center gap-2.5">
                    <Loader2 size={15} className="animate-spin text-[#4D7C0F] shrink-0" />
                    <span>{loadingHint || 'Styling your recommendations...'}</span>
                  </div>
                </div>
              )}

              {/* Friendly Validation or Network Error + Retry */}
              {(validationError || apiError) && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="leading-relaxed">{validationError || apiError}</p>
                      {retryPayload && (
                        <button
                          type="button"
                          onClick={() =>
                            submitStylistQuery({
                              overrideText: retryPayload.text,
                              overrideImage: retryPayload.image,
                              mode: retryPayload.mode,
                              isRetry: true,
                            })
                          }
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#18181B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#27272A] transition-colors cursor-pointer"
                        >
                          <RefreshCw size={12} />
                          <span>Retry search</span>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setValidationError(null);
                        setApiError(null);
                      }}
                      aria-label="Dismiss error"
                      className="text-rose-500 hover:text-rose-800 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Composer + Pending Image Preview */}
            <footer className="shrink-0 bg-white border-t border-[#E5E4DF] p-3">
              {imageProcessing && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#FAF9F6] border border-[#E5E4DF] px-3 py-2 text-xs text-[#52525B]">
                  <Loader2 size={14} className="animate-spin text-[#4D7C0F]" />
                  <span>Preparing photo for visual garment recognition...</span>
                </div>
              )}

              {pendingImage && !imageProcessing && (
                <div className="mb-2.5 flex items-center gap-3 rounded-xl border border-[#D6D5CE] bg-[#FAF9F6] p-2.5">
                  <img
                    src={pendingImage.previewUrl}
                    alt="Selected clothing preview"
                    className="h-14 w-12 rounded-lg object-cover border border-[#E5E4DF] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#18181B] truncate">
                      Photo ready for style matching
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      Add an optional note below or tap Match Photo
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="font-medium text-[#3F6212] hover:underline cursor-pointer"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingImage(null)}
                        className="inline-flex items-center gap-1 font-medium text-[#71717A] hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 size={11} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => submitStylistQuery({ mode: 'visual_search' })}
                    className="shrink-0 rounded-lg bg-[#B8F130] px-3 py-2 text-xs font-bold text-[#111111] hover:bg-[#AAE422] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Match Photo
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitStylistQuery();
                }}
                className="flex items-end gap-2"
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload outfit image"
                  aria-label="Upload outfit image"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5E4DF] bg-[#FAF9F6] text-[#3F3F46] hover:border-[#65A30D] hover:text-[#18181B] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                >
                  <ImagePlus size={17} />
                </button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitStylistQuery();
                    }
                  }}
                  placeholder={
                    pendingImage
                      ? 'Optional: e.g. "Find in black or style a full outfit"...'
                      : 'Ask for outfits, occasions, budget in ₹, or upload a photo...'
                  }
                  className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-[#E5E4DF] bg-[#FAF9F6] px-3 py-2.5 text-xs text-[#18181B] placeholder:text-[#71717A] focus:border-[#65A30D] focus:bg-white focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={isSending || (!inputValue.trim() && !pendingImage)}
                  aria-label="Send message to stylist"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B8F130] text-[#111111] hover:bg-[#AAE422] transition-colors cursor-pointer disabled:bg-[#E5E4DF] disabled:text-[#A1A1AA] disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65A30D]"
                >
                  <Send size={16} />
                </button>
              </form>
            </footer>

            {/* Live Camera Capture Overlay Modal */}
            <AnimatePresence>
              {cameraOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 flex flex-col bg-[#111111] text-white"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <span className="font-space text-xs font-bold">
                      Take a photo to match style
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCameraFacing((prev) =>
                            prev === 'environment' ? 'user' : 'environment'
                          )
                        }
                        className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium hover:bg-white/20 cursor-pointer"
                      >
                        Flip camera
                      </button>
                      <button
                        type="button"
                        onClick={closeCameraModal}
                        aria-label="Close camera"
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
                    {cameraError ? (
                      <div className="p-6 text-center max-w-xs">
                        <p className="text-xs text-zinc-300 leading-relaxed">{cameraError}</p>
                        <button
                          type="button"
                          onClick={() => {
                            closeCameraModal();
                            mobileCameraInputRef.current?.click();
                          }}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#B8F130] px-4 py-2.5 text-xs font-bold text-[#111111] cursor-pointer"
                        >
                          <Camera size={15} />
                          <span>Open Device Camera / Gallery</span>
                        </button>
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  {!cameraError && (
                    <div className="flex items-center justify-center gap-4 px-4 py-4 bg-[#111111] border-t border-white/10">
                      <button
                        type="button"
                        onClick={handleCaptureCameraFrame}
                        className="inline-flex items-center gap-2 rounded-full bg-[#B8F130] px-6 py-2.5 text-xs font-bold text-[#111111] hover:bg-[#AAE422] transition-colors cursor-pointer"
                      >
                        <Camera size={15} />
                        <span>Capture Photo</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
};
