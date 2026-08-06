# Defence Demonstration Guide

Use only the tagged synthetic accounts created after setting a temporary
`EHR_DEMO_PASSWORD` and running `python manage.py seed_demo_data`.
Never display passwords, tokens or private database values on a projector.

## Preflight

1. Start MariaDB, Django at `http://127.0.0.1:8001/` and React at `http://127.0.0.1:3001/`.
2. Run `python manage.py check` and confirm migrations are applied.
3. Open the landing page, lower workflow and product previews.
4. Keep the latest test/build summaries and `docs/screenshots/` ready.

## Exact Role Sequence

1. Sign in as Doctor-in-Charge through the staff portal.
2. Show Clinic Overview, Staff Management, Audit Logs and the demo-data panel.
3. Explain that ordinary doctors do not receive those routes, then sign out.
4. Sign in as receptionist and show its distinct dashboard/navigation.
5. Find an existing synthetic student or register a new synthetic student.
6. Create an intake, record the reported complaint and submit it to nursing.
7. Show that reception has no diagnosis, prescription, clinical completion or delete control.
8. Sign in as the student and show `Sent to nurse`; try `/patients/{other-id}` and show the access page.
9. Sign in as nurse, begin review, select an available doctor and schedule.
10. Show the appointment in the queue/calendar and the absence of clinical controls.
11. Sign in as the student and show date, doctor and waiting status.
12. Sign in as the assigned doctor and show only My Queue, Patients, My Appointments and ICD-11.
13. Confirm the appointment, start consultation and open the linked visit.
14. Add synthetic vitals/note, an ICD-11 diagnosis and a prescription.
15. Complete with an approved summary and optional follow-up instruction.
16. Attempt `/staff` and `/audit-logs` as the ordinary doctor and show denial.
17. Sign in as the student and show the completed/follow-up timeline, summary and prescription.
18. Return to reception and create a second intake for the same student.
19. Confirm the patient and profile counts did not increase.
20. Show Swagger/ReDoc, MariaDB/InnoDB, final tests and production build.

The automated equivalent is `node scripts/browser_verify.mjs` with
`EHR_BROWSER_PASSWORD` set only in the process environment. It records no
credential and writes factual results to `docs/BROWSER_VERIFICATION.json`.
