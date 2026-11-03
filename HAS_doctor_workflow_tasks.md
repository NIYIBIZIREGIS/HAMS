# HAS (Hospital Appointment System): Doctor Workflow Implementation Tasks

> **Instructions for the AI agent:** Read this whole file before writing any code. Implement the work **phase by phase**, in order. Finish and verify one phase before starting the next.

---

## 0. Ground Rules (read first)

1. **Explore before coding.** Inspect the existing repository: framework, folder structure, routing, state management, UI component library, styling approach, database/ORM, auth, API layer, and notification code. Summarize what you found in a short note before making changes.
2. **Reuse the existing stack and conventions.** Do **not** introduce new frameworks, UI libraries, or state managers unless there is no alternative. Match existing naming, file layout, component patterns, form handling, validation, and error handling.
3. **Extend, don't rewrite.** Reuse the existing `appointments`, `notifications`, `availability`, `users/doctors/patients` models and pages. Add columns/fields/migrations only where needed, using the project's existing migration approach.
4. **Match the existing UI.** Keep the current design language (blue primary color, rounded cards, pill status badges, sidebar layout, "Plus Jakarta"-style typography as already used). New pages must look like they belong.
5. **Security first.** Enforce role-based access on the server (not just the UI): a doctor can only view/modify appointments assigned to them; a patient can only view their own.
6. **Keep changes small and reviewable.** One logical change per commit. Add or update tests where the project already has a test setup.
7. **If something is ambiguous**, choose the simplest option consistent with the existing code and note the assumption in your final summary.

---

## 1. Current State (observed in the app)

**Patient side**
- Sidebar: Home, Dashboard, Book appointment, My appointments, My hospitals, Medical history, Prescriptions, Lab results, Messages, Notifications, Documents.
- "My appointments" lists: Date, Time, Department, Doctor, Type (New), Status (e.g. **Pending**), Actions (cancel, view). Filters: All / Upcoming / Completed / Cancelled.
- Booking an appointment creates a record with status **Pending**.

**Doctor side**
- Sidebar: Dashboard, Availability, Settings (very limited).
- Availability page: add availability (days, start/end time, break start/end) and a weekly schedule view.
- Notification bell shows: *"New appointment request: A patient has requested an appointment on 10/25/2026 at 21:45."* with "Mark all read".

**The problem:** the doctor receives the notification but **cannot do anything with it**. There is no page to view, accept, decline, or manage appointments, and the patient never receives an outcome.

**Goal:** complete the loop: request → doctor decision → patient notified → consultation → records.

---

## 2. Target Status Flow

Use the existing status field/enum; extend it only with values that are missing.

```
PENDING ──accept──────────▶ CONFIRMED ──start──▶ IN_PROGRESS ──finish──▶ COMPLETED
   │                           │  │
   │                           │  └──no show────▶ NO_SHOW
   │                           └──cancel (doctor/patient)──▶ CANCELLED
   ├──decline (reason)──▶ DECLINED
   └──propose new time──▶ RESCHEDULE_PROPOSED ──patient accepts──▶ CONFIRMED
                                  └──patient rejects──▶ DECLINED / CANCELLED
```

Rules:
- Only valid transitions are allowed; reject others with a clear error.
- Every transition records who did it and when (audit fields or history table).
- Every transition that affects the patient triggers a patient notification.

---

## 3. Phased Task List

### PHASE 1: Close the loop (must have)

#### Task 1.1: Actionable notification
- Clicking the "New appointment request" notification marks it read and navigates the doctor to that appointment's detail view (deep link by appointment id).
- Store the related `appointment_id` (and link/type) on the notification if not already stored.
- Optional: show **Accept** / **Decline** quick buttons inside the notification item.

**Acceptance criteria**
- [ ] Clicking the notification opens the correct appointment.
- [ ] Unread badge count updates after reading.

#### Task 1.2: Doctor "Appointments" page
- Add an **Appointments** item to the doctor sidebar (above Availability).
- Tabs/filters: **Pending, Upcoming (Confirmed), Completed, Declined/Cancelled, All**.
- Table columns: Patient name, Date, Time, Department, Type (New/Follow-up), Reason, Status, Actions.
- Pending tab shows a count badge. Sort by soonest date first. Add search by patient name and a date filter.
- Reuse the table/pill/tab styles from the patient "My appointments" page.

**Acceptance criteria**
- [ ] A doctor sees only their own appointments.
- [ ] Newly booked patient requests appear in Pending without a manual refresh of the database.
- [ ] Empty states are handled.

#### Task 1.3: Accept and Decline
- **Accept:** Pending → Confirmed.
- **Decline:** opens a modal with a required reason (preset options such as "Not available", "Wrong department", "Other" + free text). Pending → Declined.
- Server validates ownership and current status (cannot accept an already-declined request, etc.).
- Handle race conditions (two actions at once) by checking status in the update condition.

**Acceptance criteria**
- [ ] Status updates in the doctor list and in the patient's "My appointments" page.
- [ ] Decline cannot be submitted without a reason.

#### Task 1.4: Notify the patient of the outcome
- On Accept → patient notification: "Your appointment on {date} at {time} with {doctor} is confirmed."
- On Decline → patient notification including the reason.
- Show the notification in the patient's existing Notifications page and bell.
- If the project already has email/SMS infrastructure, send those too; otherwise **skip external channels in this phase** and leave a clearly marked extension point.

**Acceptance criteria**
- [ ] Patient sees the correct notification immediately after the doctor acts.
- [ ] The patient's appointment status badge matches (Confirmed / Declined) and shows the decline reason in the detail view.

---

### PHASE 2: Scheduling intelligence

#### Task 2.1: Conflict and availability checking
- On accept/reschedule, warn (or block, matching existing UX conventions) if the slot:
  - falls outside the doctor's availability for that weekday,
  - overlaps a break,
  - overlaps another Confirmed appointment for the same doctor.
- On the **patient booking page**, only offer slots that are within availability and not already taken (preferred), or at minimum validate on the server when the booking is created.

#### Task 2.2: Propose a new time
- Doctor action on a Pending request: **Propose new time** → pick from suggested free slots (generated from availability minus existing appointments) or choose manually, add optional note.
- Status → RESCHEDULE_PROPOSED; patient is notified and can **Accept** (→ Confirmed with the new time) or **Reject** (→ Declined/Cancelled) from "My appointments" and from the notification.

#### Task 2.3: Reschedule and cancel (confirmed appointments)
- Doctor can reschedule a Confirmed appointment (same slot-suggestion and conflict logic) or cancel it with a reason.
- Patient is notified in both cases.

#### Task 2.4: Patient details view
- Appointment detail drawer/page for the doctor showing: patient profile (name, age, gender, contact), reason/symptoms entered at booking, appointment type, and **read-only** links/sections for medical history, allergies, previous visits, uploaded documents, and lab results (reuse the patient-side data, with doctor-scoped access control).
- Enforce that the doctor can only see records of patients who have an appointment with them (or per the project's existing access rules).

**Acceptance criteria (Phase 2)**
- [ ] Double-booking the same doctor/time is impossible.
- [ ] Proposed-time flow works end to end for both roles.
- [ ] Doctor cannot open data of unrelated patients.

---

### PHASE 3: Consultation workflow

#### Task 3.1: Appointment day actions
- For Confirmed appointments on the current day: **Start consultation** (→ In progress), **Complete**, **Mark as No-show**.

#### Task 3.2: Consultation notes and diagnosis
- Form with: chief complaint, notes, diagnosis, treatment plan. Saved against the appointment, visible to the doctor and (where appropriate) to the patient in Medical history.

#### Task 3.3: Prescriptions
- Doctor creates prescriptions (medicine, dosage, frequency, duration, instructions) linked to the appointment. They appear on the patient's existing **Prescriptions** page and trigger a notification.

#### Task 3.4: Lab test requests
- Doctor requests lab tests linked to the appointment. Requested tests appear on the patient's **Lab results** page as "Requested"; results (when uploaded by the lab/staff flow that already exists) are visible to the doctor.

#### Task 3.5: Follow-up and referral
- **Book follow-up:** create a new appointment (type = Follow-up) for the same patient, auto-confirmed or proposed per the doctor's choice.
- **Refer:** refer the patient to another department/doctor with a note (creates a notification and, optionally, a pending appointment for the other doctor).

**Acceptance criteria (Phase 3)**
- [ ] A full visit can be completed: start → notes → prescription → lab request → follow-up → complete.
- [ ] Patient-side pages (Prescriptions, Lab results, Medical history) reflect the doctor's entries.

---

### PHASE 4: Productivity and communication

#### Task 4.1: Doctor dashboard
- Replace/extend the current dashboard with: pending requests count, today's patients, completed this week, and a **Today's schedule** timeline. Each item links to the appointment detail.

#### Task 4.2: Calendar view
- Day / week / month calendar combining the doctor's availability and appointments (color-coded by status). Clicking an item opens the detail view.

#### Task 4.3: Messaging
- Doctor-patient messaging using the existing **Messages** module (add the doctor-side entry in the sidebar). Allow starting a conversation from an appointment detail ("Ask patient for more info").

#### Task 4.4: Reminders
- Reminder notifications for both roles 24 hours and 1 hour before a Confirmed appointment (use the project's existing scheduler/cron/background-job mechanism; if none exists, propose the simplest option and implement it).

#### Task 4.5 (optional): Teleconsultation
- Add an optional meeting-link field for online appointments, shown to the patient once confirmed.

---

## 4. Data Model Guidance (adapt to the existing schema)

Do not blindly create these. Compare with the existing tables and add only what's missing.

| Entity | Needed fields (add if absent) |
|---|---|
| **Appointment** | `status`, `decline_reason`, `cancel_reason`, `proposed_date`, `proposed_time`, `reason_for_visit`, `type` (New/Follow-up), `decided_by`, `decided_at`, `meeting_link` (optional) |
| **AppointmentHistory** (optional) | `appointment_id`, `from_status`, `to_status`, `changed_by`, `note`, `created_at` |
| **Notification** | `user_id`, `type`, `title`, `message`, `appointment_id` (or generic `link`), `is_read`, `created_at` |
| **ConsultationNote** | `appointment_id`, `doctor_id`, `patient_id`, `complaint`, `notes`, `diagnosis`, `plan`, `created_at` |
| **Prescription / PrescriptionItem** | link to appointment and patient; medicine, dosage, frequency, duration, instructions |
| **LabRequest** | `appointment_id`, `test_name`, `status` (Requested/Done), `result_ref` |

Add indexes on `(doctor_id, date, time)` and `(doctor_id, status)`. Ensure date/time/timezone handling follows what the app already does (note the app currently shows `MM/DD/YYYY` and 24-hour time).

---

## 5. API / Server Actions Guidance (follow the existing pattern: REST routes, server actions, tRPC, etc.)

Suggested operations (names are illustrative):

- `GET  doctor appointments` (filter by status, date, search)
- `GET  appointment by id` (role-checked)
- `POST accept appointment`
- `POST decline appointment` (body: reason)
- `POST propose new time` (body: date, time, note)
- `POST respond to proposal` (patient; body: accept | reject)
- `POST reschedule appointment`, `POST cancel appointment`
- `POST start | complete | no-show`
- `GET  available slots` (doctor, date range)
- `POST consultation note`, `POST prescription`, `POST lab request`, `POST follow-up`, `POST referral`

Every mutation must: authenticate, authorize by role and ownership, validate input, validate the status transition, write the history/audit entry, and create the notification(s), ideally in a single transaction.

---

## 6. Notification Events

| Event | Recipient | Message summary |
|---|---|---|
| Appointment requested | Doctor | Existing; now links to the appointment |
| Accepted | Patient | Confirmed with date/time/doctor |
| Declined | Patient | Declined + reason |
| New time proposed | Patient | Proposed date/time + accept/reject |
| Proposal accepted / rejected | Doctor | Patient's response |
| Rescheduled / cancelled | The other party | New time or reason |
| Prescription added | Patient | New prescription available |
| Lab test requested | Patient | Test requested |
| Reminder (24h, 1h) | Both | Upcoming appointment |

---

## 7. UI/UX Requirements

- Status badge colors consistent with the existing pill style (Pending = yellow, Confirmed = green, Declined/Cancelled = red/grey, Completed = blue, In progress = purple, No-show = orange).
- Confirmation dialogs for destructive actions (decline, cancel).
- Loading, empty, and error states on every new view.
- Toast/feedback after every action.
- Fully responsive (the sidebar already collapses; new tables must scroll or stack on small screens).
- Accessible: keyboard navigable modals, labeled inputs, sufficient contrast.

---

## 8. Testing Checklist

- [ ] Patient books → doctor receives notification → opens it → lands on correct appointment.
- [ ] Accept updates status for both roles and notifies the patient.
- [ ] Decline requires a reason; patient sees it.
- [ ] A doctor cannot act on another doctor's appointment (API returns 403/404).
- [ ] Invalid status transitions are rejected.
- [ ] Double-booking is prevented.
- [ ] Propose-new-time flow works for both accept and reject paths.
- [ ] Consultation → prescription → lab request appear on patient pages.
- [ ] Reminders fire at the correct times.
- [ ] No regressions on existing patient booking, cancel, and filter features.

---

## 9. Definition of Done

- All tasks in the current phase are implemented, working end to end with real data, and meet their acceptance criteria.
- No new dependencies were added without justification.
- Linting, type-checking, and existing tests pass; new tests added where a test setup exists.
- Migrations are included and reversible.
- A short summary is provided at the end of each phase: files changed, migrations added, assumptions made, and anything deferred.

---

## 10. How to Start

1. Scan the repo and write a 10-line summary of the architecture (stack, routing, DB, auth, notifications, UI library).
2. Start **Phase 1, Task 1.1** and work down the list.
3. After completing Phase 1, stop and report before beginning Phase 2.
