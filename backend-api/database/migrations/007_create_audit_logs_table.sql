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
);
