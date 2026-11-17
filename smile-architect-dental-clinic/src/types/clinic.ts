export type AppointmentStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'Rescheduled';

export type ServiceCategory =
  | 'General Dental Care'
  | 'Cosmetic Dentistry'
  | 'Pediatric Dentistry'
  | 'Orthodontics'
  | 'Dental Surgery'
  | 'Restorative Dentistry';

export interface Doctor {
  id: number;
  slug: string;
  name: string;
  specialization: string;
  qualifications: string;
  experience: string;
  bio: string;
  photo_url: string;
  consultation_timings: string;
  is_active: number;
  sort_order: number;
  service_ids?: number[];
}

export interface Service {
  id: number;
  slug: string;
  name: string;
  category: ServiceCategory;
  description: string;
  benefits: string[];
  duration_minutes: number;
  price_inr: number | null;
  image_url: string;
  is_active: number;
  sort_order: number;
  doctors?: Doctor[];
  doctor_ids?: number[];
}

export interface AvailabilityRule {
  id: number;
  doctor_id: number | null;
  day_of_week: number; // 0 = Sunday .. 6 = Saturday
  session_name: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  is_enabled: number;
}

export interface BlockedDate {
  id: number;
  doctor_id: number | null;
  blocked_date: string; // YYYY-MM-DD
  reason: string;
  created_at: string;
}

export interface BlockedSlot {
  id: number;
  doctor_id: number | null;
  blocked_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  reason: string;
  created_at: string;
}

export interface Appointment {
  id: number;
  booking_ref: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  doctor_id: number;
  service_id: number;
  doctor_name?: string;
  doctor_specialization?: string;
  service_name?: string;
  service_category?: string;
  appointment_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  status: AppointmentStatus;
  patient_message: string;
  consent_given: number;
  supabase_synced?: number;
  created_at: string;
  updated_at: string;
}

export interface Enquiry {
  id: number;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: 'New' | 'Reviewed' | 'Resolved';
  created_at: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  category: string;
  image_url: string;
  caption: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

export interface Testimonial {
  id: number;
  patient_name: string;
  treatment: string;
  quote: string;
  visit_date: string;
  is_approved: number;
  created_at: string;
}

export interface ClinicSettings {
  clinic_name: string;
  clinic_category: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  timezone: string;
  slot_interval_minutes: string;
  buffer_minutes: string;
  hero_heading: string;
  hero_subheading: string;
  about_overview: string;
  about_philosophy: string;
  about_mission: string;
  about_vision: string;
  cancellation_policy: string;
  privacy_policy: string;
  social_instagram: string;
  social_facebook: string;
  google_maps_url: string;
  [key: string]: string;
}

export interface TimeSlotOption {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  label: string; // e.g., "10:00 AM"
  sessionName: string;
}
