"use client";

import { useState, useMemo } from "react";
import { addYears, format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

// Simple useLocalStorage hook
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.warn(`Error saving localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlanProjectionChart } from "@/components/dashboard/plans/plan-projection-chart";
import { SalaryIncomeForm } from "@/components/dashboard/plans/salary-income-form";
import { FreelanceIncomeForm } from "@/components/dashboard/plans/freelance-income-form";

import {
  projectNetWorth,
  type PlanInputs,
  type CategoryAssumption,
  type OneTimeEvent,
  type RecurringEvent,
  type RecurringFrequency,
} from "@/lib/planning-engine";
import { type TimeScale } from "@/lib/projection-aggregation";

// For prototype: hardcoded demo data
const DEMO_CATEGORIES: CategoryAssumption[] = [
  // {
  //   categoryId: "equity",
  //   categoryName: "Equity",
  //   currentValue: 150000,
  //   expectedAnnualReturn: 0.08,
  //   variance: 0.04,
  // },
  // {
  //   categoryId: "fixed_income",
  //   categoryName: "Fixed Income",
  //   currentValue: 50000,
  //   expectedAnnualReturn: 0.04,
  //   variance: 0.01,
  // },
  // {
  //   categoryId: "real_estate",
  //   categoryName: "Real Estate",
  //   currentValue: 300000,
  //   expectedAnnualReturn: 0.06,
  //   variance: 0.03,
  // },
  {
    categoryId: "cash",
    categoryName: "Cash",
    currentValue: 100000,
    expectedAnnualReturn: 0.015,
    variance: 0,
  },
];

const DEMO_HISTORICAL_DATA = [
  // { date: new Date(2024, 0, 1), netWorth: 450000 },
  // { date: new Date(2024, 1, 1), netWorth: 460000 },
  // { date: new Date(2024, 2, 1), netWorth: 470000 },
  // { date: new Date(2024, 3, 1), netWorth: 480000 },
  // { date: new Date(2024, 4, 1), netWorth: 490000 },
  // { date: new Date(2024, 5, 1), netWorth: 500000 },
  // { date: new Date(2024, 6, 1), netWorth: 510000 },
  // { date: new Date(2024, 7, 1), netWorth: 515000 },
  // { date: new Date(2024, 8, 1), netWorth: 518000 },
  // { date: new Date(2024, 9, 1), netWorth: 520000 },
  // { date: new Date(2024, 10, 1), netWorth: 520000 },
  // { date: new Date(2025, 0, 1), netWorth: 0 },
];

export default function PlansPage() {
  // Basic assumptions (persisted in localStorage)
  const [annualExpenses, setAnnualExpenses] = useLocalStorage("plans_annualExpenses", 60000);
  const [reinvestmentRate, setReinvestmentRate] = useLocalStorage("plans_reinvestmentRate", 0.5); // 50%
  const [timeHorizon, setTimeHorizon] = useLocalStorage("plans_timeHorizon", "10");
  const [startDate, setStartDate] = useLocalStorage("plans_startDate", format(new Date(), "yyyy-MM-dd"));
  const [timeScale, setTimeScale] = useLocalStorage<TimeScale>("plans_timeScale", "monthly");

  // Events (with localStorage persistence)
  // We need to handle Date serialization/deserialization
  const [eventsRaw, setEventsRaw] = useLocalStorage<any[]>("plans_events", []);
  const [recurringEventsRaw, setRecurringEventsRaw] = useLocalStorage<any[]>("plans_recurringEvents", []);

  // Convert raw data to proper types with Date objects
  const events: OneTimeEvent[] = useMemo(() =>
    eventsRaw.map(e => ({ ...e, date: new Date(e.date) })),
    [eventsRaw]
  );

  const recurringEvents: RecurringEvent[] = useMemo(() =>
    recurringEventsRaw.map(e => ({
      ...e,
      startDate: new Date(e.startDate),
      endDate: e.endDate ? new Date(e.endDate) : undefined,
    })),
    [recurringEventsRaw]
  );

  const setEvents = (newEvents: OneTimeEvent[]) => {
    setEventsRaw(newEvents);
  };

  const setRecurringEvents = (newEvents: RecurringEvent[]) => {
    setRecurringEventsRaw(newEvents);
  };

  // Form state for new events
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventDate, setNewEventDate] = useState(format(addYears(new Date(), 1), "yyyy-MM-dd"));
  const [newEventAmount, setNewEventAmount] = useState(0);
  const [newEventEmoji, setNewEventEmoji] = useState("");

  const [newRecurringDescription, setNewRecurringDescription] = useState("");
  const [newRecurringStartDate, setNewRecurringStartDate] = useState(format(addYears(new Date(), 1), "yyyy-MM-dd"));
  const [newRecurringEndDate, setNewRecurringEndDate] = useState("");
  const [newRecurringAmount, setNewRecurringAmount] = useState(0);
  const [newRecurringFrequency, setNewRecurringFrequency] = useState<RecurringFrequency>("monthly");
  const [newRecurringEmoji, setNewRecurringEmoji] = useState("");

  // Event handlers
  const addOneTimeEvent = () => {
    if (!newEventDescription || newEventAmount === 0) return;

    setEvents([
      ...events,
      {
        id: Date.now().toString(),
        date: new Date(newEventDate),
        amount: newEventAmount,
        description: newEventDescription,
        emoji: newEventEmoji || undefined,
      },
    ]);

    // Reset form
    setNewEventDescription("");
    setNewEventDate(format(addYears(new Date(), 1), "yyyy-MM-dd"));
    setNewEventAmount(0);
    setNewEventEmoji("");
  };

  const removeOneTimeEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const addRecurringEvent = () => {
    if (!newRecurringDescription || newRecurringAmount === 0) return;

    setRecurringEvents([
      ...recurringEvents,
      {
        id: Date.now().toString(),
        startDate: new Date(newRecurringStartDate),
        endDate: newRecurringEndDate ? new Date(newRecurringEndDate) : undefined,
        amount: newRecurringAmount,
        frequency: newRecurringFrequency,
        description: newRecurringDescription,
        emoji: newRecurringEmoji || undefined,
      },
    ]);

    // Reset form
    setNewRecurringDescription("");
    setNewRecurringStartDate(format(addYears(new Date(), 1), "yyyy-MM-dd"));
    setNewRecurringEndDate("");
    setNewRecurringAmount(0);
    setNewRecurringFrequency("monthly");
    setNewRecurringEmoji("");
  };

  const removeRecurringEvent = (id: string) => {
    setRecurringEvents(recurringEvents.filter((e) => e.id !== id));
  };

  // Toggle event enabled/disabled
  const toggleEvent = (eventId: string, type: 'one-time' | 'recurring') => {
    if (type === 'one-time') {
      setEvents(events.map(e =>
        e.id === eventId ? { ...e, enabled: e.enabled === false ? true : false } : e
      ));
    } else {
      setRecurringEvents(recurringEvents.map(e =>
        e.id === eventId ? { ...e, enabled: e.enabled === false ? true : false } : e
      ));
    }
  };

  // Handler for salary income form
  const handleAddSalaryIncome = (salaryEvents: RecurringEvent[]) => {
    setRecurringEvents([...recurringEvents, ...salaryEvents]);
  };

  // Handler for freelance income form
  const handleAddFreelanceIncome = (freelanceEvents: (RecurringEvent | OneTimeEvent)[]) => {
    const newRecurring = freelanceEvents.filter(e => 'frequency' in e) as RecurringEvent[];
    const newOneTime = freelanceEvents.filter(e => 'date' in e) as OneTimeEvent[];

    if (newRecurring.length > 0) {
      setRecurringEvents([...recurringEvents, ...newRecurring]);
    }
    if (newOneTime.length > 0) {
      setEvents([...events, ...newOneTime]);
    }
  };

  // Category assumptions (persisted in localStorage)
  const [categoryAssumptions, setCategoryAssumptions] = useLocalStorage<CategoryAssumption[]>(
    "plans_categories",
    DEMO_CATEGORIES.length > 0 ? DEMO_CATEGORIES : [
      {
        categoryId: "cash",
        categoryName: "Cash",
        currentValue: 10000,
        expectedAnnualReturn: 0.015,
        variance: 0,
      },
    ]
  );

  // Reinvestment allocation (persisted)
  const [reinvestmentAllocation, setReinvestmentAllocation] = useLocalStorage<Array<{
    categoryId: string;
    percentage: number;
  }>>(
    "plans_reinvestmentAllocation",
    categoryAssumptions.map((cat, idx) => ({
      categoryId: cat.categoryId,
      percentage: idx === 0 ? 1.0 : 0, // Default: 100% to first category
    }))
  );

  // Category management functions
  const addCategory = () => {
    const newId = `category-${Date.now()}`;
    const newCategory: CategoryAssumption = {
      categoryId: newId,
      categoryName: "New Category",
      currentValue: 0,
      expectedAnnualReturn: 0.05,
      variance: 0,
    };
    setCategoryAssumptions([...categoryAssumptions, newCategory]);

    // Add to reinvestment allocation with 0%
    setReinvestmentAllocation([
      ...reinvestmentAllocation,
      { categoryId: newId, percentage: 0 },
    ]);
  };

  const removeCategory = (categoryId: string) => {
    if (categoryAssumptions.length <= 1) {
      alert("You must have at least one portfolio category");
      return;
    }

    setCategoryAssumptions(categoryAssumptions.filter(c => c.categoryId !== categoryId));
    setReinvestmentAllocation(reinvestmentAllocation.filter(a => a.categoryId !== categoryId));
  };

  const updateCategoryField = (categoryId: string, field: keyof CategoryAssumption, value: any) => {
    setCategoryAssumptions(
      categoryAssumptions.map(cat =>
        cat.categoryId === categoryId ? { ...cat, [field]: value } : cat
      )
    );

    // If category name changed, update categoryId and reinvestment allocation
    if (field === 'categoryName') {
      const newId = value.toLowerCase().replace(/\s+/g, '-');
      setCategoryAssumptions(prev =>
        prev.map(cat =>
          cat.categoryId === categoryId ? { ...cat, categoryId: newId } : cat
        )
      );
      setReinvestmentAllocation(prev =>
        prev.map(alloc =>
          alloc.categoryId === categoryId ? { ...alloc, categoryId: newId } : alloc
        )
      );
    }
  };

  const updateReinvestmentAllocation = (categoryId: string, percentage: number) => {
    setReinvestmentAllocation(
      reinvestmentAllocation.map(alloc =>
        alloc.categoryId === categoryId ? { ...alloc, percentage: percentage / 100 } : alloc
      )
    );
  };

  // Calculate total reinvestment percentage
  const totalReinvestmentPercentage = reinvestmentAllocation.reduce(
    (sum, alloc) => sum + alloc.percentage,
    0
  );

  // Calculate projection
  const projection = useMemo(() => {
    const inputs: PlanInputs = {
      startDate: new Date(startDate),
      timeHorizonYears: Number(timeHorizon),
      categoryAssumptions,
      incomeExpense: {
        annualIncome: {
          mean: 0, // Income is now handled by Salary/Freelance events
          variance: 0,
        },
        annualExpenses: {
          mean: annualExpenses,
          variance: 0,
        },
        reinvestmentRate,
        reinvestmentAllocation,
      },
      oneTimeEvents: events,
      recurringEvents,
      plannedSales: [],
    };

    return projectNetWorth(inputs, 'expected');
  }, [
    startDate,
    timeHorizon,
    categoryAssumptions,
    annualExpenses,
    reinvestmentRate,
    reinvestmentAllocation,
    events,
    recurringEvents,
  ]);

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Plans</h1>
        <p className="text-muted-foreground">
          Visualize how your net worth will evolve based on life events and assumptions
        </p>
      </div>

      {/* Chart */}
      <Card className="flex flex-col" style={{ height: "600px" }}>
        <CardHeader>
          <div className="flex justify-between gap-4">
            <div>
              <CardTitle>Net Worth Projection</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="start-date" className="text-sm whitespace-nowrap">Start Date:</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <Select value={timeScale} onValueChange={(value) => setTimeScale(value as TimeScale)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeHorizon} onValueChange={setTimeHorizon}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="5">5 Years</SelectItem>
                  <SelectItem value="10">10 Years</SelectItem>
                  <SelectItem value="30">30 Years</SelectItem>
                  <SelectItem value="50">50 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <PlanProjectionChart
            historicalData={DEMO_HISTORICAL_DATA}
            projection={projection}
            currency="USD"
            oneTimeEvents={events}
            recurringEvents={recurringEvents}
            onToggleEvent={toggleEvent}
            timeScale={timeScale}
          />
        </CardContent>
      </Card>

      {/* Input Form */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Baseline Assumptions */}
        <Card>
          <CardHeader>
            <CardTitle>Baseline Assumptions</CardTitle>
            <CardDescription>Living expenses and savings behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expenses">Annual Living Expenses</Label>
              <Input
                id="expenses"
                type="number"
                value={annualExpenses}
                onChange={(e) => setAnnualExpenses(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Baseline expenses (rent, food, utilities, etc.) - not including one-time events
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reinvestment">
                Reinvestment Rate (% of surplus)
              </Label>
              <Input
                id="reinvestment"
                type="number"
                min="0"
                max="100"
                value={reinvestmentRate * 100}
                onChange={(e) => setReinvestmentRate(Number(e.target.value) / 100)}
              />
              <p className="text-xs text-muted-foreground">
                How much of your surplus cash to automatically invest each month
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Assumptions */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Assumptions</CardTitle>
            <CardDescription>Current holdings & expected returns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category list */}
            {categoryAssumptions.map((category) => {
              const allocation = reinvestmentAllocation.find(a => a.categoryId === category.categoryId);
              const allocationPercent = (allocation?.percentage || 0) * 100;

              return (
                <div key={category.categoryId} className="rounded-md border p-3 space-y-3">
                  {/* Category name with remove button */}
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={category.categoryName}
                      onChange={(e) => updateCategoryField(category.categoryId, 'categoryName', e.target.value)}
                      className="font-medium"
                      placeholder="Category name"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCategory(category.categoryId)}
                      disabled={categoryAssumptions.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Value and Return */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`${category.categoryId}-value`} className="text-xs">
                        Current Value ($)
                      </Label>
                      <Input
                        id={`${category.categoryId}-value`}
                        type="number"
                        value={category.currentValue}
                        onChange={(e) => updateCategoryField(category.categoryId, 'currentValue', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${category.categoryId}-return`} className="text-xs">
                        Expected Return (%)
                      </Label>
                      <Input
                        id={`${category.categoryId}-return`}
                        type="number"
                        step="0.1"
                        value={category.expectedAnnualReturn * 100}
                        onChange={(e) => updateCategoryField(category.categoryId, 'expectedAnnualReturn', Number(e.target.value) / 100)}
                      />
                    </div>
                  </div>

                  {/* Reinvestment allocation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${category.categoryId}-reinvest`} className="text-xs">
                        Reinvest surplus to this category
                      </Label>
                      <span className="text-xs font-medium">{allocationPercent.toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`${category.categoryId}-reinvest`}
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={allocationPercent}
                        onChange={(e) => updateReinvestmentAllocation(category.categoryId, Number(e.target.value))}
                        className="flex-1"
                      />
                    </div>
                    {/* Visual bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${allocationPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add category button */}
            <Button onClick={addCategory} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>

            {/* Reinvestment total */}
            <div className={`flex items-center justify-between p-2 rounded-md ${
              Math.abs(totalReinvestmentPercentage - 1.0) < 0.01
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <span className="text-sm font-medium">Total reinvestment allocation:</span>
              <span className="text-sm font-semibold">
                {(totalReinvestmentPercentage * 100).toFixed(0)}%
                {Math.abs(totalReinvestmentPercentage - 1.0) < 0.01 ? ' ✓' : ' ⚠'}
              </span>
            </div>
            {Math.abs(totalReinvestmentPercentage - 1.0) >= 0.01 && (
              <p className="text-xs text-amber-600">
                Tip: Total should equal 100% for accurate projections
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Life Events - Tabbed Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Income & Life Events</CardTitle>
          <CardDescription>
            Add salary, freelance work, and major life events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="salary" className="w-full">
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="salary">💼 Salary</TabsTrigger>
              <TabsTrigger value="freelance">🎨 Freelance</TabsTrigger>
              <TabsTrigger value="one-time">📅 One-Time</TabsTrigger>
              <TabsTrigger value="recurring">🔄 Recurring</TabsTrigger>
            </TabsList>

            {/* Salary Income Tab */}
            <TabsContent value="salary" className="space-y-4">
              <SalaryIncomeForm onAdd={handleAddSalaryIncome} />
            </TabsContent>

            {/* Freelance Income Tab */}
            <TabsContent value="freelance" className="space-y-4">
              <FreelanceIncomeForm onAdd={handleAddFreelanceIncome} />
            </TabsContent>

            {/* One-Time Events Tab */}
            <TabsContent value="one-time" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>One-Time Events</CardTitle>
                  <CardDescription>
                    Major purchases, sales, or life events
                  </CardDescription>
                </CardHeader>
          <CardContent className="space-y-4">
            {/* Hint about toggle feature */}
            {events.length > 0 && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                💡 Tip: Click the 👁️ icon to temporarily disable events and see how your projection changes
              </p>
            )}
            {/* List of existing events */}
            <div className="space-y-2">
              {events.length === 0 && (
                <p className="text-sm text-muted-foreground">No events added yet</p>
              )}
              {events.map((event) => {
                const isEnabled = event.enabled !== false;
                return (
                  <div
                    key={event.id}
                    className={`flex items-center justify-between gap-2 rounded-md border p-2 text-sm transition-all ${
                      isEnabled ? '' : 'opacity-50 bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {event.emoji && (
                        <span className={`text-xl ${!isEnabled ? 'grayscale' : ''}`}>{event.emoji}</span>
                      )}
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {event.date.toLocaleDateString()}
                          </span>
                          <span
                            className={
                              event.amount < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"
                            }
                          >
                            {event.amount < 0 ? "-" : "+"}$
                            {Math.abs(event.amount).toLocaleString()}
                          </span>
                          {!isEnabled && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">{event.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleEvent(event.id, 'one-time')}
                        title={isEnabled ? "Click to disable" : "Click to enable"}
                      >
                        {isEnabled ? "👁️" : "👁️‍🗨️"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOneTimeEvent(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add new event form */}
            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-medium">Add New Event</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-[60px_1fr] gap-2">
                  <Input
                    placeholder="😊"
                    value={newEventEmoji}
                    onChange={(e) => setNewEventEmoji(e.target.value)}
                    maxLength={2}
                    className="text-center text-lg"
                  />
                  <Input
                    placeholder="Description (e.g., Buy house)"
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                  />
                </div>
                <Input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Amount (negative for expense)"
                  value={newEventAmount || ""}
                  onChange={(e) => setNewEventAmount(Number(e.target.value))}
                />
                <Button onClick={addOneTimeEvent} className="w-full" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Event
                </Button>
              </div>
            </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recurring Events Tab */}
            <TabsContent value="recurring" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recurring Events</CardTitle>
                  <CardDescription>
                    Monthly income or expenses (mortgage, salary changes, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
            {/* Hint about toggle feature */}
            {recurringEvents.length > 0 && (
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                💡 Tip: Click the 👁️ icon to temporarily disable events and see how your projection changes
              </p>
            )}
            {/* List of existing events */}
            <div className="space-y-2">
              {recurringEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">No recurring events added yet</p>
              )}
              {recurringEvents.map((event) => {
                const isEnabled = event.enabled !== false;
                return (
                  <div
                    key={event.id}
                    className={`flex items-center justify-between gap-2 rounded-md border p-2 text-sm transition-all ${
                      isEnabled ? '' : 'opacity-50 bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {event.emoji && (
                        <span className={`text-xl ${!isEnabled ? 'grayscale' : ''}`}>{event.emoji}</span>
                      )}
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs">
                            {event.startDate.toLocaleDateString()} →{" "}
                            {event.endDate?.toLocaleDateString() || "∞"}
                          </span>
                          <span
                            className={
                              event.amount < 0
                                ? "text-destructive font-medium"
                                : "text-green-600 font-medium"
                            }
                          >
                            {event.amount < 0 ? "-" : "+"}$
                            {Math.abs(event.amount).toLocaleString()}/
                            {event.frequency === 'monthly' ? 'mo' : event.frequency === 'quarterly' ? 'qtr' : 'yr'}
                          </span>
                          {!isEnabled && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">{event.description}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleEvent(event.id, 'recurring')}
                        title={isEnabled ? "Click to disable" : "Click to enable"}
                      >
                        {isEnabled ? "👁️" : "👁️‍🗨️"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecurringEvent(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add new recurring event form */}
            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-medium">Add Recurring Event</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-[60px_1fr] gap-2">
                  <Input
                    placeholder="😊"
                    value={newRecurringEmoji}
                    onChange={(e) => setNewRecurringEmoji(e.target.value)}
                    maxLength={2}
                    className="text-center text-lg"
                  />
                  <Input
                    placeholder="Description (e.g., Mortgage payment)"
                    value={newRecurringDescription}
                    onChange={(e) => setNewRecurringDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="recurring-start" className="text-xs">
                      Start Date
                    </Label>
                    <Input
                      id="recurring-start"
                      type="date"
                      value={newRecurringStartDate}
                      onChange={(e) => setNewRecurringStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="recurring-end" className="text-xs">
                      End Date (optional)
                    </Label>
                    <Input
                      id="recurring-end"
                      type="date"
                      value={newRecurringEndDate}
                      onChange={(e) => setNewRecurringEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="recurring-amount" className="text-xs">
                      Amount per occurrence
                    </Label>
                    <Input
                      id="recurring-amount"
                      type="number"
                      placeholder="Amount (negative for expense)"
                      value={newRecurringAmount || ""}
                      onChange={(e) => setNewRecurringAmount(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="recurring-frequency" className="text-xs">
                      Frequency
                    </Label>
                    <Select value={newRecurringFrequency} onValueChange={(value) => setNewRecurringFrequency(value as RecurringFrequency)}>
                      <SelectTrigger id="recurring-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={addRecurringEvent} className="w-full" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recurring Event
                </Button>
              </div>
            </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
