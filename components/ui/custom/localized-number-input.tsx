"use client";

import * as React from "react";
import {
  NumericFormat,
  type NumberFormatValues,
  type SourceInfo,
} from "react-number-format";

import { Input } from "@/components/ui/input";
import { InputGroupInput } from "@/components/ui/input-group";
import { useLocale } from "@/hooks/use-locale";

type LocalizedNumberInputMode = "input" | "input-group-input";

interface LocalizedNumberInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode"
> {
  mode?: LocalizedNumberInputMode;
  value?: string | number | null;
  defaultValue?: string | number | null;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onValueChange?: (
    value: string,
    values: NumberFormatValues,
    sourceInfo: SourceInfo,
  ) => void;
  locale?: string;
  useGrouping?: boolean;
  decimalScale?: number;
  fixedDecimalScale?: boolean;
  allowNegative?: boolean;
  allowLeadingZeros?: boolean;
  valueIsNumericString?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  allowedDecimalSeparators?: string[];
}

interface LocaleNumberDelimiters {
  decimalSeparator: string;
  groupSeparator: string;
}

function getLocaleNumberDelimiters(locale: string): LocaleNumberDelimiters {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
    return {
      decimalSeparator:
        parts.find((part) => part.type === "decimal")?.value ?? ".",
      groupSeparator: parts.find((part) => part.type === "group")?.value ?? ",",
    };
  } catch {
    return {
      decimalSeparator: ".",
      groupSeparator: ",",
    };
  }
}

export const LocalizedNumberInput = React.forwardRef<
  HTMLInputElement,
  LocalizedNumberInputProps
>(function LocalizedNumberInput(
  {
    mode = "input",
    value,
    defaultValue,
    onChange,
    onValueChange,
    locale,
    useGrouping = true,
    decimalScale,
    fixedDecimalScale,
    allowNegative = false,
    allowLeadingZeros = false,
    valueIsNumericString = true,
    inputMode = "decimal",
    allowedDecimalSeparators,
    ...props
  },
  ref,
) {
  const contextLocale = useLocale();
  const resolvedLocale = locale ?? contextLocale;
  const delimiters = React.useMemo(
    () => getLocaleNumberDelimiters(resolvedLocale),
    [resolvedLocale],
  );

  const decimalSeparatorCandidates = React.useMemo(() => {
    const candidates = [
      delimiters.decimalSeparator,
      ...(allowedDecimalSeparators ?? []),
    ].filter(Boolean);

    return Array.from(new Set(candidates));
  }, [allowedDecimalSeparators, delimiters.decimalSeparator]);

  const customInput = mode === "input-group-input" ? InputGroupInput : Input;

  return (
    <NumericFormat
      {...props}
      customInput={customInput}
      getInputRef={ref}
      value={value === null ? "" : value}
      defaultValue={defaultValue === null ? "" : defaultValue}
      onChange={onChange}
      onValueChange={(values, sourceInfo) => {
        if (sourceInfo.source === "prop") return;
        onValueChange?.(values.value, values, sourceInfo);
      }}
      type="text"
      inputMode={inputMode}
      thousandSeparator={useGrouping ? delimiters.groupSeparator : false}
      decimalSeparator={delimiters.decimalSeparator}
      allowedDecimalSeparators={decimalSeparatorCandidates}
      decimalScale={decimalScale}
      fixedDecimalScale={fixedDecimalScale}
      allowNegative={allowNegative}
      allowLeadingZeros={allowLeadingZeros}
      valueIsNumericString={valueIsNumericString}
    />
  );
});
