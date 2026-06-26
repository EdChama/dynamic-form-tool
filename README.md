# Dynamic Form Builder Engine

Docker-first full-stack implementation for Assignment A: Dynamic Form Builder Engine.

## Services

- `backend-api`: CodeIgniter 4 REST API for form templates, immutable form versions, validation, submissions, and audit logging.
- `frontend-app`: React + TypeScript + Vite dynamic form renderer and admin form builder.
- `postgres`: PostgreSQL 16 database using JSONB for dynamic schemas and payloads.

## Local Docker Setup

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Start the stack:

   ```bash
   docker compose up --build
   ```

   The backend runs migrations before Apache starts when `AUTO_MIGRATE=true`, which is the Docker default. This prevents the frontend from loading against an older database schema.

3. Open:

   - Frontend: http://localhost:5173
   - Backend health endpoint: http://localhost:8080/api/health

4. Run backend migrations and seed data:

   ```bash
   docker compose exec backend php spark migrate
   docker compose exec backend php spark db:seed DatabaseSeeder
   ```

## Development Commands

Backend:

```bash
docker compose exec backend composer install
docker compose exec backend php spark migrate
docker compose exec backend php spark db:seed DatabaseSeeder
docker compose exec backend vendor/bin/phpunit
```

Frontend:

```bash
docker compose exec frontend npm install
docker compose exec frontend npm run dev
docker compose exec frontend npm run test
docker compose exec frontend npm run build
```

## API Overview

- `GET /api/health`: service health check
- `POST /api/auth/login`: issue a short-lived bearer token for an admin/form manager
- `GET /api/auth/me`: inspect the authenticated user
- `GET /api/notifications`: list current user's in-app notifications
- `POST /api/notifications/{id}/read`: mark an in-app notification as read
- `GET /api/admin/users`: admin-only user directory
- `GET /api/admin/forms`: list forms editable by the current user
- `POST /api/admin/forms`: create a draft form/template
- `PUT /api/admin/forms/{id}`: create a new draft version for an existing form
- `GET /api/admin/forms/{id}/versions`: list immutable saved versions
- `GET /api/admin/forms/{id}/versions/{versionId}`: view one saved version with schema and validation metadata
- `GET /api/admin/forms/{id}/submissions`: list submissions for an editable form
- `POST /api/admin/forms/{id}/publish`: publish the latest version
- `DELETE /api/admin/forms/{id}`: soft-delete/archive an editable form
- `GET /api/forms`: list completed public forms
- `GET /api/forms/{slug}`: retrieve a completed public or restricted-link form schema
- `POST /api/forms/{slug}/submissions`: validate and store a submission
- `GET /api/forms/{slug}/submissions`: list submissions for a form
- `GET /api/submissions/{id}`: view a submission

## Data Model

The database separates a form's logical identity from immutable schema versions:

- `form_templates`: form identity, slug, lifecycle status, access level, restricted-link key, and ownership metadata.
- `form_template_versions`: immutable schema/UI/validation snapshots with checksum and publish metadata.
- `form_fields`: normalized field metadata extracted from schema versions.
- `form_submissions`: full submitted payloads linked to the exact version used.
- `submission_field_values`: optional relational values for indexed reporting.
- `audit_logs`: major form and submission events.
- `notifications`: email and in-app notification records for form lifecycle changes and submissions.

Full schema notes are in [docs/DESIGN_NOTES.md](docs/DESIGN_NOTES.md).

## Validation Strategy

Frontend validation is used for fast feedback only. Backend validation is authoritative and evaluates the payload against the stored published form version that was completed and available at submission time.

Validation supports required fields, string, number, boolean, enum/select, min/max string length, min/max numeric values, date format, and email format.

## Form Builder Strategy

Admin users and form managers can design forms in the frontend builder. A form definition includes:

- form name, slug, header title, description, and submit button label
- field key, label, type, placeholder, select options, and validation rules
- actions, starting with `store_submission`

Saving a form creates an immutable version. Publishing marks the latest version `completed` for submission. Editing a completed form creates a new immutable version instead of changing old submissions.
Deleting a form archives it with `deleted_at`; historical submissions remain stored for audit integrity.
Each saved version can include a version description explaining what changed or what the copy is for. In the Builder, creators can select a saved version, load it as an editable copy, and preview the field order, labels, types, options, and validation rules.

Creators set availability through:

- `draft`: editable, not publicly available
- `completed`: available when paired with a published version and suitable access level
- `archived`: retained for history, not publicly available
- `expired`: no longer publicly available

Creators set access through:

- `public`: appears in the public form list
- `private`: hidden from public form APIs
- `restricted`: available only with the generated `access_key` link, such as `/?form=form-slug&access_key=...`

## Assessment Coverage

- Data modelling: PostgreSQL stores form templates/configurations in JSONB, immutable form versions, normalized field metadata, submissions, submission field values, audit logs, and notifications.
- Validation strategy: `DynamicValidationService` reads validation rules from each stored schema at runtime instead of hardcoding field-specific rules.
- Frontend: React fetches stored form configurations, renders fields dynamically, validates client-side for fast feedback, submits to the backend, and displays loading, error, success, and notification states.
- Backend interface: REST endpoints expose authentication, form builder operations, public/restricted form rendering, submissions, notifications, version previews, and audit-oriented reads.

## Notification Strategy

The backend creates notifications for form creation, draft version saves, publishing, archive/delete actions, and public submissions. Each recipient gets:

- an `email` notification row with delivery status and provider response
- an `in_app` notification row when the recipient is a system user

Local Docker uses `MAIL_TRANSPORT=log`, which records email notifications as sent without contacting an external mail service. Set `MAIL_TRANSPORT=mail`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, and `ADMIN_NOTIFICATION_EMAILS` for a host configured with PHP `mail()`. Production deployments should replace or extend this transport with the approved SMTP/API provider.

The frontend shows toast popups after submissions and builder actions, and signed-in admins/form managers can view and mark recent in-app notifications from the Notifications page.
Signed-in users work from a left-navigation workspace: Forms, Users, and Notifications. The Forms page shows the current user's editable forms, the builder/editor, current draft preview, saved version dropdown, field order controls, and submissions for the selected form. Public users see a form-filling view with a toggle for admin login.

Seeded local credentials:

- `admin@example.com` / `password123`
- `manager@example.com` / `password123`

## Role and Auth Strategy

The backend includes `codeigniter4/shield` as the CI4 auth/role foundation dependency. The current Docker API uses a Shield-aligned bearer-token flow with `users`, `auth_tokens`, and roles:

- `admin`: can edit all forms and publish all versions
- `form_manager`: can create forms and edit forms they created
- `viewer`: reserved for read-only admin views

Only the creator of a form, or an admin, can edit and publish that form.

## Historical Integrity

Submissions always store:

- `form_template_id`
- `form_template_version_id`
- full payload JSON
- validation snapshot JSON
- audit metadata including IP, user agent, and timestamp

Existing versions are never mutated after use. See [docs/AUDIT.md](docs/AUDIT.md).

## Security Notes

- Secrets are read from environment variables.
- CORS is restricted through `CORS_ALLOWED_ORIGINS`.
- Local Docker allows both `http://localhost:5173` and `http://127.0.0.1:5173` so either browser URL can load forms.
- Admin communication uses bearer tokens in the `Authorization` header.
- Production deployments must use HTTPS between browser, frontend host, and backend API.
- Backend JSON payload size is configurable through `JSON_MAX_BYTES`.
- Database writes go through service/model layers.
- Error responses are structured and avoid stack traces in production.
- Public identifiers use UUIDs.

## Deployment Notes

For production:

- Use strong database credentials and managed secret storage.
- Set `CI_ENVIRONMENT=production`.
- Restrict `CORS_ALLOWED_ORIGINS` to the deployed frontend domain.
- Place the backend behind HTTPS and a reverse proxy.
- Keep `AUTO_MIGRATE=true` for simple Docker deployments, or set `AUTO_MIGRATE=false` only when CI/CD runs `php spark migrate` before routing traffic to the backend.
- Persist PostgreSQL with managed storage or a managed database service.

## Branch and CI/CD Strategy

Create and protect these long-lived branches in GitHub:

- `test`: CI deploys to the test/staging environment after automated checks pass.
- `production`: CI deploys to production after review and promotion from `test`.

Suggested flow:

1. Work on `codex/*` or feature branches.
2. Open a pull request into `test`.
3. Run backend tests, frontend tests, frontend build, Docker build, and security audit.
4. Merge `test` into `production` for production release.

The included GitHub Actions workflow at `.github/workflows/ci.yml` runs backend tests, frontend tests, frontend build, and Docker build on pull requests and pushes to `test` and `production`.

## Trade-offs

This build starts with unauthenticated public form submission because authentication is optional in the assignment. The schema includes user ownership columns so auth can be added cleanly later.

## AI Tools Used

Codex was used to scaffold and implement the project. Developer verification should include Docker startup, migrations, seed data, API tests, frontend tests, and a manual submission through the UI before GitHub submission.
