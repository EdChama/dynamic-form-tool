CREATE TABLE IF NOT EXISTS auth_tokens (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    user_id char(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash varchar(128) NOT NULL UNIQUE,
    name varchar(100) NOT NULL DEFAULT 'api',
    abilities JSON NOT NULL,
    last_used_at timestamp NULL,
    expires_at timestamp NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX idx_auth_tokens_token_hash ON auth_tokens(token_hash);
