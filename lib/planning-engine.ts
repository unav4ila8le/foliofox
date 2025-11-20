/**
 * Financial Planning Engine
 *
 * Calculates projected net worth based on:
 * - Current portfolio positions (by category)
 * - Expected returns per category
 * - Income/expense assumptions
 * - Life events (one-time and recurring)
 * - Planned portfolio actions
 */

import { addMonths, isSameMonth, isWithinInterval, addYears } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface CategoryAssumption {
  categoryId: string;
  categoryName: string;
  currentValue: number;
  expectedAnnualReturn: number; // as decimal (0.07 = 7%)
  variance?: number; // optional variance for scenarios (0.03 = ±3%)
}

export interface IncomeExpenseAssumption {
  annualIncome: {
    mean: number;
    variance?: number;
  };
  annualExpenses: {
    mean: number;
    variance?: number;
  };
  reinvestmentRate: number; // % of surplus to invest (0-1)
  reinvestmentAllocation: Array<{
    categoryId: string;
    percentage: number; // what % of reinvestment goes to this category
  }>;
}

export interface OneTimeEvent {
  id: string;
  date: Date;
  amount: number; // positive = income/gain, negative = expense
  description: string;
  emoji?: string; // optional emoji icon for the event
  affectsCategory?: string; // if this event changes a specific category (e.g., "sell 20% of stocks")
  enabled?: boolean; // whether this event is included in calculations (default: true)
}

export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface RecurringEvent {
  id: string;
  startDate: Date;
  endDate?: Date;
  amount: number; // amount per occurrence
  frequency: RecurringFrequency;
  description: string;
  emoji?: string; // optional emoji icon for the event
  enabled?: boolean; // whether this event is included in calculations (default: true)
}

export interface PlannedSale {
  id: string;
  date: Date;
  categoryId: string;
  percentageOfCategory: number; // 0-1 (0.2 = 20%)
  description: string;
}

export interface PlanInputs {
  startDate: Date;
  timeHorizonYears: number;

  // Portfolio starting state
  categoryAssumptions: CategoryAssumption[];

  // Income/Expenses
  incomeExpense: IncomeExpenseAssumption;

  // Events
  oneTimeEvents: OneTimeEvent[];
  recurringEvents: RecurringEvent[];
  plannedSales: PlannedSale[];
}

export type Scenario = 'conservative' | 'expected' | 'optimistic';

export interface ProjectionPoint {
  date: Date;
  netWorth: number;
  cashBalance: number;
  portfolioValueByCategory: Record<string, number>;
  totalPortfolioValue: number;
  events: Array<{
    type: 'one-time' | 'recurring' | 'sale';
    description: string;
    amount?: number;
  }>;
  // Month-over-month breakdown
  monthlyChange?: {
    total: number;
    portfolioGrowth: number;
    cashFlow: number;
    eventImpact: number;
  };
}

export interface ProjectionResult {
  scenario: Scenario;
  points: ProjectionPoint[];
}

// ============================================================================
// Engine
// ============================================================================

export function projectNetWorth(
  inputs: PlanInputs,
  scenario: Scenario = 'expected'
): ProjectionResult {
  const projection: ProjectionPoint[] = [];

  // Initialize portfolio state by category
  const portfolioByCategory: Record<string, number> = {};
  inputs.categoryAssumptions.forEach(cat => {
    portfolioByCategory[cat.categoryId] = cat.currentValue;
  });

  let cashBalance = 0; // Start with 0 cash, grows from income-expenses

  // Adjust assumptions based on scenario
  const getScenarioValue = (mean: number, variance: number = 0) => {
    switch (scenario) {
      case 'conservative':
        return mean - variance;
      case 'optimistic':
        return mean + variance;
      default:
        return mean;
    }
  };

  // Get scenario-adjusted values
  const categoryReturns = inputs.categoryAssumptions.map(cat => ({
    categoryId: cat.categoryId,
    categoryName: cat.categoryName,
    annualReturn: getScenarioValue(cat.expectedAnnualReturn, cat.variance || 0),
  }));

  const annualIncome = getScenarioValue(
    inputs.incomeExpense.annualIncome.mean,
    inputs.incomeExpense.annualIncome.variance || 0
  );

  const annualExpenses = scenario === 'conservative'
    ? inputs.incomeExpense.annualExpenses.mean + (inputs.incomeExpense.annualExpenses.variance || 0)
    : scenario === 'optimistic'
    ? inputs.incomeExpense.annualExpenses.mean - (inputs.incomeExpense.annualExpenses.variance || 0)
    : inputs.incomeExpense.annualExpenses.mean;

  const monthlyIncome = annualIncome / 12;
  const monthlyExpenses = annualExpenses / 12;

  // Month-by-month projection
  const totalMonths = inputs.timeHorizonYears * 12;

  for (let month = 0; month < totalMonths; month++) {
    const currentDate = addMonths(inputs.startDate, month);
    const events: ProjectionPoint['events'] = [];

    // Track changes for breakdown
    const previousNetWorth = month > 0 ? projection[month - 1].netWorth :
      Object.values(portfolioByCategory).reduce((sum, val) => sum + val, 0) + cashBalance;
    const previousPortfolioValue = Object.values(portfolioByCategory).reduce((sum, val) => sum + val, 0);

    // 1. Apply portfolio growth (compound monthly)
    let portfolioGrowth = 0;
    Object.keys(portfolioByCategory).forEach(categoryId => {
      const categoryReturn = categoryReturns.find(c => c.categoryId === categoryId);
      if (categoryReturn) {
        const monthlyReturn = categoryReturn.annualReturn / 12;
        const beforeGrowth = portfolioByCategory[categoryId];
        portfolioByCategory[categoryId] *= (1 + monthlyReturn);
        portfolioGrowth += (portfolioByCategory[categoryId] - beforeGrowth);
      }
    });

    // 2. Apply monthly cash flow (income - expenses)
    const monthlyCashFlow = monthlyIncome - monthlyExpenses;
    cashBalance += monthlyCashFlow;

    // 3. Check for one-time events this month (only enabled ones)
    let eventImpact = 0;
    const oneTimeThisMonth = inputs.oneTimeEvents.filter(e =>
      isSameMonth(e.date, currentDate) && (e.enabled !== false)
    );

    oneTimeThisMonth.forEach(event => {
      eventImpact += event.amount;
      if (event.affectsCategory && portfolioByCategory[event.affectsCategory] !== undefined) {
        // Event affects a specific portfolio category (e.g., inheritance of stocks)
        portfolioByCategory[event.affectsCategory] += event.amount;
      } else {
        // Event affects cash
        cashBalance += event.amount;
      }

      events.push({
        type: 'one-time',
        description: event.description,
        amount: event.amount,
      });
    });

    // 4. Check for recurring events this month (only enabled ones)
    const recurringThisMonth = inputs.recurringEvents.filter(e => {
      if (e.enabled === false) return false;

      const endDate = e.endDate || addYears(currentDate, 100);
      if (!isWithinInterval(currentDate, { start: e.startDate, end: endDate })) {
        return false;
      }

      // Check if this month matches the frequency
      const monthsSinceStart = Math.floor(
        (currentDate.getTime() - e.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );

      switch (e.frequency) {
        case 'monthly':
          return true; // Every month
        case 'quarterly':
          return monthsSinceStart % 3 === 0; // Every 3 months
        case 'yearly':
          // Check if same month and day (not year)
          return currentDate.getMonth() === e.startDate.getMonth() &&
                 currentDate.getDate() === e.startDate.getDate();
        default:
          return true;
      }
    });

    recurringThisMonth.forEach(event => {
      eventImpact += event.amount;
      cashBalance += event.amount;
      events.push({
        type: 'recurring',
        description: event.description,
        amount: event.amount,
      });
    });

    // 5. Check for planned portfolio sales
    const salesThisMonth = inputs.plannedSales.filter(s =>
      isSameMonth(s.date, currentDate)
    );

    salesThisMonth.forEach(sale => {
      const categoryValue = portfolioByCategory[sale.categoryId] || 0;
      const saleAmount = categoryValue * sale.percentageOfCategory;

      portfolioByCategory[sale.categoryId] -= saleAmount;
      cashBalance += saleAmount; // Sale proceeds go to cash

      events.push({
        type: 'sale',
        description: sale.description,
        amount: saleAmount,
      });
    });

    // 6. Apply reinvestment logic (invest surplus cash)
    if (cashBalance > 0 && inputs.incomeExpense.reinvestmentRate > 0) {
      const amountToReinvest = cashBalance * inputs.incomeExpense.reinvestmentRate;

      // Allocate according to user's reinvestment allocation
      inputs.incomeExpense.reinvestmentAllocation.forEach(allocation => {
        const amountForCategory = amountToReinvest * allocation.percentage;
        portfolioByCategory[allocation.categoryId] =
          (portfolioByCategory[allocation.categoryId] || 0) + amountForCategory;
      });

      cashBalance -= amountToReinvest;
    }

    // 7. Calculate totals
    const totalPortfolioValue = Object.values(portfolioByCategory).reduce(
      (sum, val) => sum + val,
      0
    );
    const netWorth = totalPortfolioValue + cashBalance;

    // 8. Calculate month-over-month change breakdown
    const totalChange = netWorth - previousNetWorth;
    const monthlyChange = {
      total: totalChange,
      portfolioGrowth,
      cashFlow: monthlyCashFlow,
      eventImpact,
    };

    // 9. Record projection point
    projection.push({
      date: currentDate,
      netWorth,
      cashBalance,
      portfolioValueByCategory: { ...portfolioByCategory },
      totalPortfolioValue,
      events,
      monthlyChange,
    });
  }

  return {
    scenario,
    points: projection,
  };
}

/**
 * Generate all three scenarios at once
 */
// TODO: not used by useful
export function projectAllScenarios(inputs: PlanInputs): {
  conservative: ProjectionResult;
  expected: ProjectionResult;
  optimistic: ProjectionResult;
} {
  return {
    conservative: projectNetWorth(inputs, 'conservative'),
    expected: projectNetWorth(inputs, 'expected'),
    optimistic: projectNetWorth(inputs, 'optimistic'),
  };
}
