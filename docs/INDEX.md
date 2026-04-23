# Local AI Assistant Documentation Index

Complete documentation reference for Local AI Assistant - an enterprise RAG platform for policy document management and intelligent querying.

---

## Quick Start

| Document | Description | Audience |
|----------|-------------|----------|
| [../README.md](../README.md) | Project overview, quick start, and setup instructions | All |
| [tech/INFRASTRUCTURE.md](tech/INFRASTRUCTURE.md) | Docker deployment, environment setup, operations | DevOps, Admins |

---

## Core Architecture

Technical architecture and system design documentation.

| Document | Description | Key Topics |
|----------|-------------|------------|
| [tech/SOLUTION.md](tech/SOLUTION.md) | Complete system architecture, RAG pipeline, design decisions | System overview, RAG pipeline, category system, authentication |
| [tech/DATABASE.md](tech/DATABASE.md) | PostgreSQL schema, Qdrant collections, Redis patterns, Kysely ORM | Database tables, relationships, vector storage, caching strategy |
| [tech/INFRASTRUCTURE.md](tech/INFRASTRUCTURE.md) | Docker deployment, profile-based provider selection, scalability guide, backup/restore | Container orchestration, environment configuration, infrastructure selection, operations, health checks |
| [tech/auth.md](tech/auth.md) | Authentication system setup and configuration | Microsoft OAuth, Google OAuth, credentials login, access control, user management |
| [tech/Bot-Config-architecture.md](tech/Bot-Config-architecture.md) | Configuration architecture and settings management | Configuration layers, settings hierarchy |

---

## API Documentation

REST API specifications and integration guides.

| Document | Description | Key Topics |
|----------|-------------|------------|
| [API/API_SPECIFICATION.md](API/API_SPECIFICATION.md) | Complete REST API reference | Authentication, endpoints, request/response formats, error codes |

---

## Feature Documentation

Detailed guides for specific features and capabilities.

### AI Enhancements

| Document | Description | Key Topics |
|----------|-------------|------------|
| [features/PROMPTS.md](features/PROMPTS.md) | Prompts system guide | Global prompts, category prompts, starter prompts, acronyms, variables, optimization |
| [features/SKILLS.md](features/SKILLS.md) | Skills system guide | Trigger types (always-on, category, keyword), match types, tool routing, priority system, examples |

### Tools & Integrations

| Document | Description | Key Topics |
|----------|-------------|------------|
| [features/Tools.md](features/Tools.md) | Tools system documentation | Web search, document generation, data sources |

### Local Deployment

| Document | Description | Key Topics |
|----------|-------------|------------|
| [features/air-gapped-deployment.md](features/air-gapped-deployment.md) | Air-gapped deployment guide | Offline installation, local models, network isolation |

---

## User Manuals

Guides for different user roles and workflows.

### End Users

| Document | Description | Audience |
|----------|-------------|----------|
| [user_manuals/USER_GUIDE.md](user_manuals/USER_GUIDE.md) | Complete end user guide | Regular users |

**Key Sections:**
- Getting started and authentication
- Chatting and asking questions
- File uploads (PDFs, images, documents)
- Thread management
- Sources and citations
- Artifacts panel

### Administrators

| Document | Description | Audience |
|----------|-------------|----------|
| [user_manuals/ADMIN_GUIDE.md](user_manuals/ADMIN_GUIDE.md) | Complete admin dashboard guide | System administrators |

**Key Sections:**
- Dashboard overview and statistics
- Categories management
- Users and roles
- Documents and uploads
- Prompts configuration (global, category, acronyms)
- Skills management (always-on, category, keyword)
- Tools configuration and API keys
- Tool routing rules
- Data sources (APIs, CSV)
- RAG Testing (built-in retrieval test suite)
- Settings (LLM, RAG, reranker, memory)
- System management, backup/restore

### Superusers

| Document | Description | Audience |
|----------|-------------|----------|
| [user_manuals/SUPERUSER_GUIDE.md](user_manuals/SUPERUSER_GUIDE.md) | Category manager guide | Department managers, superusers |

**Key Sections:**
- Dashboard and category management
- User subscription management
- Document uploads (category-specific)
- Prompts customization (category addendums)
- Tools configuration overrides
- Data sources (category-specific)

---

## Documentation by Topic

### Authentication & Access Control

- [tech/auth.md](tech/auth.md) - **Complete authentication guide** (OAuth setup, credentials login, admin management)
- [tech/SOLUTION.md § Authentication Flow](tech/SOLUTION.md#12-authentication-flow) - Authentication architecture
- [tech/SOLUTION.md § User Roles & Permissions](tech/SOLUTION.md#user-roles--permissions) - Role hierarchy
- [user_manuals/ADMIN_GUIDE.md § Users](user_manuals/ADMIN_GUIDE.md#4-users) - User management
- [API/API_SPECIFICATION.md § Authentication](API/API_SPECIFICATION.md) - API authentication

### Categories & Document Management

- [tech/SOLUTION.md § Category System](tech/SOLUTION.md#1-category-system) - Category architecture
- [tech/DATABASE.md](tech/DATABASE.md) - Database schema for categories and documents
- [user_manuals/ADMIN_GUIDE.md § Categories](user_manuals/ADMIN_GUIDE.md#3-categories) - Category management
- [user_manuals/ADMIN_GUIDE.md § Documents](user_manuals/ADMIN_GUIDE.md#5-documents) - Document uploads and processing

### RAG (Retrieval-Augmented Generation)

- [tech/SOLUTION.md § RAG Pipeline](tech/SOLUTION.md#2-rag-pipeline) - RAG architecture and flow
- [user_manuals/ADMIN_GUIDE.md § Settings](user_manuals/ADMIN_GUIDE.md#13-settings) - RAG configuration
- [user_manuals/USER_GUIDE.md § Sources and Citations](user_manuals/USER_GUIDE.md) - How sources work

### AI Configuration

- [features/PROMPTS.md](features/PROMPTS.md) - System and category prompts
- [features/SKILLS.md](features/SKILLS.md) - Contextual AI behaviors
- [user_manuals/ADMIN_GUIDE.md § Prompts](user_manuals/ADMIN_GUIDE.md#6-prompts) - Prompt management UI
- [user_manuals/ADMIN_GUIDE.md § Skills](user_manuals/ADMIN_GUIDE.md#7-skills) - Skills management UI

### Tools & Function Calling

- [features/Tools.md](features/Tools.md) - Complete tools documentation
- [features/SKILLS.md](features/SKILLS.md) - Skill-based tool routing
- [user_manuals/ADMIN_GUIDE.md § Tools](user_manuals/ADMIN_GUIDE.md#8-tools) - Tools configuration UI
- [user_manuals/ADMIN_GUIDE.md § Tool Routing](user_manuals/ADMIN_GUIDE.md#9-tool-routing) - Routing rules UI

### Deployment & Operations

- [tech/INFRASTRUCTURE.md](tech/INFRASTRUCTURE.md) - Complete deployment guide
- [tech/INFRASTRUCTURE.md § Operations](tech/INFRASTRUCTURE.md#operations) - Monitoring, backup, updates
- [tech/INFRASTRUCTURE.md § Troubleshooting](tech/INFRASTRUCTURE.md#troubleshooting) - Common issues

### Data Sources & External APIs

- [features/Tools.md § Data Source Tool](features/Tools.md#data-source-tool) - API and CSV integration
- [user_manuals/ADMIN_GUIDE.md § Data Sources](user_manuals/ADMIN_GUIDE.md#11-data-sources) - Data source configuration

---

## Feature Matrix

Quick reference for feature availability by user role.

| Feature | User | Superuser | Admin |
|---------|------|-----------|-------|
| **Chat & Query** | ✅ | ✅ | ✅ |
| **Thread Management** | ✅ | ✅ | ✅ |
| **File Upload (threads)** | ✅ | ✅ | ✅ |
| **Document Upload (categories)** | ❌ | ✅ (assigned) | ✅ (all) |
| **User Management** | ❌ | ✅ (assigned) | ✅ (all) |
| **Category Management** | ❌ | ✅ (assigned) | ✅ (all) |
| **Prompts (global)** | ❌ | ❌ (read-only) | ✅ |
| **Prompts (category)** | ❌ | ✅ (assigned) | ✅ (all) |
| **Skills Management** | ❌ | ✅ (priority 100+, assigned) | ✅ (all) |
| **Tool Configuration** | ❌ | ✅ (overrides) | ✅ (global) |
| **Tool Routing** | ❌ | ❌ | ✅ |
| **Data Sources** | ❌ | ✅ (assigned) | ✅ (all) |
| **RAG Testing** | ❌ | ❌ | ✅ |
| **System Settings** | ❌ | ❌ | ✅ |
| **Backup/Restore** | ❌ | ✅ (own org) | ✅ (all) |

---

## Technology Stack Reference

| Technology | Documentation |
|------------|---------------|
| **Next.js 16** | [tech/SOLUTION.md § Technology Stack](tech/SOLUTION.md#technology-stack) |
| **PostgreSQL** (database) | [tech/DATABASE.md](tech/DATABASE.md), [tech/DB-techstack.md](tech/DB-techstack.md) |
| **Qdrant** (vector store) | [tech/DATABASE.md](tech/DATABASE.md), [tech/INFRASTRUCTURE.md § Selection Guide](tech/INFRASTRUCTURE.md#infrastructure-selection-guide) |
| **Redis** | [tech/DATABASE.md](tech/DATABASE.md) |
| **Kysely** (DB abstraction) | [tech/DATABASE.md § Abstraction Layer](tech/DATABASE.md#database-abstraction-layer-kysely) |
| **Ollama** (local LLM) | [tech/SOLUTION.md](tech/SOLUTION.md), [features/air-gapped-deployment.md](features/air-gapped-deployment.md) |
| **Docker** | [tech/INFRASTRUCTURE.md § Docker Compose](tech/INFRASTRUCTURE.md#docker-compose--profile-based-services) |
| **Traefik** | [tech/INFRASTRUCTURE.md](tech/INFRASTRUCTURE.md) |

---

## External Service Integrations

Documentation for third-party API integrations.

| Service | Purpose | Documentation |
|---------|---------|---------------|
| **Ollama** | Local LLM inference (air-gapped) | [tech/SOLUTION.md](tech/SOLUTION.md), [features/air-gapped-deployment.md](features/air-gapped-deployment.md) |
| **Azure AD** | Enterprise SSO | [tech/auth.md § Microsoft Azure AD](tech/auth.md#microsoft-azure-ad) |
| **Google OAuth** | Google sign-in | [tech/auth.md § Google OAuth](tech/auth.md#google-oauth) |
| **Tavily** | Web search, URL extraction | [features/Tools.md § Web Search](features/Tools.md#web-search-tool) |
| **Cohere** | API-based reranking | [user_manuals/ADMIN_GUIDE.md § Settings](user_manuals/ADMIN_GUIDE.md#13-settings) |

---

## Troubleshooting Guides

| Issue Area | Documentation |
|------------|---------------|
| **Deployment Issues** | [tech/INFRASTRUCTURE.md § Troubleshooting](tech/INFRASTRUCTURE.md#troubleshooting) |
| **Admin Dashboard** | [user_manuals/ADMIN_GUIDE.md § Troubleshooting](user_manuals/ADMIN_GUIDE.md#15-troubleshooting) |
| **Superuser Dashboard** | [user_manuals/SUPERUSER_GUIDE.md § Troubleshooting](user_manuals/SUPERUSER_GUIDE.md#13-troubleshooting) |
| **Tool Issues** | [user_manuals/ADMIN_GUIDE.md § Troubleshooting](user_manuals/ADMIN_GUIDE.md#15-troubleshooting) |

---

## Version History

This documentation index tracks major documentation updates.

| Version | Date | Changes |
|---------|------|---------|
| **1.0** | April 2026 | Initial release - Local-only deployment with Ollama |

---

## Contributing to Documentation

When updating documentation:

1. **Keep it current**: Update docs alongside code changes
2. **Cross-reference**: Link related documentation sections
3. **Use examples**: Include practical examples and code snippets
4. **Update this index**: Add new documents to the appropriate sections
5. **Version updates**: Note significant changes in Version History above

### Documentation Standards

- **Format**: Use Markdown with GitHub Flavored Markdown extensions
- **Structure**: Include table of contents for documents >500 lines
- **Code Blocks**: Use appropriate syntax highlighting
- **Links**: Use relative paths for internal documentation
- **Diagrams**: Use ASCII art for simple flows, Mermaid for complex diagrams
- **Screenshots**: Include when beneficial, but maintain as separate files

---

## Getting Help

- **General Questions**: See [user_manuals/USER_GUIDE.md](user_manuals/USER_GUIDE.md)
- **Admin Tasks**: See [user_manuals/ADMIN_GUIDE.md](user_manuals/ADMIN_GUIDE.md)
- **Technical Issues**: See [tech/INFRASTRUCTURE.md § Troubleshooting](tech/INFRASTRUCTURE.md#troubleshooting)
- **API Integration**: See [API/API_SPECIFICATION.md](API/API_SPECIFICATION.md)
- **Feature Requests**: Contact your system administrator

---

*Last updated: April 2026 (v1.0)*
