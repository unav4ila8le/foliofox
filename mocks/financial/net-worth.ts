export type WeeklyNetWorth = {
  date: string;
  netWorth: number;
};

export type AssetAllocation = {
  category_code: string;
  total_value: number;
  fill?: string;
};

export const weeklyNetWorth: WeeklyNetWorth[] = [
  // January 2024
  { date: "2024-01-01", netWorth: 1125000 },
  { date: "2024-01-08", netWorth: 1128400 },
  { date: "2024-01-15", netWorth: 1122900 },
  { date: "2024-01-22", netWorth: 1127600 },
  { date: "2024-01-29", netWorth: 1131200 },

  // February 2024
  { date: "2024-02-05", netWorth: 1128900 },
  { date: "2024-02-12", netWorth: 1134500 },
  { date: "2024-02-19", netWorth: 1139200 },
  { date: "2024-02-26", netWorth: 1142300 },

  // March 2024
  { date: "2024-03-04", netWorth: 1145800 },
  { date: "2024-03-11", netWorth: 1149200 },
  { date: "2024-03-18", netWorth: 1147600 },
  { date: "2024-03-25", netWorth: 1152300 },

  // April 2024
  { date: "2024-04-01", netWorth: 1156800 },
  { date: "2024-04-08", netWorth: 1159300 },
  { date: "2024-04-15", netWorth: 1164500 },
  { date: "2024-04-22", netWorth: 1168900 },
  { date: "2024-04-29", netWorth: 1172400 },

  // May 2024
  { date: "2024-05-06", netWorth: 1176800 },
  { date: "2024-05-13", netWorth: 1181200 },
  { date: "2024-05-20", netWorth: 1185600 },
  { date: "2024-05-27", netWorth: 1189200 },

  // June 2024
  { date: "2024-06-03", netWorth: 1184500 },
  { date: "2024-06-10", netWorth: 1179800 },
  { date: "2024-06-17", netWorth: 1173500 },
  { date: "2024-06-24", netWorth: 1167500 },

  // July 2024
  { date: "2024-07-01", netWorth: 1172300 },
  { date: "2024-07-08", netWorth: 1176800 },
  { date: "2024-07-15", netWorth: 1181400 },
  { date: "2024-07-22", netWorth: 1185900 },
  { date: "2024-07-29", netWorth: 1189500 },

  // August 2024
  { date: "2024-08-05", netWorth: 1192800 },
  { date: "2024-08-12", netWorth: 1195600 },
  { date: "2024-08-19", netWorth: 1193400 },
  { date: "2024-08-26", netWorth: 1196800 },

  // September 2024
  { date: "2024-09-02", netWorth: 1192400 },
  { date: "2024-09-09", netWorth: 1187400 },
  { date: "2024-09-16", netWorth: 1191800 },
  { date: "2024-09-23", netWorth: 1195200 },
  { date: "2024-09-30", netWorth: 1198600 },

  // October 2024
  { date: "2024-10-07", netWorth: 1203200 },
  { date: "2024-10-14", netWorth: 1207800 },
  { date: "2024-10-21", netWorth: 1210800 },
  { date: "2024-10-28", netWorth: 1215400 },

  // November 2024
  { date: "2024-11-04", netWorth: 1221900 },
  { date: "2024-11-11", netWorth: 1228400 },
  { date: "2024-11-18", netWorth: 1235900 },
  { date: "2024-11-25", netWorth: 1245900 },

  // December 2024
  { date: "2024-12-02", netWorth: 1242400 },
  { date: "2024-12-09", netWorth: 1238400 },
  { date: "2024-12-16", netWorth: 1241800 },
  { date: "2024-12-23", netWorth: 1245200 },
  { date: "2024-12-30", netWorth: 1248600 },

  // January 2025
  { date: "2025-01-06", netWorth: 1252100 },
  { date: "2025-01-13", netWorth: 1256700 },
  { date: "2025-01-20", netWorth: 1253200 },
  { date: "2025-01-27", netWorth: 1249800 },

  // February 2025
  { date: "2025-02-03", netWorth: 1245400 },
  { date: "2025-02-10", netWorth: 1239800 },
  { date: "2025-02-17", netWorth: 1234500 },
  { date: "2025-02-24", netWorth: 1241900 },

  // March 2025
  { date: "2025-03-03", netWorth: 1248400 },
];

// Asset allocation data - total should match the most recent net worth value
// Current total: 1248400 (as of 2025-03-03)
export const assetAllocation: AssetAllocation[] = [
  { category_code: "cash", total_value: 99872, fill: "var(--color-cash)" },
  { category_code: "equity", total_value: 499360, fill: "var(--color-equity)" },
  {
    category_code: "fixed_income",
    total_value: 499360,
    fill: "var(--color-fixed_income)",
  },
  {
    category_code: "real_estate",
    total_value: 499360,
    fill: "var(--color-real_estate)",
  },
  {
    category_code: "cryptocurrency",
    total_value: 62420,
    fill: "var(--color-cryptocurrency)",
  },
  { category_code: "other", total_value: 87388, fill: "var(--color-other)" },
];
