.PHONY: start stop restart backend frontend kill-backend kill-frontend test health

# === Main commands ===

start: backend frontend  ## Start both backend and frontend

stop: kill-backend kill-frontend  ## Stop both servers

restart: stop start  ## Restart both servers

# === Backend ===

backend:  ## Start backend (port 8001)
	@echo [backend] Starting on http://127.0.0.1:8001 ...
	@powershell -NoProfile -Command "Start-Process -NoNewWindow -FilePath '.venv/Scripts/python.exe' -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8001','--app-dir','backend' -PassThru | ForEach-Object { $$_.Id | Out-File -FilePath .backend.pid -Encoding ascii }"
	@echo [backend] Started.

kill-backend:  ## Stop backend
	@powershell -NoProfile -Command "if (Test-Path .backend.pid) { $$p = Get-Content .backend.pid; Stop-Process -Id $$p -Force -ErrorAction SilentlyContinue; Remove-Item .backend.pid; Write-Host '[backend] Stopped.' } else { Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $$_ -Force -ErrorAction SilentlyContinue }; Write-Host '[backend] Stopped (by port).' }"

# === Frontend ===

frontend:  ## Start frontend (Vite dev server)
	@echo [frontend] Starting Vite dev server...
	@powershell -NoProfile -Command "$$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); Start-Process -NoNewWindow -WorkingDirectory 'frontend' -FilePath 'cmd' -ArgumentList '/c','npm','run','dev' -PassThru | ForEach-Object { $$_.Id | Out-File -FilePath .frontend.pid -Encoding ascii }"
	@echo [frontend] Started.

kill-frontend:  ## Stop frontend
	@powershell -NoProfile -Command "if (Test-Path .frontend.pid) { $$p = Get-Content .frontend.pid; Stop-Process -Id $$p -Force -ErrorAction SilentlyContinue; Remove-Item .frontend.pid; Write-Host '[frontend] Stopped.' } else { Get-NetTCPConnection -LocalPort 5173,5174 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $$_ -Force -ErrorAction SilentlyContinue }; Write-Host '[frontend] Stopped (by port).' }"

# === Utilities ===

test:  ## Run API tests
	.venv/Scripts/python.exe -m pytest test_api.py -v

health:  ## Check backend health
	@powershell -NoProfile -Command "try { (Invoke-RestMethod http://127.0.0.1:8001/api/health).status } catch { Write-Host 'Backend not reachable' }"

help:  ## Show this help
	@powershell -NoProfile -Command "Select-String -Path Makefile -Pattern '^\w+:.*##' | ForEach-Object { $$_ -replace '.*\\\\(\\w+):.*## (.*)','  $$1`t$$2' }"
