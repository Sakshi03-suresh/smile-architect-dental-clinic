import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Link } from '../lib/router.tsx';
import type { Doctor } from '../types/clinic.ts';
import { ClinicImage } from './ClinicBrand.tsx';

function getInitials(name: string): string {
  const cleaned = name.replace(/^Dr\.?\s+/i, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function DoctorCard({
  doctor,
  compact = false,
}: {
  doctor: Doctor;
  compact?: boolean;
}) {
  return (
    <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between transition-colors hover:border-[#087F8C]/40">
      <div>
        <div className="aspect-[16/10] bg-[#DFF5F3]/50 border-b border-slate-100 relative overflow-hidden">
          {doctor.photo_url ? (
            <ClinicImage
              src={doctor.photo_url}
              alt={`${doctor.name} – ${doctor.specialization}`}
              fallbackTitle={doctor.name}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#DFF5F3] via-white to-[#F3F8F8] px-6 text-center">
              <div className="w-20 h-20 rounded-full bg-white border border-[#087F8C]/20 flex items-center justify-center shadow-xs mb-3">
                <span className="font-heading text-2xl font-semibold text-[#087F8C]">
                  {getInitials(doctor.name)}
                </span>
              </div>
              <p className="text-xs text-[#71818A]">
                {doctor.specialization}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 sm:p-7 space-y-3">
          <div>
            <h3 className="font-heading text-xl font-semibold text-[#18323B]">{doctor.name}</h3>
            <p className="text-sm font-medium text-[#087F8C] mt-1">{doctor.specialization}</p>
            {(doctor.qualifications || doctor.experience) && (
              <p className="text-xs text-[#71818A] mt-1.5 flex flex-wrap items-center gap-2">
                {doctor.qualifications && <span>{doctor.qualifications}</span>}
                {doctor.qualifications && doctor.experience && <span aria-hidden="true">·</span>}
                {doctor.experience && <span>{doctor.experience}</span>}
              </p>
            )}
          </div>

          {doctor.bio && (
            <p className={`text-sm text-[#71818A] leading-relaxed ${compact ? 'line-clamp-3' : ''}`}>
              {doctor.bio}
            </p>
          )}

          {doctor.consultation_timings && (
            <div className="pt-2 flex items-start gap-2 text-xs text-[#18323B]/80">
              <Clock className="w-4 h-4 text-[#C8A96B] shrink-0 mt-0.5" aria-hidden="true" />
              <span className="tabular-nums leading-relaxed">{doctor.consultation_timings}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 sm:px-7 pb-6 pt-2 flex items-center justify-between gap-4 border-t border-slate-100">
        <Link
          to={`/book?doctor=${doctor.id}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium transition-colors whitespace-nowrap"
        >
          <Calendar className="w-4 h-4" aria-hidden="true" />
          Book Appointment
        </Link>
        {compact && (
          <Link
            to="/doctors"
            className="text-sm font-medium text-[#087F8C] hover:underline whitespace-nowrap"
          >
            Full profile
          </Link>
        )}
      </div>
    </article>
  );
}
