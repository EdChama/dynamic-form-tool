# Codex Build Instructions: Dynamic Form Builder Engine

Build a production-quality full-stack system for Assignment A: Dynamic Form Builder Engine.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: CodeIgniter 4 REST API
- Database: PostgreSQL
- Packaging: Docker + docker-compose
- Testing: backend tests and frontend tests
- Deployment-ready: environment-based config, no hardcoded secrets

## Core Goal

Create a configuration-driven form engine that can:

1. Store dynamic form templates/configurations.
2. Render forms dynamically in React.
3. Validate submissions dynamically from the stored rules.
4. Store submissions linked to the exact form version that produced them.
5. Preserve historical integrity when form templates change.

## Non-Negotiable Principles

- Keep code clean, cohesive, typed, and consistent.
- Prioritize security throughout.
- Validate on both frontend and backend, but backend validation is final authority.
- Never hardcode field-specific business rules in controller logic.
- Use services for business logic, not fat controllers.
- Use migrations and seeders.
- Use structured API responses.
- Add tests as features are built.
- Commit in fully working stages.
- Maintain a clear README throughout development.

## Required Project Structure

```text
rift-dynamic-form-engine/
|-- backend/
|-- frontend/
|-- docker-compose.yml
|-- README.md
|-- docs/
|   |-- API.md
|   |-- DESIGN_NOTES.md
|   |-- SECURITY.md
|   `-- AUDIT.md
`-- .gitignore
```

## Backend Requirements

Create a CodeIgniter 4 API with:

- Form template CRUD where appropriate.
- Public form retrieval endpoint.
- Submission creation endpoint.
- Submission listing/viewing endpoint.
- Dynamic validation service.
- Submission service.
- Form schema/versioning service.
- Centralized error handling.
- Input sanitization.
- CORS configuration.
- Secure environment config.

Minimum API routes:

```text
GET  /api/forms
GET  /api/forms/{slug}
POST /api/forms/{slug}/submissions
GET  /api/forms/{slug}/submissions
GET  /api/submissions/{id}
```

## Database Design Requirements

Design the database for scalability, versioning, auditability, and historical integrity.

Use PostgreSQL with JSONB where dynamic structure is required, but keep important searchable and relational data in normal columns.

### Core Tables

#### form_templates

Stores the logical identity of a form.

```text
id UUID primary key
slug varchar(150) unique not null
name varchar(255) not null
description text null
status varchar(30) not null default 'draft'
created_by UUID null
created_at timestamptz not null
updated_at timestamptz not null
deleted_at timestamptz null
```

Status values:

```text
draft
active
archived
```

#### form_template_versions

Stores immutable versions of each form schema.

```text
id UUID primary key
form_template_id UUID not null references form_templates(id)
version_number int not null
schema_json JSONB not null
ui_schema_json JSONB null
validation_schema_json JSONB null
checksum varchar(128) not null
is_published boolean not null default false
published_at timestamptz null
created_by UUID null
created_at timestamptz not null
```

Rules:

```text
unique(form_template_id, version_number)
unique(form_template_id, checksum)
```

Once a version has submissions, never edit it. Create a new version instead.

#### form_fields

Optional but recommended for indexing and reporting.

Stores normalized field metadata extracted from each schema version.

```text
id UUID primary key
form_template_version_id UUID not null references form_template_versions(id)
field_key varchar(150) not null
label varchar(255) not null
field_type varchar(50) not null
is_required boolean not null default false
sort_order int not null default 0
config_json JSONB null
created_at timestamptz not null
```

Rules:

```text
unique(form_template_version_id, field_key)
```

#### form_submissions

Stores submitted form responses.

```text
id UUID primary key
form_template_id UUID not null references form_templates(id)
form_template_version_id UUID not null references form_template_versions(id)
submission_reference varchar(100) unique not null
payload_json JSONB not null
validation_snapshot_json JSONB not null
status varchar(30) not null default 'submitted'
submitted_by UUID null
client_ip inet null
user_agent text null
created_at timestamptz not null
updated_at timestamptz not null
deleted_at timestamptz null
```

Status values:

```text
submitted
validated
flagged
archived
```

Important rule:

```text
A submission must always reference the exact immutable form_template_version_id used at submission time.
```

#### submission_field_values

Optional but useful for scalable search/reporting.

Stores selected field values in relational form while keeping the full payload in JSONB.

```text
id UUID primary key
form_submission_id UUID not null references form_submissions(id) on delete cascade
field_key varchar(150) not null
value_text text null
value_number numeric null
value_boolean boolean null
value_date date null
value_json JSONB null
created_at timestamptz not null
```

Rules:

```text
unique(form_submission_id, field_key)
```

Use this table only for fields that need filtering, reporting, or indexing.

#### audit_logs

Stores important system events.

```text
id UUID primary key
entity_type varchar(100) not null
entity_id UUID not null
action varchar(100) not null
old_values JSONB null
new_values JSONB null
metadata JSONB null
performed_by UUID null
client_ip inet null
user_agent text null
created_at timestamptz not null
```

Example actions:

```text
form.created
form.version.created
form.version.published
submission.created
submission.validation_failed
submission.viewed
submission.archived
```

### Optional User Table

If authentication is added, use:

```text
users
- id UUID primary key
- name varchar(150) not null
- email varchar(255) unique not null
- password_hash varchar(255) not null
- role varchar(50) not null
- is_active boolean not null default true
- created_at timestamptz not null
- updated_at timestamptz not null
```

Roles:

```text
admin
form_manager
viewer
```

## Indexing Requirements

Create indexes for expected access patterns:

```text
form_templates.slug
form_templates.status
form_template_versions.form_template_id
form_template_versions.form_template_id + version_number
form_template_versions.is_published
form_submissions.form_template_id
form_submissions.form_template_version_id
form_submissions.submission_reference
form_submissions.status
form_submissions.created_at
submission_field_values.field_key
submission_field_values.value_text
submission_field_values.value_number
audit_logs.entity_type + entity_id
audit_logs.created_at
```

Add GIN indexes for JSONB where useful:

```text
form_template_versions.schema_json
form_submissions.payload_json
audit_logs.metadata
```

## Design Rules

- Use UUIDs for public-facing identifiers.
- Use soft deletes for forms and submissions.
- Keep form versions immutable.
- Store full submission payloads in JSONB.
- Store searchable/reportable field values separately when needed.
- Never rely only on frontend validation.
- Backend validation must use the stored schema version.
- Store validation snapshots with each submission.
- Store audit logs for major actions.
- Use timestamps consistently with timezone.
- Use foreign keys for all relationships.
- Use database constraints where possible.
- Avoid storing secrets or sensitive config in the database.

## Historical Integrity Rule

When a user submits a form:

1. Fetch the active published form version.
2. Validate payload against that exact version.
3. Store the submission with:
   - `form_template_id`
   - `form_template_version_id`
   - `payload_json`
   - `validation_snapshot_json`
   - audit metadata
4. Never mutate the version used by that submission.

If the form changes later, create a new row in `form_template_versions`.

## Recommended PostgreSQL Types

Use:

```text
UUID for IDs
JSONB for dynamic schemas and payloads
timestamptz for timestamps
inet for IP addresses
numeric for decimal numbers
varchar for constrained strings
text for long free-form values
boolean for flags
```

## Migration Expectations

Create migrations in this order:

```text
001_create_users_table
002_create_form_templates_table
003_create_form_template_versions_table
004_create_form_fields_table
005_create_form_submissions_table
006_create_submission_field_values_table
007_create_audit_logs_table
008_create_indexes
```

## Seed Data

Add at least one production-like seed form:

```text
Beneficial Ownership Declaration Form
```

Include fields such as:

```text
full_name
email
date_of_birth
nationality
ownership_percentage
is_politically_exposed
relationship_to_company
supporting_notes
```

Seed at least:

```text
1 draft form
1 active published form version
2 sample submissions
```

## Validation Requirements

Implement a dynamic validation engine that reads rules from `schema_json`.

Support at minimum:

- required fields
- string
- number
- boolean
- select/enum
- minLength
- maxLength
- minimum
- maximum
- date format
- email format

Return validation errors as structured JSON:

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "full_name": ["Full name is required"]
  }
}
```

## Frontend Requirements

Create a modern, beautiful, responsive React UI.

Frontend must:

- Fetch available forms.
- Render selected form dynamically.
- Support text, textarea, number, select, checkbox, date, and email fields.
- Show loading states.
- Show validation errors clearly.
- Show success state after submission.
- Use accessible labels and error messages.
- Keep components small and reusable.
- Use TypeScript types for schemas, fields, API responses, and submissions.

Suggested frontend structure:

```text
frontend/src/
|-- api/
|-- components/
|   |-- layout/
|   `-- forms/
|-- pages/
|-- types/
|-- utils/
`-- tests/
```

## UI Quality

Design a clean professional interface suitable for a technical assessment:

- modern dashboard-style layout
- clear form cards
- good spacing
- readable typography
- responsive mobile layout
- visible error/success states
- no clutter
- consistent styling

Use Tailwind CSS or clean CSS modules.

## Security Requirements

Implement and document:

- environment variables for secrets
- no hardcoded credentials
- CORS restricted by environment
- server-side validation on every submission
- JSON payload size limits
- database-safe writes through models/query builder
- escaped output on frontend
- clear error responses without leaking stack traces
- basic rate-limit strategy documented, even if not fully implemented
- audit metadata: IP address and user agent on submissions

## Testing Requirements

Add tests continuously.

Backend tests:

- valid submission is accepted
- missing required field returns 422
- invalid type returns 422
- invalid enum returns 422
- unknown form returns 404
- submission stores correct form version
- submission stores schema snapshot

Frontend tests:

- form renders from schema
- required field errors display
- successful submit displays success message
- API error displays error state

## Auditing Requirements

At minimum, audit submission metadata:

- form template ID
- form version
- schema snapshot
- client IP
- user agent
- created timestamp

Also create `docs/AUDIT.md` explaining how historical integrity is preserved.

## Versioned Build Stages

Work in complete, testable stages. Each stage must leave the app runnable.

### Stage 1: Project scaffold

- Create backend, frontend, Docker structure.
- Add README setup skeleton.
- App should start locally.

Commit message:

```text
chore: scaffold full-stack dynamic form engine
```

### Stage 2: Database and seed data

- Add migrations.
- Add seed form template.
- Connect backend to PostgreSQL.
- Verify migrations run in Docker.

Commit message:

```text
feat: add form template and submission data model
```

### Stage 3: Backend API

- Add form retrieval endpoints.
- Add submission endpoint.
- Add structured responses.

Commit message:

```text
feat: implement dynamic form API endpoints
```

### Stage 4: Dynamic validation

- Add validation service.
- Add backend validation tests.
- Ensure invalid submissions return 422.

Commit message:

```text
feat: add schema-driven validation engine
```

### Stage 5: React dynamic renderer

- Build frontend layout.
- Fetch form config.
- Render fields dynamically.
- Submit form data.

Commit message:

```text
feat: build React dynamic form renderer
```

### Stage 6: UI polish and error states

- Improve styling.
- Add loading, error, success states.
- Improve accessibility.

Commit message:

```text
feat: polish UI states and accessibility
```

### Stage 7: Testing and hardening

- Add backend and frontend tests.
- Review security.
- Add docs.

Commit message:

```text
test: add coverage for validation and form submission
```

### Stage 8: Deployment packaging

- Finalize Docker.
- Add production env examples.
- Finalize README.
- Add deployment notes.

Commit message:

```text
docs: finalize submission documentation and deployment guide
```

## README Must Include

- Live demo URL placeholder
- Local setup
- Docker commands
- Test commands
- API overview
- Data model
- Validation strategy
- Historical integrity strategy
- Security notes
- Trade-offs
- What would be improved with more time
- AI tools used and what was personally verified

## Final Output

At the end, the project must be:

- runnable with Docker
- hosted-ready
- tested
- documented
- secure by default
- visually polished
- suitable for GitHub submission
