#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    filePath: "supabase/seed.sql",
    asOfDate: null,
    maxStaleDays: 62,
    strict: false,
    minRecordsPerPosition: 3,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--as-of") {
      args.asOfDate = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg === "--max-stale-days") {
      const parsed = Number(argv[index + 1] ?? "");
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--max-stale-days must be a positive number");
      }
      args.maxStaleDays = Math.floor(parsed);
      index += 1;
      continue;
    }

    if (arg === "--strict") {
      args.strict = true;
      continue;
    }

    if (arg === "--min-records") {
      const parsed = Number(argv[index + 1] ?? "");
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("--min-records must be a non-negative number");
      }
      args.minRecordsPerPosition = Math.floor(parsed);
      index += 1;
      continue;
    }

    if (!arg.startsWith("--")) {
      args.filePath = arg;
    }
  }

  return args;
}

function splitSqlValues(valueList) {
  const values = [];
  let index = 0;

  while (index < valueList.length) {
    while (index < valueList.length && /\s/.test(valueList[index])) {
      index += 1;
    }

    if (index >= valueList.length) {
      break;
    }

    if (valueList[index] === "'") {
      index += 1;
      let value = "";

      while (index < valueList.length) {
        const current = valueList[index];

        if (current === "'") {
          if (valueList[index + 1] === "'") {
            value += "'";
            index += 2;
            continue;
          }

          index += 1;
          break;
        }

        value += current;
        index += 1;
      }

      values.push(value);
    } else {
      const start = index;
      while (index < valueList.length && valueList[index] !== ",") {
        index += 1;
      }
      values.push(valueList.slice(start, index).trim());
    }

    while (index < valueList.length && /\s/.test(valueList[index])) {
      index += 1;
    }

    if (valueList[index] === ",") {
      index += 1;
    }
  }

  return values;
}

function parseInsertLine(line, tableName) {
  const matcher = new RegExp(
    `^INSERT INTO public\\.${tableName} \\(([^)]+)\\) VALUES \\((.*)\\) ON CONFLICT.*?;$`,
  );
  const match = line.match(matcher);

  if (!match) {
    return null;
  }

  const columns = match[1].split(",").map((column) => column.trim());
  const values = splitSqlValues(match[2]);

  if (columns.length !== values.length) {
    throw new Error(
      `Column/value count mismatch for ${tableName}: ${columns.length} vs ${values.length}`,
    );
  }

  const row = {};
  columns.forEach((column, index) => {
    row[column] = values[index];
  });

  return row;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateKeyToUtc(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return date;
}

function buildDateKey(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractDays(dateKey, days) {
  const parsed = dateKeyToUtc(dateKey);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return buildDateKey(parsed);
}

function daysBetween(dateKeyA, dateKeyB) {
  const a = dateKeyToUtc(dateKeyA);
  const b = dateKeyToUtc(dateKeyB);
  if (!a || !b) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function extractDateKey(timestampString) {
  const match = timestampString?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
// ── Cost-basis replay (mirrors server/position-snapshots/record-transition.ts)

function applyTransition(state, recordType, quantity, unitValue) {
  let nextQuantity = state.quantity;
  let nextCostBasis = state.costBasis;

  if (recordType === "buy") {
    if (nextQuantity > 0) {
      const totalCost = nextQuantity * nextCostBasis + quantity * unitValue;
      nextQuantity += quantity;
      nextCostBasis = totalCost / nextQuantity;
    } else {
      nextQuantity = quantity;
      nextCostBasis = unitValue;
    }
  } else if (recordType === "sell") {
    nextQuantity = Math.max(0, nextQuantity - quantity);
  } else if (recordType === "update") {
    nextQuantity = quantity;
    nextCostBasis = unitValue;
  }

  return { quantity: nextQuantity, costBasis: nextCostBasis };
}

// ── Main audit ───────────────────────────────────────────────────────────────

function runAudit({ filePath, asOfDate, maxStaleDays, strict, minRecordsPerPosition }) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const sql = fs.readFileSync(resolvedPath, "utf8");

  const symbols = new Map();
  const positions = new Map();
  const records = new Map();
  const snapshots = [];

  const lines = sql.split(/\n/);

  for (const line of lines) {
    const symbol = parseInsertLine(line, "symbols");
    if (symbol) {
      symbols.set(symbol.id, symbol);
      continue;
    }

    const position = parseInsertLine(line, "positions");
    if (position) {
      positions.set(position.id, position);
      continue;
    }

    const record = parseInsertLine(line, "portfolio_records");
    if (record) {
      records.set(record.id, record);
      continue;
    }

    const snapshot = parseInsertLine(line, "position_snapshots");
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  const output = [];
  const errors = [];
  const warnings = [];

  output.push(`File: ${resolvedPath}`);
  output.push(`Symbols: ${symbols.size}`);
  output.push(`Positions: ${positions.size}`);
  output.push(`Portfolio records: ${records.size}`);
  output.push(`Position snapshots: ${snapshots.length}`);

  // ── 1. Snapshot ↔ record linkage ─────────────────────────────────────────

  const unlinkedSnapshots = snapshots.filter(
    (snapshot) => snapshot.portfolio_record_id === "NULL",
  );
  if (unlinkedSnapshots.length > 0) {
    errors.push(
      `Unlinked snapshots (portfolio_record_id NULL): ${unlinkedSnapshots.length}`,
    );
  }

  const missingLinkedRecords = [];
  const linkFieldMismatches = [];
  const snapshotsByRecord = new Map();

  for (const snapshot of snapshots) {
    const recordId = snapshot.portfolio_record_id;
    if (recordId === "NULL") {
      continue;
    }

    const record = records.get(recordId);
    if (!record) {
      missingLinkedRecords.push(snapshot);
      continue;
    }

    if (
      snapshot.position_id !== record.position_id ||
      snapshot.user_id !== record.user_id ||
      snapshot.date !== record.date
    ) {
      linkFieldMismatches.push({ snapshot, record });
    }

    const duplicates = snapshotsByRecord.get(recordId) ?? [];
    duplicates.push(snapshot);
    snapshotsByRecord.set(recordId, duplicates);
  }

  if (missingLinkedRecords.length > 0) {
    errors.push(
      `Snapshots linked to missing portfolio records: ${missingLinkedRecords.length}`,
    );
  }

  if (linkFieldMismatches.length > 0) {
    errors.push(
      `Linked snapshot field mismatches (position/user/date): ${linkFieldMismatches.length}`,
    );
  }

  const duplicateSnapshotLinks = [];
  for (const [recordId, linkedSnapshots] of snapshotsByRecord) {
    if (linkedSnapshots.length > 1) {
      duplicateSnapshotLinks.push({ recordId, count: linkedSnapshots.length });
    }
  }

  if (duplicateSnapshotLinks.length > 0) {
    errors.push(
      `Portfolio records with duplicate snapshots: ${duplicateSnapshotLinks.length}`,
    );
  }

  const snapshotRecordIds = new Set(
    snapshots
      .map((snapshot) => snapshot.portfolio_record_id)
      .filter((recordId) => recordId !== "NULL"),
  );

  const recordsWithoutSnapshot = [...records.values()].filter(
    (record) => !snapshotRecordIds.has(record.id),
  );

  if (recordsWithoutSnapshot.length > 0) {
    errors.push(`Portfolio records without snapshots: ${recordsWithoutSnapshot.length}`);
  }

  // ── 2. Record metric validation ──────────────────────────────────────────

  const invalidRecordMetrics = [];

  for (const record of records.values()) {
    const quantity = toNumber(record.quantity);
    const unitValue = toNumber(record.unit_value);

    if (quantity == null || unitValue == null) {
      invalidRecordMetrics.push(record.id);
      continue;
    }

    if ((record.type === "buy" || record.type === "sell") && quantity <= 0) {
      errors.push(
        `Record ${record.id} has non-positive quantity for ${record.type} (${record.quantity})`,
      );
    }

    if (record.type === "update" && quantity < 0) {
      errors.push(
        `Record ${record.id} has negative quantity for update (${record.quantity})`,
      );
    }

    if (unitValue <= 0) {
      errors.push(`Record ${record.id} has non-positive unit_value (${record.unit_value})`);
    }
  }

  if (invalidRecordMetrics.length > 0) {
    errors.push(`Records with non-numeric quantity/unit_value: ${invalidRecordMetrics.length}`);
  }

  // ── 3. Snapshot metric validation ────────────────────────────────────────

  const invalidSnapshotMetrics = [];
  for (const snapshot of snapshots) {
    const quantity = toNumber(snapshot.quantity);
    const unitValue = toNumber(snapshot.unit_value);
    const costBasis = toNumber(snapshot.cost_basis_per_unit);

    if (quantity == null || unitValue == null || costBasis == null) {
      invalidSnapshotMetrics.push(snapshot.id);
      continue;
    }

    if (quantity < 0) {
      errors.push(`Snapshot ${snapshot.id} has negative quantity (${snapshot.quantity})`);
    }

    if (unitValue <= 0) {
      errors.push(`Snapshot ${snapshot.id} has non-positive unit_value (${snapshot.unit_value})`);
    }

    if (costBasis < 0) {
      errors.push(
        `Snapshot ${snapshot.id} has negative cost_basis_per_unit (${snapshot.cost_basis_per_unit})`,
      );
    }
  }

  if (invalidSnapshotMetrics.length > 0) {
    errors.push(
      `Snapshots with non-numeric quantity/unit_value/cost_basis_per_unit: ${invalidSnapshotMetrics.length}`,
    );
  }

  // ── 4. Symbol linkage validation ─────────────────────────────────────────

  for (const position of positions.values()) {
    const symbolId = position.symbol_id;
    if (symbolId && symbolId !== "NULL" && !symbols.has(symbolId)) {
      errors.push(
        `Position "${position.name}" references missing symbol_id: ${symbolId}`,
      );
    }
  }

  // ── 5. Running quantity, cost basis, and created_at realism ───────────────

  const recordsByPosition = new Map();
  for (const record of records.values()) {
    const rowSet = recordsByPosition.get(record.position_id) ?? [];
    rowSet.push(record);
    recordsByPosition.set(record.position_id, rowSet);
  }

  const latestRecordByPosition = new Map();
  const positionRecordCounts = new Map();
  const costBasisEpsilon = 1e-6;

  for (const [positionId, rowSet] of recordsByPosition) {
    rowSet.sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id),
    );

    let state = { quantity: 0, costBasis: 0 };
    const positionName = positions.get(positionId)?.name ?? positionId;
    let buyCount = 0;
    let sellCount = 0;
    let updateCount = 0;

    for (const record of rowSet) {
      const quantity = toNumber(record.quantity) ?? 0;
      const unitValue = toNumber(record.unit_value) ?? 0;

      if (record.type === "buy") buyCount++;
      else if (record.type === "sell") sellCount++;
      else if (record.type === "update") updateCount++;

      state = applyTransition(state, record.type, quantity, unitValue);

      if (state.quantity < -1e-9) {
        errors.push(
          `Negative running quantity at ${positionName} on ${record.date} (record ${record.id})`,
        );
        break;
      }

      const linkedSnapshots = snapshotsByRecord.get(record.id) ?? [];
      if (linkedSnapshots.length === 1) {
        const linkedSnapshot = linkedSnapshots[0];
        const snapshotQuantity = toNumber(linkedSnapshot.quantity);
        const snapshotUnitValue = toNumber(linkedSnapshot.unit_value);
        const snapshotCostBasis = toNumber(linkedSnapshot.cost_basis_per_unit);

        if (
          snapshotQuantity != null &&
          Math.abs(snapshotQuantity - state.quantity) > 1e-9
        ) {
          errors.push(
            `Snapshot quantity mismatch at ${positionName} on ${record.date} (record ${record.id}): expected ${state.quantity}, got ${snapshotQuantity}`,
          );
        }

        if (
          snapshotUnitValue != null &&
          Math.abs(snapshotUnitValue - unitValue) > 1e-9
        ) {
          errors.push(
            `Snapshot unit_value mismatch for record ${record.id}: expected ${unitValue}, got ${snapshotUnitValue}`,
          );
        }

        if (
          snapshotCostBasis != null &&
          Math.abs(snapshotCostBasis - state.costBasis) > costBasisEpsilon
        ) {
          errors.push(
            `Snapshot cost_basis mismatch at ${positionName} on ${record.date} (record ${record.id}): expected ${state.costBasis}, got ${snapshotCostBasis}`,
          );
        }
      }

      // created_at should be within 7 days of the record date
      const createdDateKey = extractDateKey(record.created_at);
      if (createdDateKey) {
        const drift = daysBetween(record.date, createdDateKey);
        if (drift !== null && Math.abs(drift) > 7) {
          warnings.push(
            `Record ${record.id} at ${positionName}: created_at (${createdDateKey}) drifts ${Math.abs(drift)} days from record date (${record.date})`,
          );
        }
      }
    }

    positionRecordCounts.set(positionId, {
      total: rowSet.length,
      buys: buyCount,
      sells: sellCount,
      updates: updateCount,
    });

    latestRecordByPosition.set(positionId, rowSet[rowSet.length - 1]);
  }

  // ── 6. Position coverage check ───────────────────────────────────────────

  const lowCoveragePositions = [];
  for (const position of positions.values()) {
    const counts = positionRecordCounts.get(position.id);
    const total = counts?.total ?? 0;
    if (total < minRecordsPerPosition) {
      lowCoveragePositions.push({ name: position.name, count: total });
    }
  }

  if (lowCoveragePositions.length > 0) {
    for (const p of lowCoveragePositions) {
      warnings.push(
        `Low coverage: "${p.name}" has only ${p.count} record(s) (minimum: ${minRecordsPerPosition})`,
      );
    }
  }

  // ── 7. Date distribution analysis ────────────────────────────────────────

  const allDates = [...records.values()].map((r) => r.date).sort();
  if (allDates.length >= 2) {
    const earliest = allDates[0];
    const latest = allDates[allDates.length - 1];
    const totalSpan = daysBetween(earliest, latest);

    output.push(`Record date range: ${earliest} → ${latest} (${totalSpan} days)`);

    if (totalSpan && totalSpan > 0) {
      const lastTenPercent = subtractDays(latest, Math.floor(totalSpan * 0.1));
      if (lastTenPercent) {
        const recentRecords = allDates.filter((d) => d >= lastTenPercent).length;
        const recentPercent = ((recentRecords / allDates.length) * 100).toFixed(1);
        if (recentRecords / allDates.length > 0.4) {
          warnings.push(
            `Date clustering: ${recentPercent}% of records (${recentRecords}/${allDates.length}) fall in the last 10% of the date range (${lastTenPercent} → ${latest})`,
          );
        }
      }

      // Check for large gaps (> 90 days between consecutive records for any position)
      for (const [positionId, rowSet] of recordsByPosition) {
        const positionName = positions.get(positionId)?.name ?? positionId;
        for (let i = 1; i < rowSet.length; i++) {
          const gap = daysBetween(rowSet[i - 1].date, rowSet[i].date);
          if (gap !== null && gap > 120) {
            warnings.push(
              `Large gap: "${positionName}" has a ${gap}-day gap between ${rowSet[i - 1].date} and ${rowSet[i].date}`,
            );
          }
        }
      }
    }
  }

  // ── 8. Freshness / staleness ─────────────────────────────────────────────

  const resolvedAsOfDate = asOfDate ?? buildDateKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedAsOfDate)) {
    throw new Error("Invalid --as-of date, expected YYYY-MM-DD");
  }

  const staleCutoff = subtractDays(resolvedAsOfDate, maxStaleDays);
  if (!staleCutoff) {
    throw new Error("Failed to compute stale cutoff date");
  }

  const stalePositions = [];
  for (const position of positions.values()) {
    const latestRecord = latestRecordByPosition.get(position.id);
    if (!latestRecord) {
      stalePositions.push({
        position: position.name,
        positionId: position.id,
        latestDate: null,
      });
      continue;
    }

    if (latestRecord.date < staleCutoff) {
      stalePositions.push({
        position: position.name,
        positionId: position.id,
        latestDate: latestRecord.date,
      });
    }
  }

  if (stalePositions.length > 0) {
    warnings.push(
      `Stale positions (latest record older than ${maxStaleDays} days from ${resolvedAsOfDate}): ${stalePositions.length}`,
    );
    for (const stalePosition of stalePositions.slice(0, 10)) {
      warnings.push(
        `  - ${stalePosition.position} (${stalePosition.positionId}) latest: ${stalePosition.latestDate ?? "none"}`,
      );
    }
    if (strict) {
      errors.push("Seed data is stale for one or more positions (--strict)");
    }
  }

  // ── 9. Summary output ────────────────────────────────────────────────────

  output.push(`As-of date: ${resolvedAsOfDate}`);
  output.push(`Freshness cutoff: ${staleCutoff}`);

  if (warnings.length > 0) {
    output.push(`\nWarnings (${warnings.length}):`);
    warnings.forEach((warning) => output.push(`  ⚠ ${warning}`));
  }

  if (errors.length > 0) {
    output.push(`\nErrors (${errors.length}):`);
    errors.forEach((error) => output.push(`  ✗ ${error}`));
    return { ok: false, output };
  }

  output.push("\nAudit result: PASS");
  return { ok: true, output };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = runAudit(args);
  console.log(result.output.join("\n"));

  if (!result.ok) {
    process.exit(1);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Seed audit failed: ${message}`);
  process.exit(1);
}
