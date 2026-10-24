import React, { useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { Database, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const SupabaseBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const configured = isSupabaseConfigured();

  if (dismissed) return null;

  return (
    <>
      <div
        className={`text-xs py-1.5 px-4 flex items-center justify-between border-b transition-colors ${
          configured
            ? 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]'
            : 'bg-[#FAF9F6] text-[#52525B] border-[#E5E4DF]'
        }`}
      >
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          <Database size={13} className="shrink-0" />
          <span className="font-medium truncate">
            {configured ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-[#16A34A]" />
                Connected to Live Supabase Backend &amp; Storage
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <AlertCircle size={13} className="text-[#4D7C0F]" />
                Browser-Database Mode Active · Connect Supabase for Cloud PostgreSQL &amp; Storage
              </span>
            )}
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="underline underline-offset-2 ml-2 hover:text-[#4D7C0F] font-semibold cursor-pointer shrink-0 whitespace-nowrap"
          >
            {configured ? 'Database Info' : 'Setup Supabase'}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-[#64748B] hover:text-[#18181B] cursor-pointer ml-2"
          aria-label="Dismiss banner"
        >
          <X size={14} />
        </button>
      </div>

      {/* Instructions Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E4DF] rounded-lg max-w-2xl w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto text-[#18181B]">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 text-[#64748B] hover:text-[#18181B] hover:bg-[#F3F2EE] rounded-full cursor-pointer"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#F4FBE1] border border-[#BEF264] text-[#3F6212] flex items-center justify-center">
                <Database size={22} />
              </div>
              <div>
                <h3 className="font-space font-bold text-lg tracking-tight text-[#18181B]">
                  Supabase Integration
                </h3>
                <p className="text-xs text-[#64748B]">
                  Form &amp; Fit Backend Configuration Status
                </p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-[#18181B]">
              <div className="p-4 bg-[#FAF9F6] border border-[#E5E4DF] rounded-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-xs text-[#64748B]">Current Mode</span>
                  <span
                    className={`text-xs font-semibold ${
                      configured ? 'text-[#15803D]' : 'text-[#4D7C0F]'
                    }`}
                  >
                    {configured ? 'Live Connected' : 'Local Testing Mode'}
                  </span>
                </div>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  {configured
                    ? 'All products, storage uploads, orders, and authentication are syncing directly to your Supabase PostgreSQL cloud database.'
                    : 'Currently saving products and orders locally in your browser so you can test immediately. Add your keys below to enable cloud sync.'}
                </p>
              </div>

              <div>
                <h4 className="font-space font-semibold text-xs text-[#18181B] mb-2">
                  To connect your Supabase project:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed text-[#52525B]">
                  <li>
                    Run <code className="bg-[#F3F2EE] border border-[#E5E4DF] px-1.5 py-0.5 rounded font-mono text-[#18181B]">supabase/schema.sql</code> in your Supabase SQL Editor.
                  </li>
                  <li>
                    Create a public storage bucket named <code className="bg-[#F3F2EE] border border-[#E5E4DF] px-1.5 py-0.5 rounded font-mono text-[#18181B]">product-images</code>.
                  </li>
                  <li>
                    Set your environment variables in <code className="bg-[#F3F2EE] border border-[#E5E4DF] px-1.5 py-0.5 rounded font-mono text-[#18181B]">.env</code>:
                  </li>
                </ol>
                <div className="mt-2.5 bg-[#FAF9F6] border border-[#E5E4DF] text-[#18181B] p-3 rounded-md font-mono text-xs overflow-x-auto">
                  VITE_SUPABASE_URL="https://your-project.supabase.co"
                  <br />
                  VITE_SUPABASE_ANON_KEY="your-anon-public-key"
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-[#B8F130] text-[#111111] font-space font-bold text-xs rounded-md hover:bg-[#AAE422] transition-colors cursor-pointer"
                >
                  Close &amp; Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
