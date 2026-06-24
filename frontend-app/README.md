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
docker compose up --build frontend backend postgres
```

Open:

```text
http://localhost:5173
```

The frontend reads `VITE_API_BASE_URL` from environment variables. In Docker it defaults to:

```text
http://localhost:8080/api
```

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

The app loads active forms with `GET /api/forms`, then fetches the selected form with `GET /api/forms/{slug}`.

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

The sidebar has two modes:

- `Submit`: public users select and complete active published forms.
- `Builder`: authenticated admins or form managers design forms.

The builder supports:

- form name, slug, header title, description, and submit label
- text, textarea, number, select, checkbox, date, and email fields
- field key, label, placeholder, select options, required flag, min/max length, and min/max number
- draft save and publish actions

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
