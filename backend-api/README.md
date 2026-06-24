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
| `CORS_ALLOWED_ORIGINS` | Comma-separated browser origins | `http://localhost:5173` |
| `JSON_MAX_BYTES` | Max JSON request size | `1048576` |

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

Seed data is in `database/seeds/001_beneficial_ownership_form.sql`.

## API Routes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Service health |
| `POST` | `/api/auth/login` | Issue bearer token |
| `GET` | `/api/auth/me` | Current authenticated user |
| `GET` | `/api/admin/forms` | List editable forms for admin/form manager |
| `POST` | `/api/admin/forms` | Create draft form and version |
| `PUT` | `/api/admin/forms/{id}` | Create new draft version |
| `GET` | `/api/admin/forms/{id}/versions` | List immutable saved versions |
| `GET` | `/api/admin/forms/{id}/versions/{versionId}` | View one version with schema preview data |
| `POST` | `/api/admin/forms/{id}/publish` | Publish latest version |
| `DELETE` | `/api/admin/forms/{id}` | Soft-delete/archive editable form |
| `GET` | `/api/forms` | List active forms |
| `GET` | `/api/forms/{slug}` | Get active published form schema |
| `POST` | `/api/forms/{slug}/submissions` | Validate and store submission |
| `GET` | `/api/forms/{slug}/submissions` | List submissions for a form |
| `GET` | `/api/submissions/{id}` | View one submission |

## Validation

`DynamicValidationService` validates request payloads against the stored `schema_json` for the active published form version.

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

Each version stores `version_description` in addition to `schema_json`, `ui_schema_json`, `validation_schema_json`, checksum, publish state, and timestamps. The version detail endpoint returns a normalized builder definition so the frontend can load any saved version as an editable copy while preserving the original immutable row.

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

The API always fetches the active published version, validates against it, and stores the exact version ID on the submission. Published versions should not be edited after use; create a new version row instead.

## Deployment Notes

For production:

- Set `CI_ENVIRONMENT=production`.
- Use secret-managed database credentials.
- Restrict `CORS_ALLOWED_ORIGINS`.
- Use HTTPS for frontend/backend communication.
- Keep bearer tokens out of logs and URLs.
- Run `composer install --no-dev --optimize-autoloader`.
- Run migrations as a release step.
- Put Apache/PHP behind HTTPS.
- Add authentication before exposing submission list/view endpoints publicly.
