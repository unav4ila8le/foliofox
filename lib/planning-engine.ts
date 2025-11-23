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
  tags?: string[]; // categorization tags (e.g., ["income", "bonus"], ["expense", "tax"])
  metadata?: Record<string, any>; // flexible storage for additional data (gross amount, tax rate, etc.)
  linkedEventIds?: string[]; // IDs of related events (e.g., salary event links to its tax event)
}

export type RecurringFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface RecurringEvent {
  id: string;
  startDate: Date;
  endDate?: Date; // when this recurring event stops (e.g., contract end date)
  amount: number; // amount per occurrence
  frequency: RecurringFrequency;
  description: string;
  emoji?: string; // optional emoji icon for the event
  enabled?: boolean; // whether this event is included in calculations (default: true)
  tags?: string[]; // categorization tags (e.g., ["income", "salary"], ["expense", "tax"])
  metadata?: Record<string, any>; // flexible storage for additional data (gross amount, tax rate, etc.)
  linkedEventIds?: string[]; // IDs of related events (e.g., salary event links to its tax event)
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

// ============================================================================
// Event Template Builders
// ============================================================================

/**
 * Helper to generate unique IDs for events
 */
function generateEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface SalaryIncomeParams {
  description: string;
  grossMonthlySalary: number;
  taxRate?: number; // decimal (0.3 = 30% tax)
  startDate: Date;
  endDate?: Date; // optional contract end date
  frequency?: RecurringFrequency;
  emoji?: string;
  autoCreateTaxEvents?: boolean; // if true, creates linked tax payment events
  taxPaymentFrequency?: RecurringFrequency; // how often taxes are paid (default: monthly for employees)
}

/**
 * Creates a salary income stream with optional automatic tax events
 *
 * Example (employee):
 *   createSalaryIncome({
 *     description: "Software Engineer at TechCo",
 *     grossMonthlySalary: 5000,
 *     taxRate: 0.30,
 *     startDate: new Date(2025, 0, 1),
 *     endDate: new Date(2027, 0, 1), // 2-year contract
 *     autoCreateTaxEvents: true,
 *     taxPaymentFrequency: 'monthly'
 *   })
 *
 * Returns: [income event, tax event (if autoCreateTaxEvents)]
 */
export function createSalaryIncome(params: SalaryIncomeParams): RecurringEvent[] {
  const events: RecurringEvent[] = [];

  const taxRate = params.taxRate || 0;
  const netMonthlySalary = params.grossMonthlySalary * (1 - taxRate);
  const frequency = params.frequency || 'monthly';

  const salaryId = generateEventId('salary');
  const taxId = params.autoCreateTaxEvents ? generateEventId('tax') : undefined;

  // Create the income event (net salary)
  const salaryEvent: RecurringEvent = {
    id: salaryId,
    description: params.description,
    amount: netMonthlySalary,
    frequency,
    startDate: params.startDate,
    endDate: params.endDate,
    emoji: params.emoji || '💼',
    enabled: true,
    tags: ['income', 'salary'],
    metadata: {
      grossAmount: params.grossMonthlySalary,
      taxRate,
      netAmount: netMonthlySalary,
      type: 'salary',
    },
    linkedEventIds: taxId ? [taxId] : undefined,
  };

  events.push(salaryEvent);

  // Create automatic tax payment events if requested
  if (params.autoCreateTaxEvents && taxRate > 0) {
    const taxFrequency = params.taxPaymentFrequency || 'monthly';
    const monthlyTax = params.grossMonthlySalary * taxRate;

    // Adjust tax amount based on payment frequency
    let taxAmount = monthlyTax;
    if (taxFrequency === 'quarterly') {
      taxAmount = monthlyTax * 3;
    } else if (taxFrequency === 'yearly') {
      taxAmount = monthlyTax * 12;
    }

    const taxEvent: RecurringEvent = {
      id: taxId!,
      description: `Tax payment for ${params.description}`,
      amount: -taxAmount, // negative because it's an expense
      frequency: taxFrequency,
      startDate: params.startDate,
      endDate: params.endDate,
      emoji: '🏛️',
      enabled: true,
      tags: ['expense', 'tax'],
      metadata: {
        taxRate,
        linkedSalaryId: salaryId,
        type: 'income-tax',
      },
      linkedEventIds: [salaryId],
    };

    events.push(taxEvent);
  }

  return events;
}

export interface FreelanceIncomeParams {
  description: string;
  monthlyRate?: number; // for ongoing contracts
  projectAmount?: number; // for one-time projects
  isOneTime?: boolean; // true for project-based, false for ongoing
  taxRate?: number;
  startDate: Date;
  endDate?: Date;
  frequency?: RecurringFrequency;
  emoji?: string;
  autoCreateTaxEvents?: boolean;
}

/**
 * Creates freelance income with quarterly estimated tax payments
 *
 * Example (ongoing freelance):
 *   createFreelanceIncome({
 *     description: "Freelance Design Work",
 *     monthlyRate: 3000,
 *     taxRate: 0.25,
 *     startDate: new Date(2025, 0, 1),
 *     autoCreateTaxEvents: true
 *   })
 */
export function createFreelanceIncome(params: FreelanceIncomeParams): (RecurringEvent | OneTimeEvent)[] {
  const events: (RecurringEvent | OneTimeEvent)[] = [];

  const taxRate = params.taxRate || 0;
  const freelanceId = generateEventId('freelance');
  const taxId = params.autoCreateTaxEvents ? generateEventId('tax') : undefined;

  if (params.isOneTime && params.projectAmount) {
    // One-time project
    const netAmount = params.projectAmount * (1 - taxRate);

    const projectEvent: OneTimeEvent = {
      id: freelanceId,
      description: params.description,
      date: params.startDate,
      amount: netAmount,
      emoji: params.emoji || '🎨',
      enabled: true,
      tags: ['income', 'freelance', 'project'],
      metadata: {
        grossAmount: params.projectAmount,
        taxRate,
        netAmount,
        type: 'freelance-project',
      },
      linkedEventIds: taxId ? [taxId] : undefined,
    };

    events.push(projectEvent);

    // Create one-time tax payment if requested
    if (params.autoCreateTaxEvents && taxRate > 0) {
      const taxEvent: OneTimeEvent = {
        id: taxId!,
        description: `Tax payment for ${params.description}`,
        date: params.startDate,
        amount: -(params.projectAmount * taxRate),
        emoji: '🏛️',
        enabled: true,
        tags: ['expense', 'tax'],
        metadata: {
          taxRate,
          linkedFreelanceId: freelanceId,
          type: 'self-employment-tax',
        },
        linkedEventIds: [freelanceId],
      };

      events.push(taxEvent);
    }
  } else if (params.monthlyRate) {
    // Ongoing freelance work
    const netMonthlyRate = params.monthlyRate * (1 - taxRate);
    const frequency = params.frequency || 'monthly';

    const freelanceEvent: RecurringEvent = {
      id: freelanceId,
      description: params.description,
      amount: netMonthlyRate,
      frequency,
      startDate: params.startDate,
      endDate: params.endDate,
      emoji: params.emoji || '🎨',
      enabled: true,
      tags: ['income', 'freelance'],
      metadata: {
        grossAmount: params.monthlyRate,
        taxRate,
        netAmount: netMonthlyRate,
        type: 'freelance-recurring',
      },
      linkedEventIds: taxId ? [taxId] : undefined,
    };

    events.push(freelanceEvent);

    // Create quarterly estimated tax payments
    if (params.autoCreateTaxEvents && taxRate > 0) {
      const quarterlyTax = params.monthlyRate * taxRate * 3;

      const taxEvent: RecurringEvent = {
        id: taxId!,
        description: `Quarterly tax for ${params.description}`,
        amount: -quarterlyTax,
        frequency: 'quarterly',
        startDate: params.startDate,
        endDate: params.endDate,
        emoji: '🏛️',
        enabled: true,
        tags: ['expense', 'tax', 'estimated'],
        metadata: {
          taxRate,
          linkedFreelanceId: freelanceId,
          type: 'self-employment-tax',
        },
        linkedEventIds: [freelanceId],
      };

      events.push(taxEvent);
    }
  }

  return events;
}

export interface TaxEventParams {
  description: string;
  amount: number; // should be negative (expense)
  frequency?: RecurringFrequency;
  startDate: Date;
  endDate?: Date;
  isOneTime?: boolean;
  linkedIncomeEventId?: string;
  emoji?: string;
}

/**
 * Creates a standalone tax payment event
 * Useful for custom tax situations not covered by auto-generation
 */
export function createTaxEvent(params: TaxEventParams): RecurringEvent | OneTimeEvent {
  const taxId = generateEventId('tax');

  const baseEvent = {
    id: taxId,
    description: params.description,
    amount: params.amount < 0 ? params.amount : -params.amount, // ensure negative
    emoji: params.emoji || '🏛️',
    enabled: true,
    tags: ['expense', 'tax'],
    metadata: {
      type: 'custom-tax',
    },
    linkedEventIds: params.linkedIncomeEventId ? [params.linkedIncomeEventId] : undefined,
  };

  if (params.isOneTime) {
    return {
      ...baseEvent,
      date: params.startDate,
    } as OneTimeEvent;
  } else {
    return {
      ...baseEvent,
      frequency: params.frequency || 'yearly',
      startDate: params.startDate,
      endDate: params.endDate,
    } as RecurringEvent;
  }
}
