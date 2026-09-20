# Custom asset tags — issue #246

## Summary

Let users label assets with multiple colored tags—such as “Dad,” “Retirement,” and “Technology”—and filter the assets table by those labels.

Success means your friend can organize an existing portfolio by owner and account type without changing asset categories. Selecting “Dad” and “Retirement” shows assets carrying **both** tags.

This adds private organizational metadata. Categories, allocation charts, valuations, and historical records retain their current behavior.

## User experience

- **Tags column:** Add a dedicated column immediately after Name, preserving Select and Name as the first two visible columns used by group rows. Show at most two truncated chips plus `+N`; the picker exposes all labels. Clicking the cell opens a searchable multi-select picker; an empty cell shows “Add tags.” Adding or removing a tag saves immediately, with pending/error feedback and no optimistic updates. Clicking the picker must not navigate to the asset or select the row.
- **Asset details:** Reuse the same picker in the existing “Edit details” dialog, accessible from both the table and asset page. Selection changes remain drafts until “Save changes”; tags participate in form dirty state. Cancel before submission discards assignment edits. Creating a reusable tag saves the tag definition immediately but does not assign it until the form is saved.
- **Tag management:** Reach “Manage tags” from the assets table’s actions menu and from a link at the bottom of every picker. Support create, rename, recolor, and delete. When a picker search matches no existing tag, offer `Create “name”`, which opens the create dialog with that name prefilled. Deleting a tag requires confirmation and removes its assignments, never assets.
- **Colors:** Offer ten named presets: neutral, red, orange, amber, green, teal, blue, indigo, violet, and pink, using the [Shadcn/Tailwind palette](https://ui.shadcn.com/colors). Default new tags to blue; users can change it. Labels remain readable in light/dark themes and understandable without color.
- **Filtering:** The Tags column header opens a searchable filter. Assets must carry every selected tag (AND), combined with case-insensitive name search. The picker popover has no descriptive text. With no tags selected, show all assets matching the name search. The header shows the active filter count; show matching/total asset counts and an appropriate no-results message. Preserve category grouping and sorting.
- **Bulk assignment:** Add “Add tags” and “Remove tags” to the existing selection toolbar. These operations preserve unrelated assignments. Clear selection when filters change and after successful bulk actions so hidden assets cannot be changed accidentally.

## Implementation and impact

**Storage and authorization**

- Add `user_position_tags` with `id`, `user_id`, `name`, `color`, `created_at`, and `updated_at`; reuse the existing timestamp trigger helper. Add `position_tag_assignments` with `(position_id, tag_id)` as its primary key and cascading foreign keys. Do not duplicate `user_id` on assignments or add `position_type` or `display_order` to tags.
- Trim names in server code; enforce nonblank names up to 64 characters and a unique index on `(user_id, lower(btrim(name)))`. Return a friendly duplicate-name error. Store color as text with a CHECK over the ten palette keys and a blue default. Declare the matching runtime allowlist in `types/enums.ts`; a text CHECK does not generate a `Constants.public.Enums` entry.
- Sort tags by name, then ID. The name index covers owner lookups; the assignment primary key covers position lookups, and a separate tag-ID index supports deletion cascades.
- Enable owner-only RLS and explicit authenticated grants, with no anonymous access. Tag UPDATE policies require both USING and WITH CHECK ownership conditions. Assignment SELECT/INSERT/DELETE policies must verify ownership of **both** the asset and tag, using `(SELECT auth.uid())`; do not grant assignment UPDATE. Keep asset-only eligibility in server validation.
- Tag or asset deletion cascades to assignments. Archiving preserves tags, including after restoration. Existing assets start untagged; no backfill is needed.

**Server interfaces**

- Add authenticated tag fetch/create/update/delete and assignment actions under `server/position-tags/`, using the user-scoped Supabase client. Validate payloads with Zod, deduplicate IDs, and verify all requested tags and `type = 'asset'` positions belong to the caller before writing. Reject an invalid target set instead of silently dropping unauthorized IDs. RLS remains the security boundary if state changes after validation.
- **No new RPCs.** Cell and bulk assignment use the same server actions. Add all requested pairs with one bulk `upsert` using `onConflict: "position_id,tag_id"` and `ignoreDuplicates: true`; remove with one DELETE filtered by both position IDs and tag IDs. Skip empty deltas, preserve unrelated assignments, and do not loop writes per asset. Each mutation request has its own transaction; server validation and multiple requests are not one transaction. See [Supabase upsert](https://supabase.com/docs/reference/javascript/upsert), [bulk delete](https://supabase.com/docs/reference/javascript/delete), and [PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html).
- Keep `updatePosition(formData, positionId)`. Add one optional `tag_ids` FormData field containing a JSON-encoded UUID array: absent means preserve assignments; `[]` means clear; malformed input fails validation before any write. A repeated-field `getAll()` alone cannot distinguish omission from an empty selection ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FormData/getAll)). Omit the field when the selection has not changed.
- **Details-save sequence:** Validate details, tag IDs, and ownership first; load current assignments and compute additions/removals in server code. Save the position fields, insert missing assignments, then delete only assignments identified for removal. Stop at the first error. Do not delete all assignments before reinserting the desired set.
- **Partial-save contract:** Details and tags are deliberately not atomic in v1. Return the failed step and whether earlier steps committed. If a later step fails, keep the editor open and retain the requested selection; explain that details or some tag changes were saved and provide Retry. Re-read assignments and recompute the delta on retry. A lost response has an unknown outcome: refresh saved state before retrying, rather than claiming nothing changed. Cancel after a failed submission closes the editor without undoing committed writes. No compensating rollback or concurrency locks for reversible labels.

**Fetching and UI integration**

- Fetch tag definitions and assignments in bulk for the private assets page; reuse that data across cells and dialogs rather than fetching per row. Use ordered `.range()` pages of at most 1000 rows until exhausted for both lists; assignments use `(position_id, tag_id)` ordering. Paginate ownership lookups too when they can exceed the cap. The local API cap is 1000; increasing `.limit()` does not bypass it.
- Keep tags separate from both `fetchPositions` and `TransformedPosition`, which also serve public portfolios, analytics, emails, and AI. Enrich rows only in the private assets wrapper using a table-specific type. Load private tags and assignments on demand when the asset-page editor opens; do not enable assignment edits until loading succeeds.
- Apply both name and tag filtering in `AssetsTable` before passing visible rows to `DataTable`; stop passing the name filter into the child for this table. Do not add a generic faceted-filter API. Keep the full asset count for export, which still exports all active assets.
- Add one optional selection-reset signal to `DataTable` so this parent can clear internal selection and shift-selection anchors on filter changes or bulk completion without remounting the table and losing sorting. Clear the parent's selected rows at the same time. Before showing or executing any bulk action, intersect selection with current visible asset IDs; refresh callbacks when rows change. Other table consumers retain their current behavior.
- Reuse existing Shadcn controls and the category-management interaction patterns. Add no dependencies or generic custom-fields framework.
- Reuse `revalidatePath("/dashboard", "layout")` after successful writes, including earlier steps of a partially failed details save, because the assets wrapper uses `"use cache: private"`. Refresh private views and reconcile picker/filter state after mutations; revalidation alone must not leave local state stale. Remove deleted IDs from active filters and drafts. Keep a cell picker disabled while its write is pending and reconcile ambiguous failures from the server.
- Update `content/product-reference.md` and its source-file header with tag behavior, the AND filter, partial-save behavior, and limitations, including that the AI advisor cannot read or set tags in v1.

## Delivery checkpoints and validation

1. **Schema:** After you create an empty migration file, edit that file with tables, constraints, indexes, grants, and RLS. Add no write RPCs. Stop for your review, local migration application, and type regeneration before writing code that depends on the new types.
2. **Server actions:** Implement validated CRUD, single-statement cell/bulk writes, details-save sequencing and partial-result handling, paginated reads, and focused tests.
3. **User interface:** Implement the shared picker, both editing entry points, management, filtering, safe selection, refreshed state, and the product-reference update.
4. **Acceptance:** Complete regression checks and review release readiness after user-run database and browser validation.

Stop after each phase for explicit approval, as required by [AGENTS.md](../AGENTS.md). You create the empty migration file, apply it locally, and regenerate database types; the agent does not run those operations.

Acceptance checks:

- Assign “Dad” and “Retirement,” filter by both, and combine with name search.
- Bulk add/remove is idempotent, preserves unrelated tags, rejects invalid target sets before writing, and excludes hidden selections. Filter changes and bulk completion clear actual table checkboxes, not just the parent action bar; sorting survives.
- Rename/recolor updates every displayed assignment; delete detaches safely.
- Tag-only edits enable Save; Cancel before submission discards assignment edits. Test omitted, explicitly empty, and malformed `tag_ids` separately.
- Inject failures at details update, assignment insert, and assignment delete. Verify write order, accurate partial-save feedback, refresh after committed steps, and safe retry without duplicate assignments or unintended removal. Handle a lost mutation response without a false rollback claim.
- Archive/restore preserves tags; tag changes never create financial records or snapshots.
- Cross-user reads/writes and forged assignments fail; public portfolio payloads contain no tags.
- Test trimmed/duplicate/overlong names, invalid colors, assignment reads beyond 1000 rows, AND-filter empty/multiple selections, and unchanged financial data after tagging. Unit tests do not prove RLS; cross-user and anonymous checks run against the local database under the user's control.
- Keyboard interaction, mobile layout, light/dark colors, and mutation failures work correctly.

Run focused tests, lint, format checks, and direct TypeScript checking. Database/RLS and browser acceptance checks remain explicit user-run gates; do not run database, Supabase CLI, or Next CLI commands.

## Review decisions

- Adopt parent-level filtering, one picker with two save modes, private table-only data, AND semantics, concrete schema names, pagination, and the migration/type-generation checkpoint.
- Keep the agreed Tags column instead of moving chips into Name. A column after Name does not disturb the current group-row indexing; compact chips and `+N` address density. Revisit chips under the name if users report the column as distracting. The tag filter lives in the column header, passed through the table’s `meta`, rather than in a separate toolbar row.
- Decline RPCs for bulk tagging: one insert/delete statement already provides the necessary write boundary. Decline a new RPC solely to make reversible details/tag edits atomic; the explicit partial-save contract replaces the original all-or-nothing promise. Calling separate Supabase requests from one server action would not make them transactional.
- Allow only the small selection-reset addition to `DataTable`. Resetting the parent's array alone leaves internal checkbox state behind; remounting would reset sorting. No general filter or table-state framework is needed.

## Defaults and exclusions

V1 covers active-assets table filtering and tagging through both editing entry points. Filters use local page state.

Defer accounts, structured ownership, arbitrary custom fields, dashboard tag analytics, portfolio-percentage columns, tag import/export, AI tag tools, creation-form tagging, and archived-table filtering. Existing exports continue exporting all active assets without tags.
