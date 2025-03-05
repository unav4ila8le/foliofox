import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { formatCurrency } from "@/lib/number";

interface ProfileProps {
  avatarUrl: string;
  name: string;
  netWorth: number;
}

export function Profile({ avatarUrl, name, netWorth }: ProfileProps) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className={"size-10"}>
        <AvatarImage src={avatarUrl} alt={name.toLowerCase()} />
        <AvatarFallback>
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <p className="text truncate font-semibold">{name}</p>
        <span className="text-muted-foreground truncate text-xs">
          {formatCurrency(netWorth, "USD")}
        </span>
      </div>
    </div>
  );
}
