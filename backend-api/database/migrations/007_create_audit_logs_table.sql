CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type varchar(100) NOT NULL,
    entity_id UUID NOT NULL,
    action varchar(100) NOT NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    metadata JSONB NULL,
    performed_by UUID NULL REFERENCES users(id),
    client_ip inet NULL,
    user_agent text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
