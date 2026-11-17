import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck,
  Clock,
  Database,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useClinic } from '../lib/clinicContext.tsx';
import {
  adminFetch,
  clearAdminToken,
  downloadAdminFile,
  setAdminToken,
} from '../lib/adminAuth.ts';
import { AdminAppointmentsTab } from '../components/admin/AdminAppointmentsTab.tsx';
import { AdminDoctorsTab, AdminServicesTab } from '../components/admin/AdminDoctorsServicesTab.tsx';
import { AdminHoursTab } from '../components/admin/AdminHoursTab.tsx';
import {
  AdminContentTestimonialsTab,
  AdminEnquiriesTab,
  AdminGalleryTab,
} from '../components/admin/AdminContentGalleryTab.tsx';
import type {
  Appointment,
  AvailabilityRule,
  BlockedDate,
  BlockedSlot,
  ClinicSettings,
  Doctor,
  Enquiry,
  GalleryItem,
  Service,
  Testimonial,
} from '../types/clinic.ts';

type AdminTab =
  | 'overview'
  | 'appointments'
  | 'doctors'
  | 'services'
  | 'hours'
  | 'gallery'
  | 'enquiries'
  | 'content';

interface OverviewStats {
  totalAppointments: number;
  todayAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  totalEnquiries: number;
}

export function AdminPage() {
  const { refreshClinic } = useClinic();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard data state
  const [activeTab, setActiveTab] = useState<AdminTab>('appointments');
  const [loadingData, setLoadingData] = useState(false);
  const [stats, setStats] = useState<OverviewStats>({
    totalAppointments: 0,
    todayAppointments: 0,
    pendingAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    totalEnquiries: 0,
  });
  const [todayIST, setTodayIST] = useState('');
  const [supabaseStatus, setSupabaseStatus] = useState<{
    configured: boolean;
    canEditRemote: boolean;
  }>({ configured: false, canEditRemote: false });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(30);
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);

  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const responses = await Promise.all([
        adminFetch('/api/admin/overview'),
        adminFetch('/api/admin/appointments'),
        adminFetch('/api/admin/doctors'),
        adminFetch('/api/admin/services'),
        adminFetch('/api/admin/availability'),
        adminFetch('/api/admin/gallery'),
        adminFetch('/api/admin/enquiries'),
        adminFetch('/api/admin/testimonials'),
        fetch('/api/clinic'),
      ]);

      if (responses.slice(0, 8).some((r) => r.status === 401)) {
        clearAdminToken();
        setAuthenticated(false);
        return;
      }

      const [ov, appts, docs, svcs, avail, gal, enq, test, pub] = (await Promise.all(
        responses.map((r) => (r.ok ? r.json() : Promise.resolve({})))
      )) as Array<Record<string, any>>;

      if (ov.stats) setStats(ov.stats);
      if (ov.todayIST) setTodayIST(ov.todayIST);
      if (ov.supabase) setSupabaseStatus(ov.supabase);
      else if (appts.supabase) setSupabaseStatus(appts.supabase);
      setAppointments(appts.appointments || []);
      setDoctors(docs.doctors || []);
      setServices(svcs.services || []);
      setRules(avail.rules || []);
      setBlockedDates(avail.blockedDates || []);
      setBlockedSlots(avail.blockedSlots || []);
      setSlotIntervalMinutes(avail.slotIntervalMinutes ?? 30);
      setBufferMinutes(avail.bufferMinutes ?? 10);
      setGallery(gal.gallery || []);
      setEnquiries(enq.enquiries || []);
      setTestimonials(test.testimonials || []);
      setSettings(pub.settings || null);
      await refreshClinic();
    } finally {
      setLoadingData(false);
    }
  }, [refreshClinic]);

  useEffect(() => {
    adminFetch('/api/admin/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setAuthenticated(true);
          setAdminEmail(data.admin?.email || '');
          void loadAllAdminData();
        } else {
          clearAdminToken();
        }
      })
      .finally(() => setAuthChecked(true));
  }, [loadAllAdminData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await adminFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed.');
      if (typeof data.token === 'string' && data.token) {
        setAdminToken(data.token);
      }
      setAuthenticated(true);
      setAdminEmail(data.admin?.email || email);
      await loadAllAdminData();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminFetch('/api/admin/logout', { method: 'POST' });
    clearAdminToken();
    setAuthenticated(false);
    setEmail('');
    setPassword('');
  };

  if (!authChecked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-[#F7FAFA]">
        <div className="w-8 h-8 rounded-full border-2 border-[#087F8C] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-[75vh] bg-[#F7FAFA] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-7 sm:p-9 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DFF5F3] text-[#087F8C] flex items-center justify-center">
              <Shield className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-semibold text-[#18323B]">
                Clinic Admin Login
              </h1>
              <p className="text-xs text-[#71818A]">
                Authorized Smile Architect Dental Clinic administrators only
              </p>
            </div>
          </div>

          {loginError && (
            <div role="alert" className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-medium text-[#18323B] mb-1">
                Administrator Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@smilearchitect.in"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-xs font-medium text-[#18323B] mb-1">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium disabled:opacity-60"
            >
              {loggingIn ? 'Signing in...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <p className="text-xs text-[#71818A] leading-relaxed border-t border-slate-100 pt-4">
            Credentials are configured via <code className="font-mono">ADMIN_EMAIL</code> and{' '}
            <code className="font-mono">ADMIN_PASSWORD</code> environment variables.
          </p>
        </div>
      </div>
    );
  }

  const NAV_ITEMS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
    { id: 'overview', label: 'Overview & Backup', icon: LayoutDashboard },
    { id: 'doctors', label: 'Doctors', icon: Users },
    { id: 'services', label: 'Services', icon: Stethoscope },
    { id: 'hours', label: 'Working Hours', icon: Clock },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
    { id: 'enquiries', label: 'Enquiries', icon: MessageSquare },
    { id: 'content', label: 'Content & Reviews', icon: FileText },
  ];

  const KPI_CARDS = [
    { label: 'Total Appointments', value: stats.totalAppointments },
    { label: "Today's Appointments", value: stats.todayAppointments },
    { label: 'Pending', value: stats.pendingAppointments },
    { label: 'Confirmed', value: stats.confirmedAppointments },
    { label: 'Cancelled', value: stats.cancelledAppointments },
    { label: 'Patient Enquiries', value: stats.totalEnquiries },
  ];

  return (
    <div className="min-h-[82vh] bg-[#F7FAFA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="lg:w-64 shrink-0 space-y-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <p className="font-heading text-sm font-semibold text-[#18323B]">Admin Console</p>
            <p className="text-xs text-[#71818A] truncate">{adminEmail}</p>
          </div>

          <nav aria-label="Admin sections" className="bg-white rounded-xl border border-slate-200 p-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#087F8C] text-white'
                      : 'text-[#18323B] hover:bg-[#DFF5F3]/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-heading font-medium text-[#18323B]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign Out
          </button>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 min-w-0 space-y-6">
          {loadingData && appointments.length === 0 ? (
            <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="font-heading text-2xl font-semibold text-[#18323B]">
                        Clinic Overview
                      </h1>
                      <p className="text-xs text-[#71818A] tabular-nums">
                        Current clinic date (IST): {todayIST}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadAdminFile(
                          '/api/admin/backup',
                          `smile-architect-backup-${todayIST || 'export'}.json`
                        )
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#087F8C] text-xs font-heading font-medium text-[#18323B]"
                    >
                      <Database className="w-4 h-4 text-[#087F8C]" aria-hidden="true" />
                      Download Database Backup (JSON)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {KPI_CARDS.map((card) => (
                      <div
                        key={card.label}
                        className="p-5 rounded-xl bg-white border border-slate-200 space-y-1"
                      >
                        <p className="text-xs text-[#71818A]">{card.label}</p>
                        <p className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B] tabular-nums">
                          {card.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-heading text-base font-semibold text-[#18323B]">
                        Recent Appointments
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('appointments')}
                        className="text-xs font-medium text-[#087F8C] hover:underline"
                      >
                        Manage all appointments
                      </button>
                    </div>
                    {appointments.length === 0 ? (
                      <p className="text-sm text-[#71818A]">
                        No appointments booked yet. New online bookings will appear here immediately.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 text-sm">
                        {appointments.slice(0, 5).map((a) => (
                          <div key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-mono text-xs text-[#087F8C] mr-2">
                                {a.booking_ref}
                              </span>
                              <span className="font-medium text-[#18323B]">{a.patient_name}</span>
                              <span className="text-xs text-[#71818A]">
                                {' '}
                                · {a.service_name} ({a.doctor_name})
                              </span>
                            </div>
                            <span className="text-xs tabular-nums text-[#71818A]">
                              {a.appointment_date} · {a.start_time} IST · <strong>{a.status}</strong>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'appointments' && (
                <AdminAppointmentsTab
                  appointments={appointments}
                  doctors={doctors}
                  services={services}
                  stats={stats}
                  todayIST={todayIST}
                  supabaseStatus={supabaseStatus}
                  onRefresh={loadAllAdminData}
                />
              )}

              {activeTab === 'doctors' && (
                <AdminDoctorsTab
                  doctors={doctors}
                  services={services}
                  onRefresh={loadAllAdminData}
                />
              )}

              {activeTab === 'services' && (
                <AdminServicesTab
                  services={services}
                  doctors={doctors}
                  onRefresh={loadAllAdminData}
                />
              )}

              {activeTab === 'hours' && (
                <AdminHoursTab
                  rules={rules}
                  blockedDates={blockedDates}
                  blockedSlots={blockedSlots}
                  slotIntervalMinutes={slotIntervalMinutes}
                  bufferMinutes={bufferMinutes}
                  doctors={doctors}
                  onRefresh={loadAllAdminData}
                />
              )}

              {activeTab === 'gallery' && (
                <AdminGalleryTab gallery={gallery} onRefresh={loadAllAdminData} />
              )}

              {activeTab === 'enquiries' && (
                <AdminEnquiriesTab enquiries={enquiries} onRefresh={loadAllAdminData} />
              )}

              {activeTab === 'content' && settings && (
                <AdminContentTestimonialsTab
                  settings={settings}
                  testimonials={testimonials}
                  onRefresh={loadAllAdminData}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
