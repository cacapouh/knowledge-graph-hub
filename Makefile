.PHONY: start stop restart build logs seed test health ps help

# === Main commands ===

start:  ## Start all services (docker compose up)
	docker compose up -d
	@echo "✅ All services started."
	@echo "   Frontend: http://localhost:5173"
	@echo "   Backend:  http://localhost:8000"
	@echo "   MCP SSE:  http://localhost:8002/sse"

stop:  ## Stop all services
	docker compose down
	@echo "✅ All services stopped."

restart:  ## Restart all services
	docker compose down
	docker compose up -d
	@echo "✅ All services restarted."

build:  ## Rebuild and start all services
	docker compose up -d --build
	@echo "✅ All services rebuilt and started."

logs:  ## Tail logs (all services)
	docker compose logs -f --tail 50

ps:  ## Show running services
	docker compose ps

# === Utilities ===

seed:  ## Seed tutorial data
	@python3 seed_tutorial.py || python seed_tutorial.py

test:  ## Run API tests
	docker compose exec backend python -m pytest -v

health:  ## Check backend health
	@curl -sf http://localhost:8000/api/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "Backend not reachable"

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
