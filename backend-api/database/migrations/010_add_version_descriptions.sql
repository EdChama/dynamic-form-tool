ALTER TABLE form_template_versions
ADD COLUMN IF NOT EXISTS version_description text NULL;
