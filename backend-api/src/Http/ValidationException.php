<?php

declare(strict_types=1);

namespace App\Http;

use RuntimeException;

final class ValidationException extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Validation failed');
    }
}
