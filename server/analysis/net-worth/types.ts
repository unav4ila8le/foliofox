export const NET_WORTH_MODE_COOKIE_NAME = "net_worth_mode";

export const NET_WORTH_MODES = ["gross", "after_capital_gains"] as const;

export type NetWorthMode = (typeof NET_WORTH_MODES)[number];

export function parseNetWorthMode(
  value: string | null | undefined,
): NetWorthMode {
  return value === "after_capital_gains" ? "after_capital_gains" : "gross";
}
