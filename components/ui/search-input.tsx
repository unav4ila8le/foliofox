import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "./input";
import { cn } from "@/lib/utils";

function SearchInput({
  type,
  disabled,
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative w-full">
      <Search
        className={cn(
          "absolute top-1/2 left-3 size-4 -translate-y-1/2 opacity-50",
          disabled && "opacity-25",
        )}
      />
      <Input
        type={type}
        disabled={disabled}
        className={cn("pl-9", className)}
        {...props}
      />
    </div>
  );
}

export { SearchInput };
