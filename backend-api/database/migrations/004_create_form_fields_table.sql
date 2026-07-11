CREATE TABLE IF NOT EXISTS form_fields (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    form_template_version_id char(36) NOT NULL REFERENCES form_template_versions(id),
    field_key varchar(150) NOT NULL,
    label varchar(255) NOT NULL,
    field_type varchar(50) NOT NULL,
    is_required boolean NOT NULL DEFAULT FALSE,
    sort_order int NOT NULL DEFAULT 0,
    config_json JSON NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT form_fields_version_key_unique UNIQUE (form_template_version_id, field_key)
);
