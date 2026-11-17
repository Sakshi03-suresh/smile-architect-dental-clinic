import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export function ClinicLogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9" fill="#DFF5F3" />
      <path
        d="M11.5 13.5C11.5 10.8 13.7 9 16 9C17.1 9 17.6 9.4 18 9.9C18.4 9.4 18.9 9 20 9C22.3 9 24.5 10.8 24.5 13.5C24.5 16.5 23.2 18.2 22.8 21.8C22.5 24.4 21.8 27 20.5 27C19.3 27 19.1 23.8 18 23.8C16.9 23.8 16.7 27 15.5 27C14.2 27 13.5 24.4 13.2 21.8C12.8 18.2 11.5 16.5 11.5 13.5Z"
        stroke="#087F8C"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#FFFFFF"
      />
      <path
        d="M14.5 14.5C15.5 15.8 17 16.3 18 16.3C19 16.3 20.5 15.8 21.5 14.5"
        stroke="#C8A96B"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ClinicImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  eager?: boolean;
}

export function ClinicImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackTitle,
  eager = false,
}: ClinicImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className="w-full h-full bg-gradient-to-br from-[#DFF5F3] via-white to-[#F2F8F8] flex flex-col items-center justify-center p-6 text-center border border-[#087F8C]/10"
        role="img"
        aria-label={alt}
      >
        <Sparkles className="w-6 h-6 text-[#087F8C]/60 mb-2" aria-hidden="true" />
        <span className="font-heading text-sm font-medium text-[#18323B]/80">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
