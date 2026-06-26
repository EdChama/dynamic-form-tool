CREATE TABLE IF NOT EXISTS form_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES form_templates(id),
    version_number int NOT NULL,
    schema_json JSONB NOT NULL,
    ui_schema_json JSONB NULL,
    validation_schema_json JSONB NULL,
    checksum varchar(128) NOT NULL,
    is_published boolean NOT NULL DEFAULT false,
    published_at timestamptz NULL,
    created_by UUID NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT form_template_versions_number_unique UNIQUE (form_template_id, version_number)
);
