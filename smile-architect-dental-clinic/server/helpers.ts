import crypto from 'node:crypto';
import { db } from './db.ts';
import {
  generateAvailableSlots,
  getDayOfWeekIST,
  getNowMinutesIST,
  getTodayIST,
  minutesToTime,
  timeToMinutes,
} from '../src/utils/scheduling.ts';
import type {
  AvailabilityRule,
  ClinicSettings,
  Doctor,
  Service,
  TimeSlotOption,
} from '../src/types/clinic.ts';

export function getClinicSettingsMap(): ClinicSettings {
  const rows = db.prepare('SELECT key, value FROM clinic_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map as ClinicSettings;
}

export function getHydratedDoctors(includeInactive = false): Doctor[] {
  const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
  const doctors = db
    .prepare(`SELECT * FROM doctors ${whereClause} ORDER BY sort_order ASC, id ASC`)
    .all() as Doctor[];

  const links = db.prepare('SELECT doctor_id, service_id FROM doctor_services').all() as Array<{
    doctor_id: number;
    service_id: number;
  }>;

  const map = new Map<number, number[]>();
  for (const link of links) {
    const arr = map.get(link.doctor_id) || [];
    arr.push(link.service_id);
    map.set(link.doctor_id, arr);
  }

  return doctors.map((d) => ({
    ...d,
    service_ids: map.get(d.id) || [],
  }));
}

interface RawServiceRow {
  id: number;
  slug: string;
  name: string;
  category: Service['category'];
  description: string;
  benefits_json: string;
  duration_minutes: number;
  price_inr: number | null;
  image_url: string;
  is_active: number;
  sort_order: number;
}

export function getHydratedServices(includeInactive = false): Service[] {
  const whereClause = includeInactive ? '' : 'WHERE is_active = 1';
  const rows = db
    .prepare(`SELECT * FROM services ${whereClause} ORDER BY sort_order ASC, id ASC`)
    .all() as RawServiceRow[];

  const doctors = getHydratedDoctors(includeInactive);
  const doctorById = new Map(doctors.map((d) => [d.id, d]));

  const links = db.prepare('SELECT doctor_id, service_id FROM doctor_services').all() as Array<{
    doctor_id: number;
    service_id: number;
  }>;

  const svcDocMap = new Map<number, number[]>();
  for (const link of links) {
    const arr = svcDocMap.get(link.service_id) || [];
    arr.push(link.doctor_id);
    svcDocMap.set(link.service_id, arr);
  }

  return rows.map((row) => {
    let benefits: string[] = [];
    try {
      const parsed = JSON.parse(row.benefits_json);
      if (Array.isArray(parsed)) benefits = parsed.map(String);
    } catch {
      benefits = [];
    }
    const docIds = svcDocMap.get(row.id) || [];
    const linkedDocs = docIds
      .map((id) => doctorById.get(id))
      .filter((d): d is Doctor => Boolean(d));

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category,
      description: row.description,
      benefits,
      duration_minutes: row.duration_minutes,
      price_inr: row.price_inr,
      image_url: row.image_url,
      is_active: row.is_active,
      sort_order: row.sort_order,
      doctor_ids: docIds,
      doctors: linkedDocs,
    };
  });
}

export function getEffectiveSessionsForDay(
  doctorId: number,
  dayOfWeek: number
): AvailabilityRule[] {
  const doctorSpecific = db
    .prepare(
      'SELECT * FROM availability WHERE doctor_id = ? AND day_of_week = ? ORDER BY start_time ASC'
    )
    .all(doctorId, dayOfWeek) as AvailabilityRule[];

  if (doctorSpecific.length > 0) return doctorSpecific;

  return db
    .prepare(
      'SELECT * FROM availability WHERE doctor_id IS NULL AND day_of_week = ? ORDER BY start_time ASC'
    )
    .all(dayOfWeek) as AvailabilityRule[];
}

export function computeSlotsForDoctorServiceDate(params: {
  doctorId: number;
  serviceId: number;
  date: string;
  excludeAppointmentId?: number;
}): {
  slots: TimeSlotOption[];
  isDateBlocked: boolean;
  blockedReason: string | null;
  serviceDurationMin: number;
} {
  const { doctorId, serviceId, date, excludeAppointmentId } = params;

  const svc = db
    .prepare('SELECT id, duration_minutes, is_active FROM services WHERE id = ?')
    .get(serviceId) as { id: number; duration_minutes: number; is_active: number } | undefined;

  const doc = db
    .prepare('SELECT id, is_active FROM doctors WHERE id = ?')
    .get(doctorId) as { id: number; is_active: number } | undefined;

  if (!svc || !svc.is_active || !doc || !doc.is_active) {
    return { slots: [], isDateBlocked: false, blockedReason: null, serviceDurationMin: 30 };
  }

  const link = db
    .prepare('SELECT 1 as ok FROM doctor_services WHERE doctor_id = ? AND service_id = ?')
    .get(doctorId, serviceId) as { ok: number } | undefined;

  if (!link) {
    return {
      slots: [],
      isDateBlocked: false,
      blockedReason: 'Selected doctor does not offer this service.',
      serviceDurationMin: svc.duration_minutes,
    };
  }

  const blockedDateRow = db
    .prepare(
      'SELECT reason FROM blocked_dates WHERE blocked_date = ? AND (doctor_id IS NULL OR doctor_id = ?) LIMIT 1'
    )
    .get(date, doctorId) as { reason: string } | undefined;

  if (blockedDateRow) {
    return {
      slots: [],
      isDateBlocked: true,
      blockedReason: blockedDateRow.reason || 'Clinic Holiday / Unavailable Date',
      serviceDurationMin: svc.duration_minutes,
    };
  }

  const dayOfWeek = getDayOfWeekIST(date);
  if (dayOfWeek < 0) {
    return {
      slots: [],
      isDateBlocked: false,
      blockedReason: 'Invalid date.',
      serviceDurationMin: svc.duration_minutes,
    };
  }

  const rules = getEffectiveSessionsForDay(doctorId, dayOfWeek);
  const settings = getClinicSettingsMap();
  const slotIntervalMin = Math.max(10, Number(settings.slot_interval_minutes || 30));
  const bufferMin = Math.max(0, Number(settings.buffer_minutes || 10));

  const apptsQuery = excludeAppointmentId
    ? `SELECT start_time, end_time FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled' AND id != ?`
    : `SELECT start_time, end_time FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND status != 'Cancelled'`;

  const existingAppts = (
    excludeAppointmentId
      ? db.prepare(apptsQuery).all(doctorId, date, excludeAppointmentId)
      : db.prepare(apptsQuery).all(doctorId, date)
  ) as Array<{ start_time: string; end_time: string }>;

  const blockedSlotRows = db
    .prepare(
      'SELECT start_time, end_time FROM blocked_slots WHERE blocked_date = ? AND (doctor_id IS NULL OR doctor_id = ?)'
    )
    .all(date, doctorId) as Array<{ start_time: string; end_time: string }>;

  const slots = generateAvailableSlots({
    date,
    todayIST: getTodayIST(),
    nowMinutesIST: getNowMinutesIST(),
    isDateBlocked: false,
    sessions: rules.map((r) => ({
      sessionName: r.session_name,
      startTime: r.start_time,
      endTime: r.end_time,
      isEnabled: r.is_enabled === 1,
    })),
    serviceDurationMin: svc.duration_minutes,
    slotIntervalMin,
    bufferMin,
    existingAppointments: existingAppts.map((a) => ({
      startTime: a.start_time,
      endTime: a.end_time,
    })),
    blockedSlots: blockedSlotRows.map((b) => ({
      startTime: b.start_time,
      endTime: b.end_time,
    })),
  });

  return {
    slots,
    isDateBlocked: false,
    blockedReason: null,
    serviceDurationMin: svc.duration_minutes,
  };
}

export function generateBookingRef(appointmentDate: string): string {
  const compact = appointmentDate.replace(/-/g, '').slice(2); // YYMMDD
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SADC-${compact}-${suffix}`;
}

export function computeEndTime(startTime: string, durationMin: number): string {
  const start = timeToMinutes(startTime);
  if (start < 0) return startTime;
  return minutesToTime(start + durationMin);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
