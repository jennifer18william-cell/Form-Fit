import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { ShieldCheck, KeyRound, Eye, EyeOff, ArrowRight, Mail, AlertCircle } from 'lucide-react';

export const OwnerLogin: React.FC = () => {
  const { authenticateOwner, isOwner } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@formandfit.in');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOwner) {
      navigate('/owner/dashboard', { replace: true });
    }
  }, [isOwner, navigate]);

  const handleOwnerAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !passcode.trim()) {
      setErrorMsg('Please enter both Admin Email and Passcode.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const res = await authenticateOwner(email.trim(), passcode.trim());
    setLoading(false);

    if (res.success) {
      navigate('/owner/dashboard');
    } else {
      setErrorMsg(res.message || 'Access Denied: Invalid Admin Credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#18181B] font-sans flex items-center justify-center p-4 selection:bg-[#DBEAFE] selection:text-[#1E3A8A]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="max-w-md w-full bg-white border border-[#E5E4DF] rounded-2xl p-8 shadow-sm space-y-6 relative overflow-hidden"
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] text-[#1D4ED8] flex items-center justify-center">
            <ShieldCheck size={28} />
          </div>
          <p className="text-xs font-medium text-[#64748B]">
            Form &amp; Fit Store Portal
          </p>
          <h1 className="font-space font-bold text-2xl tracking-tight text-[#18181B]">
            Admin Sign In
          </h1>
          <p className="text-xs text-[#52525B] font-sans leading-relaxed">
            Sign in with your approved administrator email and passcode to manage products, inventory, and orders.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#991B1B] text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-[#DC2626]" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleOwnerAccess} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#18181B]">
              Admin Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="admin@formandfit.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2.5 pl-9 text-sm text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none transition-colors"
              />
              <Mail size={16} className="absolute left-3 top-3 text-[#64748B]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#18181B]">
              Admin Passcode
            </label>
            <div className="relative">
              <input
                type={showPasscode ? 'text' : 'password'}
                required
                placeholder="Enter admin passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-lg px-3 py-2.5 pl-9 pr-10 text-sm text-[#18181B] focus:bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/15 focus:outline-none transition-colors"
              />
              <KeyRound size={16} className="absolute left-3 top-3 text-[#64748B]" />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3 top-3 text-[#64748B] hover:text-[#18181B] cursor-pointer"
                aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg font-space font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? (
              <span>Signing In...</span>
            ) : (
              <>
                Sign In to Admin Panel <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-[#E5E4DF] text-center">
          <Link
            to="/"
            className="text-xs font-medium text-[#52525B] hover:text-[#1D4ED8] transition-colors inline-block"
          >
            ← Return to Customer Storefront
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
