.PHONY: up down seed lint test

## Start all services
up:
	docker compose up -d --build

## Stop all services
down:
	docker compose down

## Seed the database with historical data from Open-Meteo
seed:
	docker compose exec backend python /scripts/crawl_openmeteo.py

## Run linters
lint:
	cd backend && ruff check . && black --check .
	cd frontend && npm run lint

## Run backend tests
test:
	cd backend && pytest tests/ -v

## Follow logs for all services
logs:
	docker compose logs -f

## Open a psql shell into TimescaleDB
db:
	docker compose exec timescaledb psql -U $$POSTGRES_USER -d $$POSTGRES_DB
