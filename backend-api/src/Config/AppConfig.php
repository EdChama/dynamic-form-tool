<?php

declare(strict_types=1);

namespace App\Config;

final class AppConfig
{
    public function dbHost(): string
    {
        return getenv('DB_HOST') ?: 'mysql';
    }

    public function dbPort(): string
    {
        return getenv('DB_PORT') ?: '3306';
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

    public function mailTransport(): string
    {
        return getenv('MAIL_TRANSPORT') ?: 'log';
    }

    public function mailFromEmail(): string
    {
        return getenv('MAIL_FROM_EMAIL') ?: 'no-reply@dynaform-app.edchama.site';
    }

    public function mailFromName(): string
    {
        return getenv('MAIL_FROM_NAME') ?: 'Dynamic Forms App';
    }

    public function adminNotificationEmails(): array
    {
        $emails = getenv('ADMIN_NOTIFICATION_EMAILS') ?: '';

        return array_values(array_filter(array_map(
            static fn (string $email): string => mb_strtolower(trim($email)),
            explode(',', $emails)
        )));
    }
}
