# DriveWise

Belgian driving license theory questions API with Vite + Express hybrid architecture.

## Features

- **3,682 questions** covering all Belgian driving theory topics
- **i18n-ready** schema supporting Dutch, French, German, and English
- **Region-specific** questions (Brussels, Flanders, Wallonia, National)
- **LLM-powered rephrasing** using Claude 3.5 Sonnet
- **Exam simulation** with authentic Belgian scoring rules
- **OAuth authentication** (Google) for user persistence
- **Bookmarks** - save questions for later or mark as difficult
- **Session history** - track all exam attempts with detailed analytics
- **Statistics & insights** - weakest categories, license probability, progress over time
- **Admin dashboard** - view all users and their progress (admin-only)

## Tech Stack

- **Frontend**: Vite (React-ready)
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Passport.js + JWT (Google OAuth)
- **LLM**: Anthropic Claude 3.5 Sonnet

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- PostgreSQL 14+
- Google Cloud Project with OAuth credentials
- Anthropic API key (for content rephrasing, optional)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Production | Secret key for JWT signing (defaults to dev secret) |
| `ASSETS_BASE_URL` | No | Base URL for question assets/images |
| `OAUTH_CALLBACK_URL` | No | Base URL for OAuth callbacks (default: `http://localhost:3000/api/auth`) |
| `FRONTEND_URL` | No | Frontend URL for OAuth redirects (default: `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth Client Secret |
| `ADMIN_EMAILS` | No | Comma-separated list of admin email addresses |
| `ANTHROPIC_API_KEY` | No | For LLM-powered content rephrasing |
| `NODE_ENV` | No | `development` or `production` |
| `PORT` | No | Server port (default: 3000) |

### Installation

```bash
# Install dependencies
npm install

# Set environment variables (create .env file)
# DATABASE_URL=postgresql://user:password@localhost:5432/drivewise
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# JWT_SECRET=your-production-secret

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

Full API documentation available at `/api/docs` (Swagger UI).

### Public Endpoints

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
| POST | `/api/exam/score` | Calculate exam score (persists if authenticated) |

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/providers` | List available OAuth providers |
| GET | `/api/auth/{provider}` | Initiate OAuth flow |
| GET | `/api/auth/{provider}/callback` | OAuth callback handler |
| GET | `/api/auth/me` | Get current user profile |
| PATCH | `/api/auth/me` | Update user preferences |
| POST | `/api/auth/refresh` | Refresh JWT token |
| DELETE | `/api/auth/unlink/{provider}` | Unlink OAuth provider from account |

### Authenticated Endpoints (require Bearer token)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookmarks` | Get user's bookmarked questions |
| POST | `/api/bookmarks` | Bookmark a question |
| PATCH | `/api/bookmarks/:id` | Update bookmark notes/type |
| DELETE | `/api/bookmarks/:id` | Remove a bookmark |
| GET | `/api/bookmarks/check/:questionId` | Check if question is bookmarked |
| GET | `/api/exam/history` | Get exam session history |
| GET | `/api/exam/session/:id` | Get detailed session results |
| GET | `/api/stats/overview` | Get overall performance stats |
| GET | `/api/stats/categories` | Get performance by category |
| GET | `/api/stats/progress` | Get progress over time |
| GET | `/api/stats/difficult-questions` | Get most missed questions |
| GET | `/api/stats/ready-for-exam` | Get exam readiness assessment |

### Admin Endpoints (require admin email)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | Get all registered users with their progress |
| GET | `/api/admin/stats` | Get platform-wide statistics |

## OAuth Authentication

The API uses **Passport.js** for a flexible, extensible authentication system supporting multiple OAuth providers.

### Discover Available Providers

```bash
GET /api/auth/providers
# Returns list of configured providers with their auth URLs
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → **APIs & Services > Credentials**
3. Create **OAuth 2.0 Client ID** (Web application)
4. Add redirect URI: `http://localhost:3000/api/auth/google/callback`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables

### Frontend Integration

```javascript
// 1. Redirect user to OAuth provider
window.location.href = '/api/auth/google';

// 2. Handle callback on your frontend route /auth/callback
const token = new URLSearchParams(window.location.search).get('token');
localStorage.setItem('token', token);

// 3. Make authenticated requests
fetch('/api/bookmarks', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

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
│   ├── auth/               # Authentication
│   │   └── passport.ts     # Passport.js config & OAuth strategies
│   ├── db/                 # Drizzle schema & migrations
│   │   ├── schema.ts       # Database schema (users, oauth_accounts, bookmarks, etc.)
│   │   └── migrations/     # SQL migrations
│   ├── middleware/         # Express middleware
│   │   └── auth.ts         # JWT verification middleware
│   ├── routes/             # API routes
│   │   ├── auth.ts         # Multi-provider OAuth endpoints
│   │   ├── bookmarks.ts    # Bookmark management
│   │   ├── exam.ts         # Exam generation & scoring
│   │   ├── stats.ts        # Performance statistics
│   │   └── ...             # Other routes
│   └── types/              # TypeScript types
├── scripts/                # Data processing scripts
├── data/                   # Processed data files
└── data_final.json         # Original question data
```

## License

ISC

