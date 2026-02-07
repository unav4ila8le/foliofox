# Foliofox

A net worth tracking app with an AI-powered financial advisor that helps you make smarter decisions about your portfolio. **Foliofox is not a budgeting or an expense tracking app.**

![hero](/public/images/github/readme-hero.png)

## Features

- **Interactive portfolio visualization** - See your wealth grow with engaging charts and tables, not boring spreadsheets
- **AI-powered financial insights** - Get personalized advice, not generic market data
- **Multi-currency support** - Automatic exchange rates for global portfolios
- **Smart portfolio import** - One-click import from any broker or spreadsheet with AI
- **Daily market data** - Powered by Yahoo Finance
- **Secure, private and open source** - Your data stays yours

## Built with

- Next.js 16 (App Router, Turbopack, Cache Components)
- TypeScript (Strict Mode)
- Supabase (Postgres, Auth, Storage)
- Tailwind CSS

## Vision

If you’re curious about why Foliofox exists and where it’s going, read the full vision here: [VISION.md](./VISION.md)

## Quick Start (Docker)

**Prerequisites:** Docker Desktop and your own Supabase project (see [CONTRIBUTING.md](/CONTRIBUTING.md) for details).

1. Clone and configure:

   ```bash
   git clone https://github.com/unav4ila8le/foliofox.git
   cd foliofox
   ```

2. Create `.env.local` with your [Supabase](https://supabase.com/) credentials:

   ```bash
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   SUPABASE_SECRET_KEY=your_supabase_secret_key
   ```

3. Apply database migrations:

   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push --linked
   ```

4. Start with Docker using latest pre-built image:

   ```bash
   docker compose -f docker-compose.ghcr.yml up
   ```

   Or build locally:

   ```bash
   docker compose up --build
   ```

Visit <http://localhost:3000>

For local Node.js setup without Docker, see the [contributing guide](/CONTRIBUTING.md).

## Contributing

Please read the [contributing guide](/CONTRIBUTING.md).

Join our [Discord server](https://discord.gg/9AGutMkvUR).

## Roadmap

> Foliofox started as personal project with me as a single maintainer, so the roadmap lived here in the README. Now that it’s public, the roadmap has been migrated to GitHub Issues for better tracking and collaboration.

## License

MIT © 2025 주식회사 파운더스레어. See [LICENSE](https://github.com/unav4ila8le/foliofox/blob/main/LICENSE) for details.
