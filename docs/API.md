# API Reference

Base URL in local Docker: `http://localhost:8080/api`.

All API responses use a structured JSON envelope:

```json
{
  "status": "success",
  "message": "Readable outcome",
  "data": {}
}
```

Validation failures return HTTP 422:

```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": {
    "full_name": ["Full name is required"]
  }
}
```

## Endpoints

### GET /health

Returns service availability.

### POST /auth/login

Authenticates an admin or form manager and returns a bearer token.

### GET /auth/me

Returns the authenticated user for a bearer token.

### GET /admin/forms

Lists forms editable by the current admin/form manager.

### POST /admin/forms

Creates a draft form template and first immutable version.

### PUT /admin/forms/{id}

Creates a new draft version for an editable form.

### POST /admin/forms/{id}/publish

Publishes the latest form version.

### GET /forms

Returns active forms with their latest published version summary.

### GET /forms/{slug}

Returns a public form definition for rendering.

### POST /forms/{slug}/submissions

Accepts a JSON object matching the form schema. The backend validates against the active published version and stores the submission with a schema snapshot.

### GET /forms/{slug}/submissions

Lists submissions for a form. Intended for administrative use in later authenticated stages.

### GET /submissions/{id}

Returns a stored submission by UUID.
