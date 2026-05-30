.PHONY: help dev stop build migrate seed test lint format clean

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  dev        Start all services (docker-compose up)"
	@echo "  stop       Stop all services"
	@echo "  build      Build all Docker images"
	@echo "  migrate    Run Prisma migrations"
	@echo "  seed       Seed the database"
	@echo "  test       Run all tests"
	@echo "  lint       Lint backend + frontend"
	@echo "  format     Format backend + frontend"
	@echo "  clean      Remove containers, volumes, and caches"

dev:
	docker-compose up

stop:
	docker-compose down

build:
	docker-compose build

generate:
	cd backend && PATH=".venv/bin:$$PATH" .venv/bin/python -m prisma generate

migrate:
	cd backend && PATH=".venv/bin:$$PATH" .venv/bin/python -m prisma migrate dev

seed:
	cd backend && python -m app.db.seed

test:
	cd backend && pytest -v
	cd frontend && npm run test

lint:
	cd backend && ruff check .
	cd frontend && npm run lint

format:
	cd backend && ruff format .
	cd frontend && npm run format

clean:
	docker-compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/.next frontend/node_modules
