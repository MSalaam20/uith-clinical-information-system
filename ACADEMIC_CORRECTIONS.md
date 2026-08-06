# Academic Report Corrections

## Technology And Terminology

- State Django 5, Django REST Framework, React 18, Redux Toolkit and Axios.
- State MariaDB 10.4.32 with PyMySQL 1.1.1, InnoDB and `utf8mb4`.
- Describe phpMyAdmin only as an optional database administration interface.
- Replace PostgreSQL, SQLite, PHP/Laravel and MySQL 8 implementation claims.
- Describe ICD-11 as a curated local demonstration subset, not complete WHO/FHIR integration.

## Unique Role Duties

- Doctor-in-Charge is the clinic administrator, staff authority, auditor and oversight doctor.
- Ordinary doctors treat only assigned or previously treated students and cannot manage staff/audit.
- Reception registers/finds students, records reported complaint and submits intake.
- Nursing reviews intake, assigns an available doctor and schedules the appointment.
- Students track only their own progress, appointments and approved outputs.
- Normal clinical history is corrected or archived with reason, not permanently deleted.

## Data Model And Diagrams

Add `ClinicIntake`, `ClinicIntakeStatusHistory`, appointment assignment/scheduler
links, `is_demo`, follow-up and archive metadata. Retain User/Profile, Patient,
Visit, VitalSign, ClinicalNote, ICDCode, Diagnosis, Medication, Prescription,
PrescriptionItem, Record and AuditLog. Updated source diagrams are in
`docs/architecture/clinic-erd.mmd`, `clinic-dfd.mmd` and `clinic-use-cases.mmd`.

## Testing Evidence

Report backend API/service tests separately from frontend component tests and
browser verification. The Edge DevTools run covers every role, the full intake
handoff, appointment assignment, doctor clinical documentation, student output,
repeat intake and six responsive widths. Evidence lives in
`docs/BROWSER_VERIFICATION.json` and `docs/screenshots/`.

All included patient data is synthetic. Demo rows are explicitly tagged and are
managed by guarded, idempotent seed/archive/purge commands.
