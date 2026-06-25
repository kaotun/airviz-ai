# AirViz.AI

> A full-stack data visualization platform and AI-powered copilot for real-time air quality monitoring across Vietnam.

![Tech Stack](https://img.shields.io/badge/stack-FastAPI%20%7C%20React%20%7C%20TimescaleDB%20%7C%20Redis-blue)
![Data Source](https://img.shields.io/badge/data-Open--Meteo%20API-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Overview

AirViz.AI collects hourly air quality data for all 63 provinces of Vietnam via the **Open-Meteo Air Quality API**, stores it in a **TimescaleDB** time-series database, and exposes it through an interactive dashboard with 5 analytical views. An integrated **AI copilot** powered by Gemini 1.5 Flash enables natural-language querying via a Text2SQL RAG engine with a Human-in-the-loop approval workflow.

## Features

- 📊 **5-tab interactive dashboard** — Overview, Map, Analysis, Comparison, Alerts
- 🗺️ **Choropleth map** — Real-time AQI visualization across 63 provinces
- 🤖 **AI Chatbox** — Text2SQL + Code generation with human approval gate
- ⚡ **Real-time updates** — WebSocket-powered live data refresh
- 🔍 **Global filter** — Synchronized across all charts and views

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript, TanStack Query, Zustand, Recharts, Leaflet |
| Backend | FastAPI, asyncpg, APScheduler |
| Database | TimescaleDB (PostgreSQL), Redis |
| AI | Gemini 1.5 Flash, Text2SQL RAG |
| Data Source | Open-Meteo Air Quality API (free, no API key required) |
| Infrastructure | Docker Compose |

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/kaotun/airviz-ai.git
cd airviz-ai

# 2. Copy and configure environment variables
cp .env.example .env

# 3. Start all services
make up

# 4. Seed the database with historical data (first run only)
make seed

# 5. Open the dashboard
# → http://localhost:5173
```

## Project Structure

```
airviz-ai/
├── backend/        # FastAPI application
├── frontend/       # React + Vite application
├── scripts/        # Data collection & ETL scripts
├── docs/           # Architecture decisions & data audit
├── docker-compose.yml
└── Makefile
```

## Environment Variables

See [`.env.example`](.env.example) for the full list of required variables.

## Documentation

- [System Architecture](ARCHITECTURE.md)
- [Development Phases](PHASES.md)
- [Data Collection Plan](docs/data-plan.md)
- [Data Audit Log](docs/data-audit.md)
