#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    filePath: "supabase/seed.sql",
    asOfDate: null,
    maxStaleDays: 62,
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
    `^INSERT INTO public\\.${tableName} \\(([^)]+)\\) VALUES \\((.*)\\) ON CONFLICT DO NOTHING;$`,
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

function runAudit({ filePath, asOfDate, maxStaleDays }) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const sql = fs.readFileSync(resolvedPath, "utf8");

  const positions = new Map();
  const records = new Map();
  const snapshots = [];

  const lines = sql.split(/\n/);

  for (const line of lines) {
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
  output.push(`Positions: ${positions.size}`);
  output.push(`Portfolio records: ${records.size}`);
  output.push(`Position snapshots: ${snapshots.length}`);

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

    if (quantity < 0) {
      errors.push(`Record ${record.id} has negative quantity (${record.quantity})`);
    }

    if (unitValue <= 0) {
      errors.push(`Record ${record.id} has non-positive unit_value (${record.unit_value})`);
    }
  }

  if (invalidRecordMetrics.length > 0) {
    errors.push(`Records with non-numeric quantity/unit_value: ${invalidRecordMetrics.length}`);
  }

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

  const recordsByPosition = new Map();
  for (const record of records.values()) {
    const rowSet = recordsByPosition.get(record.position_id) ?? [];
    rowSet.push(record);
    recordsByPosition.set(record.position_id, rowSet);
  }

  const latestRecordByPosition = new Map();

  for (const [positionId, rowSet] of recordsByPosition) {
    rowSet.sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id),
    );

    let runningQuantity = 0;
    let initialized = false;

    for (const record of rowSet) {
      const quantity = toNumber(record.quantity) ?? 0;

      if (record.type === "update") {
        runningQuantity = quantity;
        initialized = true;
      } else if (record.type === "buy") {
        runningQuantity = (initialized ? runningQuantity : 0) + quantity;
        initialized = true;
      } else if (record.type === "sell") {
        runningQuantity = (initialized ? runningQuantity : 0) - quantity;
        initialized = true;
      }

      if (runningQuantity < -1e-9) {
        const positionName = positions.get(positionId)?.name ?? positionId;
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
        const recordUnitValue = toNumber(record.unit_value);

        if (
          snapshotQuantity != null &&
          Math.abs(snapshotQuantity - runningQuantity) > 1e-9
        ) {
          const positionName = positions.get(positionId)?.name ?? positionId;
          errors.push(
            `Snapshot quantity mismatch at ${positionName} on ${record.date} (record ${record.id}): expected ${runningQuantity}, got ${snapshotQuantity}`,
          );
        }

        if (
          snapshotUnitValue != null &&
          recordUnitValue != null &&
          Math.abs(snapshotUnitValue - recordUnitValue) > 1e-9
        ) {
          errors.push(
            `Snapshot unit_value mismatch for record ${record.id}: expected ${record.unit_value}, got ${linkedSnapshot.unit_value}`,
          );
        }
      }
    }

    latestRecordByPosition.set(positionId, rowSet[rowSet.length - 1]);
  }

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
    errors.push("Seed data is stale for one or more positions");
  }

  const summary = {
    resolvedAsOfDate,
    staleCutoff,
    errors: errors.length,
    warnings: warnings.length,
  };

  output.push(`As-of date: ${summary.resolvedAsOfDate}`);
  output.push(`Freshness cutoff: ${summary.staleCutoff}`);

  if (warnings.length > 0) {
    output.push("Warnings:");
    warnings.forEach((warning) => output.push(`- ${warning}`));
  }

  if (errors.length > 0) {
    output.push("Errors:");
    errors.forEach((error) => output.push(`- ${error}`));
    return { ok: false, output };
  }

  output.push("Audit result: PASS");
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
