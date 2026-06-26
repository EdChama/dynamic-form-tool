<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\AppConfig;
use App\Database\Database;

final class NotificationService
{
    public function __construct(
        private readonly Database $database,
        private readonly AppConfig $config,
    ) {
    }

    public function notifyFormCreated(array $form, array $user, array $metadata): void
    {
        $subject = "Form created: {$form['name']}";
        $body = "{$user['name']} created the form \"{$form['name']}\" and saved the first draft version.";

        $this->notifyUserAndAdmins('form.created', $subject, $body, 'form_template', $form['id'], $user, $metadata);
    }

    public function notifyFormVersionCreated(array $form, array $version, array $user, array $metadata): void
    {
        $subject = "New form version: {$form['name']}";
        $body = "{$user['name']} saved version {$version['version_number']} of \"{$form['name']}\"."
            . "\n\nVersion note: " . ($version['version_description'] ?: 'No version description provided.');

        $this->notifyUserAndAdmins('form.version.created', $subject, $body, 'form_template', $form['id'], $user, $metadata);
    }

    public function notifyFormPublished(array $form, array $version, array $user, array $metadata): void
    {
        $subject = "Form published: {$form['name']}";
        $body = "{$user['name']} published \"{$form['name']}\" at version {$version['version_number']}.";

        $this->notifyUserAndAdmins('form.version.published', $subject, $body, 'form_template', $form['id'], $user, $metadata);
    }

    public function notifyFormDeleted(array $form, array $user, array $metadata): void
    {
        $subject = "Form archived: {$form['name']}";
        $body = "{$user['name']} archived \"{$form['name']}\". Existing submissions and version snapshots remain stored.";

        $this->notifyUserAndAdmins('form.deleted', $subject, $body, 'form_template', $form['id'], $user, $metadata);
    }

    public function notifySubmissionCreated(array $version, array $submission, array $payload, array $metadata): void
    {
        $creator = $this->findUser((string) $version['created_by']);
        $admins = $this->adminRecipients();
        $recipients = $this->uniqueRecipients(array_filter([$creator]), $admins);
        $subject = "New submission: {$version['name']}";
        $body = "A new submission was received for \"{$version['name']}\"."
            . "\n\nReference: {$submission['submission_reference']}"
            . "\nVersion: {$version['version_number']}"
            . "\nFields submitted: " . count($payload);

        $this->createNotifications($recipients, 'submission.created', $subject, $body, 'form_submission', $submission['id'], $metadata);
    }

    public function listForUser(array $user): array
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT
                id,
                channel,
                event_type,
                subject,
                body,
                entity_type,
                entity_id,
                status,
                read_at,
                created_at
            FROM notifications
            WHERE channel = 'in_app'
              AND user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 30
        SQL);
        $statement->execute(['user_id' => $user['id']]);

        return $statement->fetchAll();
    }

    public function markRead(string $id, array $user): array
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            UPDATE notifications
            SET status = 'read',
                read_at = COALESCE(read_at, now()),
                updated_at = now()
            WHERE id = :id
              AND user_id = :user_id
              AND channel = 'in_app'
            RETURNING id, status, read_at
        SQL);
        $statement->execute([
            'id' => $id,
            'user_id' => $user['id'],
        ]);

        return $statement->fetch() ?: [];
    }

    private function notifyUserAndAdmins(string $eventType, string $subject, string $body, string $entityType, string $entityId, array $user, array $metadata): void
    {
        $recipients = $this->uniqueRecipients([$user], $this->adminRecipients());
        $this->createNotifications($recipients, $eventType, $subject, $body, $entityType, $entityId, $metadata);
    }

    private function createNotifications(array $recipients, string $eventType, string $subject, string $body, string $entityType, string $entityId, array $metadata): void
    {
        foreach ($recipients as $recipient) {
            $emailResult = $this->dispatchEmail($recipient['email'], $subject, $body);

            $this->insertNotification(
                $recipient,
                'email',
                $eventType,
                $subject,
                $body,
                $entityType,
                $entityId,
                $emailResult['status'],
                $emailResult['response'],
                $metadata,
                $emailResult['status'] === 'sent'
            );

            if (($recipient['id'] ?? null) !== null) {
                $this->insertNotification(
                    $recipient,
                    'in_app',
                    $eventType,
                    $subject,
                    $body,
                    $entityType,
                    $entityId,
                    'queued',
                    null,
                    $metadata,
                    false
                );
            }
        }
    }

    private function insertNotification(array $recipient, string $channel, string $eventType, string $subject, string $body, string $entityType, string $entityId, string $status, ?string $providerResponse, array $metadata, bool $sent): void
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            INSERT INTO notifications (
                user_id,
                recipient_email,
                recipient_name,
                channel,
                event_type,
                subject,
                body,
                entity_type,
                entity_id,
                status,
                provider_response,
                sent_at,
                metadata
            )
            VALUES (
                :user_id,
                :recipient_email,
                :recipient_name,
                :channel,
                :event_type,
                :subject,
                :body,
                :entity_type,
                :entity_id,
                :status,
                :provider_response,
                CASE WHEN CAST(:sent AS boolean) THEN now() ELSE NULL END,
                CAST(:metadata AS jsonb)
            )
        SQL);
        $statement->execute([
            'user_id' => $recipient['id'] ?? null,
            'recipient_email' => $recipient['email'],
            'recipient_name' => $recipient['name'] ?? null,
            'channel' => $channel,
            'event_type' => $eventType,
            'subject' => $subject,
            'body' => $body,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'status' => $status,
            'provider_response' => $providerResponse,
            'sent' => $sent ? 'true' : 'false',
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
        ]);
    }

    private function dispatchEmail(string $email, string $subject, string $body): array
    {
        if ($this->config->mailTransport() === 'mail') {
            $headers = sprintf(
                "From: %s <%s>\r\nContent-Type: text/plain; charset=UTF-8",
                $this->config->mailFromName(),
                $this->config->mailFromEmail()
            );

            $sent = mail($email, $subject, $body, $headers);

            return [
                'status' => $sent ? 'sent' : 'failed',
                'response' => $sent ? 'Sent with PHP mail().' : 'PHP mail() returned false.',
            ];
        }

        return [
            'status' => 'sent',
            'response' => 'Logged notification. Configure MAIL_TRANSPORT=mail for PHP mail() delivery.',
        ];
    }

    private function adminRecipients(): array
    {
        $statement = $this->database->pdo()->query(<<<'SQL'
            SELECT id, name, email
            FROM users
            WHERE role = 'admin'
              AND is_active = true
        SQL);
        $admins = $statement->fetchAll();

        foreach ($this->config->adminNotificationEmails() as $email) {
            $admins[] = [
                'id' => null,
                'name' => 'Configured admin',
                'email' => $email,
            ];
        }

        return $admins;
    }

    private function findUser(string $id): ?array
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT id, name, email
            FROM users
            WHERE id = :id
              AND is_active = true
            LIMIT 1
        SQL);
        $statement->execute(['id' => $id]);
        $user = $statement->fetch();

        return $user ?: null;
    }

    private function uniqueRecipients(array ...$groups): array
    {
        $recipients = [];

        foreach ($groups as $group) {
            foreach ($group as $recipient) {
                if (!is_array($recipient) || trim((string) ($recipient['email'] ?? '')) === '') {
                    continue;
                }

                $email = mb_strtolower(trim($recipient['email']));
                $recipients[$email] = [
                    'id' => $recipient['id'] ?? null,
                    'name' => $recipient['name'] ?? null,
                    'email' => $email,
                ];
            }
        }

        return array_values($recipients);
    }
}
