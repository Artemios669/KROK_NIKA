# AGENTS.md

- **Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind/CSS modules (`app/styles.css`), Supabase (@supabase/supabase-js), OpenAI SDK, Google GenAI SDK, Vitest.
- **Commands**:
  - Dev server: `pnpm dev`
  - Build: `pnpm build`
  - Run tests: `pnpm test` (uses Vitest)
- **Environment & Demo Mode**:
  - Works out-of-the-box without credentials in a clear demo mode (`lib/demo-data.ts`).
  - Optional Supabase & LLM integrations via `.env.local` (copy from `.env.example` if present, or configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, etc.).
- **Key Architecture**:
  - `app/`: Next.js App Router pages and API routes (`app/api/`).
  - `lib/`: Business logic, matching algorithm (`lib/matching/`), AI clients (`lib/ai/`), validation (`lib/validation/`).
  - `supabase/`: SQL migrations (`supabase/migrations/`) and seed scripts.
  - `tests/`: Unit tests for core logic (e.g. matching tests).
