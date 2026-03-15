## Performance Analysis

This module owns portfolio performance calculations for the dashboard.

Current MVP constraints:

- Scope is `symbol_assets` only: asset positions with a `symbol_id`
- Methodology is `time_weighted_return`
- Other methodology ids are reserved for future expansion and are rejected until implemented
- Output is pre-tax performance in the user's display currency
- Market-backed `update` records with quantity changes are replayed as inferred flows
- `includesEstimatedFlows` is `true` only when at least one inferred non-zero update flow was needed

How inferred update flows work:

- `buy` and `sell` records expose explicit external cash-flow amounts
- `update` records reset holdings state, so we infer a synthetic contribution or withdrawal from the quantity change on that date
- Quantity-stable updates are treated as cost-basis or metadata corrections only, so they do not set `includesEstimatedFlows`

Daily-data limitation:

- The engine uses daily valuations, not intraday execution data
- Inferred update flows are therefore booked at the effective unit value for that civil date
- If a user uses `update` to compress multiple omitted transactions from earlier days, performance is still an estimate for that range
- This daily approximation is acceptable for the dashboard MVP, but it is not a substitute for explicit transaction history

Extension path:

- Add new methodologies behind the existing `PerformanceMethodology` union and keep the dashboard contract stable
- Add benchmark comparison as a separate layer that replays the same dated external flows into benchmark symbols
- Use `includesEstimatedFlows` as the contract hook for any future UI disclosure around inferred flows
- Expand scope only when there is a clear model for non-symbol assets, cash, and liabilities
