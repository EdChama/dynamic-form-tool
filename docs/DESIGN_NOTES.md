# Design Notes

## Architecture

The system is split into three Docker services:

- React/Vite frontend for dynamic rendering and user interaction.
- CodeIgniter 4 backend for REST APIs, validation, persistence, and audit logging.
- PostgreSQL for relational data and JSONB document storage.

## Database Design

The schema uses normal columns for identifiers, lifecycle state, timestamps, relationships, and reporting-friendly fields. Dynamic form schema and submission payloads are stored in JSONB.

Form versioning is intentionally explicit:

- `form_templates` stores form identity.
- `form_template_versions` stores immutable schema versions.
- `form_submissions` references both the template and exact immutable version.

This prevents a later form edit from changing the meaning of an older submission.

## Service Boundaries

Controllers should remain thin and delegate to services:

- `FormTemplateService`: public form discovery and version lookup.
- `SubmissionService`: submission creation/listing and audit metadata.
- `DynamicValidationService`: schema-driven backend validation.
- `AuditLogService`: append-only system event recording.

## Future Improvements

- Add authentication and role-based access control.
- Add admin UI for creating new form versions.
- Add rate limiting middleware backed by Redis.
- Add field-level indexing configuration in the schema editor.
- Add deployment manifests for a production hosting target.
