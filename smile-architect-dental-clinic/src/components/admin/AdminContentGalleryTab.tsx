import React, { useEffect, useState } from 'react';
import { Trash2, Upload, Check, MessageCircle } from 'lucide-react';
import type { ClinicSettings, Enquiry, GalleryItem, Testimonial } from '../../types/clinic.ts';
import { ClinicImage } from '../ClinicBrand.tsx';
import { buildWhatsAppLink } from '../../utils/validation.ts';
import { adminFetch } from '../../lib/adminAuth.ts';

const GALLERY_CATEGORIES = [
  'Clinic exterior',
  'Reception area',
  'Dental treatment rooms',
  'Dental equipment',
  'Doctors and staff',
  'Dental procedures',
  'Clinic environment',
];

export function AdminGalleryTab({
  gallery,
  onRefresh,
}: {
  gallery: GalleryItem[];
  onRefresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(GALLERY_CATEGORIES[2]);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(file);
    });
    const res = await adminFetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, dataUrl }),
    });
    const data = await res.json();
    if (res.ok) setImageUrl(data.url);
    else setMsg(data.error || 'Upload failed.');
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, imageUrl, caption }),
    });
    if (res.ok) {
      setTitle('');
      setImageUrl('');
      setCaption('');
      await onRefresh();
      setMsg('Gallery photo added.');
    }
  };

  const handleDelete = async (id: number) => {
    await adminFetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-[#18323B]">Gallery Management</h2>
      {msg && (
        <div className="p-3 rounded-xl bg-[#DFF5F3]/60 border border-[#087F8C]/20 text-sm text-[#18323B]">
          {msg}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="p-5 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Photo title *"
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
        >
          {GALLERY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <input
            type="text"
            required
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL or upload file *"
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium cursor-pointer hover:bg-slate-50">
            <Upload className="w-3.5 h-3.5 text-[#087F8C]" />
            Upload Photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
          </label>
        </div>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Optional caption"
          className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-sm"
        />
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-xs font-medium"
          >
            Add to Gallery
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {gallery.map((g) => (
          <div key={g.id} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <div className="aspect-[16/10] bg-slate-100">
              <ClinicImage src={g.image_url} alt={g.title} />
            </div>
            <div className="p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[#087F8C]">{g.category}</p>
                <p className="font-heading text-sm font-semibold text-[#18323B]">{g.title}</p>
              </div>
              <button
                type="button"
                aria-label={`Delete ${g.title}`}
                onClick={() => handleDelete(g.id)}
                className="text-red-700 hover:bg-red-50 p-1.5 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminEnquiriesTab({
  enquiries,
  onRefresh,
}: {
  enquiries: Enquiry[];
  onRefresh: () => Promise<void>;
}) {
  const updateStatus = async (id: number, status: Enquiry['status']) => {
    await adminFetch(`/api/admin/enquiries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-semibold text-[#18323B]">Patient Enquiries</h2>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {enquiries.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#71818A]">No enquiries received yet.</div>
        ) : (
          enquiries.map((e) => (
            <div key={e.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-heading text-sm font-semibold text-[#18323B]">{e.name}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-[#087F8C] font-medium">{e.phone}</span>
                  {e.email && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#71818A]">{e.email}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="text-[#71818A] tabular-nums">{e.created_at}</span>
                </div>
                <p className="text-sm text-[#18323B] pt-1">{e.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={buildWhatsAppLink(e.phone, `Hello ${e.name}, thank you for contacting Smile Architect Dental Clinic.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#087F8C]/30 text-[#087F8C] text-xs font-medium"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
                <select
                  value={e.status}
                  onChange={(ev) => updateStatus(e.id, ev.target.value as Enquiry['status'])}
                  aria-label={`Status for ${e.name}`}
                  className="px-2.5 py-1.5 rounded border border-slate-300 text-xs bg-white"
                >
                  <option value="New">New</option>
                  <option value="Reviewed">Reviewed</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminContentTestimonialsTab({
  settings,
  testimonials,
  onRefresh,
}: {
  settings: ClinicSettings;
  testimonials: Testimonial[];
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState<ClinicSettings>(settings);
  useEffect(() => {
    setForm(settings);
  }, [settings]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [tName, setTName] = useState('');
  const [tTreatment, setTTreatment] = useState('');
  const [tQuote, setTQuote] = useState('');

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to update clinic content.');
      await onRefresh();
      setMsg('Website content and clinic settings saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const addTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: tName,
        treatment: tTreatment,
        quote: tQuote,
        isApproved: 1,
      }),
    });
    if (res.ok) {
      setTName('');
      setTTreatment('');
      setTQuote('');
      await onRefresh();
    }
  };

  const toggleApprove = async (id: number, current: number) => {
    await adminFetch(`/api/admin/testimonials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isApproved: current === 0 }),
    });
    await onRefresh();
  };

  const deleteTestimonial = async (id: number) => {
    await adminFetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      {msg && (
        <div className="p-3.5 rounded-xl bg-[#DFF5F3]/60 border border-[#087F8C]/20 text-sm text-[#18323B]">
          {msg}
        </div>
      )}

      {/* Website Content Settings */}
      <form
        onSubmit={saveSettings}
        className="p-6 rounded-2xl bg-white border border-slate-200 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-[#18323B]">
            Clinic Details & Website Content
          </h2>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-xs font-medium"
          >
            {saving ? 'Saving...' : 'Save Content'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium mb-1">Clinic Name</label>
            <input
              type="text"
              value={form.clinic_name || ''}
              onChange={(e) => setForm({ ...form, clinic_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Phone Number</label>
            <input
              type="text"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">WhatsApp Number</label>
            <input
              type="text"
              value={form.whatsapp || ''}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Clinic Email (Optional)</label>
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Address</label>
            <textarea
              rows={2}
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Homepage Hero Heading</label>
            <input
              type="text"
              value={form.hero_heading || ''}
              onChange={(e) => setForm({ ...form, hero_heading: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Homepage Hero Subheading</label>
            <textarea
              rows={2}
              value={form.hero_subheading || ''}
              onChange={(e) => setForm({ ...form, hero_subheading: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">About Clinic Overview</label>
            <textarea
              rows={3}
              value={form.about_overview || ''}
              onChange={(e) => setForm({ ...form, about_overview: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Verified Instagram URL (Optional)</label>
            <input
              type="url"
              value={form.social_instagram || ''}
              onChange={(e) => setForm({ ...form, social_instagram: e.target.value })}
              placeholder="https://instagram.com/..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Verified Facebook URL (Optional)</label>
            <input
              type="url"
              value={form.social_facebook || ''}
              onChange={(e) => setForm({ ...form, social_facebook: e.target.value })}
              placeholder="https://facebook.com/..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
        </div>
      </form>

      {/* Testimonials Moderation & Publishing */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-5">
        <div>
          <h3 className="font-heading text-lg font-semibold text-[#18323B]">
            Patient Testimonials (Authentic & Approved Only)
          </h3>
          <p className="text-xs text-[#71818A] mt-0.5">
            Approve verified patient reviews or add authentic clinic reviews directly.
          </p>
        </div>

        <form onSubmit={addTestimonial} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            required
            value={tName}
            onChange={(e) => setTName(e.target.value)}
            placeholder="Patient Name *"
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <input
            type="text"
            value={tTreatment}
            onChange={(e) => setTTreatment(e.target.value)}
            placeholder="Treatment (e.g., Dental Implants)"
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <textarea
            rows={2}
            required
            value={tQuote}
            onChange={(e) => setTQuote(e.target.value)}
            placeholder="Authentic patient review quote *"
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#087F8C] text-white font-heading text-xs font-medium"
            >
              Publish Approved Review
            </button>
          </div>
        </form>

        <div className="divide-y divide-slate-100 text-sm">
          {testimonials.length === 0 ? (
            <p className="py-4 text-xs text-[#71818A]">No patient reviews stored yet.</p>
          ) : (
            testimonials.map((t) => (
              <div key={t.id} className="py-3.5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[#18323B]">“{t.quote}”</p>
                  <p className="text-xs text-[#71818A] mt-1">
                    {t.patient_name}
                    {t.treatment ? ` · ${t.treatment}` : ''} ·{' '}
                    <span className="font-medium">
                      {t.is_approved ? 'Published' : 'Pending Approval'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleApprove(t.id, t.is_approved)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 text-xs"
                  >
                    <Check className="w-3.5 h-3.5 text-[#087F8C]" />
                    {t.is_approved ? 'Hide' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete review by ${t.patient_name}`}
                    onClick={() => deleteTestimonial(t.id)}
                    className="p-1.5 rounded text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
