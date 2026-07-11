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
        private readonly NotificationService $notifications,
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
                ft.access_level,
                ft.access_key,
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
        $status = $this->normalizeStatus($payload['status'] ?? 'draft');
        $accessLevel = $this->normalizeAccessLevel($payload['accessLevel'] ?? 'public');
        $accessKey = trim((string) ($payload['accessKey'] ?? '')) ?: bin2hex(random_bytes(24));
        $pdo = $this->database->pdo();
        $pdo->beginTransaction();

        try {
            $templateId = $this->database->uuid();
            $template = $pdo->prepare(<<<'SQL'
                INSERT INTO form_templates (id, slug, name, description, status, access_level, access_key, created_by)
                VALUES (:id, :slug, :name, :description, :status, :access_level, :access_key, :created_by)
            SQL);
            $template->execute([
                'id' => $templateId,
                'slug' => $slug,
                'name' => trim($payload['name']),
                'description' => $payload['description'] ?? null,
                'status' => $status,
                'access_level' => $accessLevel,
                'access_key' => $accessKey,
                'created_by' => $user['id'],
            ]);
            $form = $this->findTemplateSummary($templateId);
            $version = $this->insertVersion($form['id'], 1, $schema, $uiSchema, $checksum, $status === 'completed', $user['id'], $payload['versionDescription'] ?? 'Initial draft version');
            $this->syncFields($version['id'], $schema);
            $this->auditLog->record('form_template', $form['id'], 'form.created', $form, $metadata);
            $this->notifications->notifyFormCreated($form, $user, $metadata);
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
        $status = $this->normalizeStatus($payload['status'] ?? 'draft');
        $accessLevel = $this->normalizeAccessLevel($payload['accessLevel'] ?? $form['access_level'] ?? 'public');
        $accessKey = trim((string) ($payload['accessKey'] ?? $form['access_key'] ?? '')) ?: bin2hex(random_bytes(24));
        $pdo = $this->database->pdo();
        $pdo->beginTransaction();

        try {
            $template = $pdo->prepare(<<<'SQL'
                UPDATE form_templates
                SET name = :name,
                    description = :description,
                    status = :status,
                    access_level = :access_level,
                    access_key = :access_key,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            SQL);
            $template->execute([
                'id' => $id,
                'name' => trim($payload['name']),
                'description' => $payload['description'] ?? null,
                'status' => $status,
                'access_level' => $accessLevel,
                'access_key' => $accessKey,
            ]);
            $updatedForm = $this->findTemplateSummary($id);
            $version = $this->insertVersion($id, $nextVersion, $schema, $uiSchema, $checksum, $status === 'completed', $user['id'], $payload['versionDescription'] ?? "Draft version {$nextVersion}");
            if ($status === 'completed') {
                $pdo->prepare('UPDATE form_template_versions SET is_published = FALSE WHERE form_template_id = :id AND id <> :version_id')->execute([
                    'id' => $id,
                    'version_id' => $version['id'],
                ]);
            }
            $this->syncFields($version['id'], $schema);
            $this->auditLog->record('form_template', $id, 'form.version.created', ['old' => $form, 'new' => $updatedForm], $metadata);
            $this->notifications->notifyFormVersionCreated($updatedForm, $version, $user, $metadata);
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

            $pdo->prepare('UPDATE form_template_versions SET is_published = FALSE WHERE form_template_id = :id')->execute(['id' => $id]);
            $pdo->prepare('UPDATE form_template_versions SET is_published = TRUE, published_at = CURRENT_TIMESTAMP WHERE id = :version_id')->execute(['version_id' => $version['id']]);
            $pdo->prepare("UPDATE form_templates SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = :id")->execute(['id' => $id]);
            $form = $this->findTemplateSummary($id);
            $this->auditLog->record('form_template_version', $version['id'], 'form.version.published', $version, $metadata);
            $this->notifications->notifyFormPublished($form, $version, $user, $metadata);
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
                deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        SQL);
        $statement->execute(['id' => $id]);
        $deleted = $this->findTemplateSummary($id, 'id, slug, name, status, deleted_at');

        $this->auditLog->record('form_template', $id, 'form.deleted', [
            'old' => $form,
            'new' => $deleted,
        ], $metadata);
        $this->notifications->notifyFormDeleted($deleted, $user, $metadata);

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
                schema_json AS schema_json,
                ui_schema_json AS ui_schema_json,
                validation_schema_json AS validation_schema_json,
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
                'status' => $form['status'],
                'accessLevel' => $form['access_level'] ?? 'public',
                'accessKey' => $form['access_key'] ?? '',
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

    private function findTemplateSummary(string $id, string $columns = 'id, slug, name, description, status, access_level, access_key, created_by'): array
    {
        $statement = $this->database->pdo()->prepare("SELECT {$columns} FROM form_templates WHERE id = :id LIMIT 1");
        $statement->execute(['id' => $id]);

        return $statement->fetch() ?: [];
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
        if (isset($payload['status']) && !in_array($payload['status'], ['draft', 'completed', 'archived', 'expired'], true)) {
            $errors['status'][] = 'Status must be draft, completed, archived, or expired';
        }
        if (isset($payload['accessLevel']) && !in_array($payload['accessLevel'], ['public', 'private', 'restricted'], true)) {
            $errors['accessLevel'][] = 'Access level must be public, private, or restricted';
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
                id,
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
                :id,
                :form_template_id,
                :version_number,
                :schema_json,
                :ui_schema_json,
                :validation_schema_json,
                :version_description,
                :checksum,
                :is_published,
                :published_at,
                :created_by
            )
        SQL);
        $id = $this->database->uuid();
        $statement->execute([
            'id' => $id,
            'form_template_id' => $templateId,
            'version_number' => $version,
            'schema_json' => json_encode($schema, JSON_THROW_ON_ERROR),
            'ui_schema_json' => json_encode($uiSchema, JSON_THROW_ON_ERROR),
            'validation_schema_json' => json_encode($schema['fields'], JSON_THROW_ON_ERROR),
            'version_description' => $versionDescription,
            'checksum' => $checksum,
            'is_published' => $published ? 1 : 0,
            'published_at' => $published ? date('Y-m-d H:i:s') : null,
            'created_by' => $createdBy,
        ]);

        $version = $this->database->pdo()->prepare(<<<'SQL'
            SELECT id, form_template_id, version_number, version_description, is_published, created_at
            FROM form_template_versions
            WHERE id = :id
            LIMIT 1
        SQL);
        $version->execute(['id' => $id]);

        return $version->fetch();
    }

    private function syncFields(string $versionId, array $schema): void
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            INSERT INTO form_fields (form_template_version_id, field_key, label, field_type, is_required, sort_order, config_json)
            VALUES (:version_id, :field_key, :label, :field_type, :is_required, :sort_order, :config_json)
        SQL);

        foreach ($schema['fields'] as $index => $field) {
            $statement->execute([
                'version_id' => $versionId,
                'field_key' => $field['key'],
                'label' => $field['label'],
                'field_type' => $field['type'],
                'is_required' => ($field['validation']['required'] ?? false) ? 1 : 0,
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

    private function normalizeStatus(mixed $status): string
    {
        $status = (string) $status;

        return in_array($status, ['draft', 'completed', 'archived', 'expired'], true) ? $status : 'draft';
    }

    private function normalizeAccessLevel(mixed $accessLevel): string
    {
        $accessLevel = (string) $accessLevel;

        return in_array($accessLevel, ['public', 'private', 'restricted'], true) ? $accessLevel : 'public';
    }

    private function slugify(string $value): string
    {
        $slug = preg_replace('/[^a-z0-9]+/', '-', mb_strtolower(trim($value))) ?: '';
        return trim($slug, '-') ?: 'field-' . bin2hex(random_bytes(3));
    }
}
