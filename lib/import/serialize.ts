import type { HoldingRow } from "@/types/global.types";

function escapeCSVCell(value: string): string {
  const v = String(value ?? "");
  const escaped = v.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function holdingsToCSV(rows: HoldingRow[]): string {
  const headers = [
    "name",
    "category_code",
    "currency",
    "quantity",
    "unit_value",
    "cost_basis_per_unit",
    "symbol_id",
    "description",
  ];

  const lines: string[] = [];
  lines.push(headers.join(","));

  for (const h of rows) {
    const qty = Number.isFinite(h.quantity) ? String(h.quantity) : "";
    const unit =
      h.unit_value != null && Number.isFinite(h.unit_value)
        ? String(h.unit_value)
        : "";
    const cost =
      h.cost_basis_per_unit != null && Number.isFinite(h.cost_basis_per_unit)
        ? String(h.cost_basis_per_unit)
        : "";

    const cells = [
      h.name,
      h.category_code,
      h.currency,
      qty,
      unit,
      cost,
      h.symbol_id ?? "",
      h.description ?? "",
    ].map(escapeCSVCell);

    lines.push(cells.join(","));
  }

  return lines.join("\n");
}
