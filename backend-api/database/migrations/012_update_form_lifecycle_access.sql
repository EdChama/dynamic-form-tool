ALTER TABLE form_templates
    DROP CONSTRAINT IF EXISTS form_templates_status_check;

ALTER TABLE form_template_versions
    DROP CONSTRAINT IF EXISTS form_template_versions_checksum_unique;

UPDATE form_templates
SET status = 'completed'
WHERE status = 'active';

ALTER TABLE form_templates
    ADD CONSTRAINT form_templates_status_check CHECK (status IN ('draft', 'completed', 'archived', 'expired'));

ALTER TABLE form_templates
    ADD COLUMN IF NOT EXISTS access_level varchar(30) NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS access_key varchar(80) NULL;

ALTER TABLE form_templates
    DROP CONSTRAINT IF EXISTS form_templates_access_level_check;

ALTER TABLE form_templates
    ADD CONSTRAINT form_templates_access_level_check CHECK (access_level IN ('public', 'private', 'restricted'));

UPDATE form_templates
SET access_key = encode(gen_random_bytes(24), 'hex')
WHERE access_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_form_templates_access_level ON form_templates(access_level);
CREATE INDEX IF NOT EXISTS idx_form_templates_access_key ON form_templates(access_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_templates_access_key_unique ON form_templates(access_key);
