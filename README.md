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
- MySQL-compatible database through PyMySQL
- React 18, Redux Toolkit, Bootstrap, Material UI and RJSF
- Nginx and Docker Compose
- Swagger and Redoc in development

MySQL is the required database engine. The Docker environment uses MySQL 8.0.
The inspected local database server is MariaDB 10.4.32, which is
MySQL-compatible, with InnoDB tables and `utf8mb4` encoding. A current MySQL 8
release is recommended for new deployments.

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
- MySQL 8.0 or a compatible current MySQL server
- Node.js 20 LTS and npm
- Docker Desktop only when using the container workflow

## Environment variables

Use `infra/.env.example` as the template. Required production values include:

```dotenv
SECRET_KEY=replace-with-a-long-random-production-secret
DJANGO_DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:8000
DB_ENGINE=django.db.backends.mysql
DB_NAME=uith_ehr_db
DB_USER=uith_ehr_user
DB_PASSWORD=replace-with-a-strong-database-password
DB_HOST=127.0.0.1
DB_PORT=3306
```

The legacy `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_HOST` and
`MYSQL_PORT` names remain supported for existing local environments. Secret
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
The Django connection also enables strict transactional SQL mode.

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

## Main API routes

| Route | Purpose |
|---|---|
| `POST /api/auth/jwt/create/` | Portal-aware JWT login |
| `POST /api/auth/jwt/refresh/` | Access-token refresh |
| `GET /api/profile/me/` | Authenticated profile and role |
| `/api/patients/` | Patient CRUD, search and administrator archive |
| `/api/appointments/` | Appointment CRUD and cancellation |
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
| `/api/dashboard/summary/` | Role-filtered live dashboard values |

Swagger is available at `/swagger/` and Redoc at `/redoc/` when
`DJANGO_DEBUG=True`. Production documentation access is administrator-only.

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
npm.cmd ls --depth=0
npm.cmd test
npm.cmd run build
```

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
- Do not deploy with the example secrets, demo passwords, `DJANGO_DEBUG=True`,
  or unrestricted documentation access.

## Known limitations

- The local MariaDB 10.4 server is older than the recommended MySQL 8 deployment
  target even though migration and test compatibility was verified.
- ICD-11 search is a seven-term curated local demonstration subset, not the full
  WHO API and not a claim of full ICD or FHIR compliance.
- Normalized visit, diagnosis and prescription APIs are implemented, but the
  existing React clinical workspace still emphasizes schema-driven records;
  dedicated polished forms for every normalized entity remain future work.
- Failed login auditing records the account identifier and outcome but not the
  request IP because SimpleJWT serializer validation has no request context in
  the current implementation.
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
