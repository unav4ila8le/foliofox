import type { PositionImportRow } from "@/lib/import/types";

function escapeCSVCell(value: string): string {
  const v = String(value ?? "");
  const escaped = v.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function positionsToCSV(rows: PositionImportRow[]): string {
  const headers = [
    "name",
    "category_id",
    "currency",
    "quantity",
    "unit_value",
    "cost_basis_per_unit",
    "symbol_lookup",
    "description",
  ];

  const lines: string[] = [];
  lines.push(headers.join(","));

  for (const p of rows) {
    const qty = Number.isFinite(p.quantity) ? String(p.quantity) : "";
    const unit =
      p.unit_value != null && Number.isFinite(p.unit_value)
        ? String(p.unit_value)
        : "";
    const cost =
      p.cost_basis_per_unit != null && Number.isFinite(p.cost_basis_per_unit)
        ? String(p.cost_basis_per_unit)
        : "";

    const cells = [
      p.name,
      p.category_id,
      p.currency,
      qty,
      unit,
      cost,
      p.symbolLookup ?? "",
      p.description ?? "",
    ].map(escapeCSVCell);

    lines.push(cells.join(","));
  }

  return lines.join("\n");
}
