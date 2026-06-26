CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    recipient_email varchar(255) NOT NULL,
    recipient_name varchar(150) NULL,
    channel varchar(30) NOT NULL,
    event_type varchar(100) NOT NULL,
    subject varchar(255) NOT NULL,
    body text NOT NULL,
    entity_type varchar(100) NULL,
    entity_id UUID NULL,
    status varchar(30) NOT NULL DEFAULT 'queued',
    provider_response text NULL,
    sent_at timestamptz NULL,
    read_at timestamptz NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notifications_channel_check CHECK (channel IN ('email', 'in_app')),
    CONSTRAINT notifications_status_check CHECK (status IN ('queued', 'sent', 'failed', 'read'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email ON notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_metadata_gin ON notifications USING GIN (metadata);
