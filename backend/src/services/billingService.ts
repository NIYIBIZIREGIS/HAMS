import {
  Appointment,
  Doctor,
  Department,
  MedicalRecord,
  Prescription,
  PharmacyDispense,
  PharmacyInventory,
  LaboratoryTest,
  Patient,
  InsuranceProvider,
  nextSeq,
} from '../models';
import { badRequest } from '../utils/AppError';
import type { IPayment, IPaymentBreakdown } from '../models';

export const DEFAULT_CONSULTATION_FEE = 5000;

export interface BillLine {
  description: string;
  quantity?: number;
  unitAmount?: number;
  amount: number;
}

export interface ComputedBill {
  consultationFee: number;
  labCharges: number;
  pharmacyCharges: number;
  discount: number;
  tax: number;
  schemeSubsidy: number;
  subtotal: number;
  total: number;
  lines: BillLine[];
}

/** Money is stored in minor-unit-safe integers; rounding happens once, at the boundary. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Build the itemized bill for an appointment by auto-generating it from
 * consultation + lab + pharmacy charges tied to the appointment.
 */
export async function computeBill(
  appointmentId: string,
  overrides: { discount?: number; tax?: number; schemeSubsidy?: number } = {}
): Promise<ComputedBill> {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw badRequest('Appointment not found for billing');

  const [doctor, department] = await Promise.all([
    Doctor.findById(appointment.doctorId).select('consultationFee'),
    Department.findById(appointment.departmentId).select('defaultConsultationFee'),
  ]);
  const feeKey = appointment.visitType === 'follow-up' ? 'followUp' : 'newVisit';
  const doctorFee = doctor?.consultationFee?.[feeKey];
  const consultationFee =
    doctorFee !== undefined
      ? doctorFee
      : department?.defaultConsultationFee !== undefined
        ? department.defaultConsultationFee
        : DEFAULT_CONSULTATION_FEE;

  const labTests = await LaboratoryTest.find({ appointmentId }).select('testName fee status');
  const labCharges = roundMoney(labTests.reduce((sum, t) => sum + (t.fee ?? 0), 0));
  const labLines: BillLine[] = labTests.map((t) => ({
    description: `Lab test: ${t.testName}`,
    amount: roundMoney(t.fee ?? 0),
  }));

  const pharmacyLines: BillLine[] = [];
  let pharmacyCharges = 0;
  const medicalRecord = await MedicalRecord.findOne({ appointmentId }).select('_id');
  if (medicalRecord) {
    const prescriptions = await Prescription.find({ medicalRecordId: medicalRecord._id }).select('_id');
    const prescriptionIds = prescriptions.map((p) => p._id);
    const dispenses = await PharmacyDispense
      .find({ prescriptionId: { $in: prescriptionIds } })
      .select('inventoryId quantity');
    const inventories = await PharmacyInventory.find({
      _id: { $in: dispenses.map((d) => d.inventoryId) },
    }).select('drugName unitCost');
    const costById = new Map(
      inventories.map((inv) => [String(inv._id), { name: inv.drugName, unitCost: inv.unitCost ?? 0 }])
    );
    for (const dispense of dispenses) {
      const meta = costById.get(String(dispense.inventoryId)) ?? { name: 'Dispensed medicine', unitCost: 0 };
      const amount = roundMoney(dispense.quantity * meta.unitCost);
      pharmacyCharges = roundMoney(pharmacyCharges + amount);
      pharmacyLines.push({
        description: `${meta.name} (x${dispense.quantity})`,
        quantity: dispense.quantity,
        unitAmount: meta.unitCost,
        amount,
      });
    }
  }

  const discount = overrides.discount ?? 0;
  const tax = overrides.tax ?? 0;
  const schemeSubsidy = overrides.schemeSubsidy ?? 0;

  const subtotal = roundMoney(consultationFee + labCharges + pharmacyCharges);
  const total = roundMoney(Math.max(0, subtotal - discount + tax - schemeSubsidy));

  const lines: BillLine[] = [
    { description: 'Consultation fee', amount: consultationFee },
    ...labLines,
    ...pharmacyLines,
  ];

  return {
    consultationFee: roundMoney(consultationFee),
    labCharges,
    pharmacyCharges,
    discount,
    tax,
    schemeSubsidy,
    subtotal,
    total,
    lines,
  };
}

export async function generateReceiptNumber(): Promise<string> {
  const seq = await nextSeq('receipt');
  return `RCPT-${String(seq).padStart(6, '0')}`;
}

export async function isIndigentPatient(patientId: string): Promise<boolean> {
  const patient = await Patient.findById(patientId).select('governmentScheme').lean();
  return Boolean(patient?.governmentScheme?.indigentStatus);
}

export async function findGovernmentProviderId(): Promise<string | null> {
  const provider = await InsuranceProvider
    .findOne({ type: 'government_scheme', isActive: true })
    .select('_id')
    .lean();
  return provider ? String(provider._id) : null;
}

export interface ReceiptPayload {
  receiptNumber: string;
  appointmentId: string;
  facilityId: string;
  patientId: string;
  amount: number;
  method: string;
  status: string;
  lines: BillLine[];
  breakdown: IPaymentBreakdown;
  paidAt?: Date;
  issuedAt: Date;
}

export async function buildReceipt(payment: IPayment, lines: BillLine[]): Promise<ReceiptPayload> {
  return {
    receiptNumber: payment.receiptNumber as string,
    appointmentId: String(payment.appointmentId),
    facilityId: String(payment.facilityId),
    patientId: String(payment.patientId),
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    lines,
    breakdown: payment.breakdown,
    paidAt: payment.paidAt,
    issuedAt: new Date(),
  };
}