# Tools System

This document describes the AI tools system that extends the bot's capabilities beyond text generation.

---

## Table of Contents

1. [Overview](#overview)
2. [Web Search Tool](#web-search-tool)
3. [Document Generator Tool](#document-generator-tool)
4. [Data Source Tool](#data-source-tool)
5. [Function API Tool](#function-api-tool)
6. [Tool Routing](#tool-routing)
7. [Tool Configuration](#tool-configuration)
8. [Category-Level Overrides](#category-level-overrides)
9. [Creating a New Tool](#creating-a-new-tool)
10. [API Reference](#api-reference)

---

## Overview

Tools are capabilities that extend the AI assistant beyond basic text generation. The system supports autonomous tools that are triggered via OpenAI function calling - the AI decides when to call them based on user queries.

### Architecture

```
User Message
    ↓
AI receives tool definitions
    ↓
AI decides to call tool → returns tool_call with args
    ↓
Backend executes tool
    ↓
Tool result returned to AI
    ↓
AI generates final response using tool results
```

### Current Available Tools

| Tool | Description |
|------|-------------|
| `web_search` | Search the web for current information |
| `doc_gen` | Generate formatted documents (PDF, DOCX, Markdown) |
| `data_source` | Query external APIs and CSV data with visualization |
| `function_api` | Dynamic function calling with OpenAI-format schemas |

---

## Web Search Tool

### Purpose

Enables the AI to search the web for current information when local documents are insufficient or when users need up-to-date data.

### Provider

**Tavily API** - A search API optimized for AI applications with support for:
- Topic-specific searches (general, news, finance)
- Domain filtering (include/exclude)
- Configurable search depth

### Configuration

```typescript
interface WebSearchConfig {
  apiKey: string;              // Tavily API key (required)
  defaultTopic: 'general' | 'news' | 'finance';
  defaultSearchDepth: 'basic' | 'advanced';
  maxResults: number;          // 1-20, default: 10
  includeDomains: string[];    // Only search these domains
  excludeDomains: string[];    // Never search these domains
  cacheTTLSeconds: number;     // 60-2592000, default: 3600
  includeAnswer: 'none' | 'basic' | 'advanced';  // AI-generated answer summary
}
```

### Default Configuration

```json
{
  "enabled": false,
  "config": {
    "apiKey": "",
    "defaultTopic": "general",
    "defaultSearchDepth": "advanced",
    "maxResults": 10,
    "includeDomains": [],
    "excludeDomains": [],
    "cacheTTLSeconds": 3600,
    "includeAnswer": "basic"
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "web_search",
  "description": "Search the web for current information, news, or data not available in the organizational knowledge base.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query to find relevant web information"
      },
      "max_results": {
        "type": "number",
        "description": "Number of results (1-20). Use higher values for comprehensive research, lower for quick facts. Defaults to admin setting if not specified."
      },
      "search_depth": {
        "type": "string",
        "enum": ["basic", "advanced"],
        "description": "Search depth: 'basic' for quick searches (3-5 results), 'advanced' for thorough research (10+ results). Defaults to admin setting."
      },
      "include_answer": {
        "type": "string",
        "enum": ["none", "basic", "advanced"],
        "description": "Include AI-generated answer: 'none' = disabled, 'basic' = quick summary, 'advanced' = comprehensive analysis. Defaults to admin setting."
      }
    },
    "required": ["query"]
  }
}
```

### Caching

- Results are cached in Redis using query as key
- Cache TTL is configurable (default: 1 hour)
- Cache is invalidated when configuration changes

### Example Usage

**User:** "What are the latest government guidelines on remote work?"

**AI Response:**
> Based on my web search, here are the latest remote work guidelines:
>
> According to a recent announcement from gov.sg...
>
> Sources:
> - 🌐 [WEB] gov.sg - Remote Work Guidelines (searched: Dec 2024)

---

## Document Generator Tool

### Purpose

Enables the AI to generate formatted documents in multiple formats (PDF, DOCX, Markdown) with customizable branding.

### Supported Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| **PDF** | `.pdf` | Official documents, reports |
| **DOCX** | `.docx` | Editable Word documents |
| **Markdown** | `.md` | Technical documentation |

### Configuration

```typescript
interface DocGenConfig {
  defaultFormat: 'pdf' | 'docx' | 'md';
  enabledFormats: ('pdf' | 'docx' | 'md')[];
  branding: {
    enabled: boolean;
    logoUrl?: string;
    organizationName?: string;
    primaryColor?: string;      // Hex color (e.g., "#1E40AF")
    fontFamily?: string;
  };
  header: {
    enabled: boolean;
    content?: string;           // Header text
  };
  footer: {
    enabled: boolean;
    content?: string;           // Footer text
    includePageNumber: boolean;
  };
  expirationDays: number;       // 0 = never expire, default: 30
  maxDocumentSizeMB: number;    // 1-100, default: 50
}
```

### Default Configuration

```json
{
  "enabled": true,
  "config": {
    "defaultFormat": "pdf",
    "enabledFormats": ["pdf", "docx", "md"],
    "branding": {
      "enabled": false,
      "logoUrl": "",
      "organizationName": "",
      "primaryColor": "#1E40AF",
      "fontFamily": "Helvetica"
    },
    "header": {
      "enabled": false,
      "content": ""
    },
    "footer": {
      "enabled": false,
      "content": "",
      "includePageNumber": true
    },
    "expirationDays": 30,
    "maxDocumentSizeMB": 50
  }
}
```

### OpenAI Function Schema

```json
{
  "name": "doc_gen",
  "description": "Generate a formatted document from the conversation content. Use this when the user asks for a report, summary, or document export.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string",
        "description": "Document title"
      },
      "content": {
        "type": "string",
        "description": "Document content in Markdown format"
      },
      "format": {
        "type": "string",
        "enum": ["pdf", "docx", "md"],
        "description": "Output format"
      }
    },
    "required": ["title", "content", "format"]
  }
}
```

### Document Builders

The document generation system uses specialized builders for each format:

| Builder | File | Technology |
|---------|------|------------|
| PDF Builder | `pdf-builder.ts` | PDFKit |
| DOCX Builder | `docx-builder.ts` | docx library |
| MD Builder | `md-builder.ts` | File writer |

### Storage and Expiration

- Generated documents are stored in `/uploads/outputs/`
- Documents can be set to expire after N days
- Download count is tracked per document
- Expired documents are automatically cleaned up

### Example Usage

**User:** "Create a PDF summary of our leave policy discussion"

**AI Response:**
> I've generated a PDF document summarizing our leave policy discussion.
>
> 📄 [Download Leave Policy Summary (PDF)](link)
>
> The document includes:
> - Annual leave entitlements
> - Application procedures
> - Approval workflow

---

## Data Source Tool

### Purpose

Enables the AI to query external APIs and CSV data sources, with automatic visualization of results.

### Features

- **API Integration**: Call REST APIs with custom headers and authentication
- **CSV Support**: Query CSV files with SQL-like syntax
- **Automatic Visualization**: Charts are generated for tabular results
- **Secure Execution**: API keys are stored encrypted and never exposed to the AI

### Configuration

```typescript
interface DataSourceConfig {
  encryptionKey: string;        // AES-256 encryption key for API keys
  maxRows: number;              // Maximum rows to return (default: 1000)
  timeout: number;              // Request timeout in ms (default: 30000)
  cacheTTL: number;             // Cache results in seconds (default: 300)
}
```

### Data Source Types

#### REST API Sources

```json
{
  "type": "api",
  "name": "Sales API",
  "baseUrl": "https://api.example.com/v1",
  "auth": {
    "type": "bearer",          // "bearer", "basic", "api_key", "none"
    "key": "encrypted_api_key"
  },
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

#### CSV Sources

```json
{
  "type": "csv",
  "name": "Product Catalog",
  "url": "/data/products.csv",
  "description": "Product inventory data"
}
```

### OpenAI Function Schema

```json
{
  "name": "data_source",
  "description": "Query external data sources (APIs or CSV files) to retrieve structured data for analysis.",
  "parameters": {
    "type": "object",
    "properties": {
      "sourceName": {
        "type": "string",
        "description": "Name of the data source to query"
      },
      "query": {
        "type": "string",
        "description": "Query or request parameters"
      },
      "method": {
        "type": "string",
        "enum": ["GET", "POST"],
        "description": "HTTP method (default: GET)"
      }
    },
    "required": ["sourceName", "query"]
  }
}
```

### Visualization

When data source returns tabular data, the system automatically generates charts:

| Data Type | Chart Type |
|-----------|------------|
| Time series | Line chart |
| Categorical | Bar chart |
| Proportions | Pie chart |
| Two variables | Scatter plot |

### Security

- All API keys are encrypted at rest using AES-256-GCM
- Keys are decrypted only at request time, never logged
- Data source URLs can be restricted to internal network
- Request timeout prevents hanging connections

---

## Function API Tool

### Purpose

Enables dynamic function calling with custom OpenAI-format schemas. Allows integration with any external API or service without modifying core code.

### Features

- **Custom Schemas**: Define any OpenAI-compatible function schema
- **Flexible Execution**: Execute arbitrary HTTP requests
- **Schema Management**: Admin UI for creating and managing function definitions
- **Secure Parameters**: Sensitive parameters can be marked as hidden

### Configuration

```typescript
interface FunctionAPIConfig {
  enabled: boolean;
  functions: FunctionDefinition[];
}

interface FunctionDefinition {
  id: string;
  name: string;
  description: string;
  parameters: object;           // OpenAI function schema
  endpoint: string;             // URL to call
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'api_key';
    key: string;                // Encrypted
  };
  timeout?: number;
}
```

### OpenAI Function Schema

The function API tool passes through the custom schema directly to the LLM:

```json
{
  "name": "function_api",
  "description": "Call a custom function API defined by the administrator.",
  "parameters": {
    "type": "object",
    "properties": {
      "functionId": {
        "type": "string",
        "description": "ID of the function to call"
      },
      "parameters": {
        "type": "object",
        "description": "Parameters matching the function's schema"
      }
    },
    "required": ["functionId", "parameters"]
  }
}
```

### Example Use Cases

| Function | Description |
|----------|-------------|
| `get_weather` | Fetch weather data for a location |
| `search_calendar` | Query calendar events |
| `create_ticket` | Create a support ticket in external system |
| `lookup_product` | Product database lookup |

---

## Tool Routing

Tool routing allows administrators to force specific tools based on message patterns, bypassing the LLM's default tool selection.

### Routing Rules

```typescript
interface ToolRoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;             // Higher = checked first
  matchType: 'keyword' | 'regex' | 'category';
  pattern: string;              // Match pattern
  forcedTool: string;           // Tool to invoke
  categoryId?: string;          // Optional: only for specific category
}
```

### Rule Evaluation

1. Rules are evaluated in priority order (highest first)
2. First matching rule wins
3. If no rules match, LLM uses default tool selection

### Example Rules

| Priority | Match Type | Pattern | Forced Tool |
|----------|------------|---------|-------------|
| 100 | keyword | "generate report" | doc_gen |
| 90 | regex | "^search\s+\w+" | web_search |
| 80 | category | "sales" | data_source |

---

## Tool Configuration

Tools are configured through the Admin dashboard at **Admin → Tools**.

### Global Configuration

Each tool has:
- **Enabled/Disabled** - Toggle tool availability
- **Config** - Tool-specific settings
- **Category Overrides** - Per-category configuration

### Per-Category Overrides

Superusers can override tool settings for their assigned categories:

```json
{
  "categoryId": "sales",
  "toolName": "web_search",
  "config": {
    "maxResults": 5,
    "defaultTopic": "finance"
  }
}
```

---

## Category-Level Overrides

Tools can be configured differently per category. This allows:
- Restricting certain tools in sensitive categories
- Customizing tool behavior for specific departments
- Enabling/disabling tools based on category needs

### Override Precedence

1. Category override (if exists)
2. Global tool configuration
3. System defaults

---

## Creating a New Tool

To add a new tool to the system:

### 1. Create Tool Implementation

Create a new file in `src/lib/tools/`:

```typescript
// src/lib/tools/my-new-tool.ts
import { Tool, ToolResult } from './types';

export const myNewTool: Tool = {
  name: 'my_new_tool',
  description: 'Description of what this tool does',
  
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    // Tool implementation
    return {
      success: true,
      data: { /* result */ }
    };
  }
};
```

### 2. Register in Tool Registry

Add to `src/lib/tools.ts`:

```typescript
import { myNewTool } from './tools/my-new-tool';

export const TOOLS = {
  // ... existing tools
  my_new_tool: myNewTool,
};
```

### 3. Define Function Schema

Add the OpenAI function schema to the tool definition for LLM compatibility.

### 4. Add Configuration UI (Optional)

If the tool needs configurable parameters, add settings in the Admin dashboard.

---

## API Reference

### Test Tool Connection

```
POST /api/admin/tools/[toolName]/test
```

Tests a tool's configuration and connection.

**Response:**
```json
{
  "tool": "web_search",
  "success": true,
  "message": "Connection successful (245ms latency)",
  "latency": 245,
  "testedAt": "2024-01-15T10:30:00Z",
  "testedBy": "admin@example.com"
}
```

### Get Tool Configuration

```
GET /api/admin/tools/[toolName]
```

### Update Tool Configuration

```
PUT /api/admin/tools/[toolName]
```

### Get All Tools

```
GET /api/admin/tools
```

Returns list of all available tools with their current configuration status.