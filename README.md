This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Google fonts.

## Package Dependencies Notes

### Current Overrides

The project currently uses package overrides in `package.json` to handle React 19 compatibility. These are temporary solutions until the packages are officially updated:

```json
{
  "overrides": {
    "react-day-picker": {
      "react": "^19.0.0"
    }
  }
}
```

#### Why these overrides?

- **react-day-picker**: We're using shadcn/ui's calendar component which depends on react-day-picker v8. This version doesn't officially support React 19, so we use an override until shadcn updates to react-day-picker v9.

#### Future Updates

- When shadcn/ui updates their calendar component to use react-day-picker v9:
  1. Remove the react-day-picker override
  2. Update react-day-picker to v9
  3. Update date-fns to v4 (currently locked to v3.6.0 for compatibility)

## Utility Functions

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

## Supabase Setup Checklist (MVP)

This checklist outlines the steps to set up the Supabase backend for the Patrivio MVP based on the refined schema and API plan.

> **Note on Development Order**: It's recommended to complete the Supabase setup first (steps 1-3), then integrate with your local Next.js app (step 4), develop the API routes and frontend components (steps 5-6), and finally deploy to Vercel.

**1. Supabase Project Setup:**

- [x] Create a new project on the [Supabase Dashboard](https://supabase.com/dashboard).
- [x] Note down your Project URL and `anon` key from the API settings.
- [x] Store these securely (e.g., in environment variables, **do not commit them directly to Git**).

**2. Supabase MCP Setup (For Development Assistance):**

- [x] Go to the [Supabase Dashboard](https://supabase.com/dashboard) and navigate to your account settings
- [x] Create a new personal access token with a descriptive name (e.g., "Patrivio MCP")
- [x] Copy the generated token and store it securely (you won't be able to view it again)
- [x] Create a `.cursor` directory in your project root if it doesn't exist already
- [x] Create a `.cursor/mcp.json` file with the following configuration:
  ```json
  {
    "mcpServers": {
      "supabase": {
        "command": "npx",
        "args": [
          "-y",
          "@supabase/mcp-server-supabase@latest",
          "--access-token",
          "YOUR_PERSONAL_ACCESS_TOKEN"
        ]
      }
    }
  }
  ```
- [x] Replace `YOUR_PERSONAL_ACCESS_TOKEN` with your actual token
- [x] Add `.cursor/mcp.json` to your `.gitignore` file to avoid committing the token
- [x] Open Cursor and navigate to Settings/MCP to verify the Supabase MCP server shows an active status

**3. Next.js Project Integration:**

- [x] Install necessary Supabase packages:
  ```bash
  npm install @supabase/supabase-js @supabase/ssr
  # or yarn or pnpm
  ```
- [x] Create a `.env.local` file (if it doesn't exist) in the project root.
- [x] Add your Supabase Project URL and Anon Key to `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
  ```
- [x] Configure Supabase client creation using `@supabase/ssr` package for use in Server Components, Client Components, and API Routes (follow Supabase Next.js docs/examples). This typically involves creating utility functions to get Supabase clients for different contexts (server, client, route handler).
- [x] Build custom login/signup components using `supabase.auth` methods.
- [x] Wrap the application layout with an Auth provider/context if needed to manage session state.

**4. Database Schema Creation:**

- [x] Create the `profiles` table with the refined MVP columns:
      `id` uuid references auth.users on delete cascade primary key,
      `username` text unique not null,
      `display_currency` text not null default 'USD',
      `avatar_url` text,
      `created_at` timestamptz not null default now(),
      `updated_at` timestamptz not null default now(),

      Enable RLS and create policy “User can update own profile”,
      create policy “User can view own profile”,

  Ensure `id` is the primary key and references `auth.users`.

  - [x] Create the `currencies` lookup table with ISO‑4217 columns and constraints:
        `alphabetic_code` text PRIMARY KEY NOT NULL,
        `currency` text NOT NULL,
        `numeric_code` int2 NOT NULL,
        `minor_unit` int2 NOT NULL,

    CONSTRAINT chk_alpha_len CHECK (char_length(alphabetic_code) = 3),
    CONSTRAINT chk_numeric_range CHECK (numeric_code BETWEEN 1 AND 999),

    Add FK on `profiles.display_currency` REFERENCES `currencies(alphabetic_code)`.

  Enable RLS and create policy “Allow public read” (SELECT for anon & authenticated USING (true)).

  - [x] Create the `asset_categories` lookup table:
        `id` uuid PRIMARY KEY NOT NULL,
        `code` text unique NOT NULL,
        `name` text NOT NULL,
        `display_order` int2 unique NOT NULL,
        `description` text,

    Enable RLS and create policy “Allow public read” (SELECT for anon & authenticated USING (true)).

- [ ] Create the `holdings` table with the refined MVP columns: `id`, `user_id`, `name`, `category`, `tracking_method`, `currency`, `logo_url`, `current_quantity`, `created_at`, `api_symbol` (nullable), `isin` (nullable), `exchange` (nullable). Ensure `user_id` references `auth.users`.

- [ ] Create the `transactions` table with the refined MVP columns: `id`, `user_id`, `holding_id` (nullable), `date`, `type`, `amount`, `currency`, `quantity` (nullable), `category`, `notes` (nullable), `linked_transfer_id` (nullable), `created_at`. Ensure foreign keys link correctly.

- [ ] Create the `account_balances` table with the refined MVP columns: `id`, `user_id`, `holding_id`, `date`, `balance`, `currency`, `notes`, `created_at`. Ensure foreign keys link correctly.

- [ ] Create the `asset_prices` table with the refined MVP columns: `id`, `holding_id`, `date`, `price`, `currency`, `source`, `created_at`. Ensure foreign keys link correctly.

- [ ] Create the `currency_rates` table with the refined MVP columns: `id`, `date`, `base_currency`, `target_currency`, `rate`, `created_at`.

- [ ] (Optional but Recommended) Set up Row Level Security (RLS) policies on all tables to ensure users can only access their own data. Start with simple policies (e.g., `user_id = auth.uid()`).

**5. Build Initial API Routes:**

- [ ] Create the essential API route handlers identified in the refined plan (e.g., `/api/holdings`, `/api/transactions`, `/api/net-worth/summary`, etc.) using Next.js App Router Route Handlers.
- [ ] Implement data fetching and mutations within these handlers using the configured Supabase client. Ensure user authentication/authorization is checked in each handler (e.g., using RLS or checking `auth.uid()`).

**6. Connect Frontend Components:**

- [ ] Update frontend components (Dashboard pages, Sidebar, etc.) to fetch data from the new API routes instead of using mock data.
- [ ] Implement forms and actions to call the `POST`/`PUT` API routes for adding/updating data (e.g., "New transaction" button).
