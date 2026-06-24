# Audit and Historical Integrity

Historical integrity is preserved by making form versions immutable.

When a submission is created, the backend:

1. Fetches the active published version for the requested form slug.
2. Validates the payload against that exact version.
3. Stores the submission with `form_template_id`, `form_template_version_id`, full payload JSON, validation snapshot JSON, client IP, user agent, and timestamp.
4. Writes an audit log entry for the submission event.

If the form changes later, the system creates a new row in `form_template_versions`. Existing submissions continue to reference the exact version that produced them.

Important audit events:

- `form.created`
- `form.version.created`
- `form.version.published`
- `submission.created`
- `submission.validation_failed`
- `submission.viewed`
- `submission.archived`
- `form.deleted`
