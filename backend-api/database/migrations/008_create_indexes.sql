CREATE INDEX IF NOT EXISTS idx_form_templates_slug ON form_templates(slug);
CREATE INDEX IF NOT EXISTS idx_form_templates_status ON form_templates(status);

CREATE INDEX IF NOT EXISTS idx_form_template_versions_template_id ON form_template_versions(form_template_id);
CREATE INDEX IF NOT EXISTS idx_form_template_versions_template_version ON form_template_versions(form_template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_form_template_versions_is_published ON form_template_versions(is_published);
CREATE INDEX IF NOT EXISTS idx_form_template_versions_schema_json_gin ON form_template_versions USING GIN (schema_json);

CREATE INDEX IF NOT EXISTS idx_form_submissions_template_id ON form_submissions(form_template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_template_version_id ON form_submissions(form_template_version_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_reference ON form_submissions(submission_reference);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_payload_json_gin ON form_submissions USING GIN (payload_json);

CREATE INDEX IF NOT EXISTS idx_submission_field_values_field_key ON submission_field_values(field_key);
CREATE INDEX IF NOT EXISTS idx_submission_field_values_value_text ON submission_field_values(value_text);
CREATE INDEX IF NOT EXISTS idx_submission_field_values_value_number ON submission_field_values(value_number);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON audit_logs USING GIN (metadata);
