CREATE TABLE IF NOT EXISTS form_submissions (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    form_template_id char(36) NOT NULL REFERENCES form_templates(id),
    form_template_version_id char(36) NOT NULL REFERENCES form_template_versions(id),
    submission_reference varchar(100) UNIQUE NOT NULL,
    payload_json JSON NOT NULL,
    validation_snapshot_json JSON NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'submitted',
    submitted_by char(36) NULL REFERENCES users(id),
    client_ip varchar(45) NULL,
    user_agent text NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at timestamp NULL,
    CONSTRAINT form_submissions_status_check CHECK (status IN ('submitted', 'validated', 'flagged', 'archived'))
);
