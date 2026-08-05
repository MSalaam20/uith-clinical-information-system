# UITH School Complex Clinic EHR

This repository contains the final-year project **Design and Implementation of
Health Clinical Database Information** for the University of Ilorin Teaching
Hospital School Complex Clinic, Amilegbe, Ilorin. It is an existing Django REST
Framework and React application that has been hardened and extended in place.

All included patient and account information is synthetic demonstration data.
Do not enter real patient information in an unsecured development environment.

## Technology stack

- Python 3.11, Django 5.0, Django REST Framework 3.14
- Djoser and SimpleJWT authentication
- MariaDB/MySQL-compatible database through PyMySQL 1.1.1
- React 18, Redux Toolkit, Axios, Bootstrap, FullCalendar and RJSF
- phpMyAdmin as an optional database-administration interface only
- Nginx and Docker Compose
- Swagger and Redoc in development

MariaDB/MySQL is the required database engine. The active local server is
MariaDB 10.4.32 through PyMySQL, with InnoDB tables and `utf8mb4` encoding.
This completion does not force a local MySQL 8 upgrade. The optional Docker
environment retains a MySQL 8 service for independent container deployments.
The implementation does not use PostgreSQL. phpMyAdmin may inspect or administer
the database, but the application backend remains Django.

## Project structure

```text
EHR/
|-- backend/                 Django project and applications
|   |-- backend/             Settings, root URLs and shared API views
|   |-- organization/        Clinic and department models
|   |-- patients/            Patients and appointments
|   |-- records/             Dynamic records and normalized clinical data
|   |-- users/               Profiles, roles, authentication and permissions
|   `-- utils/               JSON schema and embedded-file helpers
|-- frontend/                React application
|   |-- public/
|   `-- src/                 API, Redux slices, routes and UI components
|-- infra/                   Docker Compose, Nginx and environment example
|-- dfd.drawio               Data-flow diagram source
`-- use case.png             Use-case diagram
```

## Prerequisites

- Python 3.11 or a compatible supported Python version
- The working MariaDB 10.4.32 server, or a compatible MySQL/MariaDB server
- phpMyAdmin when a graphical database-administration interface is desired
- Node.js 20 LTS and npm
- Docker Desktop only when using the container workflow

## Environment variables

Use `infra/.env.example` as the template. Required production values include:

```dotenv
DJANGO_SECRET_KEY=replace-with-a-long-random-production-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=ehr.example.invalid
DJANGO_CORS_ALLOWED_ORIGINS=https://ehr.example.invalid
DJANGO_CSRF_TRUSTED_ORIGINS=https://ehr.example.invalid
DB_ENGINE=django.db.backends.mysql
DB_NAME=uith_ehr_db
DB_USER=uith_ehr_user
DB_PASSWORD=replace-with-a-strong-database-password
DB_HOST=127.0.0.1
DB_PORT=3306
DJANGO_USE_PROXY_SSL_HEADER=True
DJANGO_SECURE_SSL_REDIRECT=True
DJANGO_SESSION_COOKIE_SECURE=True
DJANGO_CSRF_COOKIE_SECURE=True
DJANGO_SECURE_HSTS_SECONDS=31536000
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=True
DJANGO_SECURE_HSTS_PRELOAD=True
DJANGO_API_DOCS_PUBLIC=False
```

The legacy `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_HOST` and
`MYSQL_PORT` names remain supported for existing local environments. Legacy
security variable names also remain usable where previously configured. Secret
`.env` files are ignored by Git.

## Local database setup

Create a dedicated database and user using an authorized MySQL administrator:

```sql
CREATE DATABASE uith_ehr_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER 'uith_ehr_user'@'localhost' IDENTIFIED BY 'replace-this-password';
GRANT ALL PRIVILEGES ON uith_ehr_db.* TO 'uith_ehr_user'@'localhost';
```

InnoDB is required for transactions, foreign keys and referential integrity.
The Django connection also enables strict transactional SQL mode. For the
existing local database, use phpMyAdmin to inspect the database, engine,
collation and indexes; never expose phpMyAdmin publicly or embed its credentials
in this application.

## Backend setup

From PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py seed_uith_data
python manage.py runserver
```

`seed_uith_data` is idempotent for the supplied synthetic clinic demonstration
records. It creates doctor, nurse, receptionist and student accounts whose demo
credentials are displayed by the development landing page. These credentials
must be disabled or changed before any non-demonstration deployment.

## Frontend setup

The selected package manager is npm. `package-lock.json` is authoritative.

```powershell
cd frontend
npm.cmd ci
npm.cmd test
npm.cmd start
```

The API defaults to `http://localhost:8000/api/`. Override it with
`REACT_APP_BASE_URL` when required. A production build is created with:

```powershell
npm.cmd run build
```

## Docker setup

Create `infra/.env` from the example and replace every placeholder, then run:

```powershell
cd infra
docker compose config
docker compose up --build
```

Compose starts MySQL 8.0, Django/Gunicorn, the built React/Nginx frontend and a
reverse-proxy Nginx service at `http://localhost:8000`. MySQL uses a persistent
named volume and a health check. Redis and Celery runtime services were disabled
because the application currently defines no task queue configuration or tasks.

## Authentication and roles

Both portals use JWT authentication, but `portal_type` is verified by the
backend and frontend. The current profile is always resolved through
`GET /api/profile/me/`; a frontend-supplied Profile ID is never trusted.

| Role | Main authorized behavior |
|---|---|
| Administrator | Staff roles, audit logs, all patient/appointment/clinical operations and restricted hard deletion |
| Doctor | Patient/history viewing, visits, diagnoses, prescriptions and dynamic clinical records |
| Nurse | Patient viewing/editing, vital signs, nursing notes and permitted appointments |
| Receptionist | Patient registration/demographics and permitted appointments; no clinical authoring or deletion |
| Student/patient | Own linked patient, appointments and approved clinical history only |

The DRF default is `IsAuthenticated`. Public access is explicitly limited to
authentication endpoints and development API documentation. A denied role gets
HTTP 403; a missing or invalid token gets HTTP 401.

No default administrator password is seeded. Before an administrator demo,
create an account interactively and assign its automatically created clinic
profile the administrator role:

```powershell
python manage.py createsuperuser
python manage.py shell -c "from users.models import Profile,Role; p=Profile.objects.get(user__username='YOUR_ADMIN_USERNAME'); p.role=Role.ROLE_ADMIN; p.save(update_fields=['role'])"
```

Use a synthetic username in demonstrations and never place the chosen password
in source control, shell scripts or screenshots.

## Main API routes

| Route | Purpose |
|---|---|
| `POST /api/auth/jwt/create/` | Portal-aware JWT login |
| `POST /api/auth/jwt/refresh/` | Access-token refresh |
| `GET /api/profile/me/` | Authenticated profile and role |
| `/api/patients/` | Patient CRUD, search and administrator archive |
| `/api/appointments/` | Appointment CRUD and cancellation |
| `PATCH /api/appointments/{id}/status/` | Permitted appointment status change |
| `/api/visits/` | Structured encounters |
| `/api/vital-signs/` | Structured observations |
| `/api/clinical-notes/` | Clinical and nursing notes |
| `/api/diagnoses/` | Diagnoses with optional ICD-11 code |
| `/api/medications/` | Medication catalogue |
| `/api/prescriptions/` | Prescriptions and items |
| `/api/records/` | Legacy/custom schema-driven clinical forms |
| `/api/icd-11/search/` | Curated local ICD-11 demonstration search |
| `/api/audit-logs/` | Administrator-only append-oriented audit trail |
| `/api/staff/` | Administrator-only staff listing and role assignment |
| `PATCH /api/staff/{id}/status/` | Administrator-only activation/deactivation |
| `/api/dashboard/summary/` | Role-filtered live dashboard values |

Swagger is available at `/swagger/` and Redoc at `/redoc/` when
`DJANGO_DEBUG=True`. Production documentation access is administrator-only.

## Completed clinical workflow

The React patient workspace supports the daily workflow without requiring
Swagger:

1. Sign in through the role-appropriate portal.
2. Search for or register a patient and open `/patients/{id}`.
3. Review demographics, visits, vitals, diagnoses, notes, prescriptions,
   appointments and custom records in separate tabs.
4. Create or edit an open visit and optionally link an appointment.
5. Record validated vital signs; BMI is calculated by the backend.
6. Add an authored clinical or nursing note and explicitly choose whether it is
   visible in the student portal.
7. Search the curated ICD-11 subset and add an ICD-linked diagnosis.
8. Search or create a medication presentation and create an atomic prescription
   containing one or more items.
9. Complete the visit and view the complete history.
10. Manage calendar appointments according to role.

Administrators additionally have `/staff` and `/audit-logs` workspaces. Students
are automatically routed to their linked patient and cannot retrieve another
patient by changing a URL.

## Verification

Backend:

```powershell
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py showmigrations
python manage.py test --verbosity 2
```

Frontend:

```powershell
cd frontend
npm.cmd ci
npm.cmd ls --depth=0
npm.cmd test
npm.cmd run build
```

Latest verified local result (5 August 2026): Django found 43 tests and all 43
passed in 145.029 seconds; Jest ran 15 tests across seven suites and all 15
passed in 18.215 seconds. The optimized React build completed successfully at
311.98 kB JavaScript and 40.66 kB CSS after gzip. React Router future-flag
notices occur in its test harness, and the older CRA toolchain emits a Node
`fs.F_OK` deprecation notice; neither prevented testing or compilation.

Docker, when installed:

```powershell
cd infra
docker compose config
docker compose build
```

## Security notes

- Access and refresh tokens are held in per-tab `sessionStorage` and removed on
  logout or failed refresh. An HTTP-only cookie design would be preferable for
  a production deployment and requires a coordinated backend change.
- Patient access is filtered through the authenticated `User` to `Patient`
  relationship; submitted patient IDs do not override ownership.
- Patient deletion is not exposed in the normal UI. Archiving requires an
  administrator and a reason. Permanent API deletion remains administrator-only.
- Embedded record images are restricted to JPEG, PNG and WebP, limited to 5 MB,
  assigned generated names and constrained to their record directory.
- Audit metadata excludes common password, token and secret keys. Audit records
  are read-only through the API and Django administration.
- Multi-item prescriptions are validated before persistence and created inside
  a database transaction. A failed item cannot leave a partial prescription.
- Clinical notes default to staff-only and must be explicitly marked patient
  visible before they are returned through a student visit response.
- Do not deploy with the example secrets, demo passwords, `DJANGO_DEBUG=True`,
  or unrestricted documentation access.

## Known limitations

- ICD-11 search is a seven-term curated local demonstration subset, not the full
  WHO API and not a claim of full ICD or FHIR compliance.
- Failed login auditing records the account identifier and outcome but not the
  request IP because SimpleJWT serializer validation has no request context in
  the current implementation.
- Docker execution is not verified on this computer because Docker Desktop is
  not installed; local Django, React and MariaDB are the verified path.
- The automated tests are focused backend and component tests rather than a full
  Playwright/Cypress browser suite. Follow `DEFENCE_DEMO.md` for the manual path.
- `npm audit --omit=dev` currently reports two moderate React Router advisories.
  The available v7 releases overlap with a newer high-severity RSC advisory, so
  the verified v6 line was retained. This client uses no SSR/RSC and no
  user-controlled redirect targets. The full audit also reports findings in CRA
  build/test tooling that is not copied into the final Nginx image.

## Academic alignment

The academic report must state that the implementation uses **MySQL**, not
PostgreSQL. The database justification should explain that MySQL with InnoDB
supports ACID transactions, foreign keys, indexes and normalized clinical data,
while `utf8mb4` supports complete Unicode storage.

The implemented terminology is **ICD-11**, currently represented by a curated
local subset. Any report section that says ICD-10 must be changed to ICD-11 or
must explicitly justify the difference. The data model and diagrams should add
Visit, VitalSign, ClinicalNote, ICDCode, Diagnosis, Medication, Prescription,
PrescriptionItem and AuditLog, while describing Record/Schema/Template as the
optional dynamic-form subsystem. API and testing chapters should include
`/api/profile/me/`, portal separation, ownership checks, 401/403 behavior,
normalized clinical routes, audit logging and the automated test evidence.

See `ACADEMIC_CORRECTIONS.md` for exact report edits and `DEFENCE_DEMO.md` for
the defence-day demonstration sequence.
