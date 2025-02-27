import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileProps {
  avatarUrl: string;
  name: string;
  balance: string;
}

export function Profile({ avatarUrl, name, balance }: ProfileProps) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-10">
        <AvatarImage src={avatarUrl} alt={name.toLowerCase()} />
        <AvatarFallback>
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <p className="text font-semibold">{name}</p>
        <span className="text-muted-foreground text-xs">{balance}</span>
      </div>
    </div>
  );
}
