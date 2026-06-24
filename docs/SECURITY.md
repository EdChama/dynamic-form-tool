# Security Notes

## Current Controls

- Environment variables are used for database credentials and runtime configuration.
- CORS is controlled by `CORS_ALLOWED_ORIGINS`.
- Authenticated admin routes require bearer tokens.
- Bearer tokens are stored hashed in `auth_tokens`.
- Role checks enforce admin/form-manager permissions.
- Backend validation is authoritative for all submissions.
- JSON request size should be capped through `JSON_MAX_BYTES` and web server limits.
- Database writes use parameterized model/query-builder operations.
- User-facing API errors are structured and should avoid stack traces in production.
- Submission audit metadata stores client IP and user agent.

## Production Hardening Checklist

- Set `CI_ENVIRONMENT=production`.
- Rotate database credentials and store them in a secret manager.
- Serve backend and frontend over HTTPS.
- Restrict CORS to the deployed frontend origin.
- Move bearer-token storage to secure HTTP-only cookies if the threat model requires it.
- Protect GitHub `test` and `production` branches with required CI checks.
- Add request rate limiting.
- Add centralized logs and alerting.
- Run dependency and container vulnerability scans in CI.
