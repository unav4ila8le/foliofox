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

#### Other Dependencies to Watch

- `@hookform/resolvers` is currently at v4 and should not be updated to v5 until we upgrade react-hook-form to v8

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
