<?php

declare(strict_types=1);

namespace App\Config;

final class AppConfig
{
    public function dbHost(): string
    {
        return getenv('DB_HOST') ?: 'postgres';
    }

    public function dbPort(): string
    {
        return getenv('DB_PORT') ?: '5432';
    }

    public function dbName(): string
    {
        return getenv('DB_DATABASE') ?: 'dynamic_forms';
    }

    public function dbUsername(): string
    {
        return getenv('DB_USERNAME') ?: 'dynamic_forms_app';
    }

    public function dbPassword(): string
    {
        return getenv('DB_PASSWORD') ?: 'change_me_for_local_dev';
    }

    public function allowedOrigins(): array
    {
        $origins = getenv('CORS_ALLOWED_ORIGINS') ?: 'http://localhost:5173';

        return array_values(array_filter(array_map('trim', explode(',', $origins))));
    }

    public function jsonMaxBytes(): int
    {
        return (int) (getenv('JSON_MAX_BYTES') ?: 1048576);
    }
}
