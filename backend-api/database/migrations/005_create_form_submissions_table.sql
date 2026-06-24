CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES form_templates(id),
    form_template_version_id UUID NOT NULL REFERENCES form_template_versions(id),
    submission_reference varchar(100) UNIQUE NOT NULL,
    payload_json JSONB NOT NULL,
    validation_snapshot_json JSONB NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'submitted',
    submitted_by UUID NULL REFERENCES users(id),
    client_ip inet NULL,
    user_agent text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    CONSTRAINT form_submissions_status_check CHECK (status IN ('submitted', 'validated', 'flagged', 'archived'))
);
