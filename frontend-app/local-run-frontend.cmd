@echo off
set VITE_API_BASE_URL=http://127.0.0.1:8080/api
cd /d C:\Users\Ed\Projects\dynamic-form-tool\frontend-app
npm run dev -- --host 127.0.0.1 --port 5173 1>local-frontend.out.log 2>local-frontend.err.log
