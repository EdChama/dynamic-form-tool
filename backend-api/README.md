# Backend API

CodeIgniter-oriented PHP REST API for the Dynamic Form Builder Engine.

## Runtime

- PHP 8.3
- Apache with `mod_rewrite`
- PostgreSQL via PDO
- Composer dependencies, including `codeigniter4/framework` and `codeigniter4/shield`

## Docker Development

From the repository root:

```bash
docker compose up --build backend postgres
```

The backend image runs `php spark migrate` before Apache starts when `AUTO_MIGRATE=true`. Keep this enabled for simple Docker deployments so `/api/forms` cannot start against a stale schema.

Run migrations:

```bash
docker compose exec backend php spark migrate
```

Seed the Beneficial Ownership form:

```bash
docker compose exec backend php spark db:seed
```

Health check:

```bash
curl http://localhost:8080/api/health
```

The health payload includes `schema_ready`. It should be `true` before routing frontend traffic to the API.

## Environment Variables

| Variable | Purpose | Local default |
| --- | --- | --- |
| `CI_ENVIRONMENT` | Runtime environment name | `development` |
| `APP_BASE_URL` | Backend public URL | `http://localhost:8080` |
| `DB_HOST` | PostgreSQL host | `postgres` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_DATABASE` | Database name | `dynamic_forms` |
| `DB_USERNAME` | Database user | `dynamic_forms_app` |
| `DB_PASSWORD` | Database password | `change_me_for_local_dev` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins | `http://localhost:5173,http://127.0.0.1:5173` |
| `JSON_MAX_BYTES` | Max JSON request size | `1048576` |
| `MAIL_TRANSPORT` | Email transport, `log` or `mail` | `log` |
| `MAIL_FROM_EMAIL` | Sender address for system emails | `no-reply@dynamic-forms.local` |
| `MAIL_FROM_NAME` | Sender display name | `Dynamic Forms` |
| `ADMIN_NOTIFICATION_EMAILS` | Comma-separated extra admin recipients outside the users table | empty |
| `AUTO_MIGRATE` | Run migrations during backend container startup | `true` |
| `AUTO_SEED` | Run seed data during backend container startup | `false` |

## Database Commands

The `spark` script currently supports the project commands needed for Docker development:

```bash
php spark migrate
php spark db:seed
php spark serve
```

Migrations are plain SQL files in `database/migrations` and are ordered according to the senior schema requirements:

1. `001_create_users_table.sql`
2. `002_create_form_templates_table.sql`
3. `003_create_form_template_versions_table.sql`
4. `004_create_form_fields_table.sql`
5. `005_create_form_submissions_table.sql`
6. `006_create_submission_field_values_table.sql`
7. `007_create_audit_logs_table.sql`
8. `008_create_indexes.sql`
9. `009_create_auth_tokens_table.sql`
10. `010_add_version_descriptions.sql`
11. `011_create_notifications_table.sql`
12. `012_update_form_lifecycle_access.sql`

Seed data is in `database/seeds/001_beneficial_ownership_form.sql`.

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health |
| `POST` | `/api/auth/login` | Issue bearer token |
| `GET` | `/api/auth/me` | Current authenticated user |
| `GET` | `/api/notifications` | Current user's recent in-app notifications |
| `POST` | `/api/notifications/{id}/read` | Mark a current-user notification as read |
| `GET` | `/api/admin/users` | Admin-only user directory with role and active state |
| `GET` | `/api/admin/forms` | List editable forms for admin/form manager |
| `POST` | `/api/admin/forms` | Create draft form and version |
| `PUT` | `/api/admin/forms/{id}` | Create new draft version |
| `GET` | `/api/admin/forms/{id}/versions` | List immutable saved versions |
| `GET` | `/api/admin/forms/{id}/versions/{versionId}` | View one version with schema preview data |
| `GET` | `/api/admin/forms/{id}/submissions` | List submissions for an editable form |
| `POST` | `/api/admin/forms/{id}/publish` | Publish latest version |
| `DELETE` | `/api/admin/forms/{id}` | Soft-delete/archive editable form |
| `GET` | `/api/forms` | List completed public forms |
| `GET` | `/api/forms/{slug}` | Get completed public or restricted-link form schema |
| `POST` | `/api/forms/{slug}/submissions` | Validate and store submission |
| `GET` | `/api/forms/{slug}/submissions` | Legacy/public submission list for a form; prefer authenticated admin route |
| `GET` | `/api/submissions/{id}` | View one submission |

## Validation

`DynamicValidationService` validates request payloads against the stored `schema_json` for the completed published form version.

Supported rules:

- required
- string-compatible inputs: text, textarea, email, date, select
- number
- boolean/checkbox
- select enum options
- minLength/maxLength
- minimum/maximum
- date format as `YYYY-MM-DD`
- email format

Backend validation is authoritative. Frontend validation is convenience only.

## Form Builder and Ownership

Authenticated admins and form managers can create form templates and fields from the frontend builder. The backend stores:

- logical form metadata in `form_templates`
- immutable versioned schemas in `form_template_versions`
- normalized field metadata in `form_fields`
- full submissions and searchable values in `form_submissions` and `submission_field_values`

Editing a form creates a new version. The original version remains available for old submissions. A `form_manager` can only edit forms where `created_by` matches their user ID. An `admin` can edit and publish any form.
Deleting a form sets `status = archived` and `deleted_at = now()`. It does not delete submissions or version snapshots.
Submission review is available through `GET /api/admin/forms/{id}/submissions`. The route is protected by the same ownership policy as editing: admins can view every form's submissions, and form managers can view submissions for forms they created.

Each version stores `version_description` in addition to `schema_json`, `ui_schema_json`, `validation_schema_json`, checksum, publish state, and timestamps. The version detail endpoint returns a normalized builder definition so the frontend can load any saved version as an editable copy while preserving the original immutable row.

Form lifecycle statuses:

- `draft`: editable, not available through public form APIs
- `completed`: available for submission when a version is published
- `archived`: retained for audit history, hidden from public APIs
- `expired`: hidden from public APIs after its availability window or manual expiry

Access levels:

- `public`: listed by `GET /api/forms`
- `private`: hidden from public form APIs
- `restricted`: available only when the caller includes `?access_key={access_key}`

## Notification Service

`NotificationService` records form and submission events in the `notifications` table. It emits:

- `form.created`
- `form.version.created`
- `form.version.published`
- `form.deleted`
- `submission.created`

Recipients include the acting creator/editor, active admins in the `users` table, and any configured addresses in `ADMIN_NOTIFICATION_EMAILS`. System users receive both an `email` row and an `in_app` row. External configured admin addresses receive only an `email` row.

Local Docker defaults to `MAIL_TRANSPORT=log`. This records email notifications as `sent` with a provider response explaining that no external mail service was contacted. `MAIL_TRANSPORT=mail` uses PHP `mail()` with the configured sender values and stores `sent` or `failed` in the database. For production, replace the dispatch method or add an adapter for the approved SMTP/API provider while keeping the same database outbox fields.

## Auth, Roles, and CI4 Shield

The project includes CI4 Shield as the auth/role foundation package:

```bash
composer show codeigniter4/shield
```

For this Docker-first API stage, a compact bearer-token layer is implemented in `AuthService` using Shield-style concepts:

- `users` stores identity, password hash, role, and active status.
- `auth_tokens` stores hashed bearer tokens with expiry.
- role checks protect admin form-builder routes.

Seeded local accounts:

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `password123` | `admin` |
| `manager@example.com` | `password123` | `form_manager` |

When the project is converted to a full CI4 front-controller/bootstrap, these tables and route policies are ready to be mapped directly to Shield filters/groups/permissions.

## Historical Integrity

Every submission stores:

- `form_template_id`
- `form_template_version_id`
- `payload_json`
- `validation_snapshot_json`
- client IP
- user agent
- created timestamp

The API always fetches the completed published version that is available to the caller, validates against it, and stores the exact version ID on the submission. Published versions should not be edited after use; create a new version row instead.

## Deployment Notes

For production:

- Set `CI_ENVIRONMENT=production`.
- Use secret-managed database credentials.
- Restrict `CORS_ALLOWED_ORIGINS`.
- Use HTTPS for frontend/backend communication.
- Keep bearer tokens out of logs and URLs.
- Run `composer install --no-dev --optimize-autoloader`.
- Run migrations as a release step.
- If `AUTO_MIGRATE=false`, release automation must run `php spark migrate` before frontend traffic reaches the API.
- Put Apache/PHP behind HTTPS.
- Add authentication before exposing submission list/view endpoints publicly.
