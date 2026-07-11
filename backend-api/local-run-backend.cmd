@echo off
set CI_ENVIRONMENT=development
set APP_BASE_URL=http://localhost:8080
set DB_HOST=127.0.0.1
set DB_PORT=3306
set DB_DATABASE=dynamic_forms
set DB_USERNAME=dynamic_forms_app
set DB_PASSWORD=change_me_for_local_dev
set CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
set JSON_MAX_BYTES=1048576
set MAIL_TRANSPORT=log
set MAIL_FROM_EMAIL=no-reply@dynamic-forms.local
set MAIL_FROM_NAME=Dynamic Forms
set ADMIN_NOTIFICATION_EMAILS=
cd /d C:\Users\Ed\Projects\dynamic-form-tool\backend-api
C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\php.exe spark serve 1>local-backend.out.log 2>local-backend.err.log
