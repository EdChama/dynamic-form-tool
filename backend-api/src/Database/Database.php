<?php

declare(strict_types=1);

namespace App\Database;

use App\Config\AppConfig;
use PDO;

final class Database
{
    private ?PDO $pdo = null;

    public function __construct(private readonly ?AppConfig $config = null)
    {
    }

    public function pdo(): PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        $config = $this->config ?? new AppConfig();
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $config->dbHost(),
            $config->dbPort(),
            $config->dbName()
        );

        $this->pdo = new PDO($dsn, $config->dbUsername(), $config->dbPassword(), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        return $this->pdo;
    }

    public function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
