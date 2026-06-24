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
            'pgsql:host=%s;port=%s;dbname=%s',
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
}
