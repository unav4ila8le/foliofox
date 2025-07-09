# Patrivio

A modern net worth tracking app built with Next.js, Supabase, Shadcn UI, and Tailwind CSS.

## Features

- Track net worth over time with interactive charts
- Multi-currency support with automatic exchange rates
- Secure authentication and user profiles
- Modular, type-safe codebase

## Tech Stack

- Next.js 15 (App Router)
- TypeScript (strict mode)
- Supabase (Postgres, Auth, Storage)
- Tailwind CSS

## Getting Started

```bash
npm run dev
# or yarn, pnpm, bun
```

Set up your `.env.local` with your Supabase credentials.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Google fonts.

## Package Dependencies Notes

## Utility Functions Cheatsheet

### Number Formatting

The project includes several utility functions for number formatting. Here's a quick cheatsheet:

```typescript
// Basic number formatting
formatNumber(1234.5678); // "1,235"
formatNumber(1234.5678, 2); // "1,234.57"

// Currency formatting (uses currency-specific decimal places)
formatCurrency(1234.56, "USD"); // "USD 1,234.56"  // 2 decimals for USD
formatCurrency(1234.56, "JPY"); // "JPY 1,235"     // 0 decimals for JPY
formatCurrency(1234.56, "BHD"); // "BHD 1,234.560" // 3 decimals for BHD
formatCurrency(1234.56, "USD", { display: "symbol" }); // "$1,234.56"
formatCurrency(1234.56, "JPY", { display: "symbol" }); // "¥1,235"

// Percentage formatting
formatPercentage(0.1234); // "12.34%"
formatPercentage(0.1234, 1); // "12.3%"

// Compact number formatting
formatCompactNumber(1234567); // "1.2M"
formatCompactCurrency(1234567, "USD"); // "1.2M USD"
```

All formatting functions accept both numbers and strings as input. Currency formatting automatically uses the appropriate number of decimal places based on the currency code. For more details, check the implementation in `lib/number/format.ts`.

## To Do List

[x] Add percentages increase over the different time periods selected
[x] Add financial data API to allow users to add fianncial instruments like stocks and other equities ( https://github.com/gadicc/node-yahoo-finance2 )
[ ] Use client for exchange rates, symbols and quotes (they are not private data)
[x] Add disclaimer about the fact that exchange rates and market prices are not updated in real-time but rather updated daily (10PM UTC)
[ ] **Implement Caching for Expensive Operations**: The net worth line chart calculation is resource intensive. In the future, implement server-side caching (e.g., using Next.js `use cache` or `unstable_cache` when stable) to avoid redundant calculations and improve performance, especially when users switch between time periods or currencies.
[ ] Allow users to import CSV files
[ ] Allow users to export their holdings
[x] Change primary button in navbar to "New" with dropdown
[x] Change order of new holding fields
[x] Dynamic quantity fields
[x] Holding current value should be the latest quote if holding has a symbol_id
[ ] Prevent users from adding a symbol with a currency not in the database (currency not supported yet)
[ ] Find a way to have a more accurate historical calculation which doesn't add much overhead. WeeksBack solution is fast but not accurate cause the date is "rounded" to match weeks and not days.
