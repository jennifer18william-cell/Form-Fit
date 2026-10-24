import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  ShieldCheck,
} from 'lucide-react';

export const CustomerAuth: React.FC = () => {
  const { signInWithPassword, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'signin';
  const [mode, setMode] = useState<'signin' | 'register'>(initialMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (user) {
    navigate('/account');
  }

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score: 60, label: 'Medium', color: 'bg-amber-500' };
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

    setLoading(true);
    const res = await signInWithPassword(email.trim(), password);
    setLoading(false);

    if (res.success) {
      setBanner({ type: 'success', message: 'Welcome back! Redirecting to your account...' });
      setTimeout(() => navigate('/account'), 800);
    } else {
      setBanner({ type: 'error', message: res.message || 'Invalid email or password.' });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setBanner({ type: 'error', message: 'Please fill in all required registration fields.' });
      return;
    }

    if (password.length < 6) {
      setBanner({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (password !== confirmPassword) {
      setBanner({ type: 'error', message: 'Passwords do not match. Please verify.' });
      return;
    }

    setLoading(true);
    const res = await signUp(email.trim(), password, fullName.trim(), phone.trim());
    setLoading(false);

    if (res.success) {
      setBanner({
        type: 'success',
        message: res.message || 'Account created successfully! Redirecting...',
      });
      setTimeout(() => navigate('/account'), 1000);
    } else {
      setBanner({ type: 'error', message: res.message || 'Registration failed. Please try again.' });
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 px-4 font-sans text-[#18181B]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="bg-white border border-[#E5E4DF] p-8 shadow-sm space-y-6 rounded-2xl"
      >
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <Link to="/" className="inline-block">
            <span className="font-space font-bold text-2xl tracking-tight text-[#18181B] hover:text-[#1D4ED8] transition-colors">
              Form &amp; Fit
            </span>
          </Link>
          <h2 className="font-space font-semibold text-base text-[#52525B]">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your Form & Fit account'}
          </h2>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="grid grid-cols-2 bg-[#F3F2EE] p-1 rounded-lg text-xs font-space font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setBanner(null);
            }}
            className={`py-2 transition-colors cursor-pointer rounded-md ${
              mode === 'signin'
                ? 'bg-white text-[#18181B] shadow-2xs'
                : 'text-[#64748B] hover:text-[#18181B]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setBanner(null);
            }}
            className={`py-2 transition-colors cursor-pointer rounded-md ${
              mode === 'register'
                ? 'bg-white text-[#18181B] shadow-2xs'
                : 'text-[#64748B] hover:text-[#18181B]'
            }`}
          >
            Register
          </button>
        </div>

        {/* Feedback Alert Banner */}
        <AnimatePresence mode="wait">
          {banner && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`p-3 text-xs font-medium flex items-center gap-2 border rounded-lg ${
                banner.type === 'success'
                  ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {banner.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 text-[#16A34A]" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-red-600" />
              )}
              <span>{banner.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign In Form */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#52525B]">Email Address *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glow-input w-full p-2.5 pl-9 text-xs rounded-md"
                />
                <Mail size={15} className="absolute left-3 top-3 text-[#94A3B8]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#52525B]">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glow-input w-full p-2.5 pl-9 pr-10 text-xs rounded-md"
                />
                <Lock size={15} className="absolute left-3 top-3 text-[#94A3B8]" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1D4ED8] text-white font-space font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 rounded-lg hover:bg-[#1E40AF] transition-colors"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  Sign In to Account <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Registration Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#52525B]">Full Name *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="glow-input w-full p-2.5 pl-9 text-xs rounded-md"
                />
                <User size={15} className="absolute left-3 top-3 text-[#94A3B8]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#52525B]">Email Address *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glow-input w-full p-2.5 pl-9 text-xs rounded-md"
                />
                <Mail size={15} className="absolute left-3 top-3 text-[#94A3B8]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#52525B]">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="glow-input w-full p-2.5 pl-9 text-xs rounded-md"
                />
                <Phone size={15} className="absolute left-3 top-3 text-[#94A3B8]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#52525B]">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="glow-input w-full p-2.5 pl-9 pr-10 text-xs rounded-md"
                />
                <Lock size={15} className="absolute left-3 top-3 text-[#94A3B8]" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {password && (
                <div className="pt-1.5 space-y-1">
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

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#52525B]">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter your password..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="glow-input w-full p-2.5 pl-9 pr-10 text-xs rounded-md"
                />
                <Lock size={15} className="absolute left-3 top-3 text-[#94A3B8]" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1D4ED8] text-white font-space font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 rounded-lg hover:bg-[#1E40AF] transition-colors"
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  Create Account <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Admin Switcher Link */}
        <div className="pt-4 border-t border-[#E5E4DF] text-center">
          <Link
            to="/owner/login"
            className="text-xs font-medium text-[#1D4ED8] hover:underline flex items-center justify-center gap-1.5"
          >
            <ShieldCheck size={14} /> Store Owner / Admin Portal Access
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
