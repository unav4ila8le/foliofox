# Foliofox

A net worth tracking app with an AI-powered financial advisor that helps you make smarter decisions about your portfolio. **Foliofox is not a budgeting or an expense tracking app.**

![hero](/public/images/github/readme-hero.png)

## Features

- **Interactive portfolio visualization** - See your wealth grow with engaging charts and tables, not boring spreadsheets
- **AI-powered financial insights** - Get personalized advice, not generic market data
- **Multi-currency support** - Automatic exchange rates for global portfolios
- **Smart portfolio import** - One-click import from any broker or spreadsheet
- **Real-time market data** - Powered by Yahoo Finance
- **Secure, private and open source** - Your data stays yours

## Built with

- Next.js 15 (App Router)
- TypeScript (strict mode)
- Supabase (Postgres, Auth, Storage)
- Tailwind CSS

## Local Development (Quick Start)

- `npm install`
- Create `.env.local` (variables listed in [CONTRIBUTING.md](/CONTRIBUTING.md))
- `supabase login` and `supabase link --project-ref <your-project-ref>`
- `supabase db push --linked` to apply schema **and** seed reference data (currencies, position categories)
- `npm run dev`

Need more detail or want to run the Supabase stack locally? Read the [contributing guide](/CONTRIBUTING.md). Local CLI users can also run `supabase db push --local` to load the same schema + seeds into Docker.

## Contributing

Please read the [contributing guide](/CONTRIBUTING.md).

## To Do List

> Foliofox started as personal project with me as a single maintainer, so the To‑Do lived here in the README. Now that it’s public, I’m migrating these items to GitHub Issues for better tracking and collaboration. This list remains the temporary source of truth until that migration is complete.

- [x] Add percentages increase over the different time periods selected
- [x] Add financial data API to allow users to add financial instruments like stocks and other equities ( https://github.com/gadicc/node-yahoo-finance2 )
- [x] Add disclaimer about the fact that exchange rates and market prices are not updated in real-time but rather updated daily (10PM UTC)
- [x] Allow users to import CSV files
- [x] Allow users to export their positions
- [x] Change primary button in navbar to "New" with dropdown
- [x] Change order of new position fields
- [x] Dynamic quantity fields
- [x] position current value should be the latest quote if position has a symbol_id
- [x] Prevent users from adding a symbol with a currency not in the database (currency not supported yet)
- [x] Add P/L in the assets table
- [x] Start migrating to the new JWT signing key https://supabase.com/blog/jwt-signing-keys
- [x] Upgrade postgres version to 17 on Supabase
- [x] Add a feedback sharing feature
- [x] Add a dividends tracker. It should show the user the positions that pay dividends, and their yearly/monthly expected dividend payout
- [x] Allow user to review their imports and tweak them
- [x] Add AI powered import (import from images, pdfs, excels, and more)
- [x] Add news based on user's portfolio
- [x] Add domains tracking support
- [x] Replace `quoteDate` with `asOfDate` across positions APIs
- [x] Add `asOfDate` behavior: market-backed positions (symbols/domains) use market data as-of with record fallback; basic positions use latest record ≤ date
- [x] Centralize market data in `server/market-data/fetch.ts` with include flags:
  - `marketPrices` (quotes + domain valuations, defaults ON)
  - `exchangeRates` (FX, defaults ON)
  - Pass `{ include: { marketPrices: false } }` for FX-only scenarios
- [x] Optimize projected income analysis
- [x] Improve folder structure for mappings in lib
- [x] Prevent user from creating positions with same name
- [x] Better empty messages for news and projected income
- [x] Review Zod helpers in lib and make them more flexible
- [x] Let users input their cost basis (optional) for new positions, and then use it to create the new record
- [x] Foliofox AI advisor. Chat with your portfolio.
- [x] Add Transactions list on the dashboard home
- [x] Add privacy mode (blur/hide net worth numbers)
- [x] Find a way to have a more accurate (daily) historical calculation which doesn't add much overhead. WeeksBack solution is fast but not accurate cause the date is "rounded" to match weeks and not days.
- [x] Landingpage
- [x] New UX for adding new positions (one form per position source)
- [x] Add ai tool for fetching historical quotes for symbols
- [x] Add ai tool for getting dividend yield given symbol
- [x] Add pagination to portfolio records
- [x] Optimize recalculateRecords to use batch requests
- [x] Add PostHog
- [x] Do not trim cost basis to the first 2 decimals. Allow for up to 6 decimals. (Reviewed and confirmed that the rounding only happens in the UI. Analsyis/calculations keep full precision)
- [x] Archive/Delete assets from asset page
- [x] Add currency using InputGroup to value inputs in forms
- [x] Better tool usage UI in the AI chat
- [ ] Add Plaid for user positions sync
- [ ] Look at generative UI for AI chat: https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces
- [ ] Add crypto wallet address sync
- [ ] Add cron job for domain valuations
- [ ] Add real estate market estimate
- [ ] Add private equity valuation
- [ ] Add liabilities (debts)
- [ ] Net Worth view **after capital gain taxes**

## License

MIT © 2025 주식회사 파운더스레어. See [LICENSE](https://github.com/unav4ila8le/foliofox/blob/main/LICENSE) for details.
