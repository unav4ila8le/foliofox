/**
 * Tests for Planning Engine Event Template Builders
 */

import {
  createSalaryIncome,
  createFreelanceIncome,
  createTaxEvent,
} from '../planning-engine';

describe('Event Template Builders', () => {
  describe('createSalaryIncome', () => {
    it('should create salary income without tax events', () => {
      const events = createSalaryIncome({
        description: 'Test Job',
        grossMonthlySalary: 5000,
        startDate: new Date(2025, 0, 1),
      });

      expect(events).toHaveLength(1);
      expect(events[0].description).toBe('Test Job');
      expect(events[0].amount).toBe(5000); // no tax
      expect(events[0].tags).toContain('income');
      expect(events[0].tags).toContain('salary');
    });

    it('should create salary income with automatic tax events', () => {
      const events = createSalaryIncome({
        description: 'Software Engineer',
        grossMonthlySalary: 6000,
        taxRate: 0.30,
        startDate: new Date(2025, 0, 1),
        autoCreateTaxEvents: true,
      });

      expect(events).toHaveLength(2);

      // Check income event
      const incomeEvent = events[0];
      expect(incomeEvent.amount).toBe(4200); // 6000 * 0.7
      expect(incomeEvent.tags).toContain('income');
      expect(incomeEvent.metadata?.grossAmount).toBe(6000);
      expect(incomeEvent.metadata?.taxRate).toBe(0.30);

      // Check tax event
      const taxEvent = events[1];
      expect(taxEvent.amount).toBe(-1800); // 6000 * 0.3, negative
      expect(taxEvent.tags).toContain('expense');
      expect(taxEvent.tags).toContain('tax');
      expect(taxEvent.description).toContain('Tax payment');

      // Check they're linked
      expect(incomeEvent.linkedEventIds).toContain(taxEvent.id);
      expect(taxEvent.linkedEventIds).toContain(incomeEvent.id);
    });

    it('should respect contract end date', () => {
      const endDate = new Date(2027, 0, 1);
      const events = createSalaryIncome({
        description: '2-year Contract',
        grossMonthlySalary: 5000,
        startDate: new Date(2025, 0, 1),
        endDate,
        autoCreateTaxEvents: true,
      });

      expect(events).toHaveLength(2);
      expect(events[0].endDate).toEqual(endDate);
      expect(events[1].endDate).toEqual(endDate); // tax event also ends
    });

    it('should support quarterly tax payments', () => {
      const events = createSalaryIncome({
        description: 'Test Job',
        grossMonthlySalary: 6000,
        taxRate: 0.30,
        startDate: new Date(2025, 0, 1),
        autoCreateTaxEvents: true,
        taxPaymentFrequency: 'quarterly',
      });

      const taxEvent = events[1];
      expect(taxEvent.frequency).toBe('quarterly');
      expect(taxEvent.amount).toBe(-5400); // 3 months * 6000 * 0.3
    });
  });

  describe('createFreelanceIncome', () => {
    it('should create ongoing freelance income', () => {
      const events = createFreelanceIncome({
        description: 'Freelance Design',
        monthlyRate: 3000,
        taxRate: 0.25,
        startDate: new Date(2025, 0, 1),
        autoCreateTaxEvents: true,
      });

      expect(events).toHaveLength(2);

      // Income event
      expect(events[0].amount).toBe(2250); // 3000 * 0.75
      expect(events[0].tags).toContain('freelance');

      // Tax event should be quarterly
      const taxEvent = events[1] as any;
      expect(taxEvent.frequency).toBe('quarterly');
      expect(taxEvent.amount).toBe(-2250); // 3 months * 3000 * 0.25
    });

    it('should create one-time project', () => {
      const events = createFreelanceIncome({
        description: 'Website Project',
        projectAmount: 10000,
        isOneTime: true,
        taxRate: 0.25,
        startDate: new Date(2025, 3, 1),
        autoCreateTaxEvents: true,
      });

      expect(events).toHaveLength(2);

      // Check it's a one-time event (has 'date' not 'frequency')
      expect('date' in events[0]).toBe(true);
      expect(events[0].amount).toBe(7500); // 10000 * 0.75
      expect(events[0].tags).toContain('project');

      // Tax is also one-time
      expect('date' in events[1]).toBe(true);
      expect(events[1].amount).toBe(-2500);
    });

    it('should respect contract end dates', () => {
      const endDate = new Date(2026, 0, 1);
      const events = createFreelanceIncome({
        description: 'Contract Work',
        monthlyRate: 4000,
        startDate: new Date(2025, 0, 1),
        endDate,
        autoCreateTaxEvents: true,
      });

      const recurringEvent = events[0] as any;
      expect(recurringEvent.endDate).toEqual(endDate);
    });
  });

  describe('createTaxEvent', () => {
    it('should create recurring tax event', () => {
      const event = createTaxEvent({
        description: 'Annual Property Tax',
        amount: -5000,
        frequency: 'yearly',
        startDate: new Date(2025, 0, 1),
      });

      expect(event.amount).toBe(-5000);
      expect(event.tags).toContain('tax');
      expect('frequency' in event).toBe(true);
    });

    it('should create one-time tax event', () => {
      const event = createTaxEvent({
        description: 'Capital Gains Tax',
        amount: -2000,
        isOneTime: true,
        startDate: new Date(2025, 3, 15),
      });

      expect('date' in event).toBe(true);
      expect(event.amount).toBe(-2000);
    });

    it('should ensure amount is negative', () => {
      const event = createTaxEvent({
        description: 'Test Tax',
        amount: 1000, // positive
        isOneTime: true,
        startDate: new Date(2025, 0, 1),
      });

      expect(event.amount).toBe(-1000); // converted to negative
    });
  });
});
