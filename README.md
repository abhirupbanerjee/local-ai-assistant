# Local AI Assistant

**An open-source, local AI platform for governments, ministries, and enterprises.**

Deploy AI-powered solutions across your organization while maintaining complete control over your data and infrastructure. All AI processing happens locally—no external API calls, no data leaves your premises.

## Why Local AI Assistant?

Governments and organizations face a critical challenge: **how to adopt AI responsibly** while meeting regulatory requirements for data protection and avoiding external dependencies.

Local AI Assistant solves this by providing:

| Requirement | How We Deliver |
|-------------|----------------|
| **Data Sovereignty** | All data remains on your infrastructure—databases, vector stores, and files never leave your control |
| **Local-Only AI** | Ollama-powered LLM inference—no external API calls, works in air-gapped environments |
| **Open Source** | MIT licensed, fully auditable code |
| **No Lock-In** | Standard PostgreSQL database, portable vector stores, exportable configurations |
| **Zero ML Complexity** | Admin dashboard handles all configuration—no data scientists required |
| **Enterprise Security** | Role-based access, department isolation, audit trails |

## Use Cases

Deploy across ministries, departments, and public-facing services:

| Domain | Application |
|--------|-------------|
| **Citizen Services** | 24/7 portals answering queries on government policies, procedures, permits, and entitlements |
| **Customer Support** | AI helpdesk with knowledge base integration, ticket routing, and escalation workflows |
| **Policy & Compliance** | RAG-powered Q&A on internal policies with source citations and version tracking |
| **Internal Knowledge** | Unified search across organizational documents, procedures, and institutional memory |

## Technical Foundation

Built with enterprise-grade, open-source technologies:

- **Next.js 16** - Modern React 19 framework with server-side rendering and App Router
- **PostgreSQL** - Battle-tested relational database via Kysely ORM
- **Qdrant** - Open-source vector database for semantic search
- **Ollama** - Local LLM inference (Llama, Qwen, Mistral, Phi models)
- **Redis** - High-performance caching and session management
- **Traefik** - Production-ready reverse proxy with automatic TLS

## Capabilities

### Core Features
- **RAG-Powered Q&A** - Natural language queries with source citations
- **Local LLM** - Ollama-powered inference (no external API calls)
- **Streaming Responses** - Real-time chat with typing indicators
- **Artifacts Panel** - Right sidebar showing uploads and generated content

### Document Management
- **Category Organization** - Documents grouped by department (HR, Finance, IT, etc.)
- **Multi-Format Upload** - PDF, DOCX, XLSX, PPTX (up to 500MB, configurable)
- **Text Content Upload** - Paste text directly, bypasses OCR
- **Thread Uploads** - PDF, TXT, PNG, JPG, WebP files per conversation
- **Web URL Extraction** - Extract web page content via Tavily

### Access Control
- **Three-Tier Roles** - Admin > SuperUser > User hierarchy
- **Category Subscriptions** - Users access only subscribed categories
- **Flexible Authentication** - Email/Password, Google OAuth, or Azure AD

### AI Enhancements
- **Prompts System** - Global and category-specific AI instructions
- **Skills System** - Modular behaviors triggered by category/keyword/always-on
- **Tool Routing** - Pattern-based forced tool invocation
- **Configurable Limits** - Per-category tool call and maximum token limits
- **User Memory** - Recall user-specific facts across conversations
- **Thread Summarization** - Compress long conversations
- **Reranking** - Local BGE reranker or Cohere API

### Tools
- **Web Search** - Tavily integration for current information
- **Data Sources** - Query external APIs and CSV files
- **Function APIs** - OpenAI-style function calling with custom schemas
- **Document Generation** - Create PDF, DOCX, Markdown files

## Directory Structure

```
local-ai-assistant/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # REST API endpoints
│   │   │   ├── chat/           # RAG chat (streaming)
│   │   │   ├── threads/        # Thread CRUD + file uploads
│   │   │   ├── admin/          # Admin endpoints (documents, users, categories, settings)
│   │   │   ├── superuser/      # SuperUser endpoints (global scope)
│   │   │   └── user/           # User-scoped endpoints
│   │   ├── admin/              # Admin dashboard UI
│   │   ├── superuser/          # SuperUser dashboard UI
│   │   └── page.tsx            # Chat interface
│   ├── components/             # React components
│   │   ├── chat/               # Chat UI (messages, input, sources)
│   │   ├── admin/              # Admin dashboard components
│   │   └── ui/                 # Shared UI components
│   ├── lib/                    # Core libraries
│   │   ├── db/                 # Database layer — PostgreSQL via Kysely
│   │   │   ├── compat/         # Database access modules
│   │   │   ├── schema/         # PostgreSQL schema
│   │   │   └── db-types.ts     # TypeScript types for all tables
│   │   ├── tools/              # Tool implementations
│   │   ├── rag.ts              # RAG pipeline
│   │   ├── redis.ts            # Redis caching
│   │   ├── ingest.ts           # Document ingestion
│   │   └── skills.ts           # Skills system
│   └── types/                  # TypeScript definitions
├── docs/                       # Documentation
├── docker-compose.yml          # Production stack
├── docker-compose.local.yml    # Local development stack
└── Dockerfile                  # Multi-stage build
```

## Quick Start

### Development

**Important:** Start infrastructure services **before** the app to ensure the database is ready when the app initializes.

```bash
# Copy environment template
cp .env.example .env.local

# 1. Start infrastructure services first (PostgreSQL, Qdrant, Redis, Ollama)
docker compose -f docker-compose.local.yml --profile ollama up -d

# 2. Wait for PostgreSQL to be ready (10 seconds recommended)
sleep 10

# 3. Install dependencies and start the app
npm install && npm run dev
```

**Note:** The app automatically creates admin users from `ADMIN_EMAILS` in `.env.local` on first startup. If the database isn't ready, this may fail. The app now includes retry logic, but waiting ensures a smooth first run.

### Stopping Services
```bash
# Stop all services (preserves data)
docker compose -f docker-compose.local.yml down

# Stop and remove data volumes (clean start)
docker compose -f docker-compose.local.yml down -v
```

### Production
```bash
# Configure .env with auth providers and domain

# PostgreSQL + Qdrant + Ollama
docker compose --profile qdrant --profile ollama up -d --build
```

## Infrastructure

| Service | Purpose | Profile |
|---------|---------|---------|
| **Traefik** | Reverse proxy + TLS (ports 80, 443) | Default |
| **Next.js** | Application (port 3000) | Default |
| **Redis** | Cache + sessions (port 6379) | Default |
| **PostgreSQL** | Relational database (port 5432) | `--profile postgres` |
| **Qdrant** | Vector database (ports 6333/6334) | `--profile qdrant` |
| **Ollama** | Local LLM inference | `--profile ollama` |

## Configuration

### Required

```bash
# Local LLM (Ollama)
OLLAMA_API_BASE=http://localhost:11434  # Or host.docker.internal

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/local-ai-assistant
```

### Optional

```bash
# Authentication (at least one)
AZURE_AD_CLIENT_ID=...
GOOGLE_CLIENT_ID=...

# Web Search
TAVILY_API_KEY=...

# RAG Enhancements
COHERE_API_KEY=...                 # Or use local BGE reranker

# Data Source Encryption
DATA_SOURCE_ENCRYPTION_KEY=...
```

See `.env.example` for complete configuration reference.

## License

**MIT License**

This software is free to use for any purpose. See [LICENSE](LICENSE) for full terms.
