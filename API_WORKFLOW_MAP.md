# EHR API Workflow Map

This map records the contracts used by the React application. All paths are
relative to `/api/`. The global DRF default is authenticated access; public
account endpoints opt in to `AllowAny` explicitly.

| Workflow | Endpoint | Methods used | Roles and ownership | React consumer |
|---|---|---|---|---|
| Portal login | `auth/jwt/create/` | POST | Staff and student portal type must match the profile role | Login form and auth thunk |
| Current profile | `profile/me/` | GET | Authenticated account only | Auth thunk and protected routing |
| Dashboard | `dashboard/summary/` | GET | Role-filtered; student values are limited to the linked patient | Dashboard |
| Patients | `patients/` | GET, POST, PATCH | Staff can search; AD/NS/RC manage demographics; PT sees one linked patient | Patient directory and form |
| Student account | `patients/{id}/portal-account/` | GET, POST, PATCH via actions | AD/RC only; account is linked to the selected patient | Student account panel |
| Appointments | `appointments/` and detail actions | GET, POST, PATCH | AD/NS/RC manage; DC/NS/RC/AD change status; PT reads owned appointments | Calendar and patient history |
| Visits | `visits/` | GET, POST, PATCH | DC/AD mutate open visits; PT reads owned visits | Visit workspace |
| Vital signs | `vital-signs/` | GET, POST | DC/NS/AD record against open visits; PT reads owned history | Vital form and history |
| Clinical notes | `clinical-notes/` | GET, POST, PATCH | DC/NS/AD write; only author or AD edits; PT receives patient-visible notes only | Note form and history |
| ICD terminology | `icd-codes/` | GET | Authenticated read-only curated local ICD-11 subset | Debounced diagnosis search |
| Diagnoses | `diagnoses/` | GET, POST, PATCH, DELETE | DC/AD mutate open visits; PT reads owned history | Diagnosis form and visit history |
| Medications | `medications/` | GET, POST, PATCH | Clinic staff read; DC/AD create or edit | Prescription form catalogue |
| Prescriptions | `prescriptions/` | GET, POST | DC/AD create an atomic prescription with items; PT reads owned history | Prescription form and history |
| Legacy records | `records/` | GET, POST, PATCH | DC/AD mutate; PT reads linked records | Legacy/custom-record panel |
| Staff | `staff/` and detail actions | GET, POST, PATCH | AD only | Staff management |
| Audit logs | `audit-logs/` | GET | AD only, read-only | Audit viewer |

Role codes are `AD` administrator, `DC` doctor, `NS` nurse, `RC`
receptionist, `CO` coordinator, `PT` student/patient and `US` unassigned.
Backend queryset filtering and permission classes remain authoritative; hidden
buttons or navigation links are usability controls, not security boundaries.
