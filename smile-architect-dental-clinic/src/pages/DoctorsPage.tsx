import React from 'react';
import { Link } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';
import { DoctorCard } from '../components/DoctorCard.tsx';

export function DoctorsPage() {
  const { clinic, loading } = useClinic();
  const doctors = clinic?.doctors || [];

  return (
    <div className="bg-white">
      <section className="bg-[#F7FAFA] border-b border-slate-100 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3 max-w-3xl">
          <p className="text-sm font-medium text-[#087F8C]">Clinical Specialists</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B] tracking-tight">
            Our Doctors
          </h1>
          <p className="text-base text-[#71818A] leading-relaxed">
            Meet the dental specialists at Smile Architect Dental Clinic, dedicated to careful surgical, implant, preventive, and pediatric care in Hebbal, Mysuru.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-96 rounded-2xl bg-slate-100 animate-pulse" />
              <div className="h-96 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          ) : doctors.length === 0 ? (
            <div className="p-10 rounded-2xl border border-slate-200 text-center space-y-3">
              <p className="font-heading text-lg font-semibold text-[#18323B]">
                Doctor profiles are currently being updated.
              </p>
              <Link to="/contact" className="text-sm text-[#087F8C] hover:underline">
                Contact the clinic for consultation schedules
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {doctors.map((doc) => (
                <DoctorCard key={doc.id} doctor={doc} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
