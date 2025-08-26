import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

async function testDividends() {
  try {
    console.log("=== AAPL Chart with Dividend Events ===");
    const aaplChart = await yahooFinance.chart("AAPL", {
      period1: "2023-01-01",
      period2: "2024-01-01",
      events: "div",
    });
    console.log(
      "AAPL Dividend Events:",
      JSON.stringify(aaplChart.events, null, 2),
    );

    console.log("\n=== KO Chart with Dividend Events ===");
    const koChart = await yahooFinance.chart("KO", {
      period1: "2023-01-01",
      period2: "2024-01-01",
      events: "div",
    });
    console.log("KO Dividend Events:", JSON.stringify(koChart.events, null, 2));

    console.log("\n=== TSLA Chart with Dividend Events (should be empty) ===");
    const tslaChart = await yahooFinance.chart("TSLA", {
      period1: "2023-01-01",
      period2: "2024-01-01",
      events: "div",
    });
    console.log(
      "TSLA Dividend Events:",
      JSON.stringify(tslaChart.events, null, 2),
    );
  } catch (error) {
    console.error("Error:", error);
  }
}

testDividends();
