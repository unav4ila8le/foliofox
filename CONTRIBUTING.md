# Contributing to Foliofox

First off, thanks for taking the time to contribute!

I'm Leonardo the founder of Foliofox. All types of contributions are encouraged and valued.
See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. The community looks forward to your contributions.

> And if you like the project, but just don't have time to contribute, that's fine. There are other easy ways to support the project and show your appreciation:
>
> - Star the project
> - Share it on Reddit/X
> - Refer this project in your project's readme
> - Mention it to friends/colleagues or at your local meetup

If you need help, feel free to reach out to [@unav4ila8le](https://x.com/unav4ila8le).

## Table of Contents

- [Local Development](#local-development)
- [Types](#types)
- [Linting & Formatting](#linting--formatting)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [Legal Notice](#legal-notice)

## Local Development

### Prerequisites

- Node.js 22+
- Supabase CLI 2.5+ (`supabase --version`; you can also run it via `npx supabase` if you prefer not to install globally)
- Your own Supabase project (Project URL, anon/publishable key, service_role/secret key, database password)
- Optional: Docker Desktop (only needed if you want to run the local Supabase stack)
- Optional: Vercel account (for one-click deploy and scheduled cron jobs)

### 1) Clone and install

```bash
git clone https://github.com/unav4ila8le/foliofox.git
cd foliofox
npm install
git pull # stay up to date with upstream
```

### 2) Configure environment

Create a `.env.local` file in the project root:

```bash
# Required
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_or_secret_key

# Optional (used to authorize cron invocations)
CRON_SECRET=generate_a_strong_random_string

# Optional (used for AI features)
OPENAI_API_KEY=your_openai_api_key

# Optional (used for domain valuations)
REPLICATE_API_TOKEN=your_replicate_api_token

# Optional (used for PostHog)
NEXT_PUBLIC_POSTHOG_KEY=<ph_project_api_key>
NEXT_PUBLIC_POSTHOG_HOST=https://<us | eu>.i.posthog.com
```

### 3) Apply database migrations (Supabase CLI)

```bash
supabase login                # once per machine
supabase link --project-ref <your-project-ref>
supabase db push --linked     # applies tracked migrations (baseline + new ones)
```

- You can safely re-run `supabase db push --linked` whenever you need to resync with the repo; it only applies migrations that have not yet been recorded in your project.
- The tracked migrations include the reference data (currencies + position categories) required for signup and basic usage.
- If prompted, use the **Database Password** from Supabase (Settings → Database).

### 4) Run the dev server

```bash
npm run dev
```

Visit http://localhost:3000

#### Optional: run Supabase locally (requires Docker)

```bash
supabase start                # boots the Supabase stack in Docker
supabase migration up --local # applies the tracked migrations to the local DB
```

- Update your `.env.local` with the new local credentials by running `supabase status -o env` and mapping the output to the environment variables:
  - `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
- The CLI prints the local connection string (`postgresql://postgres:postgres@localhost:54322/postgres` by default).
- Reset the local database with `supabase db reset --local` (it will replay all migrations and seed data). 
- You can regenerate types with `supabase gen types typescript --local > types/database.types.ts`.
- You can also run `supabase db push --local` if you prefer the same command as remote projects.
- Stop the stack with `supabase stop` when you are done.

#### Maintainers: creating database changes

1. Generate a migration shell:
   ```bash
   supabase migration new add_feature_name
   ```
2. Edit the generated SQL file in `supabase/migrations/`.
3. Test locally:
   ```bash
   supabase migration up --local
   ```
4. Apply remotely:
   ```bash
   supabase db push --linked
   ```
5. Commit the migration file along with any related code changes.

- If you update reference tables (currencies, position categories), edit the `*_seed_reference_data.sql` migration or add a new seed migration so contributors stay in sync.

### 5) Generate TypeScript types from Supabase

If you use your own Supabase project, regenerate `types/database.types.ts`:

```bash
supabase login
supabase link --project-ref <your-project-ref>
# Option A: use the provided script (update project id in package.json first)
npm run types:supabase
# Option B: ad-hoc generation
supabase gen types typescript --project-id <your-project-ref> > types/database.types.ts
```

### 6) (Optional) Deploy to Vercel

- Import the repo into Vercel.
- Set the same environment variables (Project Settings → Environment Variables).
- `vercel.json` includes daily cron jobs at 22:00 UTC for quotes and FX updates.
- Cron endpoints expect `Authorization: Bearer <CRON_SECRET>`.

If headers can’t be configured in your environment, trigger manually:

```bash
# Exchange rates
curl "http://localhost:3000/api/cron/fetch-exchange-rates" \
  -H "authorization: Bearer $CRON_SECRET"

# Quotes
curl "http://localhost:3000/api/cron/fetch-quotes" \
  -H "authorization: Bearer $CRON_SECRET"
```

### Package dependencies notes

N/A

## Types

We use strict TypeScript for type safety. Some rules to follow:

- Never use `any` type. Implicit or explicit.
- Prefer `unknown` over `any`. Refine the type.
- Always type your function parameters and return values explicitly; do not rely on implicit any or inference.
- Do not use `as` type assertions. The only exception is `as const`.

## Linting & Formatting

Our linter will catch most styling issues that may exist in your code.

- Check lint status: `npm run lint`
- Check formatting: `npm run format`

## Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): summary`

- Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`
- Scope: folder or domain, e.g. `server/positions`, `app/dashboard`, `ai`

Examples:

```text
feat(positions): add cost basis override to new position form
fix(exchange-rates): handle missing base currency fallback
docs(contributing): document commit conventions and pr checklist
```

## Pull Request Guidelines

- Keep PRs small and focused; one change per PR.
- Target the `main` branch for all PRs.
- Title should follow Conventional Commits if possible.
- Link related issues, if any: Closes #123.
- Describe what/why; include screenshots for UI changes.
- Tests if applicable; no lint/type errors; run locally.
- Follow project rules (RSC-first, TypeScript strict, server actions in server/, import order, naming).
- Avoid breaking changes; if unavoidable, document migration in the PR.
- For features, note performance, accessibility, and data model impacts.

## Reporting Bugs

First search existing [issues](https://github.com/unav4ila8le/foliofox/issues). If nothing matches, open a new [issue](https://github.com/unav4ila8le/foliofox/issues/new).

- Ensure you’re on the latest version of `main`.
- Provide clear expected vs actual behavior.
- Include steps to reproduce (ideally a minimal example and screenshots/screen recodings if they apply). If there are no reproduction steps or no obvious way to reproduce the issue, I will ask you for those steps and mark the issue as `needs repro`. Bugs with the `needs-repro` tag will not be addressed until they are reproduced.
- Add environment details (OS, Node, package manager).
- **Security issues:** [report a vulnerability](https://github.com/unav4ila8le/foliofox/security) (do not post security issues publicly).

## Suggesting Enhancements

- Search existing [issues](https://github.com/unav4ila8le/foliofox/issues).
- Explain current vs desired behavior and why it helps most users.
- Include alternatives considered and, if helpful, screenshots or references.

## Legal Notice

By contributing to Foliofox, you agree that your contributions will be licensed under its MIT license.

<!-- TODO
 create an issue template for bugs and errors that can be used as a guide and that defines the structure of the information to be included. -->
