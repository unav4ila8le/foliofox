import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { POSITION_TAG_COLORS } from "@/types/enums";

// These ten user-selected colors are metadata, separate from the app's theme.
export const tagColors = {
  neutral:
    "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200",
  red: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  orange:
    "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  green: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  teal: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200",
  blue: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  indigo:
    "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  violet:
    "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  pink: "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200",
} satisfies Record<(typeof POSITION_TAG_COLORS)[number], string>;

export function TagBadge({
  tag,
  className,
}: {
  tag: { name: string; color: string };
  className?: string;
}) {
  const color = Object.hasOwn(tagColors, tag.color)
    ? tagColors[tag.color as keyof typeof tagColors]
    : tagColors.blue;
  return (
    <Badge
      variant="secondary"
      className={cn("max-w-32", color, className)}
      title={tag.name}
    >
      <span className="truncate">{tag.name}</span>
    </Badge>
  );
}
