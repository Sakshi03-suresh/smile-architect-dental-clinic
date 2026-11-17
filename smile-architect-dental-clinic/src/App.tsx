/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect } from 'react';
import { RouterProvider, useRouter } from './lib/router.tsx';
import { ClinicProvider } from './lib/clinicContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Footer } from './components/Footer.tsx';
import { FloatingWhatsApp } from './components/FloatingWhatsApp.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { DoctorsPage } from './pages/DoctorsPage.tsx';
import { ServicesPage } from './pages/ServicesPage.tsx';
import { ServiceDetailPage } from './pages/ServiceDetailPage.tsx';
import { BookingPage } from './pages/BookingPage.tsx';
import { GalleryPage } from './pages/GalleryPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { NotFoundPage, PrivacyPolicyPage, TermsPage } from './pages/LegalPages.tsx';

function RouteView() {
  const { pathname } = useRouter();
  const normalized = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Smile Architect Dental Clinic – Best Dental Clinic in Hebbal, Mysuru',
      '/about': 'About Us – Smile Architect Dental Clinic, Mysuru',
      '/doctors': 'Our Doctors – Smile Architect Dental Clinic, Mysuru',
      '/services': 'Dental Services – Smile Architect Dental Clinic, Mysuru',
      '/book': 'Book Appointment – Smile Architect Dental Clinic, Mysuru',
      '/gallery': 'Clinic Gallery – Smile Architect Dental Clinic, Mysuru',
      '/contact': 'Contact Us – Smile Architect Dental Clinic, Mysuru',
      '/admin': 'Admin Dashboard – Smile Architect Dental Clinic',
      '/privacy-policy': 'Privacy Policy – Smile Architect Dental Clinic',
      '/terms': 'Terms & Cancellation Policy – Smile Architect Dental Clinic',
    };
    document.title =
      titles[normalized] ||
      (normalized.startsWith('/services/')
        ? 'Service Details – Smile Architect Dental Clinic'
        : 'Page Not Found – Smile Architect Dental Clinic');
  }, [normalized]);

  if (normalized === '/') return <HomePage />;
  if (normalized === '/about') return <AboutPage />;
  if (normalized === '/doctors') return <DoctorsPage />;
  if (normalized === '/services') return <ServicesPage />;
  if (normalized.startsWith('/services/')) {
    const slug = normalized.slice('/services/'.length);
    if (slug && !slug.includes('/')) {
      return <ServiceDetailPage slug={slug} />;
    }
  }
  if (normalized === '/book') return <BookingPage />;
  if (normalized === '/gallery') return <GalleryPage />;
  if (normalized === '/contact') return <ContactPage />;
  if (normalized === '/admin') return <AdminPage />;
  if (normalized === '/privacy-policy') return <PrivacyPolicyPage />;
  if (normalized === '/terms') return <TermsPage />;

  return <NotFoundPage />;
}

export default function App() {
  return (
    <RouterProvider>
      <ClinicProvider>
        <div className="min-h-screen flex flex-col bg-white text-[#18323B]">
          <Navbar />
          <main className="flex-1">
            <RouteView />
          </main>
          <Footer />
          <FloatingWhatsApp />
        </div>
      </ClinicProvider>
    </RouterProvider>
  );
}
