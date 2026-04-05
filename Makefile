.PHONY: start stop restart backend frontend kill-backend kill-frontend test health seed help

# ─── OS detection ────────────────────────────────────────
# Windows: OS=Windows_NT (set by cmd/powershell)
# macOS/Linux: uname
ifeq ($(OS),Windows_NT)
  DETECTED_OS := Windows
  PYTHON      := .venv/Scripts/python.exe
  ACTIVATE    := .venv\Scripts\activate
else
  UNAME_S     := $(shell uname -s)
  DETECTED_OS := $(UNAME_S)
  PYTHON      := .venv/bin/python
  ACTIVATE    := . .venv/bin/activate
endif

# === Main commands ===

start: backend frontend  ## Start both backend and frontend

stop: kill-backend kill-frontend  ## Stop both servers

restart: stop start  ## Restart both servers

# === Backend ===

backend:  ## Start backend (port 8001)
	@echo "[backend] Starting on http://127.0.0.1:8001 ..."
ifeq ($(DETECTED_OS),Windows)
	@powershell -NoProfile -Command "Start-Process -NoNewWindow -FilePath '$(PYTHON)' -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8001','--app-dir','backend' -PassThru | ForEach-Object { $$_.Id | Out-File -FilePath .backend.pid -Encoding ascii }"
else
	@$(PYTHON) -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --app-dir backend & echo $$! > .backend.pid
endif
	@echo "[backend] Started."

kill-backend:  ## Stop backend
ifeq ($(DETECTED_OS),Windows)
	@powershell -NoProfile -Command "if (Test-Path .backend.pid) { $$p = Get-Content .backend.pid; Stop-Process -Id $$p -Force -ErrorAction SilentlyContinue; Remove-Item .backend.pid; Write-Host '[backend] Stopped.' } else { Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $$_ -Force -ErrorAction SilentlyContinue }; Write-Host '[backend] Stopped (by port).' }"
else
	@if [ -f .backend.pid ]; then \
		kill $$(cat .backend.pid) 2>/dev/null || true; \
		rm -f .backend.pid; \
		echo "[backend] Stopped."; \
	else \
		lsof -ti:8001 | xargs kill -9 2>/dev/null || true; \
		echo "[backend] Stopped (by port)."; \
	fi
endif

# === Frontend ===

frontend:  ## Start frontend (Vite dev server)
	@echo "[frontend] Starting Vite dev server..."
ifeq ($(DETECTED_OS),Windows)
	@powershell -NoProfile -Command "$$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); Start-Process -NoNewWindow -WorkingDirectory 'frontend' -FilePath 'cmd' -ArgumentList '/c','npm','run','dev' -PassThru | ForEach-Object { $$_.Id | Out-File -FilePath .frontend.pid -Encoding ascii }"
else
	@cd frontend && npm run dev & echo $$! > .frontend.pid
endif
	@echo "[frontend] Started."

kill-frontend:  ## Stop frontend
ifeq ($(DETECTED_OS),Windows)
	@powershell -NoProfile -Command "if (Test-Path .frontend.pid) { $$p = Get-Content .frontend.pid; Stop-Process -Id $$p -Force -ErrorAction SilentlyContinue; Remove-Item .frontend.pid; Write-Host '[frontend] Stopped.' } else { Get-NetTCPConnection -LocalPort 5173,5174 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $$_ -Force -ErrorAction SilentlyContinue }; Write-Host '[frontend] Stopped (by port).' }"
else
	@if [ -f .frontend.pid ]; then \
		kill $$(cat .frontend.pid) 2>/dev/null || true; \
		rm -f .frontend.pid; \
		echo "[frontend] Stopped."; \
	else \
		lsof -ti:5173,5174 | xargs kill -9 2>/dev/null || true; \
		echo "[frontend] Stopped (by port)."; \
	fi
endif

# === Utilities ===

seed:  ## Seed tutorial data
	$(PYTHON) seed_tutorial.py

test:  ## Run API tests
	$(PYTHON) -m pytest test_api.py -v

health:  ## Check backend health
ifeq ($(DETECTED_OS),Windows)
	@powershell -NoProfile -Command "try { (Invoke-RestMethod http://127.0.0.1:8001/api/health).status } catch { Write-Host 'Backend not reachable' }"
else
	@curl -sf http://127.0.0.1:8001/api/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "Backend not reachable"
endif

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
