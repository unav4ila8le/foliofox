/**
 * Example Usage of Enhanced Planning Engine
 *
 * This file demonstrates how to use the event template builders
 * to model complex income scenarios with taxes.
 */

import {
  createSalaryIncome,
  createFreelanceIncome,
  createTaxEvent,
  projectNetWorth,
  type PlanInputs,
  type RecurringEvent,
  type OneTimeEvent,
} from './planning-engine';

// ============================================================================
// Example 1: Full-time Employee with 2-year contract
// ============================================================================

export function example1_EmployeeWithContract() {
  const salaryEvents = createSalaryIncome({
    description: 'Software Engineer at TechCo',
    grossMonthlySalary: 6000,
    taxRate: 0.30, // 30% tax
    startDate: new Date(2025, 0, 1), // Jan 1, 2025
    endDate: new Date(2027, 0, 1), // Jan 1, 2027 (2-year contract)
    autoCreateTaxEvents: true,
    taxPaymentFrequency: 'monthly', // taxes withheld monthly
  });

  console.log('Employee Salary Events:', salaryEvents);
  // Returns 2 events:
  // 1. Monthly income of $4,200 (net after 30% tax)
  // 2. Monthly tax payment of $1,800
  // Both automatically stop after 2 years

  return salaryEvents;
}

// ============================================================================
// Example 2: Freelancer with Quarterly Estimated Taxes
// ============================================================================

export function example2_FreelancerWithEstimatedTaxes() {
  const freelanceEvents = createFreelanceIncome({
    description: 'Freelance Web Development',
    monthlyRate: 5000,
    taxRate: 0.25, // 25% self-employment tax
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2026, 0, 1), // 1-year contract
    autoCreateTaxEvents: true,
  });

  console.log('Freelance Events:', freelanceEvents);
  // Returns 2 events:
  // 1. Monthly income of $3,750 (net after 25% tax)
  // 2. Quarterly tax payment of $3,750 (3 months × $5,000 × 25%)

  return freelanceEvents;
}

// ============================================================================
// Example 3: Multiple Income Streams (Employee + Side Hustle)
// ============================================================================

export function example3_MultipleIncomeStreams() {
  // Main job
  const mainJob = createSalaryIncome({
    description: 'Full-time Developer',
    grossMonthlySalary: 5000,
    taxRate: 0.28,
    startDate: new Date(2025, 0, 1),
    autoCreateTaxEvents: true,
  });

  // Side freelance work
  const sideHustle = createFreelanceIncome({
    description: 'Weekend Consulting',
    monthlyRate: 2000,
    taxRate: 0.20,
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2025, 6, 1), // Just for 6 months
    autoCreateTaxEvents: true,
  });

  const allEvents = [...mainJob, ...sideHustle];
  console.log('Multiple Income Streams:', allEvents);

  // Returns 4 events total:
  // 1. Main job income (monthly)
  // 2. Main job taxes (monthly)
  // 3. Side hustle income (monthly, ends after 6 months)
  // 4. Side hustle taxes (quarterly, ends after 6 months)

  return allEvents;
}

// ============================================================================
// Example 4: One-time Freelance Project
// ============================================================================

export function example4_OneTimeProject() {
  const projectEvents = createFreelanceIncome({
    description: 'Website Redesign Project',
    projectAmount: 15000, // total project value
    isOneTime: true,
    taxRate: 0.25,
    startDate: new Date(2025, 3, 1), // April 1, 2025
    autoCreateTaxEvents: true,
  });

  console.log('One-time Project Events:', projectEvents);
  // Returns 2 events:
  // 1. One-time income of $11,250 (net)
  // 2. One-time tax payment of $3,750

  return projectEvents;
}

// ============================================================================
// Example 5: Complex Scenario - Career Transition
// ============================================================================

export function example5_CareerTransition() {
  // Current job ending mid-year
  const currentJob = createSalaryIncome({
    description: 'Current Job at OldCo',
    grossMonthlySalary: 4500,
    taxRate: 0.25,
    startDate: new Date(2025, 0, 1),
    endDate: new Date(2025, 5, 30), // Ends June 30
    autoCreateTaxEvents: true,
  });

  // Gap period - freelance work
  const freelanceGap = createFreelanceIncome({
    description: 'Contract Work During Gap',
    monthlyRate: 3000,
    taxRate: 0.20,
    startDate: new Date(2025, 6, 1), // July 1
    endDate: new Date(2025, 8, 30), // Sept 30
    autoCreateTaxEvents: true,
  });

  // New job starting
  const newJob = createSalaryIncome({
    description: 'New Job at NewCo',
    grossMonthlySalary: 7000,
    taxRate: 0.32,
    startDate: new Date(2025, 9, 1), // Oct 1
    autoCreateTaxEvents: true,
  });

  const allEvents = [...currentJob, ...freelanceGap, ...newJob];
  console.log('Career Transition Events:', allEvents);

  return allEvents;
}

// ============================================================================
// Example 6: Manual Tax Event (Custom Scenario)
// ============================================================================

export function example6_ManualTaxEvent() {
  // Income without auto-tax
  const income = createSalaryIncome({
    description: 'Salary (taxes handled separately)',
    grossMonthlySalary: 5000,
    taxRate: 0, // No auto-tax
    startDate: new Date(2025, 0, 1),
  });

  // Manual yearly tax payment
  const yearlyTax = createTaxEvent({
    description: 'Annual Tax Payment',
    amount: -15000, // negative = expense
    frequency: 'yearly',
    startDate: new Date(2025, 3, 15), // April 15 each year
    linkedIncomeEventId: income[0].id,
  });

  return [...income, yearlyTax];
}

// ============================================================================
// Example 7: Full Projection with Portfolio
// ============================================================================

export function example7_FullProjection() {
  // Create income events
  const salaryEvents = createSalaryIncome({
    description: 'Software Engineer',
    grossMonthlySalary: 6000,
    taxRate: 0.30,
    startDate: new Date(2025, 0, 1),
    autoCreateTaxEvents: true,
  });

  // Build complete plan input
  const planInput: PlanInputs = {
    startDate: new Date(2025, 0, 1),
    timeHorizonYears: 10,

    // Starting portfolio
    categoryAssumptions: [
      {
        categoryId: 'stocks',
        categoryName: 'Stocks',
        currentValue: 50000,
        expectedAnnualReturn: 0.08,
        variance: 0.03,
      },
      {
        categoryId: 'bonds',
        categoryName: 'Bonds',
        currentValue: 20000,
        expectedAnnualReturn: 0.04,
        variance: 0.01,
      },
    ],

    // Income/Expenses (note: we're not using this for income since we have salary events)
    incomeExpense: {
      annualIncome: {
        mean: 0, // Using salary events instead
        variance: 0,
      },
      annualExpenses: {
        mean: 30000, // $2,500/month living expenses
        variance: 5000,
      },
      reinvestmentRate: 0.8, // Invest 80% of surplus
      reinvestmentAllocation: [
        { categoryId: 'stocks', percentage: 0.7 },
        { categoryId: 'bonds', percentage: 0.3 },
      ],
    },

    // Use our generated salary events
    oneTimeEvents: [],
    recurringEvents: salaryEvents, // Both income and tax events
    plannedSales: [],
  };

  // Run projection
  const projection = projectNetWorth(planInput, 'expected');

  console.log('10-year projection with salary and taxes:');
  console.log('Starting net worth:', projection.points[0].netWorth);
  console.log('Ending net worth:', projection.points[projection.points.length - 1].netWorth);

  return projection;
}

// ============================================================================
// Utility: Print Event Summary
// ============================================================================

export function printEventSummary(events: (RecurringEvent | OneTimeEvent)[]) {
  console.log('\n=== Event Summary ===');
  events.forEach(event => {
    const isRecurring = 'frequency' in event;
    const type = isRecurring ? `Recurring (${event.frequency})` : 'One-time';
    const dates = isRecurring
      ? `${event.startDate.toDateString()} → ${event.endDate?.toDateString() || 'ongoing'}`
      : event.date.toDateString();

    console.log(`\n${event.emoji || '📌'} ${event.description}`);
    console.log(`   Type: ${type}`);
    console.log(`   Amount: $${event.amount.toFixed(2)}`);
    console.log(`   Dates: ${dates}`);
    console.log(`   Tags: ${event.tags?.join(', ') || 'none'}`);

    if (event.metadata) {
      console.log(`   Metadata:`, event.metadata);
    }

    if (event.linkedEventIds?.length) {
      console.log(`   Linked events: ${event.linkedEventIds.length}`);
    }
  });
  console.log('\n');
}
