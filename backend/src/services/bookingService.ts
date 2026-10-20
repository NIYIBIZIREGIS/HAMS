import { Appointment, Doctor, DoctorSchedule } from '../models';
import { AppointmentStatus } from '../models';
import { AppError } from '../utils/AppError';
import { generateSlots } from './slotService';
import { timeToMinutes } from './time';

export interface BookAppointmentInput {
  facilityId: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: Date;
  timeSlot: string;
  reason?: string;
  visitType?: 'new' | 'follow-up' | 'referral';
  bookingChannel?: 'web' | 'mobile' | 'sms' | 'ussd' | 'walk_in' | 'referral';
}

/**
 * Creates an appointment with full double-booking protection.
 *
 * 1. Validates the doctor exists.
 * 2. Confirms the requested slot exists in the doctor's schedule for that day.
 * 3. Checks the slot is still free — raced safe by the compound index on
 *    (doctorId, appointmentDate, timeSlot) at the database level.
 */
export async function bookAppointment(input: BookAppointmentInput) {
  const doctor = await Doctor.findById(input.doctorId).lean();
  if (!doctor) throw new AppError(400, 'Doctor not found');
  if (String(doctor.facilityId) !== input.facilityId) {
    throw new AppError(400, 'Doctor does not belong to the selected facility');
  }

  const day = new Date(input.appointmentDate);
  const dayOfWeek = day.getDay();
  const schedule = await DoctorSchedule.findOne({
    doctorId: input.doctorId,
    dayOfWeek,
    isActive: true,
  }).lean();
  if (!schedule) {
    throw new AppError(400, 'Doctor is not available on this day');
  }

  const slots = await generateSlots({
    doctorId: input.doctorId,
    date: input.appointmentDate,
  });
  const requested = slots.find((s) => s.time === input.timeSlot);
  if (!requested) {
    throw new AppError(400, `Slot ${input.timeSlot} is not offered by this doctor`);
  }
  if (requested.available <= 0) {
    throw new AppError(409, `Slot ${input.timeSlot} is already fully booked`);
  }

  // Final no-double-booking check right before insert.
  const existing = await Appointment.countDocuments({
    doctorId: input.doctorId,
    appointmentDate: day,
    timeSlot: input.timeSlot,
    status: { $nin: ['Cancelled', 'Rejected'] },
  });
  const maxPerSlot = schedule.maxPatientsPerSlot ?? 1;
  if (existing >= maxPerSlot) {
    throw new AppError(409, `Slot ${input.timeSlot} is already fully booked`);
  }

  const queueNumber = await nextQueueNumber(input.facilityId, input.appointmentDate);

  const appointment = await Appointment.create({
    facilityId: input.facilityId,
    patientId: input.patientId,
    doctorId: input.doctorId,
    departmentId: input.departmentId,
    appointmentDate: day,
    timeSlot: input.timeSlot,
    reason: input.reason ?? '',
    visitType: input.visitType ?? 'new',
    bookingChannel: input.bookingChannel ?? 'web',
    status: 'Pending' as AppointmentStatus,
    queueNumber,
  });

  return appointment;
}

export async function nextQueueNumber(facilityId: string, date: Date): Promise<number> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const count = await Appointment.countDocuments({
    facilityId,
    appointmentDate: { $gte: start, $lte: end },
    status: { $ne: 'Cancelled' },
  });
  return count + 1;
}

export const statusFlow: Record<AppointmentStatus, AppointmentStatus[]> = {
  Pending: ['Confirmed', 'Rejected', 'Cancelled'],
  Confirmed: ['Checked In', 'Cancelled', 'Missed'],
  'Checked In': ['In Progress', 'Cancelled', 'Missed'],
  'In Progress': ['Completed'],
  Completed: [],
  Cancelled: [],
  Missed: [],
  Rejected: [],
};

export function assertValidTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (from === to) return;
  if (!statusFlow[from]?.includes(to)) {
    throw new AppError(409, `Cannot transition appointment from "${from}" to "${to}"`);
  }
}

export function isSlotWithinSchedule(
  timeSlot: string,
  schedule: { startTime: string; endTime: string; breakStart?: string; breakEnd?: string }
): boolean {
  const minutes = timeToMinutes(timeSlot);
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  const breakStart = schedule.breakStart ? timeToMinutes(schedule.breakStart) : null;
  const breakEnd = schedule.breakEnd ? timeToMinutes(schedule.breakEnd) : null;

  if (minutes < start || minutes >= end) return false;
  if (breakStart !== null && breakEnd !== null && minutes >= breakStart && minutes < breakEnd) {
    return false;
  }
  return true;
}
