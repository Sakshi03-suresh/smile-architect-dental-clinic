import React, { useMemo, useState } from 'react';
import { Search, ArrowRight, Calendar } from 'lucide-react';
import { Link } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';
import { ClinicImage } from '../components/ClinicBrand.tsx';
import type { ServiceCategory } from '../types/clinic.ts';

const CATEGORIES: Array<'All' | ServiceCategory> = [
  'All',
  'General Dental Care',
  'Cosmetic Dentistry',
  'Pediatric Dentistry',
  'Orthodontics',
  'Dental Surgery',
  'Restorative Dentistry',
];

export function ServicesPage() {
  const { clinic, loading } = useClinic();
  const services = clinic?.services || [];
  const [selectedCategory, setSelectedCategory] = useState<'All' | ServiceCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((svc) => {
      const catMatch = selectedCategory === 'All' || svc.category === selectedCategory;
      const textMatch =
        !q ||
        svc.name.toLowerCase().includes(q) ||
        svc.description.toLowerCase().includes(q) ||
        svc.category.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [services, selectedCategory, searchQuery]);

  return (
    <div className="bg-white min-h-[70vh]">
      <section className="bg-[#F7FAFA] border-b border-slate-100 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="max-w-3xl space-y-2">
            <p className="text-sm font-medium text-[#087F8C]">Multi-Speciality Catalogue</p>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B] tracking-tight">
              Our Dental Services
            </h1>
            <p className="text-base text-[#71818A] leading-relaxed">
              Browse treatments across all six clinical categories. Click any service to view detailed benefits, specialist doctors, and appointment availability.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
            {/* Search input */}
            <div className="relative w-full lg:max-w-sm">
              <Search
                className="w-4 h-4 text-[#71818A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search treatments (e.g., Implants, Root Canal)..."
                aria-label="Search dental services"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-[#18323B] placeholder:text-[#71818A]"
              />
            </div>

            {/* Category filter segmented tabs */}
            <div
              role="tablist"
              aria-label="Filter services by category"
              className="flex flex-wrap items-center gap-1.5"
            >
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-heading font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#087F8C] text-white'
                        : 'bg-white border border-slate-200 text-[#71818A] hover:text-[#18323B] hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#F7FAFA] border border-slate-200 text-center space-y-3">
              <p className="font-heading text-lg font-semibold text-[#18323B]">
                No dental services match your search.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 rounded-lg bg-[#087F8C] text-white text-sm font-medium"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((svc) => {
                const docNames = (svc.doctors || []).map((d) => d.name).join(', ');
                return (
                  <article
                    key={svc.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between transition-colors hover:border-[#087F8C]/40"
                  >
                    <div>
                      <Link
                        to={`/services/${svc.slug}`}
                        className="block aspect-[16/10] bg-[#DFF5F3]/40 border-b border-slate-100 overflow-hidden"
                      >
                        <ClinicImage
                          src={svc.image_url}
                          alt={svc.name}
                          fallbackTitle={svc.name}
                        />
                      </Link>
                      <div className="p-6 space-y-3">
                        <p className="text-xs text-[#71818A] flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[#087F8C]">{svc.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{svc.duration_minutes} mins</span>
                          {svc.price_inr !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums font-medium text-[#18323B]">
                                ₹{svc.price_inr.toLocaleString('en-IN')}
                              </span>
                            </>
                          )}
                        </p>

                        <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                          <Link
                            to={`/services/${svc.slug}`}
                            className="hover:text-[#087F8C] transition-colors"
                          >
                            {svc.name}
                          </Link>
                        </h2>

                        <p className="text-sm text-[#71818A] leading-relaxed line-clamp-3">
                          {svc.description}
                        </p>

                        {docNames && (
                          <p className="text-xs text-[#18323B]/80 pt-1">
                            Specialist: <span className="font-medium">{docNames}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
                      <Link
                        to={`/services/${svc.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#18323B] hover:text-[#087F8C]"
                      >
                        Details
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                      <Link
                        to={`/book?service=${svc.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                        Book This Service
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
