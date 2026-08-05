# Defence Demonstration Guide

Use synthetic demonstration accounts only. Keep the backend terminal, frontend
terminal and browser visible before the presentation begins.

Preflight: confirm a synthetic administrator profile exists. If it does not,
follow the interactive administrator setup in `README.md`; no default
administrator password is supplied by the project.

1. Introduce the objective: secure clinical-data management for the UITH School
   Complex Clinic using Django, React and MariaDB/MySQL.
2. Show the landing page and identify the separate Clinical Staff and Student
   Patient portals.
3. Submit a staff account through the student portal and show that it is
   rejected; then sign in through the staff portal.
4. Open the role-specific dashboard and point out live patient, appointment and
   visit values.
5. Open Patients, search by name or matric number, register a synthetic patient
   if required, and open the patient workspace.
6. Create a clinic visit with a chief complaint and initial summary.
7. Record temperature, blood pressure, pulse, oxygen saturation, height and
   weight; show the calculated BMI.
8. Add a clinical note and explain the patient-visible switch.
9. Search the curated ICD-11 subset, select a code and save the diagnosis.
10. Create or select a synthetic medication, add two prescription items and
    save the transaction. Show the items in patient history.
11. Complete the visit and show its combined vitals, notes, diagnoses and
    prescription.
12. Create an appointment, open it from the calendar and demonstrate a permitted
    status change.
13. Sign out, sign in as a student, and show that only the linked patient and
    appointments are visible. Explain that altered patient IDs return 404.
14. Sign in as an administrator, open Staff, change a synthetic account role or
    status with confirmation, then open the read-only Audit Log.
15. Open Swagger and Redoc, then explain that production access is restricted.
16. In phpMyAdmin, show `uith_ehr_db`, MariaDB 10.4.32, InnoDB tables and
    `utf8mb4`; do not reveal credentials or private row contents.
17. Show the final backend and frontend test summaries and the successful npm
    production build.
18. Close by stating the honest limitations: curated ICD-11 subset, no complete
    browser automation and Docker not executed on this computer.
