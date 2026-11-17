import React from 'react';
import { Phone, MapPin, Clock, MessageCircle } from 'lucide-react';
import { Link } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';
import { ClinicLogoMark } from './ClinicBrand.tsx';
import { buildWhatsAppLink } from '../utils/validation.ts';

export function Footer() {
  const { clinic } = useClinic();
  const settings = clinic?.settings;
  const clinicName = settings?.clinic_name || 'Smile Architect Dental Clinic';
  const address =
    settings?.address ||
    '850/S, 25th Cross Road, Manchegowdana Koppalu, Sankranthi Circle, Hebbal 2nd Stage, Ilavala Hobli, Mysuru, Karnataka, India – 570017';
  const phone = settings?.phone || '+91 90368 27916';
  const whatsappUrl = buildWhatsAppLink(
    settings?.whatsapp || phone,
    `Hello ${clinicName}, I would like to enquire about a dental consultation.`
  );
  const featuredServices = (clinic?.services || []).slice(0, 6);

  return (
    <footer className="bg-[#18323B] text-white border-t border-[#087F8C]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand & Contact */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ClinicLogoMark className="w-9 h-9 shrink-0" />
              <div>
                <p className="font-heading text-base font-semibold text-white">{clinicName}</p>
                <p className="text-xs text-[#DFF5F3]/80">
                  {settings?.clinic_category || 'Multi-Speciality Dental Clinic'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed">
              <MapPin className="w-4 h-4 text-[#C8A96B] shrink-0 mt-1" aria-hidden="true" />
              <span>{address}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-4 h-4 text-[#C8A96B] shrink-0" aria-hidden="true" />
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="text-white hover:text-[#DFF5F3] font-medium tabular-nums"
              >
                {phone}
              </a>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white text-xs font-heading font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              WhatsApp Clinic
            </a>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-heading text-sm font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/doctors" className="hover:text-white transition-colors">
                  Our Doctors
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-white transition-colors">
                  Dental Services
                </Link>
              </li>
              <li>
                <Link to="/book" className="hover:text-white transition-colors">
                  Book Appointment
                </Link>
              </li>
              <li>
                <Link to="/gallery" className="hover:text-white transition-colors">
                  Clinic Gallery
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-heading text-sm font-semibold text-white mb-4">Dental Services</h3>
            <ul className="space-y-2.5 text-sm text-slate-300">
              {featuredServices.map((svc) => (
                <li key={svc.id}>
                  <Link to={`/services/${svc.slug}`} className="hover:text-white transition-colors">
                    {svc.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/services" className="text-[#DFF5F3] hover:underline font-medium">
                  View all services
                </Link>
              </li>
            </ul>
          </div>

          {/* Working Hours & Verified Social Links */}
          <div className="space-y-4">
            <h3 className="font-heading text-sm font-semibold text-white">Clinic Hours (IST)</h3>
            <div className="flex items-start gap-2.5 text-sm text-slate-300">
              <Clock className="w-4 h-4 text-[#C8A96B] shrink-0 mt-1" aria-hidden="true" />
              <div className="space-y-1.5 tabular-nums">
                <p>
                  <span className="text-white font-medium">Mon – Sat:</span>
                  <br />
                  10:00 AM – 1:30 PM
                  <br />
                  5:00 PM – 8:30 PM
                </p>
                <p>
                  <span className="text-white font-medium">Sunday:</span>
                  <br />
                  10:00 AM – 1:30 PM
                </p>
              </div>
            </div>

            {(settings?.social_instagram || settings?.social_facebook) && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-medium text-slate-400">Connect With Us</p>
                <div className="flex items-center gap-4 text-sm">
                  {settings.social_instagram && (
                    <a
                      href={settings.social_instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#DFF5F3] hover:underline"
                    >
                      Instagram
                    </a>
                  )}
                  {settings.social_facebook && (
                    <a
                      href={settings.social_facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#DFF5F3] hover:underline"
                    >
                      Facebook
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            © {new Date().getFullYear()} {clinicName}. Hebbal 2nd Stage, Mysuru.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms & Cancellation Policy
            </Link>
            <Link to="/admin" className="hover:text-white transition-colors">
              Admin Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
