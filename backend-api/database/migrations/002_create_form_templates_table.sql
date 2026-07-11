CREATE TABLE IF NOT EXISTS form_templates (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    slug varchar(150) UNIQUE NOT NULL,
    name varchar(255) NOT NULL,
    description text NULL,
    status varchar(30) NOT NULL DEFAULT 'draft',
    access_level varchar(30) NOT NULL DEFAULT 'public',
    access_key varchar(80) UNIQUE NULL,
    created_by char(36) NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at timestamp NULL,
    CONSTRAINT form_templates_status_check CHECK (status IN ('draft', 'completed', 'archived', 'expired')),
    CONSTRAINT form_templates_access_level_check CHECK (access_level IN ('public', 'private', 'restricted'))
);
