-- Dynamic Form Tool MySQL schema for server deployment.
-- Run this file against the target MySQL database before deploying the backend.
--
-- Requirements:
-- - MySQL 8.0+
-- - Permission to create tables and indexes
--
-- Notes:
-- - This script creates the full application schema plus initial admin/manager users.
-- - It is safe to re-run for existing tables and indexes.
-- - Change seeded passwords immediately after first production login.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    name varchar(150) NOT NULL,
    email varchar(255) UNIQUE NOT NULL,
    password_hash varchar(255) NOT NULL,
    role varchar(50) NOT NULL,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    version_description text NULL,
    CONSTRAINT form_template_versions_number_unique UNIQUE (form_template_id, version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS form_fields (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    form_template_version_id char(36) NOT NULL REFERENCES form_template_versions(id),
    field_key varchar(150) NOT NULL,
    label varchar(255) NOT NULL,
    field_type varchar(50) NOT NULL,
    is_required boolean NOT NULL DEFAULT FALSE,
    sort_order int NOT NULL DEFAULT 0,
    config_json JSON NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT form_fields_version_key_unique UNIQUE (form_template_version_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    entity_type varchar(100) NOT NULL,
    entity_id char(36) NOT NULL,
    action varchar(100) NOT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    metadata JSON NULL,
    performed_by char(36) NULL REFERENCES users(id),
    client_ip varchar(45) NULL,
    user_agent text NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    user_id char(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(128) NOT NULL UNIQUE,
    name varchar(100) NOT NULL DEFAULT 'api',
    abilities JSON NOT NULL,
    last_used_at timestamp NULL,
    expires_at timestamp NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    user_id char(36) NULL REFERENCES users(id) ON DELETE SET NULL,
    recipient_email varchar(255) NOT NULL,
    recipient_name varchar(150) NULL,
    channel varchar(30) NOT NULL,
    event_type varchar(100) NOT NULL,
    subject varchar(255) NOT NULL,
    body text NOT NULL,
    entity_type varchar(100) NULL,
    entity_id char(36) NULL,
    status varchar(30) NOT NULL DEFAULT 'queued',
    provider_response text NULL,
    sent_at timestamp NULL,
    read_at timestamp NULL,
    metadata JSON NOT NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT notifications_channel_check CHECK (channel IN ('email', 'in_app')),
    CONSTRAINT notifications_status_check CHECK (status IN ('queued', 'sent', 'failed', 'read'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS create_index_if_missing;

DELIMITER $$
CREATE PROCEDURE create_index_if_missing(
    IN table_name_value varchar(64),
    IN index_name_value varchar(64),
    IN ddl_value text
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = table_name_value
          AND index_name = index_name_value
    ) THEN
        SET @create_index_sql = ddl_value;
        PREPARE create_index_statement FROM @create_index_sql;
        EXECUTE create_index_statement;
        DEALLOCATE PREPARE create_index_statement;
    END IF;
END$$
DELIMITER ;

CALL create_index_if_missing('form_templates', 'idx_form_templates_slug', 'CREATE INDEX idx_form_templates_slug ON form_templates(slug)');
CALL create_index_if_missing('form_templates', 'idx_form_templates_status', 'CREATE INDEX idx_form_templates_status ON form_templates(status)');
CALL create_index_if_missing('form_templates', 'idx_form_templates_access_level', 'CREATE INDEX idx_form_templates_access_level ON form_templates(access_level)');
CALL create_index_if_missing('form_templates', 'idx_form_templates_access_key', 'CREATE INDEX idx_form_templates_access_key ON form_templates(access_key)');
CALL create_index_if_missing('form_template_versions', 'idx_form_template_versions_template_id', 'CREATE INDEX idx_form_template_versions_template_id ON form_template_versions(form_template_id)');
CALL create_index_if_missing('form_template_versions', 'idx_form_template_versions_template_version', 'CREATE INDEX idx_form_template_versions_template_version ON form_template_versions(form_template_id, version_number)');
CALL create_index_if_missing('form_template_versions', 'idx_form_template_versions_is_published', 'CREATE INDEX idx_form_template_versions_is_published ON form_template_versions(is_published)');
CALL create_index_if_missing('form_submissions', 'idx_form_submissions_template_id', 'CREATE INDEX idx_form_submissions_template_id ON form_submissions(form_template_id)');
CALL create_index_if_missing('form_submissions', 'idx_form_submissions_template_version_id', 'CREATE INDEX idx_form_submissions_template_version_id ON form_submissions(form_template_version_id)');
CALL create_index_if_missing('form_submissions', 'idx_form_submissions_reference', 'CREATE INDEX idx_form_submissions_reference ON form_submissions(submission_reference)');
CALL create_index_if_missing('form_submissions', 'idx_form_submissions_status', 'CREATE INDEX idx_form_submissions_status ON form_submissions(status)');
CALL create_index_if_missing('form_submissions', 'idx_form_submissions_created_at', 'CREATE INDEX idx_form_submissions_created_at ON form_submissions(created_at)');
CALL create_index_if_missing('submission_field_values', 'idx_submission_field_values_field_key', 'CREATE INDEX idx_submission_field_values_field_key ON submission_field_values(field_key)');
CALL create_index_if_missing('submission_field_values', 'idx_submission_field_values_value_text', 'CREATE INDEX idx_submission_field_values_value_text ON submission_field_values(value_text(255))');
CALL create_index_if_missing('submission_field_values', 'idx_submission_field_values_value_number', 'CREATE INDEX idx_submission_field_values_value_number ON submission_field_values(value_number)');
CALL create_index_if_missing('audit_logs', 'idx_audit_logs_entity', 'CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)');
CALL create_index_if_missing('audit_logs', 'idx_audit_logs_created_at', 'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)');
CALL create_index_if_missing('auth_tokens', 'idx_auth_tokens_user_id', 'CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id)');
CALL create_index_if_missing('auth_tokens', 'idx_auth_tokens_token_hash', 'CREATE INDEX idx_auth_tokens_token_hash ON auth_tokens(token_hash)');
CALL create_index_if_missing('notifications', 'idx_notifications_user_id', 'CREATE INDEX idx_notifications_user_id ON notifications(user_id)');
CALL create_index_if_missing('notifications', 'idx_notifications_recipient_email', 'CREATE INDEX idx_notifications_recipient_email ON notifications(recipient_email)');
CALL create_index_if_missing('notifications', 'idx_notifications_event_type', 'CREATE INDEX idx_notifications_event_type ON notifications(event_type)');
CALL create_index_if_missing('notifications', 'idx_notifications_status', 'CREATE INDEX idx_notifications_status ON notifications(status)');
CALL create_index_if_missing('notifications', 'idx_notifications_created_at', 'CREATE INDEX idx_notifications_created_at ON notifications(created_at)');

DROP PROCEDURE create_index_if_missing;

INSERT INTO users (
    id,
    name,
    email,
    password_hash,
    role,
    is_active
)
VALUES
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Admin User',
        'admin@example.com',
        '$2y$10$Me5mwjP9a8twCJG0m9SgguhTnPbTmDFb2RMTJ5Pfmq7462I/w5XYe',
        'admin',
        TRUE
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'Form Manager',
        'manager@example.com',
        '$2y$10$Me5mwjP9a8twCJG0m9SgguhTnPbTmDFb2RMTJ5Pfmq7462I/w5XYe',
        'form_manager',
        TRUE
    )
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    email = VALUES(email),
    password_hash = VALUES(password_hash),
    role = VALUES(role),
    is_active = VALUES(is_active),
    updated_at = CURRENT_TIMESTAMP;
