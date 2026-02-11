# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SentryOS Desktop Emulator** - A browser-based desktop environment built with Next.js 16 where AI-powered agents run as windowed applications. This is a hackathon project demonstrating Sentry monitoring integration with a unique desktop metaphor UI.

## Development Commands

```bash
# Development (uses pnpm)
pnpm install          # Install dependencies
pnpm dev              # Start dev server on http://localhost:3000
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # Run ESLint

# Add new shadcn/ui components
npx shadcn@latest add [component-name]

# Add Sentry agent skills
npx skills add getsentry/sentry-agent-skills --yes
```

## High-Level Architecture

### Desktop Environment Pattern

The entire UI is a **single-page desktop emulator**:
- **WindowManager** (`src/components/desktop/WindowManager.tsx`) - Context provider that manages all open windows (create, minimize, maximize, close, z-index ordering)
- **Desktop** (`src/components/desktop/Desktop.tsx`) - Main shell with desktop icons, taskbar, and window rendering. All app windows are React components registered here
- **Window** (`src/components/desktop/Window.tsx`) - Draggable/resizable window wrapper using `react-rnd`

To add a new desktop app: create opener function in `Desktop.tsx` → call `openWindow()` with your component → add to desktop icons or Agents folder.

### AI Agent Architecture

AI agents follow a **three-tier streaming pattern**:

1. **API Route** (`src/app/api/*/route.ts`)
   - Runs server-side with Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
   - Accepts `POST { messages, model? }`
   - Streams responses via Server-Sent Events (SSE)
   - Never expose SDK directly to client

2. **React Component** (`src/components/desktop/apps/*.tsx`)
   - Client component (`'use client'`)
   - Fetches API route and consumes SSE stream
   - Renders markdown with `ReactMarkdown` + `remarkGfm`
   - Shows tool usage indicators in real-time

3. **Desktop Registration** (in `Desktop.tsx`)
   - Import component
   - Create `openXYZ()` function
   - Add to `agentsFolderItems` or desktop icons

**Critical**: Frontend never calls Claude SDK directly. All AI logic stays server-side for security and API key protection.

### SSE Streaming Protocol

API routes emit these event types:
- `text_delta` - Streaming text chunks
- `tool_start` - Agent invokes a tool (WebSearch, Read, etc.)
- `tool_progress` - Tool execution update with elapsed time
- `done` - Successful completion
- `error` - Failure with message
- `[DONE]` - Final stream termination signal

See `src/app/api/chat/route.ts` for reference implementation.

### Sentry Observability

**Important**: This project uses custom Sentry logging and metrics wrappers.

- **Always use** `src/lib/sentry-utils.ts` wrappers, not direct Sentry imports
- `logger.info/warn/error()` - Structured logging that falls back to console if Sentry unavailable
- `metrics.increment/distribution/gauge()` - Custom metrics that fail silently if API missing
- `captureException()` - Safe exception capture

**Why wrappers?** The Sentry metrics API may not be available client-side or in all contexts. Wrappers prevent "is not a function" errors and allow graceful degradation.

## Environment Setup

Required environment variables (`.env.local`):

```bash
NEXT_PUBLIC_SENTRY_DSN=    # Sentry project DSN
SENTRY_ORG=                # Sentry organization slug
SENTRY_PROJECT=            # Sentry project name
SENTRY_AUTH_TOKEN=         # Auth token for source maps (optional in dev)
```

## Styling & Design System

- **Framework**: Tailwind CSS v4 only - no CSS modules or styled-components
- **Components**: shadcn/ui (Radix UI primitives)
- **Icons**: `lucide-react` only
- **Theme**: Dark mode only with Sentry brand colors:
  - Primary: `#7553ff` (purple)
  - Accent: `#ff45a8` (pink)
  - Window BG: `#1e1a2a`
  - Header BG: `#2a2438`
  - Border: `#362552`

## Key Patterns to Follow

### Agent Development

Read `AGENTS.md` for comprehensive agent-building guide. Key points:
- Three-section layout: header, scrollable content, bottom input/actions
- Stream all responses - never return blocking JSON
- Map SDK tool names to friendly display names (see AGENTS.md tool table)
- Use proper SSE headers: `text/event-stream`, `no-cache`, `keep-alive`

### Window Management

```typescript
// Open a new window
openWindow({
  id: 'unique-id',           // kebab-case
  title: 'Window Title',
  icon: '🤖',                // emoji
  x, y, width, height,
  minWidth, minHeight,
  isMinimized: false,
  isMaximized: false,
  content: <YourComponent />
})
```

Windows are automatically:
- Draggable by title bar
- Resizable from edges/corners
- Managed in z-index stack
- Shown in taskbar when minimized

### Sentry Logging Pattern

```typescript
import { logger, metrics, captureException } from '@/lib/sentry-utils'

// Log events with context
logger.info('Action started', { userId, timestamp })

// Track metrics
metrics.increment('feature.used', 1, { tags: { feature: 'chat' }})
metrics.distribution('response.time', duration, { unit: 'millisecond' })

// Capture errors
try {
  // ...
} catch (error) {
  logger.error('Operation failed', { error: error.message })
  captureException(error)
}
```

## Technology Stack

- **Next.js 16** - App Router, Server Components, React 19
- **TypeScript** - Strict typing throughout
- **Claude Agent SDK** - AI agent orchestration with tool use
- **Sentry** - Error tracking, performance monitoring, custom metrics
- **react-rnd** - Draggable/resizable windows
- **Tailwind CSS v4** - Utility-first styling
- **shadcn/ui** - Component library (Radix UI + Tailwind)

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (agent backends)
│   │   └── chat/
│   │       └── route.ts  # SSE streaming agent endpoint
│   ├── layout.tsx        # Root layout with Sentry
│   └── page.tsx          # Main page (loads Desktop)
├── components/
│   ├── desktop/          # Desktop environment
│   │   ├── Desktop.tsx   # Shell + agent registration
│   │   ├── WindowManager.tsx  # Window state management
│   │   ├── Window.tsx    # Draggable window wrapper
│   │   ├── Taskbar.tsx   # Bottom taskbar
│   │   └── apps/         # Desktop applications
│   │       ├── Chat.tsx  # AI chat agent (reference impl)
│   │       ├── FolderView.tsx
│   │       └── Notepad.tsx
│   └── ui/               # shadcn/ui components
└── lib/
    ├── sentry-utils.ts   # Safe Sentry wrappers (USE THIS)
    └── utils.ts          # cn() utility

Root:
├── AGENTS.md             # Comprehensive agent-building guide
├── sentry.client.config.ts
├── sentry.server.config.ts
├── sentry.edge.config.ts
└── instrumentation.ts    # Next.js instrumentation hook
```

## Common Workflows

### Adding a New Agent

1. Create API route: `src/app/api/your-agent/route.ts`
2. Create component: `src/components/desktop/apps/YourAgent.tsx`
3. Register in `Desktop.tsx`: import, create opener, add to icons/folder
4. Follow SSE streaming pattern from `chat/route.ts`

See AGENTS.md for detailed step-by-step guide with code examples.

### Testing Sentry Integration

After making changes:
1. Check browser console for any "is not a function" errors
2. Verify logs appear in console (fallback when Sentry unavailable)
3. Check Sentry dashboard for captured events and metrics
4. Navigate to project at https://sentry.io

### Debugging SSE Streams

- Open browser DevTools → Network tab → filter by "chat" or agent name
- Click the request → Preview tab shows SSE events in real-time
- Check for proper `data: ` prefix and `[DONE]` termination
- Verify JSON parsing doesn't fail on malformed events
