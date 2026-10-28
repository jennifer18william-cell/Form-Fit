import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import editorialCampaignImg from '../assets/images/hero_light_modern_tailoring_1792833882624.jpg';

type AuthMode = 'signin' | 'register' | 'forgot';

export const CustomerAuth: React.FC = () => {
  const { signInWithPassword, signUp, resetPassword, user, isOwner, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const rawFrom =
    (location.state as { from?: string } | null)?.from ||
    searchParams.get('redirect') ||
    '/';
  const redirectTarget =
    typeof rawFrom === 'string' &&
    rawFrom.startsWith('/') &&
    !rawFrom.startsWith('/login') &&
    !rawFrom.startsWith('/register')
      ? rawFrom
      : '/';

  const resolveInitialMode = (): AuthMode => {
    if (searchParams.get('mode') === 'forgot') return 'forgot';
    if (location.pathname === '/register' || searchParams.get('mode') === 'register') {
      return 'register';
    }
    return 'signin';
  };

  const [mode, setMode] = useState<AuthMode>(resolveInitialMode);

  useEffect(() => {
    if (searchParams.get('mode') === 'forgot') {
      setMode('forgot');
    } else if (location.pathname === '/register' || searchParams.get('mode') === 'register') {
      setMode('register');
    } else if (location.pathname === '/login' && !searchParams.get('mode')) {
      setMode('signin');
    }
  }, [location.pathname, searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authTransitioning, setAuthTransitioning] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if ((user || isOwner || isAdmin) && !authTransitioning) {
    return <Navigate to={redirectTarget} replace />;
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setBanner(null);
    if (nextMode === 'register' && location.pathname !== '/register') {
      navigate('/register', { replace: true, state: location.state });
    } else if (nextMode === 'signin' && location.pathname !== '/login') {
      navigate('/login', { replace: true, state: location.state });
    }
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-[#E5E4DF]' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 30, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score: 68, label: 'Medium', color: 'bg-amber-500' };
    return { score: 100, label: 'Strong', color: 'bg-[#16A34A]' };
  };

  const strength = getPasswordStrength(password);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!email.trim() || !password) {
      setBanner({ type: 'error', message: 'Please enter both your email address and password.' });
      return;
    }

    setSubmitting(true);
    setAuthTransitioning(true);
    const res = await signInWithPassword(email.trim(), password);
    setSubmitting(false);

    if (res.success) {
      setBanner({ type: 'success', message: 'Signed in! Entering PatanaKart...' });
      setTimeout(() => {
        navigate(redirectTarget, { replace: true });
      }, 350);
    } else {
      setAuthTransitioning(false);
      setBanner({ type: 'error', message: res.message || 'Incorrect email or password.' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setBanner({ type: 'error', message: 'Please fill in your name, email address, and password.' });
      return;
    }

    if (password.length < 6) {
      setBanner({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      setBanner({ type: 'error', message: 'Passwords do not match. Please re-enter to confirm.' });
      return;
    }

    setSubmitting(true);
    setAuthTransitioning(true);
    const res = await signUp(email.trim(), password, fullName.trim(), phone.trim());
    setSubmitting(false);

    if (res.success) {
      setBanner({
        type: 'success',
        message: 'Account created! Welcome to PatanaKart...',
      });
      setTimeout(() => {
        navigate(redirectTarget, { replace: true });
      }, 450);
    } else {
      setAuthTransitioning(false);
      setBanner({
        type: 'error',
        message: res.message || 'Could not create your account. Please try again.',
      });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!email.trim()) {
      setBanner({ type: 'error', message: 'Please enter your registered email address.' });
      return;
    }

    setSubmitting(true);
    const res = await resetPassword(email.trim());
    setSubmitting(false);

    if (res.success) {
      setBanner({
        type: 'success',
        message: res.message || 'Password reset instructions sent to your email.',
      });
    } else {
      setBanner({
        type: 'error',
        message: res.message || 'Unable to send reset email. Please verify your address.',
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAF9F6] text-[#18181B] font-sans selection:bg-[#B8F130] selection:text-[#111111]">
      {/* Left Desktop Editorial Showcase */}
      <aside className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative overflow-hidden bg-[#141416] flex-col justify-between p-10 xl:p-14">
        <img
          src={editorialCampaignImg}
          alt="PatanaKart seasonal fashion editorial"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[#111111]/95 via-[#111111]/35 to-[#111111]/25"
          aria-hidden="true"
        />

        {/* Top Brand Emblem */}
        <div className="relative z-10 flex items-center gap-3">
          <BrandLogo variant="badge" size="md" />
          <div className="flex flex-col leading-none">
            <span className="font-space font-extrabold text-xl tracking-tight text-white">
              Patana<span className="text-[#B8F130]">Kart</span>
            </span>
            <span className="text-[11px] font-medium text-white/75 mt-1 tracking-[0.02em]">
              Fashion For Every You
            </span>
          </div>
        </div>

        {/* Bottom Editorial Story */}
        <div className="relative z-10 max-w-xl space-y-5 mt-auto">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/80 tracking-[0.01em]">
            <span>Menswear</span>
            <span aria-hidden="true">·</span>
            <span>Womenswear</span>
            <span aria-hidden="true">·</span>
            <span>Footwear &amp; Accessories</span>
            <span aria-hidden="true">·</span>
            <span>Custom Studio</span>
          </div>

          <h1 className="font-space font-bold text-3xl xl:text-[2.6rem] text-white tracking-tight leading-[1.12] [text-wrap:balance]">
            Sign in to explore curated everyday silhouettes.
          </h1>

          <p className="text-sm xl:text-base text-white/80 leading-relaxed tracking-[0.01em] max-w-[54ch]">
            Create your free PatanaKart account or sign in with your email and password to browse
            seasonal drops, save wishlists, use the visual style finder, and track orders across
            India.
          </p>

          <div className="pt-4 border-t border-white/15 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/75 tracking-[0.01em]">
            <span>240 GSM Combed Cotton</span>
            <span aria-hidden="true">·</span>
            <span>Visual Outfit Matching</span>
            <span aria-hidden="true">·</span>
            <span>Express Pan-India Delivery</span>
          </div>
        </div>
      </aside>

      {/* Right Authentication Portal Column */}
      <section className="w-full lg:w-[48%] xl:w-[45%] flex flex-col justify-between px-5 sm:px-10 lg:px-12 xl:px-16 py-6 sm:py-8 min-h-screen">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          {/* Mobile / Tablet Brand Header */}
          <div className="flex lg:hidden items-center gap-2.5">
            <BrandLogo variant="badge" size="md" />
            <div className="flex flex-col leading-none">
              <span className="font-space font-extrabold text-lg tracking-tight text-[#111111]">
                Patana<span className="text-[#65A30D]">Kart</span>
              </span>
              <span className="text-[10px] font-medium text-[#52525B] mt-0.5">
                Fashion For Every You
              </span>
            </div>
          </div>

          {/* Desktop Portal Label */}
          <span className="hidden lg:inline text-xs font-medium text-[#52525B]">
            PatanaKart Customer Portal
          </span>

          <Link
            to="/owner/login"
            className="text-xs font-medium text-[#4D7C0F] hover:text-[#365314] hover:underline inline-flex items-center gap-1.5 py-2 transition-colors"
          >
            <ShieldCheck size={14} />
            <span>Admin Portal</span>
          </Link>
        </div>

        {/* Main Form Surface */}
        <div className="w-full max-w-[440px] mx-auto my-auto py-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="bg-white border border-[#E5E4DF] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
          >
            {/* Dynamic Heading */}
            <div className="space-y-1.5">
              <h2 className="font-space font-bold text-2xl tracking-tight text-[#18181B] [text-wrap:balance]">
                {mode === 'signin' && 'Welcome to PatanaKart'}
                {mode === 'register' && 'Create your account'}
                {mode === 'forgot' && 'Reset your password'}
              </h2>
              <p className="text-xs sm:text-sm text-[#52525B] leading-relaxed">
                {mode === 'signin' &&
                  'Sign in with your email address and password to browse the store.'}
                {mode === 'register' &&
                  'Sign up with your email and set a password for instant storefront access.'}
                {mode === 'forgot' &&
                  'Enter the email linked to your account and we will send reset instructions.'}
              </p>
            </div>

            {/* Segmented Mode Switcher */}
            {mode !== 'forgot' && (
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="grid grid-cols-2 bg-[#F3F2EE] p-1 rounded-xl text-xs font-space font-semibold"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  onClick={() => switchMode('signin')}
                  className={`min-h-[42px] px-4 py-2 transition-all cursor-pointer rounded-lg ${
                    mode === 'signin'
                      ? 'bg-white text-[#18181B] shadow-2xs'
                      : 'text-[#64748B] hover:text-[#18181B]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => switchMode('register')}
                  className={`min-h-[42px] px-4 py-2 transition-all cursor-pointer rounded-lg ${
                    mode === 'register'
                      ? 'bg-white text-[#18181B] shadow-2xs'
                      : 'text-[#64748B] hover:text-[#18181B]'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Status / Error Banner */}
            <AnimatePresence mode="wait">
              {banner && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`p-3.5 text-xs font-medium flex items-start gap-2.5 border rounded-xl leading-relaxed ${
                    banner.type === 'success'
                      ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {banner.type === 'success' ? (
                    <CheckCircle2 size={16} className="shrink-0 text-[#16A34A] mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
                  )}
                  <span>{banner.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sign In Form */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="signin-email"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="signin-password"
                      className="block text-xs font-semibold text-[#18181B]"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-[#4D7C0F] hover:text-[#365314] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 pr-11 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 top-1 w-9 h-9 flex items-center justify-center text-[#64748B] hover:text-[#18181B] rounded-md cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] py-3 px-5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 rounded-lg transition-colors"
                >
                  {submitting ? (
                    <span>Signing In...</span>
                  ) : (
                    <>
                      <span>Sign In to PatanaKart</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-[#52525B] pt-1">
                  New to PatanaKart?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-semibold text-[#4D7C0F] hover:underline cursor-pointer"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            )}

            {/* Sign Up (Create Account) Form */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-name"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <User size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-phone"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Mobile Number{' '}
                    <span className="font-normal text-[#71717A]">(For SMS &amp; Order Alerts)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="signup-phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <Phone size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                  </div>
                  <p className="text-[11px] text-[#64748B]">
                    Receive instant bag, wishlist, and order updates on your email and registered
                    number.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Create Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 pr-11 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 top-1 w-9 h-9 flex items-center justify-center text-[#64748B] hover:text-[#18181B] rounded-md cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {password && (
                    <div className="pt-1 space-y-1">
                      <div className="flex justify-between items-center text-[11px] text-[#64748B]">
                        <span>Password strength</span>
                        <span className="font-semibold text-[#18181B]">{strength.label}</span>
                      </div>
                      <div className="w-full bg-[#E5E4DF] h-1.5 overflow-hidden rounded-full">
                        <div
                          className={`h-full transition-all duration-300 ${strength.color}`}
                          style={{ width: `${strength.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="signup-confirm-password"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 pr-11 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-1.5 top-1 w-9 h-9 flex items-center justify-center text-[#64748B] hover:text-[#18181B] rounded-md cursor-pointer"
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] py-3 px-5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 rounded-lg transition-colors"
                >
                  {submitting ? (
                    <span>Creating Account...</span>
                  ) : (
                    <>
                      <span>Create Account &amp; Start Shopping</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-[#52525B] pt-1">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="font-semibold text-[#4D7C0F] hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* Forgot Password Form */}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold text-[#18181B]"
                  >
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full min-h-[44px] bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3.5 py-2.5 pl-10 text-sm text-[#18181B] placeholder-[#94A3B8] focus:bg-white focus:border-[#65A30D] focus:ring-2 focus:ring-[#65A30D]/15 focus:outline-none transition-colors"
                    />
                    <Mail size={16} className="absolute left-3.5 top-3.5 text-[#64748B]" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] py-3 px-5 bg-[#B8F130] hover:bg-[#AAE422] text-[#111111] font-space font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 rounded-lg transition-colors"
                >
                  {submitting ? 'Sending Reset Link...' : 'Send Password Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full py-2 text-xs font-semibold text-[#52525B] hover:text-[#18181B] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </button>
              </form>
            )}
          </motion.div>
        </div>

        {/* Quiet Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#71717A] pt-2 border-t border-[#E5E4DF]/70">
          <span>&copy; {new Date().getFullYear()} PatanaKart</span>
          <Link
            to="/owner/login"
            className="text-[#52525B] hover:text-[#4D7C0F] transition-colors"
          >
            Store Owner / Admin Access
          </Link>
        </footer>
      </section>
    </div>
  );
};
