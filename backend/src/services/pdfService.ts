/**
 * Lightweight prescription PDF generator.
 *
 * Produces a simple, well-structured HTML string that is served as a
 * downloadable HTML document (print-to-PDF friendly). A real deployment
 * can swap this for a headless-Chrome / puppeteer call — the interface
 * stays the same.  We intentionally avoid pulling in a heavy native binary
 * dependency (puppeteer, wkhtmltopdf) that would break the Docker build.
 */

import type { IPrescription, IPrescriptionMedicine } from '../models/Prescription';

interface PrescriptionDoc {
  prescription: IPrescription;
  patientName: string;
  patientNumber: string;
  doctorName: string;
  facilityName: string;
  allergies: string[];
}

export function buildPrescriptionHtml(doc: PrescriptionDoc): string {
  const { prescription, patientName, patientNumber, doctorName, facilityName, allergies } = doc;

  const medicines = prescription.medicines
    .map(
      (m: IPrescriptionMedicine) => `
      <tr>
        <td>${escHtml(m.name)}</td>
        <td>${escHtml(m.dosage)}</td>
        <td>${escHtml(m.frequency)}</td>
        <td>${m.durationDays} day${m.durationDays !== 1 ? 's' : ''}</td>
        <td>${escHtml(m.instructions ?? '—')}</td>
      </tr>`
    )
    .join('');

  const allergyWarning =
    allergies.length > 0
      ? `<div class="warning">
           <strong>⚠ Allergy alert:</strong> ${escHtml(allergies.join(', '))}
         </div>`
      : '';

  const issuedAt = new Date(prescription.issuedAt).toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prescription — ${escHtml(patientName)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1a1a1a; padding: 32px 40px; max-width: 800px; margin: auto; }
    h1 { font-size: 20px; font-weight: bold; margin-bottom: 2px; }
    .subtitle { font-size: 12px; color: #555; margin-bottom: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a56db; padding-bottom: 12px; margin-bottom: 20px; }
    .facility { font-size: 11px; color: #555; text-align: right; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; background: #f8f8f8; padding: 12px 16px; border-radius: 6px; }
    .meta dt { font-size: 11px; color: #666; font-weight: normal; margin-bottom: 1px; }
    .meta dd { font-weight: 600; font-size: 13px; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; color: #664d03; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead th { background: #1a56db; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    tbody tr:nth-child(even) { background: #f4f7ff; }
    tbody td { padding: 7px 10px; font-size: 13px; vertical-align: top; border-bottom: 1px solid #e5e7eb; }
    .instructions-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; }
    .footer { margin-top: 40px; font-size: 11px; color: #888; border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-content: space-between; }
    .sig { margin-top: 32px; }
    .sig-line { border-top: 1px solid #333; width: 220px; margin-top: 48px; font-size: 11px; color: #555; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🏥 Prescription</h1>
      <p class="subtitle">Hospital Appointment &amp; Health Records System</p>
    </div>
    <div class="facility">
      <strong>${escHtml(facilityName)}</strong><br/>
      Issued: ${escHtml(issuedAt)}
    </div>
  </div>

  <dl class="meta">
    <div><dt>Patient</dt><dd>${escHtml(patientName)}</dd></div>
    <div><dt>Patient No.</dt><dd>${escHtml(patientNumber)}</dd></div>
    <div><dt>Prescribing Doctor</dt><dd>${escHtml(doctorName)}</dd></div>
    <div><dt>Prescription ID</dt><dd>${escHtml(String(prescription._id))}</dd></div>
  </dl>

  ${allergyWarning}

  <table>
    <thead>
      <tr>
        <th>Medicine</th>
        <th>Dosage</th>
        <th>Frequency</th>
        <th>Duration</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${medicines}
    </tbody>
  </table>

  ${
    prescription.instructions
      ? `<div class="instructions-box">
           <strong>General Instructions:</strong> ${escHtml(prescription.instructions)}
         </div>`
      : ''
  }

  <div class="sig">
    <div class="sig-line">${escHtml(doctorName)} &nbsp;— Signature / Stamp</div>
  </div>

  <div class="footer">
    <span>HAS — Hospital Appointment &amp; Health Records System</span>
    <span>Prescription ID: ${escHtml(String(prescription._id))}</span>
  </div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
