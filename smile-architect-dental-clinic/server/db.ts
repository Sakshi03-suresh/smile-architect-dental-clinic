import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { hashPassword, verifyPassword } from './auth.ts';

const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || './data/smile_architect.db');
const DATA_DIR = path.dirname(DB_PATH);
export const UPLOADS_DIR = path.resolve(process.cwd(), './data/uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'staff')),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS administrators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Clinic Administrator',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      qualifications TEXT NOT NULL DEFAULT '',
      experience TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      consultation_timings TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      benefits_json TEXT NOT NULL DEFAULT '[]',
      duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes >= 10 AND duration_minutes <= 240),
      price_inr INTEGER DEFAULT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS doctor_services (
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      PRIMARY KEY (doctor_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_ref TEXT NOT NULL UNIQUE,
      patient_name TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      patient_email TEXT NOT NULL DEFAULT '',
      doctor_id INTEGER NOT NULL REFERENCES doctors(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled')),
      patient_message TEXT NOT NULL DEFAULT '',
      consent_given INTEGER NOT NULL DEFAULT 1,
      supabase_synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_status
      ON appointments (doctor_id, appointment_date, status);
    CREATE INDEX IF NOT EXISTS idx_appointments_date
      ON appointments (appointment_date);
    CREATE INDEX IF NOT EXISTS idx_appointments_phone
      ON appointments (patient_phone);

    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      session_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS blocked_dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
      blocked_date TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT 'Clinic Holiday',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_blocked_dates_date
      ON blocked_dates (blocked_date);

    CREATE TABLE IF NOT EXISTS blocked_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER REFERENCES doctors(id) ON DELETE CASCADE,
      blocked_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT 'Slot Unavailable',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_blocked_slots_date
      ON blocked_slots (blocked_date);

    CREATE TABLE IF NOT EXISTS clinic_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Reviewed', 'Resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_name TEXT NOT NULL,
      treatment TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL,
      visit_date TEXT NOT NULL DEFAULT '',
      is_approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appointmentCols = db
    .prepare("PRAGMA table_info('appointments')")
    .all() as Array<{ name: string }>;
  if (!appointmentCols.some((c) => c.name === 'supabase_synced')) {
    db.exec('ALTER TABLE appointments ADD COLUMN supabase_synced INTEGER NOT NULL DEFAULT 0');
  }

  seedInitialData();
}

function seedInitialData(): void {
  // 1. Seed or sync the configured admin user from ADMIN_EMAIL / ADMIN_PASSWORD
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@smilearchitect.in').trim().toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || 'SmileAdmin@2026';

  const existingByEmail = db
    .prepare(
      `SELECT u.id as user_id, u.password_hash, a.id as admin_id, a.is_active
       FROM users u
       LEFT JOIN administrators a ON a.user_id = u.id
       WHERE LOWER(u.email) = ?`
    )
    .get(adminEmail) as
    | { user_id: number; password_hash: string; admin_id: number | null; is_active: number | null }
    | undefined;

  if (existingByEmail) {
    const tx = db.transaction(() => {
      if (!verifyPassword(adminPass, existingByEmail.password_hash)) {
        db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE id = ?').run(
          hashPassword(adminPass),
          'admin',
          existingByEmail.user_id
        );
      }
      if (!existingByEmail.admin_id) {
        db.prepare(
          'INSERT INTO administrators (user_id, full_name, title, is_active) VALUES (?, ?, ?, 1)'
        ).run(existingByEmail.user_id, 'Smile Architect Clinic Admin', 'Clinic Administrator');
      } else if (existingByEmail.is_active !== 1) {
        db.prepare('UPDATE administrators SET is_active = 1 WHERE id = ?').run(
          existingByEmail.admin_id
        );
      }
    });
    tx();
  } else {
    const primaryAdmin = db
      .prepare(
        `SELECT a.id as admin_id, u.id as user_id
         FROM administrators a
         JOIN users u ON u.id = a.user_id
         ORDER BY a.id ASC
         LIMIT 1`
      )
      .get() as { admin_id: number; user_id: number } | undefined;

    const passwordHash = hashPassword(adminPass);
    const tx = db.transaction(() => {
      if (primaryAdmin) {
        db.prepare('UPDATE users SET email = ?, password_hash = ?, role = ? WHERE id = ?').run(
          adminEmail,
          passwordHash,
          'admin',
          primaryAdmin.user_id
        );
        db.prepare('UPDATE administrators SET is_active = 1 WHERE id = ?').run(
          primaryAdmin.admin_id
        );
      } else {
        const userRes = db
          .prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)')
          .run(adminEmail, 'Clinic Administrator', 'admin', passwordHash);
        db.prepare(
          'INSERT INTO administrators (user_id, full_name, title, is_active) VALUES (?, ?, ?, 1)'
        ).run(userRes.lastInsertRowid, 'Smile Architect Clinic Admin', 'Clinic Administrator');
      }
    });
    tx();
  }

  // 2. Seed clinic settings
  const defaultSettings: Record<string, string> = {
    clinic_name: 'Smile Architect Dental Clinic',
    clinic_category: 'Multi-Speciality Dental Clinic',
    address:
      '850/S, 25th Cross Road, Manchegowdana Koppalu, Sankranthi Circle, Hebbal 2nd Stage, Ilavala Hobli, Mysuru, Karnataka, India – 570017',
    phone: '+91 90368 27916',
    whatsapp: '+91 90368 27916',
    email: '',
    timezone: 'Asia/Kolkata',
    slot_interval_minutes: '30',
    buffer_minutes: '10',
    hero_heading: 'Your Smile Deserves Expert Care.',
    hero_subheading:
      'Personalized dental care for every smile. Experience comfortable, modern and compassionate dentistry at Smile Architect Dental Clinic.',
    about_overview:
      'Smile Architect Dental Clinic is a multi-speciality dental clinic located near Sankranthi Circle in Hebbal 2nd Stage, Mysuru. We bring together specialist surgical, implant, pediatric, restorative, and preventive dentistry in a calm, hygiene-conscious clinical environment.',
    about_philosophy:
      'Every treatment begins with listening carefully, explaining diagnostic findings clearly, and recommending care tailored to each patient’s comfort and long-term oral health.',
    about_mission:
      'To deliver attentive, ethical, and modern multi-speciality dental care for adults, seniors, and children across Mysuru.',
    about_vision:
      'To be a trusted neighbourhood dental practice in Hebbal, Mysuru where patients feel informed, respected, and genuinely comfortable at every visit.',
    cancellation_policy:
      'If you need to reschedule or cancel your appointment, please inform the clinic at least 4 hours prior to your scheduled visit by calling +91 90368 27916 or messaging us on WhatsApp so another patient can be accommodated.',
    privacy_policy:
      'Smile Architect Dental Clinic collects only the contact and appointment scheduling information you voluntarily provide (name, mobile number, optional email, and brief appointment notes) solely for coordinating your dental consultation and clinic communication. We do not sell, rent, or publicly display patient contact details.',
    social_instagram: '',
    social_facebook: '',
    google_maps_url:
      'https://www.google.com/maps/search/?api=1&query=850%2FS%2C+25th+Cross+Road%2C+Manchegowdana+Koppalu%2C+Sankranthi+Circle%2C+Hebbal+2nd+Stage%2C+Mysuru+570017',
  };

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO clinic_settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(defaultSettings)) {
    insertSetting.run(k, v);
  }

  // 3. Seed doctors if empty
  const doctorCount = (db.prepare('SELECT COUNT(*) as c FROM doctors').get() as { c: number }).c;
  if (doctorCount === 0) {
    const insertDoc = db.prepare(`
      INSERT INTO doctors (slug, name, specialization, qualifications, experience, bio, photo_url, consultation_timings, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insertDoc.run(
      'dr-anushree-n',
      'Dr. Anushree N',
      'Oral & Maxillofacial Surgeon and Implantologist',
      '',
      '',
      'Oral & Maxillofacial Surgeon and Implantologist providing comprehensive surgical consultations, dental implants, wisdom tooth extraction, restorative care, and TMJ evaluations at Smile Architect Dental Clinic.',
      '',
      'Mon – Sat: 10:00 AM – 1:30 PM & 5:00 PM – 8:30 PM | Sun: 10:00 AM – 1:30 PM',
      1
    );

    insertDoc.run(
      'dr-nisarga-kansar',
      'Dr. Nisarga Kansar',
      'Pediatric Dentist',
      '',
      '',
      'Pediatric Dentist dedicated to gentle, child-friendly preventive check-ups, cavity care, and calm dental guidance designed to help children build positive lifelong dental habits.',
      '',
      'Mon – Sat: 10:00 AM – 1:30 PM & 5:00 PM – 8:30 PM | Sun: 10:00 AM – 1:30 PM',
      2
    );
  }

  // 4. Seed all 15 services if empty
  const serviceCount = (db.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number }).c;
  if (serviceCount === 0) {
    const drAnushree = db
      .prepare('SELECT id FROM doctors WHERE slug = ?')
      .get('dr-anushree-n') as { id: number } | undefined;
    const drNisarga = db
      .prepare('SELECT id FROM doctors WHERE slug = ?')
      .get('dr-nisarga-kansar') as { id: number } | undefined;

    const imgClinic = '/src/assets/images/hero_dental_clinic_1794920281216.jpg';
    const imgTreatment = '/src/assets/images/dental_treatment_suite_1794920281680.jpg';
    const imgPediatric = '/src/assets/images/pediatric_dental_suite_1794920283222.jpg';
    const imgDiag = '/src/assets/images/dental_diagnostics_kit_1794920282840.jpg';

    const seedServices = [
      {
        slug: 'general-dentistry',
        name: 'General Dentistry',
        category: 'General Dental Care',
        description:
          'Comprehensive oral examinations, preventive check-ups, and individualized treatment planning for adults and families.',
        benefits: [
          'Thorough tooth, gum, and bite examination',
          'Early detection of decay or enamel wear',
          'Clear preventive oral hygiene guidance',
        ],
        duration: 30,
        image: imgClinic,
        doctors: [drAnushree?.id, drNisarga?.id],
      },
      {
        slug: 'pediatric-dentistry',
        name: 'Pediatric Dentistry',
        category: 'Pediatric Dentistry',
        description:
          'Gentle, age-appropriate dental care tailored for infants, children, and teenagers in a reassuring clinical setting.',
        benefits: [
          'Child-friendly communication to ease dental anxiety',
          'Preventive check-ups and monitoring of tooth eruption',
          'Early cavity care and parent oral-care guidance',
        ],
        duration: 30,
        image: imgPediatric,
        doctors: [drNisarga?.id],
      },
      {
        slug: 'root-canal-treatment',
        name: 'Root Canal Treatment',
        category: 'Restorative Dentistry',
        description:
          'Focused endodontic care designed to relieve toothache, remove deep infection, and preserve your natural tooth structure.',
        benefits: [
          'Relieves pain from deep decay or nerve inflammation',
          'Preserves your natural tooth rather than extracting it',
          'Supported by digital X-rays for accurate canal assessment',
        ],
        duration: 45,
        image: imgTreatment,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'dental-implants',
        name: 'Dental Implants',
        category: 'Restorative Dentistry',
        description:
          'Specialist implant consultation and surgical placement to replace single or multiple missing teeth with stable, natural-feeling support.',
        benefits: [
          'Surgical planning by an Oral & Maxillofacial Surgeon',
          'Supports biting function and adjacent tooth stability',
          'Long-term restorative foundation for crowns or bridges',
        ],
        duration: 60,
        image: imgTreatment,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'orthodontics',
        name: 'Orthodontics',
        category: 'Orthodontics',
        description:
          'Diagnostic alignment consultations and bite evaluations to correct crowding, spacing, and jaw alignment concerns.',
        benefits: [
          'Comprehensive assessment of tooth alignment and bite',
          'Structured alignment plan for teens and adults',
          'Improves both oral hygiene access and smile harmony',
        ],
        duration: 30,
        image: imgClinic,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'braces-and-aligners',
        name: 'Braces and Aligners',
        category: 'Orthodontics',
        description:
          'Customized orthodontic appliance consultations covering fixed braces and clear aligner options suited to your bite goals.',
        benefits: [
          'Guidance on choosing between braces and clear aligners',
          'Regular progress tracking and gentle adjustments',
          'Supports balanced bite function and straighter teeth',
        ],
        duration: 30,
        image: imgClinic,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'cosmetic-dentistry',
        name: 'Cosmetic Dentistry',
        category: 'Cosmetic Dentistry',
        description:
          'Thoughtful aesthetic dental consultations focused on natural-looking shade, shape, and proportion enhancements.',
        benefits: [
          'Personalized smile evaluation aligned with facial harmony',
          'Conservative options for chipped, worn, or discoloured teeth',
          'Clear discussion of expected outcomes before treatment',
        ],
        duration: 45,
        image: imgClinic,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'teeth-whitening',
        name: 'Teeth Whitening',
        category: 'Cosmetic Dentistry',
        description:
          'Clinically supervised teeth whitening procedures designed to brighten stained or discoloured enamel safely.',
        benefits: [
          'Supervised clinical protection for gums and sensitive areas',
          'Targets surface and intrinsic tooth discolouration',
          'Pre-whitening assessment ensures suitability',
        ],
        duration: 45,
        image: imgClinic,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'dental-cleaning',
        name: 'Dental Cleaning',
        category: 'General Dental Care',
        description:
          'Professional ultrasonic scaling and polishing to remove plaque, tartar buildup, and surface stains along the gumline.',
        benefits: [
          'Helps prevent gum inflammation and bleeding',
          'Removes hardened calculus missed by daily brushing',
          'Leaves tooth surfaces smooth and refreshed',
        ],
        duration: 30,
        image: imgDiag,
        doctors: [drAnushree?.id, drNisarga?.id],
      },
      {
        slug: 'dental-fillings',
        name: 'Dental Fillings',
        category: 'General Dental Care',
        description:
          'Tooth-coloured restorative fillings to repair cavities, minor fractures, and worn tooth areas while matching natural enamel.',
        benefits: [
          'Stops cavity progression early',
          'Blends naturally with surrounding tooth shade',
          'Restores comfortable chewing surface',
        ],
        duration: 30,
        image: imgDiag,
        doctors: [drAnushree?.id, drNisarga?.id],
      },
      {
        slug: 'wisdom-tooth-extraction',
        name: 'Wisdom Tooth Extraction',
        category: 'Dental Surgery',
        description:
          'Careful surgical evaluation and removal of impacted, painful, or malpositioned wisdom teeth by a specialist surgeon.',
        benefits: [
          'Performed by an Oral & Maxillofacial Surgeon',
          'Digital X-ray evaluation of root and nerve proximity',
          'Clear post-operative comfort and recovery instructions',
        ],
        duration: 45,
        image: imgTreatment,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'oral-and-maxillofacial-surgery',
        name: 'Oral and Maxillofacial Surgery',
        category: 'Dental Surgery',
        description:
          'Specialist surgical care for complex extractions, jaw cysts or lesions, pre-prosthetic procedures, and facial oral conditions.',
        benefits: [
          'Specialist surgical consultation and diagnostic imaging',
          'Strict sterile surgical protocols and hygiene standards',
          'Structured follow-up care throughout healing',
        ],
        duration: 60,
        image: imgTreatment,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'crowns-and-bridges',
        name: 'Crowns and Bridges',
        category: 'Restorative Dentistry',
        description:
          'Custom-fitted dental crowns to protect weakened teeth and fixed bridges to restore gaps from missing teeth.',
        benefits: [
          'Protects root-canal treated or fractured teeth',
          'Restores chewing balance and speech clarity',
          'Precision shade matching for a natural appearance',
        ],
        duration: 45,
        image: imgTreatment,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'tmj-therapy',
        name: 'TMJ Therapy',
        category: 'Dental Surgery',
        description:
          'Clinical evaluation and conservative management for jaw joint clicking, soreness, teeth clenching, and restricted mouth opening.',
        benefits: [
          'Targeted assessment of temporomandibular joint function',
          'Identifies bite strain, clenching, or muscular tension',
          'Individualized conservative management plan',
        ],
        duration: 30,
        image: imgDiag,
        doctors: [drAnushree?.id],
      },
      {
        slug: 'digital-dental-x-rays',
        name: 'Digital Dental X-rays',
        category: 'General Dental Care',
        description:
          'Low-radiation digital intraoral imaging for fast, clear visualization of tooth roots, bone levels, and hidden decay.',
        benefits: [
          'Immediate chairside image viewing for clear explanation',
          'Lower radiation exposure compared to conventional film',
          'Supports accurate diagnosis across all dental specialities',
        ],
        duration: 15,
        image: imgDiag,
        doctors: [drAnushree?.id, drNisarga?.id],
      },
    ];

    const insertSvc = db.prepare(`
      INSERT INTO services (slug, name, category, description, benefits_json, duration_minutes, price_inr, image_url, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 1, ?)
    `);
    const linkDocSvc = db.prepare(
      'INSERT OR IGNORE INTO doctor_services (doctor_id, service_id) VALUES (?, ?)'
    );

    seedServices.forEach((svc, idx) => {
      const res = insertSvc.run(
        svc.slug,
        svc.name,
        svc.category,
        svc.description,
        JSON.stringify(svc.benefits),
        svc.duration,
        svc.image,
        idx + 1
      );
      const serviceId = Number(res.lastInsertRowid);
      for (const docId of svc.doctors) {
        if (docId) linkDocSvc.run(docId, serviceId);
      }
    });
  }

  // 5. Seed clinic default availability rules if empty
  // Mon (1) - Sat (6): Morning 10:00-13:30, Evening 17:00-20:30
  // Sun (0): Morning 10:00-13:30, Evening disabled
  const availCount = (db.prepare('SELECT COUNT(*) as c FROM availability').get() as { c: number }).c;
  if (availCount === 0) {
    const insertAvail = db.prepare(`
      INSERT INTO availability (doctor_id, day_of_week, session_name, start_time, end_time, is_enabled)
      VALUES (NULL, ?, ?, ?, ?, ?)
    `);

    for (let day = 0; day <= 6; day++) {
      insertAvail.run(day, 'Morning', '10:00', '13:30', 1);
      if (day === 0) {
        insertAvail.run(day, 'Evening', '17:00', '20:30', 0);
      } else {
        insertAvail.run(day, 'Evening', '17:00', '20:30', 1);
      }
    }
  }

  // 6. Seed gallery items if empty (clean architectural clinic showcase; admin can replace with uploaded clinic photos)
  const galleryCount = (db.prepare('SELECT COUNT(*) as c FROM gallery').get() as { c: number }).c;
  if (galleryCount === 0) {
    const insertGallery = db.prepare(`
      INSERT INTO gallery (title, category, image_url, caption, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    insertGallery.run(
      'Consultation & Treatment Suite',
      'Dental treatment rooms',
      '/src/assets/images/hero_dental_clinic_1794920281216.jpg',
      'Daylit consultation and clinical suite designed for patient comfort.',
      1
    );
    insertGallery.run(
      'Reception & Waiting Lounge',
      'Reception area',
      '/src/assets/images/clinic_reception_lounge_1794920301714.jpg',
      'Calm, welcoming patient reception area.',
      2
    );
    insertGallery.run(
      'Surgical & Implant Operatory',
      'Dental equipment',
      '/src/assets/images/dental_treatment_suite_1794920281680.jpg',
      'Modern dental operatory equipped with digital diagnostic visualization.',
      3
    );
    insertGallery.run(
      'Pediatric Dental Care Room',
      'Clinic environment',
      '/src/assets/images/pediatric_dental_suite_1794920283222.jpg',
      'Warm, child-friendly care environment tailored for younger patients.',
      4
    );
    insertGallery.run(
      'Digital Diagnostics & Sterile Instruments',
      'Dental equipment',
      '/src/assets/images/dental_diagnostics_kit_1794920282840.jpg',
      'Sterilized diagnostic instrumentation and digital intraoral scanning support.',
      5
    );
  }
}
