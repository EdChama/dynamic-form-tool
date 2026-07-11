CREATE TABLE IF NOT EXISTS users (
    id char(36) PRIMARY KEY DEFAULT (UUID()),
    name varchar(150) NOT NULL,
    email varchar(255) UNIQUE NOT NULL,
    password_hash varchar(255) NOT NULL,
    role varchar(50) NOT NULL,
    is_active boolean NOT NULL DEFAULT TRUE,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
