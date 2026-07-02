"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";

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
  SelectGroup,
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
  InputGroupText,
} from "@/components/ui/input-group";
import { LocalizedNumberInput } from "@/components/ui/custom/localized-number-input";
import { Calendar } from "@/components/ui/calendar";
import { DialogBody, DialogFooter } from "@/components/ui/custom/dialog";

import type { ScenarioInitialValueBasis } from "@/lib/planning/initial-value-basis";
import { formatNumber } from "@/lib/number-format";
import { cn } from "@/lib/utils";
import { getScenarioEventDateRange } from "@/lib/planning/scenario/event-dates";
import {
  getBasisCompatibilityDescription,
  getProjectedSeriesThresholdConditionLabel,
  getProjectedSeriesThresholdConditionTypeForBasis,
  isProjectedSeriesThresholdConditionType,
} from "@/lib/planning/scenario/projected-series";
import { makeOneOff, makeRecurring } from "@/lib/planning/scenario/engine";
import { ld } from "@/lib/date/date-utils";
import { requiredNumberWithConstraints } from "@/lib/zod-helpers";
import { useLocale } from "@/hooks/use-locale";
import type { ScenarioEvent } from "@/lib/planning/scenario/engine";
import { upsertScenarioEvent } from "@/server/financial-scenarios/upsert";

const conditionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("networth-is-above"),
    amount: requiredNumberWithConstraints("Amount is required", {
      gte: { value: 0, error: "Amount must be greater or equal to 0" },
    }),
  }),
  z.object({
    type: z.literal("cash-is-above"),
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

// Helper to extract conditions from ScenarioEvent
function extractConditionsFromEvent(event: ScenarioEvent) {
  return event.unlockedBy
    .filter((condition) => condition.tag !== "cashflow")
    .map((condition) => {
      switch (condition.type) {
        case "networth-is-above":
          return {
            type: "networth-is-above" as const,
            amount: condition.value.amount,
          };
        case "cash-is-above":
          return {
            type: "cash-is-above" as const,
            amount: condition.value.amount,
          };
        case "event-happened":
          return {
            type: "event-happened" as const,
            eventName: condition.value.eventName,
          };
        case "income-is-above":
          return {
            type: "income-is-above" as const,
            eventName: condition.value.eventName,
            amount: condition.value.amount,
          };
        default:
          return assertNever(condition);
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

type ScenarioEventFormValues = z.infer<typeof formSchema>;
type ScenarioEventCondition = ScenarioEventFormValues["conditions"][number];
const SCENARIO_EVENT_CONDITION_TYPES = [
  "networth-is-above",
  "cash-is-above",
  "event-happened",
  "income-is-above",
] as const;

const assertNever = (value: never): never => {
  throw new Error(
    `Unhandled scenario event condition: ${JSON.stringify(value)}`,
  );
};

const isScenarioEventConditionType = (
  value: string,
): value is ScenarioEventCondition["type"] =>
  SCENARIO_EVENT_CONDITION_TYPES.some(
    (conditionType) => conditionType === value,
  );

interface ConditionTypeOption {
  value: ScenarioEventCondition["type"];
  label: string;
  disabled?: boolean;
}

const getDefaultConditionForType = (
  conditionType: ScenarioEventCondition["type"],
): ScenarioEventCondition => {
  switch (conditionType) {
    case "networth-is-above":
      return {
        type: "networth-is-above",
        amount: 0,
      };
    case "cash-is-above":
      return {
        type: "cash-is-above",
        amount: 0,
      };
    case "event-happened":
      return {
        type: "event-happened",
        eventName: "",
      };
    case "income-is-above":
      return {
        type: "income-is-above",
        eventName: "",
        amount: 0,
      };
    default:
      return assertNever(conditionType);
  }
};

const getConditionTypeOptions = (input: {
  initialValueBasis: ScenarioInitialValueBasis;
  currentType: ScenarioEventCondition["type"] | undefined;
}): ConditionTypeOption[] => {
  const options: ConditionTypeOption[] = [];
  const allowedThresholdType = getProjectedSeriesThresholdConditionTypeForBasis(
    input.initialValueBasis,
  );

  if (
    input.currentType &&
    isProjectedSeriesThresholdConditionType(input.currentType) &&
    input.currentType !== allowedThresholdType
  ) {
    options.push({
      value: input.currentType,
      label: `${getProjectedSeriesThresholdConditionLabel(input.currentType)} (Inactive)`,
      disabled: true,
    });
  }

  if (allowedThresholdType) {
    options.push({
      value: allowedThresholdType,
      label: getProjectedSeriesThresholdConditionLabel(allowedThresholdType),
    });
  }

  options.push(
    {
      value: "event-happened",
      label: "Event Happened",
    },
    {
      value: "income-is-above",
      label: "Income is Above",
    },
  );

  return options;
};

const getDefaultCondition = (
  initialValueBasis: ScenarioInitialValueBasis,
): ScenarioEventCondition => {
  const thresholdType =
    getProjectedSeriesThresholdConditionTypeForBasis(initialValueBasis);
  if (thresholdType) {
    return getDefaultConditionForType(thresholdType);
  }

  return getDefaultConditionForType("event-happened");
};

export function UpsertEventForm({
  scenarioId,
  onCancel,
  onSuccess,
  existingEvents = [],
  event = null,
  eventIndex = null,
  currency,
  initialValueBasis,
}: {
  scenarioId: string;
  onCancel: () => void;
  onSuccess?: () => void;
  existingEvents?: ScenarioEvent[];
  event?: ScenarioEvent | null;
  eventIndex?: number | null;
  currency: string;
  initialValueBasis: ScenarioInitialValueBasis;
}) {
  const router = useRouter();
  const isEditing = event !== null && eventIndex !== null;
  const locale = useLocale();

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: (() => {
      const eventDateRange = getScenarioEventDateRange(event);
      return {
        name: event?.name || "",
        type: (event?.type || "income") as "income" | "expense",
        amount: event?.amount || "",
        recurrence: (event?.recurrence.type || "once") as
          "once" | "monthly" | "yearly",
        startDate: eventDateRange.startDate ?? new Date(),
        endDate: eventDateRange.endDate,
        conditions: event ? extractConditionsFromEvent(event) : [],
      };
    })(),
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "conditions",
  });

  // Reset form when event changes (for edit mode)
  useEffect(() => {
    if (event) {
      const dateRange = getScenarioEventDateRange(event);
      form.reset({
        name: event.name,
        type: event.type,
        amount: event.amount,
        recurrence: event.recurrence.type,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        conditions: extractConditionsFromEvent(event),
      });
      return;
    }

    form.reset({
      name: "",
      type: "income",
      amount: "",
      recurrence: "once",
      startDate: new Date(),
      endDate: undefined,
      conditions: [],
    });
  }, [event, form]);

  const { isDirty, isSubmitting } = form.formState;
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

  const numberPlaceholders = useMemo(
    () => ({
      amount: `E.g., ${formatNumber(1000, { locale })}`,
      minimumAmount: `E.g., ${formatNumber(5000, { locale })}`,
    }),
    [locale],
  );
  const availableThresholdConditionType = useMemo(
    () => getProjectedSeriesThresholdConditionTypeForBasis(initialValueBasis),
    [initialValueBasis],
  );

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
            tag: "projected-series" as const,
            type: "networth-is-above" as const,
            value: { amount: condition.amount },
          };
        case "cash-is-above":
          return {
            tag: "projected-series" as const,
            type: "cash-is-above" as const,
            value: { amount: condition.amount },
          };
        case "event-happened":
          return {
            tag: "event" as const,
            type: "event-happened" as const,
            value: { eventName: condition.eventName },
          };
        case "income-is-above":
          return {
            tag: "event" as const,
            type: "income-is-above" as const,
            value: { eventName: condition.eventName, amount: condition.amount },
          };
        default:
          return assertNever(condition);
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

    try {
      const result = await upsertScenarioEvent(
        scenarioId,
        event,
        isEditing ? (eventIndex ?? undefined) : undefined,
      );

      if (!result.success) {
        throw new Error(result.message || "Failed to save event");
      }

      toast.success(
        isEditing ? "Event updated successfully" : "Event created successfully",
      );

      router.refresh();
      onSuccess?.();
      onCancel();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save event",
      );
    }
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
                      <SelectGroup>
                        <SelectItem value="income" className="capitalize">
                          Income
                        </SelectItem>
                        <SelectItem value="expense" className="capitalize">
                          Expense
                        </SelectItem>
                      </SelectGroup>
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
                    <LocalizedNumberInput
                      mode="input-group-input"
                      id={field.name}
                      placeholder={numberPlaceholders.amount}
                      min={0}
                      aria-invalid={fieldState.invalid}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={(field.value as string | number | null) ?? ""}
                      onValueChange={(nextValue) => field.onChange(nextValue)}
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
                    <SelectGroup>
                      <SelectItem value="once" className="capitalize">
                        Once
                      </SelectItem>
                      <SelectItem value="monthly" className="capitalize">
                        Monthly
                      </SelectItem>
                      <SelectItem value="yearly" className="capitalize">
                        Yearly
                      </SelectItem>
                    </SelectGroup>
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
              {availableThresholdConditionType === null ? (
                <p className="mt-1 text-sm text-amber-600">
                  Projected value threshold conditions are unavailable while
                  Initial value uses Manual basis.
                </p>
              ) : null}
            </div>

            {/* Conditions List */}
            {fields.length > 0 && (
              <div className="space-y-4">
                {fields.map((arrayField, index) => {
                  const conditionType = conditionTypes?.[index]?.type;
                  const conditionTypeOptions = getConditionTypeOptions({
                    initialValueBasis,
                    currentType: conditionType,
                  });
                  const isIncompatibleThresholdCondition =
                    conditionType !== undefined &&
                    isProjectedSeriesThresholdConditionType(conditionType) &&
                    conditionType !== availableThresholdConditionType;
                  const thresholdConditionDescription =
                    conditionType === "cash-is-above"
                      ? "Event fires when projected cash exceeds this amount"
                      : "Event fires when projected net worth exceeds this amount";

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
                                  if (!isScenarioEventConditionType(value)) {
                                    return;
                                  }

                                  update(
                                    index,
                                    getDefaultConditionForType(value),
                                  );
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
                                  <SelectGroup>
                                    {conditionTypeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        disabled={option.disabled}
                                      >
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
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
                      {conditionType !== undefined &&
                        isProjectedSeriesThresholdConditionType(
                          conditionType,
                        ) && (
                          <Controller
                            key={`${index}-${conditionType}-amount`}
                            control={form.control}
                            name={`conditions.${index}.amount`}
                            render={({ field, fieldState }) => (
                              <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={field.name}>
                                  Amount
                                </FieldLabel>
                                <InputGroup>
                                  <LocalizedNumberInput
                                    mode="input-group-input"
                                    id={field.name}
                                    placeholder={numberPlaceholders.amount}
                                    disabled={isIncompatibleThresholdCondition}
                                    min={0}
                                    aria-invalid={fieldState.invalid}
                                    name={field.name}
                                    ref={field.ref}
                                    onBlur={field.onBlur}
                                    value={
                                      (field.value as string | number | null) ??
                                      ""
                                    }
                                    onValueChange={(nextValue) =>
                                      field.onChange(nextValue)
                                    }
                                  />
                                  <InputGroupAddon align="inline-end">
                                    <InputGroupText>{currency}</InputGroupText>
                                  </InputGroupAddon>
                                </InputGroup>
                                <FieldDescription>
                                  {isIncompatibleThresholdCondition
                                    ? getBasisCompatibilityDescription(
                                        initialValueBasis,
                                      )
                                    : thresholdConditionDescription}
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
                                  <SelectGroup>
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
                                  </SelectGroup>
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
                                    <SelectGroup>
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
                                    </SelectGroup>
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
                                  <LocalizedNumberInput
                                    mode="input-group-input"
                                    id={field.name}
                                    placeholder={
                                      numberPlaceholders.minimumAmount
                                    }
                                    min={0}
                                    aria-invalid={fieldState.invalid}
                                    name={field.name}
                                    ref={field.ref}
                                    onBlur={field.onBlur}
                                    value={
                                      (field.value as string | number | null) ??
                                      ""
                                    }
                                    onValueChange={(nextValue) =>
                                      field.onChange(nextValue)
                                    }
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
              onClick={() => append(getDefaultCondition(initialValueBasis))}
            >
              <Plus />
              Add Condition
            </Button>
          </div>
        </div>
      </DialogBody>

      {/* Action buttons */}
      <DialogFooter>
        <Button
          onClick={onCancel}
          type="button"
          variant="outline"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!isDirty || isSubmitting}>
          {isSubmitting
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
              ? "Update event"
              : "Create event"}
        </Button>
      </DialogFooter>
    </form>
  );
}
