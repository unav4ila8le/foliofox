import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSidebar } from "@/components/ui/sidebar";

import { formatCurrency } from "@/lib/number";
import { cn } from "@/lib/utils";

interface ProfileProps {
  avatarUrl: string;
  name: string;
  netWorth: number;
}

export function Profile({ avatarUrl, name, netWorth }: ProfileProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className="flex items-center gap-2">
      <Avatar className={isCollapsed ? "size-8" : "size-10"}>
        <AvatarImage src={avatarUrl} alt={name.toLowerCase()} />
        <AvatarFallback>
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex flex-col", isCollapsed && "hidden")}>
        <p className="text truncate font-semibold">{name}</p>
        <span className="text-muted-foreground truncate text-xs">
          {formatCurrency(netWorth, "EUR")}
        </span>
      </div>
    </div>
  );
}
