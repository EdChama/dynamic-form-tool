CREATE TABLE IF NOT EXISTS form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_version_id UUID NOT NULL REFERENCES form_template_versions(id),
    field_key varchar(150) NOT NULL,
    label varchar(255) NOT NULL,
    field_type varchar(50) NOT NULL,
    is_required boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0,
    config_json JSONB NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT form_fields_version_key_unique UNIQUE (form_template_version_id, field_key)
);
