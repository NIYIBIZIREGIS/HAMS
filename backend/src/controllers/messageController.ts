import { Response } from 'express';
import { Types, type PipelineStage } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Message, Patient, User } from '../models';
import { success, paginate } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { assertPatientReachable } from '../services/patientAccess';
import {
  assertFacilityAccess,
  hasRole,
  populatedId,
  resolveAssignmentTarget,
  tenantFilter,
  ROLE_PATIENT,
} from '../utils/tenancy';

/** Resolves the patient record behind the signed-in account, or fails closed. */
async function actingPatientId(req: AuthRequest): Promise<Types.ObjectId> {
  const patient = await Patient.findOne({ userId: req.user!.id }).select('_id').lean();
  if (!patient) throw new AppError(403, 'Patient profile not found');
  return patient._id;
}

/**
 * Builds the base filter for anything a caller is allowed to see, so a thread can never be
 * read through a sibling route that skipped the ownership check.
 */
async function scopeMessagesForCaller(req: AuthRequest): Promise<Record<string, unknown>> {
  if (hasRole(req.user, ROLE_PATIENT)) {
    return { patientId: await actingPatientId(req) };
  }
  return tenantFilter(req, req.query.facilityId);
}

export async function listMessages(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const isPatient = hasRole(req.user, ROLE_PATIENT);
  const filter: Record<string, unknown> = await scopeMessagesForCaller(req);

  if (req.query.patientId && !isPatient) filter.patientId = req.query.patientId;
  if (req.query.unread === 'true') filter.isRead = false;

  const total = await Message.countDocuments(filter);
  const messages = await Message.find(filter)
    .populate('patientId', 'patientNumber userId')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  success(res, 200, messages, paginate(page, limit, total));
}

/**
 * One row per conversation, newest activity first, with the unread count the caller's side has
 * not seen yet. Grouping happens in the database because the patient inbox grows without bound
 * and the patient view is the one that must not degrade as it does.
 */
export async function listThreads(req: AuthRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));

  const isPatient = hasRole(req.user, ROLE_PATIENT);
  const scope = await scopeMessagesForCaller(req);

  // A patient has unread mail when the hospital wrote and they have not read it. Staff have
  // unread mail when the patient replied and they have not read it. Getting this backwards
  // would mark the reader's own outgoing messages as unread to them.
  const inbound = isPatient ? 'to_patient' : 'to_staff';

  const match: Record<string, unknown> = { ...scope };
  if (req.query.patientId && !isPatient) match.patientId = req.query.patientId;

  const threadKey = { $ifNull: ['$threadId', '$_id'] };

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $group: {
        _id: threadKey,
        messageCount: { $sum: 1 },
        unreadCount: {
          $sum: { $cond: [{ $and: [{ $eq: ['$direction', inbound] }, { $eq: ['$isRead', false] }] }, 1, 0] },
        },
        lastMessageAt: { $max: '$createdAt' },
        subject: { $last: '$subject' },
        lastBody: { $last: '$body' },
        lastSenderName: { $last: '$senderName' },
        lastDirection: { $last: '$direction' },
        facilityId: { $last: '$facilityId' },
        patientId: { $last: '$patientId' },
      },
    },
    { $sort: { lastMessageAt: -1 } },
    {
      $facet: {
        rows: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: 'patients',
              localField: 'patientId',
              foreignField: '_id',
              as: 'patient',
            },
          },
          {
            $project: {
              _id: 0,
              threadId: '$_id',
              messageCount: 1,
              unreadCount: 1,
              lastMessageAt: 1,
              subject: 1,
              lastBody: 1,
              lastSenderName: 1,
              lastDirection: 1,
              patient: { $arrayElemAt: ['$patient', 0] },
            },
          },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ];

  const [result] = await Message.aggregate(pipeline);
  const rows = result?.rows ?? [];
  const total = result?.total?.[0]?.value ?? 0;

  success(res, 200, rows, paginate(page, limit, total));
}

/** Every message in one conversation, oldest first, so it reads top to bottom. */
export async function getThread(req: AuthRequest, res: Response) {
  const threadId = req.params.threadId;
  if (!Types.ObjectId.isValid(threadId)) throw new AppError(404, 'Thread not found');

  const threadObjectId = new Types.ObjectId(threadId);
  const scope = await scopeMessagesForCaller(req);

  // `$or` covers both a real threadId and the single pre-threading message that happens to have
  // this id, so an old message is still reachable by its own id.
  const thread = await Message.find({
    $and: [scope, { $or: [{ threadId: threadObjectId }, { _id: threadObjectId }] }],
  })
    .sort({ createdAt: 1 })
    .lean();

  if (thread.length === 0) throw new AppError(404, 'Thread not found');

  // Opening a thread is a read: everything the caller is meant to have seen stops counting.
  await Message.updateMany(
    {
      _id: { $in: thread.map((m) => m._id) },
      direction: hasRole(req.user, ROLE_PATIENT) ? 'to_patient' : 'to_staff',
      isRead: false,
    },
    { $set: { isRead: true, readAt: new Date() } }
  );

  success(res, 200, thread);
}

export async function getMessage(req: AuthRequest, res: Response) {
  const message = await Message.findById(req.params.id)
    .populate('patientId', 'patientNumber userId')
    .populate('facilityId', 'name')
    .lean();

  if (!message) throw new AppError(404, 'Message not found');

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patientId = await actingPatientId(req);
    if (String(patientId) !== String((message.patientId as { _id?: unknown })?._id ?? message.patientId)) {
      throw new AppError(403, 'Forbidden');
    }
  } else {
    assertFacilityAccess(req, populatedId(message.facilityId));
  }

  success(res, 200, message);
}

export async function createMessage(req: AuthRequest, res: Response) {
  const body = req.body as {
    patientId: string;
    subject: string;
    body: string;
    facilityId?: string;
  };

  if (hasRole(req.user, ROLE_PATIENT)) {
    throw new AppError(403, 'Patients cannot create messages');
  }

  // A hospital admin is pinned to their own hospital; a platform admin must name one.
  const facilityId = resolveAssignmentTarget(req, body.facilityId);

  const sender = await User.findById(req.user?.id).select('fullName');
  const senderName = sender?.fullName ?? 'Facility';

  const patient = await Patient.findById(body.patientId).select('_id facilityId');
  if (!patient) throw new AppError(404, 'Patient not found');

  // The recipient must be reachable from the caller's hospital. Without this the message
  // was stamped with the caller's hospital but written into any patient's inbox, which the
  // recipient could then read (patient reads are scoped by patientId, not by hospital).
  await assertPatientReachable(req, patient, facilityId);

  const message = await Message.create({
    facilityId,
    patientId: patient._id,
    direction: 'to_patient',
    senderUserId: req.user?.id,
    senderName,
    subject: body.subject,
    body: body.body,
    isRead: false,
  });

  // A message that opens a conversation is its own thread root.
  message.threadId = message._id;
  await message.save();

  success(res, 201, message);
}

/**
 * Appends to an existing conversation. Patients use this to answer hospital mail, which they
 * previously had no way to do: the only create route required MESSAGES_SEND and excluded them.
 */
export async function replyToThread(req: AuthRequest, res: Response) {
  const threadId = req.params.threadId;
  if (!Types.ObjectId.isValid(threadId)) throw new AppError(404, 'Thread not found');

  const scope = await scopeMessagesForCaller(req);
  const threadObjectId = new Types.ObjectId(threadId);

  const root = await Message.findOne({
    $and: [scope, { $or: [{ threadId: threadObjectId }, { _id: threadObjectId }] }],
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!root) throw new AppError(404, 'Thread not found');

  const isPatient = hasRole(req.user, ROLE_PATIENT);
  const body = req.body as { body: string };

  // A patient can only answer their own thread. A staff reply is already covered by the tenant
  // scope above, which pins hospital staff to their facility.
  if (!isPatient) {
    assertFacilityAccess(req, populatedId(root.facilityId));
  }

  // The sender's name lives on the account, not the patient record, so it is the same for both
  // sides of the conversation.
  const sender = await User.findById(req.user?.id).select('fullName').lean();
  const senderName = sender?.fullName ?? (isPatient ? 'Patient' : 'Facility');

  const reply = await Message.create({
    facilityId: root.facilityId,
    patientId: root.patientId,
    threadId: root._id,
    direction: isPatient ? 'to_staff' : 'to_patient',
    senderUserId: req.user?.id,
    senderName,
    subject: root.subject,
    body: body.body,
    // The recipient has not seen it yet; the author obviously has.
    isRead: false,
  });

  success(res, 201, reply);
}

export async function markMessageRead(req: AuthRequest, res: Response) {
  const message = await Message.findById(req.params.id);
  if (!message) throw new AppError(404, 'Message not found');

  if (hasRole(req.user, ROLE_PATIENT)) {
    const patientId = await actingPatientId(req);
    if (String(patientId) !== String(message.patientId)) {
      throw new AppError(403, 'Forbidden');
    }
  } else {
    // `isSuperAdmin` is handled inside the helper, so platform admins are not denied as
    // they were before, when a null facilityId never matched.
    assertFacilityAccess(req, message.facilityId);
  }

  message.isRead = true;
  message.readAt = new Date();
  await message.save();

  success(res, 200, message);
}