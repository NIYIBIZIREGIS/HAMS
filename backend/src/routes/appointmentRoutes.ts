import { Router } from 'express';
import * as appointmentController from '../controllers/appointmentController';
import { authenticate } from '../middleware/auth';
import { requireRole, requirePermission, requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../utils/permissions';
import { validate, validateObjectId } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { verifySmsSignature } from '../middleware/smsWebhook';
import {
  appointmentSchema,
  appointmentUpdateSchema,
  appointmentStatusSchema,
  appointmentDeclineSchema,
  appointmentProposalSchema,
  appointmentRescheduleSchema,
  appointmentMeetingLinkSchema,
  appointmentFollowUpSchema,
  appointmentReferralSchema,
  paginationQuery,
} from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { Appointment } from '../models';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor', 'patient', 'nurse'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.SELF_APPOINTMENTS),
  validate(paginationQuery, 'query'),
  asyncHandler(appointmentController.listAppointments)
);

router.post(
  '/sms',
  // The gateway has no account with us, so the signature is the only thing that establishes
  // the request came from the provider. It must run before any handler and before any parsing
  // that would trust the payload.
  verifySmsSignature,
  asyncHandler(appointmentController.smsWebhook)
);

router.post(
  '/',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor', 'patient'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.SELF_APPOINTMENTS),
  validate(appointmentSchema),
  auditLog({
    entity: 'Appointment',
    entityId: () => undefined,
    before: async () => null,
  }),
  asyncHandler(appointmentController.createAppointment)
);

router.get('/:id', authenticate, validateObjectId('id'), asyncHandler(appointmentController.getAppointment));

router.patch(
  '/:id/accept',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: () => ({ status: { from: 'Pending', to: 'Confirmed' } }),
  }),
  asyncHandler(appointmentController.acceptAppointment)
);

router.patch(
  '/:id/decline',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentDeclineSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: (req) => ({ status: { from: 'Pending', to: 'Declined' }, reason: req.body.reason }),
  }),
  asyncHandler(appointmentController.declineAppointment)
);

router.patch(
  '/:id/propose',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentProposalSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: (req) => ({
      status: { from: 'Pending', to: 'Reschedule Proposed' },
      proposedDate: req.body.appointmentDate,
      proposedTimeSlot: req.body.timeSlot,
    }),
  }),
  asyncHandler(appointmentController.proposeReschedule)
);

router.patch(
  '/:id/proposal/:decision',
  authenticate,
  requireRole('patient'),
  requirePermission(PERMISSIONS.SELF_APPOINTMENTS),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: (req) => ({
      proposalDecision: req.params.decision,
      reason: req.body?.reason,
    }),
  }),
  asyncHandler(appointmentController.respondToProposal)
);

router.patch(
  '/:id/reschedule',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentRescheduleSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: (req) => ({
      appointmentDate: req.body.appointmentDate,
      timeSlot: req.body.timeSlot,
      reason: req.body.reason,
    }),
  }),
  asyncHandler(appointmentController.rescheduleAppointment)
);

router.patch(
  '/:id/meeting-link',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentMeetingLinkSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: (req) => ({ meetingLinkSet: Boolean(req.body.meetingLink) }),
  }),
  asyncHandler(appointmentController.updateAppointmentMeetingLink)
);

router.patch(
  '/:id/start',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: () => ({ status: { from: 'Confirmed', to: 'In Progress' } }),
  }),
  asyncHandler(appointmentController.startConsultation)
);

router.patch(
  '/:id/complete',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: () => ({ status: { from: 'In Progress', to: 'Completed' } }),
  }),
  asyncHandler(appointmentController.completeConsultation)
);

router.patch(
  '/:id/no-show',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: () => ({ status: { from: 'Confirmed', to: 'Missed' } }),
  }),
  asyncHandler(appointmentController.markNoShow)
);

router.post(
  '/:id/follow-up',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentFollowUpSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: (req) => ({
      followUpDate: req.body.appointmentDate,
      followUpTimeSlot: req.body.timeSlot,
      autoConfirm: req.body.autoConfirm,
    }),
  }),
  asyncHandler(appointmentController.bookFollowUp)
);

router.post(
  '/:id/refer',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentReferralSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
    metadata: (req) => ({
      targetDoctorId: req.body.targetDoctorId,
      referralNote: req.body.note,
      appointmentDate: req.body.appointmentDate,
      timeSlot: req.body.timeSlot,
    }),
  }),
  asyncHandler(appointmentController.referPatient)
);

router.get(
  '/:id/patient-summary',
  authenticate,
  requireRole('doctor'),
  requirePermission(PERMISSIONS.PATIENT_VIEW),
  validateObjectId('id'),
  asyncHandler(appointmentController.getAppointmentPatientSummary)
);

router.put(
  '/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'patient'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_UPDATE, PERMISSIONS.SELF_APPOINTMENTS),
  validateObjectId('id'),
  validate(appointmentUpdateSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.updateAppointment)
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor'),
  requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE),
  validateObjectId('id'),
  validate(appointmentStatusSchema),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.updateStatus)
);

router.post(
  '/:id/check-in',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist'),
  requirePermission(PERMISSIONS.APPOINTMENTS_CHECKIN),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.checkIn)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('super_admin', 'facility_admin', 'receptionist', 'doctor', 'patient'),
  requireAnyPermission(PERMISSIONS.APPOINTMENTS_CANCEL, PERMISSIONS.SELF_APPOINTMENTS),
  validateObjectId('id'),
  auditLog({
    entity: 'Appointment',
    entityId: (req) => req.params.id,
    before: async (req) => Appointment.findById(req.params.id).lean(),
  }),
  asyncHandler(appointmentController.cancelAppointment)
);

export default router;
