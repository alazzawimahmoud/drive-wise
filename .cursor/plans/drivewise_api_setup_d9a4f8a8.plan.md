---
name: DriveWise API Setup
overview: Create a Vite + Express hybrid application with PostgreSQL database, including data cleanup, LLM-powered content rephrasing (Claude), and normalization scripts. Frontend-ready architecture for adding React later.
todos:
  - id: project-setup
    content: Initialize Vite + Express hybrid project with TypeScript and dependencies
    status: completed
  - id: db-schema
    content: Design and create PostgreSQL schema with Drizzle ORM (i18n-ready, region tags, original content columns)
    status: completed
    dependencies:
      - project-setup
  - id: cleanup-script
    content: Build data cleanup script (HTML normalization, ID unification, seriesId normalization, region detection)
    status: completed
    dependencies:
      - project-setup
  - id: rephrase-script
    content: Build LLM rephrasing script using Claude API (questions + explanations)
    status: completed
    dependencies:
      - cleanup-script
  - id: validation-script
    content: Create automated validation script (structure, meaning preservation checks)
    status: completed
    dependencies:
      - rephrase-script
  - id: seed-script
    content: Build database seeder to import cleaned + rephrased data
    status: completed
    dependencies:
      - db-schema
      - validation-script
  - id: api-routes
    content: Implement API endpoints (categories, questions, quiz generation with hardcoded exam rules)
    status: completed
    dependencies:
      - seed-script
  - id: documentation
    content: Add API documentation and usage examples
    status: completed
    dependencies:
      - api-routes
---

# DriveWise API and Data Cleanup Plan

## Design Decisions

| Aspect | Decision | Rationale ||--------|----------|-----------|| **i18n** | Translation tables (i18n-ready) | Support Dutch now, add French/German/English later || **Regions** | Tag questions by region | Brussels has different rules than Flanders/Wallonia || **Versioning** | None | Keep it simple, current content only || **Lessons** | Keep as-is in explanations | No structured curriculum extraction || **Exam Config** | Hardcoded in API | Belgian exam rules (50 questions, 41 to pass, major faults) || **User Tracking** | Not included | API serves questions only || **Content Rephrasing** | Claude 3.5 Sonnet | Rephrase questions + explanations, keep choices unchanged || **Original Storage** | Keep both | Store original alongside rephrased for reference || **QA Approach** | Automated validation | Structure checks, no manual review || **Frontend Architecture** | Vite + vite-express hybrid | Single server, easy to add React later |---

## Architecture Overview

```mermaid
flowchart LR
    subgraph DataPipeline [Data Pipeline]
        JSON[data_final.json] --> Cleaner[Cleanup Script]
        Cleaner --> Rephraser[LLM Rephraser]
        Rephraser --> Claude[Claude 3.5 API]
        Claude --> Rephraser
        Rephraser --> Validator[Validator]
        Validator --> Seeder[DB Seeder]
    end
    
    subgraph Database [PostgreSQL]
        Locales[(locales)]
        Regions[(regions)]
        Categories[(categories)]
        Questions[(questions)]
        Translations[(translations)]
        Choices[(choices)]
        Assets[(assets)]
    end
    
    Seeder --> Database
    
    subgraph Server [Vite + Express Hybrid]
        Vite[Vite Dev Server] --> Express[Express Server]
        Express --> APIRoutes[API Routes]
        APIRoutes --> Database
        Express --> Static[Static Assets]
    end
```



### Hybrid Server Architecture

```mermaid
flowchart TD
    subgraph Development [Development Mode]
        ViteDev[Vite Dev Server] -->|HMR + Assets| Browser
        ViteDev -->|Proxies /api| ExpressDev[Express]
        ExpressDev -->|JSON| Browser
    end
    
    subgraph Production [Production Mode]
        ExpressProd[Express] -->|Serves dist/| Browser2[Browser]
        ExpressProd -->|API Routes| Browser2
    end
```

---

## LLM Rephrasing Pipeline

### Overview

| Setting | Value ||---------|-------|| **LLM Provider** | Anthropic Claude 3.5 Sonnet || **Content to Rephrase** | Questions and explanations only || **Choices** | Keep unchanged (preserve answer mapping) || **Storage** | Both original and rephrased stored || **Estimated Cost** | ~$25-40 for 3,682 questions || **Quality Assurance** | Automated validation |

### Rephrasing Prompt Strategy

```text
System Prompt:
You are an expert in Belgian traffic law and Dutch language education.
Your task is to rephrase driving theory exam content while:

1. PRESERVING the exact legal meaning - no information added or removed
2. MAINTAINING the same difficulty level and educational clarity
3. USING clear, simple Belgian Dutch (not Netherlands Dutch)
4. KEEPING technical terms accurate (verkeersbord, voorrang, etc.)
5. ENSURING the same answer remains correct after rephrasing

User Prompt:
Rephrase the following driving theory content. Return ONLY valid JSON.

Original Question: {question}
Original Explanation: {explanation}
Answer Type: {answerType}
Number of Choices: {choiceCount}

Response format:
{
  "question": "rephrased question in Dutch",
  "explanation": "rephrased explanation in Dutch"
}
```



### Processing Strategy

```mermaid
flowchart TD
    Start[Load Cleaned Data] --> Batch[Create Batches of 10]
    Batch --> Process[Process Batch]
    Process --> API[Call Claude API]
    API --> Parse[Parse JSON Response]
    Parse --> Validate{Valid JSON?}
    Validate -->|Yes| Save[Save to Progress File]
    Validate -->|No| Retry[Retry with Simplified Prompt]
    Retry --> API
    Save --> More{More Batches?}
    More -->|Yes| Process
    More -->|No| Complete[Output Rephrased Data]
```



### Batch Processing Features

- **Batch size:** 10 questions per API call (balance cost/speed)
- **Progress tracking:** Save after each batch (resume on failure)
- **Rate limiting:** Respect Anthropic API limits
- **Retry logic:** 3 retries with exponential backoff
- **Cost tracking:** Log token usage per batch

### Automated Validation Checks

| Check | Description ||-------|-------------|| **JSON validity** | Response parses as valid JSON || **Field presence** | Both `question` and `explanation` exist || **Length sanity** | Rephrased not drastically shorter/longer (50%-200% of original) || **Language check** | Contains Dutch characters/words || **No English** | Detect accidental English responses || **Answer preservation** | For INPUT type, check expected answer still fits |---

## Updated Database Schema

```mermaid
erDiagram
    locales {
        string code PK "nl-BE, fr-BE, de-BE, en"
        string name
        boolean is_default
    }
    
    regions {
        int id PK
        string code UK "brussels, flanders, wallonia, national"
        string name
    }
    
    categories {
        int id PK
        string slug UK
        int sort_order
    }
    
    category_translations {
        int id PK
        int category_id FK
        string locale FK
        string title
        string description
    }
    
    questions {
        int id PK
        int category_id FK
        int region_id FK
        string original_id
        string answer_type "SINGLE_CHOICE, YES_NO, INPUT, ORDER"
        json answer "index, array, or string"
        boolean is_major_fault
        int source
        int image_asset_id FK
        int video_asset_id FK
    }
    
    question_translations {
        int id PK
        int question_id FK
        string locale FK
        text question_text
        text question_text_original "Stores source text before rephrasing"
        text explanation
        text explanation_original "Stores source explanation before rephrasing"
    }
    
    choices {
        int id PK
        int question_id FK
        int position
        int image_asset_id FK
    }
    
    choice_translations {
        int id PK
        int choice_id FK
        string locale FK
        string text
    }
    
    assets {
        int id PK
        string uuid UK
        string type "image, video"
        string original_url
    }
    
    locales ||--o{ category_translations : has
    locales ||--o{ question_translations : has
    locales ||--o{ choice_translations : has
    
    regions ||--o{ questions : applies_to
    
    categories ||--o{ category_translations : has
    categories ||--o{ questions : contains
    
    questions ||--o{ question_translations : has
    questions ||--o{ choices : has
    questions }o--|| assets : has_image
    questions }o--|| assets : has_video
    
    choices ||--o{ choice_translations : has
    choices }o--|| assets : has_image
```

**Key addition:** `question_text_original` and `explanation_original` columns in `question_translations` to preserve source content.---

## Data Cleanup Pipeline

### Step 1: HTML Normalization

- Decode HTML entities (`&ndash;` to `–`, `&#039;` to `'`, `&lsquo;` to `'`)
- Convert `<br />` and `<br>` to newlines
- Strip `<p>` tags or convert to plain text
- Handle `<strong>` to plain text (or markdown if needed)

### Step 2: ID Unification

- Current: Mixed numeric (`"2854"`) and slug-based (`"voorrang_1471"`)
- Strategy: Keep `original_id` as reference, generate sequential `id` for database

### Step 3: SeriesId Normalization

- Current: Mixed numbers (`61`) and slugs (`"techniekvoertuigengordeldracht"`)
- Strategy: Create unified category slugs, map both formats

### Step 4: Region Detection

- Parse question text and explanations for region-specific content
- Keywords: "Brusselse gewest", "Vlaanderen", "Wallonie"
- Default: `national` if no region specified

### Step 5: Asset Extraction

- Extract all image UUIDs into assets table
- Extract video IDs (YouTube) into assets table
- Build full URLs from `assetsBaseUrl`

### Step 6: LLM Rephrasing (NEW)

- Send cleaned questions + explanations to Claude 3.5 Sonnet
- Store rephrased content alongside originals
- Batch process with progress tracking

### Step 7: Validation

- Check all answers are valid indices/values
- Verify choices exist for non-INPUT types
- Validate rephrased content structure and language
- Flag questions with missing required fields

---

## API Endpoints

| Method | Endpoint | Description ||--------|----------|-------------|| GET | `/api/locales` | List available locales || GET | `/api/regions` | List regions || GET | `/api/categories?locale=nl-BE` | List categories with translations || GET | `/api/categories/:slug/questions` | Get questions in category || GET | `/api/questions/:id` | Get single question with choices || GET | `/api/questions/:id?include_original=true` | Include original text || GET | `/api/questions/random?count=10&category=...` | Random questions || POST | `/api/exam/generate` | Generate exam (50 questions, balanced) || POST | `/api/exam/score` | Calculate exam score with major fault logic |

### Exam Scoring Logic (Hardcoded)

```javascript
Total questions: 50
Pass threshold: 41 correct (82%)
Major fault penalty: 5 points
Minor fault penalty: 1 point
Maximum score: 50 points
Time limit: 90 minutes (client-enforced)
```

---

## Project Structure

```javascript
drive-wise/
├── data_final.json              # Original data
├── package.json
├── tsconfig.json
├── tsconfig.node.json           # TypeScript config for Node/server
├── vite.config.ts               # Vite configuration
├── drizzle.config.ts            # Drizzle Kit configuration
├── .env.example
│
├── src/                         # Frontend (React-ready, currently minimal)
│   ├── main.ts                  # Vite entry point (placeholder for React)
│   └── vite-env.d.ts            # Vite type declarations
│
├── server/                      # Backend (Express API)
│   ├── index.ts                 # Express + vite-express entry
│   ├── app.ts                   # Express app configuration
│   ├── db/
│   │   ├── index.ts             # Drizzle client export
│   │   ├── schema.ts            # Drizzle schema definitions
│   │   └── migrations/          # Generated migrations
│   ├── routes/
│   │   ├── index.ts             # Route aggregator
│   │   ├── categories.ts
│   │   ├── questions.ts
│   │   └── exam.ts
│   ├── services/
│   │   └── examService.ts       # Exam generation & scoring
│   └── types/
│       └── index.ts             # TypeScript interfaces
│
├── scripts/                     # Data processing scripts
│   ├── cleanup.ts               # Data cleanup pipeline
│   ├── rephrase.ts              # LLM rephrasing with Claude
│   ├── validate.ts              # Data validation
│   └── seed.ts                  # Database seeder
│
├── data/                        # Processed data files
│   ├── cleaned.json             # After cleanup, before rephrasing
│   ├── rephrased.json           # After LLM rephrasing
│   └── progress.json            # Rephrasing progress tracker
│
├── public/                      # Static assets (served by Vite)
│   └── .gitkeep
│
└── index.html                   # Vite HTML entry point
```



### Adding React Later

When ready to add React, simply:

1. `npm install react react-dom @types/react @types/react-dom`
2. `npm install @vitejs/plugin-react`
3. Update `vite.config.ts` with React plugin
4. Replace `src/main.ts` with React entry point

---

## Key Dependencies

### Core

- **vite** - Frontend build tool and dev server
- **vite-express** - Vite + Express integration for hybrid server
- **express** - Web framework for API

### Database

- **drizzle-orm** - Type-safe ORM with excellent TypeScript support
- **drizzle-kit** - Migrations and schema management CLI
- **postgres** - PostgreSQL driver (modern, Promise-based)

### Data Processing

- **@anthropic-ai/sdk** - Claude API client for rephrasing
- **zod** - Runtime validation
- **he** - HTML entity decoder
- **p-limit** - Concurrency control for API calls

### Tooling

- **typescript** - Type safety
- **tsx** - TypeScript execution for scripts
- **dotenv** - Environment config

---

## NPM Scripts

```json
{
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build && tsc -p tsconfig.node.json",
    "preview": "NODE_ENV=production node dist/server/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "data:cleanup": "tsx scripts/cleanup.ts",
    "data:rephrase": "tsx scripts/rephrase.ts",
    "data:validate": "tsx scripts/validate.ts",
    "data:seed": "tsx scripts/seed.ts",
    "data:pipeline": "npm run data:cleanup && npm run data:rephrase && npm run data:validate && npm run data:seed"
  }
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/drivewise

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Optional
REPHRASE_BATCH_SIZE=10
REPHRASE_CONCURRENCY=2







```