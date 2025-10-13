## Database Refactor Plan (Concise) — Position-Centric Model

This plan supersedes the details below. It is the authoritative, simplified blueprint for the refactor. No code or SQL here—just a clear plan.

### Objectives

- Align UI and backend terminology; remove ambiguity.
- Future‑proof for liabilities and Plaid integrations.
- Maximize clarity and flexibility; avoid TypeScript naming collisions.

### Target Data Model

- positions: id, user_id, type ('asset' | 'liability'), name, currency, archived_at, created_at, updated_at
- portfolio_records: unified action log (buy, sell, update, borrow, repay, interest, fee, etc.); order timelines by created_at
- position_snapshots: unified value history by date; record_id is nullable (initial/synthetic snapshots)

### Categories

- position_categories: code (PK), name, description, display_order, position_type ('asset' | 'liability')
- positions.category_code → position_categories.code (FK)
- Migrate: asset_categories → position_categories (position_type='asset'); add liability categories
- Views (for UX/back-compat): asset_categories = position_categories WHERE position_type='asset'; liability_categories = position_categories WHERE position_type='liability'

### Priority Checklist

- [ ] Create GitHub branches: `development` (staging), protect `main` (production)
- [ ] Create Supabase staging environment (new project or branch); copy env; rotate keys
- [ ] Create Vercel staging project; connect to `development`; set Supabase staging env vars
- [ ] Set up CI/CD: PRs → staging preview; merge to `development` → staging deploy; merge to `main` → production deploy
- [ ] Full production DB backup and schema export
- [ ] Create new DB tables: positions, portfolio_records, position_snapshots, position_categories (keep existing tables for backfill)
- [ ] Backfill data: holdings → positions (type='asset'); transactions → portfolio_records; records → position_snapshots
- [ ] Create compatibility views: holdings, transactions, records (map to new structures)
- [ ] Add RLS policies and essential indexes; verify with EXPLAIN where relevant
- [ ] Regenerate TypeScript types and update type aliases (avoid TS `Record`)
- [ ] Refactor server modules: holdings→positions, transactions→portfolio-records, records→position-snapshots
- [ ] Update components, routes, and AI tools to new imports/types and copy
- [ ] Run full test pass on staging (DB, functionality, UI, edge cases)
- [ ] Stakeholder review on staging; fix issues; repeat tests
- [ ] Schedule production maintenance window; backup again
- [ ] Apply migrations to production; cut over app to new modules
- [ ] Monitor errors/metrics; rollback plan ready

Notes

- Use DB table names: positions, portfolio_records, position_snapshots.
- TypeScript types: Position, PortfolioRecord, PortfolioRecordWithPosition, PositionSnapshot (avoid TS `Record`).
- UI remains user‑friendly: “Record” as the action term; list/history can say “Activity” or “Records”.

### Migration Strategy (High‑Level)

1. Introduce new tables/enums alongside existing ones (add‑first).
2. Backfill data: holdings → positions (type='asset'); transactions → portfolio_records; records → position_snapshots.
3. Create compatibility views for holdings, transactions, records to keep the app running during code refactor.
4. Regenerate types; refactor server actions, AI tools, and components to new modules and names.
5. Remove views and decommission old tables once the app is fully migrated.

Categories migration specifics

- Create position_categories; copy rows from asset_categories with position_type='asset'
- Add liability categories (credit_card, personal_loan, mortgage, auto_loan, student_loan, line_of_credit, tax, other)
- Add positions.category_code and backfill from holdings.category_code
- Update selectors and server actions to use positions.category_code and filter options by positions.type

### Code Refactor Scope

- Rename server directories and modules:
  - server/holdings → server/positions
  - server/transactions → server/portfolio-records
  - server/records → server/position-snapshots
- Update imports in analysis, AI tools, and components; ensure UI copy consistency.

### RLS, Indexing, Ordering

- RLS consistently enforced via user_id on positions, portfolio_records, position_snapshots.
- Prefer created_at for ordering/tie‑breakers; date is the user/event date.
- Add pragmatic indexes to support common queries (e.g., per position/user timelines).

### Testing Focus

- Database: tables present, FKs valid, RLS active.
- Functionality: create/update/delete records for assets and liabilities; initial/synthetic snapshots; timeline ordering.
- UI: forms, tables, toasts; archived states; multi‑currency flows; charts and analysis.

### Decision Log

- Chosen “positions” as the unified concept (covers assets/liabilities cleanly).
- `positions.type` (not “kind”) with enum 'asset' | 'liability'.
- `position_snapshots.record_id` stays nullable by design.
- Excluded a generic details jsonb for now; add later only if needed.
- Avoid TS `Record` naming; use PortfolioRecord types in code.

---

# 🔄 Database Refactor: Records & Snapshots Naming (Outdated)

## Overview

**Current Problem:** Terminology collision between user-facing "Record" and backend `records` table

**Current State:**

- UI: "Record" (user portfolio actions: buy, sell, update)
- Backend: `transactions` table (user actions)
- Backend: `records` table (point-in-time snapshots)

**Goal:** Align UI terminology with backend schema for clarity and maintainability

**Proposed Solution:**

- `transactions` table → `records` table
- `records` table → `snapshots` table
- `transaction_type` enum → `record_type` enum
- `transaction_id` FK → `record_id` FK

---

## Why This Refactor is Critical

### 1. **Pre-Plaid Integration**

- Plaid uses `transactions` for bank transactions
- Our `records` vs their `plaid_transactions` = clear separation with `plaid_` prefix
- Prevents naming collision before it happens

### 2. **Developer Clarity**

- Eliminates "Which record?" mental overhead
- Code becomes self-documenting
- Easier onboarding for future team members

### 3. **Solid Foundation**

- Done before public launch = zero user impact
- Done before real production data = minimal risk
- Sets up clean architecture for scaling

### 4. **Perfect Timing**

- No production users to affect
- Test data only (easy to verify)
- No deadlines (can do it right)

---

## Detailed Schema Changes

### **Database Migration**

```sql
-- ============================================================================
-- PHASE 1: RENAME ENUM TYPE
-- ============================================================================

-- Rename enum (affects both tables)
ALTER TYPE transaction_type RENAME TO record_type;

-- ============================================================================
-- PHASE 2: RENAME TABLES
-- ============================================================================

-- Rename transactions → records
ALTER TABLE transactions RENAME TO records;

-- Rename records → snapshots
ALTER TABLE records RENAME TO snapshots;

-- ============================================================================
-- PHASE 3: RENAME FOREIGN KEY COLUMN
-- ============================================================================

-- Update FK column name in snapshots
ALTER TABLE snapshots
  RENAME COLUMN transaction_id TO record_id;

-- ============================================================================
-- PHASE 4: RENAME CONSTRAINTS
-- ============================================================================

-- Records Constraints
ALTER TABLE records
  RENAME CONSTRAINT transactions_pkey TO records_pkey;

ALTER TABLE records
  RENAME CONSTRAINT transactions_holding_id_fkey TO records_holding_id_fkey;

ALTER TABLE records
  RENAME CONSTRAINT transactions_user_id_fkey1 TO records_user_id_fkey;

ALTER TABLE records
  RENAME CONSTRAINT transactions_quantity_check TO records_quantity_check;

ALTER TABLE records
  RENAME CONSTRAINT transactions_unit_value_check TO records_unit_value_check;

-- Snapshots Constraints
ALTER TABLE snapshots
  RENAME CONSTRAINT records_pkey TO snapshots_pkey;

ALTER TABLE snapshots
  RENAME CONSTRAINT records_holding_id_fkey TO snapshots_holding_id_fkey;

ALTER TABLE snapshots
  RENAME CONSTRAINT records_transaction_id_fkey TO snapshots_record_id_fkey;

ALTER TABLE snapshots
  RENAME CONSTRAINT transactions_user_id_fkey TO snapshots_user_id_fkey;

-- ============================================================================
-- PHASE 5: RENAME INDEXES
-- ============================================================================

-- Records Indexes
ALTER INDEX transactions_date_idx
  RENAME TO records_date_idx;

ALTER INDEX transactions_holding_date_idx
  RENAME TO records_holding_date_idx;

ALTER INDEX transactions_holding_id_idx
  RENAME TO records_holding_id_idx;

ALTER INDEX transactions_type_idx
  RENAME TO records_type_idx;

ALTER INDEX transactions_user_id_idx
  RENAME TO records_user_id_idx;

-- Snapshots Indexes
ALTER INDEX records_destination_holding_id_idx
  RENAME TO snapshots_holding_id_idx;

ALTER INDEX records_user_id_idx
  RENAME TO snapshots_user_id_idx;

-- ============================================================================
-- PHASE 6: RENAME TRIGGERS
-- ============================================================================

-- Records Trigger
ALTER TRIGGER transactions_handle_updated_at ON records
  RENAME TO records_handle_updated_at;

-- Snapshots Trigger
ALTER TRIGGER records_handle_updated_at ON snapshots
  RENAME TO snapshots_handle_updated_at;

-- ============================================================================
-- PHASE 7: UPDATE RLS POLICIES (if needed)
-- ============================================================================

-- Note: Supabase auto-generates RLS policies
-- Check current policies and recreate if necessary
-- SELECT policyname FROM pg_policies
--   WHERE tablename IN ('records', 'snapshots');
```

---

## Code Refactoring Plan

### **Phase 1: Database Migration** (2 hours)

**Tasks:**

1. Create migration SQL script (above)
2. Test migration on local Supabase instance
3. Verify all constraints, indexes, triggers
4. Export updated schema for backup
5. Apply to production Supabase

**Validation:**

- [ ] All tables renamed successfully
- [ ] All foreign keys intact
- [ ] All indexes present
- [ ] All triggers working
- [ ] All RLS policies active
- [ ] No orphaned constraints

---

### **Phase 2: Type Generation** (30 minutes)

**Tasks:**

1. Regenerate Supabase types from new schema
2. Update TypeScript type aliases
3. Verify no breaking changes in generated types

**Commands:**

```bash
# Regenerate types from Supabase
npx supabase gen types typescript --project-id <your-project-ref> > types/database.types.ts
```

**Files to Update:**

- `types/database.types.ts` (auto-generated)
- `types/global.types.ts` (manual aliases)

**Type Changes:**

```typescript
// types/global.types.ts

// === Records (user portfolio actions) ===
export type Record = Tables<"records">;

export type RecordWithHolding = Record & {
  holdings: Pick<Holding, "id" | "name" | "currency" | "archived_at">;
};

// === Snapshots (holding value snapshots) ===
export type Snapshot = Tables<"snapshots">;

export type TransformedSnapshot = Snapshot & {
  total_value: number;
  currency: string | null;
};

// Legacy aliases (keep temporarily for migration)
/** @deprecated Use Record */
export type Transaction = Record;

/** @deprecated Use RecordWithHolding */
export type TransactionWithHolding = RecordWithHolding;
```

---

### **Phase 3: Server Actions Refactor** (12-15 hours)

**Directory Restructure:**

```
server/
  records/                    # RENAMED (was transactions/)
    create.ts
    update.ts
    delete.ts
    fetch.ts
    recalculate-snapshots.ts  # RENAMED (was recalculate-records.ts)

  snapshots/                  # RENAMED (was records/)
    create.ts
    update.ts
    delete.ts
    fetch.ts
```

**Search & Replace Patterns:**

| Find                     | Replace              | Context          |
| ------------------------ | -------------------- | ---------------- |
| `.from("transactions")`  | `.from("records")`   | Supabase queries |
| `.from("records")`       | `.from("snapshots")` | Supabase queries |
| `transaction_id`         | `record_id`          | FK references    |
| `Transaction` (type)     | `Record`             | Type imports     |
| `TransactionWithHolding` | `RecordWithHolding`  | Type imports     |

**Files to Update:**

**Server Actions (rename folders):**

- [ ] `server/transactions/` → `server/records/`
- [ ] `server/records/` → `server/snapshots/`

**Individual Files (~23 files):**

- [ ] `server/records/create.ts`
- [ ] `server/records/update.ts`
- [ ] `server/records/delete.ts`
- [ ] `server/records/fetch.ts`
- [ ] `server/records/recalculate-snapshots.ts`
- [ ] `server/snapshots/create.ts`
- [ ] `server/snapshots/update.ts`
- [ ] `server/snapshots/delete.ts`
- [ ] `server/snapshots/fetch.ts`
- [ ] `server/holdings/fetch.ts` (references snapshots)
- [ ] `server/holdings/create.ts` (references snapshots)
- [ ] `server/holdings/export.ts` (references snapshots)
- [ ] `server/analysis/net-worth.ts`
- [ ] `server/analysis/asset-allocation.ts`
- [ ] `server/ai/tools/records.ts` (rename from transactions.ts)
- [ ] `server/ai/tools/snapshots.ts` (rename from records.ts)
- [ ] `server/ai/tools/index.ts` (update imports)
- [ ] `server/ai/tools/currency-exposure.ts`
- [ ] `server/ai/tools/holdings-performance.ts`

**Function Naming:**

```typescript
// Portfolio records (user actions):
createTransaction()     → createRecord()
updateTransaction()     → updateRecord()
deleteTransaction()     → deleteRecord()
fetchTransactions()     → fetchRecords()

// Holding snapshots (system states):
// Keep current naming in snapshots/ folder:
createRecord()          → createSnapshot()
updateRecord()          → updateSnapshot()
deleteRecord()          → deleteSnapshot()
fetchRecords()          → fetchSnapshots()
```

---

### **Phase 4: Component Refactor** (6-8 hours)

**Directory Restructure:**

```
components/dashboard/
  records/                    # NEW (was transactions/)
    widget.tsx
    tables/
      records/                # NEW (was transactions/)
        columns.tsx
        records-table.tsx     # NEW (was transactions-table.tsx)
        row-actions/
          actions-cell.tsx
          delete-dialog.tsx
          update-record/      # NEW (was update-transaction/)
            form.tsx
            index.tsx
```

**Files to Update (~11 files):**

- [ ] `components/dashboard/records/widget.tsx`
- [ ] `components/dashboard/records/tables/records/records-table.tsx`
- [ ] `components/dashboard/records/tables/records/columns.tsx`
- [ ] `components/dashboard/records/tables/records/row-actions/actions-cell.tsx`
- [ ] `components/dashboard/records/tables/records/row-actions/delete-dialog.tsx`
- [ ] `components/dashboard/records/tables/records/row-actions/update-record/form.tsx`
- [ ] `components/dashboard/records/tables/records/row-actions/update-record/index.tsx`
- [ ] `components/dashboard/new-record/forms/buy-form.tsx`
- [ ] `components/dashboard/new-record/forms/sell-form.tsx`
- [ ] `components/dashboard/new-record/forms/update-form.tsx`
- [ ] `components/dashboard/holdings/tables/row-actions/delete-dialog.tsx`

**Import Updates:**

```typescript
// OLD
import { fetchTransactions } from "@/server/transactions/fetch";
import type { Transaction } from "@/types/global.types";

// NEW
import { fetchRecords } from "@/server/records/fetch";
import type { Record } from "@/types/global.types";
```

---

### **Phase 5: App Routes** (2 hours)

**Files to Update (~3 files):**

- [ ] `app/dashboard/page.tsx`
- [ ] `app/dashboard/holdings/page.tsx`
- [ ] `app/dashboard/holdings/[holding]/page.tsx`

**Changes:**

- Update imports from renamed server actions
- Update type references
- Update variable names for clarity

---

### **Phase 6: Library & Utilities** (1-2 hours)

**Files to Update:**

- [ ] `lib/import/sources/ai.ts`
- [ ] `lib/profit-loss.ts`

**Changes:**

- Update type imports
- Update function parameter types
- Update comments and documentation

---

## Testing Checklist

### **Database Verification**

- [ ] Tables renamed correctly
- [ ] Foreign keys working
- [ ] Indexes present and used
- [ ] Triggers firing correctly
- [ ] RLS policies active
- [ ] Constraints enforced

### **Functionality Testing**

- [ ] Create record (buy/sell/update)
- [ ] Update record
- [ ] Delete record
- [ ] View record history
- [ ] Snapshot recalculation works
- [ ] Holdings display correctly
- [ ] Net worth calculation accurate
- [ ] Asset allocation correct
- [ ] Charts render properly
- [ ] AI tools still work

### **UI Testing**

- [ ] Record table displays
- [ ] Record actions menu works
- [ ] Forms submit successfully
- [ ] Success toasts show correct messages
- [ ] Error handling works
- [ ] Loading states display

### **Edge Cases**

- [ ] Same-day records ordering
- [ ] Record deletion and recalculation
- [ ] Archived holding records
- [ ] Empty portfolio states
- [ ] Multi-currency calculations

---

## Implementation Timeline

| Phase     | Tasks              | Estimated Time   | Status     |
| --------- | ------------------ | ---------------- | ---------- |
| 1         | Database Migration | 2 hours          | ⏳ Pending |
| 2         | Type Generation    | 30 minutes       | ⏳ Pending |
| 3         | Server Actions     | 12-15 hours      | ⏳ Pending |
| 4         | Components         | 6-8 hours        | ⏳ Pending |
| 5         | App Routes         | 2 hours          | ⏳ Pending |
| 6         | Library & Utils    | 1-2 hours        | ⏳ Pending |
| 7         | Testing & QA       | 4-6 hours        | ⏳ Pending |
| **TOTAL** |                    | **~27-35 hours** |            |

---

## Risk Mitigation

### **Pre-Migration**

- [ ] Full database backup
- [ ] Export current schema
- [ ] Git commit all changes
- [ ] Create rollback plan
- [ ] Test migration locally first

### **During Migration**

- [ ] Run migration in transaction
- [ ] Verify each phase before proceeding
- [ ] Keep production backup ready
- [ ] Monitor for errors

### **Post-Migration**

- [ ] Verify all functionality
- [ ] Run full test suite
- [ ] Check linter for errors
- [ ] Test in production-like environment
- [ ] Commit when stable

### **Rollback Plan**

If migration fails:

1. Restore database from backup
2. Revert code to previous commit
3. Regenerate types from old schema
4. Verify rollback successful

---

## Benefits After Completion

### **Immediate Benefits**

✅ Clear, self-documenting code  
✅ No terminology confusion  
✅ Ready for Plaid integration  
✅ Easier onboarding for new developers

### **Long-term Benefits**

✅ Solid architectural foundation  
✅ Scalable naming conventions  
✅ Reduced cognitive overhead  
✅ Professional codebase quality

---

## Post-Refactor Documentation Updates

**Files to Update:**

- [ ] `docs/AI-ADVISOR.md` (update tool references)
- [ ] `docs/NEW-HOLDINGS-ARCHITECTURE.md` (update references to new naming)
- [ ] `docs/HOLDINGS-AND-LIABILITIES.md` (update references to new naming)
- [ ] `README.md` (update task list references)

---

## Execution Strategy

### **Recommended Approach:**

1. **Branch Strategy:**

   ```bash
   git checkout -b refactor/records-snapshots-naming
   ```

2. **Phase-by-Phase Commits:**
   - Commit after each major phase
   - Keep commits atomic and reversible
   - Clear commit messages

3. **Testing After Each Phase:**
   - Don't proceed to next phase until current is verified
   - Run app locally to test
   - Check for TypeScript errors

4. **Final Verification:**
   - Full manual testing
   - Code review (if team exists)
   - Final commit and merge

---

## Notes

- This refactor is **non-breaking** if done correctly
- All changes are **internal** - users see same UI
- Perfect timing: **before Plaid, before public launch**
- Sets foundation for **professional, scalable architecture**

---

## Success Criteria

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No linter warnings
- [ ] All features working
- [ ] Performance unchanged or improved
- [ ] Documentation updated
- [ ] Clean git history
- [ ] Ready for Plaid integration

---

**Status:** 📋 Planning Complete - Ready for Execution  
**Next Step:** Begin Phase 1 - Database Migration
