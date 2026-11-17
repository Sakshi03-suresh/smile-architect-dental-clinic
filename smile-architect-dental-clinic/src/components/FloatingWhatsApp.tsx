import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useClinic } from '../lib/clinicContext.tsx';
import { useRouter } from '../lib/router.tsx';
import { buildWhatsAppLink } from '../utils/validation.ts';

export function FloatingWhatsApp() {
  const { clinic } = useClinic();
  const { pathname } = useRouter();

  // Keep admin dashboard free of patient chat widget
  if (pathname.startsWith('/admin')) return null;

  const phone = clinic?.settings?.whatsapp || clinic?.settings?.phone || '+91 90368 27916';
  const clinicName = clinic?.settings?.clinic_name || 'Smile Architect Dental Clinic';
  const href = buildWhatsAppLink(
    phone,
    `Hello ${clinicName}, I would like to book or enquire about a dental appointment.`
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp with Smile Architect Dental Clinic"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium shadow-lg transition-transform duration-150 hover:-translate-y-0.5"
    >
      <MessageCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline whitespace-nowrap">WhatsApp Clinic</span>
    </a>
  );
}
