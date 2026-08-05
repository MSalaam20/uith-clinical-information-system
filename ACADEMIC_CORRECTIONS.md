# Academic Report Corrections

Use this checklist when aligning the written final-year report with the working
application. It does not modify any proposal or dissertation document.

## Technology and Database

- Replace every PostgreSQL reference with MariaDB/MySQL.
- State that the verified local server is MariaDB 10.4.32 and the Django driver
  is PyMySQL 1.1.1.
- Explain that phpMyAdmin is an optional administration interface; it is not the
  application backend and is not exposed through React.
- Retain Django 5, Django REST Framework, Djoser/SimpleJWT, React 18, Redux
  Toolkit and Axios in the implementation chapter.
- Justify InnoDB using transactions, foreign keys, referential integrity and
  crash recovery. Explain `utf8mb4` as the database character set.
- Remove claims that the current local installation was upgraded to MySQL 8.

## Terminology

- Replace ICD-10 claims with ICD-11 where describing the implementation.
- State: "This implementation uses a curated local ICD-11 subset for
  demonstration and academic evaluation."
- Do not claim a complete WHO terminology service or FHIR compliance.

## Data Model and Diagrams

- Add Visit, VitalSign, ClinicalNote, ICDCode, Diagnosis, Medication,
  Prescription, PrescriptionItem and AuditLog to the ERD and data dictionary.
- Add Patient UUID, archive metadata, creator/updater fields and the explicit
  User-to-Patient ownership link.
- Show Prescription-to-PrescriptionItem as one-to-many and Medication protected
  by prescription-item references.
- Show optional Appointment-to-Visit one-to-one linkage.
- Retain Record, Schema and RecordTemplate as the custom schema-driven subsystem.
- Add `patient_visible` to ClinicalNote and explain its student-portal boundary.

## APIs and Security

- Add `/api/profile/me/`, `/api/dashboard/summary/`, normalized clinical routes,
  `/api/staff/` and `/api/audit-logs/` to the API chapter.
- Document portal-aware JWT login and access/refresh token handling.
- Include the administrator, doctor, nurse, receptionist, coordinator,
  student/patient and unassigned role matrix.
- Explain server-side ownership filtering and the difference between HTTP 401
  and 403.
- Document atomic prescription creation, serializer validation, safe uploads,
  archive policy and append-only auditing.

## User Interface and Testing

- Replace screenshots of the old three-column record workspace with the current
  patient directory, patient header and eight-tab clinical workspace.
- Add visit, vital-sign, note, diagnosis/ICD, medication, prescription,
  appointment, staff and audit-log screens to the interface chapter.
- Report only the final verified backend/frontend test totals from the project
  test commands.
- Separate automated component/API tests from manually demonstrated browser
  workflows.
- State Docker as configured but unverified locally because Docker Desktop is
  not installed.
- State that all included patient and account data is synthetic.
