"use client";

import { useState } from "react";
import { format, addYears } from "date-fns";
import { Plus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  createSalaryIncome,
  type RecurringEvent,
  type RecurringFrequency,
} from "@/lib/planning-engine";

interface SalaryIncomeFormProps {
  onAdd: (events: RecurringEvent[]) => void;
}

export function SalaryIncomeForm({ onAdd }: SalaryIncomeFormProps) {
  const [description, setDescription] = useState("");
  const [grossMonthlySalary, setGrossMonthlySalary] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(30);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [autoCreateTax, setAutoCreateTax] = useState(true);
  const [taxPaymentFrequency, setTaxPaymentFrequency] = useState<RecurringFrequency>("monthly");
  const [emoji, setEmoji] = useState("💼");

  const handleSubmit = () => {
    if (!description || !grossMonthlySalary) return;

    const salaryEvents = createSalaryIncome({
      description,
      grossMonthlySalary,
      taxRate: taxRate / 100, // convert percentage to decimal
      startDate: new Date(startDate),
      endDate: hasEndDate && endDate ? new Date(endDate) : undefined,
      emoji: emoji || undefined,
      autoCreateTaxEvents: autoCreateTax,
      taxPaymentFrequency,
    });

    onAdd(salaryEvents);

    // Reset form
    setDescription("");
    setGrossMonthlySalary(0);
    setTaxRate(30);
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    setHasEndDate(false);
    setAutoCreateTax(true);
    setTaxPaymentFrequency("monthly");
    setEmoji("💼");
  };

  const netMonthlySalary = grossMonthlySalary * (1 - taxRate / 100);
  const monthlyTax = grossMonthlySalary * (taxRate / 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Salary Income</CardTitle>
        <CardDescription>
          Full-time or part-time employment with automatic tax handling
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[60px_1fr] gap-2">
          <Input
            placeholder="💼"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={2}
            className="text-center text-lg"
          />
          <Input
            placeholder="Job title or description (e.g., Software Engineer at TechCo)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gross-salary">Gross Monthly Salary</Label>
            <Input
              id="gross-salary"
              type="number"
              placeholder="5000"
              value={grossMonthlySalary || ""}
              onChange={(e) => setGrossMonthlySalary(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax-rate">Tax Rate (%)</Label>
            <Input
              id="tax-rate"
              type="number"
              min="0"
              max="100"
              value={taxRate || ""}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Summary of net income */}
        {grossMonthlySalary > 0 && (
          <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross monthly:</span>
              <span className="font-medium">${grossMonthlySalary.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRate}%):</span>
              <span className="font-medium text-destructive">-${monthlyTax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground font-medium">Net monthly:</span>
              <span className="font-semibold text-green-600">${netMonthlySalary.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="end-date">End Date</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="has-end-date" className="text-xs text-muted-foreground">
                  Has end date?
                </Label>
                <Switch
                  id="has-end-date"
                  checked={hasEndDate}
                  onCheckedChange={setHasEndDate}
                />
              </div>
            </div>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={!hasEndDate}
              placeholder={hasEndDate ? "" : "Ongoing"}
            />
          </div>
        </div>

        {/* Tax settings */}
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-tax" className="text-sm font-medium">
                Automatic Tax Events
              </Label>
              <p className="text-xs text-muted-foreground">
                Automatically create tax payment events
              </p>
            </div>
            <Switch
              id="auto-tax"
              checked={autoCreateTax}
              onCheckedChange={setAutoCreateTax}
            />
          </div>

          {autoCreateTax && (
            <div className="space-y-2">
              <Label htmlFor="tax-frequency" className="text-sm">
                Tax Payment Frequency
              </Label>
              <Select
                value={taxPaymentFrequency}
                onValueChange={(value) => setTaxPaymentFrequency(value as RecurringFrequency)}
              >
                <SelectTrigger id="tax-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly (withheld from paycheck)</SelectItem>
                  <SelectItem value="quarterly">Quarterly (estimated taxes)</SelectItem>
                  <SelectItem value="yearly">Yearly (annual payment)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button onClick={handleSubmit} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Salary Income
          {autoCreateTax && " + Tax Events"}
        </Button>
      </CardContent>
    </Card>
  );
}
