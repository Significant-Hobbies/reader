# Web Annotator

A modern web application for capturing and annotating articles with a distraction-free reading experience.

## Problem

Information overload is real. You find valuable articles across the web, but there's no easy way to save them in a clean format, annotate them with your thoughts, and organize them for future reference. Browser bookmarks are cluttered, read-it-later apps lack annotation capabilities, and note-taking tools don't handle web content well.

Web Annotator solves this by providing a personal research library where you can capture, read, annotate, and organize web content in one place.

## Features

- **Clean Article Extraction**: Save articles from any URL using Mozilla Readability
- **Rich Annotations**: Add contextual notes with optional DOM anchoring
- **Selection Actions**: Right-click selected article text to quickly `Add note` or `Ask AI`
- **AI-Powered Chat**: Ask questions about your articles and notes using BYOK providers (OpenAI, Anthropic, Gemini, Gateway) or local CLI mode, with chat history persisted per article
- **Project Organization**: Group related articles into projects
- **Customizable Reader**: Adjust theme (light/dark/sepia), font family (sans/serif/mono), and text size
- **Reading Progress**: Track which articles you're reading or have completed
- **Secure & Private**: Google Sign-In authentication with per-user data isolation

## Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React 19 + Next.js 16 Frontend]
        UI --> |Tailwind CSS| Styling[UI Components]
        UI --> |React Query| State[State Management]
    end

    subgraph "API Layer"
        API[Next.js API Routes]
        API --> Articles[/api/articles]
        API --> Projects[/api/projects]
        API --> Auth[/api/auth]
        API --> AI[/api/ai]
        API --> Snapshot[/api/snapshot]
    end

    subgraph "Backend Services"
        Firebase[Firebase]
        Firebase --> FireAuth[Authentication]
        Firebase --> Firestore[Firestore Database]

        External[External Services]
        External --> Readability[Mozilla Readability]
        External --> AIProviders[AI Providers]
        AIProviders --> OpenAI[OpenAI]
        AIProviders --> Anthropic[Anthropic]
        AIProviders --> Gemini[Google Gemini]
        AIProviders --> Gateway[Custom Gateway]
        AIProviders --> CLIBridge[Local CLI Bridge]
    end

    UI --> API
    API --> Firebase
    API --> External

    classDef frontend fill:#3b82f6,stroke:#1e40af,color:#fff
    classDef backend fill:#10b981,stroke:#047857,color:#fff
    classDef external fill:#f59e0b,stroke:#d97706,color:#fff

    class UI,Styling,State frontend
    class API,Articles,Projects,Auth,AI,Snapshot,Firebase,FireAuth,Firestore backend
    class External,Readability,AIProviders,OpenAI,Anthropic,Gemini,Gateway,CLIBridge external
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **AI Integration**: Vercel AI SDK + AI Gateway (preferred), BYOK chat providers, local CLI bridge support
- **Deployment**: Optimized for Vercel

## Getting Started

### Prerequisites

- Node.js 24.x
- Firebase project with Firestore and Google Authentication enabled

### Installation

1. Clone the repository and install dependencies:

   ```bash
   git clone <repository-url>
   cd web-annotator
   npm install
   ```

2. Set up Firebase:
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
   - Enable Google Sign-In in Authentication settings
   - Create a Firestore database
   - Download your service account JSON from Project Settings > Service Accounts
   - Convert the service account JSON to base64 (use this same value for local and Vercel):

   ```bash
   # macOS
   base64 firebase-service-account.json | tr -d '\n'

   # Linux
   base64 -w0 firebase-service-account.json
   ```

3. Configure environment variables:

   ```bash
   cp env.example .env.local
   ```

   Edit `.env.local` with your Firebase credentials:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   FIREBASE_SERVICE_ACCOUNT_KEY=your_base64_service_account_json
   CLI_BRIDGE_URL=http://127.0.0.1:3456  # Optional: for local AI mode
   ```

4. Run the development server:

   ```bash
   npm run dev
   ```

   `npm run dev` starts both the Next.js app and local `cli-bridge`.
   Local CLI providers are shown only in development mode.
   If you only want the app server:

   ```bash
   npm run dev:app
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Development Commands

```bash
npm run dev          # Start Next.js + local AI CLI bridge
npm run dev:app      # Start only Next.js app
npm run cli-bridge   # Start only local AI CLI bridge
npm run dev:with-cli # Alias for npm run dev
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run type-check   # Check TypeScript types
```

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add the same Firebase environment variables used locally:
   - All `NEXT_PUBLIC_FIREBASE_*` variables
   - `FIREBASE_SERVICE_ACCOUNT_KEY` (same base64 value as local)
4. Keep local and Vercel configs in sync by pulling from Vercel when needed:

```bash
vercel env pull .env.local --environment=production
```

## Project Structure

```
web-annotator/
├── src/
│   ├── app/              # Next.js pages and API routes
│   │   ├── api/          # Backend API endpoints
│   │   ├── login/        # Authentication pages
│   │   └── reader/       # Article reader view
│   ├── components/       # React components
│   ├── lib/              # Business logic and utilities
│   └── types.ts          # TypeScript definitions
├── public/               # Static assets
└── AGENTS.md             # Development guide
```

## Development

This project uses automated pre-commit hooks for code quality:

- Prettier (formatting)
- ESLint (linting)
- TypeScript (type checking)

Commit convention follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(reader): add PDF export
fix(auth): resolve token refresh issue
chore: update dependencies
```

For comprehensive development documentation, see [AGENTS.md](./AGENTS.md).

## Security

- All HTML content is sanitized before storage
- User authentication required for all operations
- Per-user data isolation enforced at the database level
- Ownership verification on all operations
- BYOK model for AI providers (API keys stored in browser only)

## License

This project is private and not licensed for public use.
