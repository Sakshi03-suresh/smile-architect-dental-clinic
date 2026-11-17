import React, { useState } from 'react';
import { Phone, MapPin, Clock, MessageCircle, CheckCircle2 } from 'lucide-react';
import { useClinic } from '../lib/clinicContext.tsx';
import { MapEmbed } from '../components/MapEmbed.tsx';
import { buildWhatsAppLink, isValidIndianPhone, isValidOptionalEmail } from '../utils/validation.ts';

export function ContactPage() {
  const { clinic } = useClinic();
  const s = clinic?.settings;
  const clinicName = s?.clinic_name || 'Smile Architect Dental Clinic';
  const phone = s?.phone || '+91 90368 27916';
  const address =
    s?.address ||
    '850/S, 25th Cross Road, Manchegowdana Koppalu, Sankranthi Circle, Hebbal 2nd Stage, Ilavala Hobli, Mysuru, Karnataka, India – 570017';
  const whatsappUrl = buildWhatsAppLink(
    s?.whatsapp || phone,
    `Hello ${clinicName}, I have an enquiry.`
  );

  const [name, setName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Please enter your name.';
    if (!isValidIndianPhone(enquiryPhone)) errs.phone = 'Enter a valid 10-digit Indian phone number.';
    if (!isValidOptionalEmail(email)) errs.email = 'Enter a valid email address or leave blank.';
    if (message.trim().length < 5) errs.message = 'Please enter your enquiry message.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmittedMsg(null);
    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: enquiryPhone.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send enquiry.');
      setSubmittedMsg(data.message);
      setName('');
      setEnquiryPhone('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to send enquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white">
      <section className="bg-[#F7FAFA] border-b border-slate-100 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl space-y-2">
          <p className="text-sm font-medium text-[#087F8C]">Get In Touch</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B] tracking-tight">
            Contact Smile Architect Dental Clinic
          </h1>
          <p className="text-base text-[#71818A]">
            Reach us by phone, WhatsApp, or submit an enquiry below and our clinic desk will get back to you.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Details + Map */}
          <div className="lg:col-span-6 space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F7FAFA] border border-slate-200 space-y-5">
              <div className="flex items-start gap-3.5">
                <MapPin className="w-5 h-5 text-[#087F8C] shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <h2 className="font-heading text-base font-semibold text-[#18323B]">
                    Clinic Address
                  </h2>
                  <p className="text-sm text-[#71818A] leading-relaxed mt-1">{address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 pt-4 border-t border-slate-200/80">
                <Phone className="w-5 h-5 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="font-heading text-base font-semibold text-[#18323B]">
                    Phone & WhatsApp
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <a
                      href={`tel:${phone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white text-sm font-heading font-medium tabular-nums"
                    >
                      <Phone className="w-4 h-4" aria-hidden="true" />
                      Call {phone}
                    </a>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#087F8C]/30 bg-white hover:bg-[#DFF5F3]/50 text-[#087F8C] text-sm font-heading font-medium"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                      WhatsApp Chat
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3.5 pt-4 border-t border-slate-200/80">
                <Clock className="w-5 h-5 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-sm space-y-1 tabular-nums">
                  <h2 className="font-heading text-base font-semibold text-[#18323B]">
                    Working Hours (IST)
                  </h2>
                  <p className="text-[#71818A]">
                    <strong className="text-[#18323B]">Monday – Saturday:</strong> 10:00 AM – 1:30 PM & 5:00 PM – 8:30 PM
                  </p>
                  <p className="text-[#71818A]">
                    <strong className="text-[#18323B]">Sunday:</strong> 10:00 AM – 1:30 PM
                  </p>
                </div>
              </div>
            </div>

            <MapEmbed clinicName={clinicName} address={address} googleMapsUrl={s?.google_maps_url} />
          </div>

          {/* Enquiry Form */}
          <div className="lg:col-span-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 space-y-6">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-[#18323B]">
                  Send an Enquiry
                </h2>
                <p className="text-sm text-[#71818A] mt-1">
                  Have a question about a treatment or clinic directions? Send us a message.
                </p>
              </div>

              {submittedMsg && (
                <div
                  role="status"
                  className="p-4 rounded-xl bg-[#DFF5F3] border border-[#087F8C]/30 text-sm text-[#18323B] flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{submittedMsg}</span>
                </div>
              )}

              {submitError && (
                <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-[#18323B] mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                  />
                  {errors.name && <p className="text-xs text-red-700 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="contact-phone" className="block text-sm font-medium text-[#18323B] mb-1.5">
                    Phone Number *
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    required
                    value={enquiryPhone}
                    onChange={(e) => setEnquiryPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                  />
                  {errors.phone && <p className="text-xs text-red-700 mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-[#18323B] mb-1.5">
                    Email Address (Optional)
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                  />
                  {errors.email && <p className="text-xs text-red-700 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-[#18323B] mb-1.5">
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help you?"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                  />
                  {errors.message && <p className="text-xs text-red-700 mt-1">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Sending Enquiry...' : 'Submit Enquiry'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
