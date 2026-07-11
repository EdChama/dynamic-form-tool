UPDATE form_templates
SET status = 'completed'
WHERE status = 'active';

UPDATE form_templates
SET access_key = LOWER(REPLACE(UUID(), '-', ''))
WHERE access_key IS NULL;

CREATE INDEX idx_form_templates_access_level ON form_templates(access_level);
CREATE INDEX idx_form_templates_access_key ON form_templates(access_key);
