<?php

declare(strict_types=1);

namespace App\Http;

final class ResponseFactory
{
    public function success(array $data, string $message, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        echo json_encode([
            'status' => 'success',
            'message' => $message,
            'data' => $data,
        ], JSON_THROW_ON_ERROR);
    }

    public function error(string $message, int $statusCode): void
    {
        http_response_code($statusCode);
        echo json_encode([
            'status' => 'error',
            'message' => $message,
        ], JSON_THROW_ON_ERROR);
    }

    public function validationError(array $errors): void
    {
        http_response_code(422);
        echo json_encode([
            'status' => 'error',
            'message' => 'Validation failed',
            'errors' => $errors,
        ], JSON_THROW_ON_ERROR);
    }
}
