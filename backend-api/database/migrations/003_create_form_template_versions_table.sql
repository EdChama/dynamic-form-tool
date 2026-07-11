CREATE TABLE IF NOT EXISTS form_template_versions (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    form_template_id char(36) NOT NULL REFERENCES form_templates(id),
    version_number int NOT NULL,
    schema_json JSON NOT NULL,
    ui_schema_json JSON NULL,
    validation_schema_json JSON NULL,
    checksum varchar(128) NOT NULL,
    is_published boolean NOT NULL DEFAULT FALSE,
    published_at timestamp NULL,
    created_by char(36) NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT form_template_versions_number_unique UNIQUE (form_template_id, version_number)
);
