// Robust numeric parser for EU/US formats; returns NaN on invalid input
export function parseNumberStrict(raw: string): number {
  const input = (raw ?? "")
    .toString()
    .trim()
    .replace(/\u00A0/g, " "); // normalize spaces
  if (!input) return NaN;

  const hasComma = input.includes(",");
  const hasDot = input.includes(".");

  let normalized = input;

  if (hasComma && !hasDot) {
    // EU: "52.673,82" or "52673,82" (dots might be thousands)
    normalized = input.replace(/\./g, "").replace(",", ".");
  } else if (!hasComma && hasDot) {
    // US: "52,673.82" or "52673.82" (commas might be thousands)
    normalized = input.replace(/,/g, "");
  } else if (hasComma && hasDot) {
    // Decide by last separator position
    const lastComma = input.lastIndexOf(",");
    const lastDot = input.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Comma decimal → remove dots as thousands, comma -> dot
      normalized = input.replace(/\./g, "").replace(",", ".");
    } else {
      // Dot decimal → remove commas as thousands
      normalized = input.replace(/,/g, "");
    }
  }

  // Strip remaining non-numeric chars (allow leading minus and dot)
  normalized = normalized.replace(/[^0-9.\-]/g, "");

  const result = Number(normalized);
  return Number.isFinite(result) ? result : NaN;
}
