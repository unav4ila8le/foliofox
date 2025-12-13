"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { makeOneOff, makeRecurring } from "@/lib/scenario-planning";
import { ld, type LocalDate } from "@/lib/local-date";
import type { ScenarioEvent } from "@/lib/scenario-planning";
import { useEffect } from "react";

const conditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("networth-is-above"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
  }),
  z.object({
    type: z.literal("event-happened"),
    eventName: z.string().min(1, "Event name is required"),
  }),
  z.object({
    type: z.literal("income-is-above"),
    eventName: z.string().min(1, "Event name is required"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
  }),
]);

// Helper to convert LocalDate to JavaScript Date
function localDateToDate(ld: LocalDate): Date {
  return new Date(ld.y, ld.m - 1, ld.d);
}

// Helper to extract conditions from ScenarioEvent
function extractConditionsFromEvent(event: ScenarioEvent) {
  return event.unlockedBy
    .filter((c) => c.tag === "balance")
    .map((c) => {
      switch (c.type) {
        case "networth-is-above":
          return {
            type: "networth-is-above" as const,
            amount: c.value.amount,
          };
        case "event-happened":
          return {
            type: "event-happened" as const,
            eventName: c.value.eventName,
          };
        case "income-is-above":
          return {
            type: "income-is-above" as const,
            eventName: c.value.eventName,
            amount: c.value.amount,
          };
      }
    });
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.enum(["income", "expense"], { error: "Type is required." }),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  recurrence: z.enum(["once", "monthly", "yearly"]),
  startDate: z.date({ error: "Start date is required." }),
  endDate: z.date().optional(),
  conditions: z.array(conditionSchema).default([]),
});

export function UpsertEventForm({
  onCancel,
  onSuccess,
  existingEvents = [],
  event = null,
  eventIndex = null,
}: {
  onCancel: () => void;
  onSuccess: (event: ScenarioEvent, index?: number) => void;
  existingEvents?: ScenarioEvent[];
  event?: ScenarioEvent | null;
  eventIndex?: number | null;
}) {
  const isEditing = event !== null && eventIndex !== null;

  // Extract date range from event if editing
  const getDateRangeFromEvent = (event: ScenarioEvent | null) => {
    if (!event) return { startDate: undefined, endDate: undefined };

    const dateRangeCondition = event.unlockedBy.find(
      (c) => c.tag === "cashflow" && c.type === "date-in-range",
    );

    if (dateRangeCondition && dateRangeCondition.type === "date-in-range") {
      return {
        startDate: localDateToDate(dateRangeCondition.value.start),
        endDate: dateRangeCondition.value.end
          ? localDateToDate(dateRangeCondition.value.end)
          : undefined,
      };
    }

    const dateIsCondition = event.unlockedBy.find(
      (c) => c.tag === "cashflow" && c.type === "date-is",
    );

    if (dateIsCondition && dateIsCondition.type === "date-is") {
      return {
        startDate: localDateToDate(dateIsCondition.value),
        endDate: undefined,
      };
    }

    return { startDate: undefined, endDate: undefined };
  };

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: event?.name || "",
      type: (event?.type || "income") as "income" | "expense",
      amount: event?.amount || undefined,
      recurrence: (event?.recurrence.type || "once") as
        | "once"
        | "monthly"
        | "yearly",
      startDate: getDateRangeFromEvent(event).startDate ?? new Date(),
      endDate: getDateRangeFromEvent(event).endDate,
      conditions: event ? extractConditionsFromEvent(event) : [],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "conditions",
  });

  // Reset form when event changes (for edit mode)
  useEffect(() => {
    if (event) {
      const dateRange = getDateRangeFromEvent(event);
      form.reset({
        name: event.name,
        type: event.type,
        amount: event.amount,
        recurrence: event.recurrence.type,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        conditions: extractConditionsFromEvent(event),
      });
    }
  }, [event, form]);

  const { isDirty } = form.formState;
  const recurrence = form.watch("recurrence");
  const type = form.watch("type");

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Convert Date to LocalDate
    const startLocalDate = ld(
      values.startDate.getFullYear(),
      values.startDate.getMonth() + 1,
      values.startDate.getDate(),
    );

    // Convert form conditions to library format
    const additionalConditions = values.conditions.map((condition) => {
      switch (condition.type) {
        case "networth-is-above":
          return {
            tag: "balance" as const,
            type: "networth-is-above" as const,
            value: { eventRef: "", amount: condition.amount },
          };
        case "event-happened":
          return {
            tag: "balance" as const,
            type: "event-happened" as const,
            value: { eventName: condition.eventName },
          };
        case "income-is-above":
          return {
            tag: "balance" as const,
            type: "income-is-above" as const,
            value: { eventName: condition.eventName, amount: condition.amount },
          };
      }
    });

    let event: ScenarioEvent;

    if (values.recurrence === "once") {
      // Create one-off event
      event = makeOneOff({
        name: values.name,
        type: values.type,
        amount: values.amount,
        date: startLocalDate,
        unlockedBy: additionalConditions,
      });
    } else {
      // Create recurring event
      const endLocalDate = values.endDate
        ? ld(
            values.endDate.getFullYear(),
            values.endDate.getMonth() + 1,
            values.endDate.getDate(),
          )
        : null;

      event = makeRecurring({
        name: values.name,
        type: values.type,
        amount: values.amount,
        startDate: startLocalDate,
        endDate: endLocalDate,
        frequency: values.recurrence,
        unlockedBy: additionalConditions,
      });
    }

    onSuccess(event, isEditing ? eventIndex : undefined);
    onCancel();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-x-2 gap-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    type === "expense"
                      ? "E.g., 🏠 Rent, 🍕 Cost of Life, 🚗 Car Payment"
                      : "E.g., 💶 Salary, 💰 Bonus, 🧘🏻‍♂️ Investment"
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full capitalize">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="income" className="capitalize">
                      Income
                    </SelectItem>
                    <SelectItem value="expense" className="capitalize">
                      Expense
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g., 1000"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    disabled={field.disabled}
                    value={(field.value as number | undefined) ?? ""}
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? undefined
                          : e.target.valueAsNumber;
                      field.onChange(val);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="recurrence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recurrence</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full capitalize">
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="once" className="capitalize">
                    Once
                  </SelectItem>
                  <SelectItem value="monthly" className="capitalize">
                    Monthly
                  </SelectItem>
                  <SelectItem value="yearly" className="capitalize">
                    Yearly
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>
                  {recurrence === "once" ? "Date" : "Start Date"}
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          {recurrence !== "once" && (
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date (optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>No end date</span>
                          )}
                          {field.value && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="rounded-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                field.onChange(undefined);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Conditions Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Additional Conditions</h3>
              <p className="text-muted-foreground text-xs">
                Add conditions that must be met for this event to occur
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  type: "networth-is-above",
                  amount: undefined,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
          </div>

          {fields.length > 0 && (
            <div className="space-y-4 rounded-lg border p-4">
              {fields.map((field, index) => {
                const conditionType = form.watch(`conditions.${index}.type`);

                return (
                  <div
                    key={`${field.id}-${conditionType}`}
                    className="relative space-y-4 rounded-md border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <FormField
                        control={form.control}
                        name={`conditions.${index}.type`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Condition Type</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                // Reset fields when changing type using update method
                                if (value === "networth-is-above") {
                                  update(index, {
                                    type: "networth-is-above" as const,
                                    amount: 0,
                                  });
                                } else if (value === "event-happened") {
                                  update(index, {
                                    type: "event-happened" as const,
                                    eventName: "",
                                  });
                                } else if (value === "income-is-above") {
                                  update(index, {
                                    type: "income-is-above" as const,
                                    eventName: "",
                                    amount: 0,
                                  });
                                }
                              }}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select condition type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="networth-is-above">
                                  Net Worth is Above
                                </SelectItem>
                                <SelectItem value="event-happened">
                                  Event Happened
                                </SelectItem>
                                <SelectItem value="income-is-above">
                                  Income is Above
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="mt-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Condition-specific fields */}
                    {conditionType === "networth-is-above" && (
                      <FormField
                        key={`${index}-networth-amount`}
                        control={form.control}
                        name={`conditions.${index}.amount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="E.g., 10000"
                                inputMode="decimal"
                                step="any"
                                name={field.name}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                disabled={field.disabled}
                                value={
                                  (field.value as number | undefined) ?? ""
                                }
                                onChange={(e) => {
                                  const val =
                                    e.target.value === ""
                                      ? undefined
                                      : e.target.valueAsNumber;
                                  field.onChange(val);
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Event fires when net worth exceeds this amount
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {conditionType === "event-happened" && (
                      <FormField
                        key={`${index}-event-happened`}
                        control={form.control}
                        name={`conditions.${index}.eventName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Event Name</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select an event" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {existingEvents.length === 0 ? (
                                  <SelectItem value="none" disabled>
                                    No events available
                                  </SelectItem>
                                ) : (
                                  existingEvents.map((event) => (
                                    <SelectItem
                                      key={event.name}
                                      value={event.name}
                                    >
                                      {event.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              This event fires only after the selected event has
                              occurred
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {conditionType === "income-is-above" && (
                      <>
                        <FormField
                          key={`${index}-income-event`}
                          control={form.control}
                          name={`conditions.${index}.eventName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Event Name</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select an event" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {existingEvents.filter(
                                    (e) => e.type === "income",
                                  ).length === 0 ? (
                                    <SelectItem value="none" disabled>
                                      No income events available
                                    </SelectItem>
                                  ) : (
                                    existingEvents
                                      .filter((e) => e.type === "income")
                                      .map((event) => (
                                        <SelectItem
                                          key={event.name}
                                          value={event.name}
                                        >
                                          {event.name}
                                        </SelectItem>
                                      ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          key={`${index}-income-amount`}
                          control={form.control}
                          name={`conditions.${index}.amount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Minimum Amount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="E.g., 5000"
                                  inputMode="decimal"
                                  step="any"
                                  name={field.name}
                                  ref={field.ref}
                                  onBlur={field.onBlur}
                                  disabled={field.disabled}
                                  value={
                                    (field.value as number | undefined) ?? ""
                                  }
                                  onChange={(e) => {
                                    const val =
                                      e.target.value === ""
                                        ? undefined
                                        : e.target.valueAsNumber;
                                    field.onChange(val);
                                  }}
                                />
                              </FormControl>
                              <FormDescription>
                                Event fires when the selected income event
                                amount meets or exceeds this threshold
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button type="submit" disabled={!isDirty}>
            {isEditing ? "Update event" : "Create event"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
