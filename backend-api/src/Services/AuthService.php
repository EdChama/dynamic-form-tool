<?php

declare(strict_types=1);

namespace App\Services;

use App\Database\Database;
use App\Http\ForbiddenException;
use App\Http\ValidationException;

final class AuthService
{
    public function __construct(private readonly Database $database)
    {
    }

    public function login(string $email, string $password, array $metadata): array
    {
        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT id, name, email, password_hash, role, is_active
            FROM users
            WHERE email = :email
            LIMIT 1
        SQL);
        $statement->execute(['email' => mb_strtolower(trim($email))]);
        $user = $statement->fetch();

        if (!$user || !$user['is_active'] || !password_verify($password, $user['password_hash'])) {
            throw new ValidationException(['credentials' => ['Invalid email or password']]);
        }

        $plainToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $plainToken);

        $insert = $this->database->pdo()->prepare(<<<'SQL'
            INSERT INTO auth_tokens (user_id, token_hash, abilities, expires_at)
            VALUES (:user_id, :token_hash, CAST(:abilities AS jsonb), now() + interval '12 hours')
        SQL);
        $insert->execute([
            'user_id' => $user['id'],
            'token_hash' => $tokenHash,
            'abilities' => json_encode([$user['role']], JSON_THROW_ON_ERROR),
        ]);

        return [
            'token' => $plainToken,
            'expires_in_seconds' => 43200,
            'user' => $this->publicUser($user),
        ];
    }

    public function authenticate(?string $authorizationHeader): array
    {
        if (!$authorizationHeader || !str_starts_with($authorizationHeader, 'Bearer ')) {
            throw new ForbiddenException('Authentication required');
        }

        $token = trim(substr($authorizationHeader, 7));
        $tokenHash = hash('sha256', $token);

        $statement = $this->database->pdo()->prepare(<<<'SQL'
            SELECT u.id, u.name, u.email, u.role, u.is_active
            FROM auth_tokens at
            JOIN users u ON u.id = at.user_id
            WHERE at.token_hash = :token_hash
              AND (at.expires_at IS NULL OR at.expires_at > now())
            LIMIT 1
        SQL);
        $statement->execute(['token_hash' => $tokenHash]);
        $user = $statement->fetch();

        if (!$user || !$user['is_active']) {
            throw new ForbiddenException('Authentication required');
        }

        $update = $this->database->pdo()->prepare('UPDATE auth_tokens SET last_used_at = now() WHERE token_hash = :token_hash');
        $update->execute(['token_hash' => $tokenHash]);

        return $this->publicUser($user);
    }

    public function requireRole(array $user, array $roles): void
    {
        if (!in_array($user['role'], $roles, true)) {
            throw new ForbiddenException('You do not have permission to perform this action');
        }
    }

    private function publicUser(array $user): array
    {
        return [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
        ];
    }
}
