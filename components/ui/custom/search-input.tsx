"use client";

import { Search, XIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";

interface SearchInputProps extends React.ComponentProps<
  typeof InputGroupInput
> {
  className?: string;
}

export function SearchInput({
  className,
  value,
  onChange,
  ...props
}: SearchInputProps) {
  const hasValue = typeof value === "string" && value.length > 0;

  const handleClear = () => {
    onChange?.({
      target: { value: "" },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <InputGroup className={className}>
      <InputGroupInput value={value} onChange={onChange} {...props} />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      {hasValue && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
