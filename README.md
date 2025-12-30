# DriveWise

Belgian driving license theory questions API with Vite + Express hybrid architecture.

## Features

- **3,682 questions** covering all Belgian driving theory topics
- **i18n-ready** schema supporting Dutch, French, German, and English
- **Region-specific** questions (Brussels, Flanders, Wallonia, National)
- **LLM-powered rephrasing** using Claude 3.5 Sonnet
- **Exam simulation** with authentic Belgian scoring rules

## Tech Stack

- **Frontend**: Vite (React-ready)
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **LLM**: Anthropic Claude 3.5 Sonnet

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- PostgreSQL 14+
- Anthropic API key (for content rephrasing)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your database URL and API keys

# Generate and run database migrations
npm run db:generate
npm run db:push
```

### Data Pipeline

Process the raw question data:

```bash
# Run the full pipeline
npm run data:pipeline

# Or run steps individually:
npm run data:cleanup    # Clean HTML, normalize IDs
npm run data:rephrase   # Rephrase with Claude (requires API key)
npm run data:validate   # Validate data integrity
npm run data:seed       # Seed database
```

### Development

```bash
# Start development server (Vite + Express)
npm run dev

# Open http://localhost:3000
```

### Production

```bash
# Build for production
npm run build

# Start production server
npm run preview
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/locales` | List available locales |
| GET | `/api/regions` | List regions |
| GET | `/api/categories` | List categories |
| GET | `/api/categories/:slug/questions` | Get questions in category |
| GET | `/api/questions/:id` | Get single question |
| GET | `/api/questions/random` | Get random questions |
| GET | `/api/exam/config` | Get exam configuration |
| POST | `/api/exam/generate` | Generate exam questions |
| POST | `/api/exam/score` | Calculate exam score |

## Belgian Driving Theory Exam

The exam follows official Belgian rules:

- **50 questions** per exam
- **41 correct** to pass (82%)
- **Major faults** = 5 points deducted
- **Minor faults** = 1 point deducted
- **Time limit** = 90 minutes

## Adding React Frontend

The project is ready for React:

```bash
# Install React
npm install react react-dom @types/react @types/react-dom
npm install -D @vitejs/plugin-react

# Update vite.config.ts to add React plugin
# Replace src/main.ts with your React app
```

## Project Structure

```
drive-wise/
├── src/                    # Frontend (Vite/React)
├── server/                 # Backend (Express API)
│   ├── db/                 # Drizzle schema & migrations
│   ├── routes/             # API routes
│   └── types/              # TypeScript types
├── scripts/                # Data processing scripts
├── data/                   # Processed data files
└── data_final.json         # Original question data
```

## License

ISC

