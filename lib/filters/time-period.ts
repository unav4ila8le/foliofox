// Define the time period type
export type TimePeriod = "1-month" | "3-months" | "6-months" | "ytd" | "1-year";

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
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  switch (timePeriod) {
    case "1-month": {
      // Get data from the last month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(currentDate.getMonth() - 1);
      return sortedData.filter((item) => new Date(item.date) >= oneMonthAgo);
    }

    case "3-months": {
      // Get data from the last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(currentDate.getMonth() - 3);
      return sortedData.filter((item) => new Date(item.date) >= threeMonthsAgo);
    }

    case "6-months": {
      // Get data from the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(currentDate.getMonth() - 6);
      return sortedData.filter((item) => new Date(item.date) >= sixMonthsAgo);
    }

    case "ytd": {
      // Get data from the start of the current year
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      return sortedData.filter((item) => new Date(item.date) >= startOfYear);
    }

    case "1-year": {
      // Get data from the last year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(currentDate.getFullYear() - 1);
      return sortedData.filter((item) => new Date(item.date) >= oneYearAgo);
    }

    default:
      // Default to showing all data
      return sortedData;
  }
}
