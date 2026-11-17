import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MessageCircle,
  Search,
  UserCheck,
} from 'lucide-react';
import { Link, useRouter } from '../lib/router.tsx';
import { useClinic } from '../lib/clinicContext.tsx';
import { getDayOfWeekIST, getTodayIST } from '../utils/scheduling.ts';
import { formatReadableDate, isValidIndianPhone, isValidOptionalEmail } from '../utils/validation.ts';
import type { Appointment, TimeSlotOption } from '../types/clinic.ts';

const STEP_LABELS = [
  'Select Service',
  'Select Doctor',
  'Select Date',
  'Select Time',
  'Patient Details',
  'Confirm',
];

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface BookingConfirmationPayload {
  appointment: Appointment;
  whatsappClickToChatUrl: string;
  whatsappSentAutomatically: boolean;
  emailSentAutomatically: boolean;
  googleCalendarUrl: string;
}

export function BookingPage() {
  const { clinic } = useClinic();
  const { search } = useRouter();
  const services = clinic?.services || [];
  const doctors = clinic?.doctors || [];

  const queryParams = useMemo(() => new URLSearchParams(search), [search]);
  const initialServiceId = Number(queryParams.get('service') || 0);
  const initialDoctorId = Number(queryParams.get('doctor') || 0);

  const [mode, setMode] = useState<'book' | 'lookup'>('book');
  const [step, setStep] = useState<number>(1);

  const [selectedServiceId, setSelectedServiceId] = useState<number>(initialServiceId);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(initialDoctorId);
  const [serviceSearch, setServiceSearch] = useState('');

  // Calendar state
  const todayIST = useMemo(() => getTodayIST(), []);
  const [viewMonth, setViewMonth] = useState(() => todayIST.slice(0, 7)); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [blockedDatesMap, setBlockedDatesMap] = useState<Map<string, string>>(new Map());
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Slots state
  const [slots, setSlots] = useState<TimeSlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotOption | null>(null);

  // Patient details
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientMessage, setPatientMessage] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Submission & confirmation
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmationPayload | null>(null);

  // Lookup state
  const [lookupRef, setLookupRef] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupResult, setLookupResult] = useState<Partial<Appointment> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Sync URL pre-selections once clinic data loads
  useEffect(() => {
    if (!services.length) return;
    if (initialServiceId && services.some((s) => s.id === initialServiceId)) {
      setSelectedServiceId(initialServiceId);
      const svc = services.find((s) => s.id === initialServiceId);
      if (initialDoctorId && svc?.doctors?.some((d) => d.id === initialDoctorId)) {
        setSelectedDoctorId(initialDoctorId);
        setStep(3);
      } else {
        setStep(2);
      }
    } else if (initialDoctorId && doctors.some((d) => d.id === initialDoctorId)) {
      setSelectedDoctorId(initialDoctorId);
    }
  }, [initialServiceId, initialDoctorId, services, doctors]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || null,
    [services, selectedServiceId]
  );

  const eligibleDoctors = useMemo(() => {
    if (!selectedService) return doctors;
    return selectedService.doctors && selectedService.doctors.length > 0
      ? selectedService.doctors
      : doctors.filter((d) => d.service_ids?.includes(selectedService.id));
  }, [selectedService, doctors]);

  const selectedDoctor = useMemo(
    () => eligibleDoctors.find((d) => d.id === selectedDoctorId) || null,
    [eligibleDoctors, selectedDoctorId]
  );

  // Fetch calendar blocked dates & closed weekdays
  useEffect(() => {
    if (!selectedDoctorId) return;
    let cancelled = false;
    setCalendarLoading(true);
    fetch(`/api/availability/calendar?doctorId=${selectedDoctorId}&month=${viewMonth}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const item of data.blockedDates || []) {
          map.set(item.blocked_date, item.reason);
        }
        setBlockedDatesMap(map);
        setClosedWeekdays(data.closedWeekdays || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDoctorId, viewMonth]);

  // Fetch dynamic time slots whenever date/doctor/service changes
  useEffect(() => {
    if (!selectedDoctorId || !selectedServiceId || !selectedDate) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    fetch(
      `/api/availability/slots?doctorId=${selectedDoctorId}&serviceId=${selectedServiceId}&date=${selectedDate}`
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load slots.');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.isDateBlocked) {
          setSlots([]);
          setSlotsError(data.blockedReason || 'Selected date is closed.');
        } else {
          setSlots(data.slots || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setSlotsError(err instanceof Error ? err.message : 'Unable to load slots.');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDoctorId, selectedServiceId, selectedDate]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [services, serviceSearch]);

  // Calendar grid days for viewMonth (YYYY-MM)
  const calendarDays = useMemo(() => {
    const [yearStr, monthStr] = viewMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr); // 1..12
    const firstDayOfWeek = getDayOfWeekIST(`${yearStr}-${monthStr}-01`);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const cells: Array<{ date: string; dayNum: number; disabled: boolean; reason?: string } | null> =
      [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
      const dow = getDayOfWeekIST(dateStr);
      const isPast = dateStr < todayIST;
      const isClosedDay = closedWeekdays.includes(dow);
      const blockedReason = blockedDatesMap.get(dateStr);
      const disabled = isPast || isClosedDay || Boolean(blockedReason);
      cells.push({
        date: dateStr,
        dayNum: d,
        disabled,
        reason: blockedReason || (isClosedDay ? 'Clinic closed' : undefined),
      });
    }
    return cells;
  }, [viewMonth, todayIST, closedWeekdays, blockedDatesMap]);

  const viewMonthLabel = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, 15)));
  }, [viewMonth]);

  const changeMonth = (delta: number) => {
    const [y, m] = viewMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (next < todayIST.slice(0, 7)) return;
    setViewMonth(next);
  };

  const morningSlots = useMemo(
    () => slots.filter((s) => s.sessionName.toLowerCase().includes('morning') || s.startTime < '14:00'),
    [slots]
  );
  const eveningSlots = useMemo(
    () => slots.filter((s) => !morningSlots.includes(s)),
    [slots, morningSlots]
  );

  const validatePatientStep = (): boolean => {
    const errs: Record<string, string> = {};
    if (patientName.trim().length < 2) {
      errs.patientName = 'Please enter your full name (at least 2 characters).';
    }
    if (!isValidIndianPhone(patientPhone)) {
      errs.patientPhone = 'Please enter a valid 10-digit mobile number.';
    }
    if (!isValidOptionalEmail(patientEmail)) {
      errs.patientEmail = 'Please enter a valid email address or leave it blank.';
    }
    if (!consentGiven) {
      errs.consentGiven = 'Please confirm consent so we can coordinate your appointment.';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !selectedDoctor || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim(),
          patientEmail: patientEmail.trim(),
          doctorId: selectedDoctor.id,
          serviceId: selectedService.id,
          appointmentDate: selectedDate,
          startTime: selectedSlot.startTime,
          patientMessage: patientMessage.trim(),
          consentGiven,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not confirm your appointment.');
      }
      setConfirmation(data as BookingConfirmationPayload);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to book appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await fetch(
        `/api/appointments/lookup?ref=${encodeURIComponent(lookupRef.trim())}&phone=${encodeURIComponent(
          lookupPhone.trim()
        )}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking not found.');
      setLookupResult(data.appointment);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setLookupLoading(false);
    }
  };

  const resetWizard = () => {
    setConfirmation(null);
    setStep(1);
    setSelectedDate('');
    setSelectedSlot(null);
    setPatientName('');
    setPatientPhone('');
    setPatientEmail('');
    setPatientMessage('');
    setConsentGiven(false);
    setSubmitError(null);
  };

  return (
    <div className="bg-[#F7FAFA] min-h-[82vh] py-10 sm:py-14">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page Header + Mode Switch */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[#087F8C]">Online Appointment Scheduling</p>
            <h1 className="font-heading text-3xl sm:text-4xl font-semibold text-[#18323B] tracking-tight">
              Book Your Appointment
            </h1>
            <p className="text-sm text-[#71818A]">
              All appointment times are displayed in Indian Standard Time (IST).
            </p>
          </div>

          <div className="inline-flex p-1 rounded-lg bg-white border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode('book')}
              className={`px-4 py-2 rounded-md text-xs font-heading font-medium transition-colors whitespace-nowrap ${
                mode === 'book'
                  ? 'bg-[#087F8C] text-white'
                  : 'text-[#71818A] hover:text-[#18323B]'
              }`}
            >
              New Booking
            </button>
            <button
              type="button"
              onClick={() => setMode('lookup')}
              className={`px-4 py-2 rounded-md text-xs font-heading font-medium transition-colors whitespace-nowrap ${
                mode === 'lookup'
                  ? 'bg-[#087F8C] text-white'
                  : 'text-[#71818A] hover:text-[#18323B]'
              }`}
            >
              Check Booking Status
            </button>
          </div>
        </div>

        {/* BOOKING LOOKUP MODE */}
        {mode === 'lookup' ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                Check Appointment Status
              </h2>
              <p className="text-sm text-[#71818A]">
                Enter your booking reference (e.g., SADC-261120-A1B2) and mobile number to view your current appointment status.
              </p>
            </div>
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lookup-ref" className="block text-xs font-medium text-[#18323B] mb-1">
                    Booking Reference *
                  </label>
                  <input
                    id="lookup-ref"
                    type="text"
                    required
                    value={lookupRef}
                    onChange={(e) => setLookupRef(e.target.value)}
                    placeholder="SADC-XXXXXX-XXXX"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="lookup-phone" className="block text-xs font-medium text-[#18323B] mb-1">
                    Registered Mobile Number *
                  </label>
                  <input
                    id="lookup-phone"
                    type="tel"
                    required
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="px-5 py-2.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium disabled:opacity-60"
              >
                {lookupLoading ? 'Checking...' : 'Check Status'}
              </button>
            </form>

            {lookupError && (
              <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="p-5 rounded-xl bg-[#F7FAFA] border border-slate-200 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
                  <span className="font-mono font-medium text-[#18323B] tabular-nums">
                    {lookupResult.booking_ref}
                  </span>
                  <span className="font-heading font-semibold text-[#087F8C]">
                    Status: {lookupResult.status}
                  </span>
                </div>
                <p>
                  <span className="text-[#71818A]">Patient:</span>{' '}
                  <strong className="text-[#18323B]">{lookupResult.patient_name}</strong>
                </p>
                <p>
                  <span className="text-[#71818A]">Service:</span>{' '}
                  <strong className="text-[#18323B]">{lookupResult.service_name}</strong>
                </p>
                <p>
                  <span className="text-[#71818A]">Doctor:</span>{' '}
                  <strong className="text-[#18323B]">{lookupResult.doctor_name}</strong>
                </p>
                <p className="tabular-nums">
                  <span className="text-[#71818A]">Date & Time:</span>{' '}
                  <strong className="text-[#18323B]">
                    {lookupResult.appointment_date
                      ? formatReadableDate(lookupResult.appointment_date)
                      : ''}{' '}
                    at {lookupResult.start_time} IST
                  </strong>
                </p>
              </div>
            )}
          </div>
        ) : confirmation ? (
          /* CONFIRMED / SAVED SCREEN */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#DFF5F3] text-[#087F8C] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#087F8C]">
                  Appointment Request Saved · Status: {confirmation.appointment.status}
                </p>
                <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-[#18323B]">
                  Thank You, {confirmation.appointment.patient_name}
                </h2>
                <p className="text-sm text-[#71818A]">
                  Your slot has been reserved in our schedule. Please keep your booking reference for your visit or if you need to reschedule.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#F7FAFA] border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              <div>
                <p className="text-xs text-[#71818A]">Booking Reference</p>
                <p className="font-mono text-lg font-semibold text-[#087F8C] tabular-nums mt-0.5">
                  {confirmation.appointment.booking_ref}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Appointment Status</p>
                <p className="font-heading text-base font-semibold text-[#18323B] mt-0.5">
                  {confirmation.appointment.status} (Awaiting Clinic Confirmation)
                </p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Dental Service</p>
                <p className="font-medium text-[#18323B] mt-0.5">
                  {confirmation.appointment.service_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Specialist Doctor</p>
                <p className="font-medium text-[#18323B] mt-0.5">
                  {confirmation.appointment.doctor_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Date (IST)</p>
                <p className="font-medium text-[#18323B] tabular-nums mt-0.5">
                  {formatReadableDate(confirmation.appointment.appointment_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Time Slot (IST)</p>
                <p className="font-medium text-[#18323B] tabular-nums mt-0.5">
                  {selectedSlot?.label || confirmation.appointment.start_time} IST
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href={confirmation.whatsappClickToChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium transition-colors"
              >
                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                Send Confirmation via WhatsApp
              </a>
              <a
                href={confirmation.googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 hover:border-[#087F8C] text-[#18323B] font-heading text-sm font-medium transition-colors"
              >
                <CalendarIcon className="w-4 h-4" aria-hidden="true" />
                Add to Google Calendar
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={resetWizard}
                className="px-4 py-3 rounded-lg text-sm font-medium text-[#71818A] hover:text-[#18323B]"
              >
                Book Another Appointment
              </button>
            </div>
          </div>
        ) : (
          /* 6-STEP WIZARD */
          <div className="space-y-6">
            {/* Step Progress Indicator */}
            <nav aria-label="Booking progress" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <ol className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                {STEP_LABELS.map((label, idx) => {
                  const num = idx + 1;
                  const current = step === num;
                  const done = step > num;
                  return (
                    <li key={label}>
                      <button
                        type="button"
                        disabled={!done}
                        onClick={() => done && setStep(num)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                          current
                            ? 'border-[#087F8C] bg-[#DFF5F3]/50 text-[#18323B]'
                            : done
                            ? 'border-slate-200 bg-white text-[#087F8C] hover:border-[#087F8C]/50'
                            : 'border-transparent bg-slate-50 text-[#71818A] cursor-default'
                        }`}
                      >
                        <span className="block font-mono text-[11px] tabular-nums">
                          Step {num}
                        </span>
                        <span className="block font-heading text-xs font-semibold truncate mt-0.5">
                          {label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
              {/* STEP 1: SELECT SERVICE */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                        1. Choose a Dental Service
                      </h2>
                      <p className="text-sm text-[#71818A] mt-1">
                        Select the treatment or consultation you would like to book.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search
                        className="w-4 h-4 text-[#71818A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Search service..."
                        aria-label="Filter dental services"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredServices.map((svc) => {
                      const active = selectedServiceId === svc.id;
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => {
                            setSelectedServiceId(svc.id);
                            setSelectedSlot(null);
                            // If current doctor doesn't offer this service, clear doctor selection
                            const docs = svc.doctors || [];
                            if (docs.length === 1) {
                              setSelectedDoctorId(docs[0].id);
                            } else if (!docs.some((d) => d.id === selectedDoctorId)) {
                              setSelectedDoctorId(0);
                            }
                            setStep(2);
                          }}
                          className={`text-left p-4 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                            active
                              ? 'border-[#087F8C] bg-[#DFF5F3]/40'
                              : 'border-slate-200 hover:border-[#087F8C]/50 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-heading text-base font-semibold text-[#18323B]">
                              {svc.name}
                            </span>
                            <span className="text-xs font-mono text-[#087F8C] tabular-nums whitespace-nowrap">
                              {svc.duration_minutes} min
                            </span>
                          </div>
                          <p className="text-xs text-[#71818A]">
                            {svc.category}
                            {svc.price_inr !== null
                              ? ` · ₹${svc.price_inr.toLocaleString('en-IN')}`
                              : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: SELECT DOCTOR */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                      2. Select a Specialist Doctor
                    </h2>
                    <p className="text-sm text-[#71818A] mt-1">
                      Showing doctors available for{' '}
                      <strong className="text-[#18323B]">{selectedService?.name}</strong>.
                    </p>
                  </div>

                  {eligibleDoctors.length === 0 ? (
                    <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                      No active doctor is currently assigned to this service. Please select another service or call {clinic?.settings?.phone || '+91 90368 27916'}.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {eligibleDoctors.map((doc) => {
                        const active = selectedDoctorId === doc.id;
                        return (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => {
                              setSelectedDoctorId(doc.id);
                              setSelectedSlot(null);
                              setStep(3);
                            }}
                            className={`text-left p-5 rounded-xl border transition-colors space-y-2 ${
                              active
                                ? 'border-[#087F8C] bg-[#DFF5F3]/40'
                                : 'border-slate-200 hover:border-[#087F8C]/50 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-heading text-lg font-semibold text-[#18323B]">
                                {doc.name}
                              </span>
                              <UserCheck className="w-5 h-5 text-[#087F8C] shrink-0" aria-hidden="true" />
                            </div>
                            <p className="text-sm font-medium text-[#087F8C]">{doc.specialization}</p>
                            {doc.consultation_timings && (
                              <p className="text-xs text-[#71818A] tabular-nums">
                                {doc.consultation_timings}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-[#18323B]"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Back
                    </button>
                    {selectedDoctor && (
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-sm font-medium"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: SELECT DATE */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                      3. Choose Appointment Date
                    </h2>
                    <p className="text-sm text-[#71818A] mt-1">
                      {selectedService?.name} with {selectedDoctor?.name}. Past dates and clinic holidays are automatically disabled.
                    </p>
                  </div>

                  <div className="max-w-md border border-slate-200 rounded-2xl p-4 sm:p-5 bg-[#F7FAFA]/60">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        disabled={viewMonth <= todayIST.slice(0, 7)}
                        aria-label="Previous month"
                        className="w-10 h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-[#18323B] disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <span className="font-heading text-base font-semibold text-[#18323B]">
                        {viewMonthLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        aria-label="Next month"
                        className="w-10 h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-[#18323B]"
                      >
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[#71818A] mb-2">
                      {WEEKDAY_HEADERS.map((w) => (
                        <div key={w} className="py-1">
                          {w}
                        </div>
                      ))}
                    </div>

                    {calendarLoading ? (
                      <div className="h-56 rounded-xl bg-white border border-slate-100 animate-pulse" />
                    ) : (
                      <div className="grid grid-cols-7 gap-1.5">
                        {calendarDays.map((cell, idx) => {
                          if (!cell) return <div key={`empty-${idx}`} />;
                          const isSelected = selectedDate === cell.date;
                          const isToday = cell.date === todayIST;
                          return (
                            <button
                              key={cell.date}
                              type="button"
                              disabled={cell.disabled}
                              title={cell.reason}
                              aria-label={`Select ${formatReadableDate(cell.date)}${
                                cell.reason ? ` (${cell.reason})` : ''
                              }`}
                              onClick={() => {
                                setSelectedDate(cell.date);
                                setSelectedSlot(null);
                                setStep(4);
                              }}
                              className={`h-11 rounded-lg text-sm font-medium tabular-nums transition-colors ${
                                isSelected
                                  ? 'bg-[#087F8C] text-white'
                                  : cell.disabled
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                                  : isToday
                                  ? 'bg-[#DFF5F3] text-[#087F8C] border border-[#087F8C]/40 hover:bg-[#087F8C] hover:text-white'
                                  : 'bg-white border border-slate-200 text-[#18323B] hover:border-[#087F8C] hover:text-[#087F8C]'
                              }`}
                            >
                              {cell.dayNum}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-[#18323B]"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Back
                    </button>
                    {selectedDate && (
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-sm font-medium"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 4: SELECT TIME SLOT */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                        4. Select an Available Time Slot
                      </h2>
                      <p className="text-sm text-[#71818A] mt-1">
                        {formatReadableDate(selectedDate)} · {selectedDoctor?.name} ·{' '}
                        {selectedService?.name} ({selectedService?.duration_minutes} mins)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-xs font-medium text-[#087F8C] hover:underline"
                    >
                      Change date
                    </button>
                  </div>

                  {slotsLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <div key={n} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  ) : slotsError ? (
                    <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                      {slotsError}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="p-8 rounded-xl bg-[#F7FAFA] border border-slate-200 text-center space-y-3">
                      <Clock className="w-6 h-6 text-[#71818A] mx-auto" aria-hidden="true" />
                      <p className="font-heading text-base font-semibold text-[#18323B]">
                        No open appointment slots remain for {formatReadableDate(selectedDate)}.
                      </p>
                      <p className="text-sm text-[#71818A]">
                        Please choose another date on the calendar.
                      </p>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="px-4 py-2 rounded-lg bg-[#087F8C] text-white text-sm font-medium"
                      >
                        Pick Another Date
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {morningSlots.length > 0 && (
                        <div className="space-y-2.5">
                          <h3 className="font-heading text-sm font-semibold text-[#18323B]">
                            Morning Session
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {morningSlots.map((slot) => {
                              const active = selectedSlot?.startTime === slot.startTime;
                              return (
                                <button
                                  key={slot.startTime}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSlot(slot);
                                    setStep(5);
                                  }}
                                  className={`py-3 px-3 rounded-lg border text-sm font-medium tabular-nums transition-colors ${
                                    active
                                      ? 'bg-[#087F8C] text-white border-[#087F8C]'
                                      : 'bg-white border-slate-200 text-[#18323B] hover:border-[#087F8C] hover:text-[#087F8C]'
                                  }`}
                                >
                                  {slot.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {eveningSlots.length > 0 && (
                        <div className="space-y-2.5">
                          <h3 className="font-heading text-sm font-semibold text-[#18323B]">
                            Evening Session
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {eveningSlots.map((slot) => {
                              const active = selectedSlot?.startTime === slot.startTime;
                              return (
                                <button
                                  key={slot.startTime}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSlot(slot);
                                    setStep(5);
                                  }}
                                  className={`py-3 px-3 rounded-lg border text-sm font-medium tabular-nums transition-colors ${
                                    active
                                      ? 'bg-[#087F8C] text-white border-[#087F8C]'
                                      : 'bg-white border-slate-200 text-[#18323B] hover:border-[#087F8C] hover:text-[#087F8C]'
                                  }`}
                                >
                                  {slot.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-[#18323B]"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: PATIENT DETAILS */}
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                      5. Enter Patient Details
                    </h2>
                    <p className="text-sm text-[#71818A] mt-1">
                      We collect only essential details needed to coordinate your visit.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#DFF5F3]/40 border border-[#087F8C]/20 text-xs sm:text-sm text-[#18323B] flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <strong>{selectedService?.name}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedDoctor?.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatReadableDate(selectedDate)} at {selectedSlot?.label} IST
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label
                        htmlFor="patient-name"
                        className="block text-sm font-medium text-[#18323B] mb-1.5"
                      >
                        Patient Full Name *
                      </label>
                      <input
                        id="patient-name"
                        type="text"
                        required
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Enter full name"
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                      />
                      {formErrors.patientName && (
                        <p className="text-xs text-red-700 mt-1">{formErrors.patientName}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="patient-phone"
                        className="block text-sm font-medium text-[#18323B] mb-1.5"
                      >
                        Mobile Number *
                      </label>
                      <input
                        id="patient-phone"
                        type="tel"
                        required
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                      />
                      {formErrors.patientPhone && (
                        <p className="text-xs text-red-700 mt-1">{formErrors.patientPhone}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="patient-email"
                        className="block text-sm font-medium text-[#18323B] mb-1.5"
                      >
                        Email Address (Optional)
                      </label>
                      <input
                        id="patient-email"
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                      />
                      {formErrors.patientEmail && (
                        <p className="text-xs text-red-700 mt-1">{formErrors.patientEmail}</p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="patient-message"
                        className="block text-sm font-medium text-[#18323B] mb-1.5"
                      >
                        Additional Message (Optional)
                      </label>
                      <input
                        id="patient-message"
                        type="text"
                        value={patientMessage}
                        onChange={(e) => setPatientMessage(e.target.value)}
                        placeholder="Brief note (e.g., child's age or preferred callback time)"
                        className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-[#18323B]"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentGiven}
                        onChange={(e) => setConsentGiven(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-[#087F8C]"
                      />
                      <span className="text-xs sm:text-sm text-[#71818A] leading-relaxed">
                        I consent to Smile Architect Dental Clinic using my contact details to coordinate this dental appointment in accordance with the{' '}
                        <Link to="/privacy-policy" className="text-[#087F8C] underline">
                          Privacy Policy
                        </Link>{' '}
                        and{' '}
                        <Link to="/terms" className="text-[#087F8C] underline">
                          Cancellation Policy
                        </Link>
                        .
                      </span>
                    </label>
                    {formErrors.consentGiven && (
                      <p className="text-xs text-red-700 mt-1">{formErrors.consentGiven}</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-[#18323B]"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (validatePatientStep()) setStep(6);
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium"
                    >
                      Review Booking
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 6: REVIEW & CONFIRM */}
              {step === 6 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-[#18323B]">
                      6. Review & Confirm Appointment
                    </h2>
                    <p className="text-sm text-[#71818A] mt-1">
                      Please verify your appointment details before confirming.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#F7FAFA] border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-[#71818A]">Service</p>
                      <p className="font-heading font-semibold text-[#18323B] mt-0.5">
                        {selectedService?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#71818A]">Doctor</p>
                      <p className="font-heading font-semibold text-[#18323B] mt-0.5">
                        {selectedDoctor?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#71818A]">Date (IST)</p>
                      <p className="font-medium text-[#18323B] tabular-nums mt-0.5">
                        {formatReadableDate(selectedDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#71818A]">Time Slot (IST)</p>
                      <p className="font-medium text-[#18323B] tabular-nums mt-0.5">
                        {selectedSlot?.label} ({selectedService?.duration_minutes} mins)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#71818A]">Patient Name</p>
                      <p className="font-medium text-[#18323B] mt-0.5">{patientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#71818A]">Mobile Number</p>
                      <p className="font-medium text-[#18323B] tabular-nums mt-0.5">
                        {patientPhone}
                      </p>
                    </div>
                    {patientEmail && (
                      <div>
                        <p className="text-xs text-[#71818A]">Email</p>
                        <p className="font-medium text-[#18323B] mt-0.5">{patientEmail}</p>
                      </div>
                    )}
                    {patientMessage && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-[#71818A]">Message</p>
                        <p className="text-[#18323B] mt-0.5">{patientMessage}</p>
                      </div>
                    )}
                  </div>

                  {submitError && (
                    <div
                      role="alert"
                      className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between gap-4"
                    >
                      <span>{submitError}</span>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="text-xs font-semibold underline shrink-0"
                      >
                        Choose another slot
                      </button>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-[#18323B]"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleConfirmBooking}
                      className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm sm:text-base font-medium disabled:opacity-60 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      {submitting ? 'Confirming Appointment...' : 'Confirm Appointment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
