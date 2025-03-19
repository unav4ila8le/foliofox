import { subMonths, subYears, startOfYear, isAfter, parseISO } from "date-fns";

// Define the time period type
export type TimePeriod =
  | "1-month"
  | "3-months"
  | "6-months"
  | "ytd"
  | "1-year"
  | "5-years";

// Generic type for data entries that have a date field
export type DateEntry = {
  date: string;
  [key: string]: string | number;
};

// Helper function to filter data based on time period
export function filterDataByTimePeriod<T extends DateEntry>(
  data: T[],
  timePeriod: TimePeriod,
): T[] {
  // Get current date for calculations
  const currentDate = new Date();

  // Sort data by date to ensure chronological order
  const sortedData = [...data].sort(
    (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
  );

  switch (timePeriod) {
    case "1-month": {
      const oneMonthAgo = subMonths(currentDate, 1);
      return sortedData.filter((item) =>
        isAfter(parseISO(item.date), oneMonthAgo),
      );
    }

    case "3-months": {
      const threeMonthsAgo = subMonths(currentDate, 3);
      return sortedData.filter((item) =>
        isAfter(parseISO(item.date), threeMonthsAgo),
      );
    }

    case "6-months": {
      const sixMonthsAgo = subMonths(currentDate, 6);
      return sortedData.filter((item) =>
        isAfter(parseISO(item.date), sixMonthsAgo),
      );
    }

    case "ytd": {
      const startOfCurrentYear = startOfYear(currentDate);
      return sortedData.filter((item) =>
        isAfter(parseISO(item.date), startOfCurrentYear),
      );
    }

    case "1-year": {
      const oneYearAgo = subYears(currentDate, 1);
      return sortedData.filter((item) =>
        isAfter(parseISO(item.date), oneYearAgo),
      );
    }

    case "5-years": {
      const fiveYearsAgo = subYears(currentDate, 5);
      return sortedData.filter((item) =>
        isAfter(parseISO(item.date), fiveYearsAgo),
      );
    }

    default:
      return sortedData;
  }
}
