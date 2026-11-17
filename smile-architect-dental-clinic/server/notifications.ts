import { buildWhatsAppLink, formatReadableDate } from '../src/utils/validation.ts';
import { formatTime12h } from '../src/utils/scheduling.ts';

export interface NotificationContext {
  clinicName: string;
  clinicPhone: string;
  clinicAddress: string;
  bookingRef: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  doctorName: string;
  serviceName: string;
  appointmentDate: string;
  startTime: string;
  status: string;
}

export interface NotificationResult {
  whatsappSentAutomatically: boolean;
  emailSentAutomatically: boolean;
  whatsappClickToChatUrl: string;
  patientWhatsappUrl: string;
}

export function buildAppointmentMessage(ctx: NotificationContext): string {
  const dateLabel = formatReadableDate(ctx.appointmentDate);
  const timeLabel = formatTime12h(ctx.startTime);

  if (ctx.status === 'Confirmed') {
    return `Hello ${ctx.patientName}, your appointment at ${ctx.clinicName} is CONFIRMED.\nRef: ${ctx.bookingRef}\nService: ${ctx.serviceName}\nDoctor: ${ctx.doctorName}\nDate: ${dateLabel}\nTime: ${timeLabel} IST\nAddress: ${ctx.clinicAddress}`;
  }
  if (ctx.status === 'Cancelled') {
    return `Hello ${ctx.patientName}, your appointment (${ctx.bookingRef}) scheduled for ${dateLabel} at ${timeLabel} IST with ${ctx.doctorName} at ${ctx.clinicName} has been CANCELLED. Please call ${ctx.clinicPhone} if you would like to rebook.`;
  }
  if (ctx.status === 'Rescheduled') {
    return `Hello ${ctx.patientName}, your appointment (${ctx.bookingRef}) at ${ctx.clinicName} has been RESCHEDULED to ${dateLabel} at ${timeLabel} IST with ${ctx.doctorName} for ${ctx.serviceName}.`;
  }
  return `Hello ${ctx.clinicName}, I have submitted an appointment request.\nRef: ${ctx.bookingRef}\nName: ${ctx.patientName}\nPhone: ${ctx.patientPhone}\nService: ${ctx.serviceName}\nDoctor: ${ctx.doctorName}\nDate: ${dateLabel}\nTime: ${timeLabel} IST`;
}

export async function dispatchAppointmentNotifications(
  ctx: NotificationContext
): Promise<NotificationResult> {
  const message = buildAppointmentMessage(ctx);
  const whatsappClickToChatUrl = buildWhatsAppLink(ctx.clinicPhone, message);
  const patientWhatsappUrl = buildWhatsAppLink(ctx.patientPhone, message);

  let whatsappSentAutomatically = false;
  let emailSentAutomatically = false;

  const waToken = process.env.WHATSAPP_CLOUD_TOKEN;
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (waToken && waPhoneId) {
    try {
      const cleanPatientPhone = ctx.patientPhone.replace(/\D/g, '');
      const e164 = cleanPatientPhone.length === 10 ? `91${cleanPatientPhone}` : cleanPatientPhone;
      const resp = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${waToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: e164,
          type: 'text',
          text: { body: message },
        }),
      });
      whatsappSentAutomatically = resp.ok;
    } catch {
      whatsappSentAutomatically = false;
    }
  }

  const emailWebhook = process.env.EMAIL_WEBHOOK_URL;
  if (emailWebhook && ctx.patientEmail) {
    try {
      const resp = await fetch(emailWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Smile Architect Dental Clinic <appointments@smilearchitect.in>',
          to: ctx.patientEmail,
          subject: `${ctx.clinicName} – Appointment ${ctx.status} (${ctx.bookingRef})`,
          text: message,
        }),
      });
      emailSentAutomatically = resp.ok;
    } catch {
      emailSentAutomatically = false;
    }
  }

  return {
    whatsappSentAutomatically,
    emailSentAutomatically,
    whatsappClickToChatUrl,
    patientWhatsappUrl,
  };
}
