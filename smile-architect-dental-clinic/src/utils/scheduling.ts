import type { TimeSlotOption } from '../types/clinic.ts';

export interface SessionWindow {
  sessionName: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isEnabled: boolean;
}

export interface OccupiedInterval {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface SlotGenerationInput {
  date: string; // YYYY-MM-DD
  todayIST: string; // YYYY-MM-DD
  nowMinutesIST: number;
  isDateBlocked: boolean;
  sessions: SessionWindow[];
  serviceDurationMin: number;
  slotIntervalMin: number;
  bufferMin: number;
  existingAppointments: OccupiedInterval[];
  blockedSlots: OccupiedInterval[];
  minLeadTimeMin?: number;
}

export function timeToMinutes(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return -1;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

export function minutesToTime(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMin)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12h(hhmm: string): string {
  const mins = timeToMinutes(hhmm);
  if (mins < 0) return hhmm;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function getTodayIST(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function getNowMinutesIST(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return (h === 24 ? 0 : h) * 60 + m;
}

export function getDayOfWeekIST(dateStr: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return -1;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  // Noon UTC corresponds to 17:30 IST on the exact same calendar date
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return utcNoon.getUTCDay();
}

export function isPastDateIST(dateStr: string, todayIST: string = getTodayIST()): boolean {
  return dateStr < todayIST;
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function generateAvailableSlots(input: SlotGenerationInput): TimeSlotOption[] {
  const {
    date,
    todayIST,
    nowMinutesIST,
    isDateBlocked,
    sessions,
    serviceDurationMin,
    slotIntervalMin,
    bufferMin,
    existingAppointments,
    blockedSlots,
    minLeadTimeMin = 30,
  } = input;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  if (date < todayIST || isDateBlocked) return [];
  if (serviceDurationMin <= 0 || slotIntervalMin <= 0) return [];

  const parsedAppts = existingAppointments
    .map((a) => ({
      start: timeToMinutes(a.startTime),
      end: timeToMinutes(a.endTime) + Math.max(0, bufferMin),
    }))
    .filter((a) => a.start >= 0 && a.end > a.start);

  const parsedBlocked = blockedSlots
    .map((b) => ({
      start: timeToMinutes(b.startTime),
      end: timeToMinutes(b.endTime),
    }))
    .filter((b) => b.start >= 0 && b.end > b.start);

  const results: TimeSlotOption[] = [];
  const seenStarts = new Set<string>();
  const isToday = date === todayIST;

  const sortedSessions = [...sessions]
    .filter((s) => s.isEnabled)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  for (const session of sortedSessions) {
    const sessStart = timeToMinutes(session.startTime);
    const sessEnd = timeToMinutes(session.endTime);
    if (sessStart < 0 || sessEnd <= sessStart) continue;

    for (
      let cursor = sessStart;
      cursor + serviceDurationMin <= sessEnd;
      cursor += slotIntervalMin
    ) {
      if (isToday && cursor < nowMinutesIST + minLeadTimeMin) {
        continue;
      }

      const candidateStart = cursor;
      const candidateEnd = cursor + serviceDurationMin;
      const candidateEndWithBuffer = candidateEnd + Math.max(0, bufferMin);

      const hitsAppointment = parsedAppts.some((appt) =>
        intervalsOverlap(candidateStart, candidateEndWithBuffer, appt.start, appt.end)
      );
      if (hitsAppointment) continue;

      const hitsBlockedSlot = parsedBlocked.some((blk) =>
        intervalsOverlap(candidateStart, candidateEnd, blk.start, blk.end)
      );
      if (hitsBlockedSlot) continue;

      const startStr = minutesToTime(candidateStart);
      if (seenStarts.has(startStr)) continue;
      seenStarts.add(startStr);

      results.push({
        startTime: startStr,
        endTime: minutesToTime(candidateEnd),
        label: formatTime12h(startStr),
        sessionName: session.sessionName,
      });
    }
  }

  return results;
}
