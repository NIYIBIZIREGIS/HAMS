import { AppError } from '../utils/AppError';
import { generateSlots } from './slotService';

export interface SlotAvailabilityInput {
  doctorId: string;
  appointmentDate: Date;
  timeSlot: string;
  /** Used when moving an existing appointment so it does not conflict with itself. */
  excludeAppointmentId?: string;
}

/**
 * Confirms that a doctor actually offers the requested slot and still has capacity.
 *
 * `generateSlots` already applies the schedule, breaks, leave and non-cancelled bookings,
 * so this keeps every reschedule/proposal path on the same rules as public booking.
 */
export async function assertSlotIsAvailable(input: SlotAvailabilityInput): Promise<void> {
  const slots = await generateSlots({
    doctorId: input.doctorId,
    date: input.appointmentDate,
    excludeAppointmentId: input.excludeAppointmentId,
  });

  const requested = slots.find((slot) => slot.time === input.timeSlot);
  if (!requested) {
    throw new AppError(400, `Slot ${input.timeSlot} is not offered by this doctor`);
  }
  if (requested.available <= 0) {
    throw new AppError(409, `Slot ${input.timeSlot} is already fully booked`);
  }
}
