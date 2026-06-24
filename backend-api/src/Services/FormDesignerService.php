<?php

declare(strict_types=1);

namespace App\Services;

use App\Database\Database;
use App\Http\ForbiddenException;
use App\Http\NotFoundException;
use App\Http\ValidationException;

final class FormDesignerService
{
    public function __construct(
        private readonly Database $database,
        private readonly AuditLogService $auditLog,
    ) {
    }

    public function listEditable(array $user): array
    {
        $where = $user['role'] === 'admin' ? 'ft.deleted_at IS NULL' : 'ft.deleted_at IS NULL AND ft.created_by = :user_id';
        $statement = $this->database->pdo()->prepare(<<<SQL
            SELECT
                ft.id,
                ft.slug,
                ft.name,
                ft.description,
                ft.status,
                ft.created_by,
                ft.created_at,
                ft.updated_at,
                COALESCE(MAX(ftv.version_number), 0) AS latest_version
            FROM form_templates ft
            LEFT JOIN form_template_versions ftv ON ftv.form_template_id = ft.id
            WHERE {$where}
            GROUP BY ft.id
            ORDER BY ft.updated_at DESC
        SQL);
        $statement->execute($user['role'] === 'admin' ? [] : ['user_id' => $user['id']]);

        return $statement->fetchAll();
    }

    public function create(array $payload, array $user, array $metadata): array
    {
        $this->validateDefinitionPayload($payload);
        $slug = $this->slugify($payload['slug'] ?? $payload['name']);
        $schema = $this->normalizeSchema($payload);
        $uiSchema = ['layout' => 'single-column', 'submitLabel' => $payload['submitLabel'] ?? 'Submit form'];
        $checksum = hash('sha256', json_encode($schema, JSON_THROW_ON_ERROR));
        $pdo = $this->database->pdo();
        $pdo->beginTransaction();

        try {
            $template = $pdo->prepare(<<<'SQL'
                INSERT INTO form_templates (slug, name, description, status, created_by)
                VALUES (:slug, :name, :description, 'draft', :created_by)
                RETURNING id, slug, name, description, status, created_by
            SQL);
            $template->execute([
                'slug' => $slug,
                'name' => trim($payload['name']),
                'description' => $payload['description'] ?? null,
                'created_by' => $user['id'],
            ]);
            $form = $template->fetch();
            $version = $this->insertVersion($form['id'], 1, $schema, $uiSchema, $checksum, false, $user['id'], $payload['versionDescription'] ?? 'Initial draft version');
            $this->syncFields($version['id'], $schema);
            $this->auditLog->record('form_template', $form['id'], 'form.created', $form, $metadata);
            $pdo->commit();

            return ['template' => $form, 'version' => $version];
        } catch (\Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    public function update(string $id, array $payload, array $user, array $metadata): array
    {
        $this->validateDefinitionPayload($payload);
        $form = $this->findEditableTemplate($id, $user);
        $schema = $this->normalizeSchema($payload);
        $uiSchema = ['layout' => 'single-column', 'submitLabel' => $payload['submitLabel'] ?? 'Submit form'];
        $checksum = hash('sha256', json_encode($schema, JSON_THROW_ON_ERROR));
        $nextVersion = ((int) $this->latestVersionNumber($id)) + 1;
        $pdo = $this->database->pdo();
        $pdo->beginTransaction();

        try {
            $template = $pdo->prepare(<<<'SQL'
                UPDATE form_templates
                SET name = :name,
                    description = :description,
                    status = 'draft',
                    updated_at = now()
                WHERE id = :id
                RETURNING id, slug, name, description, status, created_by
            SQL);
            $template->execute([
                'id' => $id,
                'name' => trim($payload['name']),
                'description' => $payload['description'] ?? null,
            ]);
            $updatedForm = $template->fetch();
            $version = $this->insertVersion($id, $nextVersion, $schema, $uiSchema, $checksum, false, $user['id'], $payload['versionDescription'] ?? "Draft version {$nextVersion}");
            $this->syncFields($version['id'], $schema);
            $this->auditLog->record('form_template', $id, 'form.version.created', ['old' => $form, 'new' => $updatedForm], $metadata);
            $pdo->commit();

            return ['template' => $updatedForm, 'version' => $version];
        } catch (\Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    public function publish(string $id, array $user, array $metadata): array
    {
        $this->findEditableTemplate($id, $user);
        $pdo = $this->database->pdo();
        $pdo->beginTransaction();

        try {
            $latest = $pdo->prepare(<<<'SQL'
                SELECT id, version_number
                FROM form_template_versions
                WHERE form_template_id = :id
                ORDER BY version_number DESC
                LIMIT 1
            SQL);
            $latest->execute(['id' => $id]);
            $version = $latest->fetch();

            if (!$version) {
                throw new NotFoundException('Form version not found');
            }

            $pdo->prepare('UPDATE form_template_versions SET is_published = false WHERE form_template_id = :id')->execute(['id' => $id]);
            $pdo->prepare('UPDATE form_template_versions SET is_published = true, published_at = now() WHERE id = :version_id')->execute(['version_id' => $version['id']]);
            $status = $pdo->prepare("UPDATE form_templates SET status = 'active', updated_at = now() WHERE id = :id RETURNING id, slug, name, status");
            $status->execute(['id' => $id]);
            $form = $status->fetch();
            $this->auditLog->record('form_template_version', $version['id'], 'form.version.published', $version, $metadata);
            $pdo->commit();

            return ['template' => $form, 'version' => $version];
        } catch (\Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    public function delete(string $id, array $user, array $metadata): array
    {
        $form = $this->findEditableTemplate($id, $user);

        $statement = $this->database->pdo()->prepare(<<<'SQL'
            UPDATE form_templates
            SET status = 'archived',
                deleted_at = now(),
                updated_at = now()
            WHERE id = :id
            RETURNING id, slug, name, status, deleted_at
        SQL);
        $statement->execute(['id' => $id]);
        $deleted = $statement->fetch();

        $this->auditLog->record('form_template', $id, 'form.deleted', [
            'old' => $form,
            'new' => $deleted,
        ], $metadata);

        return $deleted;
    }

    public function listVersions(string $id, array $user): array
    {
        $this->findEditableTemplate($id, $user);

        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT
                id,
                form_template_id,
                version_number,
                version_description,
                checksum,
                is_published,
                published_at,
                created_by,
                created_at
            FROM form_template_versions
            WHERE form_template_id = :id
            ORDER BY version_number DESC
        SQL);
        $statement->execute(['id' => $id]);

        return array_map([$this, 'normalizeVersionSummary'], $statement->fetchAll());
    }

    public function getVersion(string $id, string $versionId, array $user): array
    {
        $form = $this->findEditableTemplate($id, $user);

        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT
                id,
                form_template_id,
                version_number,
                version_description,
                schema_json::text AS schema_json,
                ui_schema_json::text AS ui_schema_json,
                validation_schema_json::text AS validation_schema_json,
                checksum,
                is_published,
                published_at,
                created_by,
                created_at
            FROM form_template_versions
            WHERE form_template_id = :form_template_id
              AND id = :version_id
            LIMIT 1
        SQL);
        $statement->execute([
            'form_template_id' => $id,
            'version_id' => $versionId,
        ]);
        $version = $statement->fetch();

        if (!$version) {
            throw new NotFoundException('Form version not found');
        }

        $schema = json_decode($version['schema_json'], true, 512, JSON_THROW_ON_ERROR);
        $uiSchema = $version['ui_schema_json'] !== null
            ? json_decode($version['ui_schema_json'], true, 512, JSON_THROW_ON_ERROR)
            : [];

        return [
            'id' => $version['id'],
            'form_template_id' => $version['form_template_id'],
            'version_number' => (int) $version['version_number'],
            'version_description' => $version['version_description'],
            'checksum' => $version['checksum'],
            'is_published' => $this->toBool($version['is_published']),
            'published_at' => $version['published_at'],
            'created_at' => $version['created_at'],
            'schema' => $schema,
            'ui_schema' => $uiSchema,
            'definition' => [
                'name' => $form['name'],
                'slug' => $form['slug'],
                'title' => $schema['title'] ?? $form['name'],
                'description' => $schema['description'] ?? $form['description'],
                'submitLabel' => $uiSchema['submitLabel'] ?? 'Submit form',
                'versionDescription' => $version['version_description'],
                'fields' => $schema['fields'] ?? [],
                'actions' => $schema['actions'] ?? [['type' => 'store_submission', 'label' => 'Store submission']],
            ],
        ];
    }

    private function findEditableTemplate(string $id, array $user): array
    {
        $statement = $this->database->pdo()->prepare('SELECT * FROM form_templates WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $statement->execute(['id' => $id]);
        $form = $statement->fetch();

        if (!$form) {
            throw new NotFoundException('Form not found');
        }

        if ($user['role'] !== 'admin' && $form['created_by'] !== $user['id']) {
            throw new ForbiddenException('Only the creator or an admin can edit this form');
        }

        return $form;
    }

    private function validateDefinitionPayload(array $payload): void
    {
        $errors = [];
        if (trim((string) ($payload['name'] ?? '')) === '') {
            $errors['name'][] = 'Form name is required';
        }
        if (!isset($payload['fields']) || !is_array($payload['fields']) || count($payload['fields']) === 0) {
            $errors['fields'][] = 'At least one field is required';
        }

        foreach (($payload['fields'] ?? []) as $index => $field) {
            if (trim((string) ($field['key'] ?? '')) === '') {
                $errors["fields.{$index}.key"][] = 'Field key is required';
            }
            if (trim((string) ($field['label'] ?? '')) === '') {
                $errors["fields.{$index}.label"][] = 'Field label is required';
            }
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }
    }

    private function normalizeSchema(array $payload): array
    {
        return [
            'title' => trim($payload['title'] ?? $payload['name']),
            'description' => $payload['description'] ?? null,
            'fields' => array_values(array_map(function (array $field): array {
                return [
                    'key' => $this->slugify($field['key']),
                    'label' => trim($field['label']),
                    'type' => $field['type'] ?? 'text',
                    'placeholder' => $field['placeholder'] ?? '',
                    'options' => $field['options'] ?? [],
                    'validation' => $field['validation'] ?? [],
                ];
            }, $payload['fields'])),
            'actions' => $payload['actions'] ?? [['type' => 'store_submission', 'label' => 'Store submission']],
        ];
    }

    private function insertVersion(string $templateId, int $version, array $schema, array $uiSchema, string $checksum, bool $published, ?string $createdBy, ?string $versionDescription): array
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            INSERT INTO form_template_versions (
                form_template_id,
                version_number,
                schema_json,
                ui_schema_json,
                validation_schema_json,
                version_description,
                checksum,
                is_published,
                published_at,
                created_by
            )
            VALUES (
                :form_template_id,
                :version_number,
                CAST(:schema_json AS jsonb),
                CAST(:ui_schema_json AS jsonb),
                CAST(:validation_schema_json AS jsonb),
                :version_description,
                :checksum,
                :is_published,
                CASE WHEN CAST(:is_published AS boolean) THEN now() ELSE NULL END,
                :created_by
            )
            RETURNING id, form_template_id, version_number, version_description, is_published, created_at
        SQL);
        $statement->execute([
            'form_template_id' => $templateId,
            'version_number' => $version,
            'schema_json' => json_encode($schema, JSON_THROW_ON_ERROR),
            'ui_schema_json' => json_encode($uiSchema, JSON_THROW_ON_ERROR),
            'validation_schema_json' => json_encode($schema['fields'], JSON_THROW_ON_ERROR),
            'version_description' => $versionDescription,
            'checksum' => $checksum,
            'is_published' => $published ? 'true' : 'false',
            'created_by' => $createdBy,
        ]);

        return $statement->fetch();
    }

    private function syncFields(string $versionId, array $schema): void
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            INSERT INTO form_fields (form_template_version_id, field_key, label, field_type, is_required, sort_order, config_json)
            VALUES (:version_id, :field_key, :label, :field_type, :is_required, :sort_order, CAST(:config_json AS jsonb))
        SQL);

        foreach ($schema['fields'] as $index => $field) {
            $statement->execute([
                'version_id' => $versionId,
                'field_key' => $field['key'],
                'label' => $field['label'],
                'field_type' => $field['type'],
                'is_required' => ($field['validation']['required'] ?? false) ? 'true' : 'false',
                'sort_order' => ($index + 1) * 10,
                'config_json' => json_encode($field, JSON_THROW_ON_ERROR),
            ]);
        }
    }

    private function latestVersionNumber(string $templateId): int
    {
        $statement = $this->database->pdo()->prepare('SELECT COALESCE(MAX(version_number), 0) FROM form_template_versions WHERE form_template_id = :id');
        $statement->execute(['id' => $templateId]);

        return (int) $statement->fetchColumn();
    }

    private function normalizeVersionSummary(array $version): array
    {
        $version['version_number'] = (int) $version['version_number'];
        $version['is_published'] = $this->toBool($version['is_published']);

        return $version;
    }

    private function toBool(mixed $value): bool
    {
        return $value === true || $value === 1 || $value === '1' || $value === 't' || $value === 'true';
    }

    private function slugify(string $value): string
    {
        $slug = preg_replace('/[^a-z0-9]+/', '-', mb_strtolower(trim($value))) ?: '';
        return trim($slug, '-') ?: 'field-' . bin2hex(random_bytes(3));
    }
}
