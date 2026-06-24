<?php

declare(strict_types=1);

namespace App\Http;

use App\Config\AppConfig;
use App\Database\Database;
use App\Services\AuditLogService;
use App\Services\AuthService;
use App\Services\DynamicValidationService;
use App\Services\FormDesignerService;
use App\Services\FormTemplateService;
use App\Services\SubmissionService;
use Throwable;

final class ApiKernel
{
    private AppConfig $config;
    private ResponseFactory $responses;
    private AuthService $auth;
    private FormTemplateService $forms;
    private FormDesignerService $designer;
    private SubmissionService $submissions;

    public function __construct()
    {
        $this->config = new AppConfig();
        $database = new Database($this->config);
        $this->responses = new ResponseFactory();
        $audit = new AuditLogService($database);
        $this->auth = new AuthService($database);
        $this->forms = new FormTemplateService($database);
        $this->designer = new FormDesignerService($database, $audit);
        $validator = new DynamicValidationService();
        $this->submissions = new SubmissionService($database, $this->forms, $validator, $audit);
    }

    public function handle(): void
    {
        $this->applyCors();

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            return;
        }

        try {
            $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
            $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
            $path = rtrim($path, '/') ?: '/';

            if ($method === 'GET' && $path === '/api/health') {
                $this->responses->success(['service' => 'dynamic-form-backend'], 'Backend is healthy');
                return;
            }

            if ($method === 'POST' && $path === '/api/auth/login') {
                $payload = $this->readJsonBody();
                $this->responses->success(
                    $this->auth->login((string) ($payload['email'] ?? ''), (string) ($payload['password'] ?? ''), $this->clientMetadata()),
                    'Authenticated'
                );
                return;
            }

            if ($method === 'GET' && $path === '/api/auth/me') {
                $this->responses->success($this->currentUser(), 'Authenticated user retrieved');
                return;
            }

            if ($method === 'GET' && $path === '/api/admin/forms') {
                $user = $this->currentUser();
                $this->auth->requireRole($user, ['admin', 'form_manager']);
                $this->responses->success($this->designer->listEditable($user), 'Editable forms retrieved');
                return;
            }

            if ($method === 'POST' && $path === '/api/admin/forms') {
                $user = $this->currentUser();
                $this->auth->requireRole($user, ['admin', 'form_manager']);
                $this->responses->success($this->designer->create($this->readJsonBody(), $user, $this->clientMetadata()), 'Form draft created', 201);
                return;
            }

            if ($method === 'PUT' && preg_match('#^/api/admin/forms/([0-9a-fA-F-]{36})$#', $path, $matches)) {
                $user = $this->currentUser();
                $this->auth->requireRole($user, ['admin', 'form_manager']);
                $this->responses->success($this->designer->update($matches[1], $this->readJsonBody(), $user, $this->clientMetadata()), 'Form draft updated');
                return;
            }

            if ($method === 'POST' && preg_match('#^/api/admin/forms/([0-9a-fA-F-]{36})/publish$#', $path, $matches)) {
                $user = $this->currentUser();
                $this->auth->requireRole($user, ['admin', 'form_manager']);
                $this->responses->success($this->designer->publish($matches[1], $user, $this->clientMetadata()), 'Form published');
                return;
            }

            if ($method === 'GET' && $path === '/api/forms') {
                $this->responses->success($this->forms->listActiveForms(), 'Forms retrieved');
                return;
            }

            if ($method === 'GET' && preg_match('#^/api/forms/([a-zA-Z0-9_-]+)$#', $path, $matches)) {
                $this->responses->success($this->forms->getPublicForm($matches[1]), 'Form retrieved');
                return;
            }

            if ($method === 'POST' && preg_match('#^/api/forms/([a-zA-Z0-9_-]+)/submissions$#', $path, $matches)) {
                $payload = $this->readJsonBody();
                $result = $this->submissions->create($matches[1], $payload, $this->clientMetadata());
                $this->responses->success($result, 'Submission created', 201);
                return;
            }

            if ($method === 'GET' && preg_match('#^/api/forms/([a-zA-Z0-9_-]+)/submissions$#', $path, $matches)) {
                $this->responses->success($this->submissions->listForForm($matches[1]), 'Submissions retrieved');
                return;
            }

            if ($method === 'GET' && preg_match('#^/api/submissions/([0-9a-fA-F-]{36})$#', $path, $matches)) {
                $this->responses->success($this->submissions->find($matches[1]), 'Submission retrieved');
                return;
            }

            $this->responses->error('Route not found', 404);
        } catch (ValidationException $exception) {
            $this->responses->validationError($exception->errors);
        } catch (ForbiddenException $exception) {
            $this->responses->error($exception->getMessage(), 403);
        } catch (NotFoundException $exception) {
            $this->responses->error($exception->getMessage(), 404);
        } catch (Throwable $exception) {
            $this->responses->error('Unexpected server error', 500);
        }
    }

    private function applyCors(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if ($origin !== '' && in_array($origin, $this->config->allowedOrigins(), true)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Vary: Origin');
        }

        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
        header('Content-Type: application/json; charset=utf-8');
    }

    private function readJsonBody(): array
    {
        $raw = file_get_contents('php://input') ?: '';

        if (strlen($raw) > $this->config->jsonMaxBytes()) {
            throw new ValidationException(['request' => ['JSON payload is too large']]);
        }

        $payload = json_decode($raw, true);

        if (!is_array($payload)) {
            throw new ValidationException(['request' => ['Request body must be a JSON object']]);
        }

        return $payload;
    }

    private function clientMetadata(): array
    {
        return [
            'client_ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
        ];
    }

    private function currentUser(): array
    {
        return $this->auth->authenticate(
            $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? null
        );
    }
}
