# Loggi 🐾

A Progressive Web App for tracking dog care events — feeding, walking, toilet breaks, medication, and more. Built for multi-dog households to keep everyone in the pack on the same page.

## Features

- **Quick-log events** — Tap to log feed, walk, toilet, or meds in one click
- **Full event logging** — Detailed form with event type, notes, and toilet subtypes (pee/poo/accident)
- **Multi-dog support** — Add multiple dogs to your household
- **Household sharing** — Share an invite code so other household members can log events too
- **Today's events timeline** — See everything logged today at a glance
- **Dog profiles** — View event history, track weight over time, edit dog details
- **PWA** — Installable on mobile and desktop, works offline with service worker caching

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Storage)
- **Auth:** Supabase Auth UI
- **PWA:** vite-plugin-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### Setup

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your Supabase project credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

### Database Setup

The app expects the following Supabase tables:

- `Household` — id, name, inviteCode, createdBy, createdAt
- `HouseholdMember` — householdId, userId, role, status, joinedAt
- `Dogs` — dogId, dogName, householdId, age, weight, notes, dogImage
- `DogEvent` — id, dogId, type, subtype, isAccident, timestamp, userId, note
- `WeightLog` — id, dogId, weight, recordedAt

## Project Structure

```
src/
├── App.tsx                    # Main app component, screen routing, state management
├── types/core.ts              # Shared domain types
├── components/
│   └── DogStatusCard.tsx      # Reusable dog status card with quick-log buttons
├── screens/
│   ├── AuthScreen.tsx         # Login/signup via Supabase Auth UI
│   ├── HouseholdSetupScreen.tsx  # Create or join a household
│   ├── LogEventScreen.tsx     # Full event logging form
│   ├── RegisterNewDogScreen.tsx  # Add a new dog to the household
│   └── DogProfileScreen.tsx   # View/edit dog profile, event history, weight tracking
└── lib/
    ├── supabase.ts            # Supabase client initialization
    └── utils.ts               # Utility functions (getTimeAgo)
```

## License

MIT
