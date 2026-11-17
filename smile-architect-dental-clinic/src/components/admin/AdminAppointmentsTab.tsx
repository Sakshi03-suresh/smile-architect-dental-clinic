import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch, downloadAdminFile } from '../../lib/adminAuth.ts';
import { formatTime12h, getTodayIST } from '../../utils/scheduling.ts';
import { formatReadableDate } from '../../utils/validation.ts';
import type { Appointment, AppointmentStatus, Doctor, Service } from '../../types/clinic.ts';

interface OverviewStats {
  totalAppointments: number;
  todayAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  totalEnquiries: number;
}

interface Props {
  appointments: Appointment[];
  doctors: Doctor[];
  services: Service[];
  stats?: OverviewStats;
  todayIST?: string;
  supabaseStatus?: { configured: boolean; canEditRemote: boolean };
  onRefresh: () => Promise<void>;
}

const STATUS_FILTERS: Array<'All' | AppointmentStatus> = [
  'All',
  'Pending',
  'Confirmed',
  'Rescheduled',
  'Completed',
  'Cancelled',
];

const EDITABLE_STATUSES: AppointmentStatus[] = [
  'Pending',
  'Confirmed',
  'Rescheduled',
  'Completed',
  'Cancelled',
];

export function AdminAppointmentsTab({
  appointments,
  doctors,
  services,
  stats,
  todayIST,
  supabaseStatus,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('0');
  const [serviceFilter, setServiceFilter] = useState('0');
  const [statusFilter, setStatusFilter] = useState<'All' | AppointmentStatus>('All');

  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    isError?: boolean;
    waUrl?: string;
  } | null>(null);

  // View Details modal
  const [viewTarget, setViewTarget] = useState<Appointment | null>(null);

  // Edit Appointment modal (full patient & scheduling edit)
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editServiceId, setEditServiceId] = useState(0);
  const [editDoctorId, setEditDoctorId] = useState(0);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editStatus, setEditStatus] = useState<AppointmentStatus>('Pending');
  const [editMessage, setEditMessage] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Cancel / Delete confirmation modals (no window.confirm)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  // New walk-in / phone booking modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newServiceId, setNewServiceId] = useState(0);
  const [newDoctorId, setNewDoctorId] = useState(0);
  const [newDate, setNewDate] = useState(() => todayIST || getTodayIST());
  const [newTime, setNewTime] = useState('10:00');
  const [newStatus, setNewStatus] = useState<AppointmentStatus>('Confirmed');
  const [newNotes, setNewNotes] = useState('');

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(dateFilter) ||
    doctorFilter !== '0' ||
    serviceFilter !== '0' ||
    statusFilter !== 'All';

  const clearFilters = () => {
    setSearch('');
    setDateFilter('');
    setDoctorFilter('0');
    setServiceFilter('0');
    setStatusFilter('All');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (dateFilter && a.appointment_date !== dateFilter) return false;
      if (Number(doctorFilter) > 0 && a.doctor_id !== Number(doctorFilter)) return false;
      if (Number(serviceFilter) > 0 && a.service_id !== Number(serviceFilter)) return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.patient_name.toLowerCase().includes(q) ||
        a.patient_phone.toLowerCase().includes(q) ||
        a.patient_email.toLowerCase().includes(q) ||
        a.booking_ref.toLowerCase().includes(q) ||
        (a.doctor_name || '').toLowerCase().includes(q) ||
        (a.service_name || '').toLowerCase().includes(q)
      );
    });
  }, [appointments, search, dateFilter, doctorFilter, serviceFilter, statusFilter]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setFeedback(null);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const openEditModal = (a: Appointment) => {
    setEditTarget(a);
    setEditName(a.patient_name);
    setEditPhone(a.patient_phone);
    setEditEmail(a.patient_email || '');
    setEditServiceId(a.service_id);
    setEditDoctorId(a.doctor_id);
    setEditDate(a.appointment_date);
    setEditTime(a.start_time);
    setEditStatus(a.status);
    setEditMessage(a.patient_message || '');
    setEditError(null);
  };

  const openCreateModal = () => {
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewServiceId(services[0]?.id || 0);
    setNewDoctorId(doctors[0]?.id || 0);
    setNewDate(todayIST || getTodayIST());
    setNewTime('10:00');
    setNewStatus('Confirmed');
    setNewNotes('');
    setCreateError(null);
    setCreateOpen(true);
  };

  const updateAppointment = async (
    id: number,
    payload: {
      patientName?: string;
      patientPhone?: string;
      patientEmail?: string;
      serviceId?: number;
      doctorId?: number;
      appointmentDate?: string;
      startTime?: string;
      status?: AppointmentStatus;
      patientMessage?: string;
    },
    fromEditModal = false
  ) => {
    setBusyId(id);
    if (fromEditModal) setEditError(null);
    else setFeedback(null);

    try {
      const res = await adminFetch(`/api/admin/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update appointment.');
      await onRefresh();
      setFeedback({
        text: `Appointment ${data.appointment.booking_ref} updated (${data.appointment.status}).`,
        waUrl: data.patientWhatsappUrl,
      });
      setEditTarget(null);
      setCancelTarget(null);
      if (viewTarget?.id === id) {
        setViewTarget(data.appointment);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed.';
      if (fromEditModal) setEditError(msg);
      else setFeedback({ text: msg, isError: true });
    } finally {
      setBusyId(null);
    }
  };

  const deleteAppointment = async (appt: Appointment) => {
    setBusyId(appt.id);
    setFeedback(null);
    try {
      const res = await adminFetch(`/api/admin/appointments/${appt.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete appointment.');
      await onRefresh();
      setDeleteTarget(null);
      if (viewTarget?.id === appt.id) setViewTarget(null);
      setFeedback({
        text: `Appointment ${appt.booking_ref} permanently deleted.`,
      });
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Delete failed.',
        isError: true,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await adminFetch('/api/admin/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: newName.trim(),
          patientPhone: newPhone.trim(),
          patientEmail: newEmail.trim(),
          serviceId: newServiceId,
          doctorId: newDoctorId,
          appointmentDate: newDate,
          startTime: newTime,
          status: newStatus,
          patientMessage: newNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create booking.');
      await onRefresh();
      setCreateOpen(false);
      setFeedback({
        text: `Booking ${data.appointment.booking_ref} created for ${data.appointment.patient_name}.`,
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create booking.');
    } finally {
      setCreating(false);
    }
  };

  const kpiCards = [
    {
      label: 'Total Bookings',
      value: stats?.totalAppointments ?? appointments.length,
      tone: 'text-[#18323B]',
    },
    {
      label: "Today's Visits (IST)",
      value:
        stats?.todayAppointments ??
        appointments.filter(
          (a) => a.appointment_date === (todayIST || getTodayIST()) && a.status !== 'Cancelled'
        ).length,
      tone: 'text-[#087F8C]',
    },
    {
      label: 'Pending Review',
      value:
        stats?.pendingAppointments ??
        appointments.filter((a) => a.status === 'Pending').length,
      tone: 'text-amber-700',
    },
    {
      label: 'Confirmed',
      value:
        stats?.confirmedAppointments ??
        appointments.filter((a) => a.status === 'Confirmed').length,
      tone: 'text-emerald-700',
    },
    {
      label: 'Cancelled',
      value:
        stats?.cancelledAppointments ??
        appointments.filter((a) => a.status === 'Cancelled').length,
      tone: 'text-red-700',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header & Top Bar Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[#18323B]">
            Appointments Dashboard
          </h1>
          <p className="text-xs text-[#71818A] mt-0.5 tabular-nums">
            Showing {filtered.length} of {appointments.length} bookings
            {todayIST ? ` · Clinic Date (IST): ${todayIST}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#087F8C] text-xs font-heading font-medium text-[#18323B] whitespace-nowrap disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#087F8C] ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white text-xs font-heading font-medium whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Booking
          </button>

          <button
            type="button"
            onClick={() =>
              void downloadAdminFile(
                '/api/admin/appointments/export',
                `smile-architect-appointments-${todayIST || getTodayIST()}.csv`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:border-[#087F8C] text-xs font-heading font-medium text-[#18323B] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#087F8C]" aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-xl bg-white border border-slate-200 space-y-1"
          >
            <p className="text-xs text-[#71818A]">{card.label}</p>
            <p className={`font-heading text-2xl font-semibold tabular-nums ${card.tone}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {supabaseStatus?.configured && !supabaseStatus.canEditRemote && (
        <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#71818A]">
          New bookings sync automatically to Supabase. To also pull, update, or delete existing rows directly inside Supabase from this admin table, add your{' '}
          <code className="font-mono text-[#18323B]">SUPABASE_SECRET_KEY</code> to the server environment.
        </div>
      )}

      {feedback && (
        <div
          role={feedback.isError ? 'alert' : 'status'}
          className={`p-4 rounded-xl border text-sm flex flex-wrap items-center justify-between gap-3 ${
            feedback.isError
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-[#DFF5F3]/60 border-[#087F8C]/30 text-[#18323B]'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.waUrl && (
            <a
              href={feedback.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#087F8C] text-white text-xs font-heading font-medium whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Notify Patient on WhatsApp
            </a>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#71818A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, ref..."
              aria-label="Search appointments"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by date"
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums"
          />

          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            aria-label="Filter by doctor"
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="0">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            aria-label="Filter by service"
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="0">All Services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | AppointmentStatus)}
            aria-label="Filter by status"
            className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
          >
            {STATUS_FILTERS.map((st) => (
              <option key={st} value={st}>
                {st === 'All' ? 'All Statuses' : st}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-[#087F8C] hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-[#18323B]">
              {appointments.length === 0
                ? 'No appointments in the database yet.'
                : 'No appointments match the active filters.'}
            </p>
            <p className="text-xs text-[#71818A]">
              {appointments.length === 0
                ? 'Online patient bookings and walk-in appointments created here will appear immediately.'
                : 'Try clearing or adjusting your search and status filters.'}
            </p>
            <div className="pt-1 flex justify-center gap-3">
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-[#18323B]"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#087F8C] text-white text-xs font-heading font-medium"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add First Booking
                </button>
              )}
            </div>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-heading font-semibold text-[#71818A]">
                <th className="py-3 px-4">Ref / Patient</th>
                <th className="py-3 px-4">Service & Doctor</th>
                <th className="py-3 px-4">Schedule (IST)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/70 align-top">
                  <td className="py-3.5 px-4 space-y-0.5">
                    <p className="font-mono text-xs text-[#087F8C] font-medium tabular-nums">
                      {a.booking_ref}
                    </p>
                    <p className="font-medium text-[#18323B]">{a.patient_name}</p>
                    <p className="text-xs text-[#71818A] tabular-nums">{a.patient_phone}</p>
                    {a.patient_email && (
                      <p className="text-xs text-[#71818A]">{a.patient_email}</p>
                    )}
                    {a.patient_message && (
                      <p className="text-xs text-[#18323B]/80 italic pt-1 max-w-xs line-clamp-2">
                        “{a.patient_message}”
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 space-y-0.5">
                    <p className="font-medium text-[#18323B]">{a.service_name}</p>
                    <p className="text-xs text-[#71818A]">{a.doctor_name}</p>
                  </td>
                  <td className="py-3.5 px-4 tabular-nums space-y-0.5 whitespace-nowrap">
                    <p className="font-medium text-[#18323B]">
                      {formatReadableDate(a.appointment_date)}
                    </p>
                    <p className="text-xs text-[#71818A]">
                      {formatTime12h(a.start_time)} – {formatTime12h(a.end_time)}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        a.status === 'Confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : a.status === 'Pending'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : a.status === 'Completed'
                          ? 'bg-[#DFF5F3] text-[#087F8C] border border-[#087F8C]/20'
                          : a.status === 'Cancelled'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewTarget(a)}
                        aria-label={`View details for ${a.booking_ref}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 text-[#18323B] hover:bg-slate-100 text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                        View
                      </button>

                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => openEditModal(a)}
                        aria-label={`Edit appointment ${a.booking_ref}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 text-[#18323B] hover:bg-slate-100 text-xs font-medium"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        Edit
                      </button>

                      {a.status !== 'Confirmed' && a.status !== 'Completed' && (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => updateAppointment(a.id, { status: 'Confirmed' })}
                          className="px-2.5 py-1.5 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-medium"
                        >
                          Confirm
                        </button>
                      )}

                      {a.status !== 'Completed' && a.status !== 'Cancelled' && (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => updateAppointment(a.id, { status: 'Completed' })}
                          className="px-2.5 py-1.5 rounded border border-[#087F8C]/30 text-[#087F8C] hover:bg-[#DFF5F3]/50 text-xs font-medium"
                        >
                          Complete
                        </button>
                      )}

                      {a.status !== 'Cancelled' ? (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => setCancelTarget(a)}
                          aria-label={`Cancel appointment ${a.booking_ref}`}
                          className="px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => setDeleteTarget(a)}
                          aria-label={`Delete cancelled appointment ${a.booking_ref}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* VIEW APPOINTMENT DETAILS MODAL */}
      {viewTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Appointment details for ${viewTarget.booking_ref}`}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="font-mono text-xs text-[#087F8C] font-semibold tabular-nums">
                  {viewTarget.booking_ref}
                </p>
                <h3 className="font-heading text-xl font-semibold text-[#18323B] mt-0.5">
                  {viewTarget.patient_name}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close appointment details"
                onClick={() => setViewTarget(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#71818A]">Status</p>
                <p className="font-heading font-semibold text-[#18323B] mt-0.5">
                  {viewTarget.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Mobile Number</p>
                <a
                  href={`tel:${viewTarget.patient_phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1 font-medium text-[#087F8C] hover:underline tabular-nums mt-0.5"
                >
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                  {viewTarget.patient_phone}
                </a>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Email</p>
                <p className="text-[#18323B] mt-0.5">
                  {viewTarget.patient_email || 'Not provided'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Dental Service</p>
                <p className="font-medium text-[#18323B] mt-0.5">{viewTarget.service_name}</p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Specialist Doctor</p>
                <p className="font-medium text-[#18323B] mt-0.5">{viewTarget.doctor_name}</p>
              </div>
              <div>
                <p className="text-xs text-[#71818A]">Appointment Schedule (IST)</p>
                <p className="font-medium text-[#18323B] tabular-nums mt-0.5">
                  {formatReadableDate(viewTarget.appointment_date)} ·{' '}
                  {formatTime12h(viewTarget.start_time)} – {formatTime12h(viewTarget.end_time)}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="font-medium text-[#18323B]">Patient Message / Notes</p>
              <p className="text-[#71818A]">
                {viewTarget.patient_message || 'No additional notes provided.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <a
                href={`https://wa.me/${viewTarget.patient_phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-[#18323B] hover:border-[#087F8C]"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#087F8C]" aria-hidden="true" />
                WhatsApp Patient
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewTarget;
                    setViewTarget(null);
                    openEditModal(target);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#087F8C] text-white text-xs font-heading font-medium"
                >
                  Edit Booking
                </button>
                <button
                  type="button"
                  onClick={() => setViewTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-[#18323B]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL EDIT APPOINTMENT MODAL */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit appointment ${editTarget.booking_ref}`}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-semibold text-[#18323B]">
                  Edit Appointment
                </h3>
                <p className="font-mono text-xs text-[#087F8C]">{editTarget.booking_ref}</p>
              </div>
              <button
                type="button"
                aria-label="Close edit modal"
                onClick={() => setEditTarget(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
              >
                {editError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void updateAppointment(
                  editTarget.id,
                  {
                    patientName: editName.trim(),
                    patientPhone: editPhone.trim(),
                    patientEmail: editEmail.trim(),
                    serviceId: editServiceId,
                    doctorId: editDoctorId,
                    appointmentDate: editDate,
                    startTime: editTime,
                    status: editStatus,
                    patientMessage: editMessage.trim(),
                  },
                  true
                );
              }}
              className="space-y-3.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-patient-name"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Patient Name *
                  </label>
                  <input
                    id="edit-patient-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-patient-phone"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Mobile Number *
                  </label>
                  <input
                    id="edit-patient-phone"
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-patient-email"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="edit-patient-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-status"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="edit-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AppointmentStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {EDITABLE_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-service"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Dental Service
                  </label>
                  <select
                    id="edit-service"
                    value={editServiceId}
                    onChange={(e) => setEditServiceId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.duration_minutes} min)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="edit-doctor"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Specialist Doctor
                  </label>
                  <select
                    id="edit-doctor"
                    value={editDoctorId}
                    onChange={(e) => setEditDoctorId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-date"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Appointment Date (IST)
                  </label>
                  <input
                    id="edit-date"
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-time"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Start Time (24h HH:MM)
                  </label>
                  <input
                    id="edit-time"
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-message"
                  className="block text-xs font-medium text-[#18323B] mb-1"
                >
                  Patient Message / Clinic Notes
                </label>
                <textarea
                  id="edit-message"
                  rows={2}
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={busyId === editTarget.id}
                  className="px-4 py-2 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium disabled:opacity-60"
                >
                  {busyId === editTarget.id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW WALK-IN / PHONE BOOKING MODAL */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add new clinic appointment"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-semibold text-[#18323B]">
                Add Walk-In / Phone Booking
              </h3>
              <button
                type="button"
                aria-label="Close new booking modal"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-patient-name"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Patient Name *
                  </label>
                  <input
                    id="new-patient-name"
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-patient-phone"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Mobile Number *
                  </label>
                  <input
                    id="new-patient-phone"
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-patient-email"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Email Address (Optional)
                  </label>
                  <input
                    id="new-patient-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-status"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Initial Status
                  </label>
                  <select
                    id="new-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as AppointmentStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-service"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Dental Service *
                  </label>
                  <select
                    id="new-service"
                    value={newServiceId}
                    onChange={(e) => setNewServiceId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.duration_minutes} min)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="new-doctor"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Specialist Doctor *
                  </label>
                  <select
                    id="new-doctor"
                    value={newDoctorId}
                    onChange={(e) => setNewDoctorId(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="new-date"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Appointment Date (IST) *
                  </label>
                  <input
                    id="new-date"
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-time"
                    className="block text-xs font-medium text-[#18323B] mb-1"
                  >
                    Start Time (24h HH:MM) *
                  </label>
                  <input
                    id="new-time"
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="new-notes"
                  className="block text-xs font-medium text-[#18323B] mb-1"
                >
                  Notes (Optional)
                </label>
                <textarea
                  id="new-notes"
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Walk-in / phone request notes"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-[#087F8C] hover:bg-[#066974] text-white font-heading text-sm font-medium disabled:opacity-60"
                >
                  {creating ? 'Saving...' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm cancellation for ${cancelTarget.booking_ref}`}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-heading text-lg font-semibold text-[#18323B]">
              Cancel Appointment?
            </h3>
            <p className="text-sm text-[#71818A]">
              Cancel{' '}
              <strong className="text-[#18323B] font-mono">{cancelTarget.booking_ref}</strong> for{' '}
              <strong className="text-[#18323B]">{cancelTarget.patient_name}</strong> on{' '}
              <span className="tabular-nums">
                {formatReadableDate(cancelTarget.appointment_date)} at{' '}
                {formatTime12h(cancelTarget.start_time)}
              </span>
              ? This will free the slot for other patients.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={busyId === cancelTarget.id}
                onClick={() => updateAppointment(cancelTarget.id, { status: 'Cancelled' })}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-heading text-sm font-medium disabled:opacity-60"
              >
                {busyId === cancelTarget.id ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PERMANENTLY MODAL */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Delete appointment ${deleteTarget.booking_ref}`}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-heading text-lg font-semibold text-[#18323B]">
              Delete Cancelled Record?
            </h3>
            <p className="text-sm text-[#71818A]">
              Permanently remove{' '}
              <strong className="text-[#18323B] font-mono">{deleteTarget.booking_ref}</strong> (
              {deleteTarget.patient_name}) from the database? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id}
                onClick={() => deleteAppointment(deleteTarget)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-heading text-sm font-medium disabled:opacity-60"
              >
                {busyId === deleteTarget.id ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
