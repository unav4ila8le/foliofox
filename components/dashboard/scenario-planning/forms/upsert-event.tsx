"use client";

import { useEffect } from "react";
import { CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Calendar } from "@/components/ui/calendar";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";

import { cn } from "@/lib/utils";
import { makeOneOff, makeRecurring } from "@/lib/scenario-planning";
import { ld, type LocalDate } from "@/lib/date/date-utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";
import type { ScenarioEvent } from "@/lib/scenario-planning";

const conditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("networth-is-above"),
    amount: requiredNumberWithConstraints("Amount is required", {
      gte: { value: 0, error: "Amount must be greater or equal to 0" },
    }),
  }),
  z.object({
    type: z.literal("event-happened"),
    eventName: z.string().min(1, "Event name is required"),
  }),
  z.object({
    type: z.literal("income-is-above"),
    eventName: z.string().min(1, "Event name is required"),
    amount: requiredNumberWithConstraints("Amount is required", {
      gte: { value: 0, error: "Amount must be greater or equal to 0" },
    }),
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

const formSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(["income", "expense"], { error: "Type is required" }),
    amount: requiredNumberWithConstraints("Amount is required", {
      gt: { value: 0, error: "Amount must be greater than 0" },
    }),
    recurrence: z.enum(["once", "monthly", "yearly"]),
    startDate: z.date({ error: "Start date is required" }),
    endDate: z.date().optional(),
    conditions: z.array(conditionSchema).default([]),
  })
  .refine(
    (data) => {
      if (!data.endDate) return true;
      return data.endDate >= data.startDate;
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  );

export function UpsertEventForm({
  onCancel,
  onSuccess,
  existingEvents = [],
  event = null,
  eventIndex = null,
  currency,
}: {
  onCancel: () => void;
  onSuccess: (event: ScenarioEvent, index?: number) => void;
  existingEvents?: ScenarioEvent[];
  event?: ScenarioEvent | null;
  eventIndex?: number | null;
  currency: string;
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
      amount: event?.amount || "",
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
  const recurrence = useWatch({
    control: form.control,
    name: "recurrence",
  });
  const type = useWatch({
    control: form.control,
    name: "type",
  });

  const conditionTypes = useWatch({
    control: form.control,
    name: "conditions",
  });
  const startDate = useWatch({
    control: form.control,
    name: "startDate",
  });
  const endDate = useWatch({
    control: form.control,
    name: "endDate",
  });

  // Clear end date if start date moves past it
  useEffect(() => {
    if (startDate && endDate && startDate > endDate) {
      form.setValue("endDate", undefined, { shouldDirty: true });
    }
  }, [startDate, endDate, form]);

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
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody>
        <div className="grid gap-x-2 gap-y-4">
          {/* Name */}
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  id={field.name}
                  placeholder={
                    type === "expense"
                      ? "E.g., 🏠 Rent, 🍕 Cost of Life, 🚗 Car Payment"
                      : "E.g., 💶 Salary, 💰 Bonus, 🧘🏻‍♂️ Investment"
                  }
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid items-start gap-x-2 gap-y-4 sm:grid-cols-2">
            {/* Type */}
            <Controller
              control={form.control}
              name="type"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Type</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger
                      id={field.name}
                      className="w-full capitalize"
                      aria-invalid={fieldState.invalid}
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income" className="capitalize">
                        Income
                      </SelectItem>
                      <SelectItem value="expense" className="capitalize">
                        Expense
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {/* Amount */}
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Amount</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={field.name}
                      placeholder="E.g., 1000"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min={0}
                      aria-invalid={fieldState.invalid}
                      {...field}
                      value={field.value as number}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{currency}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          {/* Recurrence */}
          <Controller
            control={form.control}
            name="recurrence"
            render={({ field, fieldState }) => (
              <Field
                data-invalid={fieldState.invalid}
                className="sm:w-1/2 sm:pr-1"
              >
                <FieldLabel htmlFor={field.name}>Recurrence</FieldLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger
                    id={field.name}
                    className="w-full capitalize"
                    aria-invalid={fieldState.invalid}
                  >
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
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
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-2 sm:grid-cols-2">
            {/* Start Date */}
            <Controller
              control={form.control}
              name="startDate"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {recurrence === "once" ? "Date" : "Start Date"}
                  </FieldLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id={field.name}
                        variant="outline"
                        aria-invalid={fieldState.invalid}
                        className={cn(
                          "text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        startMonth={new Date(2000, 0)}
                        endMonth={new Date(new Date().getFullYear() + 50, 11)}
                        selected={field.value}
                        onSelect={field.onChange}
                        autoFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            {/* End Date */}
            {recurrence !== "once" && (
              <Controller
                control={form.control}
                name="endDate"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      End Date (optional)
                    </FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id={field.name}
                          variant="outline"
                          aria-invalid={fieldState.invalid}
                          className={cn(
                            "group text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>No end date</span>
                          )}
                          {field.value && (
                            <div
                              className="ml-auto hidden opacity-50 group-hover:block hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                field.onChange(undefined);
                              }}
                            >
                              <X />
                              <span className="sr-only">Clear</span>
                            </div>
                          )}
                          <CalendarIcon
                            className={cn(
                              "ml-auto opacity-50",
                              field.value && "group-hover:hidden",
                            )}
                          />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          startMonth={new Date(2000, 0)}
                          endMonth={new Date(new Date().getFullYear() + 50, 11)}
                          disabled={
                            startDate ? { before: startDate } : undefined
                          }
                          selected={field.value}
                          onSelect={field.onChange}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}
          </div>

          {/* Conditions Section */}
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">Additional Conditions</h3>
              <p className="text-muted-foreground text-sm">
                Add conditions that must be met for this event to occur
              </p>
            </div>

            {/* Conditions List */}
            {fields.length > 0 && (
              <div className="space-y-4">
                {fields.map((arrayField, index) => {
                  const conditionType = conditionTypes?.[index]?.type;

                  return (
                    <div
                      key={`${arrayField.id}-${conditionType}`}
                      className="bg-card relative space-y-4 rounded-md border p-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Controller
                          control={form.control}
                          name={`conditions.${index}.type`}
                          render={({ field, fieldState }) => (
                            <Field
                              data-invalid={fieldState.invalid}
                              className="flex-1"
                            >
                              <FieldLabel htmlFor={field.name}>
                                Condition Type
                              </FieldLabel>
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
                                <SelectTrigger
                                  id={field.name}
                                  aria-invalid={fieldState.invalid}
                                >
                                  <SelectValue placeholder="Select condition type" />
                                </SelectTrigger>
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
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          aria-label="Remove condition"
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Remove condition</span>
                        </Button>
                      </div>

                      {/* Condition-specific fields */}
                      {conditionType === "networth-is-above" && (
                        <Controller
                          key={`${index}-networth-amount`}
                          control={form.control}
                          name={`conditions.${index}.amount`}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={field.name}>
                                Amount
                              </FieldLabel>
                              <InputGroup>
                                <InputGroupInput
                                  id={field.name}
                                  placeholder="E.g., 1000"
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  min={0}
                                  aria-invalid={fieldState.invalid}
                                  {...field}
                                  value={field.value as number}
                                />
                                <InputGroupAddon align="inline-end">
                                  <InputGroupText>{currency}</InputGroupText>
                                </InputGroupAddon>
                              </InputGroup>
                              <FieldDescription>
                                Event fires when net worth exceeds this amount
                              </FieldDescription>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />
                      )}

                      {conditionType === "event-happened" && (
                        <Controller
                          key={`${index}-event-happened`}
                          control={form.control}
                          name={`conditions.${index}.eventName`}
                          render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={field.name}>
                                Event Name
                              </FieldLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <SelectTrigger
                                  id={field.name}
                                  className="w-full"
                                  aria-invalid={fieldState.invalid}
                                >
                                  <SelectValue placeholder="Select an event" />
                                </SelectTrigger>
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
                              <FieldDescription>
                                This event fires only after the selected event
                                has occurred
                              </FieldDescription>
                              {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                              )}
                            </Field>
                          )}
                        />
                      )}

                      {conditionType === "income-is-above" && (
                        <>
                          <Controller
                            key={`${index}-income-event`}
                            control={form.control}
                            name={`conditions.${index}.eventName`}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>
                                  Event Name
                                </FieldLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <SelectTrigger
                                    id={field.name}
                                    className="w-full"
                                    aria-invalid={fieldState.invalid}
                                  >
                                    <SelectValue placeholder="Select an event" />
                                  </SelectTrigger>
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
                                {fieldState.invalid && (
                                  <FieldError errors={[fieldState.error]} />
                                )}
                              </Field>
                            )}
                          />
                          <Controller
                            key={`${index}-income-amount`}
                            control={form.control}
                            name={`conditions.${index}.amount`}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>
                                  Minimum Amount
                                </FieldLabel>
                                <InputGroup>
                                  <InputGroupInput
                                    id={field.name}
                                    placeholder="E.g., 5,000"
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    min={0}
                                    aria-invalid={fieldState.invalid}
                                    {...field}
                                    value={field.value as number}
                                  />
                                  <InputGroupAddon align="inline-end">
                                    <InputGroupText>{currency}</InputGroupText>
                                  </InputGroupAddon>
                                </InputGroup>
                                <FieldDescription>
                                  Event fires when the selected income event
                                  amount meets or exceeds this threshold
                                </FieldDescription>
                                {fieldState.invalid && (
                                  <FieldError errors={[fieldState.error]} />
                                )}
                              </Field>
                            )}
                          />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  type: "networth-is-above",
                  amount: "",
                })
              }
            >
              <Plus />
              Add Condition
            </Button>
          </div>
        </div>
      </DialogBody>

      {/* Action buttons */}
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={!isDirty}>
          {isEditing ? "Update event" : "Create event"}
        </Button>
      </DialogFooter>
    </form>
  );
}
