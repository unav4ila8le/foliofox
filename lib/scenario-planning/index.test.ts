import { describe, test, expect } from "vitest";
import {
  runScenario,
  makeScenario,
  makeOneOff,
  makeRecurring,
  makeEvent,
} from "./index";
import { ld } from "@/lib/local-date";

describe("scenario planning", () => {
  test("should handle basic income and expenses", () => {
    const scenario = makeScenario({
      name: "Basic Income and Expenses",
      events: [
        makeOneOff({
          type: "income",
          amount: 1000,
          name: "Salary",
          date: ld(2023, 1, 2),
        }),
        makeOneOff({
          type: "expense",
          amount: 500,
          name: "Rent",
          date: ld(2023, 1, 5),
        }),
        makeOneOff({
          type: "expense",
          amount: 250,
          name: "Groceries",
          date: ld(2023, 1, 15),
        }),
        makeOneOff({
          type: "expense",
          amount: 800,
          name: "Utilities",
          date: ld(2023, 2, 20),
        }),
      ],
    });
    const result = runScenario({
      scenario,
      startDate: ld(2023, 1, 1),
      endDate: ld(2023, 2, 28),
      initialBalance: 0,
    });

    expect(result.balance).toStrictEqual({
      "2023-01": 1000 - 500 - 250,
      "2023-02": 250 - 800,
    });
  });

  test("should handle recurring income and expenses", () => {
    const scenario = makeScenario({
      name: "Basic Income and Expenses",
      events: [
        makeRecurring({
          type: "income",
          amount: 1000,
          name: "Salary",
          startDate: ld(2023, 1, 1),
          endDate: ld(2023, 4, 1),
          frequency: "monthly",
        }),
        makeRecurring({
          type: "expense",
          amount: 500,
          name: "Rent",
          startDate: ld(2023, 1, 5),
          endDate: ld(2023, 4, 5),
          frequency: "monthly",
        }),
        makeRecurring({
          type: "expense",
          amount: 500,
          name: "Taxes outside range - last year - not counting",
          startDate: ld(2022, 1, 1),
          endDate: ld(2022, 8, 1),
          frequency: "monthly",
        }),
      ],
    });
    const result = runScenario({
      scenario,
      startDate: ld(2023, 1, 1),
      endDate: ld(2023, 4, 30),
      initialBalance: 0,
    });

    expect(result.cashflow).toStrictEqual({
      "2023-01": expect.objectContaining({ amount: 1000 - 500 }),
      "2023-02": expect.objectContaining({ amount: 1000 - 500 }),
      "2023-03": expect.objectContaining({ amount: 1000 - 500 }),
      "2023-04": expect.objectContaining({ amount: 1000 - 500 }),
    });

    expect(result.balance).toStrictEqual({
      "2023-01": 500,
      "2023-02": 1000,
      "2023-03": 1500,
      "2023-04": 2000,
    });
  });

  test("should handle complex scenario over 2 years", () => {
    const scenario = makeScenario({
      name: "Realistic complex scenario",
      events: [
        makeRecurring({
          name: "Salary",
          amount: 2000,
          frequency: "monthly",
          type: "income",
          startDate: ld(2025, 1, 1),
          endDate: null,
        }),
        makeRecurring({
          name: "Cost of Life",
          amount: 1400,
          frequency: "monthly",
          type: "expense",
          startDate: ld(2025, 1, 1),
          endDate: null,
        }),
        makeOneOff({
          name: "New Car",
          amount: 10000,
          type: "expense",
          date: ld(2025, 6, 1),
        }),
        makeOneOff({
          name: "Tredicesima",
          amount: 2200,
          type: "income",
          date: ld(2026, 1, 1),
        }),
      ],
    });

    const result = runScenario({
      scenario,
      startDate: ld(2025, 1, 1),
      endDate: ld(2027, 1, 1),
      initialBalance: 10000,
    });

    expect(result.balance).toMatchInlineSnapshot(`
      {
        "2025-01": 10600,
        "2025-02": 11200,
        "2025-03": 11800,
        "2025-04": 12400,
        "2025-05": 13000,
        "2025-06": 3600,
        "2025-07": 4200,
        "2025-08": 4800,
        "2025-09": 5400,
        "2025-10": 6000,
        "2025-11": 6600,
        "2025-12": 7200,
        "2026-01": 10000,
        "2026-02": 10600,
        "2026-03": 11200,
        "2026-04": 11800,
        "2026-05": 12400,
        "2026-06": 13000,
        "2026-07": 13600,
        "2026-08": 14200,
        "2026-09": 14800,
        "2026-10": 15400,
        "2026-11": 16000,
        "2026-12": 16600,
        "2027-01": 17200,
      }
    `);
  });

  describe("conditions", () => {
    describe("networth-is-above", () => {
      test("should unlock event when salary is above", () => {
        const scenario = makeScenario({
          name: "",
          events: [
            makeRecurring({
              name: "Salary",
              frequency: "monthly",
              startDate: ld(2025, 1, 1),
              amount: 2000,
              endDate: null,
              type: "income",
            }),
            makeEvent({
              name: "Holidays in South Korea 🇰🇷",
              amount: 4000,
              type: "expense",
              unlockedBy: [
                {
                  type: "networth-is-above",
                  tag: "balance",
                  value: { eventRef: "Salary", amount: 6000 },
                },
              ],
            }),
          ],
        });

        const result = runScenario({
          startDate: ld(2025, 1, 1),
          endDate: ld(2025, 5, 1),
          initialBalance: 0,
          scenario,
        });

        expect(result.balance).toMatchInlineSnapshot(`
          {
            "2025-01": 2000,
            "2025-02": 4000,
            "2025-03": 6000,
            "2025-04": 4000,
            "2025-05": 6000,
          }
        `);
      });
    });

    describe("event-happened", () => {
      test("should unlock event only after another event happens", () => {
        const scenario = makeScenario({
          name: "Car purchase and insurance",
          events: [
            makeRecurring({
              name: "Salary",
              frequency: "monthly",
              startDate: ld(2025, 1, 1),
              amount: 2000,
              endDate: null,
              type: "income",
            }),
            makeOneOff({
              name: "Buy Car",
              amount: 10000,
              type: "expense",
              date: ld(2026, 1, 15),
            }),
            makeRecurring({
              name: "Car Insurance",
              amount: 120,
              type: "expense",
              frequency: "monthly",
              startDate: ld(2026, 1, 1),
              endDate: null,
              unlockedBy: [
                {
                  type: "event-happened",
                  tag: "balance",
                  value: { eventName: "Buy Car" },
                },
              ],
            }),
          ],
        });

        const result = runScenario({
          startDate: ld(2025, 12, 1),
          endDate: ld(2026, 3, 1),
          initialBalance: 0,
          scenario,
        });

        // Car insurance should NOT appear in Dec 2025 (car not bought yet)
        expect(result.balance["2025-12"]).toBe(2000);

        // Car insurance SHOULD appear starting Jan 2026 (after car purchase)
        // Jan: +2000 salary -10000 car -120 insurance = -8120
        expect(result.balance["2026-01"]).toBe(2000 - 8120);

        // Feb: +2000 salary -120 insurance
        expect(result.balance["2026-02"]).toBe(2000 - 8120 + 2000 - 120);
      });
    });

    describe("income-is-above", () => {
      test("should unlock event only when income meets threshold", () => {
        const scenario = makeScenario({
          name: "Holiday conditional on salary",
          events: [
            makeRecurring({
              name: "Salary",
              frequency: "monthly",
              startDate: ld(2025, 1, 1),
              amount: 2500, // Part-time
              endDate: ld(2025, 5, 31),
              type: "income",
            }),
            makeRecurring({
              name: "Salary",
              frequency: "monthly",
              startDate: ld(2025, 6, 1),
              amount: 5000, // Full-time starts June
              endDate: null,
              type: "income",
            }),
            makeOneOff({
              name: "Summer Holiday",
              amount: 3500,
              type: "expense",
              date: ld(2025, 7, 15),
              unlockedBy: [
                {
                  type: "income-is-above",
                  tag: "balance",
                  value: { eventName: "Salary", amount: 4000 },
                },
              ],
            }),
          ],
        });

        const result = runScenario({
          startDate: ld(2025, 1, 1),
          endDate: ld(2025, 8, 1),
          initialBalance: 0,
          scenario,
        });

        // Holiday should happen in July because salary is 5000 >= 4000
        expect(result.balance["2025-07"]).toBe(
          2500 * 5 + 5000 * 2 - 3500, // 5 months @ 2500 + 2 months @ 5000 - holiday
        );
      });
    });
  });

  describe("complex cases", () => {
    test("should handle complex multi-year scenario with conditional events", () => {
      const scenario = makeScenario({
        name: "",
        events: [
          makeRecurring({
            name: "Part-time Salary",
            amount: 2500,
            frequency: "monthly",
            type: "income",
            startDate: ld(2025, 1, 1),
            endDate: ld(2025, 5, 31),
          }),

          makeRecurring({
            name: "Full-time Salary",
            amount: 5000,
            frequency: "monthly",
            type: "income",
            startDate: ld(2025, 6, 1),
            endDate: null,
          }),

          makeRecurring({
            name: "Cost of Life",
            amount: 1400,
            frequency: "monthly",
            type: "expense",
            startDate: ld(2025, 1, 1),
            endDate: null,
          }),

          makeRecurring({
            name: "Monthly Investment",
            amount: 400,
            frequency: "monthly",
            type: "expense",
            startDate: ld(2025, 6, 1),
            endDate: null,
            unlockedBy: [
              {
                type: "income-is-above",
                tag: "balance",
                value: { eventName: "Full-time Salary", amount: 4000 },
              },
            ],
          }),

          makeOneOff({
            name: "Buy Car",
            amount: 15000,
            type: "expense",
            date: ld(2026, 1, 15),
          }),

          makeRecurring({
            name: "Car Insurance",
            amount: 120,
            frequency: "monthly",
            type: "expense",
            startDate: ld(2026, 1, 1),
            endDate: null,
            unlockedBy: [
              {
                type: "event-happened",
                tag: "balance",
                value: { eventName: "Buy Car" },
              },
            ],
          }),

          makeRecurring({
            name: "Car Maintenance",
            amount: 600,
            frequency: "yearly",
            type: "expense",
            startDate: ld(2026, 1, 1),
            endDate: null,
            unlockedBy: [
              {
                type: "event-happened",
                tag: "balance",
                value: { eventName: "Buy Car" },
              },
            ],
          }),

          makeOneOff({
            name: "Summer Holiday 2026",
            amount: 3500,
            type: "expense",
            date: ld(2026, 6, 15),
            unlockedBy: [
              {
                type: "income-is-above",
                tag: "balance",
                value: { eventName: "Full-time Salary", amount: 4000 },
              },
            ],
          }),

          makeOneOff({
            name: "Buy House - Low Downpayment",
            amount: 60000,
            type: "expense",
            date: ld(2027, 5, 1),
            unlockedBy: [
              {
                type: "income-is-above",
                tag: "balance",
                value: { eventName: "Full-time Salary", amount: 4000 },
              },
            ],
          }),

          makeRecurring({
            name: "Mortgage Payment",
            amount: 1200,
            frequency: "monthly",
            type: "expense",
            startDate: ld(2027, 5, 1),
            endDate: null,
            unlockedBy: [
              {
                type: "event-happened",
                tag: "balance",
                value: { eventName: "Buy House - Low Downpayment" },
              },
            ],
          }),

          makeRecurring({
            name: "Property Tax",
            amount: 3000,
            frequency: "yearly",
            type: "expense",
            startDate: ld(2027, 5, 1),
            endDate: null,
            unlockedBy: [
              {
                type: "event-happened",
                tag: "balance",
                value: { eventName: "Buy House - Low Downpayment" },
              },
            ],
          }),
        ],
      });

      const result = runScenario({
        scenario,
        startDate: ld(2025, 1, 1),
        endDate: ld(2027, 12, 31),
        initialBalance: 10000 * 10,
      });

      expect(result.balance["2025-01"]).toBe(100000 + 2500 - 1400);

      const balanceMay2025 = 100000 + (2500 - 1400) * 5;
      expect(result.balance["2025-06"]).toBe(
        balanceMay2025 + 5000 - 1400 - 400,
      );

      // Jan 2026: Car purchase
      // Should include car, insurance, and maintenance
      const balanceDec2025 = balanceMay2025 + (5000 - 1400 - 400) * 7; // 7 months full-time with investments
      expect(result.balance["2026-01"]).toBe(
        balanceDec2025 + 5000 - 1400 - 400 - 15000 - 120 - 600,
      );

      // June 2026: Holiday should happen (salary >= 4000)
      const balanceMay2026 =
        balanceDec2025 + (5000 - 1400 - 400 - 120) * 5 - 15000 - 600; // 5 months with car costs
      expect(result.balance["2026-06"]).toBe(
        balanceMay2026 + 5000 - 1400 - 400 - 120 - 3500,
      );

      // May 2027: House purchase with mortgage starting
      // Verify house was purchased and mortgage started
      expect(result.cashflow["2027-05"].events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Buy House - Low Downpayment" }),
          expect.objectContaining({ name: "Mortgage Payment" }),
          expect.objectContaining({ name: "Property Tax" }),
        ]),
      );

      // Verify mortgage continues in June 2027
      expect(result.cashflow["2027-06"].events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Mortgage Payment" }),
        ]),
      );
    });
  });
});
