## Performance Analysis

This module owns portfolio performance calculations for the dashboard.

Current MVP constraints:

- Scope is `symbol_assets` only: asset positions with a `symbol_id`
- Methodology is `time_weighted_return`
- Output is pre-tax performance in the user's display currency
- Ranges containing eligible `update` records are returned as unavailable

Why `update` is unsupported in MVP:

- `buy` and `sell` records expose external cash-flow amounts
- `update` records reset holdings state without a reliable contribution or withdrawal amount
- Returning `unavailable` is safer than guessing and showing analytically wrong performance

Extension path:

- Add new methodologies behind the existing `PerformanceMethodology` union and keep the dashboard contract stable
- Add benchmark comparison as a separate layer that replays the same dated external flows into benchmark symbols
- Expand scope only when there is a clear model for non-symbol assets, cash, and liabilities
