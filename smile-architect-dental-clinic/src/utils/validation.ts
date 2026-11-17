export function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    const local = digits.slice(2);
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return input.trim();
}

export function isValidIndianPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return /^[6-9]\d{9}$/.test(digits);
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  }
  return false;
}

export function isValidOptionalEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isValidRequiredEmail(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function buildWhatsAppLink(phoneDigits: string, message: string): string {
  const cleanPhone = phoneDigits.replace(/\D/g, '') || '919036827916';
  const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildGoogleCalendarUrl(params: {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (IST)
  endTime: string; // HH:MM (IST)
  location: string;
  description: string;
}): string {
  const dateCompact = params.date.replace(/-/g, '');
  const startCompact = params.startTime.replace(':', '') + '00';
  const endCompact = params.endTime.replace(':', '') + '00';
  const dates = `${dateCompact}T${startCompact}/${dateCompact}T${endCompact}`;
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates,
    ctz: 'Asia/Kolkata',
    location: params.location,
    details: params.description,
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

export function formatReadableDate(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
