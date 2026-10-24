import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Mail, Phone, MapPin, CheckCircle2 } from 'lucide-react';

export const AboutPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 font-sans text-[#18181B]">
    <div className="border-b border-[#E5E4DF] pb-4">
      <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#4D7C0F]">
        Brand Heritage
      </span>
      <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
        About Form &amp; Fit
      </h1>
    </div>
    <div className="bg-white border border-[#E5E4DF] rounded-xl p-8 space-y-4 text-sm text-[#52525B] leading-relaxed">
      <p className="text-base font-space font-semibold text-[#18181B]">
        Form &amp; Fit was founded on a simple principle: clothing should adapt to your body and lifestyle, not the other way around.
      </p>
      <p>
        As an independent, owner-managed Indian fashion brand, we bridge the gap between structured contemporary tailoring, heavyweight streetwear cottons, and interactive custom apparel.
      </p>
      <p>
        Every fabric composition—from 240 GSM combed cottons to pre-shrunk fleece blends—is selected and quality-checked by our store owner before reaching your doorstep.
      </p>
    </div>
  </div>
);

export const ContactPage: React.FC = () => {
  const { sendContactMessage, storeSettings } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim() && message.trim()) {
      sendContactMessage({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmitted(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 font-sans text-[#18181B]">
      <div className="border-b border-[#E5E4DF] pb-4">
        <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#4D7C0F]">
          Customer Support
        </span>
        <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
          Contact Form &amp; Fit
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 space-y-4 text-xs">
          <h3 className="font-space font-bold text-sm border-b border-[#E5E4DF] pb-2 text-[#18181B]">
            Store Assistance
          </h3>
          <p className="text-[#52525B] leading-relaxed">
            Have questions about an existing order, sizing, or custom print specs? Reach out to our store team directly.
          </p>
          <div className="space-y-2.5 pt-2 text-[#18181B]">
            <p className="flex items-center gap-2 font-medium">
              <Mail size={14} className="text-[#4D7C0F]" /> {storeSettings.contact_email}
            </p>
            <p className="flex items-center gap-2 font-medium">
              <Phone size={14} className="text-[#4D7C0F]" /> {storeSettings.contact_phone}
            </p>
            <p className="flex items-center gap-2 text-[#64748B]">
              <MapPin size={14} className="text-[#4D7C0F]" /> Mumbai, India
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E5E4DF] rounded-xl p-6">
          {submitted ? (
            <div className="p-6 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-center space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-[#16A34A]" />
              <h4 className="font-space font-bold text-sm text-[#166534]">
                Message Sent Successfully
              </h4>
              <p className="text-xs text-[#15803D]">
                Our store team will respond to your query within 24 hours.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-xs font-space font-semibold text-[#4D7C0F] underline cursor-pointer"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <input
                type="text"
                required
                placeholder="Your Full Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-md p-2.5 focus:outline-none focus:border-[#65A30D]"
              />
              <input
                type="email"
                required
                placeholder="Your Email Address *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-md p-2.5 focus:outline-none focus:border-[#65A30D]"
              />
              <input
                type="text"
                placeholder="Order Number / Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-md p-2.5 focus:outline-none focus:border-[#65A30D]"
              />
              <textarea
                required
                rows={4}
                placeholder="How can we assist you today? *"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#D6D5CE] rounded-md p-2.5 focus:outline-none focus:border-[#65A30D]"
              />
              <button
                type="submit"
                className="w-full py-3 bg-[#B8F130] text-[#111111] font-space font-bold text-xs rounded-md hover:bg-[#AAE422] transition-colors cursor-pointer"
              >
                Send Support Message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export const SizeGuidePage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 font-sans text-[#18181B]">
    <div className="border-b border-[#E5E4DF] pb-4">
      <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#4D7C0F]">
        Sizing Reference
      </span>
      <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
        Size &amp; Fit Measurement Guide
      </h1>
    </div>

    <div className="bg-white border border-[#E5E4DF] rounded-xl p-6 overflow-x-auto space-y-4">
      <h3 className="font-space font-bold text-sm text-[#18181B]">
        T-Shirts &amp; Sweatshirts Measurement Table (Inches)
      </h3>
      <table className="w-full text-xs text-left border-collapse tabular-nums">
        <thead>
          <tr className="bg-[#F3F2EE] text-[#475569] font-space font-semibold border-b border-[#E5E4DF]">
            <th className="p-3">Size</th>
            <th className="p-3">Chest (Inches)</th>
            <th className="p-3">Length (Inches)</th>
            <th className="p-3">Shoulder Width</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E4DF]">
          <tr>
            <td className="p-3 font-semibold text-[#18181B]">Small (S)</td>
            <td className="p-3">38"</td>
            <td className="p-3">27"</td>
            <td className="p-3">17.5"</td>
          </tr>
          <tr>
            <td className="p-3 font-semibold text-[#18181B]">Medium (M)</td>
            <td className="p-3">40"</td>
            <td className="p-3">28"</td>
            <td className="p-3">18.5"</td>
          </tr>
          <tr>
            <td className="p-3 font-semibold text-[#18181B]">Large (L)</td>
            <td className="p-3">42"</td>
            <td className="p-3">29"</td>
            <td className="p-3">19.5"</td>
          </tr>
          <tr>
            <td className="p-3 font-semibold text-[#18181B]">X-Large (XL)</td>
            <td className="p-3">44"</td>
            <td className="p-3">30"</td>
            <td className="p-3">20.5"</td>
          </tr>
          <tr>
            <td className="p-3 font-semibold text-[#18181B]">XX-Large (XXL)</td>
            <td className="p-3">46"</td>
            <td className="p-3">31"</td>
            <td className="p-3">21.5"</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

export const PolicyPage: React.FC<{ title: string; subtitle: string; content: string }> = ({
  title,
  subtitle,
  content,
}) => (
  <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 font-sans text-[#18181B]">
    <div className="border-b border-[#E5E4DF] pb-4">
      <span className="text-xs font-space font-semibold uppercase tracking-wider text-[#4D7C0F]">
        {subtitle}
      </span>
      <h1 className="font-space font-bold text-3xl tracking-tight text-[#18181B] mt-0.5">
        {title}
      </h1>
    </div>
    <div className="bg-white border border-[#E5E4DF] rounded-xl p-8 text-sm text-[#52525B] leading-relaxed space-y-4">
      <p>{content}</p>
    </div>
  </div>
);
