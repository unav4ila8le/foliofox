# 📦 Export/Import Feature Plan

## 🎯 Goal

Enable users to export their holdings to CSV and import them back. Start simple, iterate fast.

## 📋 Implementation Phases

### **Phase 1: Holdings Export** (This Week)

**Target:** Export current holding values (snapshot)

**CSV Format:**

```csv
name,category_code,currency,current_quantity,current_unit_value,symbol_id,description
"Apple Stock",equity,USD,100,150.50,AAPL,"My Apple shares"
"Emergency Fund",cash,USD,1,5000.00,,"Savings account"
```

**Tasks:**

- [x] **1.1** Create export server action
  - [x] Use `fetchHoldings()` (default - no includeRecords needed)
  - [x] Transform to flat CSV using current_quantity/current_unit_value
  - [x] Generate CSV with proper headers
- [x] **1.2** Add export UI
  - [x] Export button in assets page
  - [x] Download trigger with filename `patrivio-holdings-YYYY-MM-DD.csv`

**Expected Outcome:** Users get clean portfolio snapshot for migration/backup

---

### **Phase 2: Holdings Import** (Next Week)

**Target:** Import the exact format from Phase 1

**Import Logic:**

- Create holding with name, category, currency, symbol_id, description
- Create single record with current_quantity, current_unit_value, date=today

**Tasks:**

- [ ] **2.1** CSV parsing and validation
- [ ] **2.2** Import processing using existing `createHolding()`
- [ ] **2.3** Import UI

---

### **Phase 3: Enhanced Export Options** (Later)

**Target:** Advanced export for power users

**Options:**

- [ ] **3.1** Holdings + Full Records (multiple rows per holding)
- [ ] **3.2** Separate CSV files (holdings.csv + records.csv)
- [ ] **3.3** JSON export (complete data with relationships)

---

## 🚀 Implementation Notes

**Export Function (Phase 1):**

```typescript
// server/holdings/export.ts
export async function exportHoldings(): Promise<string> {
  const holdings = await fetchHoldings(); // Gets current values by default
  return generateCSV(holdings);
}
```

**Import Function (Phase 2):**

```typescript
// server/holdings/import.ts
export async function importHoldings(csvContent: string) {
  const rows = parseCSV(csvContent);
  // Each row creates: 1 holding + 1 record with current values
  return await batchCreateHoldings(rows);
}
```

---

## ✅ Success Metrics

- [x] Phase 1: Holdings export working in 1-2 days
- [ ] Phase 2: Holdings import working in 3-4 days
- [ ] User can: Export → Edit → Import successfully
- [ ] Clean foundation for advanced export options

**Next Steps:** Start with holdings export using current values from `fetchHoldings()`.
