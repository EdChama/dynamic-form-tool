# Design Notes

## Architecture

The system is split into three Docker services:

- React/Vite frontend for dynamic rendering and user interaction.
- CodeIgniter 4 backend for REST APIs, validation, persistence, and audit logging.
- PostgreSQL for relational data and JSONB document storage.

## Database Design

The schema uses normal columns for identifiers, lifecycle state, timestamps, relationships, and reporting-friendly fields. Dynamic form schema and submission payloads are stored in JSONB.

Form versioning is intentionally explicit:

- `form_templates` stores form identity, lifecycle status, access level, restricted-link key, and ownership.
- `form_template_versions` stores immutable schema versions.
- `form_submissions` references both the template and exact immutable version.

This prevents a later form edit from changing the meaning of an older submission.

Each version can include a human description of the change or intended use. The editor treats saved versions as immutable copies: users can select a version, preview its field placement and validation rules, and load it into the editor to create a new version.

## Service Boundaries

Controllers should remain thin and delegate to services:

- `FormTemplateService`: public form discovery and version lookup.
- `SubmissionService`: submission creation/listing and audit metadata.
- `DynamicValidationService`: schema-driven backend validation.
- `AuditLogService`: append-only system event recording.

## Availability and Access

Form creators control lifecycle with `draft`, `completed`, `archived`, and `expired`.
Only `completed` forms with a published version can accept public submissions.

Access is explicit:

- `public` forms are listed and can be fetched by slug.
- `private` forms remain hidden from public form APIs.
- `restricted` forms are available only through a link containing the generated `access_key`.

## Future Improvements

- Add rate limiting middleware backed by Redis.
- Add field-level indexing configuration in the schema editor.
- Add deployment manifests for a production hosting target.
