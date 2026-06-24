CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(150) UNIQUE NOT NULL,
    name varchar(255) NOT NULL,
    description text NULL,
    status varchar(30) NOT NULL DEFAULT 'draft',
    created_by UUID NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    CONSTRAINT form_templates_status_check CHECK (status IN ('draft', 'active', 'archived'))
);
