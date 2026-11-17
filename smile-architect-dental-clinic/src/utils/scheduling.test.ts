import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime12h,
  generateAvailableSlots,
  getDayOfWeekIST,
  isPastDateIST,
  minutesToTime,
  timeToMinutes,
} from './scheduling.ts';
import {
  buildGoogleCalendarUrl,
  buildWhatsAppLink,
  escapeCsvCell,
  isValidIndianPhone,
  normalizeIndianPhone,
} from './validation.ts';

test('time conversion helpers round-trip cleanly', () => {
  assert.equal(timeToMinutes('10:30'), 630);
  assert.equal(minutesToTime(630), '10:30');
  assert.equal(formatTime12h('10:00'), '10:00 AM');
  assert.equal(formatTime12h('17:30'), '5:30 PM');
  assert.equal(formatTime12h('00:15'), '12:15 AM');
});

test('IST date helpers handle weekday and past checks accurately', () => {
  // 2026-11-22 is a Sunday (0)
  assert.equal(getDayOfWeekIST('2026-11-22'), 0);
  assert.equal(isPastDateIST('2026-11-16', '2026-11-17'), true);
  assert.equal(isPastDateIST('2026-11-17', '2026-11-17'), false);
  assert.equal(isPastDateIST('2026-11-18', '2026-11-17'), false);
});

test('generateAvailableSlots excludes past dates, blocked dates, booked slots, buffer overlaps, and blocked intervals', () => {
  const sessions = [
    { sessionName: 'Morning', startTime: '10:00', endTime: '12:00', isEnabled: true },
    { sessionName: 'Evening', startTime: '17:00', endTime: '18:00', isEnabled: true },
  ];

  // Past date returns empty
  assert.deepEqual(
    generateAvailableSlots({
      date: '2026-11-16',
      todayIST: '2026-11-17',
      nowMinutesIST: 540,
      isDateBlocked: false,
      sessions,
      serviceDurationMin: 30,
      slotIntervalMin: 30,
      bufferMin: 10,
      existingAppointments: [],
      blockedSlots: [],
    }),
    []
  );

  // Blocked date returns empty
  assert.deepEqual(
    generateAvailableSlots({
      date: '2026-11-18',
      todayIST: '2026-11-17',
      nowMinutesIST: 540,
      isDateBlocked: true,
      sessions,
      serviceDurationMin: 30,
      slotIntervalMin: 30,
      bufferMin: 10,
      existingAppointments: [],
      blockedSlots: [],
    }),
    []
  );

  // Future date with an appointment at 10:00-10:30 (+10m buffer -> blocks 10:30!) and a blocked slot 17:00-17:30
  const slots = generateAvailableSlots({
    date: '2026-11-18',
    todayIST: '2026-11-17',
    nowMinutesIST: 540,
    isDateBlocked: false,
    sessions,
    serviceDurationMin: 30,
    slotIntervalMin: 30,
    bufferMin: 10,
    existingAppointments: [{ startTime: '10:00', endTime: '10:30' }],
    blockedSlots: [{ startTime: '17:00', endTime: '17:30' }],
  });

  // 10:00 is booked, 10:30 overlaps 10:00-10:40 buffer, so next morning slots are 11:00 and 11:30.
  // Evening 17:00 is blocked, leaving 17:30.
  assert.deepEqual(
    slots.map((s) => s.startTime),
    ['11:00', '11:30', '17:30']
  );
});

test('generateAvailableSlots respects lead time on today in IST', () => {
  const slots = generateAvailableSlots({
    date: '2026-11-17',
    todayIST: '2026-11-17',
    nowMinutesIST: 10 * 60 + 5, // 10:05 AM IST -> 10:00 and 10:30 (< 10:35) excluded
    isDateBlocked: false,
    sessions: [{ sessionName: 'Morning', startTime: '10:00', endTime: '12:00', isEnabled: true }],
    serviceDurationMin: 30,
    slotIntervalMin: 30,
    bufferMin: 0,
    existingAppointments: [],
    blockedSlots: [],
    minLeadTimeMin: 30,
  });

  assert.deepEqual(
    slots.map((s) => s.startTime),
    ['11:00', '11:30']
  );
});

test('phone validation, WhatsApp link, Google Calendar URL, and CSV escaping work properly', () => {
  assert.equal(isValidIndianPhone('9036827916'), true);
  assert.equal(isValidIndianPhone('+91 90368 27916'), true);
  assert.equal(isValidIndianPhone('12345'), false);
  assert.equal(normalizeIndianPhone('9036827916'), '+91 90368 27916');

  const wa = buildWhatsAppLink('+91 90368 27916', 'Hello Smile Architect');
  assert.ok(wa.startsWith('https://wa.me/919036827916?text='));

  const gcal = buildGoogleCalendarUrl({
    title: 'Dental Consultation',
    date: '2026-11-20',
    startTime: '10:00',
    endTime: '10:30',
    location: 'Mysuru',
    description: 'Appointment Ref: SADC-1',
  });
  assert.ok(gcal.includes('ctz=Asia%2FKolkata'));
  assert.ok(gcal.includes('20261120T100000%2F20261120T103000'));

  assert.equal(escapeCsvCell('Hello, "World"'), '"Hello, ""World"""');
});
