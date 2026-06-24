<?php

declare(strict_types=1);

namespace App\Services;

final class DynamicValidationService
{
    public function validate(array $schema, array $payload): array
    {
        $errors = [];
        $fields = $schema['fields'] ?? [];

        foreach ($fields as $field) {
            $key = (string) ($field['key'] ?? '');
            $label = (string) ($field['label'] ?? $key);
            $type = (string) ($field['type'] ?? 'text');
            $rules = $field['validation'] ?? [];
            $valueExists = array_key_exists($key, $payload);
            $value = $payload[$key] ?? null;

            if (($rules['required'] ?? false) === true && $this->isEmpty($value)) {
                $errors[$key][] = "{$label} is required";
                continue;
            }

            if (!$valueExists || $this->isEmpty($value)) {
                continue;
            }

            if (in_array($type, ['text', 'textarea', 'email', 'date', 'select'], true) && !is_string($value)) {
                $errors[$key][] = "{$label} must be a string";
                continue;
            }

            if ($type === 'number' && !is_numeric($value)) {
                $errors[$key][] = "{$label} must be a number";
                continue;
            }

            if ($type === 'checkbox' && !is_bool($value)) {
                $errors[$key][] = "{$label} must be true or false";
                continue;
            }

            if (isset($rules['minLength']) && is_string($value) && mb_strlen($value) < (int) $rules['minLength']) {
                $errors[$key][] = "{$label} must be at least {$rules['minLength']} characters";
            }

            if (isset($rules['maxLength']) && is_string($value) && mb_strlen($value) > (int) $rules['maxLength']) {
                $errors[$key][] = "{$label} must be no more than {$rules['maxLength']} characters";
            }

            if (isset($rules['minimum']) && is_numeric($value) && (float) $value < (float) $rules['minimum']) {
                $errors[$key][] = "{$label} must be at least {$rules['minimum']}";
            }

            if (isset($rules['maximum']) && is_numeric($value) && (float) $value > (float) $rules['maximum']) {
                $errors[$key][] = "{$label} must be no more than {$rules['maximum']}";
            }

            if ($type === 'email' && is_string($value) && filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                $errors[$key][] = "{$label} must be a valid email address";
            }

            if ($type === 'date' && is_string($value) && !$this->isIsoDate($value)) {
                $errors[$key][] = "{$label} must use YYYY-MM-DD format";
            }

            if ($type === 'select') {
                $allowed = array_column($field['options'] ?? [], 'value');
                if (!in_array($value, $allowed, true)) {
                    $errors[$key][] = "{$label} must be one of the allowed values";
                }
            }
        }

        return $errors;
    }

    private function isEmpty(mixed $value): bool
    {
        return $value === null || $value === '';
    }

    private function isIsoDate(string $value): bool
    {
        $date = date_create_from_format('Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }
}
