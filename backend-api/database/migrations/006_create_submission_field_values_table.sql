CREATE TABLE IF NOT EXISTS submission_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    field_key varchar(150) NOT NULL,
    value_text text NULL,
    value_number numeric NULL,
    value_boolean boolean NULL,
    value_date date NULL,
    value_json JSONB NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT submission_field_values_submission_key_unique UNIQUE (form_submission_id, field_key)
);
