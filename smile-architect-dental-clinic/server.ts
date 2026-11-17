import './server/env.ts';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initDatabase, UPLOADS_DIR } from './server/db.ts';
import {
  clearAdminSessionCookie,
  getAdminFromRequest,
  requireAdmin,
  setAdminSessionCookie,
  signSessionToken,
  verifyPassword,
  type AdminRequest,
} from './server/auth.ts';
import {
  computeEndTime,
  computeSlotsForDoctorServiceDate,
  generateBookingRef,
  getClinicSettingsMap,
  getEffectiveSessionsForDay,
  getHydratedDoctors,
  getHydratedServices,
  slugify,
} from './server/helpers.ts';
import { dispatchAppointmentNotifications } from './server/notifications.ts';
import {
  deleteAppointmentFromSupabase,
  fetchAppointmentsFromSupabase,
  getSupabaseStatus,
  syncAppointmentToSupabase,
  syncEnquiryToSupabase,
  updateAppointmentInSupabase,
} from './server/supabase.ts';
import { getTodayIST, timeToMinutes } from './src/utils/scheduling.ts';
import {
  buildGoogleCalendarUrl,
  escapeCsvCell,
  isValidIndianPhone,
  isValidOptionalEmail,
  isValidRequiredEmail,
  normalizeIndianPhone,
} from './src/utils/validation.ts';
import type { Appointment, ServiceCategory } from './src/types/clinic.ts';

initDatabase();

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);
const VALID_CATEGORIES: ServiceCategory[] = [
  'General Dental Care',
  'Cosmetic Dentistry',
  'Pediatric Dentistry',
  'Orthodontics',
  'Dental Surgery',
  'Restorative Dentistry',
];

app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));

// ==========================================
// PUBLIC SEO ROUTES
// ==========================================
app.get('/robots.txt', (_req, res) => {
  const baseUrl = process.env.APP_URL || 'https://smilearchitect.in';
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl =
    process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  const staticPaths = [
    '/',
    '/about',
    '/doctors',
    '/services',
    '/book',
    '/gallery',
    '/contact',
    '/privacy-policy',
    '/terms',
  ];
  const services = db
    .prepare('SELECT slug FROM services WHERE is_active = 1 ORDER BY sort_order ASC')
    .all() as Array<{ slug: string }>;

  const urls = [
    ...staticPaths.map((p) => `${baseUrl}${p}`),
    ...services.map((s) => `${baseUrl}/services/${s.slug}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc></url>`)
    .join('\n')}\n</urlset>`;
  res.type('application/xml').send(xml);
});

// ==========================================
// PUBLIC API ROUTES
// ==========================================
app.get('/api/clinic', (_req, res) => {
  try {
    const settings = getClinicSettingsMap();
    const doctors = getHydratedDoctors(false);
    const services = getHydratedServices(false);
    const availability = db
      .prepare('SELECT * FROM availability WHERE doctor_id IS NULL ORDER BY day_of_week ASC, start_time ASC')
      .all();
    const gallery = db
      .prepare('SELECT * FROM gallery WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
      .all();
    const testimonials = db
      .prepare('SELECT * FROM testimonials WHERE is_approved = 1 ORDER BY id DESC')
      .all();

    res.json({
      settings,
      doctors,
      services,
      availability,
      gallery,
      testimonials,
    });
  } catch (err) {
    console.error('Failed to load clinic payload:', err);
    res.status(500).json({ error: 'Unable to load clinic information.' });
  }
});

app.get('/api/doctors', (_req, res) => {
  try {
    res.json({ doctors: getHydratedDoctors(false) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch doctors.' });
  }
});

app.get('/api/services', (_req, res) => {
  try {
    res.json({ services: getHydratedServices(false) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch services.' });
  }
});

app.get('/api/services/:slug', (req, res) => {
  try {
    const services = getHydratedServices(false);
    const service = services.find((s) => s.slug === req.params.slug);
    if (!service) {
      res.status(404).json({ error: 'Service not found.' });
      return;
    }
    res.json({ service });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch service details.' });
  }
});

app.get('/api/availability/calendar', (req, res) => {
  try {
    const doctorId = Number(req.query.doctorId || 0);
    const month = String(req.query.month || '').trim(); // YYYY-MM
    const todayIST = getTodayIST();

    const blockedDates = db
      .prepare(
        doctorId > 0
          ? 'SELECT blocked_date, reason FROM blocked_dates WHERE (doctor_id IS NULL OR doctor_id = ?) AND blocked_date >= ?'
          : 'SELECT blocked_date, reason FROM blocked_dates WHERE doctor_id IS NULL AND blocked_date >= ?'
      )
      .all(...(doctorId > 0 ? [doctorId, todayIST] : [todayIST])) as Array<{
      blocked_date: string;
      reason: string;
    }>;

    // Determine closed days of week (0..6 where no sessions are enabled)
    const closedWeekdays: number[] = [];
    for (let dow = 0; dow <= 6; dow++) {
      const sessions =
        doctorId > 0
          ? getEffectiveSessionsForDay(doctorId, dow)
          : (db
              .prepare(
                'SELECT * FROM availability WHERE doctor_id IS NULL AND day_of_week = ?'
              )
              .all(dow) as Array<{ is_enabled: number }>);
      const anyEnabled = sessions.some((s) => s.is_enabled === 1);
      if (!anyEnabled) closedWeekdays.push(dow);
    }

    const filteredBlocked = month
      ? blockedDates.filter((b) => b.blocked_date.startsWith(month))
      : blockedDates;

    res.json({
      todayIST,
      blockedDates: filteredBlocked,
      closedWeekdays,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch calendar availability.' });
  }
});

app.get('/api/availability/slots', (req, res) => {
  try {
    const doctorId = Number(req.query.doctorId);
    const serviceId = Number(req.query.serviceId);
    const date = String(req.query.date || '').trim();

    if (!doctorId || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'doctorId, serviceId, and valid date (YYYY-MM-DD) are required.' });
      return;
    }

    const result = computeSlotsForDoctorServiceDate({ doctorId, serviceId, date });
    res.json(result);
  } catch (err) {
    console.error('Slot calculation failed:', err);
    res.status(500).json({ error: 'Unable to calculate available appointment slots.' });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const {
      patientName,
      patientPhone,
      patientEmail = '',
      doctorId,
      serviceId,
      appointmentDate,
      startTime,
      patientMessage = '',
      consentGiven,
    } = req.body ?? {};

    const cleanName = String(patientName || '').trim();
    const cleanPhoneRaw = String(patientPhone || '').trim();
    const cleanEmail = String(patientEmail || '').trim();
    const cleanDate = String(appointmentDate || '').trim();
    const cleanStartTime = String(startTime || '').trim();
    const cleanMessage = String(patientMessage || '').trim().slice(0, 800);
    const numDoctorId = Number(doctorId);
    const numServiceId = Number(serviceId);

    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Please enter the patient’s full name (at least 2 characters).' });
      return;
    }
    if (!isValidIndianPhone(cleanPhoneRaw)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      return;
    }
    if (!isValidOptionalEmail(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address or leave it blank.' });
      return;
    }
    if (!numDoctorId || !numServiceId) {
      res.status(400).json({ error: 'Please select both a service and a doctor.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      res.status(400).json({ error: 'Please select a valid appointment date.' });
      return;
    }
    if (timeToMinutes(cleanStartTime) < 0) {
      res.status(400).json({ error: 'Please select a valid appointment time slot.' });
      return;
    }
    if (consentGiven !== true) {
      res.status(400).json({
        error: 'Consent is required before submitting personal contact details.',
      });
      return;
    }

    const normalizedPhone = normalizeIndianPhone(cleanPhoneRaw);

    // Atomic transaction with IMMEDIATE lock prevents concurrent double-bookings
    const createBookingTx = db.transaction(() => {
      const availabilityCheck = computeSlotsForDoctorServiceDate({
        doctorId: numDoctorId,
        serviceId: numServiceId,
        date: cleanDate,
      });

      if (availabilityCheck.isDateBlocked) {
        return {
          ok: false as const,
          status: 409,
          error: availabilityCheck.blockedReason || 'Selected date is unavailable.',
        };
      }

      const matchingSlot = availabilityCheck.slots.find((s) => s.startTime === cleanStartTime);
      if (!matchingSlot) {
        return {
          ok: false as const,
          status: 409,
          error: 'The selected time slot is no longer available. Please choose another slot.',
        };
      }

      const endTime = matchingSlot.endTime;
      const bookingRef = generateBookingRef(cleanDate);

      const insertRes = db
        .prepare(
          `INSERT INTO appointments (
            booking_ref, patient_name, patient_phone, patient_email,
            doctor_id, service_id, appointment_date, start_time, end_time,
            status, patient_message, consent_given
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, 1)`
        )
        .run(
          bookingRef,
          cleanName,
          normalizedPhone,
          cleanEmail,
          numDoctorId,
          numServiceId,
          cleanDate,
          cleanStartTime,
          endTime,
          cleanMessage
        );

      const created = db
        .prepare(
          `SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization,
                  s.name as service_name, s.category as service_category
           FROM appointments a
           JOIN doctors d ON d.id = a.doctor_id
           JOIN services s ON s.id = a.service_id
           WHERE a.id = ?`
        )
        .get(insertRes.lastInsertRowid) as Appointment;

      return { ok: true as const, appointment: created };
    });

    const txResult = createBookingTx.immediate();
    if (!txResult.ok) {
      res.status(txResult.status).json({ error: txResult.error });
      return;
    }

    const appt = txResult.appointment;
    const supabaseSync = await syncAppointmentToSupabase(appt);
    if (supabaseSync.synced) {
      db.prepare('UPDATE appointments SET supabase_synced = 1 WHERE id = ?').run(appt.id);
      appt.supabase_synced = 1;
    }

    const settings = getClinicSettingsMap();

    const notificationResult = await dispatchAppointmentNotifications({
      clinicName: settings.clinic_name,
      clinicPhone: settings.phone,
      clinicAddress: settings.address,
      bookingRef: appt.booking_ref,
      patientName: appt.patient_name,
      patientPhone: appt.patient_phone,
      patientEmail: appt.patient_email,
      doctorName: appt.doctor_name || '',
      serviceName: appt.service_name || '',
      appointmentDate: appt.appointment_date,
      startTime: appt.start_time,
      status: appt.status,
    });

    const googleCalendarUrl = buildGoogleCalendarUrl({
      title: `${appt.service_name} – ${settings.clinic_name}`,
      date: appt.appointment_date,
      startTime: appt.start_time,
      endTime: appt.end_time,
      location: settings.address,
      description: `Booking Reference: ${appt.booking_ref}\nDoctor: ${appt.doctor_name}\nClinic Phone: ${settings.phone}`,
    });

    res.status(201).json({
      appointment: appt,
      supabaseSynced: supabaseSync.synced,
      whatsappClickToChatUrl: notificationResult.whatsappClickToChatUrl,
      whatsappSentAutomatically: notificationResult.whatsappSentAutomatically,
      emailSentAutomatically: notificationResult.emailSentAutomatically,
      googleCalendarUrl,
    });
  } catch (err) {
    console.error('Appointment creation error:', err);
    res.status(500).json({ error: 'Unable to save appointment. Please try again.' });
  }
});

app.get('/api/appointments/lookup', (req, res) => {
  try {
    const ref = String(req.query.ref || '').trim().toUpperCase();
    const phoneDigits = String(req.query.phone || '').replace(/\D/g, '');
    if (!ref || phoneDigits.length < 4) {
      res.status(400).json({
        error: 'Booking reference and at least the last 4 digits of the mobile number are required.',
      });
      return;
    }

    const appt = db
      .prepare(
        `SELECT a.booking_ref, a.patient_name, a.patient_phone, a.appointment_date,
                a.start_time, a.end_time, a.status,
                d.name as doctor_name, d.specialization as doctor_specialization,
                s.name as service_name
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN services s ON s.id = a.service_id
         WHERE UPPER(a.booking_ref) = ?`
      )
      .get(ref) as (Appointment & { patient_phone: string }) | undefined;

    if (!appt) {
      res.status(404).json({ error: 'No appointment found for that booking reference.' });
      return;
    }

    const storedDigits = appt.patient_phone.replace(/\D/g, '');
    const last4Query = phoneDigits.slice(-4);
    if (!storedDigits.endsWith(last4Query)) {
      res.status(403).json({ error: 'Phone number does not match this booking reference.' });
      return;
    }

    res.json({
      appointment: {
        booking_ref: appt.booking_ref,
        patient_name: appt.patient_name,
        appointment_date: appt.appointment_date,
        start_time: appt.start_time,
        end_time: appt.end_time,
        status: appt.status,
        doctor_name: appt.doctor_name,
        doctor_specialization: appt.doctor_specialization,
        service_name: appt.service_name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to look up appointment.' });
  }
});

app.post('/api/enquiries', async (req, res) => {
  try {
    const { name, phone, email = '', message } = req.body ?? {};
    const cleanName = String(name || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanEmail = String(email || '').trim();
    const cleanMsg = String(message || '').trim();

    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Please enter your name.' });
      return;
    }
    if (!isValidIndianPhone(cleanPhone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit Indian phone number.' });
      return;
    }
    if (!isValidOptionalEmail(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (cleanMsg.length < 5) {
      res.status(400).json({ error: 'Please enter your message (at least 5 characters).' });
      return;
    }

    const normalizedPhone = normalizeIndianPhone(cleanPhone);
    const trimmedMessage = cleanMsg.slice(0, 1500);
    const result = db
      .prepare('INSERT INTO enquiries (name, phone, email, message, status) VALUES (?, ?, ?, ?, ?)')
      .run(cleanName, normalizedPhone, cleanEmail, trimmedMessage, 'New');

    const supabaseSync = await syncEnquiryToSupabase({
      name: cleanName,
      phone: normalizedPhone,
      email: cleanEmail,
      message: trimmedMessage,
      status: 'New',
    });

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      supabaseSynced: supabaseSync.synced,
      message: 'Your enquiry has been received by Smile Architect Dental Clinic.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to submit enquiry right now.' });
  }
});

app.post('/api/testimonials/submit', (req, res) => {
  try {
    const { patientName, treatment = '', quote, visitDate = '' } = req.body ?? {};
    const cleanName = String(patientName || '').trim();
    const cleanTreatment = String(treatment || '').trim();
    const cleanQuote = String(quote || '').trim();
    const cleanVisitDate = String(visitDate || '').trim();

    if (cleanName.length < 2 || cleanQuote.length < 10) {
      res.status(400).json({ error: 'Please provide your name and feedback (at least 10 characters).' });
      return;
    }

    db.prepare(
      'INSERT INTO testimonials (patient_name, treatment, quote, visit_date, is_approved) VALUES (?, ?, ?, ?, 0)'
    ).run(cleanName, cleanTreatment, cleanQuote.slice(0, 600), cleanVisitDate);

    res.status(201).json({
      message: 'Thank you. Your feedback has been submitted for verification by the clinic.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to submit feedback.' });
  }
});

// ==========================================
// ADMIN AUTHENTICATION ROUTES
// ==========================================
app.get('/api/admin/session', (req, res) => {
  const session = getAdminFromRequest(req);
  if (!session) {
    res.json({ authenticated: false, admin: null });
    return;
  }
  res.json({ authenticated: true, admin: session });
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');

    if (!isValidRequiredEmail(cleanEmail) || !cleanPassword) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.password_hash, a.is_active
         FROM users u
         JOIN administrators a ON a.user_id = u.id
         WHERE LOWER(u.email) = ?`
      )
      .get(cleanEmail) as
      | {
          id: number;
          email: string;
          name: string;
          role: string;
          password_hash: string;
          is_active: number;
        }
      | undefined;

    if (!user || !user.is_active || !verifyPassword(cleanPassword, user.password_hash)) {
      res.status(401).json({ error: 'Invalid administrator email or password.' });
      return;
    }

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    setAdminSessionCookie(res, token, req);

    res.json({
      authenticated: true,
      token,
      admin: { userId: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminSessionCookie(res, req);
  res.json({ ok: true });
});

// ==========================================
// PROTECTED ADMIN ROUTES
// ==========================================
async function syncAppointmentsWithSupabase(): Promise<void> {
  try {
    // 1. Pull remote Supabase appointments (when readable via SUPABASE_SECRET_KEY) and import any missing booking_refs
    const { rows: remoteRows, accessible } = await fetchAppointmentsFromSupabase();
    if (accessible && remoteRows.length > 0) {
      const doctors = db.prepare('SELECT id, name FROM doctors').all() as Array<{ id: number; name: string }>;
      const services = db.prepare('SELECT id, name FROM services').all() as Array<{ id: number; name: string }>;
      const fallbackDocId = doctors[0]?.id || 1;
      const fallbackSvcId = services[0]?.id || 1;

      const findDocId = (row: (typeof remoteRows)[number]) => {
        if (row.doctor_id && doctors.some((d) => d.id === Number(row.doctor_id))) {
          return Number(row.doctor_id);
        }
        const matched = doctors.find(
          (d) => d.name.toLowerCase() === String(row.doctor_name || '').trim().toLowerCase()
        );
        return matched?.id || fallbackDocId;
      };

      const findSvcId = (row: (typeof remoteRows)[number]) => {
        if (row.service_id && services.some((s) => s.id === Number(row.service_id))) {
          return Number(row.service_id);
        }
        const matched = services.find(
          (s) => s.name.toLowerCase() === String(row.service_name || '').trim().toLowerCase()
        );
        return matched?.id || fallbackSvcId;
      };

      const existsStmt = db.prepare('SELECT id FROM appointments WHERE booking_ref = ?');
      const insertRemoteStmt = db.prepare(
        `INSERT INTO appointments (
          booking_ref, patient_name, patient_phone, patient_email,
          doctor_id, service_id, appointment_date, start_time, end_time,
          status, patient_message, consent_given, supabase_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      );

      for (const r of remoteRows) {
        if (!r.booking_ref || !r.patient_name || !r.appointment_date || !r.start_time) continue;
        const existing = existsStmt.get(r.booking_ref);
        if (!existing) {
          const validStatus = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'].includes(r.status)
            ? r.status
            : 'Pending';
          insertRemoteStmt.run(
            r.booking_ref,
            r.patient_name,
            r.patient_phone || '',
            r.patient_email || '',
            findDocId(r),
            findSvcId(r),
            r.appointment_date,
            r.start_time,
            r.end_time || computeEndTime(r.start_time, 30),
            validStatus,
            r.patient_message || '',
            r.consent_given === false ? 0 : 1
          );
        }
      }
    }

    // 2. Push any unsynced local appointments to Supabase
    const unsynced = db
      .prepare(
        `SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization,
                s.name as service_name, s.category as service_category
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN services s ON s.id = a.service_id
         WHERE a.supabase_synced = 0`
      )
      .all() as Appointment[];

    for (const appt of unsynced) {
      const res = await syncAppointmentToSupabase(appt);
      if (res.synced) {
        db.prepare('UPDATE appointments SET supabase_synced = 1 WHERE id = ?').run(appt.id);
      } else {
        break;
      }
    }
  } catch (err) {
    console.warn('[Supabase] Bidirectional sync skipped:', err);
  }
}

app.get('/api/admin/overview', requireAdmin, async (_req: AdminRequest, res) => {
  try {
    await syncAppointmentsWithSupabase();
    const todayIST = getTodayIST();
    const totalAppointments = (
      db.prepare('SELECT COUNT(*) as c FROM appointments').get() as { c: number }
    ).c;
    const todayAppointments = (
      db
        .prepare("SELECT COUNT(*) as c FROM appointments WHERE appointment_date = ? AND status != 'Cancelled'")
        .get(todayIST) as { c: number }
    ).c;
    const pendingAppointments = (
      db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'Pending'").get() as {
        c: number;
      }
    ).c;
    const confirmedAppointments = (
      db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'Confirmed'").get() as {
        c: number;
      }
    ).c;
    const cancelledAppointments = (
      db.prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'Cancelled'").get() as {
        c: number;
      }
    ).c;
    const totalEnquiries = (
      db.prepare('SELECT COUNT(*) as c FROM enquiries').get() as { c: number }
    ).c;

    res.json({
      todayIST,
      supabase: getSupabaseStatus(),
      stats: {
        totalAppointments,
        todayAppointments,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        totalEnquiries,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load dashboard overview.' });
  }
});

app.get('/api/admin/appointments', requireAdmin, async (req: AdminRequest, res) => {
  try {
    await syncAppointmentsWithSupabase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const date = String(req.query.date || '').trim();
    const doctorId = Number(req.query.doctorId || 0);
    const serviceId = Number(req.query.serviceId || 0);
    const status = String(req.query.status || '').trim();

    let rows = db
      .prepare(
        `SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization,
                s.name as service_name, s.category as service_category
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN services s ON s.id = a.service_id
         ORDER BY a.appointment_date DESC, a.start_time ASC, a.id DESC`
      )
      .all() as Appointment[];

    if (date) rows = rows.filter((r) => r.appointment_date === date);
    if (doctorId > 0) rows = rows.filter((r) => r.doctor_id === doctorId);
    if (serviceId > 0) rows = rows.filter((r) => r.service_id === serviceId);
    if (status) rows = rows.filter((r) => r.status === status);
    if (search) {
      rows = rows.filter(
        (r) =>
          r.patient_name.toLowerCase().includes(search) ||
          r.patient_phone.toLowerCase().includes(search) ||
          r.booking_ref.toLowerCase().includes(search) ||
          (r.doctor_name || '').toLowerCase().includes(search) ||
          (r.service_name || '').toLowerCase().includes(search)
      );
    }

    res.json({ appointments: rows, supabase: getSupabaseStatus() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load appointments.' });
  }
});

app.get('/api/admin/appointments/export', requireAdmin, (_req: AdminRequest, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT a.booking_ref, a.patient_name, a.patient_phone, a.patient_email,
                d.name as doctor_name, s.name as service_name,
                a.appointment_date, a.start_time, a.end_time, a.status, a.patient_message, a.created_at
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN services s ON s.id = a.service_id
         ORDER BY a.appointment_date DESC, a.start_time ASC`
      )
      .all() as Array<Record<string, unknown>>;

    const headers = [
      'Booking Reference',
      'Patient Name',
      'Phone',
      'Email',
      'Doctor',
      'Service',
      'Date (IST)',
      'Start Time',
      'End Time',
      'Status',
      'Message',
      'Created At',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) =>
        [
          r.booking_ref,
          r.patient_name,
          r.patient_phone,
          r.patient_email,
          r.doctor_name,
          r.service_name,
          r.appointment_date,
          r.start_time,
          r.end_time,
          r.status,
          r.patient_message,
          r.created_at,
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="smile-architect-appointments-${getTodayIST()}.csv"`
    );
    res.send(lines.join('\r\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to export appointments.' });
  }
});

app.post('/api/admin/appointments', requireAdmin, async (req: AdminRequest, res) => {
  try {
    const {
      patientName,
      patientPhone,
      patientEmail = '',
      doctorId,
      serviceId,
      appointmentDate,
      startTime,
      status = 'Confirmed',
      patientMessage = '',
    } = req.body ?? {};

    const cleanName = String(patientName || '').trim();
    const cleanPhoneRaw = String(patientPhone || '').trim();
    const cleanEmail = String(patientEmail || '').trim();
    const cleanDate = String(appointmentDate || '').trim();
    const cleanStartTime = String(startTime || '').trim();
    const cleanMessage = String(patientMessage || '').trim().slice(0, 800);
    const numDoctorId = Number(doctorId);
    const numServiceId = Number(serviceId);
    const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'];
    const cleanStatus = validStatuses.includes(String(status)) ? String(status) : 'Confirmed';

    if (cleanName.length < 2) {
      res.status(400).json({ error: 'Patient full name must be at least 2 characters.' });
      return;
    }
    if (!isValidIndianPhone(cleanPhoneRaw)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      return;
    }
    if (!isValidOptionalEmail(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address or leave it blank.' });
      return;
    }
    if (!numDoctorId || !numServiceId) {
      res.status(400).json({ error: 'Please select both a service and a doctor.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || timeToMinutes(cleanStartTime) < 0) {
      res.status(400).json({ error: 'Valid appointment date (YYYY-MM-DD) and time (HH:MM) are required.' });
      return;
    }

    const normalizedPhone = normalizeIndianPhone(cleanPhoneRaw);

    const tx = db.transaction(() => {
      const svc = db
        .prepare('SELECT duration_minutes FROM services WHERE id = ?')
        .get(numServiceId) as { duration_minutes: number } | undefined;
      const doc = db.prepare('SELECT id FROM doctors WHERE id = ?').get(numDoctorId) as
        | { id: number }
        | undefined;
      if (!svc || !doc) {
        return { ok: false as const, status: 400, error: 'Selected doctor or service not found.' };
      }

      const endTime = computeEndTime(cleanStartTime, svc.duration_minutes || 30);

      if (cleanStatus !== 'Cancelled') {
        const settings = getClinicSettingsMap();
        const bufferMin = Math.max(0, Number(settings.buffer_minutes || 10));
        const candStart = timeToMinutes(cleanStartTime);
        const candEnd = timeToMinutes(endTime) + bufferMin;

        const conflicts = db
          .prepare(
            `SELECT start_time, end_time FROM appointments
             WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'`
          )
          .all(numDoctorId, cleanDate) as Array<{ start_time: string; end_time: string }>;

        const hasConflict = conflicts.some((c) => {
          const cs = timeToMinutes(c.start_time);
          const ce = timeToMinutes(c.end_time) + bufferMin;
          return candStart < ce && cs < candEnd;
        });

        if (hasConflict) {
          return {
            ok: false as const,
            status: 409,
            error: 'Target date/time overlaps another active appointment for this doctor.',
          };
        }
      }

      const bookingRef = generateBookingRef(cleanDate);
      const info = db
        .prepare(
          `INSERT INTO appointments (
            booking_ref, patient_name, patient_phone, patient_email,
            doctor_id, service_id, appointment_date, start_time, end_time,
            status, patient_message, consent_given
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .run(
          bookingRef,
          cleanName,
          normalizedPhone,
          cleanEmail,
          numDoctorId,
          numServiceId,
          cleanDate,
          cleanStartTime,
          endTime,
          cleanStatus,
          cleanMessage
        );

      const created = db
        .prepare(
          `SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization,
                  s.name as service_name, s.category as service_category
           FROM appointments a
           JOIN doctors d ON d.id = a.doctor_id
           JOIN services s ON s.id = a.service_id
           WHERE a.id = ?`
        )
        .get(info.lastInsertRowid) as Appointment;

      return { ok: true as const, appointment: created };
    });

    const result = tx.immediate();
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const appt = result.appointment;
    const syncRes = await syncAppointmentToSupabase(appt);
    if (syncRes.synced) {
      db.prepare('UPDATE appointments SET supabase_synced = 1 WHERE id = ?').run(appt.id);
      appt.supabase_synced = 1;
    }

    res.status(201).json({ appointment: appt, supabaseSynced: syncRes.synced });
  } catch (err) {
    console.error('Admin appointment creation error:', err);
    res.status(500).json({ error: 'Unable to create appointment.' });
  }
});

app.patch('/api/admin/appointments/:id', requireAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const {
      patientName,
      patientPhone,
      patientEmail,
      serviceId,
      doctorId,
      appointmentDate,
      startTime,
      status,
      patientMessage,
    } = req.body ?? {};
    const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'];

    const tx = db.transaction(() => {
      const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as
        | Appointment
        | undefined;
      if (!existing) {
        return { ok: false as const, status: 404, error: 'Appointment not found.' };
      }

      const nextName =
        patientName !== undefined ? String(patientName).trim() : existing.patient_name;
      if (nextName.length < 2) {
        return {
          ok: false as const,
          status: 400,
          error: 'Patient full name must be at least 2 characters.',
        };
      }

      let nextPhone = existing.patient_phone;
      if (patientPhone !== undefined) {
        const rawPhone = String(patientPhone).trim();
        if (!isValidIndianPhone(rawPhone)) {
          return {
            ok: false as const,
            status: 400,
            error: 'Please enter a valid 10-digit Indian mobile number.',
          };
        }
        nextPhone = normalizeIndianPhone(rawPhone);
      }

      const nextEmail =
        patientEmail !== undefined ? String(patientEmail).trim() : existing.patient_email;
      if (!isValidOptionalEmail(nextEmail)) {
        return {
          ok: false as const,
          status: 400,
          error: 'Please enter a valid email address or leave it blank.',
        };
      }

      const nextStatus = status ? String(status) : existing.status;
      if (!validStatuses.includes(nextStatus)) {
        return { ok: false as const, status: 400, error: 'Invalid appointment status.' };
      }

      const nextDate = appointmentDate ? String(appointmentDate).trim() : existing.appointment_date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
        return { ok: false as const, status: 400, error: 'Valid date (YYYY-MM-DD) is required.' };
      }

      const nextStart = startTime ? String(startTime).trim() : existing.start_time;
      if (timeToMinutes(nextStart) < 0) {
        return { ok: false as const, status: 400, error: 'Valid start time (HH:MM) is required.' };
      }

      const nextDoctorId = doctorId ? Number(doctorId) : existing.doctor_id;
      const nextServiceId = serviceId ? Number(serviceId) : existing.service_id;
      const nextMessage =
        patientMessage !== undefined
          ? String(patientMessage).trim().slice(0, 800)
          : existing.patient_message;

      const isReschedulingOrChangingService =
        nextDate !== existing.appointment_date ||
        nextStart !== existing.start_time ||
        nextDoctorId !== existing.doctor_id ||
        nextServiceId !== existing.service_id ||
        (existing.status === 'Cancelled' && nextStatus !== 'Cancelled');

      let nextEnd = existing.end_time;
      if (isReschedulingOrChangingService) {
        const svc = db
          .prepare('SELECT duration_minutes FROM services WHERE id = ?')
          .get(nextServiceId) as { duration_minutes: number } | undefined;
        const duration = svc?.duration_minutes || 30;
        nextEnd = computeEndTime(nextStart, duration);

        if (nextStatus !== 'Cancelled') {
          const settings = getClinicSettingsMap();
          const bufferMin = Math.max(0, Number(settings.buffer_minutes || 10));
          const candStart = timeToMinutes(nextStart);
          const candEnd = timeToMinutes(nextEnd) + bufferMin;

          const conflicts = db
            .prepare(
              `SELECT start_time, end_time FROM appointments
               WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled' AND id != ?`
            )
            .all(nextDoctorId, nextDate, id) as Array<{ start_time: string; end_time: string }>;

          const hasConflict = conflicts.some((c) => {
            const cs = timeToMinutes(c.start_time);
            const ce = timeToMinutes(c.end_time) + bufferMin;
            return candStart < ce && cs < candEnd;
          });

          if (hasConflict) {
            return {
              ok: false as const,
              status: 409,
              error: 'Target date/time overlaps another appointment for this doctor.',
            };
          }
        }
      }

      db.prepare(
        `UPDATE appointments
         SET patient_name = ?, patient_phone = ?, patient_email = ?,
             service_id = ?, doctor_id = ?, appointment_date = ?,
             start_time = ?, end_time = ?, status = ?, patient_message = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        nextName,
        nextPhone,
        nextEmail,
        nextServiceId,
        nextDoctorId,
        nextDate,
        nextStart,
        nextEnd,
        nextStatus,
        nextMessage,
        id
      );

      const updated = db
        .prepare(
          `SELECT a.*, d.name as doctor_name, d.specialization as doctor_specialization,
                  s.name as service_name, s.category as service_category
           FROM appointments a
           JOIN doctors d ON d.id = a.doctor_id
           JOIN services s ON s.id = a.service_id
           WHERE a.id = ?`
        )
        .get(id) as Appointment;

      return { ok: true as const, appointment: updated };
    });

    const result = tx.immediate();
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const appt = result.appointment;
    const remoteSync = await updateAppointmentInSupabase(appt);

    const settings = getClinicSettingsMap();
    const notify = await dispatchAppointmentNotifications({
      clinicName: settings.clinic_name,
      clinicPhone: settings.phone,
      clinicAddress: settings.address,
      bookingRef: appt.booking_ref,
      patientName: appt.patient_name,
      patientPhone: appt.patient_phone,
      patientEmail: appt.patient_email,
      doctorName: appt.doctor_name || '',
      serviceName: appt.service_name || '',
      appointmentDate: appt.appointment_date,
      startTime: appt.start_time,
      status: appt.status,
    });

    res.json({
      appointment: appt,
      supabaseUpdated: remoteSync.synced,
      supabaseReason: remoteSync.reason,
      patientWhatsappUrl: notify.patientWhatsappUrl,
      whatsappSentAutomatically: notify.whatsappSentAutomatically,
      emailSentAutomatically: notify.emailSentAutomatically,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update appointment.' });
  }
});

app.delete('/api/admin/appointments/:id', requireAdmin, async (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id, booking_ref FROM appointments WHERE id = ?').get(id) as
      | { id: number; booking_ref: string }
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
    const remoteDelete = await deleteAppointmentFromSupabase(existing.booking_ref);

    res.json({
      deleted: true,
      bookingRef: existing.booking_ref,
      supabaseDeleted: remoteDelete.synced,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete appointment.' });
  }
});

// --- Doctors CRUD ---
app.get('/api/admin/doctors', requireAdmin, (_req: AdminRequest, res) => {
  res.json({ doctors: getHydratedDoctors(true) });
});

app.post('/api/admin/doctors', requireAdmin, (req: AdminRequest, res) => {
  try {
    const {
      name,
      specialization,
      qualifications = '',
      experience = '',
      bio = '',
      photoUrl = '',
      consultationTimings = '',
      serviceIds = [],
    } = req.body ?? {};
    const cleanName = String(name || '').trim();
    const cleanSpec = String(specialization || '').trim();
    if (!cleanName || !cleanSpec) {
      res.status(400).json({ error: 'Doctor name and specialization are required.' });
      return;
    }

    const baseSlug = slugify(cleanName) || 'doctor';
    const uniqueSlug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;

    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO doctors (slug, name, specialization, qualifications, experience, bio, photo_url, consultation_timings, is_active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 99)`
        )
        .run(
          uniqueSlug,
          cleanName,
          cleanSpec,
          String(qualifications || '').trim(),
          String(experience || '').trim(),
          String(bio || '').trim(),
          String(photoUrl || '').trim(),
          String(consultationTimings || '').trim()
        );
      const docId = Number(info.lastInsertRowid);
      if (Array.isArray(serviceIds)) {
        const linkStmt = db.prepare(
          'INSERT OR IGNORE INTO doctor_services (doctor_id, service_id) VALUES (?, ?)'
        );
        for (const sid of serviceIds) {
          if (Number(sid) > 0) linkStmt.run(docId, Number(sid));
        }
      }
      return docId;
    });

    const id = tx();
    res.status(201).json({ id, doctors: getHydratedDoctors(true) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create doctor profile.' });
  }
});

app.put('/api/admin/doctors/:id', requireAdmin, (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      specialization,
      qualifications = '',
      experience = '',
      bio = '',
      photoUrl = '',
      consultationTimings = '',
      isActive = 1,
      serviceIds,
    } = req.body ?? {};

    const cleanName = String(name || '').trim();
    const cleanSpec = String(specialization || '').trim();
    if (!cleanName || !cleanSpec) {
      res.status(400).json({ error: 'Doctor name and specialization are required.' });
      return;
    }

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE doctors
         SET name = ?, specialization = ?, qualifications = ?, experience = ?, bio = ?,
             photo_url = ?, consultation_timings = ?, is_active = ?
         WHERE id = ?`
      ).run(
        cleanName,
        cleanSpec,
        String(qualifications || '').trim(),
        String(experience || '').trim(),
        String(bio || '').trim(),
        String(photoUrl || '').trim(),
        String(consultationTimings || '').trim(),
        isActive ? 1 : 0,
        id
      );

      if (Array.isArray(serviceIds)) {
        db.prepare('DELETE FROM doctor_services WHERE doctor_id = ?').run(id);
        const linkStmt = db.prepare(
          'INSERT OR IGNORE INTO doctor_services (doctor_id, service_id) VALUES (?, ?)'
        );
        for (const sid of serviceIds) {
          if (Number(sid) > 0) linkStmt.run(id, Number(sid));
        }
      }
    });

    tx();
    res.json({ doctors: getHydratedDoctors(true) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update doctor profile.' });
  }
});

app.delete('/api/admin/doctors/:id', requireAdmin, (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const apptCount = (
      db.prepare('SELECT COUNT(*) as c FROM appointments WHERE doctor_id = ?').get(id) as {
        c: number;
      }
    ).c;
    if (apptCount > 0) {
      // Soft deactivate instead of breaking foreign keys on historical appointments
      db.prepare('UPDATE doctors SET is_active = 0 WHERE id = ?').run(id);
      res.json({ deactivated: true, doctors: getHydratedDoctors(true) });
      return;
    }
    db.prepare('DELETE FROM doctors WHERE id = ?').run(id);
    res.json({ deleted: true, doctors: getHydratedDoctors(true) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete doctor.' });
  }
});

// --- Services CRUD ---
app.get('/api/admin/services', requireAdmin, (_req: AdminRequest, res) => {
  res.json({ services: getHydratedServices(true) });
});

app.post('/api/admin/services', requireAdmin, (req: AdminRequest, res) => {
  try {
    const {
      name,
      category,
      description,
      benefits = [],
      durationMinutes = 30,
      priceInr = null,
      imageUrl = '',
      isActive = 1,
      doctorIds = [],
    } = req.body ?? {};

    const cleanName = String(name || '').trim();
    const cleanCategory = String(category || '').trim() as ServiceCategory;
    const cleanDesc = String(description || '').trim();

    if (!cleanName || !VALID_CATEGORIES.includes(cleanCategory) || !cleanDesc) {
      res.status(400).json({ error: 'Valid service name, category, and description are required.' });
      return;
    }

    const baseSlug = slugify(cleanName) || 'service';
    const uniqueSlug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
    const parsedPrice =
      priceInr === null || priceInr === '' || Number.isNaN(Number(priceInr))
        ? null
        : Math.max(0, Math.round(Number(priceInr)));
    const parsedDuration = Math.max(10, Math.min(240, Number(durationMinutes) || 30));
    const benefitsArr = Array.isArray(benefits)
      ? benefits.map((b) => String(b).trim()).filter(Boolean)
      : [];

    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO services (slug, name, category, description, benefits_json, duration_minutes, price_inr, image_url, is_active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 99)`
        )
        .run(
          uniqueSlug,
          cleanName,
          cleanCategory,
          cleanDesc,
          JSON.stringify(benefitsArr),
          parsedDuration,
          parsedPrice,
          String(imageUrl || '').trim(),
          isActive ? 1 : 0
        );
      const serviceId = Number(info.lastInsertRowid);
      if (Array.isArray(doctorIds)) {
        const linkStmt = db.prepare(
          'INSERT OR IGNORE INTO doctor_services (doctor_id, service_id) VALUES (?, ?)'
        );
        for (const did of doctorIds) {
          if (Number(did) > 0) linkStmt.run(Number(did), serviceId);
        }
      }
      return serviceId;
    });

    const id = tx();
    res.status(201).json({ id, services: getHydratedServices(true) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to create service.' });
  }
});

app.put('/api/admin/services/:id', requireAdmin, (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      category,
      description,
      benefits = [],
      durationMinutes = 30,
      priceInr = null,
      imageUrl = '',
      isActive = 1,
      doctorIds,
    } = req.body ?? {};

    const cleanName = String(name || '').trim();
    const cleanCategory = String(category || '').trim() as ServiceCategory;
    const cleanDesc = String(description || '').trim();

    if (!cleanName || !VALID_CATEGORIES.includes(cleanCategory) || !cleanDesc) {
      res.status(400).json({ error: 'Valid service name, category, and description are required.' });
      return;
    }

    const parsedPrice =
      priceInr === null || priceInr === '' || Number.isNaN(Number(priceInr))
        ? null
        : Math.max(0, Math.round(Number(priceInr)));
    const parsedDuration = Math.max(10, Math.min(240, Number(durationMinutes) || 30));
    const benefitsArr = Array.isArray(benefits)
      ? benefits.map((b) => String(b).trim()).filter(Boolean)
      : [];

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE services
         SET name = ?, category = ?, description = ?, benefits_json = ?, duration_minutes = ?,
             price_inr = ?, image_url = ?, is_active = ?
         WHERE id = ?`
      ).run(
        cleanName,
        cleanCategory,
        cleanDesc,
        JSON.stringify(benefitsArr),
        parsedDuration,
        parsedPrice,
        String(imageUrl || '').trim(),
        isActive ? 1 : 0,
        id
      );

      if (Array.isArray(doctorIds)) {
        db.prepare('DELETE FROM doctor_services WHERE service_id = ?').run(id);
        const linkStmt = db.prepare(
          'INSERT OR IGNORE INTO doctor_services (doctor_id, service_id) VALUES (?, ?)'
        );
        for (const did of doctorIds) {
          if (Number(did) > 0) linkStmt.run(Number(did), id);
        }
      }
    });

    tx();
    res.json({ services: getHydratedServices(true) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update service.' });
  }
});

app.delete('/api/admin/services/:id', requireAdmin, (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const apptCount = (
      db.prepare('SELECT COUNT(*) as c FROM appointments WHERE service_id = ?').get(id) as {
        c: number;
      }
    ).c;
    if (apptCount > 0) {
      db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(id);
      res.json({ deactivated: true, services: getHydratedServices(true) });
      return;
    }
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    res.json({ deleted: true, services: getHydratedServices(true) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete service.' });
  }
});

// --- Working Hours, Blocked Dates & Blocked Slots ---
app.get('/api/admin/availability', requireAdmin, (_req: AdminRequest, res) => {
  try {
    const rules = db
      .prepare('SELECT * FROM availability ORDER BY doctor_id ASC, day_of_week ASC, start_time ASC')
      .all();
    const blockedDates = db
      .prepare('SELECT * FROM blocked_dates ORDER BY blocked_date ASC')
      .all();
    const blockedSlots = db
      .prepare('SELECT * FROM blocked_slots ORDER BY blocked_date ASC, start_time ASC')
      .all();
    const settings = getClinicSettingsMap();
    res.json({
      rules,
      blockedDates,
      blockedSlots,
      slotIntervalMinutes: Number(settings.slot_interval_minutes || 30),
      bufferMinutes: Number(settings.buffer_minutes || 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load availability settings.' });
  }
});

app.put('/api/admin/availability', requireAdmin, (req: AdminRequest, res) => {
  try {
    const { rules, slotIntervalMinutes, bufferMinutes } = req.body ?? {};

    const tx = db.transaction(() => {
      if (Array.isArray(rules)) {
        const updateRule = db.prepare(
          'UPDATE availability SET start_time = ?, end_time = ?, is_enabled = ? WHERE id = ?'
        );
        for (const r of rules) {
          if (r.id && timeToMinutes(r.start_time) >= 0 && timeToMinutes(r.end_time) > timeToMinutes(r.start_time)) {
            updateRule.run(r.start_time, r.end_time, r.is_enabled ? 1 : 0, Number(r.id));
          }
        }
      }
      if (slotIntervalMinutes !== undefined) {
        const val = Math.max(10, Math.min(120, Number(slotIntervalMinutes) || 30));
        db.prepare(
          "INSERT OR REPLACE INTO clinic_settings (key, value, updated_at) VALUES ('slot_interval_minutes', ?, datetime('now'))"
        ).run(String(val));
      }
      if (bufferMinutes !== undefined) {
        const val = Math.max(0, Math.min(60, Number(bufferMinutes) || 0));
        db.prepare(
          "INSERT OR REPLACE INTO clinic_settings (key, value, updated_at) VALUES ('buffer_minutes', ?, datetime('now'))"
        ).run(String(val));
      }
    });

    tx();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update working hours.' });
  }
});

app.post('/api/admin/blocked-dates', requireAdmin, (req: AdminRequest, res) => {
  try {
    const { doctorId = null, blockedDate, reason = 'Clinic Holiday' } = req.body ?? {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(blockedDate || ''))) {
      res.status(400).json({ error: 'Valid blocked date (YYYY-MM-DD) is required.' });
      return;
    }
    const docId = doctorId ? Number(doctorId) : null;
    db.prepare(
      'INSERT INTO blocked_dates (doctor_id, blocked_date, reason) VALUES (?, ?, ?)'
    ).run(docId, String(blockedDate), String(reason || 'Clinic Holiday').trim());
    const blockedDates = db.prepare('SELECT * FROM blocked_dates ORDER BY blocked_date ASC').all();
    res.status(201).json({ blockedDates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to add blocked date.' });
  }
});

app.delete('/api/admin/blocked-dates/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM blocked_dates WHERE id = ?').run(Number(req.params.id));
  const blockedDates = db.prepare('SELECT * FROM blocked_dates ORDER BY blocked_date ASC').all();
  res.json({ blockedDates });
});

app.post('/api/admin/blocked-slots', requireAdmin, (req: AdminRequest, res) => {
  try {
    const {
      doctorId = null,
      blockedDate,
      startTime,
      endTime,
      reason = 'Slot Blocked',
    } = req.body ?? {};
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(String(blockedDate || '')) ||
      timeToMinutes(String(startTime || '')) < 0 ||
      timeToMinutes(String(endTime || '')) <= timeToMinutes(String(startTime || ''))
    ) {
      res.status(400).json({ error: 'Valid date, start time, and end time are required.' });
      return;
    }
    const docId = doctorId ? Number(doctorId) : null;
    db.prepare(
      'INSERT INTO blocked_slots (doctor_id, blocked_date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)'
    ).run(
      docId,
      String(blockedDate),
      String(startTime),
      String(endTime),
      String(reason || 'Slot Blocked').trim()
    );
    const blockedSlots = db
      .prepare('SELECT * FROM blocked_slots ORDER BY blocked_date ASC, start_time ASC')
      .all();
    res.status(201).json({ blockedSlots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to block time slot.' });
  }
});

app.delete('/api/admin/blocked-slots/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM blocked_slots WHERE id = ?').run(Number(req.params.id));
  const blockedSlots = db
    .prepare('SELECT * FROM blocked_slots ORDER BY blocked_date ASC, start_time ASC')
    .all();
  res.json({ blockedSlots });
});

// --- Gallery CRUD ---
app.get('/api/admin/gallery', requireAdmin, (_req: AdminRequest, res) => {
  res.json({
    gallery: db.prepare('SELECT * FROM gallery ORDER BY sort_order ASC, id DESC').all(),
  });
});

app.post('/api/admin/gallery', requireAdmin, (req: AdminRequest, res) => {
  try {
    const { title, category, imageUrl, caption = '' } = req.body ?? {};
    if (!title || !category || !imageUrl) {
      res.status(400).json({ error: 'Title, category, and image URL are required.' });
      return;
    }
    db.prepare(
      'INSERT INTO gallery (title, category, image_url, caption, sort_order, is_active) VALUES (?, ?, ?, ?, 10, 1)'
    ).run(
      String(title).trim(),
      String(category).trim(),
      String(imageUrl).trim(),
      String(caption || '').trim()
    );
    res.status(201).json({
      gallery: db.prepare('SELECT * FROM gallery ORDER BY sort_order ASC, id DESC').all(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to add gallery image.' });
  }
});

app.put('/api/admin/gallery/:id', requireAdmin, (req: AdminRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { title, category, imageUrl, caption = '', isActive = 1 } = req.body ?? {};
    db.prepare(
      'UPDATE gallery SET title = ?, category = ?, image_url = ?, caption = ?, is_active = ? WHERE id = ?'
    ).run(
      String(title || '').trim(),
      String(category || '').trim(),
      String(imageUrl || '').trim(),
      String(caption || '').trim(),
      isActive ? 1 : 0,
      id
    );
    res.json({
      gallery: db.prepare('SELECT * FROM gallery ORDER BY sort_order ASC, id DESC').all(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to update gallery item.' });
  }
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM gallery WHERE id = ?').run(Number(req.params.id));
  res.json({
    gallery: db.prepare('SELECT * FROM gallery ORDER BY sort_order ASC, id DESC').all(),
  });
});

// --- Enquiries & Testimonials ---
app.get('/api/admin/enquiries', requireAdmin, (_req: AdminRequest, res) => {
  res.json({
    enquiries: db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all(),
  });
});

app.patch('/api/admin/enquiries/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || 'Reviewed');
  if (!['New', 'Reviewed', 'Resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }
  db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, id);
  res.json({ enquiries: db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all() });
});

app.get('/api/admin/testimonials', requireAdmin, (_req: AdminRequest, res) => {
  res.json({
    testimonials: db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all(),
  });
});

app.post('/api/admin/testimonials', requireAdmin, (req: AdminRequest, res) => {
  const { patientName, treatment = '', quote, visitDate = '', isApproved = 1 } = req.body ?? {};
  if (!patientName || !quote) {
    res.status(400).json({ error: 'Patient name and quote are required.' });
    return;
  }
  db.prepare(
    'INSERT INTO testimonials (patient_name, treatment, quote, visit_date, is_approved) VALUES (?, ?, ?, ?, ?)'
  ).run(
    String(patientName).trim(),
    String(treatment || '').trim(),
    String(quote).trim(),
    String(visitDate || '').trim(),
    isApproved ? 1 : 0
  );
  res.status(201).json({
    testimonials: db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all(),
  });
});

app.patch('/api/admin/testimonials/:id', requireAdmin, (req: AdminRequest, res) => {
  const id = Number(req.params.id);
  const isApproved = req.body?.isApproved ? 1 : 0;
  db.prepare('UPDATE testimonials SET is_approved = ? WHERE id = ?').run(isApproved, id);
  res.json({ testimonials: db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all() });
});

app.delete('/api/admin/testimonials/:id', requireAdmin, (req: AdminRequest, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(Number(req.params.id));
  res.json({ testimonials: db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all() });
});

// --- Clinic Settings & Photo Uploads & JSON Backup ---
app.put('/api/admin/settings', requireAdmin, (req: AdminRequest, res) => {
  try {
    const payload = req.body ?? {};
    const upsert = db.prepare(
      "INSERT OR REPLACE INTO clinic_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    );
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(payload)) {
        if (typeof k === 'string' && typeof v === 'string') {
          upsert.run(k, v);
        }
      }
    });
    tx();
    res.json({ settings: getClinicSettingsMap() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to save clinic settings.' });
  }
});

app.post('/api/admin/upload', requireAdmin, (req: AdminRequest, res) => {
  try {
    const { filename = 'upload.jpg', dataUrl } = req.body ?? {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Valid base64 image dataUrl is required.' });
      return;
    }

    const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Only PNG, JPEG, and WebP images are supported.' });
      return;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must be 5 MB or less.' });
      return;
    }

    const safeBase = slugify(path.basename(String(filename), path.extname(String(filename)))) || 'img';
    const outName = `${safeBase}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, outName), buf);

    res.status(201).json({ url: `/uploads/${outName}` });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Unable to upload image.' });
  }
});

app.get('/api/admin/backup', requireAdmin, (_req: AdminRequest, res) => {
  try {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: getClinicSettingsMap(),
      doctors: getHydratedDoctors(true),
      services: getHydratedServices(true),
      availability: db.prepare('SELECT * FROM availability').all(),
      blocked_dates: db.prepare('SELECT * FROM blocked_dates').all(),
      blocked_slots: db.prepare('SELECT * FROM blocked_slots').all(),
      appointments: db.prepare('SELECT * FROM appointments').all(),
      enquiries: db.prepare('SELECT * FROM enquiries').all(),
      gallery: db.prepare('SELECT * FROM gallery').all(),
      testimonials: db.prepare('SELECT * FROM testimonials').all(),
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="smile-architect-backup-${getTodayIST()}.json"`
    );
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to generate database backup.' });
  }
});

// ==========================================
// VITE DEV / PRODUCTION STATIC SERVING
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smile Architect Dental Clinic server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup failure:', err);
  process.exit(1);
});
