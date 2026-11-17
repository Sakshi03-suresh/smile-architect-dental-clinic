import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

interface MapEmbedProps {
  clinicName: string;
  address: string;
  googleMapsUrl?: string;
}

export function MapEmbed({ clinicName, address, googleMapsUrl }: MapEmbedProps) {
  const fallbackDirectionsUrl =
    googleMapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${clinicName}, ${address}`
    )}`;

  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    '850/S, 25th Cross Road, Sankranthi Circle, Hebbal 2nd Stage, Mysuru, Karnataka 570017'
  )}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
      <div className="relative w-full h-72 sm:h-80 bg-[#DFF5F3]/50">
        <iframe
          title={`${clinicName} Location Map`}
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-full border-0"
        />
      </div>
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-t border-slate-100">
        <div className="flex items-start gap-2.5 text-sm text-[#18323B]">
          <MapPin className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" aria-hidden="true" />
          <span>{address}</span>
        </div>
        <a
          href={fallbackDirectionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#087F8C]/30 text-[#087F8C] hover:bg-[#DFF5F3]/60 text-xs font-heading font-medium whitespace-nowrap shrink-0 transition-colors"
        >
          <span>Open in Google Maps</span>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
