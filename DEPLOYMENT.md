# Deployment Guide

This guide deploys the React frontend to Vercel and the Django REST Framework
backend plus MySQL to one Railway project. The repository remains private until
an explicit publication decision. Never commit passwords, tokens, SQL backups,
production secret keys, or real patient information.

## Architecture

```text
Browser
  | HTTPS
  v
Vercel React SPA
  | HTTPS + JWT API requests
  v
Railway Django/Gunicorn service
  | Railway private network
  v
Railway MySQL service
```

Only synthetic data may be hosted. Django is not deployed to Vercel, and the
database must remain MySQL/MariaDB rather than PostgreSQL.

## Current hosted deployment

Verified August 11, 2026:

- Private source: <https://github.com/MSalaam20/uith-clinical-information-system>
- React application: <https://uith-clinical-information-system.vercel.app/>
- Django API: <https://uith-clinical-information-system-production.up.railway.app/api/>
- Health endpoint: <https://uith-clinical-information-system-production.up.railway.app/health/>
- Database: Railway MySQL in the same project over private networking

The Vercel application, direct SPA fallback, Railway health endpoint, and
cross-origin preflight were verified over HTTPS. Railway displayed 26 days or
$5.00 of trial credit remaining, and Vercel displayed the Hobby plan. No paid
upgrade, payment method, custom domain, or PostgreSQL service was added.

## Cost and provider limits

No plan upgrade, payment method, paid domain, or paid add-on is authorized by
this guide. Account-specific plan, credit, and trial details must be read from
each provider dashboard before service creation.

- Vercel's Hobby plan is currently listed at $0/month for personal,
  non-commercial projects and stops additional usage at its included limits.
- Railway currently documents a $0/month Free plan with limited monthly credit
  and a time-limited trial for eligible accounts. A continuously running Django
  service plus MySQL may exceed free credit; inspect the projected usage first.
- Railway's documented Free/Trial volume allowance is limited. Availability on
  the actual account must be confirmed before attaching a volume.
- If the available Railway credit cannot support both required services, stop.
  Do not add a payment method or switch to a paid plan without explicit approval.

References: [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Vercel pricing](https://vercel.com/pricing),
[Railway plans](https://docs.railway.com/pricing/plans), and
[Railway free trial](https://docs.railway.com/pricing/free-trial).

## GitHub setup

1. Create an empty private repository named
   `uith-clinical-information-system`.
2. Do not generate a README, licence, or `.gitignore` on GitHub.
3. Add the repository URL as `origin` and push `main`.
4. Confirm `.github/workflows/ci.yml` passes before provider deployment.
5. Suggested topics: `django`, `django-rest-framework`, `react`,
   `redux-toolkit`, `mysql`, `mariadb`, `healthcare`,
   `electronic-health-record`, `clinic-management`,
   `role-based-access-control`, and `health-informatics`.

Do not make the repository public until the privacy scan, CI, hosted workflow,
disclaimer, and demo-credential checks all pass.

## Railway MySQL

1. Create one Railway project and inspect its plan/credit information first.
2. Add a MySQL database service, not PostgreSQL.
3. Keep the database and Django service in the same project/environment.
4. Reference the generated MySQL variables from the Django service rather than
   copying them into source code.
5. Map Railway values to `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and
   `DB_PORT`. Use the private service hostname for `DB_HOST`.
6. Do not import the private local SQL backup.

Railway commonly exposes `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`,
`MYSQLHOST`, and `MYSQLPORT`; map those values through Railway variable
references. Names can vary, so verify the variables shown by the created MySQL
service rather than guessing values.

## Railway backend

Create a GitHub-backed service with:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build method | `backend/Dockerfile` |
| Config file | `backend/railway.json` |
| Start command | Docker `CMD`: `gunicorn backend.wsgi:application --bind [::]:${PORT:-8000}` |
| Pre-deploy command | `python manage.py migrate --noinput` |
| Health path | `/health/` |

The Docker build runs `collectstatic`; WhiteNoise serves hashed Django admin,
Swagger, and ReDoc assets. The pre-deploy command runs migrations only. Demo
seeding and purge commands are never part of service startup.

Set these Railway variables using dashboard values, references, or generated
secrets. Values are intentionally omitted here:

```text
DJANGO_SECRET_KEY
DJANGO_DEBUG
DJANGO_ALLOWED_HOSTS
DJANGO_CORS_ALLOWED_ORIGINS
DJANGO_CSRF_TRUSTED_ORIGINS
DB_ENGINE
DB_NAME
DB_USER
DB_PASSWORD
DB_HOST
DB_PORT
DJANGO_USE_PROXY_SSL_HEADER
DJANGO_SECURE_SSL_REDIRECT
DJANGO_SESSION_COOKIE_SECURE
DJANGO_CSRF_COOKIE_SECURE
DJANGO_SECURE_HSTS_SECONDS
DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS
DJANGO_SECURE_HSTS_PRELOAD
DJANGO_API_DOCS_PUBLIC
FRONTEND_URL
SHOW_DEMO_CREDENTIALS
ALLOW_DEMO_ACCOUNTS
ALLOW_DEMO_DATA_PURGE
ALLOW_MEDIA_UPLOADS
DJANGO_EMAIL_BACKEND
DJANGO_DEFAULT_FROM_EMAIL
```

Production boolean values should include `DJANGO_DEBUG=False`, secure HTTPS
cookies, proxy recognition, `SHOW_DEMO_CREDENTIALS=False`, and
`ALLOW_DEMO_DATA_PURGE=False`. Use exact Railway and Vercel hosts: no wildcard
CORS, URL path, or trailing `/api/` in origin variables.

Generate a Railway public domain only for Django. Verify:

```text
https://<railway-domain>/health/
https://<railway-domain>/swagger/
https://<railway-domain>/redoc/
```

Swagger and ReDoc require administrator authentication when debug and public
documentation flags are disabled.

## Vercel frontend

Import the same GitHub repository into Vercel with:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Create React App |
| Node | 20 |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `build` |
| Environment variable | `REACT_APP_BASE_URL=https://<railway-domain>/api/` |

`frontend/vercel.json` supplies the SPA fallback so direct React Router refreshes
return `index.html`, while paths beginning with `/api` are excluded. Static files
retain filesystem precedence. Redeploy after changing `REACT_APP_BASE_URL`
because Create React App embeds it at build time.

After Vercel assigns the production domain, update Railway:

```text
DJANGO_CORS_ALLOWED_ORIGINS=https://<vercel-domain>
DJANGO_CSRF_TRUSTED_ORIGINS=https://<vercel-domain>
FRONTEND_URL=https://<vercel-domain>
```

Then redeploy Django and verify login, JWT refresh, logout, wrong-portal
rejection, and browser console/network output without exposing tokens.

## Database initialization

Migrations run in Railway's pre-deploy phase. Confirm logs show success, then
open a one-off Railway shell for controlled initialization:

```bash
python manage.py showmigrations
python manage.py bootstrap_admin
python manage.py seed_demo_data
```

`bootstrap_admin` prompts privately for a password. Do not put the password in
the command, README, deployment report, or provider logs. Enable
`ALLOW_DEMO_ACCOUNTS=True` only while deliberately seeding controlled synthetic
accounts if the command requires it, then return it to `False`. Keep
`SHOW_DEMO_CREDENTIALS=False` for public hosting. Run the seed command twice in
a controlled verification only if confirming idempotency, then compare counts.

## Static and media files

- `STATIC_ROOT`: `/app/static` in the Railway container.
- WhiteNoise serves collected static files from the immutable image.
- `MEDIA_ROOT`: `/app/media`.
- Patient photographs and embedded record images are limited to 5 MB and to
  JPEG, PNG, or WebP.
- WhiteNoise does not provide durable user-upload storage.

The initial safe deployment uses `ALLOW_MEDIA_UPLOADS=False`. If the current
Railway plan permits a volume, mount it at `/app/media`, define a reviewed media
serving strategy, test upload/retrieval, redeploy, and verify the file still
exists before setting `ALLOW_MEDIA_UPLOADS=True`. Do not claim persistence from
volume creation alone.

## Email status

The console email backend is local-development behavior and does not deliver
production reset messages. Password changes and administrator-issued temporary
passwords remain available. Configure no paid email provider without approval,
and do not claim password-reset delivery until a real message has been tested.

## Verification

Run locally before each release:

```powershell
cd backend
python manage.py check
python manage.py check --deploy
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py collectstatic --noinput

cd ..\frontend
npm.cmd ci
npm.cmd test -- --runInBand --watchAll=false
npm.cmd run build
```

Hosted checks must cover HTTP 200 for Vercel and `/health/`, HTTPS API calls,
direct route refresh, hidden demo credentials, all five logins, the complete
synthetic receptionist-to-nurse-to-doctor-to-student workflow, repeat intake,
and forbidden cross-role actions. Record factual results in
`RELEASE_CHECKLIST.md`.

## Future updates

```powershell
git checkout -b fix/<name>
# make the focused change
cd backend
python manage.py check
python manage.py test
cd ..\frontend
npm.cmd test -- --runInBand --watchAll=false
npm.cmd run build
cd ..
git add .
git commit -m "<message>"
git push -u origin fix/<name>
```

Open a pull request, wait for CI, merge to `main`, then verify both provider
deployments and the health endpoint. Never automate demo purge, destructive data
changes, or production database restoration.

## Rollback

- Vercel: promote a known-good deployment from deployment history.
- Railway backend: roll back to a known-good deployment or redeploy a stable
  Git tag.
- Git: create a normal revert commit; do not rewrite shared `main` casually.
- Database: inspect every reverse migration for data loss. Do not reverse a data
  migration or restore the private SQL backup automatically. Confirm the target
  environment and take a fresh production backup before an authorized restore.

## Troubleshooting

- `DisallowedHost`: correct `DJANGO_ALLOWED_HOSTS` with the hostname only.
- CORS failure: use the exact Vercel HTTPS origin without paths.
- CSRF failure: use the same exact origin in `DJANGO_CSRF_TRUSTED_ORIGINS`.
- Frontend calls localhost: update `REACT_APP_BASE_URL` and redeploy Vercel.
- `/api/api/`: set `REACT_APP_BASE_URL` once, ending in `/api/`.
- Static 404: inspect Docker `collectstatic` output and WhiteNoise middleware.
- Database connection failure: verify private Railway references and service
  environment; never substitute local `127.0.0.1` in production.
- Health check passes but login fails: inspect migration and MySQL connection
  logs because `/health/` is intentionally a liveness endpoint.
