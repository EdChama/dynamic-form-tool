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

### GET /notifications

Returns the current user's most recent in-app notifications. Requires a bearer token.

### POST /notifications/{id}/read

Marks one current-user in-app notification as read and sets `read_at`. Requires a bearer token.

### GET /admin/users

Returns the admin-only user directory with role and active status.

### GET /admin/forms

Lists forms editable by the current admin/form manager.

### POST /admin/forms

Creates a draft form template and first immutable version.

### PUT /admin/forms/{id}

Creates a new draft version for an editable form.

### GET /admin/forms/{id}/versions

Lists immutable versions for an editable form, including version number, description, checksum, publish status, and timestamps.

### GET /admin/forms/{id}/versions/{versionId}

Returns one immutable version with schema, UI schema, validation schema, and a normalized builder definition for preview/copy editing.

### GET /admin/forms/{id}/submissions

Returns submissions for a form the current user can administer. Admins can view all form submissions; form managers can view submissions for forms they created.

### POST /admin/forms/{id}/publish

Publishes the latest form version.

### DELETE /admin/forms/{id}

Soft-deletes an editable form by archiving it and setting `deleted_at`.

### GET /forms

Returns completed public forms with their latest published version summary.

### GET /forms/{slug}

Returns a completed public form definition for rendering. Restricted forms require `?access_key={access_key}`.

### POST /forms/{slug}/submissions

Accepts a JSON object matching the form schema. The backend validates against the completed published version available to the caller and stores the submission with a schema snapshot. Restricted forms require `?access_key={access_key}`.

### GET /forms/{slug}/submissions

Legacy slug-based submission list. The frontend admin workspace uses the authenticated `/admin/forms/{id}/submissions` route.

### GET /submissions/{id}

Returns a stored submission by UUID.
