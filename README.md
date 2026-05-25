# The Rezzies — React Native MVP

A social group goal-achievement platform built with React Native (Expo) and Supabase.

## Architecture

- **Frontend:** React Native with Expo (managed workflow), Expo Router
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **State:** Zustand
- **Navigation:** Expo Router (file-based)

## Features (MVP v1)

1. **Auth** — email sign-up/sign-in/sign-out with Supabase Auth
2. **Create Program** — sponsor flow: name the program, add daily habits (name + point weight), add monthly bonus challenges
3. **Invite Members** — generate a join code; participants join via code
4. **Daily Check-in** — habit checklist with progress ring, daily points, streak tracking
5. **Live Leaderboard** — ranked by habits completed (month + year columns, points secondary)

## Architecture Constraints (v2 Ready)

- **Scoring Engine:** Abstracted with `registerHandler()` pattern. 7 scoring types (`DAILY_HABIT`, `MONTHLY_BONUS`, `COMPETITIVE`, `TOURNAMENT`, `HURDLE`, `HURDLE_PLUS_BONUS`, `PERSONAL_GOAL`, `WEARABLE_AUTO` stub). Adding v2 types requires only registering a new handler.
- **Data Model:** Sponsor → Group → Participant hierarchy from day one. `participants.role` supports `SPONSOR|ADMIN|PARTICIPANT|VIEWER`.
- **Wearable Integration:** `WEARABLE_AUTO` scoring handler and `health_data_consent` flag built in. Daily check schema identical to what Terra/Vital webhook would write.
- **Prize/Rewards:** `prize_pool_amount` and `prize_config` JSON on Program entity. v1 displays only; Stripe wires in v2 with zero schema changes.
- **Consent Framework:** `health_data_consent` boolean on both `profiles` and `participants` tables (defaults false).

## Quick Start

### Prerequisites

- Node.js 18+
- Expo Go app on your iOS/Android device
- A Supabase project (free tier works)

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration:
   - Copy contents of `supabase/migrations/001_schema.sql`
3. Enable Email Auth in Authentication → Providers
4. Get your project URL and anon key from Settings → API

### 2. Environment

```bash
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

### 3. Install and Run

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your device, or press `i` for iOS simulator.

## Project Structure

```
app/                   # Expo Router pages
├── (auth)/            # Sign in / sign up
├── (tabs)/            # Home (check-in), Leaderboard, Profile
├── create-program.tsx # Program creation wizard
└── join-program.tsx   # Join via invite code

src/
├── engine/scoring.ts  # Abstracted scoring engine
├── stores/            # Zustand stores (auth, program, habit)
├── components/        # UI components
├── lib/supabase.ts    # Supabase client
└── types/index.ts     # TypeScript definitions

supabase/
└── migrations/        # Database schema (200 lines SQL)
```

## Scoring Engine

The scoring engine uses a handler registry pattern. Each `scoringType` has a dedicated handler function:

```typescript
import { score } from './src/engine/scoring';

// Daily habit check-in
const result = score({
  type: 'DAILY_HABIT',
  participant_id: '...',
  program_id: '...',
  payload: { habitIds: ['h1', 'h2'], habitPoints: { h1: 15, h2: 10 } },
});
// result: { points: 25, habit_count: 2, details: { habits_completed: [...] } }
```

Adding `WEARABLE_AUTO` in v2: `registerHandler('WEARABLE_AUTO', handler)`. Nothing else changes.

## License

Private — all rights reserved.
