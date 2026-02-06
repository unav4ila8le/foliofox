export const NET_WORTH_MODES = ["gross", "after_capital_gains"] as const;

export type NetWorthMode = (typeof NET_WORTH_MODES)[number];
