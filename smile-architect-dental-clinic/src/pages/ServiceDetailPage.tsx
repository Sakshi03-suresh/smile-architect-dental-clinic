import React from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Clock, IndianRupee } from 'lucide-react';
import { Link } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';
import { ClinicImage } from '../components/ClinicBrand.tsx';

export function ServiceDetailPage({ slug }: { slug: string }) {
  const { clinic, loading } = useClinic();
  const service = (clinic?.services || []).find((s) => s.slug === slug);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="h-96 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-heading text-2xl font-semibold text-[#18323B]">Service Not Found</h1>
        <p className="text-sm text-[#71818A]">
          The requested dental service could not be found or is currently inactive.
        </p>
        <Link
          to="/services"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-sm font-medium"
        >
          Back to Services
        </Link>
      </div>
    );
  }

  const specialists = service.doctors || [];

  return (
    <div className="bg-white py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <Link
          to="/services"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#71818A] hover:text-[#087F8C]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to All Services
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-6">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-[#DFF5F3]/30">
              <ClinicImage src={service.image_url} alt={service.name} fallbackTitle={service.name} />
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#087F8C]">{service.category}</p>
              <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B] tracking-tight">
                {service.name}
              </h1>
            </div>

            <p className="text-base text-[#71818A] leading-relaxed">{service.description}</p>

            <div className="grid grid-cols-2 gap-4 p-5 rounded-xl bg-[#F7FAFA] border border-slate-200">
              <div className="space-y-1">
                <span className="text-xs text-[#71818A] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#087F8C]" aria-hidden="true" />
                  Estimated Duration
                </span>
                <p className="font-heading text-base font-semibold text-[#18323B] tabular-nums">
                  {service.duration_minutes} minutes
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-[#71818A] flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-[#087F8C]" aria-hidden="true" />
                  Consultation Fee
                </span>
                <p className="font-heading text-base font-semibold text-[#18323B] tabular-nums">
                  {service.price_inr !== null
                    ? `₹${service.price_inr.toLocaleString('en-IN')}`
                    : 'Discussed on consultation'}
                </p>
              </div>
            </div>

            {service.benefits.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-heading text-lg font-semibold text-[#18323B]">Key Benefits</h2>
                <ul className="space-y-2.5">
                  {service.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#18323B]">
                      <CheckCircle2
                        className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {specialists.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h2 className="font-heading text-sm font-semibold text-[#18323B]">
                  Available Specialist{specialists.length > 1 ? 's' : ''}
                </h2>
                <div className="space-y-2">
                  {specialists.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-white"
                    >
                      <div>
                        <p className="font-heading text-sm font-semibold text-[#18323B]">
                          {doc.name}
                        </p>
                        <p className="text-xs text-[#71818A]">{doc.specialization}</p>
                      </div>
                      <Link
                        to={`/book?service=${service.id}&doctor=${doc.id}`}
                        className="text-xs font-heading font-medium text-[#087F8C] hover:underline"
                      >
                        Book with {doc.name}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Link
                to={`/book?service=${service.id}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm sm:text-base font-medium transition-colors"
              >
                <Calendar className="w-4 h-4" aria-hidden="true" />
                Book This Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
