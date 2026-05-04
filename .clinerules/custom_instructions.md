# Project Context: Loggi (Dog Care Log)

A React + TypeScript + Vite PWA for tracking dog care events (feeding, walking, toilet, meds, etc.) with Supabase backend.

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS
- Backend: Supabase (Postgres, Auth, Storage)
- Auth: Supabase Auth UI
- PWA: vite-plugin-pwa

## Key Files

- `src/App.tsx` — Main app component, screen routing, state management
- `src/types/core.ts` — Shared domain types (Dog, CareEvent, EventType, Household, etc.)
- `src/components/DogStatusCard.tsx` — Reusable dog status card with quick-log buttons
- `src/screens/AuthScreen.tsx` — Login/signup via Supabase Auth UI
- `src/screens/HouseholdSetupScreen.tsx` — Create or join a household
- `src/screens/LogEventScreen.tsx` — Full event logging form
- `src/screens/RegisterNewDogScreen.tsx` — Add a new dog to the household
- `src/screens/DogProfileScreen.tsx` — View/edit dog profile, event history, weight tracking
- `src/lib/supabase.ts` — Supabase client initialization
- `src/lib/utils.ts` — Utility functions (getTimeAgo)

## Coding Conventions

- Use TypeScript strictly — define interfaces in `src/types/core.ts`
- Use Tailwind CSS for all styling (no CSS modules or styled-components)
- Use functional components with hooks (no class components)
- Use `crypto.randomUUID()` for generating IDs
- Use `supabase` client from `src/lib/supabase.ts` for all DB operations
- Use `getTimeAgo()` from `src/lib/utils.ts` for relative timestamps
- Use `EVENT_DISPLAY` from `DogStatusCard.tsx` for event type labels/colours
- Use `EVENT_COLOURS` pattern from `DogProfileScreen.tsx` for event display in profiles

## Branch & Commit Rules

- **DO NOT commit or push changes to any branch unless explicitly instructed to do so by the user.**
- Present all proposed changes as a plan first and wait for explicit approval before implementing.
- When implementing approved changes, create a descriptive branch name (e.g. `fix/household-scoping`, `feat/push-notifications`).
- Keep commits focused and use descriptive commit messages explaining the "why" not just the "what".

## Data Model Notes

- Dogs belong to a household via `householdId`
- Events belong to a dog via `dogId`
- Users belong to households via `HouseholdMember` join table
- All data queries should be scoped to the current household
