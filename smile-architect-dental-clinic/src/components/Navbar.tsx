import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useRouter } from '../lib/router.tsx';
import { ClinicLogoMark } from './ClinicBrand.tsx';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/doctors', label: 'Our Doctors' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
  { to: '/admin', label: 'Admin' },
];

export function Navbar() {
  const { pathname } = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group"
          onClick={() => setMobileOpen(false)}
        >
          <ClinicLogoMark className="w-9 h-9 shrink-0" />
          <span className="font-heading text-lg font-semibold tracking-tight text-[#18323B] group-hover:text-[#087F8C] transition-colors">
            Smile Architect Dental Clinic
          </span>
        </Link>

        {/* Zone 2: Clean Typography Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium text-[#71818A]"
        >
          {NAV_LINKS.map((item) => {
            const active =
              item.to === '/'
                ? pathname === '/'
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 ${
                  active
                    ? 'text-[#087F8C] border-[#087F8C]'
                    : 'border-transparent hover:text-[#18323B] hover:border-[#C8A96B]/60'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/book"
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-sm font-medium hover:bg-[#066974] transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            Book Appointment
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-slate-200 text-[#18323B] hover:bg-[#DFF5F3]/50 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-1 shadow-lg">
          <nav aria-label="Mobile navigation" className="flex flex-col space-y-1">
            {NAV_LINKS.map((item) => {
              const active =
                item.to === '/'
                  ? pathname === '/'
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                    active
                      ? 'bg-[#DFF5F3] text-[#087F8C]'
                      : 'text-[#18323B] hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/book"
              onClick={() => setMobileOpen(false)}
              className="mt-3 w-full inline-flex items-center justify-center px-5 py-3 rounded-lg bg-[#087F8C] text-white font-heading text-base font-medium hover:bg-[#066974]"
            >
              Book Appointment
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
