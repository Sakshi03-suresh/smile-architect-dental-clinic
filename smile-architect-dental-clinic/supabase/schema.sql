-- Smile Architect Dental Clinic – Supabase PostgreSQL Schema & RLS Policies
-- Run this script once in your Supabase Dashboard -> SQL Editor.

-- 1. Doctors
CREATE TABLE IF NOT EXISTS public.doctors (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  qualifications TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  consultation_timings TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Services
CREATE TABLE IF NOT EXISTS public.services (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'General Dental Care',
    'Cosmetic Dentistry',
    'Pediatric Dentistry',
    'Orthodontics',
    'Dental Surgery',
    'Restorative Dentistry'
  )),
  description TEXT NOT NULL,
  benefits_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes >= 10 AND duration_minutes <= 240),
  price_inr INTEGER DEFAULT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Appointments (Primary patient booking table synced on every booking)
CREATE TABLE IF NOT EXISTS public.appointments (
  id BIGSERIAL PRIMARY KEY,
  booking_ref TEXT NOT NULL UNIQUE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT NOT NULL DEFAULT '',
  doctor_id INTEGER,
  doctor_name TEXT NOT NULL DEFAULT '',
  doctor_specialization TEXT NOT NULL DEFAULT '',
  service_id INTEGER,
  service_name TEXT NOT NULL DEFAULT '',
  service_category TEXT NOT NULL DEFAULT '',
  appointment_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled')),
  patient_message TEXT NOT NULL DEFAULT '',
  consent_given BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date
  ON public.appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_status
  ON public.appointments (doctor_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_phone
  ON public.appointments (patient_phone);

-- 4. Patient Contact Enquiries
CREATE TABLE IF NOT EXISTS public.enquiries (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Reviewed', 'Resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Clinic Settings, Availability, Gallery & Testimonials (Optional Reference Tables)
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id BIGSERIAL PRIMARY KEY,
  patient_name TEXT NOT NULL,
  treatment TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  visit_date TEXT NOT NULL DEFAULT '',
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial doctors
INSERT INTO public.doctors (slug, name, specialization, bio, consultation_timings, is_active, sort_order)
VALUES
  (
    'dr-anushree-n',
    'Dr. Anushree N',
    'Oral & Maxillofacial Surgeon and Implantologist',
    'Oral & Maxillofacial Surgeon and Implantologist providing comprehensive surgical consultations, dental implants, wisdom tooth extraction, restorative care, and TMJ evaluations at Smile Architect Dental Clinic.',
    'Mon – Sat: 10:00 AM – 1:30 PM & 5:00 PM – 8:30 PM | Sun: 10:00 AM – 1:30 PM',
    TRUE,
    1
  ),
  (
    'dr-nisarga-kansar',
    'Dr. Nisarga Kansar',
    'Pediatric Dentist',
    'Pediatric Dentist dedicated to gentle, child-friendly preventive check-ups, cavity care, and calm dental guidance designed to help children build positive lifelong dental habits.',
    'Mon – Sat: 10:00 AM – 1:30 PM & 5:00 PM – 8:30 PM | Sun: 10:00 AM – 1:30 PM',
    TRUE,
    2
  )
ON CONFLICT (slug) DO NOTHING;

-- Seed initial 15 services
INSERT INTO public.services (slug, name, category, description, duration_minutes, is_active, sort_order)
VALUES
  ('general-dentistry', 'General Dentistry', 'General Dental Care', 'Comprehensive oral examinations, preventive check-ups, and individualized treatment planning for adults and families.', 30, TRUE, 1),
  ('pediatric-dentistry', 'Pediatric Dentistry', 'Pediatric Dentistry', 'Gentle, age-appropriate dental care tailored for infants, children, and teenagers in a reassuring clinical setting.', 30, TRUE, 2),
  ('root-canal-treatment', 'Root Canal Treatment', 'Restorative Dentistry', 'Focused endodontic care designed to relieve toothache, remove deep infection, and preserve your natural tooth structure.', 45, TRUE, 3),
  ('dental-implants', 'Dental Implants', 'Restorative Dentistry', 'Specialist implant consultation and surgical placement to replace single or multiple missing teeth with stable, natural-feeling support.', 60, TRUE, 4),
  ('orthodontics', 'Orthodontics', 'Orthodontics', 'Diagnostic alignment consultations and bite evaluations to correct crowding, spacing, and jaw alignment concerns.', 30, TRUE, 5),
  ('braces-and-aligners', 'Braces and Aligners', 'Orthodontics', 'Customized orthodontic appliance consultations covering fixed braces and clear aligner options suited to your bite goals.', 30, TRUE, 6),
  ('cosmetic-dentistry', 'Cosmetic Dentistry', 'Cosmetic Dentistry', 'Thoughtful aesthetic dental consultations focused on natural-looking shade, shape, and proportion enhancements.', 45, TRUE, 7),
  ('teeth-whitening', 'Teeth Whitening', 'Cosmetic Dentistry', 'Clinically supervised teeth whitening procedures designed to brighten stained or discoloured enamel safely.', 45, TRUE, 8),
  ('dental-cleaning', 'Dental Cleaning', 'General Dental Care', 'Professional ultrasonic scaling and polishing to remove plaque, tartar buildup, and surface stains along the gumline.', 30, TRUE, 9),
  ('dental-fillings', 'Dental Fillings', 'General Dental Care', 'Tooth-coloured restorative fillings to repair cavities, minor fractures, and worn tooth areas while matching natural enamel.', 30, TRUE, 10),
  ('wisdom-tooth-extraction', 'Wisdom Tooth Extraction', 'Dental Surgery', 'Careful surgical evaluation and removal of impacted, painful, or malpositioned wisdom teeth by a specialist surgeon.', 45, TRUE, 11),
  ('oral-and-maxillofacial-surgery', 'Oral and Maxillofacial Surgery', 'Dental Surgery', 'Specialist surgical care for complex extractions, jaw cysts or lesions, pre-prosthetic procedures, and facial oral conditions.', 60, TRUE, 12),
  ('crowns-and-bridges', 'Crowns and Bridges', 'Restorative Dentistry', 'Custom-fitted dental crowns to protect weakened teeth and fixed bridges to restore gaps from missing teeth.', 45, TRUE, 13),
  ('tmj-therapy', 'TMJ Therapy', 'Dental Surgery', 'Clinical evaluation and conservative management for jaw joint clicking, soreness, teeth clenching, and restricted mouth opening.', 30, TRUE, 14),
  ('digital-dental-x-rays', 'Digital Dental X-rays', 'General Dental Care', 'Low-radiation digital intraoral imaging for fast, clear visualization of tooth roots, bone levels, and hidden decay.', 15, TRUE, 15)
ON CONFLICT (slug) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Public read access for non-PII catalog tables
DROP POLICY IF EXISTS "Public can read active doctors" ON public.doctors;
CREATE POLICY "Public can read active doctors"
  ON public.doctors FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public can read active services" ON public.services;
CREATE POLICY "Public can read active services"
  ON public.services FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public can read clinic settings" ON public.clinic_settings;
CREATE POLICY "Public can read clinic settings"
  ON public.clinic_settings FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Public can read approved testimonials" ON public.testimonials;
CREATE POLICY "Public can read approved testimonials"
  ON public.testimonials FOR SELECT
  TO anon, authenticated
  USING (is_approved = TRUE);

-- Allow new bookings & enquiries to be inserted via publishable key,
-- while keeping SELECT/UPDATE/DELETE locked down so patient PII stays private.
DROP POLICY IF EXISTS "Allow inserting new appointments" ON public.appointments;
CREATE POLICY "Allow inserting new appointments"
  ON public.appointments FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(patient_name)) >= 2
    AND char_length(trim(patient_phone)) >= 10
    AND consent_given = TRUE
  );

DROP POLICY IF EXISTS "Allow inserting new enquiries" ON public.enquiries;
CREATE POLICY "Allow inserting new enquiries"
  ON public.enquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(name)) >= 2
    AND char_length(trim(message)) >= 5
  );
