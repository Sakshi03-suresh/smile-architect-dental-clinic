import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Appointment } from '../src/types/clinic.ts';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';
let missingSchemaWarned = false;

function getSupabaseEnv() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  const activeKey = secretKey || publishableKey;
  return {
    url,
    activeKey,
    hasSecretKey: Boolean(secretKey),
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, activeKey } = getSupabaseEnv();
  return Boolean(url && activeKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, activeKey } = getSupabaseEnv();
  if (!url || !activeKey) return null;

  const signature = `${url}:${activeKey}`;
  if (!cachedClient || cachedConfigKey !== signature) {
    cachedClient = createClient(url, activeKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigKey = signature;
  }
  return cachedClient;
}

export interface SupabaseSyncResult {
  synced: boolean;
  reason?: string;
}

export async function syncAppointmentToSupabase(
  appt: Appointment
): Promise<SupabaseSyncResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { synced: false, reason: 'not_configured' };
  }

  try {
    // Do NOT chain .select() so INSERT-only RLS policies work with a publishable key
    // without exposing patient PII via anonymous SELECT.
    const { error } = await client.from('appointments').insert([
      {
        booking_ref: appt.booking_ref,
        patient_name: appt.patient_name,
        patient_phone: appt.patient_phone,
        patient_email: appt.patient_email || '',
        doctor_id: appt.doctor_id,
        doctor_name: appt.doctor_name || '',
        doctor_specialization: appt.doctor_specialization || '',
        service_id: appt.service_id,
        service_name: appt.service_name || '',
        service_category: appt.service_category || '',
        appointment_date: appt.appointment_date,
        start_time: appt.start_time,
        end_time: appt.end_time,
        status: appt.status,
        patient_message: appt.patient_message || '',
        consent_given: appt.consent_given === 1,
      },
    ]);

    if (error) {
      if (error.code === '23505') {
        return { synced: true };
      }
      if (error.code === 'PGRST205') {
        if (!missingSchemaWarned) {
          missingSchemaWarned = true;
          console.warn(
            '[Supabase] Table public.appointments not found yet. Run supabase/schema.sql in your Supabase SQL Editor to enable live database syncing.'
          );
        }
        return { synced: false, reason: 'schema_not_initialized' };
      }
      console.error('[Supabase] Appointment sync error:', error.code, error.message);
      return { synced: false, reason: error.message };
    }

    return { synced: true };
  } catch (err) {
    console.error('[Supabase] Unexpected appointment sync failure:', err);
    return { synced: false, reason: 'network_error' };
  }
}

export interface SupabaseStatusInfo {
  configured: boolean;
  canEditRemote: boolean;
}

export function getSupabaseStatus(): SupabaseStatusInfo {
  const { url, activeKey, hasSecretKey } = getSupabaseEnv();
  return {
    configured: Boolean(url && activeKey),
    canEditRemote: Boolean(url && hasSecretKey),
  };
}

export interface SupabaseAppointmentRow {
  id?: number;
  booking_ref: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  doctor_id?: number | null;
  doctor_name?: string;
  doctor_specialization?: string;
  service_id?: number | null;
  service_name?: string;
  service_category?: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  patient_message?: string;
  consent_given?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function fetchAppointmentsFromSupabase(): Promise<{
  rows: SupabaseAppointmentRow[];
  accessible: boolean;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { rows: [], accessible: false };
  }

  try {
    const { data, error } = await client
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: true });

    if (error) {
      if (error.code !== 'PGRST205') {
        console.error('[Supabase] Fetch appointments error:', error.code, error.message);
      }
      return { rows: [], accessible: false };
    }

    return {
      rows: (data as SupabaseAppointmentRow[]) || [],
      accessible: true,
    };
  } catch (err) {
    console.error('[Supabase] Unexpected fetch appointments failure:', err);
    return { rows: [], accessible: false };
  }
}

export async function updateAppointmentInSupabase(
  appt: Appointment
): Promise<SupabaseSyncResult> {
  const { hasSecretKey } = getSupabaseEnv();
  const client = getSupabaseClient();
  if (!client) {
    return { synced: false, reason: 'not_configured' };
  }
  if (!hasSecretKey) {
    // Updating existing rows requires SUPABASE_SECRET_KEY so anonymous users cannot mutate bookings.
    return { synced: false, reason: 'secret_key_required_for_updates' };
  }

  try {
    const { error } = await client
      .from('appointments')
      .update({
        patient_name: appt.patient_name,
        patient_phone: appt.patient_phone,
        patient_email: appt.patient_email || '',
        doctor_id: appt.doctor_id,
        doctor_name: appt.doctor_name || '',
        doctor_specialization: appt.doctor_specialization || '',
        service_id: appt.service_id,
        service_name: appt.service_name || '',
        service_category: appt.service_category || '',
        appointment_date: appt.appointment_date,
        start_time: appt.start_time,
        end_time: appt.end_time,
        status: appt.status,
        patient_message: appt.patient_message || '',
        updated_at: new Date().toISOString(),
      })
      .eq('booking_ref', appt.booking_ref);

    if (error) {
      console.error('[Supabase] Appointment update error:', error.code, error.message);
      return { synced: false, reason: error.message };
    }
    return { synced: true };
  } catch (err) {
    console.error('[Supabase] Unexpected appointment update failure:', err);
    return { synced: false, reason: 'network_error' };
  }
}

export async function deleteAppointmentFromSupabase(
  bookingRef: string
): Promise<SupabaseSyncResult> {
  const { hasSecretKey } = getSupabaseEnv();
  const client = getSupabaseClient();
  if (!client) {
    return { synced: false, reason: 'not_configured' };
  }
  if (!hasSecretKey) {
    return { synced: false, reason: 'secret_key_required_for_deletes' };
  }

  try {
    const { error } = await client
      .from('appointments')
      .delete()
      .eq('booking_ref', bookingRef);

    if (error) {
      console.error('[Supabase] Appointment delete error:', error.code, error.message);
      return { synced: false, reason: error.message };
    }
    return { synced: true };
  } catch (err) {
    console.error('[Supabase] Unexpected appointment delete failure:', err);
    return { synced: false, reason: 'network_error' };
  }
}

export async function syncEnquiryToSupabase(enquiry: {
  name: string;
  phone: string;
  email: string;
  message: string;
  status: string;
}): Promise<SupabaseSyncResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { synced: false, reason: 'not_configured' };
  }

  try {
    const { error } = await client.from('enquiries').insert([
      {
        name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email || '',
        message: enquiry.message,
        status: enquiry.status || 'New',
      },
    ]);

    if (error) {
      if (error.code === 'PGRST205') {
        return { synced: false, reason: 'schema_not_initialized' };
      }
      console.error('[Supabase] Enquiry sync error:', error.code, error.message);
      return { synced: false, reason: error.message };
    }

    return { synced: true };
  } catch (err) {
    console.error('[Supabase] Unexpected enquiry sync failure:', err);
    return { synced: false, reason: 'network_error' };
  }
}
