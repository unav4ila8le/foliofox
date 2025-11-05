"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";

type PublicPortfolioHeaderProps = {
  username: string | null;
  avatarUrl: string | null;
  currentCurrency: string;
  defaultCurrency: string;
};

export function PublicPortfolioHeader({
  username,
  avatarUrl,
  currentCurrency,
  defaultCurrency,
}: PublicPortfolioHeaderProps) {
  const displayName = username || "Anonymous";
  const initials = displayName.slice(0, 1).toUpperCase();
  const normalizedDefault = defaultCurrency?.toUpperCase() || "USD";
  const normalizedCurrent = currentCurrency?.toUpperCase() || normalizedDefault;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const form = useForm<{ currency: string }>({
    defaultValues: { currency: normalizedCurrent },
  });

  useEffect(() => {
    form.setValue("currency", normalizedCurrent, { shouldDirty: false });
  }, [form, normalizedCurrent]);

  const handleCurrencyChange = (nextValue: string) => {
    const next = nextValue.toUpperCase();
    const params = new URLSearchParams(searchParams.toString());
    if (next === normalizedDefault) {
      params.delete("currency");
    } else {
      params.set("currency", next);
    }

    const nextQuery = params.toString();
    if (nextQuery === searchParams.toString()) {
      return;
    }

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarImage src={avatarUrl || undefined} alt={displayName} />
          <AvatarFallback className="uppercase">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs uppercase">
            Shared by
          </span>
          <span className="font-semibold">{displayName}</span>
        </div>
      </div>
      <Form {...form}>
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <CurrencySelector
                  field={{
                    value: field.value,
                    onChange: (value) => {
                      field.onChange(value);
                      handleCurrencyChange(value);
                    },
                  }}
                  popoverAlign="end"
                  popoverWidth="w-64"
                />
              </FormControl>
            </FormItem>
          )}
        />
      </Form>
    </div>
  );
}
