import React from 'react';
import { Link } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';

export function PrivacyPolicyPage() {
  const { clinic } = useClinic();
  const s = clinic?.settings;
  const clinicName = s?.clinic_name || 'Smile Architect Dental Clinic';

  return (
    <div className="bg-white py-14 sm:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <p className="text-sm font-medium text-[#087F8C]">Patient Information Protection</p>
        <h1 className="font-heading text-3xl font-semibold text-[#18323B]">Privacy Policy</h1>
        <div className="space-y-4 text-sm sm:text-base text-[#71818A] leading-relaxed">
          <p>
            {s?.privacy_policy ||
              `${clinicName} collects only the contact and appointment scheduling information you voluntarily provide (name, mobile number, optional email, and brief appointment notes) solely for coordinating your dental consultation and clinic communication.`}
          </p>
          <h2 className="font-heading text-lg font-semibold text-[#18323B] pt-2">
            Information We Collect
          </h2>
          <p>
            We intentionally avoid collecting sensitive medical histories through public web forms. Any clinical history or diagnostic records are discussed privately during your in-clinic consultation.
          </p>
          <h2 className="font-heading text-lg font-semibold text-[#18323B] pt-2">
            Data Confidentiality
          </h2>
          <p>
            Patient contact details are accessible only to authorized clinic staff and administrators for appointment confirmations, rescheduling, and answering enquiries. Patient details are never sold, shared for marketing, or displayed publicly.
          </p>
          <p>
            For questions or updates regarding your appointment details, call{' '}
            <a href="tel:+919036827916" className="text-[#087F8C] underline tabular-nums">
              {s?.phone || '+91 90368 27916'}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  const { clinic } = useClinic();
  const s = clinic?.settings;

  return (
    <div className="bg-white py-14 sm:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <p className="text-sm font-medium text-[#087F8C]">Clinic Guidelines</p>
        <h1 className="font-heading text-3xl font-semibold text-[#18323B]">
          Terms & Appointment Cancellation Policy
        </h1>
        <div className="space-y-4 text-sm sm:text-base text-[#71818A] leading-relaxed">
          <h2 className="font-heading text-lg font-semibold text-[#18323B] pt-2">
            Appointment Confirmation
          </h2>
          <p>
            Online bookings reserve your requested slot and receive a unique booking reference. Clinic staff confirm bookings during working hours and may reach out by phone or WhatsApp if a schedule adjustment is required.
          </p>
          <h2 className="font-heading text-lg font-semibold text-[#18323B] pt-2">
            Cancellation & Rescheduling Policy
          </h2>
          <p>
            {s?.cancellation_policy ||
              'If you need to reschedule or cancel your appointment, please inform the clinic at least 4 hours prior to your scheduled visit by calling +91 90368 27916 or messaging us on WhatsApp so another patient can be accommodated.'}
          </p>
          <h2 className="font-heading text-lg font-semibold text-[#18323B] pt-2">
            Clinical Advice Notice
          </h2>
          <p>
            Service descriptions on this website are for general patient education and do not replace an in-person dental examination and diagnostic evaluation.
          </p>
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="bg-white py-24 px-4 text-center space-y-5">
      <p className="font-mono text-sm text-[#087F8C] tabular-nums">404</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B]">
        Page Not Found
      </h1>
      <p className="text-sm sm:text-base text-[#71818A] max-w-md mx-auto">
        The page you are looking for may have moved or does not exist.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link
          to="/"
          className="px-5 py-2.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium"
        >
          Return Home
        </Link>
        <Link
          to="/book"
          className="px-5 py-2.5 rounded-lg border border-slate-300 hover:border-[#087F8C] text-[#18323B] font-heading text-sm font-medium"
        >
          Book Appointment
        </Link>
      </div>
    </div>
  );
}
