import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type PublicPortfolioHeaderProps = {
  username: string | null;
  avatarUrl: string | null;
};

export function PublicPortfolioHeader({
  username,
  avatarUrl,
}: PublicPortfolioHeaderProps) {
  const initial = username?.slice(0, 1) || "?";

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        <AvatarImage src={avatarUrl || undefined} alt={username || undefined} />
        <AvatarFallback className="uppercase">{initial}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-muted-foreground text-xs uppercase">
          Shared by
        </span>
        <span className="font-semibold">{username || "Anonymous"}</span>
      </div>
    </div>
  );
}
