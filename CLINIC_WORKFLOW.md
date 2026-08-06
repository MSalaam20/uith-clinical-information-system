# Clinic Workflow And Role Contract

## Role Matrix

| Role | Default route | Permitted work | Explicitly forbidden |
|---|---|---|---|
| Doctor-in-Charge (`AD`) | `/clinic-overview` | All queues, clinical care, staff, audit, reassign, correct, archive | Ordinary permanent clinical deletion |
| Doctor (`DC`) | `/doctor-queue` | Assigned queue, confirm, start, document, prescribe, complete | Staff, audit, unrelated archive |
| Nurse (`NS`) | `/nurse-queue` | Review, assign doctor, schedule/reschedule, queue status | Diagnose, prescribe, complete, staff, audit |
| Receptionist (`RC`) | `/reception/intake` | Find/register student, demographics, create/submit intake, status | Clinical authoring, assignment, completion, delete |
| Clinical Officer (`CO`) | `/dashboard` | Restricted summary and account | Clinic workflow mutation and administration |
| Student (`PT`) | `/my-care` | Own timeline, appointment, approved summary/prescription | Lists, staff workflow, clinical mutation |

## Status Diagram

```text
RECEPTION_INTAKE -> SENT_TO_NURSE -> NURSE_REVIEW
  -> APPOINTMENT_SCHEDULED -> WAITING_FOR_DOCTOR -> DOCTOR_CONFIRMED
  -> IN_CONSULTATION -> ATTENDED -> COMPLETED
                                      -> FOLLOW_UP_REQUIRED

Controlled exits: CANCELLED, ARCHIVED
Doctor-in-Charge correction: audited transition to an explicitly allowed target
```

## Transition Ownership

| Transition | Actor | Required validation |
|---|---|---|
| Create/submit | Reception or Doctor-in-Charge | One active intake per patient |
| Begin review | Nurse or Doctor-in-Charge | Current state is sent to nurse |
| Schedule | Nurse or Doctor-in-Charge | Active doctor, future date, no patient/doctor collision |
| Confirm/start/attend | Assigned doctor or Doctor-in-Charge | Assignment and current state |
| Complete/follow-up | Assigned doctor or Doctor-in-Charge | Linked open visit and summary |
| Reassign/correct/archive | Doctor-in-Charge | Required reason and audit event |

Every transition is transactional, locks the intake row, appends status history,
updates timestamps and creates an audit event.

## Student Labels

| Status | Message |
|---|---|
| `RECEPTION_INTAKE` | Your clinic information is being recorded. |
| `SENT_TO_NURSE` | Your information has been sent to the nurse. |
| `NURSE_REVIEW` | The nurse is reviewing your clinic request. |
| `APPOINTMENT_SCHEDULED` | Your doctor appointment has been scheduled. |
| `WAITING_FOR_DOCTOR` | You are waiting for the assigned doctor. |
| `DOCTOR_CONFIRMED` | The doctor has confirmed your appointment. |
| `IN_CONSULTATION` | Your consultation is currently in progress. |
| `ATTENDED` | You have been attended to. |
| `COMPLETED` | This clinic visit has been completed. |
| `FOLLOW_UP_REQUIRED` | A follow-up visit has been recommended. |

## Repeat Visit And Archive Policy

A terminal intake does not block a later intake. The existing User and Patient
are reused, preserving prior appointments, visits and prescriptions. Active
duplicates are rejected. Ordinary DELETE is unavailable for patients,
appointments, intakes and clinical history; controlled archive/correction uses
a reason, timestamp, actor, history record and audit event.

## Demo Data

```powershell
$env:EHR_DEMO_PASSWORD='<temporary defence password>'
python manage.py seed_demo_data
python manage.py archive_demo_data
python manage.py purge_demo_data --confirm PURGE-DEMO-DATA
```

The password remains process-only. The credential panel additionally requires
`SHOW_DEMO_CREDENTIALS=True`; without both values the API returns no accounts.

Seed is development/defence-gated and idempotent. Purge requires a separate
environment guard outside DEBUG, prints selected counts, refuses uncertain
links and deletes only positively tagged demo rows.
