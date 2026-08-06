# EHR API Workflow Map

All paths are relative to `/api/`. DRF permissions and role-filtered querysets
are authoritative; frontend route guards are usability controls.

| Workflow | Endpoint/action | Authorized roles |
|---|---|---|
| Portal login | `auth/jwt/create/` | Portal type must match staff or student role |
| Current profile | `profile/me/` | Authenticated account |
| Dashboard | `dashboard/summary/` | Role-scoped values for all assigned roles |
| Patient directory | `patients/` | AD/RC manage; DC sees assigned/treated patients; PT sees own |
| Student account | `patients/{id}/portal-account/` | AD/RC |
| Intake list/create | `clinic-intakes/` | Role-scoped list; AD/RC create |
| Submit | `clinic-intakes/{id}/submit/` | Owning RC or AD |
| Begin review | `clinic-intakes/{id}/begin-review/` | NS or AD |
| Available doctors | `clinic-intakes/available-doctors/` | NS or AD |
| Schedule/reschedule | `clinic-intakes/{id}/schedule/`, `reschedule/` | NS or AD |
| Confirm/start/attend/complete | intake detail actions | Assigned DC or AD |
| Reassign/correct/archive | intake detail actions | AD; reason required |
| Appointments | `appointments/` | Scoped reads; RC request; NS/AD schedule; assigned DC status |
| Visits | `visits/` | Assigned DC/AD author; PT approved own history |
| Vital signs | `vital-signs/` | DC/NS/AD create; scoped read |
| Clinical notes | `clinical-notes/` | DC/NS/AD; PT receives patient-visible notes only |
| Diagnoses | `diagnoses/` | DC/AD create/correct; ordinary delete returns 405 |
| Medications/prescriptions | `medications/`, `prescriptions/` | DC/AD clinical authoring |
| Staff | `staff/` and actions | AD only |
| Audit | `audit-logs/` | AD only and read-only |

Important error contracts are 401 for missing/expired authentication, 403 for
forbidden role actions, 404 for ownership-filtered objects, 400 for invalid
transitions/conflicts, and 405 for ordinary permanent clinical deletion.
