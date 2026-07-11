<?php

declare(strict_types=1);

namespace App\Services;

use App\Database\Database;

final class AuditLogService
{
    public function __construct(private readonly Database $database)
    {
    }

    public function record(string $entityType, string $entityId, string $action, array $newValues = [], array $metadata = []): void
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            INSERT INTO audit_logs (
                entity_type,
                entity_id,
                action,
                new_values,
                metadata,
                client_ip,
                user_agent
            )
            VALUES (
                :entity_type,
                :entity_id,
                :action,
                :new_values,
                :metadata,
                :client_ip,
                :user_agent
            )
        SQL);

        $statement->execute([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'new_values' => json_encode($newValues, JSON_THROW_ON_ERROR),
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'client_ip' => $metadata['client_ip'] ?? null,
            'user_agent' => $metadata['user_agent'] ?? null,
        ]);
    }
}
