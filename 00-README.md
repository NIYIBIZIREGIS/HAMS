# HAS Build Prompts — File Index

Eight self-contained prompt files, one per build phase. Each file is complete on its
own — paste it directly into your AI coding assistant with no other file or extra
explanation needed.

| # | File | What it builds |
|---|---|---|
| 1 | `phase-1-core.md` | Auth, Facilities, Users/Roles, Departments, Doctors, Appointments & scheduling |
| 2 | `phase-2-clinical.md` | Consultation workflow, medical records, vitals, prescriptions, lab tests |
| 3 | `phase-3-pharmacy.md` | Pharmacy inventory and dispensing |
| 4 | `phase-4-financial.md` | Billing, payments, receipts, insurance & government-scheme claims |
| 5 | `phase-5-engagement.md` | Notifications, reminders, SMS/USSD booking |
| 6 | `phase-6-insights-compliance.md` | Reports/analytics, audit logs, consent registry, auditor role |
| 7 | `phase-7-interoperability-resilience.md` | Cross-facility referrals, offline-first sync |
| 8 | `phase-8-polish.md` | Telemedicine, accessibility, performance, deployment/CI-CD |

## How to use

1. Start a new AI coding session (or repo) and paste **`phase-1-core.md`** in full.
2. Let the assistant scaffold and build Phase 1 completely — review its summary and
   the deliverables checklist at the bottom of the file before moving on.
3. In the **same repo/session**, paste **`phase-2-clinical.md`** next, and so on
   through Phase 8, in order.
4. Each file repeats the project context, roles, and non-functional requirements so
   the assistant never loses that context — you don't need to re-paste earlier files.
5. If you're resuming in a fresh AI session partway through (e.g., starting at Phase 4
   in a new chat), just tell the assistant "continue in the existing codebase" — the
   file already says not to re-scaffold unless it's Phase 1.

## Notes

- All 8 files are derived from, and stay consistent with, the full master
  specification (`Hospital_Appointment_System_Master_Prompt.md` / `.pdf`) — keep that
  document as your reference if you ever need more detail than a phase file includes.
- Stack is fixed throughout: Node.js + Express (TypeScript), MongoDB + Mongoose,
  React (Vite + TypeScript) + TailwindCSS.
