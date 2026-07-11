CREATE TABLE IF NOT EXISTS submission_field_values (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    form_submission_id char(36) NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    field_key varchar(150) NOT NULL,
    value_text text NULL,
    value_number numeric NULL,
    value_boolean boolean NULL,
    value_date date NULL,
    value_json JSON NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT submission_field_values_submission_key_unique UNIQUE (form_submission_id, field_key)
);
