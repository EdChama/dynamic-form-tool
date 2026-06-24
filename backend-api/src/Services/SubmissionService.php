<?php

declare(strict_types=1);

namespace App\Services;

use App\Database\Database;
use App\Http\NotFoundException;
use App\Http\ValidationException;
use PDO;

final class SubmissionService
{
    public function __construct(
        private readonly Database $database,
        private readonly FormTemplateService $forms,
        private readonly DynamicValidationService $validator,
        private readonly AuditLogService $auditLog,
    ) {
    }

    public function create(string $slug, array $payload, array $metadata): array
    {
        $version = $this->forms->getActivePublishedVersion($slug);
        $schema = json_decode($version['schema_json'], true, 512, JSON_THROW_ON_ERROR);
        $errors = $this->validator->validate($schema, $payload);

        if ($errors !== []) {
            $this->auditLog->record('form_template', $version['form_template_id'], 'submission.validation_failed', [
                'form_template_version_id' => $version['form_template_version_id'],
                'errors' => $errors,
            ], $metadata);

            throw new ValidationException($errors);
        }

        $pdo = $this->database->pdo();
        $pdo->beginTransaction();

        try {
            $reference = 'SUB-' . strtoupper(bin2hex(random_bytes(5)));
            $validationSnapshot = [
                'schema_checksum' => $version['checksum'],
                'version_number' => (int) $version['version_number'],
                'schema' => $schema,
            ];

            $statement = $pdo->prepare(<<<'SQL'
                INSERT INTO form_submissions (
                    form_template_id,
                    form_template_version_id,
                    submission_reference,
                    payload_json,
                    validation_snapshot_json,
                    status,
                    client_ip,
                    user_agent
                )
                VALUES (
                    :form_template_id,
                    :form_template_version_id,
                    :submission_reference,
                    CAST(:payload_json AS jsonb),
                    CAST(:validation_snapshot_json AS jsonb),
                    'validated',
                    :client_ip,
                    :user_agent
                )
                RETURNING id, submission_reference, created_at
            SQL);

            $statement->execute([
                'form_template_id' => $version['form_template_id'],
                'form_template_version_id' => $version['form_template_version_id'],
                'submission_reference' => $reference,
                'payload_json' => json_encode($payload, JSON_THROW_ON_ERROR),
                'validation_snapshot_json' => json_encode($validationSnapshot, JSON_THROW_ON_ERROR),
                'client_ip' => $metadata['client_ip'] ?? null,
                'user_agent' => $metadata['user_agent'] ?? null,
            ]);

            $submission = $statement->fetch();
            $this->insertFieldValues($pdo, $submission['id'], $schema, $payload);

            $this->auditLog->record('form_submission', $submission['id'], 'submission.created', [
                'form_template_id' => $version['form_template_id'],
                'form_template_version_id' => $version['form_template_version_id'],
            ], $metadata);

            $pdo->commit();

            return $submission;
        } catch (\Throwable $exception) {
            $pdo->rollBack();
            throw $exception;
        }
    }

    public function listForForm(string $slug): array
    {
        $version = $this->forms->getActivePublishedVersion($slug);
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT
                id,
                submission_reference,
                status,
                payload_json::text AS payload_json,
                created_at
            FROM form_submissions
            WHERE form_template_id = :form_template_id
              AND deleted_at IS NULL
            ORDER BY created_at DESC
        SQL);
        $statement->execute(['form_template_id' => $version['form_template_id']]);

        return array_map([$this, 'decodeSubmissionRow'], $statement->fetchAll());
    }

    public function find(string $id): array
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT
                id,
                form_template_id,
                form_template_version_id,
                submission_reference,
                payload_json::text AS payload_json,
                validation_snapshot_json::text AS validation_snapshot_json,
                status,
                client_ip,
                user_agent,
                created_at
            FROM form_submissions
            WHERE id = :id
              AND deleted_at IS NULL
            LIMIT 1
        SQL);
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        if (!$row) {
            throw new NotFoundException('Submission not found');
        }

        return $this->decodeSubmissionRow($row);
    }

    private function insertFieldValues(PDO $pdo, string $submissionId, array $schema, array $payload): void
    {
        $statement = $pdo->prepare(<<<'SQL'
            INSERT INTO submission_field_values (
                form_submission_id,
                field_key,
                value_text,
                value_number,
                value_boolean,
                value_date,
                value_json
            )
            VALUES (
                :form_submission_id,
                :field_key,
                :value_text,
                :value_number,
                :value_boolean,
                :value_date,
                CAST(:value_json AS jsonb)
            )
        SQL);

        foreach ($schema['fields'] ?? [] as $field) {
            $key = (string) ($field['key'] ?? '');
            if ($key === '' || !array_key_exists($key, $payload)) {
                continue;
            }

            $value = $payload[$key];
            $type = (string) ($field['type'] ?? 'text');

            $statement->execute([
                'form_submission_id' => $submissionId,
                'field_key' => $key,
                'value_text' => is_string($value) ? $value : null,
                'value_number' => $type === 'number' && is_numeric($value) ? $value : null,
                'value_boolean' => is_bool($value) ? ($value ? 'true' : 'false') : null,
                'value_date' => $type === 'date' && is_string($value) ? $value : null,
                'value_json' => json_encode($value, JSON_THROW_ON_ERROR),
            ]);
        }
    }

    private function decodeSubmissionRow(array $row): array
    {
        if (isset($row['payload_json'])) {
            $row['payload_json'] = json_decode($row['payload_json'], true, 512, JSON_THROW_ON_ERROR);
        }

        if (isset($row['validation_snapshot_json'])) {
            $row['validation_snapshot_json'] = json_decode($row['validation_snapshot_json'], true, 512, JSON_THROW_ON_ERROR);
        }

        return $row;
    }
}
