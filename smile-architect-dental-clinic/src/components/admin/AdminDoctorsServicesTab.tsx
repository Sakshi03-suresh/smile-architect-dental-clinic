import React, { useState } from 'react';
import { Plus, Upload, Trash2 } from 'lucide-react';
import type { Doctor, Service, ServiceCategory } from '../../types/clinic.ts';
import { adminFetch } from '../../lib/adminAuth.ts';

const SERVICE_CATEGORIES: ServiceCategory[] = [
  'General Dental Care',
  'Cosmetic Dentistry',
  'Pediatric Dentistry',
  'Orthodontics',
  'Dental Surgery',
  'Restorative Dentistry',
];

async function uploadImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
  const res = await adminFetch('/api/admin/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, dataUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed.');
  return data.url as string;
}

export function AdminDoctorsTab({
  doctors,
  services,
  onRefresh,
}: {
  doctors: Doctor[];
  services: Service[];
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<Doctor> & { service_ids: number[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const openNew = () =>
    setEditing({
      name: '',
      specialization: '',
      qualifications: '',
      experience: '',
      bio: '',
      photo_url: '',
      consultation_timings: 'Mon – Sat: 10:00 AM – 1:30 PM & 5:00 PM – 8:30 PM | Sun: 10:00 AM – 1:30 PM',
      is_active: 1,
      service_ids: [],
    });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    try {
      const url = editing.id ? `/api/admin/doctors/${editing.id}` : '/api/admin/doctors';
      const method = editing.id ? 'PUT' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          specialization: editing.specialization,
          qualifications: editing.qualifications || '',
          experience: editing.experience || '',
          bio: editing.bio || '',
          photoUrl: editing.photo_url || '',
          consultationTimings: editing.consultation_timings || '',
          isActive: editing.is_active ?? 1,
          serviceIds: editing.service_ids || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save doctor.');
      await onRefresh();
      setEditing(null);
      setMsg('Doctor profile saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await adminFetch(`/api/admin/doctors/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await onRefresh();
      setMsg('Doctor updated.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-xl font-semibold text-[#18323B]">Doctor Management</h2>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-xs font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Doctor
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-[#DFF5F3]/60 border border-[#087F8C]/20 text-sm text-[#18323B]">
          {msg}
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4"
        >
          <h3 className="font-heading text-base font-semibold text-[#18323B]">
            {editing.id ? `Edit ${editing.name}` : 'Add New Doctor'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Doctor Name *</label>
              <input
                type="text"
                required
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Specialization *</label>
              <input
                type="text"
                required
                value={editing.specialization || ''}
                onChange={(e) => setEditing({ ...editing, specialization: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Qualifications (Optional)</label>
              <input
                type="text"
                value={editing.qualifications || ''}
                onChange={(e) => setEditing({ ...editing, qualifications: e.target.value })}
                placeholder="e.g., MDS"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Experience (Optional)</label>
              <input
                type="text"
                value={editing.experience || ''}
                onChange={(e) => setEditing({ ...editing, experience: e.target.value })}
                placeholder="e.g., 8+ years"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Consultation Timings</label>
              <input
                type="text"
                value={editing.consultation_timings || ''}
                onChange={(e) => setEditing({ ...editing, consultation_timings: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Doctor Photo</label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={editing.photo_url || ''}
                  onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })}
                  placeholder="Image URL or upload below"
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium cursor-pointer hover:bg-slate-50">
                  <Upload className="w-3.5 h-3.5 text-[#087F8C]" />
                  Upload Photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadImageFile(file);
                        setEditing({ ...editing, photo_url: url });
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : 'Upload failed');
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Professional Introduction</label>
              <textarea
                rows={3}
                value={editing.bio || ''}
                onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium mb-2">Assigned Services</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-slate-50">
                {services.map((s) => {
                  const checked = editing.service_ids.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...editing.service_ids, s.id]
                            : editing.service_ids.filter((id) => id !== s.id);
                          setEditing({ ...editing, service_ids: next });
                        }}
                      />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={editing.is_active !== 0}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked ? 1 : 0 })}
              />
              Active on public website & booking
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#087F8C] text-white font-heading text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save Doctor'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {doctors.map((d) => (
          <div
            key={d.id}
            className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-base font-semibold text-[#18323B]">{d.name}</h3>
                <span className="text-xs text-[#71818A]">
                  {d.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs font-medium text-[#087F8C]">{d.specialization}</p>
              <p className="text-xs text-[#71818A] line-clamp-2">{d.bio}</p>
              <p className="text-xs text-[#71818A] tabular-nums pt-1">
                Assigned services: {d.service_ids?.length || 0}
              </p>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing({ ...d, service_ids: d.service_ids || [] })}
                className="text-xs font-heading font-medium text-[#087F8C] hover:underline"
              >
                Edit Profile & Services
              </button>
              <button
                type="button"
                onClick={() => handleDelete(d.id)}
                className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminServicesTab({
  services,
  doctors,
  onRefresh,
}: {
  services: Service[];
  doctors: Doctor[];
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<
    (Partial<Service> & { benefitsText: string; doctor_ids: number[] }) | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const openNew = () =>
    setEditing({
      name: '',
      category: 'General Dental Care',
      description: '',
      benefitsText: '',
      duration_minutes: 30,
      price_inr: null,
      image_url: '/src/assets/images/hero_dental_clinic_1794920281216.jpg',
      is_active: 1,
      doctor_ids: doctors.map((d) => d.id),
    });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    try {
      const url = editing.id ? `/api/admin/services/${editing.id}` : '/api/admin/services';
      const method = editing.id ? 'PUT' : 'POST';
      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          category: editing.category,
          description: editing.description,
          benefits: editing.benefitsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          durationMinutes: Number(editing.duration_minutes) || 30,
          priceInr:
            editing.price_inr === null || editing.price_inr === undefined
              ? null
              : Number(editing.price_inr),
          imageUrl: editing.image_url || '',
          isActive: editing.is_active ?? 1,
          doctorIds: editing.doctor_ids || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save service.');
      await onRefresh();
      setEditing(null);
      setMsg('Service updated successfully.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-xl font-semibold text-[#18323B]">Service Management</h2>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-xs font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-[#DFF5F3]/60 border border-[#087F8C]/20 text-sm text-[#18323B]">
          {msg}
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSave}
          className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4"
        >
          <h3 className="font-heading text-base font-semibold text-[#18323B]">
            {editing.id ? `Edit ${editing.name}` : 'Create Dental Service'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Service Name *</label>
              <input
                type="text"
                required
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category *</label>
              <select
                value={editing.category || 'General Dental Care'}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value as ServiceCategory })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Duration (minutes) *</label>
              <input
                type="number"
                min={10}
                max={240}
                required
                value={editing.duration_minutes || 30}
                onChange={(e) =>
                  setEditing({ ...editing, duration_minutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Consultation Price in INR (leave empty to hide)
              </label>
              <input
                type="number"
                min={0}
                value={editing.price_inr === null || editing.price_inr === undefined ? '' : editing.price_inr}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    price_inr: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                placeholder="e.g., 500"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Service Description *</label>
              <textarea
                rows={3}
                required
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">
                Benefits (one bullet per line)
              </label>
              <textarea
                rows={3}
                value={editing.benefitsText}
                onChange={(e) => setEditing({ ...editing, benefitsText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium mb-1">Service Image</label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={editing.image_url || ''}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium cursor-pointer hover:bg-slate-50">
                  <Upload className="w-3.5 h-3.5 text-[#087F8C]" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadImageFile(file);
                        setEditing({ ...editing, image_url: url });
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : 'Upload failed');
                      }
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium mb-2">Assigned Doctors</p>
              <div className="flex flex-wrap gap-4">
                {doctors.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.doctor_ids.includes(d.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...editing.doctor_ids, d.id]
                          : editing.doctor_ids.filter((id) => id !== d.id);
                        setEditing({ ...editing, doctor_ids: next });
                      }}
                    />
                    <span>{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={editing.is_active !== 0}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked ? 1 : 0 })}
              />
              Service Active (Visible to patients)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#087F8C] text-white font-heading text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save Service'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-heading font-semibold text-[#71818A]">
              <th className="py-3 px-4">Service</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Price</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/70">
                <td className="py-3 px-4 font-medium text-[#18323B]">{s.name}</td>
                <td className="py-3 px-4 text-[#71818A]">{s.category}</td>
                <td className="py-3 px-4 tabular-nums">{s.duration_minutes} mins</td>
                <td className="py-3 px-4 tabular-nums">
                  {s.price_inr !== null ? `₹${s.price_inr.toLocaleString('en-IN')}` : 'Unset'}
                </td>
                <td className="py-3 px-4">{s.is_active ? 'Active' : 'Inactive'}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...s,
                        benefitsText: (s.benefits || []).join('\n'),
                        doctor_ids: s.doctor_ids || [],
                      })
                    }
                    className="text-xs font-heading font-medium text-[#087F8C] hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
