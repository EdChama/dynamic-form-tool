<?php

declare(strict_types=1);

use App\Services\DynamicValidationService;
use PHPUnit\Framework\TestCase;

final class DynamicValidationServiceTest extends TestCase
{
    public function testMissingRequiredFieldReturnsError(): void
    {
        $validator = new DynamicValidationService();
        $errors = $validator->validate($this->schema(), ['email' => 'valid@example.com']);

        self::assertSame(['Full name is required'], $errors['full_name']);
    }

    public function testInvalidEnumReturnsError(): void
    {
        $validator = new DynamicValidationService();
        $errors = $validator->validate($this->schema(), [
            'full_name' => 'Jane Banda',
            'email' => 'valid@example.com',
            'nationality' => 'INVALID',
        ]);

        self::assertSame(['Nationality must be one of the allowed values'], $errors['nationality']);
    }

    private function schema(): array
    {
        return [
            'fields' => [
                [
                    'key' => 'full_name',
                    'label' => 'Full name',
                    'type' => 'text',
                    'validation' => ['required' => true],
                ],
                [
                    'key' => 'email',
                    'label' => 'Email',
                    'type' => 'email',
                    'validation' => ['required' => true],
                ],
                [
                    'key' => 'nationality',
                    'label' => 'Nationality',
                    'type' => 'select',
                    'options' => [
                        ['label' => 'Zambian', 'value' => 'ZM'],
                    ],
                    'validation' => ['required' => false],
                ],
            ],
        ];
    }
}
