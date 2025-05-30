import { cn } from "@/lib/utils";

interface SkeletonProps extends React.ComponentProps<"div"> {
  /**
   * Number of skeleton items to render
   * @default 1
   */
  count?: number;
}

function Skeleton({ className, count = 1, ...props }: SkeletonProps) {
  if (count === 1) {
    return (
      <div
        data-slot="skeleton"
        className={cn("bg-muted animate-pulse rounded-md", className)}
        {...props}
      />
    );
  }

  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          data-slot="skeleton"
          className={cn("bg-muted animate-pulse rounded-md", className)}
          {...props}
        />
      ))}
    </div>
  );
}

export { Skeleton };
