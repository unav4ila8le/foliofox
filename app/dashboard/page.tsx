import { CurrencySelector } from "@/components/dashboard/currency-selector";
import { getTimeBasedGreeting } from "@/lib/date";

export default function Page() {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold">{getTimeBasedGreeting()}, John</h1>
        <p className="text-muted-foreground">Here&apos;s your summary</p>
      </div>
      <CurrencySelector />
    </div>
  );
}
