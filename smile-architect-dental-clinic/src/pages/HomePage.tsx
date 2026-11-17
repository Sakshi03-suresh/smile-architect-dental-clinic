import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Baby,
  ScanLine,
  HeartHandshake,
  MessageSquarePlus,
} from 'lucide-react';
import { Link } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';
import { ClinicImage } from '../components/ClinicBrand.tsx';
import { DoctorCard } from '../components/DoctorCard.tsx';
import { MapEmbed } from '../components/MapEmbed.tsx';

const TRUST_PILLARS = [
  {
    icon: Stethoscope,
    title: 'Experienced dental professionals',
    detail: 'Specialist care in Oral & Maxillofacial Surgery, Implantology, and Pediatric Dentistry.',
  },
  {
    icon: Sparkles,
    title: 'Comprehensive dental services',
    detail: 'Preventive, restorative, root canal, orthodontic, and surgical care under one roof.',
  },
  {
    icon: Baby,
    title: 'Child-friendly dental care',
    detail: 'Calm, patient pediatric consultations designed for young smiles and reassuring visits.',
  },
  {
    icon: ScanLine,
    title: 'Modern diagnostic facilities',
    detail: 'Digital dental X-rays and clear visual diagnostics to guide every treatment plan.',
  },
  {
    icon: HeartHandshake,
    title: 'Patient-focused treatment',
    detail: 'Unrushed consultations with transparent explanations before any procedure begins.',
  },
];

const WHY_CHOOSE_ITEMS = [
  {
    num: '01',
    title: 'Personalized dental consultations',
    body: 'Every smile has unique needs. We evaluate thoroughly and tailor treatment recommendations to your goals and comfort.',
  },
  {
    num: '02',
    title: 'Patient-friendly environment',
    body: 'Designed to reduce dental anxiety for both adults and children with calm communication and unhurried appointments.',
  },
  {
    num: '03',
    title: 'Comprehensive dental care',
    body: 'From routine dental cleaning and fillings to implants, wisdom tooth surgery, and braces consultations in Hebbal, Mysuru.',
  },
  {
    num: '04',
    title: 'Modern diagnostic support',
    body: 'Low-radiation digital intraoral imaging lets you view findings chairside and understand every recommended step.',
  },
  {
    num: '05',
    title: 'Hygiene-conscious treatment practices',
    body: 'Strict instrument sterilization protocols and clean operatory preparation between every single patient visit.',
  },
];

export function HomePage() {
  const { clinic, loading } = useClinic();
  const settings = clinic?.settings;
  const doctors = clinic?.doctors || [];
  const services = clinic?.services || [];
  const gallery = (clinic?.gallery || []).slice(0, 4);
  const testimonials = clinic?.testimonials || [];

  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [fbName, setFbName] = useState('');
  const [fbTreatment, setFbTreatment] = useState('');
  const [fbQuote, setFbQuote] = useState('');
  const [fbStatus, setFbStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [fbMessage, setFbMessage] = useState('');

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbStatus('submitting');
    setFbMessage('');
    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: fbName,
          treatment: fbTreatment,
          quote: fbQuote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to submit feedback.');
      setFbStatus('success');
      setFbMessage(data.message);
      setFbName('');
      setFbTreatment('');
      setFbQuote('');
    } catch (err) {
      setFbStatus('error');
      setFbMessage(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const heroHeading = settings?.hero_heading || 'Your Smile Deserves Expert Care.';
  const heroSubheading =
    settings?.hero_subheading ||
    'Personalized dental care for every smile. Experience comfortable, modern and compassionate dentistry at Smile Architect Dental Clinic.';
  const clinicPhone = settings?.phone || '+91 90368 27916';
  const clinicAddress =
    settings?.address ||
    '850/S, 25th Cross Road, Manchegowdana Koppalu, Sankranthi Circle, Hebbal 2nd Stage, Ilavala Hobli, Mysuru, Karnataka, India – 570017';

  const previewServices = services.slice(0, 6);

  return (
    <div>
      {/* HERO SECTION */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-sm font-medium text-[#087F8C] tracking-wide">
                Hebbal 2nd Stage, Mysuru · Multi-Speciality Dental Clinic
              </p>
              <h1
                className="font-heading font-semibold text-[#18323B] leading-[1.12] tracking-tight max-w-xl"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                {heroHeading}
              </h1>
              <p className="text-base sm:text-lg text-[#71818A] leading-relaxed max-w-xl">
                {heroSubheading}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/book"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm sm:text-base font-medium transition-colors shadow-sm whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  Book an Appointment
                </Link>
                <Link
                  to="/services"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-slate-300 hover:border-[#087F8C] text-[#18323B] hover:text-[#087F8C] font-heading text-sm sm:text-base font-medium transition-colors whitespace-nowrap"
                >
                  Explore Our Services
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col gap-1.5 text-sm text-[#71818A]">
                <a
                  href={`tel:${clinicPhone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 text-[#18323B] font-medium hover:text-[#087F8C] tabular-nums w-fit"
                >
                  <Phone className="w-4 h-4 text-[#087F8C]" aria-hidden="true" />
                  {clinicPhone}
                </a>
                <p className="text-xs sm:text-sm tabular-nums">
                  Mon–Sat 10:00 AM – 1:30 PM &amp; 5:00 PM – 8:30 PM · Sun 10:00 AM – 1:30 PM
                </p>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] sm:min-h-[380px] lg:min-h-[460px] rounded-2xl overflow-hidden border border-slate-200 bg-[#DFF5F3]/30">
                <ClinicImage
                  src="/src/assets/images/hero_dental_clinic_1794920281216.jpg"
                  alt="Consultation and treatment suite at Smile Architect Dental Clinic in Mysuru"
                  className="w-full h-full object-cover"
                  eager
                />
              </div>
            </div>
          </div>

          {/* TRUST PILLARS STRIP */}
          <div className="mt-12 pt-10 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {TRUST_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-[#DFF5F3] text-[#087F8C] flex items-center justify-center">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <h2 className="font-heading text-sm font-semibold text-[#18323B]">
                    {pillar.title}
                  </h2>
                  <p className="text-xs text-[#71818A] leading-relaxed">{pillar.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section className="bg-[#F7FAFA] py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-medium text-[#087F8C]">Comprehensive Dental Care</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B] tracking-tight">
                Treatments Tailored for Every Stage of Life
              </h2>
              <p className="text-sm sm:text-base text-[#71818A]">
                Explore our multi-speciality dental services across preventive, pediatric, restorative, orthodontic, cosmetic, and surgical care.
              </p>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-sm font-heading font-medium text-[#087F8C] hover:text-[#066974] whitespace-nowrap"
            >
              View all {services.length || 15} services
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {previewServices.map((svc) => (
                <article
                  key={svc.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between transition-colors hover:border-[#087F8C]/40"
                >
                  <div>
                    <div className="aspect-[16/10] bg-[#DFF5F3]/40 overflow-hidden border-b border-slate-100">
                      <ClinicImage
                        src={svc.image_url}
                        alt={svc.name}
                        fallbackTitle={svc.name}
                      />
                    </div>
                    <div className="p-6 space-y-2.5">
                      <p className="text-xs text-[#71818A] flex items-center gap-2">
                        <span className="text-[#087F8C] font-medium">{svc.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{svc.duration_minutes} mins</span>
                      </p>
                      <h3 className="font-heading text-lg font-semibold text-[#18323B]">
                        <Link to={`/services/${svc.slug}`} className="hover:text-[#087F8C] transition-colors">
                          {svc.name}
                        </Link>
                      </h3>
                      <p className="text-sm text-[#71818A] leading-relaxed line-clamp-2">
                        {svc.description}
                      </p>
                    </div>
                  </div>
                  <div className="px-6 pb-5 pt-2 flex items-center justify-between gap-4 border-t border-slate-100">
                    <Link
                      to={`/services/${svc.slug}`}
                      className="text-sm font-medium text-[#18323B] hover:text-[#087F8C] transition-colors"
                    >
                      Learn more
                    </Link>
                    <Link
                      to={`/book?service=${svc.id}`}
                      className="text-sm font-heading font-medium text-[#087F8C] hover:underline whitespace-nowrap"
                    >
                      Book service
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MEET OUR DOCTORS */}
      <section className="bg-white py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-medium text-[#087F8C]">Specialist Dental Team</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B] tracking-tight">
                Meet Our Doctors
              </h2>
              <p className="text-sm sm:text-base text-[#71818A]">
                Focused surgical, implant, and pediatric expertise guided by attentive clinical care.
              </p>
            </div>
            <Link
              to="/doctors"
              className="inline-flex items-center gap-2 text-sm font-heading font-medium text-[#087F8C] hover:text-[#066974] whitespace-nowrap"
            >
              View doctor profiles
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {doctors.map((doc) => (
              <DoctorCard key={doc.id} doctor={doc} compact />
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-[#DFF5F3]/35 py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-sm font-medium text-[#087F8C]">Why Choose Us</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B] tracking-tight">
                Calm, Ethical Dentistry Built Around Your Comfort
              </h2>
              <p className="text-sm sm:text-base text-[#71818A] leading-relaxed">
                At Smile Architect Dental Clinic, we combine clear communication, modern diagnostics, and hygiene-conscious clinical workflows so every visit feels reassuring.
              </p>
              <div className="pt-2">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 text-sm font-heading font-medium text-[#087F8C] hover:underline"
                >
                  Read about our clinic philosophy
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 divide-y divide-slate-200/80 bg-white rounded-2xl border border-slate-200 px-6 sm:px-8">
              {WHY_CHOOSE_ITEMS.map((item) => (
                <div key={item.num} className="py-5 flex items-start gap-4">
                  <span className="font-mono text-xs font-medium text-[#C8A96B] pt-1 tabular-nums">
                    {item.num}.
                  </span>
                  <div className="space-y-1">
                    <h3 className="font-heading text-base font-semibold text-[#18323B]">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#71818A] leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AUTHENTIC PATIENT TESTIMONIALS */}
      <section className="bg-white py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-medium text-[#087F8C]">Patient Experiences</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B] tracking-tight">
                Verified Patient Reviews
              </h2>
              <p className="text-sm sm:text-base text-[#71818A]">
                Only authentic, clinic-approved feedback from real patients is published here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFeedbackForm((prev) => !prev)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#087F8C]/30 text-[#087F8C] hover:bg-[#DFF5F3]/50 font-heading text-sm font-medium transition-colors whitespace-nowrap"
            >
              <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
              Share Your Experience
            </button>
          </div>

          {showFeedbackForm && (
            <form
              onSubmit={handleFeedbackSubmit}
              className="mb-10 p-6 sm:p-8 rounded-2xl bg-[#F7FAFA] border border-slate-200 max-w-2xl space-y-4"
            >
              <h3 className="font-heading text-lg font-semibold text-[#18323B]">
                Submit Patient Feedback
              </h3>
              <p className="text-xs text-[#71818A]">
                Feedback is reviewed by the clinic administrator before being published to ensure authenticity.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fb-name" className="block text-xs font-medium text-[#18323B] mb-1">
                    Your Name *
                  </label>
                  <input
                    id="fb-name"
                    type="text"
                    required
                    value={fbName}
                    onChange={(e) => setFbName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-[#18323B]"
                  />
                </div>
                <div>
                  <label htmlFor="fb-treatment" className="block text-xs font-medium text-[#18323B] mb-1">
                    Treatment / Service (Optional)
                  </label>
                  <input
                    id="fb-treatment"
                    type="text"
                    value={fbTreatment}
                    onChange={(e) => setFbTreatment(e.target.value)}
                    placeholder="e.g., Pediatric Dentistry"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-[#18323B]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="fb-quote" className="block text-xs font-medium text-[#18323B] mb-1">
                  Your Feedback *
                </label>
                <textarea
                  id="fb-quote"
                  rows={3}
                  required
                  value={fbQuote}
                  onChange={(e) => setFbQuote(e.target.value)}
                  placeholder="Share how your visit went..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-[#18323B]"
                />
              </div>
              {fbMessage && (
                <p
                  className={`text-sm ${
                    fbStatus === 'error' ? 'text-red-700' : 'text-[#087F8C]'
                  }`}
                >
                  {fbMessage}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={fbStatus === 'submitting'}
                  className="px-5 py-2.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium disabled:opacity-60"
                >
                  {fbStatus === 'submitting' ? 'Submitting...' : 'Submit Feedback'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFeedbackForm(false)}
                  className="px-4 py-2.5 rounded-lg text-sm text-[#71818A] hover:text-[#18323B]"
                >
                  Close
                </button>
              </div>
            </form>
          )}

          {testimonials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <blockquote
                  key={t.id}
                  className="p-6 rounded-2xl bg-[#F7FAFA] border border-slate-200 flex flex-col justify-between space-y-4"
                >
                  <p className="text-sm text-[#18323B] leading-relaxed">“{t.quote}”</p>
                  <footer className="text-xs text-[#71818A] pt-3 border-t border-slate-200/70">
                    <span className="font-heading font-semibold text-[#18323B]">{t.patient_name}</span>
                    {t.treatment && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{t.treatment}</span>
                      </>
                    )}
                    {t.visit_date && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="tabular-nums">{t.visit_date}</span>
                      </>
                    )}
                  </footer>
                </blockquote>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-[#F7FAFA] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-start gap-4 max-w-2xl">
                <ShieldCheck className="w-6 h-6 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="font-heading text-base font-semibold text-[#18323B]">
                    Authentic Reviews Only
                  </h3>
                  <p className="text-sm text-[#71818A] leading-relaxed">
                    We never display fabricated or unverified testimonials. Verified reviews from patients who visited Smile Architect Dental Clinic will appear here once approved by the clinic administrator.
                  </p>
                </div>
              </div>
              <Link
                to="/book"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-sm font-medium hover:bg-[#066974] whitespace-nowrap shrink-0"
              >
                Book a Visit
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* GALLERY PREVIEW */}
      <section className="bg-[#F7FAFA] py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-medium text-[#087F8C]">Clinic Environment</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B] tracking-tight">
                Inside Smile Architect Dental Clinic
              </h2>
            </div>
            <Link
              to="/gallery"
              className="inline-flex items-center gap-2 text-sm font-heading font-medium text-[#087F8C] hover:text-[#066974] whitespace-nowrap"
            >
              Open full gallery
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {gallery.map((item) => (
              <Link
                key={item.id}
                to="/gallery"
                className="group rounded-2xl overflow-hidden border border-slate-200 bg-white block"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#DFF5F3]/30">
                  <ClinicImage
                    src={item.image_url}
                    alt={item.title}
                    fallbackTitle={item.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-4">
                  <p className="text-xs text-[#087F8C] font-medium">{item.category}</p>
                  <p className="font-heading text-sm font-semibold text-[#18323B] mt-0.5 truncate">
                    {item.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* LOCATION & GOOGLE MAPS */}
      <section className="bg-white py-16 sm:py-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-5">
              <p className="text-sm font-medium text-[#087F8C]">Visit Our Clinic</p>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B] tracking-tight">
                Conveniently Located in Hebbal 2nd Stage, Mysuru
              </h2>
              <p className="text-sm sm:text-base text-[#71818A] leading-relaxed">
                {clinicAddress}
              </p>

              <div className="p-5 rounded-xl bg-[#F7FAFA] border border-slate-200 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[#71818A]">Monday – Saturday</span>
                  <span className="font-medium text-[#18323B] tabular-nums text-right">
                    10:00 AM – 1:30 PM & 5:00 PM – 8:30 PM
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200/70">
                  <span className="text-[#71818A]">Sunday</span>
                  <span className="font-medium text-[#18323B] tabular-nums">
                    10:00 AM – 1:30 PM
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200/70">
                  <span className="text-[#71818A]">Clinic Phone</span>
                  <a
                    href={`tel:${clinicPhone.replace(/\s+/g, '')}`}
                    className="font-medium text-[#087F8C] hover:underline tabular-nums"
                  >
                    {clinicPhone}
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  to="/book"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium"
                >
                  Book Appointment
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 hover:border-[#087F8C] text-[#18323B] font-heading text-sm font-medium"
                >
                  Contact & Directions
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7">
              <MapEmbed
                clinicName={settings?.clinic_name || 'Smile Architect Dental Clinic'}
                address={clinicAddress}
                googleMapsUrl={settings?.google_maps_url}
              />
            </div>
          </div>
        </div>
      </section>

      {/* FINAL APPOINTMENT CTA */}
      <section className="bg-[#087F8C] text-white py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-2">
            <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              Ready to Schedule Your Dental Visit?
            </h2>
            <p className="text-sm sm:text-base text-[#DFF5F3]">
              Select your preferred service, specialist doctor, and convenient time slot online in under two minutes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-white text-[#087F8C] hover:bg-[#DFF5F3] font-heading text-sm sm:text-base font-medium transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Book Online Now
            </Link>
            <a
              href={`tel:${clinicPhone.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-white/40 text-white hover:bg-white/10 font-heading text-sm sm:text-base font-medium transition-colors whitespace-nowrap tabular-nums"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              {clinicPhone}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
