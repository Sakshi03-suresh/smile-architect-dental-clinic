import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { AvailabilityRule, BlockedDate, BlockedSlot, Doctor } from '../../types/clinic.ts';
import { adminFetch } from '../../lib/adminAuth.ts';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function AdminHoursTab({
  rules,
  blockedDates,
  blockedSlots,
  slotIntervalMinutes,
  bufferMinutes,
  doctors,
  onRefresh,
}: {
  rules: AvailabilityRule[];
  blockedDates: BlockedDate[];
  blockedSlots: BlockedSlot[];
  slotIntervalMinutes: number;
  bufferMinutes: number;
  doctors: Doctor[];
  onRefresh: () => Promise<void>;
}) {
  const [editableRules, setEditableRules] = useState<AvailabilityRule[]>(rules);
  const [intervalMin, setIntervalMin] = useState(slotIntervalMinutes);
  const [bufferMin, setBufferMin] = useState(bufferMinutes);

  useEffect(() => {
    setEditableRules(rules);
  }, [rules]);

  useEffect(() => {
    setIntervalMin(slotIntervalMinutes);
  }, [slotIntervalMinutes]);

  useEffect(() => {
    setBufferMin(bufferMinutes);
  }, [bufferMinutes]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedDateDoc, setNewBlockedDateDoc] = useState('0');
  const [newBlockedDateReason, setNewBlockedDateReason] = useState('Clinic Holiday');

  const [slotDate, setSlotDate] = useState('');
  const [slotStart, setSlotStart] = useState('10:00');
  const [slotEnd, setSlotEnd] = useState('10:30');
  const [slotDoc, setSlotDoc] = useState('0');
  const [slotReason, setSlotReason] = useState('Doctor Unavailable');

  const saveHours = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: editableRules,
          slotIntervalMinutes: intervalMin,
          bufferMinutes: bufferMin,
        }),
      });
      if (!res.ok) throw new Error('Failed to save working hours.');
      await onRefresh();
      setMsg('Working hours and slot interval settings saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const addBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/blocked-dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockedDate: newBlockedDate,
        doctorId: Number(newBlockedDateDoc) || null,
        reason: newBlockedDateReason,
      }),
    });
    if (res.ok) {
      setNewBlockedDate('');
      await onRefresh();
      setMsg('Blocked date added.');
    }
  };

  const removeBlockedDate = async (id: number) => {
    await adminFetch(`/api/admin/blocked-dates/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const addBlockedSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/blocked-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockedDate: slotDate,
        startTime: slotStart,
        endTime: slotEnd,
        doctorId: Number(slotDoc) || null,
        reason: slotReason,
      }),
    });
    if (res.ok) {
      setSlotDate('');
      await onRefresh();
      setMsg('Specific time slot blocked.');
    }
  };

  const removeBlockedSlot = async (id: number) => {
    await adminFetch(`/api/admin/blocked-slots/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#18323B]">
            Working Hours, Holidays & Slot Controls
          </h2>
          <p className="text-xs text-[#71818A] mt-0.5">
            Changes immediately update live availability in the patient booking calendar.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={saveHours}
          className="px-5 py-2.5 rounded-lg bg-[#087F8C] text-white font-heading text-xs font-medium"
        >
          {saving ? 'Saving...' : 'Save Working Hours'}
        </button>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-[#DFF5F3]/60 border border-[#087F8C]/20 text-sm text-[#18323B]">
          {msg}
        </div>
      )}

      {/* Interval & Buffer */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#18323B] mb-1">
            Appointment Slot Interval (minutes)
          </label>
          <input
            type="number"
            min={10}
            max={120}
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#18323B] mb-1">
            Buffer Time Between Appointments (minutes)
          </label>
          <input
            type="number"
            min={0}
            max={60}
            value={bufferMin}
            onChange={(e) => setBufferMin(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
          />
        </div>
      </div>

      {/* Weekly Session Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-heading font-semibold text-[#71818A]">
              <th className="py-3 px-4">Day</th>
              <th className="py-3 px-4">Session</th>
              <th className="py-3 px-4">Opening Time</th>
              <th className="py-3 px-4">Closing Time</th>
              <th className="py-3 px-4">Enabled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {editableRules.map((rule) => (
              <tr key={rule.id}>
                <td className="py-2.5 px-4 font-medium text-[#18323B]">
                  {DAYS[rule.day_of_week]}
                </td>
                <td className="py-2.5 px-4 text-[#71818A]">{rule.session_name}</td>
                <td className="py-2.5 px-4">
                  <input
                    type="time"
                    value={rule.start_time}
                    onChange={(e) =>
                      setEditableRules((prev) =>
                        prev.map((r) => (r.id === rule.id ? { ...r, start_time: e.target.value } : r))
                      )
                    }
                    className="px-2.5 py-1.5 rounded border border-slate-300 text-xs tabular-nums"
                  />
                </td>
                <td className="py-2.5 px-4">
                  <input
                    type="time"
                    value={rule.end_time}
                    onChange={(e) =>
                      setEditableRules((prev) =>
                        prev.map((r) => (r.id === rule.id ? { ...r, end_time: e.target.value } : r))
                      )
                    }
                    className="px-2.5 py-1.5 rounded border border-slate-300 text-xs tabular-nums"
                  />
                </td>
                <td className="py-2.5 px-4">
                  <input
                    type="checkbox"
                    checked={rule.is_enabled === 1}
                    aria-label={`Enable ${DAYS[rule.day_of_week]} ${rule.session_name}`}
                    onChange={(e) =>
                      setEditableRules((prev) =>
                        prev.map((r) =>
                          r.id === rule.id ? { ...r, is_enabled: e.target.checked ? 1 : 0 } : r
                        )
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Holidays / Blocked Dates + Blocked Slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <h3 className="font-heading text-base font-semibold text-[#18323B]">
            Holidays & Blocked Dates
          </h3>
          <form onSubmit={addBlockedDate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="date"
                required
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
                aria-label="Date to block"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <select
                value={newBlockedDateDoc}
                onChange={(e) => setNewBlockedDateDoc(e.target.value)}
                aria-label="Doctor scope for blocked date"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="0">Entire Clinic</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} Only
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlockedDateReason}
                onChange={(e) => setNewBlockedDateReason(e.target.value)}
                placeholder="Reason (e.g., Public Holiday)"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#087F8C] text-white text-xs font-heading font-medium whitespace-nowrap"
              >
                Block Date
              </button>
            </div>
          </form>

          <ul className="divide-y divide-slate-100 text-xs">
            {blockedDates.length === 0 ? (
              <li className="py-3 text-[#71818A]">No blocked dates configured.</li>
            ) : (
              blockedDates.map((b) => (
                <li key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-medium text-[#18323B] tabular-nums">
                      {b.blocked_date}
                    </span>
                    <span className="text-[#71818A]"> · {b.reason}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove blocked date ${b.blocked_date}`}
                    onClick={() => removeBlockedDate(b.id)}
                    className="text-red-700 hover:underline p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <h3 className="font-heading text-base font-semibold text-[#18323B]">
            Block Specific Time Slots
          </h3>
          <form onSubmit={addBlockedSlot} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="date"
                required
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                aria-label="Date for blocked slot"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <select
                value={slotDoc}
                onChange={(e) => setSlotDoc(e.target.value)}
                aria-label="Doctor scope for blocked slot"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="0">Entire Clinic</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} Only
                  </option>
                ))}
              </select>
              <input
                type="time"
                required
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                aria-label="Slot start time"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <input
                type="time"
                required
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                aria-label="Slot end time"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={slotReason}
                onChange={(e) => setSlotReason(e.target.value)}
                placeholder="Reason"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#087F8C] text-white text-xs font-heading font-medium whitespace-nowrap"
              >
                Block Slot
              </button>
            </div>
          </form>

          <ul className="divide-y divide-slate-100 text-xs">
            {blockedSlots.length === 0 ? (
              <li className="py-3 text-[#71818A]">No individual time slots blocked.</li>
            ) : (
              blockedSlots.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-medium text-[#18323B] tabular-nums">
                      {s.blocked_date} ({s.start_time}–{s.end_time})
                    </span>
                    <span className="text-[#71818A]"> · {s.reason}</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove blocked slot ${s.blocked_date}`}
                    onClick={() => removeBlockedSlot(s.id)}
                    className="text-red-700 hover:underline p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
