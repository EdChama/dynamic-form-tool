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
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_recipient_email ON notifications(recipient_email);
CREATE INDEX idx_notifications_event_type ON notifications(event_type);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
