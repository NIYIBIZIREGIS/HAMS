import { DoctorSchedule, DoctorLeave, Appointment } from '../models';
import { minutesToTime, timeToMinutes, compareTimes } from './time';

export interface AvailableSlot {
  time: string;
  label: string;
  capacity: number;
  available: number;
}

export interface GenerateSlotsParams {
  doctorId: string;
  date: Date | string;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Generates the list of available appointment slots for a doctor on a given date.
 *
 * Derives candidate times from the doctor's schedule for that day-of-week, removes
 * break periods, blocks full-day DoctorLeaves, and subtracts slots that are already
 * booked with a non-cancelled appointment. Booked slots show `available: 0` so the
 * frontend can render them disabled.
 */
export async function generateSlots({ doctorId, date }: GenerateSlotsParams): Promise<AvailableSlot[]> {
  const day = new Date(date);
  const dayOfWeek = day.getDay();

  const schedule = await DoctorSchedule.findOne({
    doctorId,
    dayOfWeek,
    isActive: true,
  });

  if (!schedule) return [];

  const breakStart = schedule.breakStart ?? '';
  const breakEnd = schedule.breakEnd ?? '';

  const leaveCount = await DoctorLeave.countDocuments({
    doctorId,
    date: { $gte: startOfDay(day), $lte: endOfDay(day) },
  });
  if (leaveCount > 0) return [];

  const slotDuration = schedule.slotDurationMinutes;
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);

  const slots: AvailableSlot[] = [];
  for (let cursor = start; cursor < end; cursor += slotDuration) {
    const slotTime = minutesToTime(cursor);
    if (breakStart && breakEnd) {
      if (compareTimes(slotTime, breakStart) >= 0 && compareTimes(slotTime, breakEnd) < 0) {
        continue;
      }
    }
    slots.push({
      time: slotTime,
      label: slotTime,
      capacity: schedule.maxPatientsPerSlot,
      available: schedule.maxPatientsPerSlot,
    });
  }

  const booked = await Appointment.find({
    doctorId,
    appointmentDate: { $gte: startOfDay(day), $lte: endOfDay(day) },
    status: { $nin: ['Cancelled', 'Rejected'] },
  })
    .select('timeSlot status')
    .lean();

  const bookedBySlot = new Map<string, number>();
  for (const appt of booked) {
    const time = appt.timeSlot;
    bookedBySlot.set(time, (bookedBySlot.get(time) ?? 0) + 1);
  }

  for (const slot of slots) {
    const taken = bookedBySlot.get(slot.time) ?? 0;
    slot.available = Math.max(0, slot.capacity - taken);
  }

  return slots;
}
