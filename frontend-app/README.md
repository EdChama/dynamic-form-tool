# Frontend App

React + TypeScript + Vite frontend for designing, rendering, and submitting dynamic forms from backend schema JSON.

## Runtime

- Node.js 22 in Docker
- React 19
- Vite 6
- TypeScript strict mode
- Vitest for unit tests

## Docker Development

From the repository root:

```bash
docker compose up --build frontend backend mysql
```

Open:

```text
http://localhost:5173
```

The frontend reads `VITE_API_BASE_URL` from environment variables. In Docker it defaults to:

```text
http://localhost:8080/api
```

The app retries the initial forms request briefly. If the backend is still starting or applying migrations, this avoids showing a false failure during a normal cold start. If retries are exhausted, check `GET /api/health` and confirm `schema_ready` is `true`.

## Local Commands

Inside the frontend container:

```bash
docker compose exec frontend npm install
docker compose exec frontend npm run dev
docker compose exec frontend npm run test
docker compose exec frontend npm run build
```

Outside Docker, if Node.js is installed:

```bash
npm install
npm run dev
npm run test
npm run build
```

## Source Layout

```text
src/
|-- api/
|   `-- client.ts
|-- components/
|   `-- forms/
|       |-- DynamicForm.tsx
|       `-- FieldRenderer.tsx
|-- tests/
|   |-- setup.ts
|   `-- validation.test.ts
|-- types/
|   `-- forms.ts
|-- utils/
|   `-- validation.ts
|-- App.tsx
|-- main.tsx
`-- styles.css
```

## Rendering Model

The app loads completed public forms with `GET /api/forms`, then fetches the selected form with `GET /api/forms/{slug}`. Restricted forms can be opened directly with `/?form={slug}&access_key={key}`.

The renderer supports:

- text
- textarea
- number
- select
- checkbox
- date
- email

Each field is generated from `schema.fields`. Labels, required markers, accessible error regions, options, placeholders, and min/max constraints all come from schema metadata.

## Builder Model

The root URL `/` opens the authenticated dashboard when a valid token is already stored. Without a valid token it opens the admin login view. Public form filling remains available from the `Fill forms` toggle or from a direct shared form URL such as `/?form={slug}&access_key={key}`.

The sidebar changes by session state:

- Public users see the admin login first, with a `Fill forms` toggle for public forms.
- Authenticated admins/form managers see workspace navigation for `Dashboard`, `Forms`, `Users`, and `Notifications`.

The authenticated flow is:

- `Dashboard`: summary metrics and the start-to-finish lifecycle from design to submission review.
- `Forms`: form selector/editor, version dropdown, preview modal, publication/access controls, and submissions for the selected form.
- `Users`: admin-only user and role visibility.
- `Notifications`: in-app system events and mark-as-read controls.

The builder supports:

- form name, slug, header title, description, and submit label
- text, textarea, number, select, checkbox, date, and email fields
- field key, label, placeholder, select options, required flag, min/max length, and min/max number
- draft save and publish actions
- soft-delete/archive for forms the current user can edit
- lifecycle status selection: draft, completed, archived, expired
- access selection: public, private, restricted link
- version description for each saved copy
- version selector and preview showing field order, field type, labels, options, and validation rules
- preview modal for the current draft before saving or publishing
- move-up and move-down controls for changing field order
- submission review for the selected form, including stored payload JSON and the submitted form version
- admin user directory for role/status visibility
- toast popups for saved drafts, published forms, archived forms, submissions, login failures, and load failures
- dedicated notification page for signed-in admins/form managers with mark-as-read support

Seeded development login:

```text
admin@example.com / password123
manager@example.com / password123
```

## Validation Model

Client validation provides immediate feedback for:

- required fields
- email format
- number min/max
- string min/max length

The backend remains the final authority and may return structured field errors. Those API errors are displayed next to fields when available.

## Notification UI

The frontend reads notifications through:

```text
GET /api/notifications
POST /api/notifications/{id}/read
```

Authenticated users open notifications from the left workspace navigation. The toast region uses `aria-live="polite"` and is also triggered after public submissions and builder lifecycle actions. The notification page is intentionally separate from the form builder controls so the editor can keep working while system events remain easy to audit.

## Deployment

For production:

```bash
npm run build
```

Deploy the generated `dist/` directory to a static host or serve it through Nginx/Apache. Set `VITE_API_BASE_URL` at build time to the production backend API URL.

Recommended production settings:

- Build once in CI.
- Serve static assets with HTTPS.
- Enable long-lived cache headers for hashed assets.
- Keep `VITE_API_BASE_URL` pointed at the HTTPS backend origin.
- Restrict backend CORS to the deployed frontend domain.
- Store bearer tokens only in browser storage suitable for the target risk profile; for higher-risk deployments, move to secure HTTP-only cookies.
