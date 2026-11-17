import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClinic } from '../lib/clinicContext.tsx';
import { ClinicImage } from '../components/ClinicBrand.tsx';

export function GalleryPage() {
  const { clinic, loading } = useClinic();
  const gallery = clinic?.gallery || [];
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    gallery.forEach((g) => set.add(g.category));
    return Array.from(set);
  }, [gallery]);

  const filtered = useMemo(
    () =>
      selectedCategory === 'All'
        ? gallery
        : gallery.filter((g) => g.category === selectedCategory),
    [gallery, selectedCategory]
  );

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight') {
        setLightboxIdx((prev) => (prev === null ? null : (prev + 1) % filtered.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIdx((prev) =>
          prev === null ? null : (prev - 1 + filtered.length) % filtered.length
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, filtered.length]);

  const activePhoto = lightboxIdx !== null ? filtered[lightboxIdx] : null;

  return (
    <div className="bg-white min-h-[75vh]">
      <section className="bg-[#F7FAFA] border-b border-slate-100 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="max-w-3xl space-y-2">
            <p className="text-sm font-medium text-[#087F8C]">Clinic Showcase</p>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B] tracking-tight">
              Clinic Gallery
            </h1>
            <p className="text-base text-[#71818A]">
              Explore our reception area, treatment suites, pediatric care room, and digital dental equipment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setLightboxIdx(null);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-heading font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#087F8C] text-white'
                    : 'bg-white border border-slate-200 text-[#71818A] hover:text-[#18323B]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#F7FAFA] border border-slate-200 text-center text-sm text-[#71818A]">
              No gallery photographs in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxIdx(idx)}
                  className="group text-left rounded-2xl overflow-hidden border border-slate-200 bg-white hover:border-[#087F8C]/50 transition-colors"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[#DFF5F3]/30">
                    <ClinicImage
                      src={item.image_url}
                      alt={item.title}
                      fallbackTitle={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-5 space-y-1">
                    <p className="text-xs font-medium text-[#087F8C]">{item.category}</p>
                    <h2 className="font-heading text-base font-semibold text-[#18323B]">
                      {item.title}
                    </h2>
                    {item.caption && (
                      <p className="text-xs text-[#71818A] leading-relaxed">{item.caption}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.title}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <div>
                <p className="text-xs text-[#087F8C] font-medium">{activePhoto.category}</p>
                <p className="font-heading text-base font-semibold text-[#18323B]">
                  {activePhoto.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxIdx(null)}
                aria-label="Close image preview"
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-[#18323B] hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative bg-slate-950 aspect-[16/10] flex items-center justify-center">
              <ClinicImage
                src={activePhoto.image_url}
                alt={activePhoto.title}
                className="w-full h-full object-contain"
              />
              {filtered.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() =>
                      setLightboxIdx((prev) =>
                        prev === null ? 0 : (prev - 1 + filtered.length) % filtered.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-[#18323B] flex items-center justify-center shadow"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() =>
                      setLightboxIdx((prev) =>
                        prev === null ? 0 : (prev + 1) % filtered.length
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-[#18323B] flex items-center justify-center shadow"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            {activePhoto.caption && (
              <div className="px-5 py-3.5 text-sm text-[#71818A] border-t border-slate-200">
                {activePhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
