import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitSummaryPanel } from '../components/appointments/VisitSummaryPanel';
import '../i18n';

const mocks = vi.hoisted(() => ({
  getVisitSummary: vi.fn(),
}));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return { ...actual, ...mocks };
});

const summary = {
  appointment: {
    _id: 'a1',
    facilityId: { _id: 'f1', name: 'Test Hospital' },
    patientId: 'p1',
    doctorId: { _id: 'd1', userId: { fullName: 'Dr. Uwase' } },
    departmentId: { _id: 'dep1', name: 'General Medicine' },
    appointmentDate: '2026-11-02T00:00:00.000Z',
    timeSlot: '09:00',
    visitType: 'follow-up',
    status: 'Completed',
  },
  record: {
    _id: 'r1',
    patientId: 'p1',
    doctorId: 'd1',
    appointmentId: 'a1',
    facilityId: 'f1',
    vitals: { bloodPressure: '120/80', temperature: 37.2 },
    chiefComplaint: 'Fever and headache',
    symptoms: ['Fever', 'Headache'],
    diagnosis: 'Malaria',
    treatment: 'Supportive care',
    notes: 'Drink plenty of fluids.',
    followUpDate: '2026-11-09T00:00:00.000Z',
    createdAt: '2026-11-02T10:00:00.000Z',
  },
  prescriptions: [
    {
      _id: 'pr1',
      medicalRecordId: 'r1',
      appointmentId: 'a1',
      patientId: 'p1',
      doctorId: 'd1',
      facilityId: 'f1',
      medicines: [
        {
          name: 'Artemether-lumefantrine',
          dosage: '20/120 mg',
          frequency: 'Twice daily',
          durationDays: 3,
        },
      ],
      instructions: 'Take with food.',
      issuedAt: '2026-11-02T10:00:00.000Z',
    },
  ],
  labTests: [
    {
      _id: 'l1',
      appointmentId: 'a1',
      medicalRecordId: 'r1',
      facilityId: 'f1',
      patientId: 'p1',
      requestedBy: 'd1',
      testName: 'Malaria test',
      result: 'Positive',
      isAbnormal: true,
      status: 'Completed',
      requestedAt: '2026-11-02T09:30:00.000Z',
      completedAt: '2026-11-02T10:00:00.000Z',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('After-visit summary panel', () => {
  it('shows the consultation outcome, medicines and lab results', async () => {
    mocks.getVisitSummary.mockResolvedValue(summary);

    render(
      <MemoryRouter>
        <VisitSummaryPanel appointmentId="a1" />
      </MemoryRouter>
    );

    expect(await screen.findByText('After-visit summary')).toBeInTheDocument();
    expect(mocks.getVisitSummary).toHaveBeenCalledWith('a1');
    expect(screen.getByText('Malaria')).toBeInTheDocument();
    expect(screen.getByText('Fever, Headache')).toBeInTheDocument();
    expect(screen.getByText('Drink plenty of fluids.')).toBeInTheDocument();
    expect(screen.getByText('Artemether-lumefantrine')).toBeInTheDocument();
    expect(screen.getByText('Take with food.')).toBeInTheDocument();
    expect(screen.getByText('Malaria test')).toBeInTheDocument();
    expect(screen.getByText('Positive')).toBeInTheDocument();
    expect(screen.getByText(/3 days/i)).toBeInTheDocument();
  });
});
