<?php

declare(strict_types=1);

namespace App\Services;

use App\Database\Database;
use App\Http\NotFoundException;

final class FormTemplateService
{
    public function __construct(private readonly Database $database)
    {
    }

    public function listActiveForms(): array
    {
        $sql = <<<'SQL'
            SELECT
                ft.id,
                ft.slug,
                ft.name,
                ft.description,
                ft.status,
                ft.access_level,
                ftv.id AS form_template_version_id,
                ftv.version_number,
                ftv.published_at
            FROM form_templates ft
            JOIN form_template_versions ftv ON ftv.form_template_id = ft.id
            WHERE ft.status = 'completed'
              AND ft.access_level = 'public'
              AND ft.deleted_at IS NULL
              AND ftv.is_published = TRUE
            ORDER BY ft.name ASC, ftv.version_number DESC
        SQL;

        return $this->database->pdo()->query($sql)->fetchAll();
    }

    public function getPublicForm(string $slug, ?string $accessKey = null): array
    {
        $version = $this->getActivePublishedVersion($slug, $accessKey);

        return [
            'id' => $version['form_template_id'],
            'slug' => $version['slug'],
            'name' => $version['name'],
            'description' => $version['description'],
            'status' => $version['status'],
            'access_level' => $version['access_level'],
            'version' => (int) $version['version_number'],
            'version_id' => $version['form_template_version_id'],
            'schema' => json_decode($version['schema_json'], true, 512, JSON_THROW_ON_ERROR),
            'ui_schema' => $version['ui_schema_json'] !== null
                ? json_decode($version['ui_schema_json'], true, 512, JSON_THROW_ON_ERROR)
                : null,
        ];
    }

    public function getActivePublishedVersion(string $slug, ?string $accessKey = null): array
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT
                ft.id AS form_template_id,
                ft.slug,
                ft.name,
                ft.description,
                ft.status,
                ft.access_level,
                ft.access_key,
                ft.created_by,
                ftv.id AS form_template_version_id,
                ftv.version_number,
                ftv.schema_json AS schema_json,
                ftv.ui_schema_json AS ui_schema_json,
                ftv.validation_schema_json AS validation_schema_json,
                ftv.checksum
            FROM form_templates ft
            JOIN form_template_versions ftv ON ftv.form_template_id = ft.id
            WHERE ft.slug = :slug
              AND ft.status = 'completed'
              AND ft.deleted_at IS NULL
              AND ftv.is_published = TRUE
              AND (
                  ft.access_level = 'public'
                  OR (ft.access_level = 'restricted' AND ft.access_key = :access_key)
              )
            ORDER BY ftv.version_number DESC
            LIMIT 1
        SQL);
        $statement->execute([
            'slug' => $slug,
            'access_key' => $accessKey,
        ]);
        $version = $statement->fetch();

        if (!$version) {
            throw new NotFoundException('Form not found');
        }

        return $version;
    }
}
