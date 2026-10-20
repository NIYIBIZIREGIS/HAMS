import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getDoctorSchedule,
  upsertSchedule,
  getAvailability,
  type DoctorScheduleEntry,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageSpinner } from '../../components/ui/Spinner';
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Clock,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((name, i) => ({
  value: String(i),
  label: name,
}));

interface FormState {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  slotDurationMinutes: string;
  maxPatientsPerSlot: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  dayOfWeek: '1',
  startTime: '09:00',
  endTime: '17:00',
  breakStart: '13:00',
  breakEnd: '14:00',
  slotDurationMinutes: '15',
  maxPatientsPerSlot: '1',
  isActive: true,
};

function toEntryForm(entry: DoctorScheduleEntry): FormState {
  return {
    dayOfWeek: String(entry.dayOfWeek),
    startTime: entry.startTime,
    endTime: entry.endTime,
    breakStart: entry.breakStart ?? '13:00',
    breakEnd: entry.breakEnd ?? '14:00',
    slotDurationMinutes: String(entry.slotDurationMinutes),
    maxPatientsPerSlot: String(entry.maxPatientsPerSlot),
    isActive: entry.isActive,
  };
}

export function AvailabilityManager() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Multi-day selection for creating multiple entries at once
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [recurring, setRecurring] = useState(true);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DoctorScheduleEntry | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', user?.id],
    queryFn: () => getDoctorSchedule(user!.id),
    enabled: !!user,
  });

  const { data: slots } = useQuery({
    queryKey: ['availability', user?.id, selectedDate],
    queryFn: () => getAvailability(user!.id, selectedDate),
    enabled: !!user,
  });

  // Group schedule by day of week for the weekly view
  const scheduleByDay: Record<number, DoctorScheduleEntry[]> = {};
  (schedule ?? []).forEach((entry) => {
    if (!scheduleByDay[entry.dayOfWeek]) scheduleByDay[entry.dayOfWeek] = [];
    scheduleByDay[entry.dayOfWeek].push(entry);
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const days =
        selectedDays.size > 0
          ? Array.from(selectedDays).map(Number)
          : [parseInt(form.dayOfWeek, 10)];

      for (const day of days) {
        await upsertSchedule(user!.id, {
          dayOfWeek: day,
          startTime: form.startTime,
          endTime: form.endTime,
          breakStart: form.breakStart || undefined,
          breakEnd: form.breakEnd || undefined,
          slotDurationMinutes: parseInt(form.slotDurationMinutes, 10),
          maxPatientsPerSlot: parseInt(form.maxPatientsPerSlot, 10),
          isActive: form.isActive,
        });
      }
    },
    onSuccess: () => {
      setInfo(t('doctor.availabilitySaved', 'Availability saved successfully'));
      setError('');
      setSelectedDays(new Set());
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err: Error) => {
      setError(err.message || t('doctor.saveFailed', 'Failed to save availability'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      upsertSchedule(user!.id, {
        ...(editingEntry ? { dayOfWeek: editingEntry.dayOfWeek } : {}),
        dayOfWeek: parseInt(editForm.dayOfWeek, 10),
        startTime: editForm.startTime,
        endTime: editForm.endTime,
        breakStart: editForm.breakStart || undefined,
        breakEnd: editForm.breakEnd || undefined,
        slotDurationMinutes: parseInt(editForm.slotDurationMinutes, 10),
        maxPatientsPerSlot: parseInt(editForm.maxPatientsPerSlot, 10),
        isActive: editForm.isActive,
      }),
    onSuccess: () => {
      setInfo(t('doctor.availabilityUpdated', 'Availability updated'));
      setError('');
      setEditModalOpen(false);
      setEditingEntry(null);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err: Error) => {
      setError(err.message || t('doctor.updateFailed', 'Failed to update availability'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/doctors/${user!.id}/schedule/${id}`, {
        method: 'DELETE',
      }).then((res) => {
        if (!res.ok) throw new Error('Delete failed');
      }),
    onSuccess: () => {
      setInfo(t('doctor.availabilityDeleted', 'Availability deleted'));
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err: Error) => {
      setError(err.message || t('doctor.deleteFailed', 'Failed to delete'));
    },
  });

  // Auto-clear messages
  useEffect(() => {
    if (info || error) {
      const timer = setTimeout(() => {
        setInfo('');
        setError('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [info, error]);

  const openEditModal = (entry: DoctorScheduleEntry) => {
    setEditingEntry(entry);
    setEditForm(toEntryForm(entry));
    setEditModalOpen(true);
  };

  const handleClearEditForm = () => {
    if (editingEntry) setEditForm(toEntryForm(editingEntry));
  };

  const toggleDaySelection = (day: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            {t('doctor.availability', 'Availability Management')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('doctor.availabilitySubtitle', 'Manage your weekly schedule and time slots')}
          </p>
        </div>
      </div>

      {/* Messages */}
      {info && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left: Add Availability Form */}
        <Card className="xl:col-span-1">
          <CardHeader
            title={t('doctor.addAvailability', 'Add Availability')}
            subtitle={t('doctor.addAvailabilityHint', 'Set your available hours')}
          />
          <CardBody className="space-y-4">
            {/* Day Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t('doctor.selectDays', 'Select Days')}
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_SHORT.map((short, i) => {
                  const isSelected = selectedDays.has(String(i));
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDaySelection(String(i))}
                      className={`flex h-10 w-full items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
              {selectedDays.size === 0 && (
                <p className="mt-1.5 text-xs text-slate-400">
                  {t('doctor.selectDaysHint', 'Click days to select, or use the dropdown below')}
                </p>
              )}
            </div>

            {/* Single day fallback */}
            {selectedDays.size === 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {t('doctor.day', 'Day of Week')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm({ ...form, dayOfWeek: opt.value })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        form.dayOfWeek === opt.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time Fields */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('doctor.startTime', 'Start Time')}
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                icon={Clock}
              />
              <Input
                label={t('doctor.endTime', 'End Time')}
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                icon={Clock}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('doctor.breakStart', 'Break Start')}
                type="time"
                value={form.breakStart}
                onChange={(e) => setForm({ ...form, breakStart: e.target.value })}
              />
              <Input
                label={t('doctor.breakEnd', 'Break End')}
                type="time"
                value={form.breakEnd}
                onChange={(e) => setForm({ ...form, breakEnd: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('doctor.slotDuration', 'Slot Duration (min)')}
                type="number"
                min={5}
                max={120}
                value={form.slotDurationMinutes}
                onChange={(e) =>
                  setForm({ ...form, slotDurationMinutes: e.target.value })
                }
              />
              <Input
                label={t('doctor.maxPatients', 'Max Patients / Slot')}
                type="number"
                min={1}
                max={20}
                value={form.maxPatientsPerSlot}
                onChange={(e) =>
                  setForm({ ...form, maxPatientsPerSlot: e.target.value })
                }
              />
            </div>

            {/* Recurring Toggle */}
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  <RefreshCw className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                  {t('doctor.recurring', 'Recurring Weekly')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('doctor.recurringHint', 'Apply this schedule every week')}
                </p>
              </div>
            </label>

            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              icon={Plus}
              className="w-full"
            >
              {t('doctor.saveAvailability', 'Save Availability')}
            </Button>
          </CardBody>
        </Card>

        {/* Right: Weekly View + Entries Table */}
        <div className="space-y-6 xl:col-span-2">
          {/* Weekly Grid View */}
          <Card>
            <CardHeader
              title={t('doctor.weeklySchedule', 'Weekly Schedule')}
              subtitle={t('doctor.weeklyScheduleHint', 'Your availability by day')}
              icon={CalendarDays}
            />
            <CardBody noPadding>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 min-w-[600px]">
                  {WEEKDAY_LABELS.map((_day, dayIndex) => (
                    <div
                      key={dayIndex}
                      className={`border-r border-slate-100 last:border-r-0 ${
                        dayIndex === new Date().getDay() ? 'bg-primary-25' : ''
                      }`}
                    >
                      {/* Day Header */}
                      <div
                        className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                          dayIndex === new Date().getDay()
                            ? 'text-primary-700 bg-primary-50'
                            : 'text-slate-500 bg-slate-50'
                        }`}
                      >
                        {WEEKDAY_SHORT[dayIndex]}
                        {dayIndex === new Date().getDay() && (
                          <div className="mt-0.5 text-[10px] normal-case tracking-normal text-primary-500">
                            {t('doctor.today', 'Today')}
                          </div>
                        )}
                      </div>

                      {/* Time Slots */}
                      <div className="min-h-[200px] p-2 space-y-1.5">
                        {(scheduleByDay[dayIndex] ?? []).length === 0 ? (
                          <p className="pt-8 text-center text-[10px] text-slate-300">
                            —
                          </p>
                        ) : (
                          scheduleByDay[dayIndex].map((entry) => (
                            <div
                              key={entry._id}
                              className={`rounded-lg border px-2 py-1.5 text-[11px] ${
                                entry.isActive
                                  ? 'border-emerald-200 bg-emerald-50'
                                  : 'border-slate-200 bg-slate-50 opacity-50'
                              }`}
                            >
                              <p className="font-semibold text-slate-700">
                                {entry.startTime}–{entry.endTime}
                              </p>
                              {entry.breakStart && (
                                <p className="text-slate-400">
                                  {t('doctor.break', 'break')} {entry.breakStart}–{entry.breakEnd}
                                </p>
                              )}
                              <p className="text-slate-400">
                                {entry.slotDurationMinutes}min · {entry.maxPatientsPerSlot}p
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Availability Entries Table */}
          <Card>
            <CardHeader
              title={t('doctor.availabilityEntries', 'Availability Entries')}
              subtitle={`${(schedule ?? []).length} ${t('doctor.entries', 'entries')}`}
            />
            <CardBody noPadding>
              {(schedule ?? []).length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                    <CalendarDays className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-900">
                    {t('doctor.noAvailability', 'No availability set')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('doctor.noAvailabilityHint', 'Add your weekly schedule using the form.')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                          {t('doctor.day', 'Day')}
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                          {t('doctor.hours', 'Hours')}
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                          {t('doctor.break', 'Break')}
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                          {t('doctor.slotDuration', 'Slot')}
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">
                          {t('doctor.status', 'Status')}
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">
                          {t('common.actions', 'Actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(schedule ?? []).map((entry) => (
                        <tr
                          key={entry._id}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {WEEKDAY_LABELS[entry.dayOfWeek]}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {entry.startTime} – {entry.endTime}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {entry.breakStart && entry.breakEnd
                              ? `${entry.breakStart} – ${entry.breakEnd}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {entry.slotDurationMinutes} min
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                entry.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {entry.isActive
                                ? t('doctor.active', 'Active')
                                : t('doctor.inactive', 'Inactive')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal(entry)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                                aria-label={t('common.edit', 'Edit')}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteId(entry._id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                aria-label={t('common.delete', 'Delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Available Slots Preview for Selected Date */}
      <Card>
        <CardHeader
          title={t('doctor.availableSlots', 'Available Slots')}
          subtitle={t('doctor.availableSlotsHint', 'Slots visible to patients for booking')}
          action={
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="!w-auto !py-1"
            />
          }
        />
        <CardBody>
          {(!slots || slots.length === 0) ? (
            <p className="py-4 text-center text-sm text-slate-400">
              {t('doctor.noSlots', 'No available slots for this date')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <div
                  key={slot.time}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    slot.available > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                  }`}
                >
                  <p className="font-semibold">{slot.label || slot.time}</p>
                  <p className="mt-0.5 text-[10px]">
                    {slot.available}/{slot.capacity} {t('doctor.available', 'avail')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingEntry(null);
        }}
        title={t('doctor.editAvailability', 'Edit Availability')}
        density="compact"
        footer={
          <>
            <Button variant="ghost" icon={RotateCcw} onClick={handleClearEditForm}>
              Clear
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditModalOpen(false);
                setEditingEntry(null);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              loading={updateMutation.isPending}
            >
              {t('doctor.updateAvailability', 'Update Availability')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {t('doctor.day', 'Day of Week')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditForm({ ...editForm, dayOfWeek: opt.value })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    editForm.dayOfWeek === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('doctor.startTime', 'Start Time')}
              type="time"
              value={editForm.startTime}
              onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
            />
            <Input
              label={t('doctor.endTime', 'End Time')}
              type="time"
              value={editForm.endTime}
              onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('doctor.breakStart', 'Break Start')}
              type="time"
              value={editForm.breakStart}
              onChange={(e) => setEditForm({ ...editForm, breakStart: e.target.value })}
            />
            <Input
              label={t('doctor.breakEnd', 'Break End')}
              type="time"
              value={editForm.breakEnd}
              onChange={(e) => setEditForm({ ...editForm, breakEnd: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('doctor.slotDuration', 'Slot Duration (min)')}
              type="number"
              min={5}
              max={120}
              value={editForm.slotDurationMinutes}
              onChange={(e) =>
                setEditForm({ ...editForm, slotDurationMinutes: e.target.value })
              }
            />
            <Input
              label={t('doctor.maxPatients', 'Max Patients / Slot')}
              type="number"
              min={1}
              max={20}
              value={editForm.maxPatientsPerSlot}
              onChange={(e) =>
                setEditForm({ ...editForm, maxPatientsPerSlot: e.target.value })
              }
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(e) =>
                setEditForm({ ...editForm, isActive: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p className="text-xs font-medium text-slate-900">
                {t('doctor.active', 'Active')}
              </p>
              <p className="text-xs text-slate-500">
                {t('doctor.activeHint', 'Patients can book slots during these hours')}
              </p>
            </div>
          </label>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={t('doctor.deleteAvailability', 'Delete Availability')}
        width="sm"
      >
        <p className="text-sm text-slate-600">
          {t(
            'doctor.deleteConfirm',
            'Are you sure you want to delete this availability entry? Patients will no longer be able to book during these hours.',
          )}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteId(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleteId) deleteMutation.mutate(deleteId);
            }}
            loading={deleteMutation.isPending}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
