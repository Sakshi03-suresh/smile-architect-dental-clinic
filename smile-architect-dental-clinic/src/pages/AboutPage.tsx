import React from 'react';
import { ShieldCheck, HeartHandshake, Sparkles, CheckCircle2, Calendar } from 'lucide-react';
import { Link } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';
import { ClinicImage } from '../components/ClinicBrand.tsx';

export function AboutPage() {
  const { clinic } = useClinic();
  const s = clinic?.settings;

  const overview =
    s?.about_overview ||
    'Smile Architect Dental Clinic is a multi-speciality dental clinic located near Sankranthi Circle in Hebbal 2nd Stage, Mysuru. We bring together specialist surgical, implant, pediatric, restorative, and preventive dentistry in a calm, hygiene-conscious clinical environment.';
  const philosophy =
    s?.about_philosophy ||
    'Every treatment begins with listening carefully, explaining diagnostic findings clearly, and recommending care tailored to each patient’s comfort and long-term oral health.';
  const mission =
    s?.about_mission ||
    'To deliver attentive, ethical, and modern multi-speciality dental care for adults, seniors, and children across Mysuru.';
  const vision =
    s?.about_vision ||
    'To be a trusted neighbourhood dental practice in Hebbal, Mysuru where patients feel informed, respected, and genuinely comfortable at every visit.';

  return (
    <div className="bg-white">
      <section className="bg-[#F7FAFA] border-b border-slate-100 py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-sm font-medium text-[#087F8C]">About Smile Architect Dental Clinic</p>
              <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B] tracking-tight">
                Thoughtful Multi-Speciality Dental Care in Hebbal, Mysuru
              </h1>
              <p className="text-base text-[#71818A] leading-relaxed">{overview}</p>
            </div>
            <div className="lg:col-span-5">
              <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-slate-200 bg-white">
                <ClinicImage
                  src="/src/assets/images/clinic_reception_lounge_1794920301714.jpg"
                  alt="Reception lounge at Smile Architect Dental Clinic"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-7 rounded-2xl bg-[#F7FAFA] border border-slate-200 space-y-3">
              <HeartHandshake className="w-6 h-6 text-[#087F8C]" aria-hidden="true" />
              <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                Dental-Care Philosophy
              </h2>
              <p className="text-sm text-[#71818A] leading-relaxed">{philosophy}</p>
            </div>
            <div className="p-7 rounded-2xl bg-[#F7FAFA] border border-slate-200 space-y-3">
              <Sparkles className="w-6 h-6 text-[#087F8C]" aria-hidden="true" />
              <h2 className="font-heading text-xl font-semibold text-[#18323B]">Our Mission</h2>
              <p className="text-sm text-[#71818A] leading-relaxed">{mission}</p>
            </div>
            <div className="p-7 rounded-2xl bg-[#F7FAFA] border border-slate-200 space-y-3">
              <ShieldCheck className="w-6 h-6 text-[#087F8C]" aria-hidden="true" />
              <h2 className="font-heading text-xl font-semibold text-[#18323B]">Our Vision</h2>
              <p className="text-sm text-[#71818A] leading-relaxed">{vision}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200">
              <ClinicImage
                src="/src/assets/images/dental_treatment_suite_1794920281680.jpg"
                alt="Dental operatory and digital diagnostic screen"
              />
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="font-heading text-2xl font-semibold text-[#18323B]">
                  Patient-Centred Care, Hygiene & Modern Facilities
                </h2>
                <p className="text-sm sm:text-base text-[#71818A] leading-relaxed">
                  From young children visiting for their first dental check-up to adults requiring oral surgery or implant rehabilitation, we keep every step transparent and calm.
                </p>
              </div>
              <ul className="space-y-3.5 text-sm text-[#18323B]">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Patient-centred consultations:</strong> Clear explanation of clinical options, expected timelines, and post-care guidance before proceeding.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Hygiene & sterilization practices:</strong> Thorough instrument sterilization, surface disinfection, and sterile barrier protocols between every patient.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Modern dental-care facilities:</strong> Digital dental X-ray support, dedicated pediatric comfort, and ergonomically equipped surgical and restorative suites.
                  </span>
                </li>
              </ul>

              <div className="pt-2 flex flex-wrap gap-4">
                <Link
                  to="/doctors"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium"
                >
                  Meet Our Specialists
                </Link>
                <Link
                  to="/book"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 hover:border-[#087F8C] text-[#18323B] font-heading text-sm font-medium"
                >
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  Book Appointment
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
