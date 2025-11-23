"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import {
  createFreelanceIncome,
  type RecurringEvent,
  type OneTimeEvent,
  type RecurringFrequency,
} from "@/lib/planning-engine";

interface FreelanceIncomeFormProps {
  onAdd: (events: (RecurringEvent | OneTimeEvent)[]) => void;
}

export function FreelanceIncomeForm({ onAdd }: FreelanceIncomeFormProps) {
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState<"ongoing" | "one-time">("ongoing");
  const [monthlyRate, setMonthlyRate] = useState<number>(0);
  const [projectAmount, setProjectAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(25);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [hasEndDate, setHasEndDate] = useState(false);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [autoCreateTax, setAutoCreateTax] = useState(true);
  const [emoji, setEmoji] = useState("🎨");

  const handleSubmit = () => {
    if (!description) return;
    if (projectType === "ongoing" && !monthlyRate) return;
    if (projectType === "one-time" && !projectAmount) return;

    const freelanceEvents = createFreelanceIncome({
      description,
      monthlyRate: projectType === "ongoing" ? monthlyRate : undefined,
      projectAmount: projectType === "one-time" ? projectAmount : undefined,
      isOneTime: projectType === "one-time",
      taxRate: taxRate / 100, // convert percentage to decimal
      startDate: new Date(startDate),
      endDate: projectType === "ongoing" && hasEndDate && endDate ? new Date(endDate) : undefined,
      frequency: projectType === "ongoing" ? frequency : undefined,
      emoji: emoji || undefined,
      autoCreateTaxEvents: autoCreateTax,
    });

    onAdd(freelanceEvents);

    // Reset form
    setDescription("");
    setProjectType("ongoing");
    setMonthlyRate(0);
    setProjectAmount(0);
    setTaxRate(25);
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate("");
    setHasEndDate(false);
    setFrequency("monthly");
    setAutoCreateTax(true);
    setEmoji("🎨");
  };

  const grossAmount = projectType === "ongoing" ? monthlyRate : projectAmount;
  const netAmount = grossAmount * (1 - taxRate / 100);
  const taxAmount = grossAmount * (taxRate / 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Freelance Income</CardTitle>
        <CardDescription>
          Contract work, consulting, or one-time projects with self-employment tax
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[60px_1fr] gap-2">
          <Input
            placeholder="🎨"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={2}
            className="text-center text-lg"
          />
          <Input
            placeholder="Project or client description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Project Type */}
        <div className="space-y-2">
          <Label>Project Type</Label>
          <RadioGroup
            value={projectType}
            onValueChange={(value) => setProjectType(value as "ongoing" | "one-time")}
            className="grid grid-cols-2 gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ongoing" id="ongoing" />
              <Label htmlFor="ongoing" className="font-normal cursor-pointer">
                Ongoing Contract
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="one-time" id="one-time" />
              <Label htmlFor="one-time" className="font-normal cursor-pointer">
                One-Time Project
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Amount input - changes based on project type */}
        {projectType === "ongoing" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-rate">Monthly Rate</Label>
              <Input
                id="monthly-rate"
                type="number"
                placeholder="3000"
                value={monthlyRate || ""}
                onChange={(e) => setMonthlyRate(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frequency">Payment Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as RecurringFrequency)}
              >
                <SelectTrigger id="frequency">
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
        ) : (
          <div className="space-y-2">
            <Label htmlFor="project-amount">Total Project Amount</Label>
            <Input
              id="project-amount"
              type="number"
              placeholder="10000"
              value={projectAmount || ""}
              onChange={(e) => setProjectAmount(Number(e.target.value))}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tax-rate">Self-Employment Tax Rate (%)</Label>
          <Input
            id="tax-rate"
            type="number"
            min="0"
            max="100"
            value={taxRate || ""}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Typical range: 15-30% (varies by country and income level)
          </p>
        </div>

        {/* Summary */}
        {grossAmount > 0 && (
          <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {projectType === "ongoing" ? "Gross per payment:" : "Total project:"}
              </span>
              <span className="font-medium">${grossAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({taxRate}%):</span>
              <span className="font-medium text-destructive">-${taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-muted-foreground font-medium">Net income:</span>
              <span className="font-semibold text-green-600">${netAmount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Dates */}
        {projectType === "ongoing" ? (
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
                    Has end?
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
        ) : (
          <div className="space-y-2">
            <Label htmlFor="project-date">Project Completion Date</Label>
            <Input
              id="project-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        )}

        {/* Tax settings */}
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-tax" className="text-sm font-medium">
                Automatic Tax Events
              </Label>
              <p className="text-xs text-muted-foreground">
                {projectType === "ongoing"
                  ? "Create quarterly estimated tax payments"
                  : "Create one-time tax payment for this project"}
              </p>
            </div>
            <Switch
              id="auto-tax"
              checked={autoCreateTax}
              onCheckedChange={setAutoCreateTax}
            />
          </div>
        </div>

        <Button onClick={handleSubmit} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Freelance Income
          {autoCreateTax && " + Tax Events"}
        </Button>
      </CardContent>
    </Card>
  );
}
