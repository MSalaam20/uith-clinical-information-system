# Stable Portfolio Release Checklist

Unchecked hosted items are not claims of completion. Add dates, deployment IDs,
or non-sensitive evidence links when each item is verified.

## Local release

- [x] Git status, branch, history, remotes, and tags inspected
- [x] Django system check passed before deployment edits
- [x] Migration state and drift checked before deployment edits
- [x] Complete local Django suite passed before deployment edits
- [x] Complete local Jest suite passed before deployment edits
- [x] Production React build passed before deployment edits
- [x] Private MariaDB backup created outside the repository
- [x] Tracked files and Git history scanned for credential signatures
- [x] Screenshots reviewed as controlled synthetic evidence
- [x] `.gitignore` hardened for secrets, dumps, media, and provider metadata
- [x] Final Django system and production checks pass
- [x] Final migration drift check passes
- [x] Final complete Django suite passes: 84 tests
- [x] Final complete Jest suite passes: 54 tests across 17 suites
- [x] Final production React build passes
- [x] Final `collectstatic` passes: 195 files, 561 post-processed
- [x] Final secret and privacy scan passes

## GitHub

- [x] Empty private GitHub repository created
- [x] `origin` points to the intended repository
- [x] `main` pushed without force
- [ ] GitHub Actions backend job passes with MariaDB
- [ ] GitHub Actions frontend job passes
- [ ] Description and recommended topics set
- [ ] README renders screenshots and disclaimer correctly

## Railway

- [x] Current plan, credit, trial, and payment requirements recorded
- [x] One Railway project created
- [x] MySQL service created; no PostgreSQL service exists
- [x] Django service connected to the GitHub repository
- [x] Backend root directory is `backend`
- [x] Private MySQL variable references configured
- [x] Production Django security variables configured
- [x] Migrations applied successfully
- [ ] Static collection and Django admin assets verified
- [x] `/health/` returns HTTP 200
- [ ] `python manage.py check --deploy` reviewed
- [x] Production Doctor-in-Charge created through a hidden prompt
- [x] Controlled synthetic demo data seeded idempotently
- [x] No local SQL dump imported
- [x] Media uploads remain disabled or verified persistent volume is documented

Evidence recorded August 11, 2026: Railway trial displayed 26 days or $5.00
credit remaining; no payment method, paid upgrade, custom domain, or PostgreSQL
service was added. Synthetic demo accounts were deactivated after seeding.

## Vercel

- [x] Current plan and payment requirements recorded
- [x] Same GitHub repository imported
- [x] Frontend root directory is `frontend`
- [ ] Node 20, `npm ci`, `npm run build`, and `build` output configured
- [x] `REACT_APP_BASE_URL` points to Railway HTTPS `/api/`
- [x] Production deployment returns HTTP 200
- [x] React assets load without blocking errors
- [x] Direct protected and public route refresh works
- [x] No localhost, mixed-content, `/api/api/`, or CORS request remains

Evidence recorded August 11, 2026: the project is on Vercel Hobby with the
provider domain only; no paid feature or custom domain was enabled.

## Hosted workflow

- [x] Academic/synthetic-data disclaimer is visible
- [x] Demo credentials are hidden
- [ ] Doctor-in-Charge login and logout work
- [ ] Doctor login and logout work
- [ ] Nurse login and logout work
- [ ] Receptionist login and logout work
- [ ] Student login and logout work
- [ ] Wrong-role portal login is rejected
- [ ] Password change works
- [ ] Receptionist creates/finds one synthetic student and intake
- [ ] Nurse receives, assigns, and schedules the intake
- [ ] Doctor confirms, consults, records approved synthetic care, and completes
- [ ] Student sees the care journey and approved outcome
- [ ] Repeat intake reuses the same patient/account

## Hosted authorization

- [ ] Student cannot retrieve another patient's data
- [ ] Receptionist cannot diagnose, prescribe, or delete clinical data
- [ ] Nurse cannot diagnose, prescribe, or complete consultation
- [ ] Ordinary doctor cannot access staff management or audit logs
- [x] Unauthenticated protected API request returns 401
- [ ] Authenticated forbidden request returns 403 or a secure 404

## Release completion

- [x] Live links added to README and deployment report
- [x] Password-reset email limitation recorded
- [x] Media persistence result recorded
- [ ] Hosted screenshots contain no credentials or real data
- [ ] Stable annotated tag created after hosted verification
- [ ] Tag pushed and GitHub release created
- [ ] Explicit approval obtained before any public visibility change
